"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────────────────────
   Базовые элементы интерфейса: заголовки, метры, метки, глитч.
   ─────────────────────────────────────────────────────────────────────────── */

export function MonoLabel({
  children,
  className,
  tone = "blood",
}: {
  children: ReactNode;
  className?: string;
  tone?: "blood" | "bone" | "muted";
}) {
  const tones = {
    blood: "text-crimson border-crimson/40",
    bone: "text-bone border-bone/25",
    muted: "text-ash-text border-steel",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.24em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "text-center" : "text-left", className)}>
      {eyebrow ? (
        <div className={cn("mb-4", align === "center" && "flex justify-center")}>
          <MonoLabel>{eyebrow}</MonoLabel>
        </div>
      ) : null}
      <h2 className="text-[clamp(2rem,6.2vw,4.4rem)] uppercase leading-[0.94] tracking-tight text-bone">
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            "mt-5 max-w-2xl text-base leading-relaxed text-bone-dim sm:text-lg",
            align === "center" && "mx-auto",
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Полосатый метр (уровень страха / сложность).
 * Заполнение анимируется при появлении в кадре — но никогда не мешает чтению:
 * рядом всегда есть текстовое значение.
 */
export function Meter({
  value,
  max = 10,
  label,
  tone = "blood",
  compact = false,
}: {
  value: number;
  max?: number;
  label: string;
  tone?: "blood" | "bone";
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const filled = Math.round((value / max) * 10);

  return (
    <div ref={ref} className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ash-text">{label}</span>
        <span className="font-mono text-[11px] text-bone-dim tabular-nums">
          {value}
          <span className="text-dust">/{max}</span>
        </span>
      </div>
      <div className="flex gap-[3px]" role="img" aria-label={`${label}: ${value} из ${max}`}>
        {Array.from({ length: 10 }).map((_, index) => {
          const on = index < filled;
          return (
            <motion.span
              key={index}
              initial={false}
              animate={{ opacity: inView ? (on ? 1 : 0.18) : 0.1 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className={cn(
                "block flex-1",
                compact ? "h-2" : "h-3",
                on
                  ? tone === "blood"
                    ? "bg-gradient-to-t from-blood to-crimson"
                    : "bg-gradient-to-t from-steel to-bone/70"
                  : "bg-steel/60",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Глитч-текст: включается на hover (или принудительно — при ошибке формы) */
export function GlitchText({
  children,
  active = false,
  className,
}: {
  children: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("glitch-text", className)}
      data-text={children}
      data-active={active ? "true" : "false"}
      onMouseEnter={(event) => event.currentTarget.setAttribute("data-active", "true")}
      onMouseLeave={(event) => {
        if (!active) event.currentTarget.setAttribute("data-active", "false");
      }}
    >
      {children}
    </span>
  );
}

export function StatPill({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="border border-bone/10 bg-ash/60 px-4 py-3 backdrop-blur-sm">
      <div className="font-display text-2xl uppercase leading-none text-bone sm:text-3xl">
        {value}
        <span className="ml-1 font-mono text-xs tracking-[0.2em] text-crimson">{unit}</span>
      </div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">{label}</div>
    </div>
  );
}
