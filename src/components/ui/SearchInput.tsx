import { Search } from "lucide-react";

export function SearchInput({
  placeholder = "공고명, 기관 검색",
  label = "공고 검색",
  name = "q",
  defaultValue,
}: {
  placeholder?: string;
  label?: string;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex h-11 w-full items-center gap-2 rounded-full border border-line-strong bg-surface px-4 md:w-60">
      <Search size={16} strokeWidth={2} className="flex-none text-ink-3" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
      />
    </label>
  );
}
