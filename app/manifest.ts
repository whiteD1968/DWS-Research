import type { MetadataRoute } from "next";

// Lets DWS Research install as its own app window from Chrome, Edge, or Safari, at the same web address.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DWS Research",
    short_name: "DWS",
    description: "Dustin White Studio workspace for research, practice, and tenure.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F4EF",
    theme_color: "#141414",
    categories: ["productivity", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    // Right-click the app's taskbar or dock icon to jump straight to these.
    shortcuts: [
      { name: "Journal", url: "/journal", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Library", url: "/library", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Canvas", url: "/boards", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Opportunities", url: "/opportunities", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
