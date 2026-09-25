"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const FACES = ["████░░░░░░", "██████░░░░", "████████░░", "█████████░"];

/**
 * Уровень страха / сложность квеста — «полосатая» шкала.
 * Значение всегда продублировано цифрой: шкала не заменяет текст,
 * а помогает оценить его с одного взгляда (и не мешает скринридеру).
 */
export function FearMeter({
  value,
  kind = "fear",
  face = false,
}: {
  value: number;
  kind?: "fear" | "difficulty";
  /** Показать «блочный» вид в стиле терминала */
  face?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  const filled = Math.round((value / 10) * 10);
  const label = kind === "fear" ? "Уровень страха" : "Сложность";
  const index = Math.min(3, Math.floor((value - 1) / 2.5));

  if (face) {
    return (
      <span
        ref={ref}
        className="font-mono text-[11px] tracking-[0.18em]"
        role="img"
        aria-label={`${label}: ${value} из 10`}
      >
        <span className={filled >= 7 ? "text-crimson" : "text-bone-dim"}>{FACES[index]}</span>
        <span className="ml-2 text-ash-text">{value}/10</span>      </span>
    );
  }

  return (
    <div ref={ref}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-bone-dim">
          {value}
          <span className="text-ash-text">/10</span>
        </span>
      </div>
      <div className="flex gap-[3px]" role="img" aria-label={`${label}: ${value} из 10`}>
        {Array.from({ length: 10 }).map((_, i) => {
          const on = i < filled;
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0.12, scaleY: 0.4 }}
              animate={inView ? { opacity: on ? 1 : 0.16, scaleY: 1 } : undefined}
              transition={{ duration: 0.45, delay: i * 0.04 }}
              className={`h-2.5 flex-1 origin-bottom ${
                on
                  ? kind === "fear"
                    ? "bg-gradient-to-t from-blood via-crimson to-ember"
                    : "bg-gradient-to-t from-steel to-bone/60"
                  : "bg-steel/50"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
