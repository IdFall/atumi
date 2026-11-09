import { describe, expect, it } from "vitest";

import { DOCX_MIME, PDF_MIME } from "@/config/documents";
import { downloadName, isSafeImageSource, isSafeLink, viewerKind } from "@/lib/document-view";

describe("ouverture d'un document importé", () => {
  it("choisit l'affichage selon le type du fichier", () => {
    expect(viewerKind(PDF_MIME)).toBe("pdf");
    expect(viewerKind(DOCX_MIME)).toBe("docx");
    expect(viewerKind("image/jpeg")).toBe("image");
    expect(viewerKind("image/webp")).toBe("image");
    expect(viewerKind("text/html")).toBe("other");
  });

  it("propose le titre du document comme nom de fichier, avec la bonne extension", () => {
    expect(downloadName("Intégrales chapitre 2", "u/abc.pdf")).toBe("Intégrales chapitre 2.pdf");
    expect(downloadName("cours.PDF", "u/abc.pdf")).toBe("cours.PDF");
    expect(downloadName('a/b:c*"d"', "u/abc.docx")).toBe("a b c d.docx");
    expect(downloadName("   ", "u/abc.jpg")).toBe("document.jpg");
  });

  it("ne garde que les liens web et les images intégrées d'un document Word", () => {
    expect(isSafeLink("https://exemple.sn")).toBe(true);
    expect(isSafeLink("javascript:alert(1)")).toBe(false);
    expect(isSafeLink("data:text/html,<script>")).toBe(false);
    expect(isSafeImageSource("data:image/png;base64,AAAA")).toBe(true);
    expect(isSafeImageSource("data:image/svg+xml;base64,AAAA")).toBe(false);
    expect(isSafeImageSource("https://pisteur.example/x.png")).toBe(false);
  });
});
