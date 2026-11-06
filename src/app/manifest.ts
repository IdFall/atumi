import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LULU",
    short_name: "LULU",
    description: "Ton compagnon d'apprentissage, de l'école à l'université.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#fffcf5",
    theme_color: "#b45309",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
