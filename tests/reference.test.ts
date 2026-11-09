import { describe, expect, it } from "vitest";

import { htmlToText, lookupDictionary, lookupEncyclopedia, parseEnglishDefinitions, parseFrenchWiktionary, wikitextToText } from "@/server/tools/reference";

const FR_PAGE = `{{voir|Énergie}}
== {{langue|fr}} ==
=== {{S|étymologie}} ===
: Du latin ''energia''.

=== {{S|nom|fr}} ===
'''énergie''' {{pron|e.nɛʁ.ʒi|fr}} {{f}}
# [[force|Force]], [[vigueur]] physique.
#* ''Il travaille avec '''énergie'''.''
# {{physique|fr}} Capacité d'un [[système]] à produire un [[travail]].<ref>Source</ref>
#: exemple
=== {{S|traductions}} ===
* {{T|en}} : energy

== {{langue|en}} ==
=== {{S|nom|en}} ===
# Ne doit pas apparaître.`;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("dictionnaire et encyclopédie dans ATUMI", () => {
  it("lit les définitions françaises du Wiktionnaire", () => {
    expect(parseFrenchWiktionary(FR_PAGE)).toEqual([
      { partOfSpeech: "Nom commun", definitions: ["Force, vigueur physique.", "(Physique) Capacité d'un système à produire un travail."] },
    ]);
  });

  it("réduit le wikitexte et le HTML à du texte brut", () => {
    expect(wikitextToText("[[a|b]] '''gras''' {{lien|mot|fr}} <script>x</script>")).toBe("b gras mot x");
    expect(htmlToText('<b>Energy</b> &amp; <a href="javascript:x">power</a><script>alert(1)</script>')).toBe("Energy & power");
  });

  it("lit les définitions anglaises", () => {
    expect(parseEnglishDefinitions({ en: [{ partOfSpeech: "Noun", definitions: [{ definition: "The <i>capacity</i> to do work." }] }] })).toEqual([
      { partOfSpeech: "Noun", definitions: ["The capacity to do work."] },
    ]);
  });

  it("interroge le Wiktionnaire français et gère l'absence de résultat", async () => {
    const found = await lookupDictionary("Énergie", "fr", async () => json({ parse: { title: "énergie", wikitext: FR_PAGE } }));
    expect(found).toMatchObject({ ok: true, kind: "dictionary", word: "énergie", url: "https://fr.wiktionary.org/wiki/%C3%A9nergie" });
    expect(await lookupDictionary("zzz", "fr", async () => json({ error: { code: "missingtitle" } }))).toEqual({ ok: false, error: "notFound" });
    expect(await lookupDictionary("x", "fr", async () => json({}, 500))).toEqual({ ok: false, error: "unavailable" });
  });

  it("résume l'article Wikipédia et ne garde que les images de Wikimedia", async () => {
    const urls: string[] = [];
    const result = await lookupEncyclopedia("photosynthese", "fr", async (url) => {
      urls.push(url);
      if (url.includes("list=search")) return json({ query: { search: [{ title: "Photosynthèse" }] } });
      return json({
        title: "Photosynthèse",
        extract: "La photosynthèse est le processus…",
        thumbnail: { source: "https://exemple.com/x.png" },
        content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Photosynth%C3%A8se" } },
      });
    });
    expect(urls[0]).toContain("https://fr.wikipedia.org/w/api.php");
    expect(result).toEqual({
      ok: true,
      kind: "encyclopedia",
      title: "Photosynthèse",
      extract: "La photosynthèse est le processus…",
      image: null,
      url: "https://fr.wikipedia.org/wiki/Photosynth%C3%A8se",
    });
  });
});
