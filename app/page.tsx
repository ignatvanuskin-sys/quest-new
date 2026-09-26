import Link from "next/link";
import { Gift } from "lucide-react";
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
import { TrustBar } from "@/components/trust-bar";
import { HowItWorks } from "@/components/how-it-works";
import { BIRTHDAY_PROMO, QUESTS } from "@/lib/content";
import { bookedSeatsByDate } from "@/lib/bookings";
import { nextAvailableSlots } from "@/lib/availability";
import { faqJsonLd } from "@/lib/seo";
import { businessToday } from "@/lib/time";
import { formatHumanDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Ближайшие свободные слоты для главной.
 *
 * ГЛАВНАЯ ПРОБЛЕМА, которую это решает. Раньше для каждого квеста брался
 * ровно один ближайший слот, а расписание у всех квестов общее. В итоге
 * блок «Занятость сейчас» показывал одну и ту же строку три раза:
 * «26 сентября, 19:30, 15 мест». Для посетителя это читается однозначно —
 * данные не настоящие, а значит и ценам рядом тоже перестаёшь верить.
 * Слот, который человек не дождался, не вернуть никаким дизайном.
 *
 * Теперь по каждому квесту берётся несколько ближайших слотов, а затем
 * из общего списка оставляются только РАЗНЫЕ по дате и времени. Повторов
 * не остаётся, и на главной видно реальное расписание — ровно то, которое
 * потом покажет календарь в бронировании.
 */
async function buildLiveSlots(): Promise<HeroSlot[]> {
  const today = businessToday();
  const seen = new Set<string>();
  const result: HeroSlot[] = [];

  for (const quest of QUESTS) {
    const booked = await bookedSeatsByDate(quest.slug);
    // Несколько слотов на квест: иначе дедуплицировать нечего, и в блоке
    // снова останется одна и та же строка на все шесть сценариев.
    const slots = nextAvailableSlots(quest.slug, today, 3, booked);

    for (const slot of slots) {
      const key = `${slot.dateISO}|${slot.time}`;
      // Один и тот же слот в разных квестах — это дубликат в интерфейсе.
      // Первое упоминание оставляем: чем раньше по времени, тем ближе к делу.
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({
        questSlug: quest.slug,
        questTitle: quest.title,
        dateISO: slot.dateISO,
        time: slot.time,
        seatsLeft: slot.seatsLeft,
      });
    }
  }

  return result
    .sort((a, b) => `${a.dateISO}${a.time}`.localeCompare(`${b.dateISO}${b.time}`))
    .slice(0, 4);
}

export default async function HomePage() {
  const liveSlots = await buildLiveSlots();
  // Слоты на главной уже уникальны (см. buildLiveSlots), поэтому в блоке
  // расписания не может появиться одна и та же строка дважды.
  const rest = liveSlots.slice(1, 4);
  const teasers = Object.fromEntries(
    liveSlots.map((slot) => [
      slot.questSlug,
      { dateISO: slot.dateISO, time: slot.time, seatsLeft: slot.seatsLeft },
    ]),
  );

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

      {/* Доверие сразу после первого экрана: реальное место, оценка игроков,
          правило отмены, стоп-слово. Раньше эти ответы лежали в разных
          секциях далеко внизу — теперь встречают человека первыми */}
      <TrustBar />

      <FactRibbon />

      {rest.length > 0 ? (
        <section aria-label="Ближайшие свободные слоты" className="border-b border-bone/8 bg-charcoal/50">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ash-text">
              Занятость сейчас — по подтверждённым броням
            </p>
            <ul className="grid gap-3 sm:grid-cols-3 lg:flex-1 lg:justify-end">
              {rest.map((slot) => (
                <li key={`${slot.questSlug}-${slot.dateISO}-${slot.time}`}>
                  <Link
                    href={`/booking?quest=${slot.questSlug}`}
                    data-cursor="[ ВЫБРАТЬ СЛОТ ]"
                    className="flex min-h-[52px] items-center justify-between gap-4 border border-bone/10 bg-ink/50 px-4 py-3 transition hover:border-crimson/50 lg:justify-start"
                  >
                    <span className="flex min-w-0 flex-col">
                      {/* Название сценария прямо в строке слота. Раньше здесь были
                          только дата, время и «15 мест», и три такие строки подряд
                          выглядели копипастом одного слота. Имя квеста делает каждую
                          строку самостоятельной и сразу отвечает «это про что». */}
                      <span className="truncate font-display text-sm uppercase tracking-[0.06em] text-bone">
                        {slot.questTitle}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim">
                        {formatHumanDate(slot.dateISO)}
                      </span>
                    </span>
                    <span className="font-display text-base text-bone">{slot.time}</span>
                    <span className="font-mono text-[10px] text-crimson">{slot.seatsLeft} мест</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Реальная акция площадки. Она же — честный рычаг среднего чека:
          команда от 6 человек платит по 3 500 ₸ с человека и получает
          бесплатную игру имениннику, то есть выгоднее для обеих сторон */}
      <section aria-label="Акция для именинника" className="border-b border-bone/8 bg-blood-deep/15">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-10">
          <Gift className="h-5 w-5 shrink-0 text-crimson" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-bone-dim">
            <span className="font-display uppercase tracking-[0.06em] text-bone">
              {BIRTHDAY_PROMO.title}
            </span>{" "}
            — {BIRTHDAY_PROMO.detail}
          </p>
          <Link
            href="/booking"
            data-cursor="[ ДЛЯ КОМПАНИИ ]"
            className="btn-ghost inline-flex min-h-[44px] items-center px-5 py-2.5 font-display text-xs uppercase tracking-[0.14em]"
          >
            Забронировать для компании
          </Link>
        </div>
      </section>

      <QuestGrid teasers={teasers} />

      {/* Атмосферная пауза между каталогом и персонажами: человек успевает
          «увидеть» коридор до того, как ему расскажут про актёров */}
      <BackdropBand
        image="/images/band-hall.jpg"
        kicker="Коридор"
        quote="Одна из этих дверей не заперта. Мы не скажем, какая."
        note="Шесть сценариев в двух филиалах Алматы. Четыре уровня страха — от «просто атмосферно» до полного контакта."
        ctaHref="/booking"
        ctaLabel="Посмотреть свободное время"
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
        ctaLabel="Забронировать игру"
        height="short"
      />

      <Gallery />
      <SocialProof />
      <Reviews />

      {/* Порядок перед решением: сначала доверие (отзывы), потом снятие
          неизвестности (как проходит игра), потом правила */}
      <HowItWorks />

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