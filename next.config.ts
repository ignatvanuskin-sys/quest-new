import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 360, 375, 390, 412, 430, 640, 768, 828, 1024, 1280, 1440, 1920],
    imageSizes: [64, 96, 128, 256, 384],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    /**
     * Строгие HTTPS-директивы включаем не по NODE_ENV, а по факту: если сайт
     * реально отдаётся по https. Иначе `npm start` на стенде без TLS получал бы
     * `upgrade-insecure-requests` и пытался грузить ресурсы по https — сайт
     * ломался бы на ровном месте.
     */
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const isHttps = siteUrl.startsWith("https://") || Boolean(process.env.VERCEL);

    /**
     * Политика безопасности контента.
     *
     * `unsafe-inline` в script-src нужен самому Next: он отдаёт встроенный
     * скрипт с данными гидратации, и без него страница не оживает. Это
     * ослабляет защиту от инъекций, но всё равно блокирует главный вектор —
     * загрузку чужого скрипта с внешнего домена. Переход на nonce —
     * отдельная задача (см. README, раздел «Безопасность»).
     *
     * `upgrade-insecure-requests` и HSTS включаются только в продакшене:
     * на локальном http они ломают загрузку ресурсов.
     */
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      isHttps ? "upgrade-insecure-requests" : "",
    ]
      .filter(Boolean)
      .join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
      ...(isHttps
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
    ];

    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // API не должно попадать в кеш посредников: там персональные данные
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
