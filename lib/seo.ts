import { BUSINESS, LOCATIONS, QUESTS, SOCIAL_PROOF, getLocation } from "./content";
import { FAQ } from "./faq";
import { REVIEWS } from "./reviews";
import type { Quest } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Структурированные данные (schema.org) и метаданные для SEO.
//  Запросы, под которые оптимизирован сайт: «хоррор квест Алматы»,
//  «страшный квест», «квест на день рождения», «квест для компании».
// ─────────────────────────────────────────────────────────────────────────────

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}

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
    offers: {
      "@type": "Offer",
      priceCurrency: "KZT",
      price: quest.priceFrom,
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
      availability: "https://schema.org/InStock",
      url: `${getSiteUrl()}/quests/${quest.slug}`,
      seller: { "@id": `${getSiteUrl()}/#business` },
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
