import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────────────────────
   Базовые элементы интерфейса: метка-эйрбрау, заголовок секции, плитка цифры.

   Здесь только то, что реально используется на страницах. Компоненты вроде
   `Meter` и `GlitchText` убраны после аудита: их заменили `FearMeter`
   и CSS-класс `.glitch-text`, а дублирующий код в проекте не нужен.
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
