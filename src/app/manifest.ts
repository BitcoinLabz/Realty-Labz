import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Realty Labz",
    short_name: "Realty Labz",
    description:
      "Transactions, contract deadlines, clients, and your full financial picture — business and personal — for real estate agents and their teams.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    // Brand navy, from the logo (globals.css / logo-mark.ts).
    theme_color: "#16192e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
