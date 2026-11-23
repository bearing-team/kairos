import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { exportFileName, toDocx, toMarkdown, type ExportDoc } from "./format";

const doc: ExportDoc = {
  title: "2027 초기창업패키지",
  company: "베어링(주)",
  version: 2,
  date: "2026-11-23",
  sections: [
    { title: "문제 인식", content: "첫 줄\n- 고객은 【확인 필요: 주요 고객사】\n- 둘째" },
    { title: "팀 구성", content: "" },
  ],
};

describe("내보내기", () => {
  it("Markdown", () => {
    const md = toMarkdown(doc);
    expect(md).toContain("# 2027 초기창업패키지");
    expect(md).toContain("## 문제 인식\n\n첫 줄\n- 고객은 【확인 필요: 주요 고객사】");
    expect(md).toContain("## 팀 구성\n\n(비어 있음)");
  });

  it("DOCX: 제목·섹션·확인 필요 형광", async () => {
    const buf = await toDocx(doc);
    const xml = strFromU8(unzipSync(new Uint8Array(buf))["word/document.xml"]);
    expect(xml).toContain("2027 초기창업패키지");
    expect(xml).toContain("1. 문제 인식");
    expect(xml).toMatch(/<w:highlight w:val="yellow"\/>[\s\S]*?【확인 필요: 주요 고객사】/);
    expect(xml).toContain("<w:numPr>"); // "- " 줄은 글머리 목록
  });

  it("파일 이름에서 못 쓰는 글자를 뺀다", () => {
    expect(exportFileName({ ...doc, title: 'A/B:C*"D' }, "docx")).toBe("A B C D_사업계획서_초안_v2.docx");
  });
});
