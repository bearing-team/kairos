"use client";

import { useEffect, useRef } from "react";

/** <details> 팝오버: 바깥을 누르거나 Esc면 닫는다 */
export function useDismiss<T extends HTMLDetailsElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e.type === "keydown" ? (e as KeyboardEvent).key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return ref;
}
