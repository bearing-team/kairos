import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LogoMark } from "@/components/layout/LogoMark";
import { AuthForm } from "@/components/auth/AuthForm";
import { currentUser } from "@/server/session";

export const metadata = { title: "로그인 · Kairos" };

type SP = Promise<{ mode?: string; next?: string }>;

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-8 rounded-xl border border-line bg-surface p-8">
        <Suspense fallback={<Head mode="login" />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

function Head({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className="flex flex-col gap-5">
      <LogoMark size={40} />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] leading-[1.35] font-extrabold tracking-[-0.02em]">{mode === "signup" ? "Kairos 가입하기" : "Kairos"}</h1>
        <p className="m-0 text-[14px] leading-[1.7] text-ink-3">
          {mode === "signup" ? "소속 회사를 넣으면 같은 회사 구성원과 초안을 나눠 쓰고 서로 요청을 보낼 수 있어요." : "로그인하면 이번 주에 챙길 공고와 나에게 온 요청을 바로 볼 수 있어요."}
        </p>
      </div>
    </div>
  );
}

async function LoginContent({ searchParams }: { searchParams: SP }) {
  await connection();
  const { mode: rawMode, next: rawNext } = await searchParams;
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  if (await currentUser()) redirect(next);
  const mode = rawMode === "signup" ? "signup" : "login";
  return (
    <>
      <Head mode={mode} />
      <AuthForm key={mode} mode={mode} next={next} />
    </>
  );
}
