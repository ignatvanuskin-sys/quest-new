import { Hero, type HeroSlot } from "@/components/hero";
import { FactRibbon } from "@/components/fact-ribbon";
import { QuestGrid } from "@/components/quest-grid";
import { Characters } from "@/components/characters";
import { FearLevels } from "@/components/fear-levels";
import { FearDial } from "@/components/fear-dial";
import { StoryScroll } from "@/components/story-scroll";
import { InsideGallery } from "@/components/inside-gallery";
import { Gallery } from "@/components/gallery";
import { SocialProof } from "@/components/social-proof";
import { Reviews } from "@/components/reviews";
import { BeforeYouEnter } from "@/components/before-you-enter";
import { Faq } from "@/components/faq";
import { LocationSection } from "@/components/location";
import { FinalCta } from "@/components/final-cta";
import { BackdropBand } from "@/components/backdrop";
import { QUESTS } from "@/lib/content";
import { bookedSeatsByDate } from "@/lib/bookings";
import { nextAvailableSlots } from "@/lib/availability";
import { faqJsonLd } from "@/lib/seo";
import { formatHumanDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Ближайшие свободные слоты по всем квестам: на их основе показываем
 * честную срочность в hero и в блоке расписания.
 */
async function buildLiveSlots(): Promise<HeroSlot[]> {
  const now = new Date();
  const result: HeroSlot[] = [];

  for (const quest of QUESTS) {
    const booked = await bookedSeatsByDate(quest.slug);
    const [slot] = nextAvailableSlots(quest.slug, now, 3, booked);
    if (slot) {
      result.push({
        questSlug: quest.slug,
        questTitle: quest.title,
        dateISO: slot.dateISO,
        time: slot.time,
        seatsLeft: slot.seatsLeft,
      });
    }
  }

  return result.sort((a, b) =>
    `${a.dateISO}${a.time}` < `${b.dateISO}${b.time}` ? -1 : 1,
  );
}

export default async function HomePage() {
  const liveSlots = await buildLiveSlots();
  const rest = liveSlots.slice(1, 4);

  return (
    <>
      {/* Hero — главный элемент LCP. React 19 поднимает эти ссылки в <head>,
          и браузер скачивает ровно тот кадр, который нужен на текущем размере
          экрана: второй не загружается вовсе. */}
      <link
        rel="preload"
        as="image"
        href="/images/hero-mobile.jpg"
        media="(max-width: 767px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/images/hero-wide.jpg"
        media="(min-width: 768px)"
        fetchPriority="high"
      />

      <Hero liveSlots={liveSlots} />
      <FactRibbon />

      {rest.length > 0 ? (
        <section aria-label="Ближайшие свободные слоты" className="border-b border-bone/8 bg-charcoal/50">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ash-text">
              Занятость сейчас — по подтверждённым броням
            </p>
            <ul className="grid gap-3 sm:grid-cols-3 lg:flex-1 lg:justify-end">
              {rest.map((slot) => (
                <li
                  key={`${slot.questSlug}-${slot.dateISO}-${slot.time}`}
                  className="flex items-center justify-between gap-4 border border-bone/10 bg-ink/50 px-4 py-3 lg:justify-start"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim">
                    {formatHumanDate(slot.dateISO)}
                  </span>
                  <span className="font-display text-base text-bone">{slot.time}</span>
                  <span className="font-mono text-[10px] text-crimson">{slot.seatsLeft} мест</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <QuestGrid />

      {/* Атмосферная пауза между каталогом и персонажами: человек успевает
          «увидеть» коридор до того, как ему расскажут про актёров */}
      <BackdropBand
        image="/images/band-hall.jpg"
        kicker="Коридор"
        quote="Одна из этих дверей не заперта. Мы не скажем, какая."
        note="Шесть сценариев в двух филиалах Алматы. Четыре уровня страха — от «просто атмосферно» до полного контакта."
        ctaHref="/booking"
        ctaLabel="Занять время"
      />

      <Characters />
      <FearLevels />
      <FearDial />
      <StoryScroll />
      <InsideGallery />

      <BackdropBand
        image="/images/band-mirror.jpg"
        kicker="Отражение"
        quote="В отражении коридор длиннее, чем на самом деле."
        note="Актёры выходят из тех мест, где их не должно быть. Иногда — из-за вашей спины."
        ctaHref="/booking"
        ctaLabel="Забронировать ночь"
        height="short"
      />

      <Gallery />
      <SocialProof />
      <Reviews />
      <BeforeYouEnter />
      <Faq />
      <LocationSection />
      <FinalCta />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
    </>
  );
}
