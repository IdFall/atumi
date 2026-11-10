import { describe, expect, it } from "vitest";

import { nextMission } from "@/lib/mission";

const study = { id: "m1", name: "Maths", next: { kind: "study", chapterId: null } } as const;
const reading = { id: "m2", name: "Physique", next: { kind: "reading" } } as const;
const empty = { id: "m3", name: "SVT", next: { kind: "import" } } as const;

describe("prochaine mission de l'accueil", () => {
  it("met d'abord une échéance en retard, puis une échéance proche", () => {
    expect(nextMission([study], [{ title: "Devoir", reminder: "soon" }, { title: "Exposé", reminder: "overdue" }])).toEqual({
      kind: "overdue",
      title: "Exposé",
      href: "/agenda",
    });
    expect(nextMission([study], [{ title: "Examen", reminder: "tomorrow" }]).kind).toBe("dueSoon");
  });

  it("propose ensuite de réviser un cours prêt, puis signale un cours en lecture", () => {
    expect(nextMission([reading, study], [{ title: "Plus tard", reminder: "later" }])).toEqual({ kind: "study", title: "Maths", href: "/cours/m1" });
    expect(nextMission([empty, reading], [])).toEqual({ kind: "reading", title: "Physique", href: "/cours/m2" });
  });

  it("invite à importer un premier cours sinon", () => {
    expect(nextMission([empty], [])).toEqual({ kind: "import", title: null, href: "/importer" });
    expect(nextMission([], []).href).toBe("/importer");
  });
});
