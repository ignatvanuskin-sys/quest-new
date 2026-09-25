"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, HeartPulse, Skull, Snowflake, Zap } from "lucide-react";
import { FEAR_MODES } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { Whisper } from "@/components/scenery";
import { SectionBackdrop } from "@/components/backdrop";

const ICONS = [Snowflake, HeartPulse, Skull, Zap];

/** Что реально происходит на каждом уровне — формулировки без обещаний, которых не будет */
const EXPERIENCE = [
  "Только атмосфера: свет, звук, декорации, актёры за стенами. Вы всё время вместе и всё контролируете.",
  "Актёры работают рядом: появляются, следят, пугают внезапно — но не касаются никого из команды.",
  "Средний контакт: команду могут развести по комнатам, увести одного игрока и вернуть его не сразу.",
  "Полный контакт: касания, захваты, «утаскивания». Игра идёт на грани, и команда это подтвердила заранее.",
];

/**
 * Интерактивное «испытание страха».
 *
 * Задача блока — не развлечь, а довести до брони: человек сам выбирает уровень,
 * видит честное описание того, что будет происходить, и уходит в форму
 * с уже выбранным режимом (?fear=...). Никаких «узнай свой страх» без выхода.
 */
export function FearDial() {
  const [level, setLevel] = useState(2);
  const [touched, setTouched] = useState(false);
  const mode = FEAR_MODES[level - 1];
  const Icon = ICONS[level - 1];

  return (
    <section
      id="fear-test"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-ink py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/band-corridor.jpg" opacity={0.22} />
      <Whisper className="pointer-events-none absolute right-6 top-10">не оборачивайся</Whisper>

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Испытание страха"
            title={
              <>
                Насколько глубоко вы <span className="text-crimson">готовы зайти</span>
              </>
            }
            lead="Двигайте ползунок и читайте, что именно будет происходить. Уровень можно поменять в любой момент — и до игры, и внутри локации."
          />
        </Reveal>

        <Reveal delay={1}>
          <div className="pulse-frame mt-12 border border-bone/12 bg-charcoal/60 p-5 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">
                Ваш уровень
              </span>
              <span className="font-display text-2xl tabular-nums text-bone">
                0{level}
                <span className="ml-1 font-mono text-xs text-ash-text">/ 04</span>
              </span>
            </div>

            <label htmlFor="fear-range" className="sr-only">
              Уровень страха: от «без актёров» до полного контакта
            </label>
            <input
              id="fear-range"
              type="range"
              min={1}
              max={4}
              step={1}
              value={level}
              aria-valuetext={`${mode.name} — ${mode.contact}`}
              onChange={(event) => {
                setLevel(Number(event.target.value));
                setTouched(true);
              }}
              className="mt-6 h-11 w-full cursor-pointer appearance-none bg-transparent
                [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-steel
                [&::-webkit-slider-thumb]:mt-[-11px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-bone/40
                [&::-webkit-slider-thumb]:bg-crimson [&::-webkit-slider-thumb]:shadow-[0_0_18px_rgba(221,85,96,0.75)]
                [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-steel
                [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-crimson"
            />

            <div className="mt-2 grid grid-cols-4 gap-2">
              {FEAR_MODES.map((item, index) => {
                const activeLevel = index + 1 <= level;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setLevel(index + 1);
                      setTouched(true);
                    }}
                    className={`min-h-[44px] border-t-2 pt-2 text-left font-mono text-[10px] uppercase leading-tight tracking-[0.16em] transition ${
                      activeLevel ? "border-crimson text-bone" : "border-steel text-ash-text hover:text-bone-dim"
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-8 grid gap-6 border-t border-bone/10 pt-8 lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div>
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-crimson" aria-hidden="true" />
                  <h3 className="font-display text-2xl uppercase tracking-[0.04em] text-bone">{mode.name}</h3>
                  <span className="border border-crimson/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-crimson">
                    {mode.contact}
                  </span>
                </div>

                <p className="mt-4 text-[15px] leading-relaxed text-bone-dim">{EXPERIENCE[level - 1]}</p>

                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text">
                  Возраст с {mode.minAge} лет · {mode.note}
                </p>

                {level >= 3 ? (
                  <p className="mt-4 border-l-2 border-crimson/60 pl-4 text-xs leading-relaxed text-crimson">
                    Команда подтверждает уровень перед игрой. Если кто-то передумает — снизим режим на месте,
                    без вопросов.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href={`/booking?fear=${mode.id}`}
                  data-cursor="[ ЗАБРОНИРОВАТЬ ]"
                  className="btn-blood heartbeat flex min-h-[52px] items-center justify-center gap-3 px-7 py-4 font-display text-base uppercase tracking-[0.16em]"
                >
                  Забронировать так
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p className="max-w-xs text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ash-text lg:text-left">
                  Режим доступен не на всех сценариях — в форме покажем только подходящие
                </p>
              </div>
            </motion.div>

            {!touched ? (
              <p aria-hidden="true" className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">
                двигайте ползунок
              </p>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
