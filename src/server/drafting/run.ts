// 초안 파이프라인 (ARCHITECTURE.md 6절). server-only 없음: pnpm draft 스크립트에서도 쓴다
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/server/db";
import { getLlm, llmConfigured, MODELS } from "@/server/llm";
import { charCount, mergeChecks } from "@/lib/needsCheck";
import { companyBlock } from "@/server/prompts/company-block";
import { FORM_SECTIONS_PROMPT_VERSION, FORM_SECTIONS_SYSTEM, FormSectionsSchema, formSectionsUserMessage, type FormSections } from "@/server/prompts/form-sections.v1";
import { DRAFT_SECTION_PROMPT_VERSION, DraftSectionSchema, draftSectionUserMessage, draftSystem } from "@/server/prompts/draft-section.v1";
import { FORM_FILL_PROMPT_VERSION, FormFillSchema, formFillSystem, formFillUserMessage } from "@/server/prompts/form-fill.v1";
import { readHwpForm, type FormField, type HwpForm } from "@/server/docs/hwpForm";
import { detectFormat } from "@/server/docs";
import { rankForms, syncAttachments } from "./attachments";
import { getFile } from "./storage";
import { pickTemplate, TEMPLATE_LABEL, TEMPLATES } from "./templates";

const STALE_MS = 15 * 60 * 1000;
const CONCURRENCY = 3;

function apiError(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "요청 한도에 걸렸어요";
  if (e instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY가 올바르지 않아요";
  if (e instanceof Anthropic.APIError) return `API 오류 (${e.status ?? "연결"})`;
  return e instanceof Error ? e.message.slice(0, 200) : String(e);
}

/** 진행 중인(오래되지 않은) 초안이 있으면 그걸 돌려준다 → 버튼을 여러 번 눌러도 하나만 */
export async function activeDraft(applicationId: string) {
  const d = await prisma.draft.findFirst({ where: { applicationId }, orderBy: { version: "desc" }, select: { id: true, status: true, updatedAt: true } });
  if (d && (d.status === "preparing" || d.status === "generating") && Date.now() - d.updatedAt.getTime() < STALE_MS) return d;
  return null;
}

/** 새 버전 초안 자리를 만든다 (실제 작업은 runDraft) */
export async function createDraft(applicationId: string, userId: string | null): Promise<{ id: string; created: boolean }> {
  const busy = await activeDraft(applicationId);
  if (busy) return { id: busy.id, created: false };
  const last = await prisma.draft.findFirst({ where: { applicationId }, orderBy: { version: "desc" }, select: { version: true } });
  try {
    const d = await prisma.draft.create({ data: { applicationId, version: (last?.version ?? 0) + 1, createdById: userId } });
    return { id: d.id, created: true };
  } catch {
    // 동시에 누가 만들었으면 (unique 충돌) 그걸 쓴다
    const d = await prisma.draft.findFirstOrThrow({ where: { applicationId }, orderBy: { version: "desc" }, select: { id: true } });
    return { id: d.id, created: false };
  }
}

async function extractSections(input: Parameters<typeof formSectionsUserMessage>[0]): Promise<FormSections> {
  const response = await getLlm().messages.parse({
    model: MODELS.draft(),
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(FormSectionsSchema) },
    system: FORM_SECTIONS_SYSTEM,
    messages: [{ role: "user", content: formSectionsUserMessage(input) }],
  });
  if (response.stop_reason === "refusal") throw new Error("모델이 응답을 거절했어요");
  if (!response.parsed_output) throw new Error(response.stop_reason === "max_tokens" ? "응답이 잘렸어요" : "응답 형식이 맞지 않아요");
  const out = response.parsed_output;
  const seen = new Set<string>();
  return {
    sections: out.sections
      .map((s) => ({ title: s.title.trim(), guidance: s.guidance.trim(), limitChars: s.limitChars && s.limitChars >= 100 && s.limitChars <= 20000 ? Math.round(s.limitChars) : null }))
      .filter((s) => s.title && !seen.has(s.title) && (seen.add(s.title), true))
      .slice(0, 15),
    criteria: out.criteria.map((c) => c.trim()).filter(Boolean).slice(0, 10),
    requiredDocs: out.requiredDocs.map((d) => ({ name: d.name.trim().slice(0, 120), required: d.required, note: d.note.trim().slice(0, 200) })).filter((d) => d.name).slice(0, 20),
  };
}

