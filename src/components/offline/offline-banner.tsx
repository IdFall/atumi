"use client";

import { useSyncExternalStore } from "react";

import { useT } from "@/i18n/client";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Bandeau de l'espace connecté quand l'appareil n'a plus de connexion. */
export function OfflineBanner() {
  const t = useT();
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-40 bg-nuit px-4 py-2 text-center text-sm font-medium text-white md:pl-60">
      {t.offline.banner}
    </div>
  );
}
