/** 이니셜 원형 아바타 (DESIGN.md Avatar). 28 카드 / 24 보드 / 32 헤더 */
export function initials(name: string | null | undefined, email?: string | null) {
  const src = (name ?? email ?? "?").trim();
  if (/^[가-힣]/.test(src)) return src.replace(/\s+/g, "").slice(-2); // 한글 이름은 뒤 두 글자
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({
  name,
  email,
  size = 28,
  tone = "accent",
}: {
  name: string | null | undefined;
  email?: string | null;
  size?: 24 | 28 | 32;
  /** neutral: 보드 카드 (#EEF0F6 바탕, 10px) */
  tone?: "accent" | "neutral";
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold ${tone === "neutral" ? "text-[10px] text-ink-2" : "bg-accent-soft-2 text-[11px] text-accent"}`}
      style={{ width: size, height: size, background: tone === "neutral" ? "var(--avatar-neutral)" : undefined }}
    >
      {name === null && email === null ? "-" : initials(name, email)}
    </span>
  );
}
