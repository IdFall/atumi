/**
 * Premier contrôle d'une photo de cours, tout de suite dans le navigateur,
 * sans modèle ni envoi : flou (méthode de Crété-Roffet) et lumière (moyenne des
 * gris), sur l'image réduite à QUALITY_SIDE pixels de large.
 * C'est un indicatif pour l'élève : la lecture par le modèle dans le worker
 * reste le contrôle qui décide (`src/server/documents/photo.ts`).
 */

export type PhotoQuality = "ok" | "blurry" | "dark";

/** Largeur de l'image analysée : mêmes seuils quelle que soit la taille de la photo. */
export const QUALITY_SIDE = 1000;
/** Au-dessus (de 0 = nette à 1 = très floue), les lettres sont trop floues pour être lues. */
export const MAX_BLUR = 0.58;
/** En dessous (sur 255), la page est trop sombre pour être lue. */
export const MIN_BRIGHTNESS = 70;
/** Taille du flou ajouté pour la mesure (méthode de Crété-Roffet, 2007). */
const BLUR_TAPS = 9;
/** Écart entre deux pixels voisins, en part du contraste de la photo, en dessous duquel on y voit du grain, pas un bord. */
const NOISE_SHARE = 0.02;

/**
 * Flou et lumière d'une image en niveaux de gris (0-255, ligne par ligne).
 * Flou : on floute encore l'image et on regarde ce que perdent les bords. Une
 * photo nette perd beaucoup, une photo déjà floue presque rien. La mesure ne
 * dépend ni du contraste ni de la lumière de la photo.
 */
export function measurePhoto(gray: ArrayLike<number>, width: number, height: number): { blur: number; brightness: number } {
  const total = width * height;
  let sum = 0;
  for (let i = 0; i < total; i++) sum += gray[i];
  const brightness = total > 0 ? sum / total : 0;
  const noise = Math.max(2, NOISE_SHARE * contrast(gray, total));
  // Un léger lissage efface le grain du capteur sans effacer le bord des lettres.
  const smooth = boxSmooth(gray, width, height);
  const blur = Math.max(directionalBlur(smooth, width, height, 1, width, noise), directionalBlur(smooth, width, height, width, 1, noise));
  return { blur, brightness };
}

/** Moyenne de chaque pixel avec ses 8 voisins (bords recopiés). */
function boxSmooth(gray: ArrayLike<number>, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy)) * width;
        for (let dx = -1; dx <= 1; dx++) acc += gray[yy + Math.min(width - 1, Math.max(0, x + dx))];
      }
      out[y * width + x] = acc / 9;
    }
  }
  return out;
}

/** Contraste de la photo : écart entre le 2e et le 98e centile des gris. */
function contrast(gray: ArrayLike<number>, total: number): number {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < total; i++) histogram[Math.min(255, Math.max(0, Math.round(gray[i])))]++;
  let seen = 0;
  let low = -1;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v];
    if (low < 0 && seen >= total * 0.02) low = v;
    if (seen >= total * 0.98) return v - low;
  }
  return 255 - Math.max(low, 0);
}

/** Flou dans une direction : `step` entre deux voisins, `stride` entre deux lignes. */
function directionalBlur(gray: ArrayLike<number>, width: number, height: number, step: number, stride: number, noise: number): number {
  const length = step === 1 ? width : height;
  const lines = step === 1 ? height : width;
  const half = Math.floor(BLUR_TAPS / 2);
  let sharpVariation = 0;
  let lostVariation = 0;
  const blurred = new Float64Array(length);
  for (let line = 0; line < lines; line++) {
    const start = line * stride;
    // Moyenne glissante sur BLUR_TAPS pixels le long de la ligne.
    let acc = 0;
    for (let k = -half; k <= half; k++) acc += gray[start + Math.min(length - 1, Math.max(0, k)) * step];
    for (let j = 0; j < length; j++) {
      blurred[j] = acc / BLUR_TAPS;
      acc += gray[start + Math.min(length - 1, j + half + 1) * step] - gray[start + Math.max(0, j - half) * step];
    }
    for (let j = 1; j < length; j++) {
      const df = Math.abs(gray[start + j * step] - gray[start + (j - 1) * step]);
      // Le grain du capteur n'est pas un bord de lettre.
      if (df < noise) continue;
      const db = Math.abs(blurred[j] - blurred[j - 1]);
      sharpVariation += df;
      lostVariation += Math.max(0, df - db);
    }
  }
  return sharpVariation > 0 ? (sharpVariation - lostVariation) / sharpVariation : 1;
}

export function judgePhoto(measure: { blur: number; brightness: number }): PhotoQuality {
  if (measure.brightness < MIN_BRIGHTNESS) return "dark";
  if (measure.blur > MAX_BLUR) return "blurry";
  return "ok";
}

/** Contrôle d'une photo choisie ou prise ; null si le navigateur ne sait pas la lire (le worker vérifiera). */
export async function checkPhotoQuality(file: Blob): Promise<PhotoQuality | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, QUALITY_SIDE / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    // Réduction lissée : le grain du capteur ne doit pas passer pour du net.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const { data } = context.getImageData(0, 0, width, height);
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    }
    return judgePhoto(measurePhoto(gray, width, height));
  } catch {
    return null;
  }
}
