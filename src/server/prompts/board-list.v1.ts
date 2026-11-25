import { z } from "zod";
import type { ListLink } from "@/server/sources/boardList";

export const BOARD_LIST_PROMPT_VERSION = "board-list.v1";

/** 게시판 목록에서 고른 글. 번호는 입력 목록의 번호만 (주소를 지어내지 못하게) */
export const BoardListSchema = z.object({
  isBoard: z.boolean().describe("이 페이지가 공고·사업 안내 글 목록(게시판)인지"),
  picks: z.array(z.number().int()).describe("지원사업·모집 공고로 보이는 글의 번호"),
});
export type BoardList = z.infer<typeof BoardListSchema>;

export const BOARD_LIST_SYSTEM = `너는 한국 정부·지자체·진흥원·센터 홈페이지의 게시판 목록에서 기업 지원사업 공고 글을 고른다.
입력은 그 페이지의 링크 목록이다. 각 줄: 번호, 링크 글자, 그 링크가 있는 줄의 글자(접수 기간·마감 표시가 있을 수 있음).
고르는 글:
- 기업·창업자·소상공인이 신청하는 지원사업, 참여기업·수혜기업 모집, 바우처, 사업화·기술개발·마케팅·수출 지원 공고
- 행사·박람회라도 참가기업을 모집하는 공고
빼는 글:
- 메뉴, 페이지 번호, 로그인, 사이트맵 같은 사이트 이동 링크
- 선정 결과·합격자·평가 결과 발표, 설명회 자료만 있는 글
- 채용, 입찰·용역·계약, 시스템 점검, 개인정보·기관 소식
- 줄 글자에 접수 마감·종료가 적힌 글
애매하면 고른다 (글을 열어 다시 확인한다). 목록에 있는 번호만 쓴다.`;

export function boardListUserMessage(page: { url: string; title: string | null }, links: ListLink[]) {
  const lines = links.map((l, i) => `${i + 1}. ${l.text}${l.context && l.context !== l.text ? ` || ${l.context}` : ""}`);
  return `페이지: ${page.url}
제목: ${page.title ?? "(없음)"}

<links>
${lines.join("\n")}
</links>`;
}
