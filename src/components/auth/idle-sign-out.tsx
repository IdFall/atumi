"use client";

import { useEffect, useTransition } from "react";

import { ACTIVITY_STORAGE_KEY, INACTIVITY_LIMIT_MS, isInactive } from "@/config/session";
import { clearOfflineData, OFFLINE_PATH } from "@/lib/offline";
import { inactiveSignOutAction } from "@/server/auth/actions";

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
const SAVE_EVERY_MS = 15_000;
const CHECK_EVERY_MS = 30_000;

function readLast(): number | null {
  try {
    const value = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveLast(now: number) {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
  } catch {
    // Stockage indisponible (navigation privée) : le contrôle du serveur reste actif.
  }
}

/**
 * Espace connecté : déconnecte l'appareil après 1 h sans toucher, cliquer ni
 * taper, même si la page reste ouverte. La dernière activité est partagée entre
 * les onglets ; le proxy fait le même contrôle quand l'appli était fermée.
 */
export function IdleSignOut() {
  const [, startTransition] = useTransition();

  useEffect(() => {
    let memory = Date.now();
    let lastSaved = 0;
    let signingOut = false;

    // Page relue hors ligne (copie de l'appareil, sans passer par le proxy) après
    // plus d'une heure sans activité : on efface les copies comme le ferait la déconnexion.
    const previous = readLast();
    if (!navigator.onLine && previous !== null && isInactive(previous, memory, INACTIVITY_LIMIT_MS)) {
      void clearOfflineData().then(() => window.location.replace(OFFLINE_PATH));
      return;
    }

    // Une activité plus ancienne dans un autre onglet ne doit pas déconnecter tout de suite à l'ouverture.
    saveLast(memory);

    const onActivity = () => {
      const now = Date.now();
      memory = now;
      if (now - lastSaved > SAVE_EVERY_MS) {
        lastSaved = now;
        saveLast(now);
      }
    };

    const check = () => {
      if (signingOut) return;
      const shared = readLast();
      const last = Math.max(memory, shared ?? 0);
      if (isInactive(last, Date.now(), INACTIVITY_LIMIT_MS)) {
        signingOut = true;
        void clearOfflineData();
        startTransition(() => inactiveSignOutAction());
      }
    };
    const onVisible = () => document.visibilityState === "visible" && check();

    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
