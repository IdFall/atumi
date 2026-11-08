import type { PageText } from "./chunk";

import { DOCX_MIME, PDF_MIME } from "../../config/documents";

export { ACCEPTED_MIME_TYPES, DOCX_MIME, MAX_DOCUMENT_BYTES, PDF_MIME, type AcceptedMimeType } from "../../config/documents";

export class UnreadableDocumentError extends Error {
  constructor(public readonly reason: "empty" | "corrupted" | "unsupported") {
    super(`Document illisible : ${reason}`);
  }
}

/** Texte minimal par page en dessous duquel on considère un PDF comme scanné (image). */
const MIN_CHARS_PER_PAGE = 40;

export async function extractPages(bytes: Uint8Array, mimeType: string): Promise<{ pages: PageText[]; pageCount: number | null }> {
  if (mimeType === PDF_MIME) return extractPdf(bytes);
  if (mimeType === DOCX_MIME) return extractDocx(bytes);
  throw new UnreadableDocumentError("unsupported");
}

async function extractPdf(bytes: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let text: string[];
  let totalPages: number;
  try {
    const pdf = await getDocumentProxy(bytes);
    ({ text, totalPages } = await extractText(pdf, { mergePages: false }));
  } catch {
    throw new UnreadableDocumentError("corrupted");
  }
  const pages = text.map((t, i) => ({ page: i + 1, text: t }));
  const chars = pages.reduce((sum, p) => sum + p.text.trim().length, 0);
  // PDF scanné : pas de texte à lire. L'élève peut prendre les pages en photo (lues par le modèle).
  if (chars < MIN_CHARS_PER_PAGE * Math.max(1, Math.min(totalPages, 3))) {
    throw new UnreadableDocumentError("empty");
  }
  return { pages, pageCount: totalPages };
}

async function extractDocx(bytes: Uint8Array) {
  const mammoth = await import("mammoth");
  let value: string;
  try {
    ({ value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) }));
  } catch {
    throw new UnreadableDocumentError("corrupted");
  }
  if (value.trim().length < MIN_CHARS_PER_PAGE) throw new UnreadableDocumentError("empty");
  // Word n'a pas de pages fixes : un seul bloc, citations « [doc] ».
  return { pages: [{ page: null, text: value }], pageCount: null };
}