/** 양식 채우기로 갈 서식: 칸이 3개 이상 보이는 짧은 HWP 서식 (참여의향서·신청서처럼 표에 값을 넣는 양식). 긴 사업계획서는 서술형 섹션으로 */
const FILL_MIN_FIELDS = 3;
const FILL_MAX_CHARS = 6000;
async function fillableForm(forms: { id: string; fileName: string; fileKey: string | null; text: string | null }[], hasSections: boolean) {
  for (const f of forms) {
    if (!f.fileKey || (hasSections && (f.text?.length ?? 0) > FILL_MAX_CHARS)) continue;
    try {
      const buf = await getFile(f.fileKey);
      if (detectFormat(buf, f.fileName) !== "hwp") continue;
      const form = readHwpForm(buf);
      if (form.fields.length >= FILL_MIN_FIELDS) return { attachmentId: f.id, fileName: f.fileName, form };
    } catch {
      // 못 읽으면 서술형으로
    }
  }
  return null;
}

/** DraftSection.field에 저장하는 칸 정보 */
export type FieldMeta = Pick<FormField, "kind" | "mode" | "prefix" | "hint" | "options" | "multi">;
const fieldMeta = (f: FormField): FieldMeta => ({ kind: f.kind, mode: f.mode, prefix: f.prefix, hint: f.hint, options: f.options, multi: f.multi });

