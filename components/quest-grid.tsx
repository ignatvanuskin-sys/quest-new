"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { QUESTS } from "@/lib/content";
import { QuestCard } from "@/components/quest-card";
import { SectionHeading } from "@/components/ui";
import { SectionBackdrop } from "@/components/backdrop";
import { Reveal } from "@/components/reveal";
import { pluralPlayers } from "@/lib/utils";

type FearKey = "all" | "soft" | "medium" | "hard";
type GroupKey = "all" | "2" | "3-4" | "5-8" | "9-15";

const FEAR_FILTERS: Array<{ key: FearKey; label: string; hint: string }> = [
  { key: "all", label: "Любой страх", hint: "Все 6 квестов" },
  { key: "soft", label: "Мягко", hint: "До 6/10 — для первого раза и подростков" },
  { key: "medium", label: "Жутко", hint: "7–8/10 — атмосфера и давление" },
  { key: "hard", label: "Жёстко", hint: "9–10/10 — полный контакт" },
];

const GROUP_FILTERS: Array<{ key: GroupKey; label: string; min: number; max: number }> = [
  { key: "all", label: "Сколько угодно", min: 1, max: 99 },
  { key: "2", label: "Вдвоём", min: 2, max: 2 },
  { key: "3-4", label: "3–4", min: 3, max: 4 },
  { key: "5-8", label: "5–8", min: 5, max: 8 },
  { key: "9-15", label: "9–15", min: 9, max: 15 },
];

const FEAR_RANGES: Record<Exclude<FearKey, "all">, [number, number]> = {
  soft: [0, 6],
  medium: [7, 8],
  hard: [9, 10],
};

export function QuestGrid() {
  const [fear, setFear] = useState<FearKey>("all");
  const [group, setGroup] = useState<GroupKey>("all");

  const filtered = useMemo(() => {
    const groupRange = GROUP_FILTERS.find((item) => item.key === group) ?? GROUP_FILTERS[0];
    return QUESTS.filter((quest) => {
      if (fear !== "all") {
        const [min, max] = FEAR_RANGES[fear];
        if (quest.fear < min || quest.fear > max) return false;
      }
      // Квест подходит, если его диапазон игроков пересекается с выбранным
      const intersects =
        quest.spec.playersMin <= groupRange.max && quest.spec.playersMax >= groupRange.min;
      return intersects;
    });
  }, [fear, group]);

  const activeFilters = fear !== "all" || group !== "all";

  return (
    <section
      id="quests"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-ink py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/tex-concrete.jpg" opacity={0.14} />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="Каталог"
            title={
              <>
                Выбери свой <span className="blood-text">страх</span>
              </>
            }
            lead="Шесть перформансов в двух филиалах Алматы. Фильтр по уровню страха и размеру команды — чтобы вы зашли именно в тот сценарий, к которому готовы."
          />
        </Reveal>

        {/* Фильтры */}
        <Reveal delay={1}>
          <div className="mt-10 border border-bone/10 bg-charcoal/60 p-4 backdrop-blur-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-ash-text">
              <SlidersHorizontal className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
              Уровень страха
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по уровню страха">
              {FEAR_FILTERS.map((item) => {
                const active = fear === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFear(item.key)}
                    data-cursor="[ ВЫБРАТЬ ]"
                    title={item.hint}
                    className={`inline-flex min-h-[44px] items-center border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
                      active
                        ? "border-crimson bg-blood-deep/50 text-bone"
                        : "border-bone/15 text-bone-dim hover:border-bone/35 hover:text-bone"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 mb-4 font-mono text-[10px] uppercase tracking-[0.26em] text-ash-text">
              Размер команды
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по числу игроков">
              {GROUP_FILTERS.map((item) => {
                const active = group === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGroup(item.key)}
                    data-cursor="[ ВЫБРАТЬ ]"
                    className={`inline-flex min-h-[44px] items-center border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
                      active
                        ? "border-crimson bg-blood-deep/50 text-bone"
                        : "border-bone/15 text-bone-dim hover:border-bone/35 hover:text-bone"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-bone/8 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone-dim">
                Найдено: <span className="text-crimson">{filtered.length}</span> из {QUESTS.length}
                {group !== "all" ? (
                  <span className="ml-2 text-ash-text">
                    · подходит для {pluralPlayers(Number(group.split("-")[0]))}
                  </span>
                ) : null}
              </p>
              {activeFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setFear("all");
                    setGroup("all");
                  }}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash-text underline decoration-crimson/50 underline-offset-4 hover:text-bone"
                >
                  Сбросить фильтры
                </button>
              ) : null}
            </div>
          </div>
        </Reveal>

        {/* Сетка */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((quest, index) => (
              <motion.div
                key={quest.id}
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.2) }}
              >
                {/* Кадры каталога не помечаем priority: на телефоне они всё
                    равно ниже первого экрана, а конкуренция за канал замедлила
                    бы загрузку hero — главного элемента LCP */}
                <QuestCard quest={quest} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 border border-crimson/40 bg-blood-deep/20 p-8 text-center">
            <p
              className="glitch-text font-display text-2xl uppercase tracking-[0.12em] text-bone"
              data-text="Такого страха у нас нет"
              data-active="true"
            >
              Такого страха у нас нет
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-bone-dim">
              Под выбранные условия не подошёл ни один сценарий. Сбросьте фильтры или напишите нам — подберём
              формат под вашу команду вручную.
            </p>
            <button
              type="button"
              onClick={() => {
                setFear("all");
                setGroup("all");
              }}
              className="btn-blood mt-6 px-6 py-3 font-display text-sm uppercase tracking-[0.16em]"
            >
              Показать все квесты
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
