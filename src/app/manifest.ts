import type { MetadataRoute } from "next";

type ManifestWithShare = MetadataRoute.Manifest & {
  share_target?: {
    action: string;
    method?: "GET" | "POST";
    enctype?: string;
    params?: { title?: string; text?: string; url?: string };
  };
};

export default function manifest(): ManifestWithShare {
  return {
    name: "Margin",
    short_name: "Margin",
    description: "Investment research capture and memory",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f1",
    theme_color: "#f3f4f1",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "Capture", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Camera", url: "/camera", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
