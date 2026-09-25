import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────────────────────
   ЛОГОТИП

   Знак: приоткрытая дверь в бетонной раме, слева — щель света, на пороге
   капля. Идея в том, что знак читается и в 16 px (favicon), и в 36 px (шапка):
   узнаваемым остаётся главное — тёмный проём и полоса света.

   Логотип вставлен инлайном, поэтому не тянет лишний запрос, наследует
   currentColor там, где это нужно, и умеет мигать щелью света в такт
   остальной атмосфере сайта.
   ─────────────────────────────────────────────────────────────────────────── */

export function LogoMark({
  className,
  size = 36,
  animated = true,
  title = "Quest Horror Clinic",
}: {
  className?: string;
  size?: number;
  /** Мигание света в щели — визитная карточка знака */
  animated?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="lm-slit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.28" stopColor="#ffe4e0" stopOpacity="0.72" />
          <stop offset="0.62" stopColor="#e0626b" stopOpacity="0.26" />
          <stop offset="1" stopColor="#e0626b" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lm-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e0626b" stopOpacity="0.62" />
          <stop offset="0.55" stopColor="#8b1419" stopOpacity="0.24" />
          <stop offset="1" stopColor="#8b1419" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lm-door" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#15151a" />
          <stop offset="1" stopColor="#07070a" />
        </linearGradient>
        <clipPath id="lm-frame">
          <path d="M27 15h45v64H27z" />
        </clipPath>
      </defs>

      <rect x="1.5" y="1.5" width="93" height="93" rx="10" fill="#07070a" />
      <rect
        x="1.5"
        y="1.5"
        width="93"
        height="93"
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.16"
      />

      <g clipPath="url(#lm-frame)">
        <rect x="27" y="15" width="45" height="64" fill="#000" />
        <ellipse cx="34" cy="44" rx="30" ry="34" fill="url(#lm-glow)" />

        {/* створка двери, приоткрытая внутрь */}
        <path d="M50 17.5 70.5 22v50.5L50 76.5z" fill="url(#lm-door)" />
        <path
          d="M50 17.5 70.5 22v50.5L50 76.5z"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="0.8"
        />
        <circle cx="65.5" cy="48" r="1.9" fill="currentColor" fillOpacity="0.55" />

        {/* щель света */}
        <rect
          x="29.5"
          y="15"
          width="3.6"
          height="64"
          fill="url(#lm-slit)"
          className={animated ? "animate-[flicker_9s_infinite_steps(1,end)]" : undefined}
        />
        <rect x="29.5" y="15" width="1.1" height="64" fill="#ffffff" fillOpacity="0.9" />
      </g>

      {/* свет на пороге */}
      <rect x="27" y="79" width="45" height="3.2" fill="#f4e8e4" fillOpacity="0.12" />
      <path d="M27 15h45" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
      <path d="M31 79.2v5.4c0 .9 1.5.9 1.5 0v-5.4z" fill="#e0626b" fillOpacity="0.9" />
    </svg>
  );
}

/** Горизонтальный лок-ап: знак + название. Используется в шапке и подвале. */
export function LogoLockup({
  className,
  size = 44,
  subtitle = "Алматы · хоррор-перформансы · 11+",
}: {
  className?: string;
  size?: number;
  subtitle?: string;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark size={size} />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-display text-[clamp(0.95rem,3.6vw,1.15rem)] uppercase tracking-[0.14em] text-bone">
          Quest <span className="text-crimson">Horror</span> Clinic
        </span>
        <span className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.24em] text-bone-dim sm:block">
          {subtitle}
        </span>
      </span>
    </span>
  );
}
