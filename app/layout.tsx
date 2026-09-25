import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Oswald } from "next/font/google";
import "./globals.css";
import { Atmosphere, CustomCursor, RouteFlicker, ScrollProgress } from "@/components/atmosphere";
import { JumpScareLayer, ProgressiveDarkness } from "@/components/effects";
import { IntroSequence } from "@/components/intro";
import { SoundToggle } from "@/components/sound";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileBookingBar } from "@/components/mobile-booking-bar";
import { BUSINESS } from "@/lib/content";
import { KEYWORDS, getSiteUrl, localBusinessJsonLd } from "@/lib/seo";

const siteUrl = getSiteUrl();

/**
 * Шрифты self-hosted (next/font): файлы скачиваются на этапе сборки и
 * отдаются с нашего домена. Это убирает два сторонних запроса и «второй»
 * LCP-пейнт, который возникал, когда Oswald подменял системный шрифт уже
 * после первой отрисовки (замер: LCP 1512 мс → цель < 1200 мс).
 */
const displayFont = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

const sansFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BUSINESS.name} — хоррор-квесты в Алматы | Перформанс в бомбоубежище`,
    template: `%s | ${BUSINESS.name}`,
  },
  description:
    "6 хоррор-перформансов в реальном бомбоубежище Алматы: локации 250–300 м², живые актёры, 4 уровня страха. Команды 2–15 человек, 60 минут, от 3 500 ₸. Онлайн-бронь за 3 шага.",
  keywords: KEYWORDS,
  alternates: { canonical: "/" },
  applicationName: BUSINESS.name,
  authors: [{ name: BUSINESS.name }],
  category: "entertainment",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl,
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} — не заходи один`,
    description:
      "Хоррор-перформансы в реальном бомбоубежище Алматы. Живые актёры, 4 уровня страха, бронь за 3 шага.",
    images: [
      {
        url: "/images/hero-wide.jpg",
        width: 1536,
        height: 1024,
        alt: "Тёмный коридор бомбоубежища и силуэт в глубине",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BUSINESS.name} — не заходи один`,
    description: "Хоррор-перформансы в реальном бомбоубежище Алматы. Бронь за 3 шага.",
    images: ["/images/hero-wide.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  other: {
    "geo.region": "KZ-ALA",
    "geo.placename": BUSINESS.city,
  },
};

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Пользователь должен иметь возможность увеличить текст: это не планшет,
  // а телефон в руках, и запрещать масштабирование нельзя
  maximumScale: 5,
  userScalable: true,
  // cover нужен, чтобы работали env(safe-area-inset-*): без него фиксированные
  // панели залезают под «шторку» и полосу жеста на iPhone
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}
    >
      <head>
        {/* Предзагрузка hero-кадра живёт на самой главной (app/page.tsx):
            в общем layout она тянула бы 150 КБ и на страницах без hero —
            например, в форме бронирования. */}
        <script
          type="application/ld+json"
          // Структурированные данные о бизнесе: адреса, часы работы, цены, отзывы
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd()) }}
        />
      </head>
      {/* Класс antialiased сознательно не используется: он принудительно включает
          grayscale-сглаживание, из-за которого мелкий текст на Windows выглядит
          бледнее (замер: 3.2:1 вместо 5.8:1 при 1x). Пусть система выбирает
          subpixel-рендеринг — читаемость важнее «гладкости». */}
      <body className="bg-ink text-bone">
        <a
          href="#quests"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-crimson focus:bg-ink focus:px-4 focus:py-3 focus:text-sm"
        >
          Перейти к квестам
        </a>

        <IntroSequence />
        <Atmosphere />
        <ProgressiveDarkness />
        <JumpScareLayer />
        <CustomCursor />
        <ScrollProgress />
        <RouteFlicker />
        <SoundToggle />
        <SiteHeader />

        <main id="main">{children}</main>

        <SiteFooter />
        <MobileBookingBar />
        {/* Отступ, чтобы фиксированная кнопка на мобильных не закрывала подвал */}
        <div aria-hidden="true" className="h-[96px] lg:hidden" />
      </body>
    </html>
  );
}
