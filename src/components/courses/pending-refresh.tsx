"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge la page toutes les quelques secondes tant qu'un document est en cours de lecture. */
export function PendingRefresh({ active, intervalMs = 5000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);
  return null;
}
