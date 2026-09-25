import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import { cn } from "@/lib/utils";
import { FogLayer } from "@/components/scenery";

/* ───────────────────────────────────────────────────────────────────────────
   ФОНОВЫЕ КАДРЫ

   Задача — чтобы человек не читал «страницу на чёрном фоне», а ощущал, что
   находится внутри помещения. Поэтому под каждой ключевой секцией лежит
   настоящий кадр локации.

   Как это сделано безопасно для читаемости:
   • картинка идёт с непрозрачностью 10–22 % поверх цвета секции, то есть
     фон остаётся очень тёмным, а контраст текста сохраняется (проверено
     замерами — см. AUDIT.md);
   • поверх картинки лежит «затемняющий» градиент к цвету фона, чтобы края
     секции сливались с соседними и не было видно границ кадра;
   • картинка уходит на -z-10 внутри секции с `isolate`, поэтому она
     гарантированно ниже контента и никогда не перехватывает клики.
   ─────────────────────────────────────────────────────────────────────────── */

const IMAGE_OPACITY = 0.16;

export function SectionBackdrop({
  image,
  opacity = IMAGE_OPACITY,
  position = "center",
  className,
}: {
  /** Путь к файлу в /public/images */
  image: string;
  /** Непрозрачность 0–1: чем выше, тем сильнее читается помещение */
  opacity?: number;
  position?: "center" | "top" | "bottom";
  className?: string;
}) {
  const key = image.replace("/images/", "").replace(".jpg", "");
  const placeholder = IMAGE_PLACEHOLDERS[key];

  return (
    <div aria-hidden="true" className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <Image
        src={image}
        alt=""
        fill
        sizes="100vw"
        placeholder={placeholder ? "blur" : "empty"}
        blurDataURL={placeholder}
        style={{ opacity }}
        className={cn(
          "object-cover",
          position === "top" && "object-top",
          position === "bottom" && "object-bottom",
          // Немного размытия: фон не должен спорить с текстом за внимание
          "scale-105 blur-[1px]",
        )}
      />
      {/* Края растворяются в цвете страницы — секция выглядит как продолжение темноты */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/62 to-ink" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-transparent to-ink/75" />
    </div>
  );
}

/**
 * Атмосферная «полоса» между секциями: кадр во всю ширину, короткая фраза
 * и (необязательно) кнопка. Даёт эмоциональную паузу и передышку перед
 * следующим блоком — на таком экране человек как раз решает, идти ли дальше.
 */
export function BackdropBand({
  image,
  kicker,
  quote,
  note,
  ctaHref,
  ctaLabel,
  height = "tall",
}: {
  image: string;
  kicker?: string;
  quote: string;
  note?: string;
  ctaHref?: string;
  ctaLabel?: string;
  height?: "tall" | "short";
}) {
  const key = image.replace("/images/", "").replace(".jpg", "");
  const placeholder = IMAGE_PLACEHOLDERS[key];

  return (
    <section
      aria-label={kicker ?? "Атмосфера"}
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden border-y border-bone/8 bg-ink",
        height === "tall" ? "min-h-[62svh] py-20 sm:min-h-[70svh]" : "min-h-[42svh] py-14",
      )}
    >
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <Image
          src={image}
          alt=""
          fill
          sizes="100vw"
          placeholder={placeholder ? "blur" : "empty"}
          blurDataURL={placeholder}
          className="object-cover brightness-[0.72] contrast-[1.08] saturate-[0.85]"
        />
        {/* Двойной скрим: сверху/снизу для стыка с секциями, в центре — под текст */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/72 to-ink" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,0,0,0.62),rgba(0,0,0,0.86))]" />
      </div>

      <FogLayer />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-6">
        {kicker ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-crimson">{kicker}</p>
        ) : null}

        <p className="mt-5 font-display text-[clamp(1.5rem,6.4vw,3.1rem)] uppercase leading-[1.02] tracking-tight text-bone">
          {quote}
        </p>

        {note ? (
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">{note}</p>
        ) : null}

        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            data-cursor="[ ДАЛЬШЕ ]"
            className="btn-ghost mt-8 inline-flex min-h-[48px] items-center gap-3 px-7 py-3.5 font-display text-sm uppercase tracking-[0.16em]"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
