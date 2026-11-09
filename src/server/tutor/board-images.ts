import { IMAGE_LINE, isAllowedImage } from "@/lib/board";

/**
 * Images du tableau du Prof ATUM. Le modèle n'écrit jamais d'adresse d'image :
 * il écrit « [image: mots-clés | légende] », et le serveur cherche une image
 * libre sur Wikimedia Commons. La ligne est remplacée par l'adresse trouvée
 * (et la page de l'image, pour l'auteur et la licence) ou supprimée.
 */

const MAX_IMAGES = 2;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "ATUMI/1.0 (https://atumi.vercel.app)";

export interface FoundImage {
  src: string;
  page: string;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function findCommonsImage(keywords: string, fetcher: Fetcher = fetch): Promise<FoundImage | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${keywords.slice(0, 120)} filetype:bitmap|drawing`,
    gsrnamespace: "6",
    gsrlimit: "5",
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "800",
  });
  try {
    const res = await fetcher(`${COMMONS_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: { index?: number; imageinfo?: { thumburl?: string; descriptionurl?: string; mime?: string }[] }[] };
    };
    const pages = [...(data.query?.pages ?? [])].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl || !info.descriptionurl) continue;
      if (!/^image\/(jpeg|png|svg\+xml|webp|gif)$/.test(info.mime ?? "")) continue;
      if (!isAllowedImage(info.thumburl)) continue;
      return { src: info.thumburl, page: info.descriptionurl };
    }
    return null;
  } catch {
    return null;
  }
}

/** Remplace les demandes d'image du modèle par des images trouvées, ou les retire. */
export async function resolveBoardImages(text: string, find: (keywords: string) => Promise<FoundImage | null> = findCommonsImage): Promise<string> {
  const lines = text.split("\n");
  const requests = lines
    .map((line, index) => ({ index, match: IMAGE_LINE.exec(line.trim()) }))
    .filter((r) => r.match !== null);
  if (requests.length === 0) return text;

  // Une adresse écrite par le modèle n'est jamais reprise : seuls les mots-clés comptent.
  const wanted = requests.filter((r) => !/^https?:/i.test(r.match![1])).slice(0, MAX_IMAGES);
  const found = await Promise.all(wanted.map((r) => find(r.match![1])));
  const replacement = new Map<number, string | null>();
  for (const r of requests) replacement.set(r.index, null);
  wanted.forEach((r, k) => {
    const image = found[k];
    const caption = (r.match![2] ?? "").replace(/[|\]]/g, " ").trim();
    replacement.set(r.index, image ? `[image: ${image.src} | ${caption} | ${image.page}]` : null);
  });

  return lines
    .flatMap((line, index) => {
      if (!replacement.has(index)) return [line];
      const value = replacement.get(index);
      return value ? [value] : [];
    })
    .join("\n");
}
