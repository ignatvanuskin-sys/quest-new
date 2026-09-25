import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────────────────────
   Декор: туман, кровь на разделителе, следящие глаза, медленная царапина.
   Всё — чистый CSS без JS, поэтому рендерится на сервере и не стоит ничего
   в клиентском бандле. Каждая деталь aria-hidden: для скринридера это шум.
   ─────────────────────────────────────────────────────────────────────────── */

/** Дышащий туман поверх фона секции (родитель должен быть relative) */
export function FogLayer({ tone = "cold" }: { tone?: "cold" | "warm" }) {
  return (
    // -z-[1]: туман ложится поверх фона секции, но под её контентом,
    // поэтому текст и кнопки остаются полностью читаемыми
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-[1] overflow-hidden">
      <div className={cn("fog", tone === "warm" && "opacity-70")} />
    </div>
  );
}

/** Редкая вспышка света в глубине кадра — эффект «там что-то мигнуло» */
export function StormFlash() {
  return <div aria-hidden="true" className="storm" />;
}

/** Капли крови на границе секций. Позиции заданы константами — без гидрации. */
const DRIPS = [
  { left: 7, height: 18, width: 2, delay: 0 },
  { left: 14, height: 30, width: 3, delay: 1.6 },
  { left: 23, height: 12, width: 2, delay: 3.1 },
  { left: 38, height: 24, width: 2, delay: 0.8 },
  { left: 52, height: 15, width: 3, delay: 2.4 },
  { left: 64, height: 28, width: 2, delay: 4.2 },
  { left: 71, height: 11, width: 2, delay: 1.2 },
  { left: 83, height: 21, width: 3, delay: 3.6 },
  { left: 94, height: 14, width: 2, delay: 2.9 },
];

export function BloodDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("blood-drip", className)}>
      {DRIPS.map((drip) => (
        <span
          key={drip.left}
          style={{
            left: `${drip.left}%`,
            height: `${drip.height}px`,
            width: `${drip.width}px`,
            animationDelay: `${drip.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Пара глаз, которая на секунду открывается в темноте секции.
 * Живёт в стороне от текста и кнопок: пугает, но не мешает читать.
 */
export function EyesWatch({
  className,
  size = "1rem",
  side = "right",
}: {
  className?: string;
  size?: string;
  side?: "left" | "right";
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "eyes-watch",
        side === "left" ? "left-[8%]" : "right-[8%]",
        className,
      )}
      style={{ fontSize: size, animationDelay: `${side === "left" ? 6 : 0}s` }}
    >
      <span />
      <span />
    </div>
  );
}

/** Тонкая линия, медленно ползущая вниз по секции — ощущение «спуска» */
export function CreepLine() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="creep-line" />
    </div>
  );
}

/** Мигающая надпись-шёпот: появляется на мгновение и гаснет */
export function Whisper({ children, className }: { children: string; className?: string }) {
  return (
    <p
      aria-hidden="true"
      className={cn(
        "whisper pointer-events-none font-mono text-[10px] uppercase tracking-[0.36em] text-crimson",
        className,
      )}
    >
      {children}
    </p>
  );
}
