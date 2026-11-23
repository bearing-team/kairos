import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// 폼 입력은 알약형 대신 라운드 12, h44 (DESIGN.md 5.6)
const control =
  "w-full rounded-md border border-line-strong bg-surface px-4 text-[14px] text-ink outline-none transition-colors duration-[120ms] placeholder:text-ink-3 focus:border-accent aria-[invalid=true]:border-urgent";

export function Field({
  label,
  name,
  help,
  error,
  children,
  wide,
}: {
  label: string;
  name: string;
  help?: string;
  error?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={["flex flex-col gap-2", wide ? "md:col-span-2" : ""].join(" ")}>
      <label htmlFor={name} className="text-[14px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="m-0 text-[13px] text-urgent-text">
          {error}
        </p>
      ) : help ? (
        <p id={`${name}-help`} className="m-0 text-[13px] leading-[1.5] text-ink-3">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input id={props.name} aria-invalid={invalid || undefined} className={`${control} h-11`} {...props} />;
}

export function TextArea({ invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      id={props.name}
      rows={4}
      aria-invalid={invalid || undefined}
      className={`${control} py-3 leading-[1.7]`}
      {...props}
    />
  );
}

export function Select({
  options,
  placeholder = "선택 안 함",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select id={props.name} className={`${control} h-11 appearance-auto`} {...props}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FormMessage({ state }: { state?: { ok?: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <p role="status" className={`m-0 text-[13px] ${state.ok ? "text-[var(--status-submitted-fg)]" : "text-urgent-text"}`}>
      {state.message}
    </p>
  );
}
