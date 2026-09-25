"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hc:intro-seen";

/** Сценарий интро: тишина → мигание → текст → reveal. Максимум ~3 секунды. */
const BEATS: Array<{ at: number; text: string; className?: string }> = [
  { at: 350, text: "03:17", className: "font-mono text-crimson" },
  { at: 1250, text: "последний звонок поступил именно тогда", className: "text-bone-dim" },
  { at: 2200, text: "после этого хозяина дома больше не видели", className: "text-bone-dim" },
  { at: 3100, text: "но дверь всё ещё открывается", className: "text-bone" },
];

const TOTAL = 4300;

/**
 * Короткое атмосферное интро при первом заходе в сессию.
 * Правила: не дольше нескольких секунд, всегда есть SKIP,
 * при reduced-motion не показывается вовсе.
 */
export function IntroSequence() {
  const [active, setActive] = useState(false);
  const [beat, setBeat] = useState(0);

  const skip = useCallback(() => {
    setActive(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* приватный режим — просто пропускаем */
    }
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      seen = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduced) return;

    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;

    document.documentElement.style.overflow = "hidden";
    const timers = BEATS.map((item, index) =>
      window.setTimeout(() => setBeat(index + 1), item.at),
    );
    const finish = window.setTimeout(skip, TOTAL);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") skip();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.documentElement.style.overflow = "";
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(finish);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, skip]);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="intro"
          role="dialog"
          aria-label="Вступительная сцена"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-ink px-6"
        >
          <div className="fx-scanlines pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative flex h-40 w-full max-w-xl flex-col items-center justify-center gap-3 text-center">
            {BEATS.map((item, index) => (
              <motion.p
                key={item.text}
                initial={{ opacity: 0, y: 8 }}
                animate={
                  beat > index
                    ? { opacity: beat === index + 1 ? [0, 1, 0.35, 1] : 0.42, y: 0 }
                    : { opacity: 0, y: 8 }
                }
                transition={{ duration: 0.55 }}
                className={`text-sm uppercase tracking-[0.18em] sm:text-base ${item.className ?? ""}`}
              >
                {item.text}
              </motion.p>
            ))}
          </div>

          <button
            type="button"
            onClick={skip}
            data-cursor="[ SKIP ]"
            className="absolute bottom-8 right-6 inline-flex min-h-[44px] items-center border border-bone/25 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-bone-dim transition hover:border-crimson/60 hover:text-bone sm:bottom-10 sm:right-10"
          >
            Пропустить
          </button>

          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-steel/40" aria-hidden="true">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: TOTAL / 1000, ease: "linear" }}
              className="progress-blood h-full"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