/** 첨부 받기 → 양식 읽기 → 섹션·서류 정하기 → 섹션별 초안 (표에 값을 넣는 서식이면 칸 채우기) */
export async function runDraft(draftId: string): Promise<void> {
  const draft = await prisma.draft.findUniqueOrThrow({
    where: { id: draftId },
    select: { applicationId: true, application: { select: { announcementId: true } } },
  });
  const notes: string[] = [];
  try {
    const att = await syncAttachments(draft.application.announcementId);
    notes.push(...att.notes);
    if (att.failed) notes.push(`첨부 ${att.failed}개는 읽지 못했어요`);

    const a = await prisma.announcement.findUniqueOrThrow({
      where: { id: draft.application.announcementId },
      select: { title: true, organization: true, summary: true, category: true, attachments: { where: { parseStatus: "parsed" }, select: { id: true, fileName: true, fileKey: true, kind: true, text: true } } },
    });
    const forms = rankForms(a.attachments);
    const notice = a.attachments.filter((x) => x.kind === "notice" && x.text).sort((x, y) => (y.text?.length ?? 0) - (x.text?.length ?? 0))[0] ?? null;

    let plan: FormSections = { sections: [], criteria: [], requiredDocs: [] };
    let templateSource: string;
    if (llmConfigured() && (forms.length || notice)) {
      const formText = forms.map((f) => `=== ${f.fileName} ===\n${f.text}`).join("\n\n");
      plan = await extractSections({
        title: a.title,
        organization: a.organization,
        summary: a.summary,
        form: forms.length ? { fileName: forms.map((f) => f.fileName).join(", "), text: formText } : null,
        notice: notice ? { fileName: notice.fileName, text: notice.text! } : null,
      });
    } else if (!forms.length) notes.push("읽을 수 있는 신청 양식이 없어요");

    let sections: { title: string; guidance: string | null; limitChars: number | null; key: string; field?: FieldMeta }[];
    const fill: { attachmentId: string; fileName: string; form: HwpForm } | null = await fillableForm(forms, plan.sections.length > 0);
    if (fill) {
      templateSource = "fill";
      sections = fill.form.fields.map((f) => ({ key: f.id, title: f.label, guidance: f.hint, limitChars: null, field: fieldMeta(f) }));
      notes.push(`${fill.fileName} 양식의 칸 ${fill.form.fields.length}개를 채워요. 다 되면 같은 양식의 HWP로 받을 수 있어요`);
    } else if (plan.sections.length) {
      templateSource = "form";
      sections = plan.sections.map((s, i) => ({ ...s, key: `s${i + 1}` }));
    } else {
      const t = pickTemplate(a);
      templateSource = `default:${t}`;
      sections = TEMPLATES[t];
      notes.push(
        llmConfigured()
          ? `양식에서 섹션을 찾지 못해 기본 템플릿(${TEMPLATE_LABEL[t]})으로 만들었어요`
          : `ANTHROPIC_API_KEY가 없어 양식을 분석하지 못했어요. 기본 템플릿(${TEMPLATE_LABEL[t]})으로 섹션만 만들었어요`,
      );
    }

    await prisma.$transaction([
      prisma.draftSection.deleteMany({ where: { draftId } }),
      prisma.draftSection.createMany({
        data: sections.map((s, i) => ({ draftId, order: i, key: s.key, title: s.title, guidance: s.guidance || null, limitChars: s.limitChars, field: s.field ?? undefined })),
      }),
      prisma.requiredDoc.createMany({
        data: plan.requiredDocs.map((d, i) => ({ applicationId: draft.applicationId, name: d.name, note: d.note || null, required: d.required, order: i })),
        skipDuplicates: true, // 사람이 바꾼 상태는 그대로
      }),
      prisma.draft.update({
        where: { id: draftId },
        data: {
          status: llmConfigured() ? "generating" : "ready",
          templateSource,
          formAttachmentId: fill?.attachmentId ?? forms[0]?.id ?? null,
          criteria: plan.criteria,
          notes,
          model: llmConfigured() ? MODELS.draft() : null,
          promptVersion: llmConfigured() ? `${FORM_SECTIONS_PROMPT_VERSION}+${fill ? FORM_FILL_PROMPT_VERSION : DRAFT_SECTION_PROMPT_VERSION}` : null,
        },
      }),
    ]);
    if (llmConfigured()) await generateSections(draftId);
  } catch (e) {
    await prisma.draft.update({ where: { id: draftId }, data: { status: "failed", error: apiError(e), notes } });
  }
}

