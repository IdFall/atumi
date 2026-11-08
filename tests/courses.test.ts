import { describe, expect, it } from "vitest";

import { checkFile, DOCX_MIME, PDF_MIME, resolveMime } from "@/config/documents";
import { NEW, parseImport } from "@/server/courses/schemas";

const USER = "00000000-0000-0000-0000-00000000000a";
const OTHER = "00000000-0000-0000-0000-00000000000b";
const MODULE = "6f1c2a9e-4b7d-4c3e-9a51-2d8e7f0b1c3a";
const FILE_ID = "30000000-0000-0000-0000-00000000000a";

const base = {
  moduleId: MODULE,
  newModuleName: "",
  chapterId: "",
  newChapterTitle: "",
  kind: "cours",
  fileName: "integrales-cours.pdf",
  storagePath: `${USER}/${FILE_ID}.pdf`,
  mimeType: PDF_MIME,
  sizeBytes: "120000",
};

describe("fichiers acceptés à l'import", () => {
  it("accepte PDF, Word et photos (JPG, PNG, WebP), refuse l'ancien .doc et le HEIC", () => {
    expect(checkFile({ name: "cours.pdf", type: PDF_MIME, size: 10 })).toBeNull();
    expect(checkFile({ name: "cours.docx", type: "", size: 10 })).toBeNull();
    expect(checkFile({ name: "photo.jpg", type: "image/jpeg", size: 10 })).toBeNull();
    expect(checkFile({ name: "IMG_0001.JPEG", type: "", size: 10 })).toBeNull();
    expect(checkFile({ name: "page.webp", type: "image/webp", size: 10 })).toBeNull();
    expect(checkFile({ name: "page.png", type: "image/png", size: 10 })).toBeNull();
    expect(checkFile({ name: "cours.doc", type: "application/msword", size: 10 })).toBe("fileType");
    expect(checkFile({ name: "photo.heic", type: "image/heic", size: 10 })).toBe("fileType");
  });

  it("limite une photo à 5 Mo", () => {
    expect(checkFile({ name: "photo.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 })).toBe("imageTooLarge");
    expect(checkFile({ name: "cours.pdf", type: PDF_MIME, size: 6 * 1024 * 1024 })).toBeNull();
  });

  it("refuse un fichier vide ou de plus de 20 Mo", () => {
    expect(checkFile({ name: "cours.pdf", type: PDF_MIME, size: 0 })).toBe("fileRequired");
    expect(checkFile({ name: "cours.pdf", type: PDF_MIME, size: 21 * 1024 * 1024 })).toBe("fileTooLarge");
  });

  it("déduit le type de l'extension quand le téléphone ne l'indique pas", () => {
    expect(resolveMime({ name: "Cours.DOCX", type: "application/octet-stream" })).toBe(DOCX_MIME);
  });
});

describe("enregistrement d'un document importé", () => {
  it("lit un import dans un module existant, titre tiré du nom du fichier", () => {
    const result = parseImport(base, USER);
    expect(result).toEqual({
      ok: true,
      data: {
        module: { id: MODULE },
        chapter: null,
        kind: "cours",
        title: "integrales-cours",
        storagePath: base.storagePath,
        mimeType: PDF_MIME,
        sizeBytes: 120000,
      },
    });
  });

  it("crée module et chapitre quand l'apprenant choisit « nouveau »", () => {
    const result = parseImport(
      { ...base, moduleId: NEW, newModuleName: " Analyse 2 ", chapterId: NEW, newChapterTitle: "Intégrales" },
      USER,
    );
    expect(result.ok && result.data.module).toEqual({ name: "Analyse 2" });
    expect(result.ok && result.data.chapter).toEqual({ title: "Intégrales" });
  });

  it("exige un nom de module et un titre de chapitre", () => {
    expect(parseImport({ ...base, moduleId: NEW }, USER)).toEqual({ ok: false, error: "moduleRequired" });
    expect(parseImport({ ...base, chapterId: NEW }, USER)).toEqual({ ok: false, error: "chapterTitleRequired" });
  });

  it("refuse un fichier rangé dans le dossier d'un autre ou mal nommé", () => {
    expect(parseImport({ ...base, storagePath: `${OTHER}/${FILE_ID}.pdf` }, USER).ok).toBe(false);
    expect(parseImport({ ...base, storagePath: `${USER}/../${FILE_ID}.pdf` }, USER).ok).toBe(false);
    expect(parseImport({ ...base, storagePath: `${USER}/${FILE_ID}.docx` }, USER)).toEqual({ ok: false, error: "fileType" });
  });

  it("refuse un type de document ou un format inconnu", () => {
    expect(parseImport({ ...base, kind: "annales" }, USER).ok).toBe(false);
    expect(parseImport({ ...base, mimeType: "image/png" }, USER).ok).toBe(false);
    expect(parseImport({ ...base, mimeType: "image/heic", storagePath: `${USER}/${FILE_ID}.heic` }, USER).ok).toBe(false);
  });

  it("accepte une photo rangée sous la bonne extension, 5 Mo au plus", () => {
    const photo = { ...base, fileName: "page-12.jpg", storagePath: `${USER}/${FILE_ID}.jpg`, mimeType: "image/jpeg" };
    const result = parseImport(photo, USER);
    expect(result.ok && result.data.title).toBe("page-12");
    expect(parseImport({ ...photo, storagePath: `${USER}/${FILE_ID}.png` }, USER)).toEqual({ ok: false, error: "fileType" });
    expect(parseImport({ ...photo, sizeBytes: String(6 * 1024 * 1024) }, USER)).toEqual({ ok: false, error: "imageTooLarge" });
  });
});
