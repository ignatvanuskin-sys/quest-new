import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Служебное и приватное не отдаём ботам. `/admin` больше не существует
        // (панель удалена), но правило остаётся: если страницу вернут позже,
        // она не должна попасть в индекс. `/api/` — эндпоинты, а не страницы.
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
