"use client";

import { useEffect } from "react";

import { SERVICE_WORKER_URL } from "@/lib/offline";

/** Installe le service worker du mode hors ligne partiel (version en ligne seulement). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" }).catch(() => {
      // Navigateur sans service worker ou refus : l'appli marche en ligne comme avant.
    });
  }, []);
  return null;
}
