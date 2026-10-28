import type { MetadataRoute } from "next";

// Lets DWS Research install as its own app window from Chrome, Edge, or Safari.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DWS Research",
    short_name: "DWS",
    description: "Dustin White Studio workspace for research, practice, and tenure.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F4EF",
    theme_color: "#141414",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
