import { describe, expect, it } from "vitest";

import { chunkPages } from "@/server/documents/chunk";
import { DOCX_MIME, PDF_MIME } from "@/server/documents/extract";
import { FAILURE_REASONS, ingestDocument, type IngestDocument, type IngestStore } from "@/worker/ingest";

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
}

const doc = (mimeType: string): IngestDocument => ({
  id: "d1",
  userId: "u1",
  chapterId: null,
  storagePath: "u1/d1.pdf",
  mimeType,
  status: "uploaded",
});

const LINE = "Une primitive de f est une fonction F dont la derivee est f sur un intervalle donne.";

describe("lecture des documents", () => {
  it("lit un PDF texte page par page et garde le numéro de page", async () => {
    const store = new FakeStore(doc(PDF_MIME), makePdf([LINE, `Integration par parties. ${LINE}`]));
    expect(await ingestDocument(store, "u1", "d1")).toBe("ready");
    expect(store.pageCount).toBe(2);
    expect(store.chunks.map((c) => c.page)).toEqual([1, 2]);
    expect(store.chunks[1].content).toContain("Integration par parties");
  });

  it("refuse un PDF sans texte (scanné) avec un message clair", async () => {
    const store = new FakeStore(doc(PDF_MIME), makePdf([""]));
    expect(await ingestDocument(store, "u1", "d1")).toBe("failed");
    expect(store.error).toBe(FAILURE_REASONS.empty);
  });

  it("signale un fichier endommagé", async () => {
    const store = new FakeStore(doc(DOCX_MIME), new TextEncoder().encode("pas un docx"));
    expect(await ingestDocument(store, "u1", "d1")).toBe("failed");
    expect(store.error).toBe(FAILURE_REASONS.corrupted);
  });

  it("ignore le document d'un autre utilisateur ou déjà lu", async () => {
    const store = new FakeStore(doc(PDF_MIME), makePdf([LINE]));
    expect(await ingestDocument(store, "u2", "d1")).toBe("skipped");
    store.status = "ready";
    expect(await ingestDocument(store, "u1", "d1")).toBe("skipped");
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
