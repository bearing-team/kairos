import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ink" | "soft";
type Size = "lg" | "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white font-bold hover:bg-accent-hover",
  ink: "bg-ink-button text-white font-semibold hover:bg-ink-2",
  soft: "bg-accent-soft text-accent font-semibold hover:bg-accent-soft-2",
};

const SIZE: Record<Size, string> = {
  lg: "h-12 px-6 text-[15px]",
  md: "h-11 px-5 text-[14px]",
  sm: "h-9 px-4 text-[14px]",
};

/** DESIGN.md 4절 Button. 화면당 주요 버튼 1개 + 보조 최대 1개 */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full border-0 whitespace-nowrap",
    "transition-[background-color,transform] duration-[120ms] ease-brand active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
    VARIANT[variant],
    SIZE[size],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
