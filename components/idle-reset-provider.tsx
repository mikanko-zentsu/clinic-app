"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

interface IdleResetProviderProps {
  children: React.ReactNode;
}

export function IdleResetProvider({ children }: IdleResetProviderProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      router.push("/");
    }, IDLE_TIMEOUT_MS);
  }, [router]);

  useEffect(() => {
    const events = ["pointerdown", "touchstart", "keydown", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  return <>{children}</>;
}