/** 섹션 초안 쓰기. sectionIds가 없으면 비어 있거나 실패한 섹션 전부 */
export async function generateSections(draftId: string, opts: { sectionIds?: string[]; instruction?: string } = {}): Promise<{ done: number; failed: number }> {
  const kind = await prisma.draft.findUniqueOrThrow({ where: { id: draftId }, select: { templateSource: true } });
  if (kind.templateSource === "fill") return fillFields(draftId, opts);
  const d = await prisma.draft.findUniqueOrThrow({
    where: { id: draftId },
    select: {
      criteria: true,
      sections: { orderBy: { order: "asc" }, select: { id: true, title: true, guidance: true, limitChars: true, status: true } },
      application: {
        select: {
          company: true,
          match: { select: { suggestedItemCardId: true } },
          announcement: {
            select: { title: true, organization: true, target: true, supportAmountText: true, applyPeriodText: true, summary: true, attachments: { where: { kind: "notice", parseStatus: "parsed" }, select: { text: true } } },
          },
        },
      },
    },
  });
  const app = d.application;
  const cards = await prisma.itemCard.findMany({ where: { companyId: app.company.id }, orderBy: { createdAt: "asc" } });
  const now = new Date();
  const system = draftSystem({
    companyBlock: companyBlock(app.company, cards, cards.find((c) => c.id === app.match.suggestedItemCardId)?.name ?? null, now),
    announcement: app.announcement,
    criteria: d.criteria,
    outline: d.sections.map((s) => s.title),
    noticeText: app.announcement.attachments.map((x) => x.text).filter(Boolean).sort((x, y) => y!.length - x!.length)[0] ?? null,
    now,
  });
  const model = MODELS.draft();

  const targets = d.sections.filter((s) => (opts.sectionIds ? opts.sectionIds.includes(s.id) : s.status === "empty" || s.status === "failed"));
  await prisma.draftSection.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { status: "generating", error: null } });
  await prisma.draft.update({ where: { id: draftId }, data: { status: "generating" } });

  let done = 0;
  let failed = 0;
  const queue = [...targets];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      try {
        let note = opts.instruction ? `추가 요청: ${opts.instruction}` : undefined;
        let out: { content: string; needsCheck: string[] } | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const response = await getLlm().messages.parse({
            model,
            max_tokens: 16000,
            output_config: { effort: "medium", format: zodOutputFormat(DraftSectionSchema) },
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: draftSectionUserMessage(s, note) }],
          });
          if (response.stop_reason === "refusal") throw new Error("모델이 응답을 거절했어요");
          out = response.parsed_output;
          if (!out) {
            if (attempt === 2) throw new Error("응답 형식이 맞지 않아요");
            continue;
          }
          // 분량을 10% 넘게 넘기면 한 번만 줄여 달라고
          if (s.limitChars && charCount(out.content) > s.limitChars * 1.1 && attempt === 1) {
            note = `${note ? `${note}\n` : ""}지난번 답이 ${charCount(out.content)}자로 제한(${s.limitChars}자)을 넘었다. 제한 안으로 줄여서 다시 써 줘.`;
            continue;
          }
          break;
        }
        const content = out!.content.trim();
        await prisma.draftSection.update({
          where: { id: s.id },
          data: { content, aiContent: content, needsCheck: mergeChecks(content, out!.needsCheck), status: "done", generatedBy: "ai", model, promptVersion: DRAFT_SECTION_PROMPT_VERSION, error: null },
        });
        done++;
      } catch (e) {
        failed++;
        await prisma.draftSection.update({ where: { id: s.id }, data: { status: "failed", error: apiError(e) } });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  const still = await prisma.draftSection.count({ where: { draftId, status: "generating" } });
  if (!still) await prisma.draft.update({ where: { id: draftId }, data: { status: "ready" } });
  return { done, failed };
}

type ContactCompany = {
  name: string;
  address: string | null;
  ceoName: string | null;
  contactName: string | null;
  contactDept: string | null;
  contactTitle: string | null;
  contactPhone: string | null;
  contactTel: string | null;
  contactEmail: string | null;
  bizType: string | null;
};
function contactBlock(c: ContactCompany): string {
  const v = (x: string | null) => x || "(프로필에 없음)";
  return [
    `- 기관(기업)명: ${c.name}`,
    `- 기관 유형: ${c.bizType ? "기업" : "(프로필에 없음)"}`,
    `- 본사 주소: ${v(c.address)}`,
    `- 대표자: ${v(c.ceoName)}`,
    `- 신청 담당자: ${v(c.contactName)}`,
    `- 담당자 부서: ${v(c.contactDept)}`,
    `- 담당자 직위: ${v(c.contactTitle)}`,
    `- 담당자 휴대전화: ${v(c.contactPhone)}`,
    `- 사무실 전화: ${v(c.contactTel)}`,
    `- 담당자 이메일: ${v(c.contactEmail)}`,
  ].join("\n");
}

