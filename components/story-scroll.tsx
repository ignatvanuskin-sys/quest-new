"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { QUESTS } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { MonoLabel } from "@/components/ui";
import { FogLayer, EyesWatch } from "@/components/scenery";
import { AnimatedHeadline } from "@/components/animated-text";

const story = QUESTS[0];

/**
 * Скролл как инструмент повествования: по мере чтения кадр уходит в темноту,
 * а фрагменты истории проявляются один за другим. Пользователь не скроллит
 * «десять экранов ради одной фразы»: весь блок — один экран, текст короткий.
 */
export function StoryScroll() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const darkness = useTransform(scrollYProgress, [0, 0.5, 1], [0.32, 0.62, 0.94]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.16]);
  const imageY = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);

  return (
    <section id="inside" className="relative scroll-mt-24 overflow-hidden border-t border-bone/8">
      <div ref={ref} className="relative">
        <motion.div
          style={reduced ? undefined : { scale: imageScale, y: imageY }}
          className="absolute inset-0 -z-10"
          aria-hidden="true"
        >
          <Image
            src={story.image}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
        </motion.div>
        <motion.div
          style={reduced ? undefined : { opacity: darkness }}
          className="absolute inset-0 -z-10 bg-ink"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/55 to-transparent" aria-hidden="true" />

        <FogLayer tone="warm" />
        <EyesWatch side="right" className="bottom-[18%]" size="1rem" />

        <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10 lg:py-36">
          <div className="max-w-2xl">
            <Reveal>
              <MonoLabel>Что внутри</MonoLabel>
            </Reveal>

            <Reveal delay={1}>
              <AnimatedHeadline
                as="h2"
                text="Это не комната с замками"
                stagger={0.028}
                flickerCount={2}
                className="mt-5 font-display text-[clamp(1.9rem,6.6vw,4.2rem)] uppercase leading-[0.95] tracking-tight text-bone"
              />
            </Reveal>

            <div className="mt-8 space-y-5">
              {story.story.map((fragment, index) => (
                <Reveal key={fragment} delay={((index % 3) + 1) as 1 | 2 | 3}>
                  <p
                    className={`text-[15px] leading-relaxed sm:text-lg ${
                      index === 0
                        ? "font-mono uppercase tracking-[0.2em] text-crimson"
                        : index === story.story.length - 1
                          ? "text-bone"
                          : "text-bone-dim"
                    }`}
                  >
                    {fragment}
                  </p>
                </Reveal>
              ))}
            </div>

            <Reveal delay={2}>
              <div className="mt-10 border-l-2 border-crimson/60 pl-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-ash-text">
                  {story.title} · {story.spec.playersMin}–{story.spec.playersMax} человек ·{" "}
                  {story.spec.duration} минут
                </p>
                <p className="mt-3 text-sm leading-relaxed text-bone-dim sm:text-base">
                  Выберите уровень страха — от «без актёров» до полного контакта — и решите, кто из команды
                  останется один в комнате. Дальше начинается игра актёров.
                </p>
              </div>
            </Reveal>

            <Reveal delay={3}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href={`/quests/${story.slug}`}
                  data-cursor="[ ОТКРЫТЬ ]"
                  className="btn-blood px-6 py-3.5 font-display text-sm uppercase tracking-[0.16em]"
                >
                  Сюжет целиком
                </Link>
                <Link
                  href="/#quests"
                  data-cursor="[ СМОТРЕТЬ ]"
                  className="btn-ghost px-6 py-3.5 font-display text-sm uppercase tracking-[0.16em]"
                >
                  Все квесты
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
