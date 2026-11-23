"use client";

import { useEffect, useRef } from "react";
import { markSeen } from "@/app/(app)/applications/actions";

/**
 * 상세를 실제로 연 경우에만 새 공고 → 검토 전.
 * 렌더 중에 바꾸면 링크 프리패치만으로도 상태가 바뀌므로 마운트 후 액션으로 한다
 */
export function MarkSeen({ applicationId }: { applicationId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markSeen(applicationId);
  }, [applicationId]);
  return null;
}
