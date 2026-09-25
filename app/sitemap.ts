import type { MetadataRoute } from "next";
import { QUEST_SLUGS } from "@/lib/content";
import { getSiteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/booking`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...QUEST_SLUGS.map((slug) => ({
      url: `${base}/quests/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
