"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 초안을 쓰는 동안 몇 초마다 화면을 새로 읽는다 */
export function DraftPoller({ active, everyMs = 3000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}
