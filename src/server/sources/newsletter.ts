// 뉴스레터 붙여 넣기: 공유 링크 → 표의 모든 줄 → 공고로 저장 (분류 없이 전부, 목록에서 바로 보이게).
// 기업마당·K-Startup 링크면 그 소스의 공고와 같은 것으로 본다 (이미 있으면 새로 안 만들고, 나중에 들어오면 upsert가 묶는다).
// server-only를 붙이지 않는다: tsx 스크립트에서도 쓴다
import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeUrl } from "@/server/sources/fetchPage";
import { fetchFeatpaper, isFeatpaper } from "@/server/sources/featpaper";
import { parseNewsletter, readPdfLines, type NewsletterItem, type NewsletterKind, type PdfLine, type PdfLink } from "@/server/sources/newsletterPdf";
import { parseKstDate } from "@/server/sources/dates";
import { upsertAnnouncements } from "@/server/sources/upsert";
import { SourceError, type NormalizedAnnouncement } from "@/server/sources/types";

export const NEWSLETTER_CATEGORY: Record<NewsletterKind, string> = { grant: "지원사업", event: "행사", news: "뉴스", investment: "투자", other: "기타" };

/** 화면·DB에 두는 줄: 파싱 결과 + 어떻게 저장됐는지 */
export type NewsletterRow = NewsletterItem & { status: "new" | "updated" | "existing"; announcementId: string | null };

/** 기업마당·K-Startup 상세 링크 → 그 소스의 공고 ID */
export function apiRef(href: string | null): { source: "kstartup" | "bizinfo"; externalId: string } | null {
  if (!href) return null;
  try {
    const u = new URL(href);
    const ks = u.hostname.endsWith("k-startup.go.kr") ? u.searchParams.get("pbancSn") : null;
    if (ks) return { source: "kstartup", externalId: ks };
    const bz = u.hostname.endsWith("bizinfo.go.kr") ? u.searchParams.get("pblancId") : null;
    if (bz) return { source: "bizinfo", externalId: bz };
  } catch {}
  return null;
}

const dot = (ymd: string) => ymd.replace(/-/g, ".");

export function rowToAnnouncement(item: NewsletterItem, issue: { id: string; key: string; title: string }): NormalizedAnnouncement {
  const ref = apiRef(item.href);
  const date = item.date ? parseKstDate(item.date) : null;
  const end = item.endDate ? parseKstDate(item.endDate) : null;
  const period =
    item.kind === "grant"
      ? item.date ? `~ ${dot(item.date)}` : null
      : item.kind === "event"
        ? item.date ? `행사 ${dot(item.date)}${item.endDate ? ` ~ ${dot(item.endDate)}` : ""}${item.time ? ` ${item.time}` : ""}` : null
        : item.date ? `게시 ${dot(item.date)}` : null;
  return {
    source: "newsletter",
    externalId: ref ? `${ref.source}:${ref.externalId}` : (item.href ?? `${issue.key}#${item.n}`),
    url: item.href,
    title: (item.title || item.text).slice(0, 300),
    organization: item.organization,
    executingOrg: null,
    summary: item.text,
    target: null,
    regionLimit: null,
    // 지원사업은 마감일, 행사는 행사일(기간이면 끝날)을 마감으로 둔다 → 지나면 기본 목록에서 빠진다. 뉴스·투자는 날짜 없음
    applyStart: null,
    applyEnd: item.kind === "grant" ? date : item.kind === "event" ? (end ?? date) : null,
    applyPeriodText: period,
    supportAmountText: null,
    category: NEWSLETTER_CATEGORY[item.kind],
    hashtags: [item.section],
    applyUrl: null,
    newsletterIssueId: issue.id,
    attachments: [],
    raw: { issue: issue.key, issueTitle: issue.title, n: item.n, section: item.section, kind: item.kind, text: item.text, time: item.time },
  };
}

