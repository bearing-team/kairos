export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-sm bg-accent"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.5625}
        height={size * 0.5625}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h16M4 12h10M4 17h6" />
      </svg>
    </div>
  );
}
