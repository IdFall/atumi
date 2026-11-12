import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { OFFLINE_PATH, OFFLINE_SECTION_ORDER, offlineSection, PAGES_CACHE, PRIVATE_CACHES } from "@/lib/offline";

const sw = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");

describe("mode hors ligne partiel", () => {
  it("le service worker utilise les mêmes caches et la même page que l'appli", () => {
    expect(sw).toContain(`const PAGES_CACHE = "${PAGES_CACHE}"`);
    for (const name of PRIVATE_CACHES) expect(sw).toContain(`"${name}"`);
    expect(sw).toContain(`const OFFLINE_URL = "${OFFLINE_PATH}"`);
  });

  it("garde les mêmes parties d'ATUMI des deux côtés", () => {
    const block = sw.match(/const PAGE_PREFIXES = \[([\s\S]*?)\];/)?.[1] ?? "";
    const prefixes = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(prefixes).toHaveLength(OFFLINE_SECTION_ORDER.length);
    for (const prefix of prefixes) expect(offlineSection(prefix)).not.toBeNull();
  });

  it("ne garde ni l'admin, ni le paiement, ni l'import, ni l'appel", () => {
    for (const path of ["/admin", "/abonnement", "/importer", "/appel", "/connexion", "/coursier"]) {
      expect(offlineSection(path)).toBeNull();
    }
    expect(offlineSection("/cours/1/synthese")).toBe("courses");
    expect(offlineSection("/recherche")).toBe("search");
  });

  it("n'envoie rien hors ligne et efface les copies quand la session se ferme", () => {
    expect(sw).toContain('request.method !== "GET"');
    expect(sw).toContain('finalPath === "/connexion"');
    expect(sw).toContain('!url.searchParams.has("telecharger")');
  });
});
