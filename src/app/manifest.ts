import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ATUMI",
    short_name: "ATUMI",
    description: "Ton compagnon d'apprentissage, de l'école à l'université.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f7fc",
    theme_color: "#7557d9",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
