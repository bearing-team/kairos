// 뉴스레터 PDF(표 형식) → 줄·링크 → 항목. 센서블박스 위클리 형식 기준(2026-11 확인), 다른 표 형식도 날짜·★ 규칙이 맞으면 읽힌다
import { getDocumentProxy } from "unpdf";

/** 페이지별 링크. 좌표는 0~1, 위에서부터 (피트페이퍼 annotations 형식) */
export type PdfLink = { href: string; startX: number; endX: number; startY: number; endY: number };
export type PdfLine = { page: number; y: number; text: string }; // y: 0~1, 위에서부터

export type NewsletterKind = "grant" | "event" | "news" | "investment" | "other";
export type NewsletterItem = {
  n: number;
  section: string;
  kind: NewsletterKind;
  text: string; // 줄 원문 (여러 줄이면 이어 붙임)
  title: string;
  organization: string | null;
  date: string | null; // 지원사업: 마감일, 행사: 행사일 (YYYY-MM-DD)
  endDate: string | null; // 행사 기간 끝
  time: string | null;
  href: string | null;
};

/** PDF 글자 조각을 좌표로 묶어 줄로 만든다 (unpdf의 extractText는 좌표를 버려서 링크와 맞출 수 없음) */
export async function readPdfLines(buf: Uint8Array): Promise<PdfLine[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const out: PdfLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const parts = content.items
      .flatMap((it) => ("str" in it && it.str.trim() ? [{ s: it.str, x: it.transform[4] as number, y: it.transform[5] as number, w: it.width as number }] : []))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: { y: number; parts: typeof parts }[] = [];
    for (const part of parts) {
      const row = rows.find((r) => Math.abs(r.y - part.y) < 2.5);
      if (row) row.parts.push(part);
      else rows.push({ y: part.y, parts: [part] });
    }
    for (const r of rows.sort((a, b) => b.y - a.y)) {
      const ps = r.parts.sort((a, b) => a.x - b.x);
      let text = "";
      let end = -Infinity;
      for (const q of ps) {
        text += (text && q.x - end > 1.5 ? " " : "") + q.s;
        end = q.x + q.w;
      }
      out.push({ page: p, y: 1 - r.y / height, text: text.replace(/\s+/g, " ").trim() });
    }
  }
  return out;
}

