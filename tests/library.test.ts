import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_BYTES } from "@/config/documents";
import { bookImportError, DEFAULT_BOOKS, LIBRARY_IMPORT_MAX_PAGES } from "@/config/library";

describe("import d'un livre de la bibliothèque dans Mes cours", () => {
  it("refuse les livres trop longs ou trop lourds", () => {
    expect(bookImportError(1_000_000, LIBRARY_IMPORT_MAX_PAGES, MAX_DOCUMENT_BYTES)).toBeNull();
    expect(bookImportError(1_000_000, LIBRARY_IMPORT_MAX_PAGES + 1, MAX_DOCUMENT_BYTES)).toBe("tooManyPages");
    expect(bookImportError(MAX_DOCUMENT_BYTES + 1, 10, MAX_DOCUMENT_BYTES)).toBe("fileTooLarge");
  });

  it("les livres offerts peuvent être importés", async () => {
    const { getDocumentProxy } = await import("unpdf");
    for (const book of DEFAULT_BOOKS) {
      const bytes = await readFile(join(process.cwd(), "content", "bibliotheque", book.file));
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      expect(pdf.numPages).toBe(book.pages);
      expect(bookImportError(bytes.byteLength, pdf.numPages, MAX_DOCUMENT_BYTES)).toBeNull();
    }
  });
});
