import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AtumiNeo",
    short_name: "AtumiNeo",
    description: "Ton compagnon d'apprentissage, de l'école à l'université.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7fc",
    theme_color: "#7557d9",
    icons: [
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
