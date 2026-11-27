import { requireUser } from "@/server/session";

export async function UserMenu() {
  const user = await requireUser();
  const display = user.name ?? "팀원";
  return (
    <div className="flex items-center gap-3 px-2">
      <span
        aria-hidden="true"
        className="flex size-7 flex-none items-center justify-center rounded-full bg-accent-soft-2 text-[11px] font-bold text-accent"
      >
        {display.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{display}</span>
    </div>
  );
}
