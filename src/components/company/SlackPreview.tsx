import { Fragment, type ReactNode } from "react";

/** Slack mrkdwn 일부(<url|text>, *굵게*, &amp; 등)를 화면용으로 그린다. 미리보기 전용 */
export function SlackPreview({ text }: { text: string }) {
  const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const renderLine = (line: string): ReactNode[] =>
    line.split(/(<[^>|]+\|[^>]+>|\*[^*]+\*)/g).map((part, i) => {
      const l = part.match(/^<([^>|]+)\|([^>]+)>$/);
      if (l)
        return (
          <a key={i} href={l[1]} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
            {unescape(l[2])}
          </a>
        );
      const b = part.match(/^\*([^*]+)\*$/);
      if (b) return <b key={i}>{unescape(b[1])}</b>;
      return <Fragment key={i}>{unescape(part)}</Fragment>;
    });
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-subtle p-4 text-[14px] leading-[1.6]">
      {text.split("\n").map((line, i) => (
        <p key={i} className="m-0">
          {renderLine(line)}
        </p>
      ))}
    </div>
  );
}
