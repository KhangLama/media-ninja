import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://media-ninja.vercel.app";

  const routes = [
    "",
    "/image-optimizer",
    "/video-processor",
    "/subtitle-generator",
    "/pdf-tools",
    "/ocr-extractor",
    "/qr-studio",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1.0 : 0.8,
  }));
}
