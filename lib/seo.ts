import { BUSINESS, LOCATIONS, QUESTS, SOCIAL_PROOF, getLocation } from "./content";
import { FAQ } from "./faq";
import { REVIEWS } from "./reviews";
import { GAME_PRICE_TEAM, MIN_GAME_PRICE, PER_PERSON_FROM, PER_PERSON_PRICE } from "./pricing";
import type { Quest } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Адрес сайта в разметке: canonical, og:url, og:image, JSON-LD, robots, sitemap.
//
//  ПРОДАКШН-ДОМЕН ЗАДАЁТСЯ ЗДЕСЬ, а не «как получится».
//
//  Что было не так. На живом деплое canonical, og:url и og:image указывали на
//  `quest-5prlhra3s-bbc-b318.vercel.app` — это адрес preview-деплоя, который
//  Vercel создаёт для ветки и который удаляется вместе с веткой. Раньше адрес
//  брался так: `NEXT_PUBLIC_SITE_URL` → иначе `VERCEL_URL` → иначе localhost.
//  Переменная на деплое не была задана, поэтому срабатывал `VERCEL_URL` —
//  временный адрес. Итог: поисковик получал каноническую ссылку на несуществующий
//  домен (страница рисковала выпасть из индекса), а превью в мессенджерах
//  приходило с картинкой недоступного адреса.
//
//  Теперь правило явное:
//    1) валидный домен из NEXT_PUBLIC_SITE_URL — если это не localhost
//       и не preview-хост Vercel;
//    2) иначе продакшн-домен ниже;
//    3) localhost — только когда явно не на сервере (локальная разработка),
//       иначе сайт предпочтёт неправильный, но боевой домен пустому.
// ─────────────────────────────────────────────────────────────────────────────

/** Боевой домен сайта. Меняется только здесь. */
export const PRODUCTION_SITE_URL = "https://quest-new-five.vercel.app";

/**
 * Временный адрес Vercel не может быть каноническим: он живёт только пока
 * живёт ветка, а `quest-5prlhra3s-bbc-b318` из имени preview-деплоя ещё и
 * одноразовый. Правило простое: любой vercel.app, кроме боевого алиаса,
 * — непригодный адрес.
 */
const VERCEL_HOST = /\.vercel\.app$/i;

function normalize(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || !/^https?:\/\//i.test(value)) return null;
  return value.replace(/\/+$/, "");
}

