/**
 * Réduit une photo dans le navigateur avant l'envoi : moins de données
 * mobiles pour l'élève, et une image que le modèle accepte (5 Mo au plus).
 * Le texte reste lisible à 2000 pixels sur le grand côté.
 */
import { JPEG_MIME } from "@/config/documents";

const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

export async function preparePhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    // Fond blanc : une image PNG transparente reste lisible en JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, JPEG_MIME, JPEG_QUALITY));
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: JPEG_MIME });
  } catch {
    // Navigateur trop ancien ou image illisible : on envoie l'original, le serveur vérifiera.
    return file;
  }
}
