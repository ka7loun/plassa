import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plassa",
    short_name: "Plassa",
    description: "Book a private parking spot by the hour in Sousse.",
    start_url: "/find",
    display: "standalone",
    background_color: "#F5F0E8",
    theme_color: "#1E4BFF",
    lang: "fr",
    icons: [
      { src: "/brand/plassa-icon-primary.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/plassa-icon-primary.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