function isUsableSiteUrl(value: string | null): value is string {
  if (!value) return false;
  const host = safeHost(value);
  if (!host) return false;
  if (host === "localhost" || /^127\.0\.0\.1$|^0\.0\.0\.0$/.test(host) || host === "[::1]") return false;
  if (VERCEL_HOST.test(host)) return host === safeHost(PRODUCTION_SITE_URL);
  return true;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Работает ли приложение локально (dev/stend), а не на хостинге. */
function isLocalRun(): boolean {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Предупреждение печатается один раз за процесс. Иначе при сборке и при
 * рендере каждой страницы в лог уходит десяток одинаковых строк, и настоящее
 * сообщение о поломке в нём теряется.
 */
let warnedAboutSiteUrl = false;

export function getSiteUrl(): string {
  const configured = normalize(process.env.NEXT_PUBLIC_SITE_URL);
  if (isUsableSiteUrl(configured)) return configured;

  // Заданная, но непригодная переменная на сервере — это ошибка конфигурации,
  // а не повод молча уводить канонический адрес на preview-домен.
  if (configured && !isLocalRun() && !warnedAboutSiteUrl) {
    warnedAboutSiteUrl = true;
    console.warn(
      `[seo] NEXT_PUBLIC_SITE_URL=${safeHost(configured)} непригоден как канонический адрес ` +
        `(localhost или preview-деплой). Используется продакшн-домен ${PRODUCTION_SITE_URL}. ` +
        "Задайте переменную в панели хостинга.",
    );
  }

  if (!isLocalRun()) return PRODUCTION_SITE_URL;

  const deploymentHost = process.env.VERCEL_URL?.trim();
  if (deploymentHost && !VERCEL_HOST.test(deploymentHost)) {
    return `https://${deploymentHost.replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

/** Совпадает ли адрес сайта с боевым. Используется в проверках окружения. */
export function isProductionSiteUrl(): boolean {
  return safeHost(getSiteUrl()) === safeHost(PRODUCTION_SITE_URL);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Структурированные данные (schema.org) и метаданные для SEO.

export const KEYWORDS = [
  "хоррор квест Алматы",
  "страшный квест Алматы",
  "квест-комната Алматы",
  "квест с актёрами",
  "квест на день рождения",
  "квест для компании",
  "перформанс Алматы",
  "бомбоубежище квест",
];

export function localBusinessJsonLd() {
  const [primary] = LOCATIONS;

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${getSiteUrl()}/#business`,
    name: BUSINESS.name,
    alternateName: BUSINESS.shortName,
    description:
      "Хоррор-перформансы и квесты в реальном бомбоубежище Алматы: 6 сценариев, локации 250–300 м², живые актёры, четыре уровня страха.",
    url: getSiteUrl(),
    image: `${getSiteUrl()}/images/hero-wide.jpg`,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    priceRange: "3 500 ₸ – 15 000 ₸",
    currenciesAccepted: "KZT",
    address: {
      "@type": "PostalAddress",
      streetAddress: primary.address,
      addressLocality: BUSINESS.city,
      addressCountry: "KZ",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: primary.lat,
      longitude: primary.lng,
    },
    areaServed: { "@type": "City", name: BUSINESS.city },
    sameAs: [BUSINESS.instagram],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "12:00",
        closes: "23:00",
      },
    ],
    // Рейтинг и отзывы — реальные: тексты и оценка взяты с официального сайта площадки.
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: SOCIAL_PROOF.ratingValue,
      bestRating: BUSINESS.ratingScale,
      worstRating: 1,
      reviewCount: REVIEWS.length,
    },
    review: REVIEWS.slice(0, 6).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.author },
      datePublished: review.date,
      reviewBody: review.text,
      reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 },
    })),
    makesOffer: QUESTS.map((quest) => ({
      "@type": "Offer",
      name: quest.title,
      priceCurrency: "KZT",
      price: quest.priceFrom,
      url: `${getSiteUrl()}/quests/${quest.slug}`,
      availability: "https://schema.org/InStock",
    })),
  };
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function questJsonLd(quest: Quest) {
  const location = getLocation(quest.locationId);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: quest.title,
    description: quest.tagline,
    image: `${getSiteUrl()}${quest.image}`,
    brand: { "@type": "Brand", name: BUSINESS.name },
    category: quest.genre,
    audience: { "@type": "PeopleAudience", suggestedMinAge: quest.spec.ageMin },
    /* Цена в разметке раньше была единственной — «от 3 500 ₸ с человека».
       Но заголовок страницы продаёт «15 000 ₸ за игру», и поисковая выдача
       показывала именно 3 500 ₸, то есть вводила в заблуждение на выдаче.
       AggregateOffer объявляет оба тарифа: полную цену за игру (её же
       показывает hero) и цену с человека для больших команд. */
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "KZT",
      lowPrice: MIN_GAME_PRICE,
      highPrice: MIN_GAME_PRICE,
      offerCount: 2,
      offers: [
        {
          "@type": "Offer",
          name: `${GAME_PRICE_TEAM} — за игру`,
          priceCurrency: "KZT",
          price: MIN_GAME_PRICE,
          availability: "https://schema.org/InStock",
          url: `${getSiteUrl()}/quests/${quest.slug}`,
          seller: { "@id": `${getSiteUrl()}/#business` },
        },
        {
          "@type": "Offer",
          name: `От ${PER_PERSON_FROM} человек — с человека`,
          priceCurrency: "KZT",
          price: PER_PERSON_PRICE,
          availability: "https://schema.org/InStock",
          url: `${getSiteUrl()}/quests/${quest.slug}`,
          seller: { "@id": `${getSiteUrl()}/#business` },
        },
      ],
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Длительность", value: `${quest.spec.duration} минут` },
      {
        "@type": "PropertyValue",
        name: "Игроков",
        value: `${quest.spec.playersMin}–${quest.spec.playersMax}`,
      },
      { "@type": "PropertyValue", name: "Уровень страха", value: `${quest.fear} из 10` },
      { "@type": "PropertyValue", name: "Сложность", value: `${quest.difficulty} из 10` },
      { "@type": "PropertyValue", name: "Адрес", value: `${location.city}, ${location.address}` },
    ],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${getSiteUrl()}${item.path}`,
    })),
  };
}