/** 양식 칸 채우기 (한 번의 호출로 대상 칸 전부). 모르는 칸은 비워 두고 확인 필요로 */
async function fillFields(draftId: string, opts: { sectionIds?: string[]; instruction?: string }): Promise<{ done: number; failed: number }> {
  const d = await prisma.draft.findUniqueOrThrow({
    where: { id: draftId },
    select: {
      sections: { orderBy: { order: "asc" }, select: { id: true, key: true, title: true, guidance: true, status: true, field: true } },
      formAttachment: { select: { fileName: true } },
      application: {
        select: {
          company: true,
          match: { select: { suggestedItemCardId: true } },
          announcement: { select: { title: true, organization: true, summary: true, attachments: { where: { kind: "notice", parseStatus: "parsed" }, select: { text: true } } } },
        },
      },
    },
  });
  const app = d.application;
  const targets = d.sections.filter((s) => (opts.sectionIds ? opts.sectionIds.includes(s.id) : s.status === "empty" || s.status === "failed"));
  if (!targets.length) return { done: 0, failed: 0 };
  await prisma.draftSection.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { status: "generating", error: null } });
  await prisma.draft.update({ where: { id: draftId }, data: { status: "generating" } });

  const cards = await prisma.itemCard.findMany({ where: { companyId: app.company.id }, orderBy: { createdAt: "asc" } });
  const now = new Date();
  const model = MODELS.draft();
  let done = 0;
  let failed = 0;
  try {
    const response = await getLlm().messages.parse({
      model,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(FormFillSchema) },
      system: formFillSystem({
        companyBlock: companyBlock(app.company, cards, cards.find((c) => c.id === app.match.suggestedItemCardId)?.name ?? null, now),
        contactBlock: contactBlock(app.company),
        announcement: app.announcement,
        noticeText: app.announcement.attachments.map((x) => x.text).filter(Boolean).sort((x, y) => y!.length - x!.length)[0] ?? null,
        now,
      }),
      messages: [
        {
          role: "user",
          content:
            formFillUserMessage(
              d.formAttachment?.fileName ?? null,
              targets.map((t) => {
                const f = t.field as FieldMeta | null;
                return { id: t.key, label: t.title, kind: f?.kind ?? "text", options: f?.options ?? [], multi: f?.multi ?? false, hint: t.guidance };
              }),
            ) + (opts.instruction ? `\n\n추가 요청: ${opts.instruction}` : ""),
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new Error("모델이 응답을 거절했어요");
    if (!response.parsed_output) throw new Error(response.stop_reason === "max_tokens" ? "응답이 잘렸어요" : "응답 형식이 맞지 않아요");
    const byId = new Map(response.parsed_output.fields.map((f) => [f.id, f]));
    for (const t of targets) {
      const meta = t.field as FieldMeta | null;
      const out = byId.get(t.key);
      if (!out) {
        failed++;
        await prisma.draftSection.update({ where: { id: t.id }, data: { status: "failed", error: "모델이 이 칸을 빠뜨렸어요" } });
        continue;
      }
      const content = meta?.kind === "choice" ? out.selected.filter((o) => meta.options.includes(o)).slice(0, meta.multi ? undefined : 1).join(", ") : out.value.trim();
      const checks = [out.needsCheck.trim(), !content ? "비어 있어요" : ""].filter(Boolean);
      await prisma.draftSection.update({
        where: { id: t.id },
        data: { content, aiContent: content, needsCheck: [...new Set(checks)].slice(0, 1), status: "done", generatedBy: "ai", model, promptVersion: FORM_FILL_PROMPT_VERSION, error: null },
      });
      done++;
    }
  } catch (e) {
    failed = targets.length;
    await prisma.draftSection.updateMany({ where: { id: { in: targets.map((t) => t.id) }, status: "generating" }, data: { status: "failed", error: apiError(e) } });
  }
  const still = await prisma.draftSection.count({ where: { draftId, status: "generating" } });
  if (!still) await prisma.draft.update({ where: { id: draftId }, data: { status: "ready" } });
  return { done, failed };
}

/** 진행 결정(drafting) 때 초안이 아직 없으면 만든다 */
export async function ensureDraft(applicationId: string, userId: string | null): Promise<string | null> {
  const any = await prisma.draft.findFirst({ where: { applicationId }, select: { id: true } });
  if (any) return null;
  const { id, created } = await createDraft(applicationId, userId);
  return created ? id : null;
}
