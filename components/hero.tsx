"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowDown, Flame, Star, Ticket } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { FogLayer, EyesWatch, StormFlash } from "@/components/scenery";
import { ShaderBackground } from "@/components/ui/gem-smoke-diamond";
import { useDesktop } from "@/components/use-media";
import { priceLine } from "@/lib/pricing";
import { formatHumanDate, pluralSlots } from "@/lib/utils";

export interface HeroSlot {
  questSlug: string;
  questTitle: string;
  dateISO: string;
  time: string;
  seatsLeft: number;
}

export function Hero({ liveSlots }: { liveSlots: HeroSlot[] }) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const desktop = useDesktop();
  // На телефоне параллакс hero отключён: он заметно дёргает скролл,
  // а выигрыш в глубине на маленьком экране почти не читается
  const parallax = !reduced && desktop;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "34%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.72], [1, 0]);

  const hero = liveSlots[0];

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink pb-24 pt-28 sm:items-center sm:pb-16"
      aria-label="Главный экран"
    >
      {/* Фон: отдельные кадры для мобильного и десктопа, без двойной загрузки */}
      <motion.div
        style={parallax ? { y: imageY } : undefined}
        className="absolute inset-0 -z-10 h-[112%]"
        aria-hidden="true"
      >
        <picture>
          <source media="(min-width: 768px)" srcSet="/images/hero-wide.jpg" />
          <img
            src="/images/hero-mobile.jpg"
            alt=""
            width={1024}
            height={1536}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center brightness-[0.55] contrast-[1.08] saturate-[0.8]"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-transparent to-ink/70" />

        {/* WebGL-слой «дым в камне»: живая фактура, которой не может дать
            статичная фотография.

            Как он встроен, чтобы не сломать уже собранную картинку:

            • mix-blend-screen. Шейдер считает кадр на почти чёрной базе
              (#050507). В режиме screen чёрное становится прозрачным, поэтому
              из фотографии проявляется только само свечение — кровяной дым
              ложится поверх кадра, а не заменяет его серым прямоугольником.

            • маска radial-gradient гасит слой к краям: без неё границы canvas
              читались бы как отдельный блок.

            • opacity 0.5 и `pointer-events: none` — слой атмосферный, он не
              мешает читать текст и не перехватывает клики.

            • он лежит НИЖЕ контента (-z-10, как и остальной фон), поэтому
              заголовок и кнопки остаются поверх, а LCP-элемент не меняется. */}
        <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen [mask-image:radial-gradient(ellipse_at_50%_42%,black_30%,transparent_76%)] [-webkit-mask-image:radial-gradient(ellipse_at_50%_42%,black_30%,transparent_76%)]">
          <ShaderBackground shape="diamond" intensity={0.7} timeScale={0.55} vignette={0.45} />
        </div>
      </motion.div>

      {/* Атмосферный слой: дышащий туман, редкая вспышка в глубине, глаза в темноте */}
      <FogLayer />
      <StormFlash />
      <EyesWatch side="right" className="top-[26%] z-[2]" size="1.1rem" />
      <EyesWatch side="left" className="bottom-[30%] z-[2]" size="0.85rem" />

      <motion.div
        style={parallax ? { y: contentY, opacity: contentOpacity } : undefined}
        className="relative mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10"
      >
        <div className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.3em] text-bone-dim"
          >
            <span className="text-crimson">{BUSINESS.city}</span>
            <span className="text-ash-text/70">/</span>
            <span>хоррор-перформанс в реальном бомбоубежище</span>
          </motion.p>

          {/* Заголовок разбит на два блока ради композиции, но текст должен
              оставаться цельным: без пробела между span копирование даёт
              «Не заходиодин.», а скринридер произносит «заходиодин» — одно
              слово вместо двух. Поэтому визуальные части помечены
              aria-hidden, а настоящий заголовок лежит в visually-hidden. */}
          <h1 className="sr-only">Не заходи один.</h1>
          <div
            aria-hidden="true"
            className="font-display uppercase leading-[0.86] tracking-[-0.02em]"
          >
            <motion.span
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="block text-[clamp(2.9rem,13vw,8.4rem)] text-bone"
            >
              Не заходи
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="mt-1 block text-[clamp(3.4rem,15vw,9.5rem)] text-crimson animate-[flicker_7.5s_infinite_steps(1,end)]"
            >
              один.
            </motion.span>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-bone-dim sm:text-lg"
          >
            Ты слышал, что здесь происходит. Теперь попробуй выйти: шесть хоррор-перформансов в реальном
            бомбоубежище, живые актёры и уровень страха, который выбираешь ты сам.
          </motion.p>

          {/* Цена в первом экране: без неё человек уходит «сравнить» и не
              возвращается. Показываем оба реальных числа, чтобы в форме
              не было сюрприза */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.58, duration: 0.7 }}
            className="mt-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-bone-dim"
          >
            <span className="text-bone">{priceLine()}</span>
            <span className="mx-2 text-ash-text/60">·</span>
            от 3 500 ₸ с человека
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.66, duration: 0.7 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/booking"
              data-cursor="[ ЗАБРОНИРОВАТЬ ]"
              className="btn-blood beam-border group flex items-center justify-center gap-3 px-7 py-4 font-display text-base uppercase tracking-[0.16em] sm:text-lg"
            >
              <Ticket className="h-5 w-5" aria-hidden="true" />
              Забронировать игру
            </Link>
            <Link
              href="/#quests"
              data-cursor="[ СМОТРЕТЬ ]"
              className="btn-ghost flex items-center justify-center gap-3 px-7 py-4 font-display text-base uppercase tracking-[0.16em] sm:text-lg"
            >
              Смотреть квесты
            </Link>
          </motion.div>

          {/* Доказательства: только реальные цифры площадки */}
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.8 }}
            className="mt-10 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 border-t border-bone/10 pt-6 sm:grid-cols-4"
          >
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">Оценка игроков</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-display text-xl text-bone">
                <Star className="h-4 w-4 fill-crimson text-crimson" aria-hidden="true" />
                {BUSINESS.rating}
                <span className="text-xs text-dust">/ 10</span>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">Локации</dt>
              <dd className="mt-1 font-display text-xl text-bone">250–300 м²</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">Длительность</dt>
              <dd className="mt-1 font-display text-xl text-bone">60 мин</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">Команда</dt>
              <dd className="mt-1 font-display text-xl text-bone">2–15 чел.</dd>
            </div>
          </motion.dl>

          {hero ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.7 }}
              className="mt-8 inline-flex flex-wrap items-center gap-x-3 gap-y-2 border border-crimson/35 bg-blood-deep/25 px-4 py-3 backdrop-blur-sm"
            >
              <Flame className="h-4 w-4 shrink-0 text-crimson animate-[heartbeat_1.8s_ease-in-out_infinite]" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-bone-dim">
                Ближайшее время
              </span>
              <span className="font-display text-sm uppercase tracking-[0.1em] text-bone">
                {formatHumanDate(hero.dateISO)}, {hero.time}
              </span>
              <span className="font-mono text-[10px] text-crimson">{pluralSlots(hero.seatsLeft)}</span>
              <Link
                href={`/booking?quest=${hero.questSlug}`}
                data-cursor="[ ВЫБРАТЬ СЛОТ ]"
                className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.24em] text-bone underline decoration-crimson/60 underline-offset-4 hover:text-crimson"
              >
                выбрать время
              </Link>
            </motion.div>
          ) : null}
        </div>
      </motion.div>

      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 1 }}
        className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.34em] text-ash-text">Скролл</span>
        <ArrowDown className="h-4 w-4 animate-bounce text-crimson/80" />
      </motion.div>
    </section>
  );
}
