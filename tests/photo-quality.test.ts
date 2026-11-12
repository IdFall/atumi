import { describe, expect, it } from "vitest";

import { judgePhoto, MAX_BLUR, measurePhoto, MIN_BRIGHTNESS } from "@/lib/photo-quality";

const W = 400;
const H = 300;

/** « Page » synthétique : traits noirs nets sur fond clair, avec un peu de grain. */
function page(background = 230, ink = 30): Float32Array {
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const img = new Float32Array(W * H).fill(background);
  for (let line = 20; line < H - 20; line += 18) {
    for (let x = 20; x < W - 20; x += 7) {
      if (random() < 0.3) continue;
      for (let y = line; y < line + 9; y++) for (let dx = 0; dx < 3; dx++) img[y * W + x + dx] = ink;
    }
  }
  return img.map((v) => Math.min(255, Math.max(0, v + (random() - 0.5) * 6)));
}

/** Flou de mise au point simulé : moyenne sur un carré de côté 2r+1. */
function blur(img: Float32Array, r: number): Float32Array {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const yy = Math.min(H - 1, Math.max(0, y + dy));
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          acc += img[yy * W + xx];
          n++;
        }
      }
      out[y * W + x] = acc / n;
    }
  }
  return out;
}

describe("contrôle de netteté d'une photo dans le navigateur", () => {
  it("une page nette passe, une page floue est à reprendre", () => {
    const sharp = measurePhoto(page(), W, H);
    const blurry = measurePhoto(blur(page(), 3), W, H);
    expect(sharp.blur).toBeLessThan(MAX_BLUR);
    expect(blurry.blur).toBeGreaterThan(MAX_BLUR);
    expect(judgePhoto(sharp)).toBe("ok");
    expect(judgePhoto(blurry)).toBe("blurry");
  });

  it("le flou grandit avec le flou de la photo, et tout flou marqué est à reprendre", () => {
    const [r0, r1, r2] = [0, 1, 2].map((r) => measurePhoto(r ? blur(page(), r) : page(), W, H).blur);
    expect(r1).toBeGreaterThan(r0);
    expect(r2).toBeGreaterThan(r1);
    for (const r of [2, 3, 4, 6]) expect(judgePhoto(measurePhoto(blur(page(), r), W, H))).toBe("blurry");
  });

  it("une page nette mais peu éclairée reste nette ; trop sombre, elle est à reprendre", () => {
    const dim = measurePhoto(page(110, 15), W, H);
    expect(dim.blur).toBeLessThan(MAX_BLUR);
    expect(judgePhoto(dim)).toBe("ok");
    const dark = measurePhoto(page(50, 5), W, H);
    expect(dark.brightness).toBeLessThan(MIN_BRIGHTNESS);
    expect(judgePhoto(dark)).toBe("dark");
  });

  it("une photo sans aucun texte est à reprendre", () => {
    const blank = new Float32Array(W * H).fill(220);
    expect(judgePhoto(measurePhoto(blank, W, H))).toBe("blurry");
  });
});
