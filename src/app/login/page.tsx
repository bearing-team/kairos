import { Suspense } from "react";
import { signIn, devLoginEnabled, googleConfigured } from "@/auth";
import { LogoMark } from "@/components/layout/LogoMark";
import { buttonClass } from "@/components/ui/Button";

export const metadata = { title: "로그인 · Kairos" };

const ERROR_TEXT: Record<string, string> = {
  AccessDenied: "팀 도메인 계정으로만 들어올 수 있어요. 회사 구글 계정으로 다시 시도해 주세요.",
  Configuration: "로그인 설정에 문제가 있어요. 관리자에게 알려 주세요.",
};

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-8 rounded-xl border border-line bg-surface p-8">
        <div className="flex flex-col gap-5">
          <LogoMark size={40} />
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[28px] leading-[1.35] font-extrabold tracking-[-0.02em]">Kairos</h1>
            <p className="m-0 text-[14px] leading-[1.7] text-ink-3">
              베어링 팀 계정으로 로그인하면 이번 주에 챙길 공고를 바로 볼 수 있어요.
            </p>
          </div>
        </div>
        <Suspense fallback={null}>
          <LoginActions searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginActions({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  const redirectTo = callbackUrl?.startsWith("/") ? callbackUrl : "/";
  const message = error ? (ERROR_TEXT[error] ?? "로그인하지 못했어요. 다시 시도해 주세요.") : null;

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p role="alert" className="m-0 rounded-lg bg-[var(--status-review-bg)] px-4 py-3 text-[13px] leading-[1.6] text-urgent-text">
          {message}
        </p>
      ) : null}

      {googleConfigured ? (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button type="submit" className={buttonClass("primary", "lg", "w-full")}>
            Google 계정으로 로그인
          </button>
        </form>
      ) : (
        <p className="m-0 text-[13px] leading-[1.6] text-ink-3">
          Google 로그인이 아직 설정되지 않았어요. <code>.env</code>의 AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET을 채워 주세요.
        </p>
      )}

      {devLoginEnabled ? (
        <form
          action={async () => {
            "use server";
            await signIn("dev", { redirectTo });
          }}
        >
          <button type="submit" className={buttonClass("soft", "md", "w-full")}>
            개발용 계정으로 들어가기
          </button>
        </form>
      ) : null}
    </div>
  );
}
