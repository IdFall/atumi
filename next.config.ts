import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Livres offerts de « Ma bibliothèque », lus par la route qui les sert et
  // par l'import dans « Mes cours » (action de la page du livre).
  outputFileTracingIncludes: {
    "/api/bibliotheque/*": ["./content/bibliotheque/**/*"],
    "/bibliotheque/*": ["./content/bibliotheque/**/*"],
    "/bibliotheque/*/importer": ["./content/bibliotheque/**/*"],
  },
  partialPrefetching: true,
  // Service worker du mode hors ligne : toujours relu, pour que les mises à jour arrivent vite.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
