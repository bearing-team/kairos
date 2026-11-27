// server-only를 붙이지 않는다: 게시판 확인(boards.ts)이 워커·tsx에서도 쓴다
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getLlm, llmConfigured, MODELS } from "@/server/llm";
import { URL_EXTRACT_SYSTEM, UrlExtractSchema, urlExtractUserMessage, type UrlExtract } from "@/server/prompts/url-extract.v2";
import { fetchHtml, readPage, type FetchedPage } from "./fetchPage";
import { noticeAttachments } from "./noticeAttachment";

export type ExtractResult = {
  page: Pick<FetchedPage, "url" | "title" | "links">;
  fields: UrlExtract | null;
  note: string | null; // 사람이 봐야 할 안내 (LLM 미사용, 공고 아님 등)
};

/** URL → 페이지 본문 (+ 본문에 접수 기간이 없으면 공고문 첨부) → (가능하면) LLM으로 공고 필드 구조화. 저장은 사람이 확인한 뒤 */
export async function extractFromUrl(url: string): Promise<ExtractResult> {
  const { url: finalUrl, html } = await fetchHtml(url);
  const page = readPage(html, finalUrl);
  const base = { url: page.url, title: page.title, links: page.links };

  if (!llmConfigured()) {
    return { page: base, fields: null, note: "ANTHROPIC_API_KEY가 없어 자동 정리를 건너뛰었어요. 내용을 직접 채워 주세요." };
  }
  const { attachments, note: attachNote } = await noticeAttachments({ url: page.url, html, text: page.text });
  if (page.text.length < 50 && !attachments.length) {
    return { page: base, fields: null, note: "페이지 본문을 거의 읽지 못했어요 (스크립트로 그리는 페이지일 수 있어요). 직접 채워 주세요." };
  }

  try {
    const response = await getLlm().messages.parse({
      model: MODELS.extract(),
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(UrlExtractSchema) },
      system: URL_EXTRACT_SYSTEM,
      messages: [{ role: "user", content: urlExtractUserMessage(page, attachments) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { page: base, fields: null, note: "자동 정리에 실패했어요. 직접 채워 주세요." };
    }
    const fields = response.parsed_output;
    return {
      page: base,
      fields,
      note: fields.isAnnouncement ? attachNote : "지원사업 공고 페이지가 아닌 것 같아요. 내용을 확인해 주세요.",
    };
  } catch (e) {
    const msg =
      e instanceof Anthropic.RateLimitError
        ? "요청이 많아 자동 정리를 못 했어요"
        : e instanceof Anthropic.AuthenticationError
          ? "ANTHROPIC_API_KEY가 올바르지 않아요"
          : e instanceof Anthropic.APIError
            ? `자동 정리 중 오류가 났어요 (${e.status})`
            : "자동 정리 중 오류가 났어요";
    return { page: base, fields: null, note: `${msg}. 직접 채워 주세요.` };
  }
}
