import { describe, expect, it } from "vitest";

import { parseAge } from "@/config/countries";
import { cleanPlayerName } from "@/lib/challenge";
import { parseEvent, parseSlot } from "@/server/agenda/schemas";
import { parseSignIn, parseSignUp } from "@/server/auth/schemas";
import { parseChapterTitle, parseImport, parseModuleName } from "@/server/courses/schemas";
import {
  contestReasonSchema,
  helpMessageSchema,
  helpQuestionSchema,
  paymentRequestSchema,
  referenceLookupSchema,
  researchQuestionSchema,
  safeText,
  sharedTextSchema,
  stripControlChars,
  tutorInputSchema,
} from "@/server/validation";

/**
 * Test de « validation » des formulaires : on envoie au serveur ce qu'un
 * attaquant enverrait sans passer par le navigateur (champ vide, trop long,
 * mauvais type, caractères invisibles, chemin d'un autre utilisateur…) et on
 * vérifie que chaque règle refuse ou nettoie.
 */

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const UUID = "33333333-3333-4333-8333-333333333333";

/** Valeurs d'un mauvais type, envoyées à la place d'un texte. */
const WRONG_TYPES: unknown[] = [undefined, null, 42, true, ["a"], { a: 1 }];

/** Textes hostiles, à garder tels quels comme simple texte (jamais exécutés). */
const HOSTILE = ["<script>alert(1)</script>", "'; DROP TABLE profiles; --", "{{constructor.constructor('x')()}}"];

describe("caractères invisibles", () => {
  it("retire l'octet nul, les caractères de contrôle et les marques de direction", () => {
    expect(stripControlChars("a\u0000b\u0007c\u001Bd\u007Fe")).toBe("abcde");
    expect(stripControlChars("abc\u202Egpj.exe")).toBe("abcgpj.exe");
    expect(stripControlChars("\uFEFFmot\u200Bcaché\u2066")).toBe("motcaché");
  });

  it("garde retours à la ligne, tabulations et accents", () => {
    expect(stripControlChars("Ligne 1\nLigne 2\tà côté : éèçàù ñ")).toBe("Ligne 1\nLigne 2\tà côté : éèçàù ñ");
  });

  it("un texte fait seulement de caractères invisibles compte comme vide", () => {
    expect(safeText(1, 10).safeParse("\u0000\u200B  \u202E").success).toBe(false);
  });
});

describe("texte saisi (safeText)", () => {
  const schema = safeText(1, 20);

  it("refuse les mauvais types", () => {
    for (const value of WRONG_TYPES) expect(schema.safeParse(value).success).toBe(false);
  });

  it("refuse le vide et le trop long, après nettoyage des espaces", () => {
    expect(schema.safeParse("   ").success).toBe(false);
    expect(schema.safeParse("a".repeat(21)).success).toBe(false);
    expect(schema.safeParse(`  ${"a".repeat(20)}  `).data).toBe("a".repeat(20));
  });

  it("garde le code hostile comme simple texte", () => {
    const big = safeText(1, 200);
    for (const value of HOSTILE) expect(big.safeParse(value).data).toBe(value);
  });
});

describe("inscription et connexion", () => {
  const base = {
    fullName: "Awa Diop",
    identifier: "awa@exemple.sn",
    password: "motdepasse",
    passwordConfirm: "motdepasse",
    cycle: "universite",
    age: "20",
    acceptCgu: "on",
  };

  it("refuse un prénom et nom avec du code ou des caractères invisibles", () => {
    for (const fullName of ["<script>", "Awa <b>Diop</b>", "Awa\u0000 Diop", "Awa\u202E Diop", "Awa Diop'--", "ab", "Awa Diop;", "a".repeat(61)]) {
      const result = parseSignUp({ ...base, fullName }, "SN");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.fullName).toBe("fullNameInvalid");
    }
  });

  it("refuse des champs d'un mauvais type sans planter", () => {
    for (const value of WRONG_TYPES) {
      const result = parseSignUp(
        { fullName: value, identifier: value, password: value, cycle: value, age: value, acceptCgu: value },
        "SN",
      );
      expect(result.ok).toBe(false);
    }
  });

  it("refuse un mot de passe trop court ou trop long", () => {
    expect(parseSignUp({ ...base, password: "court" }, "SN").ok).toBe(false);
    expect(parseSignUp({ ...base, password: "x".repeat(73) }, "SN").ok).toBe(false);
  });

  it("refuse un niveau inventé", () => {
    const result = parseSignUp({ ...base, cycle: "'; DROP TABLE x; --" }, "SN");
    expect(result.ok).toBe(false);
  });

  it("refuse une connexion avec un identifiant d'un mauvais type", () => {
    expect(parseSignIn({ identifier: ["awa@exemple.sn"], password: "motdepasse" }, "SN").ok).toBe(false);
  });

  it("âge : seulement un nombre entier raisonnable", () => {
    for (const value of ["-1", "0", "4", "121", "17.5", "1e2", "18 ans", "0x12", " ", "", null, ["18"], {}]) {
      expect(parseAge(value)).toBeNull();
    }
    expect(parseAge(" 18 ")).toBe(18);
  });
});

