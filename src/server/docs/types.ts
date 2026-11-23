// 문서 → 공통 블록 (문단 / 표). 형식별 파서는 이 모양으로만 돌려준다
export type DocBlock = { type: "p"; text: string } | { type: "table"; rows: string[][] };
export type DocFormat = "hwpx" | "hwp" | "docx" | "pdf";
export type ParsedDoc = { format: DocFormat; blocks: DocBlock[] };

export class DocParseError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported" | "encrypted" | "distribution" | "corrupt" | "empty",
  ) {
    super(message);
  }
}

export const clean = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();

/** 블록 → 사람이 읽고 LLM에 넣을 텍스트. 표는 "칸 | 칸" 줄로 */
export function blocksToText(blocks: DocBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "p") {
      if (b.text) out.push(b.text);
    } else {
      const rows = b.rows.map((r) => r.map((c) => c.replace(/\n+/g, " / ")).join(" | ")).filter((r) => r.replace(/[|\s]/g, ""));
      if (rows.length) out.push(["[표]", ...rows, "[/표]"].join("\n"));
    }
  }
  return out.join("\n");
}
