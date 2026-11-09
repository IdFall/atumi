import { describe, expect, it } from "vitest";

import { activityCookieValue, INACTIVITY_LIMIT_MS, isInactive, isSessionInactive } from "@/config/session";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

describe("déconnexion après 1 h sans activité", () => {
  it("la limite est d'une heure", () => {
    expect(INACTIVITY_LIMIT_MS).toBe(HOUR);
  });

  it("expire seulement au-delà d'une heure", () => {
    expect(isInactive(NOW - 59 * 60 * 1000, NOW)).toBe(false);
    expect(isInactive(NOW - HOUR - 1000, NOW)).toBe(true);
    expect(isInactive(null, NOW)).toBe(false);
    expect(isInactive(Number.NaN, NOW)).toBe(false);
  });

  it("ne confond pas avec une session précédente", () => {
    const old = activityCookieValue("session-a", NOW - 5 * HOUR);
    expect(isSessionInactive(old, "session-a", NOW)).toBe(true);
    // Nouvelle connexion : autre session, le vieux cookie ne compte pas.
    expect(isSessionInactive(old, "session-b", NOW)).toBe(false);
    expect(isSessionInactive(activityCookieValue("session-a", NOW - 10 * 60 * 1000), "session-a", NOW)).toBe(false);
    expect(isSessionInactive(undefined, "session-a", NOW)).toBe(false);
    expect(isSessionInactive("n'importe quoi", "session-a", NOW)).toBe(false);
  });
});
