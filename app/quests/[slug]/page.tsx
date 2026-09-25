import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  MessageCircle,
  Phone,
  Quote,
  ShieldCheck,
  Star,
  Target,
  Users,
} from "lucide-react";
import { QUESTS, QUEST_SLUGS, BUSINESS, getFearMode, getLocation, getQuest } from "@/lib/content";
import { REVIEWS } from "@/lib/reviews";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import { FearMeter } from "@/components/fear-meter";
import { Reveal } from "@/components/reveal";
import { MonoLabel, SectionHeading } from "@/components/ui";
import { QuestStickyCta } from "@/components/quest-sticky-cta";
import { QuestCard } from "@/components/quest-card";
import { QuestCompanions } from "@/components/quest-companions";
import { BackdropBand } from "@/components/backdrop";
import { ShareButton } from "@/components/share-button";
import { GAME_PRICE_TEAM, MIN_GAME_PRICE, PER_PERSON_FROM, PER_PERSON_PRICE } from "@/lib/pricing";
import { EyesWatch } from "@/components/scenery";
import { formatKzt, pluralPlayers } from "@/lib/utils";
import { breadcrumbJsonLd, questJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return QUEST_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const quest = getQuest(slug);
  if (!quest) return { title: "Квест не найден" };

  const location = getLocation(quest.locationId);
  const title = `${quest.title} — хоррор-квест в ${BUSINESS.city}`;
  const description = `${quest.tagline} ${quest.spec.playersMin}–${quest.spec.playersMax} игроков, ${quest.spec.duration} минут, от ${quest.spec.ageMin} лет. Адрес: ${location.address}. Онлайн-бронь.`;

  return {
    title,
    description,
    alternates: { canonical: `/quests/${quest.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      images: [{ url: quest.image, width: 1536, height: 1024, alt: quest.imageAlt }],
    },
    twitter: { card: "summary_large_image", title, description, images: [quest.image] },
  };
}

/**
 * Фоновый кадр для атмосферной полосы на странице квеста.
 * У каждого сценария свой — чтобы страницы не выглядели клонами.
 */
const QUEST_BANDS: Record<string, string> = {
  "karatelnaya-psihiatriya": "/images/band-ward.jpg",
  ritual: "/images/band-handprint.jpg",
  "ischadie-ada": "/images/band-corridor.jpg",
  "paranormalnye-yavleniya": "/images/band-mirror.jpg",
  "karatelnaya-psihiatriya-vasnetsova": "/images/band-mask.jpg",
  "nezvanye-gosti": "/images/band-hall.jpg",
};

/** Отзывы, относящиеся к этому сценарию (по названию, как на сайте площадки) */
function reviewsForQuest(title: string) {
  const key = title.split("—")[0].trim().split(".")[0].trim().toLowerCase();
  const direct = REVIEWS.filter((review) => {
    const reviewQuest = review.quest.toLowerCase();
    return reviewQuest.startsWith(key) || key.startsWith(reviewQuest);
  });
  return direct.length > 0 ? direct : REVIEWS.slice(0, 3);
}

export default async function QuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quest = getQuest(slug);
  if (!quest) notFound();

  const location = getLocation(quest.locationId);
  const placeholder = IMAGE_PLACEHOLDERS[quest.image.replace("/images/", "").replace(".jpg", "")];
  const reviews = reviewsForQuest(quest.title);
  const related = QUESTS.filter((item) => item.slug !== quest.slug).slice(0, 3);

  return (
    <>
      {/* ── Обложка ─────────────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[86svh] items-end overflow-hidden bg-ink pb-12 pt-28">
        <EyesWatch side="right" className="top-[22%] z-[2]" size="1.1rem" />
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <Image
            src={quest.image}
            alt={quest.imageAlt}
            fill
            priority
            sizes="100vw"
            placeholder={placeholder ? "blur" : "empty"}
            blurDataURL={placeholder}
            className="object-cover brightness-[0.5] contrast-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/40" />
        </div>

        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <nav aria-label="Хлебные крошки" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
              <li>
                <Link href="/" className="inline-block py-1 hover:text-bone">
                  Главная
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/#quests" className="inline-block py-1 hover:text-bone">
                  Квесты
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-bone-dim">{quest.title}</li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <MonoLabel>{quest.genre}</MonoLabel>
            <MonoLabel tone="muted">{location.label}</MonoLabel>
          </div>

          <h1 className="mt-5 max-w-4xl font-display text-[clamp(2rem,9vw,5.6rem)] uppercase leading-[0.9] tracking-[-0.01em] text-bone">
            {quest.title}
          </h1>

          <p className="mt-4 font-display text-[clamp(1.1rem,4vw,1.8rem)] uppercase leading-tight tracking-[0.02em] text-crimson">
            {quest.hook.split("\n").join(" ")}
          </p>

          <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 border-y border-bone/12 py-5 sm:grid-cols-4">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Игроков</dt>
              <dd className="mt-1 font-display text-xl text-bone">
                {quest.spec.playersMin}–{quest.spec.playersMax}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Длительность</dt>
              <dd className="mt-1 font-display text-xl text-bone">{quest.spec.duration} мин</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Возраст</dt>
              <dd className="mt-1 font-display text-xl text-bone">{quest.spec.ageMin}+</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Цена</dt>
              <dd className="mt-1 font-display text-xl text-bone">
                {formatKzt(MIN_GAME_PRICE)}
                <span className="ml-1 font-mono text-[10px] text-ash-text">за игру</span>
                <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.13em] text-crimson">
                  от {formatKzt(PER_PERSON_PRICE)} с человека от {PER_PERSON_FROM} чел.
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/booking?quest=${quest.slug}`}
              data-cursor="[ ЗАБРОНИРОВАТЬ ]"
              className="btn-blood beam-border flex items-center justify-center px-7 py-4 font-display text-base uppercase tracking-[0.16em]"
            >
              Забронировать этот квест
            </Link>
            <a
              href={BUSINESS.whatsapp}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn-ghost flex items-center justify-center gap-3 px-7 py-4 font-display text-sm uppercase tracking-[0.16em]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Спросить в WhatsApp
            </a>
            {/* Решение принимает компания в чате — даём отправить ссылку
                в один тап, не теряя человека с сайта */}
            <ShareButton
              title={`Хоррор-квест «${quest.title}» — Алматы`}
              text={`${quest.tagline} Тариф: ${formatKzt(MIN_GAME_PRICE)} за игру (${GAME_PRICE_TEAM}).`}
            />
          </div>
        </div>
      </section>

      {/* ── Сюжет и миссия ──────────────────────────────────────────────── */}
      <section className="border-t border-bone/8 bg-ink py-16 sm:py-24">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:px-10">
          <div>
            <Reveal>
              <MonoLabel>Сюжет</MonoLabel>
            </Reveal>
            <div className="mt-7 space-y-5">
              {quest.story.map((fragment, index) => (
                <Reveal key={fragment} delay={((index % 4) as 0 | 1 | 2 | 3)}>
                  <p
                    className={`flex gap-4 text-[15px] leading-relaxed sm:text-lg ${
                      index === 0
                        ? "font-mono uppercase tracking-[0.18em] text-crimson"
                        : index === quest.story.length - 1
                          ? "text-bone"
                          : "text-bone-dim"
                    }`}
                  >
                    <span className="select-none font-mono text-[10px] text-dust">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {fragment}
                  </p>
                </Reveal>
              ))}
            </div>

            <Reveal delay={2}>
              <div className="mt-10 border border-crimson/35 bg-blood-deep/20 p-5 sm:p-6">
                <h2 className="flex items-center gap-3 font-display text-xl uppercase tracking-[0.08em] text-bone">
                  <Target className="h-5 w-5 text-crimson" aria-hidden="true" />
                  Ваша задача
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-bone-dim sm:text-base">{quest.mission}</p>
              </div>
            </Reveal>

            <Reveal delay={3}>
              <div className="mt-10">
                <h2 className="font-display text-xl uppercase tracking-[0.08em] text-bone">
                  Особенности локации
                </h2>
                <ul className="mt-5 space-y-3">
                  {quest.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-relaxed text-bone-dim sm:text-base">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* Правая колонка: параметры, режимы, адрес */}
          <div className="space-y-6">
            <Reveal>
              <div className="border border-bone/12 bg-charcoal/60 p-5">
                <h2 className="font-display text-lg uppercase tracking-[0.1em] text-bone">Параметры</h2>
                <div className="mt-5 space-y-5">
                  <FearMeter value={quest.fear} />
                  <FearMeter kind="difficulty" value={quest.difficulty} />
                </div>
                <dl className="mt-6 space-y-3 border-t border-bone/8 pt-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ash-text">Жанр</dt>
                    <dd className="text-right text-bone-dim">{quest.spec.genre}</dd>
                  </div>
                  {quest.spec.areaM2 ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ash-text">Площадь</dt>
                      <dd className="text-right text-bone-dim">{quest.spec.areaM2} м²</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-ash-text">Команда</dt>
                    <dd className="text-right text-bone-dim">
                      {quest.spec.playersMin}–{quest.spec.playersMax} человек
                    </dd>
                  </div>
                </dl>
              </div>
            </Reveal>

            <Reveal delay={1}>
              <div className="border border-bone/12 bg-charcoal/60 p-5">
                <h2 className="font-display text-lg uppercase tracking-[0.1em] text-bone">
                  Уровни страха на этом квесте
                </h2>
                <ul className="mt-5 space-y-4">
                  {quest.fearModes.map((modeId) => {
                    const mode = getFearMode(modeId);
                    return (
                      <li key={mode.id} className="border-l border-crimson/40 pl-4">
                        <p className="font-display text-base uppercase tracking-[0.06em] text-bone">
                          {mode.name}
                        </p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-crimson">
                          {mode.contact} · с {mode.minAge} лет
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-bone-dim">{mode.note}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={2}>
              <div className="border border-bone/12 bg-charcoal/60 p-5">
                <h2 className="font-display text-lg uppercase tracking-[0.1em] text-bone">Где играем</h2>
                <p className="mt-3 text-sm text-bone-dim">
                  {location.city}, {location.address}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text">
                  {location.label}
                </p>
                <p className="mt-4 text-xs leading-relaxed text-ash-text">{location.entrance}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={location.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-ghost px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em]"
                  >
                    Маршрут в 2ГИС
                  </a>
                  <a
                    href={`tel:${BUSINESS.phone}`}
                    className="btn-ghost flex items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em]"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Позвонить
                  </a>
                </div>
              </div>
            </Reveal>

            <Reveal delay={3}>
              <div className="border border-bone/12 bg-charcoal/60 p-5">
                <h2 className="flex items-center gap-3 font-display text-lg uppercase tracking-[0.1em] text-bone">
                  <ShieldCheck className="h-4 w-4 text-crimson" aria-hidden="true" />
                  Безопасность
                </h2>
                <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-bone-dim">
                  <li>Стоп-слово: любой участник может попросить вывод — администратор выводит сразу.</li>
                  <li>Актёры не касаются лица и не причиняют травм.</li>
                  <li>Аварийное освещение и выходы есть в каждой локации.</li>
                  <li>
                    <Link href="/#before" className="text-crimson underline decoration-crimson/40 underline-offset-4">
                      Все правила перед входом
                    </Link>
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <BackdropBand
        image={QUEST_BANDS[quest.slug] ?? "/images/band-corridor.jpg"}
        kicker={quest.genre}
        quote={quest.hook.replace("\n", " ")}
        note={quest.mission}
        height="short"
      />

      <QuestCompanions quest={quest} />

      {/* ── Отзывы по квесту ───────────────────────────────────────────── */}
      <section className="border-t border-bone/8 bg-charcoal/40 py-16 sm:py-20">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <Reveal>
            <SectionHeading
              eyebrow="Отзывы игроков"
              title={
                <>
                  Что было <span className="text-crimson">внутри</span>
                </>
              }
              lead={
                reviews.length > 0 && reviewsForQuest(quest.title).length > 0
                  ? "Реальные отзывы с официального сайта площадки, относящиеся к этому сценарию."
                  : "По этому сценарию отдельных отзывов пока нет — показываем отзывы о площадке."
              }
            />
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <Reveal key={review.id}>
                <figure className="card-horror h-full p-5">
                  <div className="flex items-center justify-between">
                    <Quote className="h-5 w-5 text-crimson/70" aria-hidden="true" />
                    <div className="flex gap-0.5" aria-label={`Оценка ${review.rating} из 5`}>
                      {Array.from({ length: review.rating }).map((_, index) => (
                        <Star key={index} className="h-3.5 w-3.5 fill-crimson text-crimson" aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                  <blockquote className="mt-4 text-sm leading-relaxed text-bone">«{review.text}»</blockquote>
                  <figcaption className="mt-5 border-t border-bone/8 pt-4">
                    <span className="block font-display text-sm uppercase tracking-[0.1em] text-bone-dim">
                      {review.author}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text">
                      {review.quest} · {review.date}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          <Reveal delay={1}>
            <div className="mt-8 flex flex-wrap items-center gap-4 border border-bone/10 bg-ink/60 p-5">
              <p className="flex-1 text-sm text-bone-dim">
                Рейтинг площадки — <span className="text-bone">{BUSINESS.rating} / 10</span> по отзывам игроков.
                Проверить можно на официальном сайте и в 2ГИС.
              </p>
              <Link
                href={`/booking?quest=${quest.slug}`}
                className="btn-blood px-6 py-3.5 font-display text-sm uppercase tracking-[0.16em]"
              >
                Забронировать {pluralPlayers(quest.spec.playersMin)} минимум
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Другие квесты ──────────────────────────────────────────────── */}
      <section className="border-t border-bone/8 bg-ink py-16 sm:py-20">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-[clamp(1.6rem,5vw,2.8rem)] uppercase leading-none tracking-tight text-bone">
                Другие сценарии
              </h2>
              <Link
                href="/#quests"
                className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-dim hover:text-bone"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Весь каталог
              </Link>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((item) => (
              <Reveal key={item.id}>
                <QuestCard quest={item} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-bone/8 bg-charcoal/40 py-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text sm:px-6 lg:px-10">
          <span className="flex items-center gap-2">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {quest.spec.duration} минут игры
          </span>
          <span className="flex items-center gap-2">
            <Users className="h-3 w-3" aria-hidden="true" />
            {quest.spec.playersMin}–{quest.spec.playersMax} человек
          </span>
          <span>{quest.contentStatus === "editorial" ? "Сюжетный текст — черновик, требует подтверждения площадки" : "Сюжет по официальному описанию площадки"}</span>
        </div>
      </div>

      <QuestStickyCta slug={quest.slug} priceFrom={quest.priceFrom} title={quest.title} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(questJsonLd(quest)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Главная", path: "/" },
              { name: "Квесты", path: "/#quests" },
              { name: quest.title, path: `/quests/${quest.slug}` },
            ]),
          ),
        }}
      />
    </>
  );
}