describe("import d'un cours", () => {
  const ok = {
    moduleId: UUID,
    newModuleName: "",
    chapterId: "",
    newChapterTitle: "",
    kind: "cours",
    fileName: "Cours.pdf",
    storagePath: `${USER}/${UUID}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: "1000",
  };

  it("accepte un import normal", () => {
    expect(parseImport(ok, USER).ok).toBe(true);
  });

  it("refuse le fichier d'un autre utilisateur ou un chemin détourné", () => {
    for (const storagePath of [
      `${OTHER}/${UUID}.pdf`,
      `${USER}/../${OTHER}/${UUID}.pdf`,
      `${USER}/${UUID}.pdf/../x.pdf`,
      `/${USER}/${UUID}.pdf`,
      `${USER}/${UUID}.exe`,
      `${USER}/${UUID}.pdf\u0000.exe`,
    ]) {
      expect(parseImport({ ...ok, storagePath }, USER).ok).toBe(false);
    }
  });

  it("refuse un type qui ne correspond pas à l'extension", () => {
    expect(parseImport({ ...ok, mimeType: "image/png" }, USER)).toEqual({ ok: false, error: "fileType" });
    expect(parseImport({ ...ok, mimeType: "text/html" }, USER).ok).toBe(false);
  });

  it("refuse une taille nulle, négative, décimale ou trop grande", () => {
    for (const sizeBytes of ["0", "-5", "1.5", "abc", String(21 * 1024 * 1024)]) {
      expect(parseImport({ ...ok, sizeBytes }, USER).ok).toBe(false);
    }
    const photo = { ...ok, storagePath: `${USER}/${UUID}.jpg`, mimeType: "image/jpeg", sizeBytes: String(6 * 1024 * 1024) };
    expect(parseImport(photo, USER)).toEqual({ ok: false, error: "imageTooLarge" });
  });

  it("refuse un module ou un chapitre qui n'est pas un identifiant", () => {
    expect(parseImport({ ...ok, moduleId: "1 OR 1=1" }, USER).ok).toBe(false);
    expect(parseImport({ ...ok, chapterId: "../x" }, USER).ok).toBe(false);
  });

  it("nouveau module ou chapitre : texte nettoyé et borné", () => {
    expect(parseImport({ ...ok, moduleId: "nouveau", newModuleName: "\u200B " }, USER).ok).toBe(false);
    const result = parseImport({ ...ok, moduleId: "nouveau", newModuleName: "Maths\u0000\u202E" }, USER);
    expect(result.ok && result.data.module).toEqual({ name: "Maths" });
    expect(parseModuleName("a".repeat(121)).ok).toBe(false);
    expect(parseChapterTitle(["Chapitre"]).ok).toBe(false);
  });

  it("refuse une nature de document inventée", () => {
    expect(parseImport({ ...ok, kind: "exercice" }, USER).ok).toBe(false);
    expect(parseImport({ ...ok, kind: "admin" }, USER).ok).toBe(false);
  });
});

describe("agenda et emploi du temps", () => {
  const event = { kind: "devoir", title: "Devoir de maths", dueOn: "2026-12-01", dueTime: "", note: "" };
  const slot = { weekday: "1", startsAt: "08:00", endsAt: "10:00", label: "Maths", place: "" };

  it("refuse des dates et heures impossibles", () => {
    for (const dueOn of ["2026-02-30", "2026-13-01", "01/12/2026", "demain", ""]) {
      expect(parseEvent({ ...event, dueOn }).ok).toBe(false);
    }
    for (const dueTime of ["24:00", "8h", "08:60", "08:00:00"]) expect(parseEvent({ ...event, dueTime }).ok).toBe(false);
  });

  it("refuse un créneau qui finit avant de commencer ou un jour inventé", () => {
    expect(parseSlot({ ...slot, endsAt: "07:00" })).toEqual({ ok: false, error: "timeOrder" });
    for (const weekday of ["0", "8", "1.5", "lundi"]) expect(parseSlot({ ...slot, weekday }).ok).toBe(false);
  });

  it("nettoie les caractères invisibles et borne la longueur", () => {
    const parsed = parseEvent({ ...event, title: "Devoir\u0000\u202E", note: "\u200B" });
    expect(parsed.ok && parsed.value.title).toBe("Devoir");
    expect(parsed.ok && parsed.value.note).toBeNull();
    expect(parseEvent({ ...event, title: "a".repeat(201) }).ok).toBe(false);
    expect(parseSlot({ ...slot, place: "a".repeat(81) }).ok).toBe(false);
  });
});

describe("Prof NEO, recherche et centre d'aide", () => {
  const tutor = { conversationId: "", mode: "expliquer", moduleId: "", chapterId: "", text: "Explique-moi les dérivées" };

  it("question au Prof : mode connu, identifiants valides, texte borné", () => {
    expect(tutorInputSchema.safeParse(tutor).success).toBe(true);
    expect(tutorInputSchema.safeParse({ ...tutor, mode: "solution" }).success).toBe(false);
    expect(tutorInputSchema.safeParse({ ...tutor, moduleId: "' OR 1=1 --" }).success).toBe(false);
    expect(tutorInputSchema.safeParse({ ...tutor, conversationId: ["x"] }).success).toBe(false);
    expect(tutorInputSchema.safeParse({ ...tutor, text: "a".repeat(4001) }).success).toBe(false);
    expect(tutorInputSchema.safeParse({ ...tutor, text: "\u0000\u200B" }).success).toBe(false);
  });

  it("recherche web : entre 3 et 500 caractères", () => {
    expect(researchQuestionSchema.safeParse("ab").success).toBe(false);
    expect(researchQuestionSchema.safeParse("a".repeat(501)).success).toBe(false);
    expect(researchQuestionSchema.safeParse({ q: "photosynthèse" }).success).toBe(false);
    expect(researchQuestionSchema.safeParse(" photosynthèse ").data).toBe("photosynthèse");
  });

  it("centre d'aide : question et message bornés", () => {
    expect(helpQuestionSchema.safeParse("a".repeat(1001)).success).toBe(false);
    expect(helpMessageSchema.safeParse("a".repeat(2001)).success).toBe(false);
    expect(helpMessageSchema.safeParse(" ").success).toBe(false);
    expect(helpMessageSchema.safeParse(HOSTILE[0]).data).toBe(HOSTILE[0]);
  });

  it("contestation : raison facultative, bornée et nettoyée", () => {
    expect(contestReasonSchema.safeParse("").data).toBe("");
    expect(contestReasonSchema.safeParse("Faux\u0000").data).toBe("Faux");
    expect(contestReasonSchema.safeParse("a".repeat(1001)).success).toBe(false);
  });
});

describe("paiement, partage et outils", () => {
  it("paiement : code de forfait, moyen et référence au bon format", () => {
    const ok = { planCode: "sn-premium-3m", provider: "wave", reference: "TX12345" };
    expect(paymentRequestSchema.safeParse(ok).success).toBe(true);
    for (const planCode of ["SN-premium", "sn-'; drop", "premium", "sn-../../x"]) {
      expect(paymentRequestSchema.safeParse({ ...ok, planCode }).success).toBe(false);
    }
    expect(paymentRequestSchema.safeParse({ ...ok, provider: "wave<script>" }).success).toBe(false);
    expect(paymentRequestSchema.safeParse({ ...ok, reference: "ab" }).success).toBe(false);
    expect(paymentRequestSchema.safeParse({ ...ok, reference: "x".repeat(81) }).success).toBe(false);
  });

  it("texte partagé : titre et contenu bornés, du bon type", () => {
    expect(sharedTextSchema.safeParse({ title: "Synthèse", content: "Texte" }).success).toBe(true);
    expect(sharedTextSchema.safeParse({ title: "Synthèse", content: "x".repeat(60_001) }).success).toBe(false);
    expect(sharedTextSchema.safeParse({ title: { a: 1 }, content: "Texte" }).success).toBe(false);
    expect(sharedTextSchema.safeParse({ title: "Synthèse", content: ["Texte"] }).success).toBe(false);
  });

  it("dictionnaire et encyclopédie : outil connu, mot borné", () => {
    expect(referenceLookupSchema.safeParse({ kind: "dictionary", term: "onde" }).success).toBe(true);
    expect(referenceLookupSchema.safeParse({ kind: "admin", term: "onde" }).success).toBe(false);
    expect(referenceLookupSchema.safeParse({ kind: "dictionary", term: "a".repeat(101) }).success).toBe(false);
    expect(referenceLookupSchema.safeParse({ kind: "encyclopedia", term: 42 }).success).toBe(false);
  });

  it("prénom de l'ami au défi : nettoyé et limité à 20 caractères", () => {
    expect(cleanPlayerName("Awa\u0000\u202E Diop")).toBe("Awa Diop");
    expect(cleanPlayerName("\u200B \u2066")).toBeNull();
    expect(cleanPlayerName("x".repeat(50))).toHaveLength(20);
    expect(cleanPlayerName(HOSTILE[0])).toBe("<script>alert(1)</sc");
  });
});
