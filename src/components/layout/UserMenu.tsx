import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Avatar } from "@/components/ui/Avatar";
import { requireUser } from "@/server/session";

export async function UserMenu() {
  const user = await requireUser();
  const display = user.name ?? user.email ?? "구성원";
  return (
    <div className="flex items-center gap-3 px-2">
      <Avatar name={user.name} email={user.email} size={28} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2" title={user.email ?? undefined}>
        {display}
      </span>
      <form action={logout}>
        <button type="submit" title="로그아웃" aria-label="로그아웃" className="flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface-subtle hover:text-ink">
          <LogOut size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
