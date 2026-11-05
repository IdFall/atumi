import { describe, expect, it } from "vitest";

import {
  canRevealSolution,
  chapterMastery,
  isGenuineAttempt,
  startTrial,
  trialState,
} from "@/server/learning/policies";

describe("tentative avant solution", () => {
  it("refuse les non-tentatives", () => {
    for (const text of ["", "?", "je sais pas", "Je ne sais pas", "donne-moi la réponse", "aucune idée"]) {
      expect(isGenuineAttempt(text)).toBe(false);
    }
  });

  it("accepte une démarche, même fausse", () => {
    expect(isGenuineAttempt("J'ai développé (x+2)^2 = x^2 + 4 donc x = 2")).toBe(true);
  });

  it("ne révèle la solution qu'après une tentative réelle", () => {
    expect(canRevealSolution([])).toBe(false);
    expect(canRevealSolution(["je sais pas", "?"])).toBe(false);
    expect(canRevealSolution(["je sais pas", "Je pense qu'il faut factoriser par x"])).toBe(true);
  });
});

describe("essai gratuit d'une journée", () => {
  const now = new Date("2026-11-05T10:00:00Z");

  it("ne démarre pas avant le premier import", () => {
    expect(trialState(null, now)).toEqual({ status: "not_started" });
    expect(trialState({ started_at: null, ends_at: null }, now)).toEqual({ status: "not_started" });
  });

  it("dure exactement 24 heures", () => {
    const trial = startTrial(now);
    expect(trial.ends_at).toBe("2026-11-06T10:00:00.000Z");
    expect(trialState(trial, new Date("2026-11-06T09:59:59Z")).status).toBe("active");
    expect(trialState(trial, new Date("2026-11-06T10:00:00Z")).status).toBe("expired");
  });
});

describe("maîtrise d'un chapitre", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 10, 5, 0, minutes));

  it("vaut 0 sans réponse, avec une fiabilité faible", () => {
    expect(chapterMastery([])).toEqual({ score: 0, answeredCount: 0, reliability: "faible" });
  });

  it("ne garde que les 20 réponses les plus récentes", () => {
    const old = Array.from({ length: 10 }, (_, i) => ({ isCorrect: false, answeredAt: at(i) }));
    const recent = Array.from({ length: 20 }, (_, i) => ({ isCorrect: true, answeredAt: at(100 + i) }));
    const mastery = chapterMastery([...old, ...recent]);
    expect(mastery.score).toBe(1);
    expect(mastery.answeredCount).toBe(20);
    expect(mastery.reliability).toBe("bonne");
  });
});
