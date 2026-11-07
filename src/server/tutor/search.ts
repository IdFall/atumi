/**
 * Recherche plein texte dans les passages du cours, en attendant les embeddings.
 * Une question en langage naturel devient une recherche « mot1 or mot2 … » : un
 * passage qui contient une partie des mots importants remonte quand même.
 */
const STOP_WORDS = new Set(
  "les des par que pas aux ces son ses mes tes nos vos car ont été cet alors aussi avec avoir bien cela cette comment dans donc elle elles est être fait faire leur leurs mais même mon moi nous pour pourquoi quand quel quelle quelles quels qui quoi sans sont sur tout tous très une votre vous explique expliquer peux peut veux svp merci".split(
    " ",
  ),
);

export function buildSearchQuery(question: string, maxTerms = 8): string | null {
  const words = question
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const unique = [...new Set(words)].slice(0, maxTerms);
  return unique.length === 0 ? null : unique.join(" or ");
}
