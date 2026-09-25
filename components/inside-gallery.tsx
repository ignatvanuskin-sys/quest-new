"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { INSIDE_SHOTS } from "@/lib/content";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { useSwipe } from "@/components/use-swipe";
import { SectionBackdrop } from "@/components/backdrop";

/**
 * Галерея «изнутри» с полноэкранным просмотром.
 *
 * Клик по кадру открывает модальное окно: это самый «иммерсивный» момент
 * на странице, поэтому здесь есть закрытие по Escape, стрелки для перелистывания,
 * перехват фокуса и блокировка скролла фона. Кадры помечены data-scare —
 * при наведении на них срабатывает редкая вспышка (см. JumpScareLayer).
 */
export function InsideGallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (direction: 1 | -1) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        return (current + direction + INSIDE_SHOTS.length) % INSIDE_SHOTS.length;
      });
    },
    [],
  );

  useEffect(() => {
    if (openIndex === null) return;

    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex, close, step]);

  // Свайп по кадру листает галерею — так же, как в галерее телефона
  const swipe = useSwipe(step);

  const active = openIndex === null ? null : INSIDE_SHOTS[openIndex];

  return (
    <section
      id="inside-photos"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-charcoal/40 py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/tex-concrete.jpg" opacity={0.12} position="top" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="Изнутри"
            title={
              <>
                Кадры, снятые <span className="text-crimson">внутри</span>
              </>
            }
            lead="Так выглядят локации, когда свет уже выключили. Нажмите на кадр — откроется на весь экран. Дальше решайте сами, готовы ли увидеть это вживую."
          />
        </Reveal>

        <div className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {INSIDE_SHOTS.map((shot, index) => {
            const placeholder = IMAGE_PLACEHOLDERS[shot.image.replace("/images/", "").replace(".jpg", "")];
            return (
              <Reveal key={shot.id} delay={((index % 3) as 0 | 1 | 2)} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  data-cursor="[ ОТКРЫТЬ ]"
                  data-scare
                  aria-label={`Открыть кадр: ${shot.caption}`}
                  className="card-horror fx-aberration group relative block w-[80vw] snap-start overflow-hidden text-left sm:w-[440px]"
                >
                  <span className="relative block aspect-[3/2]">
                    <Image
                      src={shot.image}
                      alt={shot.imageAlt}
                      fill
                      sizes="(max-width: 640px) 80vw, 440px"
                      placeholder={placeholder ? "blur" : "empty"}
                      blurDataURL={placeholder}
                      className="object-cover brightness-[0.62] contrast-[1.1] transition-all duration-700 group-hover:brightness-[0.85] group-hover:contrast-[1.24] group-hover:saturate-[0.75]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                  </span>

                  <span className="absolute inset-x-0 bottom-0 block p-4">
                    <span className="block font-display text-lg uppercase leading-tight tracking-[0.04em] text-bone">
                      {shot.caption}
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-bone-dim">{shot.note}</span>
                  </span>

                  <span className="hover-only absolute right-3 top-3 flex h-11 w-11 items-center justify-center border border-bone/25 bg-ink/70 text-bone-dim opacity-0 backdrop-blur transition-opacity duration-500 group-hover:opacity-100">
                    <Expand className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
          Свайп или прокрутка → ещё {INSIDE_SHOTS.length} кадров
        </p>
      </div>

      <AnimatePresence>
        {active ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={active.caption}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[85] flex touch-pan-y flex-col overscroll-contain bg-ink/97 backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-4 border-b border-bone/10 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">
                {String((openIndex ?? 0) + 1).padStart(2, "0")} / {String(INSIDE_SHOTS.length).padStart(2, "0")}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Закрыть просмотр"
                className="flex h-11 w-11 items-center justify-center border border-bone/25 text-bone transition hover:border-crimson/60"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <motion.figure
              key={active.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-4"
              {...swipe}
            >
              <span className="relative block h-[52vh] w-full max-w-4xl sm:h-[62vh]">
                <Image
                  src={active.image}
                  alt={active.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="object-contain"
                />
              </span>
              <figcaption className="max-w-2xl text-center">
                <span className="block font-display text-xl uppercase tracking-[0.06em] text-bone">
                  {active.caption}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-bone-dim">{active.note}</span>
              </figcaption>
            </motion.figure>

            <div className="flex items-center justify-between gap-4 border-t border-bone/10 px-4 py-3">
              <button
                type="button"
                onClick={() => step(-1)}
                className="flex min-h-[44px] items-center gap-2 border border-bone/20 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim transition hover:border-crimson/60 hover:text-bone"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Предыдущий
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="flex min-h-[44px] items-center gap-2 border border-bone/20 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim transition hover:border-crimson/60 hover:text-bone"
              >
                Следующий
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
