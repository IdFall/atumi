import { describe, expect, it } from "vitest";

import { createAiProvider } from "@/server/ai/anthropic";
import type { AiProvider, AiRequest, AiResult } from "@/server/ai/types";
import { chunkPages } from "@/server/documents/chunk";
import { DOCX_MIME, PDF_MIME } from "@/server/documents/extract";
import { sniffImageType } from "@/server/documents/photo";
import {
  FAILURE_REASONS,
  ingestDocument,
  PHOTO_FAILURE_REASONS,
  TemporaryIngestError,
  type IngestDocument,
  type IngestStore,
} from "@/worker/ingest";

/** Construit un PDF texte minimal, une ligne par page. */
function makePdf(pages: string[]): Uint8Array {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((text, i) => {
    const pageId = pageIds[i];
    const stream = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

class FakeStore implements IngestStore {
  chunks: { page: number | null; content: string }[] = [];
  status = "uploaded";
  pageCount: number | null = null;
  error: string | null = null;
  constructor(
    private readonly doc: IngestDocument,
    private readonly bytes: Uint8Array,
  ) {}
  async getDocument(userId: string, id: string) {
    return userId === this.doc.userId && id === this.doc.id ? { ...this.doc, status: this.status } : null;
  }
  async download() {
    return this.bytes;
  }
  async markProcessing() {
    this.status = "processing";
  }
  async replaceChunks(_doc: IngestDocument, chunks: { page: number | null; content: string }[]) {
    this.chunks = chunks;
  }
  async markReady(_doc: IngestDocument, pageCount: number | null) {
    this.status = "ready";
    this.pageCount = pageCount;
  }
  async markFailed(_doc: IngestDocument, reason: string) {
    this.status = "failed";
    this.error = reason;
  }
  usage: string[] = [];
  async logUsage(_doc: IngestDocument, feature: string) {
    this.usage.push(feature);
  }
}

/** Fournisseur factice : renvoie une réponse fixe et garde la requête reçue. */
class FakeProvider implements AiProvider {
  requests: AiRequest[] = [];
  constructor(private readonly result: AiResult) {}
  async complete(request: AiRequest) {
    this.requests.push(request);
    return this.result;
  }
}

const USAGE = { model: "modele-test", inputTokens: 1500, outputTokens: 200, cacheReadTokens: 0 };
const answer = (text: string): AiResult => ({ status: "ok", text, usage: USAGE });
const noAi = createAiProvider(undefined, { standard: "m", light: "m" });

/** Début d'un vrai fichier JPEG (les octets suffisent à reconnaître le type). */
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const doc = (mimeType: string): IngestDocument => ({
  id: "d1",
  userId: "u1",
  chapterId: null,
  storagePath: mimeType.startsWith("image/") ? "u1/d1.jpg" : "u1/d1.pdf",
  mimeType,
  status: "uploaded",
});

const LINE = "Une primitive de f est une fonction F dont la derivee est f sur un intervalle donne.";

describe("lecture des documents", () => {
  it("lit un PDF texte page par page et garde le numéro de page", async () => {
    const store = new FakeStore(doc(PDF_MIME), makePdf([LINE, `Integration par parties. ${LINE}`]));
    expect(await ingestDocument(store, noAi, "u1", "d1")).toBe("ready");
    expect(store.pageCount).toBe(2);
    expect(store.chunks.map((c) => c.page)).toEqual([1, 2]);
    expect(store.chunks[1].content).toContain("Integration par parties");
  });

  it("refuse un PDF sans texte (scanné) avec un message clair", async () => {
    const store = new FakeStore(doc(PDF_MIME), makePdf([""]));
    expect(await ingestDocument(store, noAi, "u1", "d1")).toBe("failed");
    expect(store.error).toBe(FAILURE_REASONS.empty);
  });

  it("signale un fichier endommagé", async () => {
    const store = new FakeStore(doc(DOCX_MIME), new TextEncoder().encode("pas un docx"));
    expect(await ingestDocument(store, noAi, "u1", "d1")).toBe("failed");
    expect(store.error).toBe(FAILURE_REASONS.corrupted);
  });

  it("ignore le document d'un autre utilisateur ou déjà lu", async () => {
    const store = new FakeStore(doc(PDF_MIME), makePdf([LINE]));
    expect(await ingestDocument(store, noAi, "u2", "d1")).toBe("skipped");
    store.status = "ready";
    expect(await ingestDocument(store, noAi, "u1", "d1")).toBe("skipped");
  });
});

describe("lecture des photos de cours", () => {
  it("lit une photo nette : texte recopié, une page, consommation journalisée", async () => {
    const provider = new FakeProvider(answer(`<verdict>lisible</verdict>\n<texte>\n${LINE}\n</texte>`));
    const store = new FakeStore(doc("image/jpeg"), JPEG_BYTES);
    expect(await ingestDocument(store, provider, "u1", "d1")).toBe("ready");
    expect(store.chunks.map((c) => c.content).join(" ")).toContain("Une primitive de f");
    expect(store.chunks[0].page).toBeNull();
    expect(store.pageCount).toBe(1);
    expect(store.usage).toEqual(["image_reading"]);
    const content = provider.requests[0].messages[0].content;
    expect(Array.isArray(content) && content[0]).toMatchObject({ type: "image", mediaType: "image/jpeg" });
  });

  it.each([
    ["floue", "blurry"],
    ["coupee", "cropped"],
    ["sombre", "dark"],
    ["hors_sujet", "offTopic"],
  ] as const)("demande de reprendre une photo « %s »", async (verdict, problem) => {
    const store = new FakeStore(doc("image/jpeg"), JPEG_BYTES);
    const provider = new FakeProvider(answer(`<verdict>${verdict}</verdict>\n<texte>\n</texte>`));
    expect(await ingestDocument(store, provider, "u1", "d1")).toBe("failed");
    expect(store.error).toBe(PHOTO_FAILURE_REASONS[problem]);
    expect(store.error).toMatch(/Reprends|Prends en photo/);
    expect(store.chunks).toEqual([]);
    expect(store.usage).toEqual(["image_reading"]);
  });

  it("refuse une photo jugée lisible mais presque sans texte", async () => {
    const store = new FakeStore(doc("image/jpeg"), JPEG_BYTES);
    expect(await ingestDocument(store, new FakeProvider(answer("<verdict>lisible</verdict><texte>Titre</texte>")), "u1", "d1")).toBe(
      "failed",
    );
    expect(store.error).toBe(PHOTO_FAILURE_REASONS.noText);
  });

  it("sans service d'IA, refuse proprement la photo sans relancer", async () => {
    const store = new FakeStore(doc("image/jpeg"), JPEG_BYTES);
    expect(await ingestDocument(store, noAi, "u1", "d1")).toBe("failed");
    expect(store.error).toBe(PHOTO_FAILURE_REASONS.aiDisabled);
  });

  it("relance plus tard si le service est momentanément indisponible", async () => {
    const store = new FakeStore(doc("image/jpeg"), JPEG_BYTES);
    const provider = new FakeProvider({ status: "unavailable", reason: "rate_limited" });
    await expect(ingestDocument(store, provider, "u1", "d1")).rejects.toBeInstanceOf(TemporaryIngestError);
    expect(store.status).toBe("processing");
  });

  it("refuse un fichier qui n'est pas une vraie image, sans appeler le modèle", async () => {
    const store = new FakeStore(doc("image/png"), new TextEncoder().encode("pas une image"));
    const provider = new FakeProvider(answer("<verdict>lisible</verdict>"));
    expect(await ingestDocument(store, provider, "u1", "d1")).toBe("failed");
    expect(store.error).toBe(PHOTO_FAILURE_REASONS.corrupted);
    expect(provider.requests).toEqual([]);
  });

  it("reconnaît le vrai type d'une image à ses premiers octets", () => {
    expect(sniffImageType(JPEG_BYTES)).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.4"))).toBeNull();
  });
});

describe("découpage en passages", () => {
  it("regroupe les petits paragraphes et coupe les longs sans changer de page", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Phrase numéro ${i} du cours.`).join(" ");
    const chunks = chunkPages(
      [
        { page: 1, text: "Titre\n\nCourt paragraphe." },
        { page: 2, text: long },
      ],
      300,
    );
    expect(chunks[0]).toEqual({ page: 1, content: "Titre\n\nCourt paragraphe." });
    const page2 = chunks.filter((c) => c.page === 2);
    expect(page2.length).toBeGreaterThan(1);
    expect(page2.every((c) => c.content.length <= 300 * 1.3)).toBe(true);
    expect(page2.map((c) => c.content).join(" ")).toContain("Phrase numéro 39 du cours.");
  });
});