/** 줄들을 저장. 같은 공고가 기업마당·K-Startup·다른 소스에 이미 있으면 건너뛰고 그 공고를 가리킨다 */
export async function saveNewsletterRows(items: NewsletterItem[], issue: { id: string; key: string; title: string }) {
  const refs = items.map((i) => apiRef(i.href));
  const hrefs = items.flatMap((i) => (i.href ? [i.href] : []));
  const existing = await prisma.announcement.findMany({
    where: {
      source: { not: "newsletter" },
      OR: [
        ...refs.flatMap((r) => (r ? [{ source: r.source, externalId: r.externalId }] : [])),
        ...(hrefs.length ? [{ url: { in: hrefs } }] : []),
      ],
    },
    select: { id: true, source: true, externalId: true, url: true, duplicateOfId: true },
  });
  const rows: NewsletterRow[] = [];
  const toSave: { i: number; a: NormalizedAnnouncement }[] = [];
  items.forEach((item, i) => {
    const r = refs[i];
    const hit = existing.find((e) => (r && e.source === r.source && e.externalId === r.externalId) || (item.href && e.url === item.href));
    if (hit) rows.push({ ...item, status: "existing", announcementId: hit.duplicateOfId ?? hit.id });
    else {
      rows.push({ ...item, status: "new", announcementId: null });
      toSave.push({ i, a: rowToAnnouncement(item, issue) });
    }
  });
  // 같은 호 안에서 링크가 겹치면(기사 하나에 두 회사 등) 같은 내용이면 한 번만, 다르면 줄 번호로 나눈다
  const byId = new Map<string, NormalizedAnnouncement>();
  for (const t of toSave) {
    const prev = byId.get(t.a.externalId);
    if (prev && prev.title !== t.a.title) t.a.externalId = `${t.a.externalId}#${items[t.i].n}`;
    if (!byId.has(t.a.externalId)) byId.set(t.a.externalId, t.a);
  }
  const unique = [...byId.values()].map((a) => ({ a }));
  const res = await upsertAnnouncements(unique.map((u) => u.a));
  const saved = await prisma.announcement.findMany({
    where: { source: "newsletter", externalId: { in: unique.map((u) => u.a.externalId) } },
    select: { id: true, externalId: true, duplicateOfId: true },
  });
  const created = new Set(res.createdIds);
  for (const { i, a } of toSave) {
    const s = saved.find((x) => x.externalId === a.externalId);
    if (!s) continue;
    rows[i].announcementId = s.duplicateOfId ?? s.id;
    rows[i].status = s.duplicateOfId ? "existing" : created.has(s.id) ? "new" : "updated";
  }
  return { rows, createdIds: res.createdIds, changedIds: res.changedIds };
}

export function countRows(rows: NewsletterRow[]) {
  const by = (k: NewsletterKind) => rows.filter((r) => r.kind === k).length;
  return {
    total: rows.length,
    grant: by("grant"),
    event: by("event"),
    news: by("news"),
    investment: by("investment"),
    created: rows.filter((r) => r.status === "new").length,
    existing: rows.filter((r) => r.status === "existing").length,
  };
}

/** 링크를 읽어 PDF 줄·링크까지 (DB에 안 씀) */
export async function readNewsletter(rawUrl: string): Promise<{ key: string; url: string; title: string; pdfSrc: string | null; items: NewsletterItem[] }> {
  const url = normalizeUrl(rawUrl);
  if (!isFeatpaper(url)) throw new SourceError("newsletter", "지금은 피트페이퍼(featpaper.com) 공유 링크만 읽을 수 있어요");
  const fp = await fetchFeatpaper(url);
  const lines: PdfLine[] = await readPdfLines(fp.pdf);
  const items = parseNewsletter(lines, fp.links as Record<string, PdfLink[]>);
  if (!items.length) throw new SourceError("newsletter", "PDF에서 표를 찾지 못했어요. 다른 형식의 뉴스레터일 수 있어요");
  return { key: `featpaper:${fp.key}`, url, title: fp.title ?? "뉴스레터", pdfSrc: fp.pdfSrc, items };
}

/** 붙여 넣기 한 번: 읽기 → 호 저장 → 줄 저장 → 결과를 호에 기록 */
export async function importNewsletter(rawUrl: string, userId: string | null) {
  const nl = await readNewsletter(rawUrl);
  const issue = await prisma.newsletterIssue.upsert({
    where: { key: nl.key },
    create: { key: nl.key, url: nl.url, title: nl.title, pdfSrc: nl.pdfSrc, items: [], createdById: userId },
    update: { url: nl.url, title: nl.title, pdfSrc: nl.pdfSrc, fetchedAt: new Date() },
  });
  const { rows, createdIds, changedIds } = await saveNewsletterRows(nl.items, { id: issue.id, key: nl.key, title: nl.title });
  await prisma.newsletterIssue.update({ where: { id: issue.id }, data: { items: rows as unknown as Prisma.InputJsonValue } });
  return { issueId: issue.id, title: nl.title, counts: countRows(rows), announcementIds: [...createdIds, ...changedIds] };
}
