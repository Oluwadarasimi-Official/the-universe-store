import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "THE UNIVERSE STORE", short_name: "Universe Store", description: "Everything Worth Discovering.",
    start_url: "/", display: "standalone", background_color: "#FFFFFF", theme_color: "#087A45",
    icons: [{ src: "/brand/logo-192.png", sizes: "192x192", type: "image/png" }, { src: "/brand/logo-512.png", sizes: "512x512", type: "image/png" }],
  };
}