const DATE = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
const ymd = (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
const SECTION = /^(\d{2})\s+(.+?)(\s+Updated)?$/;
const BOILERPLATE = /^(ⓒ|sensible\.kr|스타트업\s?인간지능|센서블박스|\d{4}년\s?\d{1,2}월\s?\d주차|Photo by|on Unsplash|이메일 정기배송)/;
const HEADER = /^(마감일|행사일|게시일|기업명)\s/;

export function sectionKind(section: string): NewsletterKind {
  if (/지원|모집|공모/.test(section)) return "grant";
  if (/행사|데모데이|이벤트|세미나/.test(section)) return "event";
  if (/투자/.test(section)) return "investment";
  if (/출시|런칭|뉴스|기사|소식/.test(section)) return "news";
  return "other";
}

/**
 * 줄 + 링크 → 항목. 표의 한 줄(항목)마다 오른쪽에 링크(★)가 하나 있으므로, 링크 상자의 세로 위치를 기준으로
 * 가까운 줄들을 묶는다 (셀이 여러 줄이면 위아래로 퍼져 있어서 순서대로 읽으면 섞인다).
 * 링크 근처에 없는 줄: 날짜로 시작하면 링크 없는 항목, 아니면 가장 가까운 항목에 붙인다.
 */
export function parseNewsletter(lines: PdfLine[], links: Record<string, PdfLink[]>): NewsletterItem[] {
  type Row = { section: string; page: number; lines: PdfLine[]; href: string | null; y: number };
  const rows: Row[] = [];
  const NEAR = 0.025;
  let section = "";
  const byPage = new Map<number, PdfLine[]>();
  for (const l of lines) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l]);

  for (const [page, pageLines] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const anchors = (links[String(page)] ?? []).map((k) => ({ href: /^https?:\/\//.test(k.href ?? "") ? k.href : null, y: (k.startY + k.endY) / 2, row: null as Row | null }));
    const pageRows: Row[] = [];
    const orphans: { line: PdfLine; section: string }[] = [];
    for (const l of pageLines) {
      const sec = l.text.match(SECTION);
      if (sec && !DATE.test(l.text)) {
        section = sec[2].trim();
        continue;
      }
      if (!section || BOILERPLATE.test(l.text) || HEADER.test(l.text)) continue;
      let best: (typeof anchors)[number] | null = null;
      for (const a of anchors) if (Math.abs(a.y - l.y) <= NEAR && (!best || Math.abs(a.y - l.y) < Math.abs(best.y - l.y))) best = a;
      if (!best) {
        orphans.push({ line: l, section });
        continue;
      }
      best.row ??= { section, page, lines: [], href: best.href, y: best.y };
      best.row.lines.push(l);
      if (!pageRows.includes(best.row)) pageRows.push(best.row);
    }
    for (const o of orphans) {
      if (DATE.test(o.line.text.slice(0, 12))) pageRows.push({ section: o.section, page, lines: [o.line], href: null, y: o.line.y });
      else {
        const near = pageRows.reduce<Row | null>((m, r) => (!m || Math.abs(r.y - o.line.y) < Math.abs(m.y - o.line.y) ? r : m), null);
        if (near) near.lines.push(o.line);
      }
    }
    rows.push(...pageRows.sort((a, b) => a.y - b.y));
  }

  return rows.map((r, i) => {
    // 날짜로 시작하는 줄을 앞에, 나머지는 위에서부터
    const sorted = [...r.lines].sort((a, b) => a.y - b.y);
    const first = sorted.findIndex((l) => /^\d{4}\.\d{1,2}\.\d{1,2}/.test(l.text));
    const ordered = first > 0 ? [sorted[first], ...sorted.slice(first + 1), ...sorted.slice(0, first)] : sorted;
    const text = ordered.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim();
    return { n: i + 1, ...describe(text, r.section), section: r.section, kind: sectionKind(r.section), text, href: r.href };
  });
}

/** 항목 글자에서 날짜·시간·제목·기관을 뽑는다 */
function describe(text: string, section: string) {
  const kind = sectionKind(section);
  let rest = text.replace(/[●○◯\s]*★\s*$/g, "").replace(/(\s[●○◯])+\s*$/g, "").replace(/★/g, " ").replace(/\s+/g, " ").trim();
  const dates: string[] = [];
  let time: string | null = null;
  if (kind !== "investment") {
    // 앞쪽 날짜(기간이면 "2026.11.18 -2026.11.19 -")와 시간
    for (;;) {
      const m = rest.match(/^-?\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\s*-?\s*/);
      if (!m) break;
      dates.push(ymd(m));
      rest = rest.slice(m[0].length);
    }
    // 기간의 끝날이 다음 줄에 있어 뒤로 밀린 경우 ("… 제주W360 -2026.11.19")
    const tail = dates.length ? rest.match(/\s-\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\s*-?(?=\s|$)/) : null;
    if (tail) {
      dates.push(ymd(tail));
      rest = (rest.slice(0, tail.index) + rest.slice(tail.index! + tail[0].length)).trim();
    }
    const t = rest.match(/^(\d{1,2}:\d{2})\s+/);
    if (t) {
      time = t[1];
      rest = rest.slice(t[0].length);
    }
  }
  const org = kind === "grant" ? rest.match(/^([^,，]{2,24}),\s*/) : null;
  return {
    title: rest,
    organization: org ? org[1].trim() : null,
    date: dates[0] ?? null,
    endDate: dates.length > 1 ? dates[dates.length - 1] : null,
    time,
  };
}
