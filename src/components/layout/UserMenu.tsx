import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { requireUser } from "@/server/session";

export async function UserMenu() {
  const user = await requireUser();
  const display = user.name ?? user.email ?? "팀원";
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
      className="flex items-center gap-3 px-2"
    >
      <span
        aria-hidden="true"
        className="flex size-7 flex-none items-center justify-center rounded-full bg-accent-soft-2 text-[11px] font-bold text-accent"
      >
        {display.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{display}</span>
      <button
        type="submit"
        title="로그아웃"
        aria-label="로그아웃"
        className="flex size-8 items-center justify-center rounded-full text-ink-3 transition-colors duration-[120ms] hover:bg-surface-subtle hover:text-ink-2"
      >
        <LogOut size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}
