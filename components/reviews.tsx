"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { BUSINESS, SOCIAL_PROOF } from "@/lib/content";
import { REVIEWS } from "@/lib/reviews";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { pluralReviews } from "@/lib/utils";
import { SectionBackdrop } from "@/components/backdrop";

/**
 * Отзывы — только настоящие: тексты взяты из публичных отзывов на официальном
 * сайте площадки, имена сокращены. Ни один отзыв здесь не выдуман.
 * Рядом всегда есть ссылки на источники, где слова игроков можно проверить.
 */
export function Reviews() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: true });

  const update = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    setCanScroll({
      left: node.scrollLeft > 12,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 12,
    });
  }, []);

  useEffect(() => {
    update();
    const node = trackRef.current;
    if (!node) return;
    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollBy = (direction: 1 | -1) => {
    const node = trackRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.min(node.clientWidth * 0.85, 460), behavior: "smooth" });
  };

  return (
    <section
      id="reviews"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-ink py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/tex-tiles.jpg" opacity={0.11} position="bottom" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <SectionHeading
              eyebrow="Отзывы"
              title={
                <>
                  Что говорят <span className="text-crimson">после игры</span>
                </>
              }
              lead="Мы не сочиняем отзывы и не покупаем рейтинг. Ниже — настоящие отзывы игроков с официального сайта площадки, включая один с замечанием: он честнее двадцати восторженных."
            />
          </Reveal>

          <Reveal delay={1}>
            <div className="flex items-center gap-4 border border-bone/12 bg-charcoal/60 px-5 py-4">
              <div className="text-center">
                <p className="font-display text-4xl leading-none text-bone">{BUSINESS.rating}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
                  из {BUSINESS.ratingScale}
                </p>
              </div>
              <div className="h-12 w-px bg-bone/15" aria-hidden="true" />
              <div>
                <div className="flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-crimson text-crimson" />
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-dim">
                  {pluralReviews(SOCIAL_PROOF.reviewCount)}
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="relative mt-10">
          <div
            ref={trackRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
            role="list"
            aria-label="Отзывы игроков"
          >
            {REVIEWS.map((review) => (
              <article
                key={review.id}
                role="listitem"
                className="card-horror beam-border w-[85vw] shrink-0 snap-start p-5 sm:w-[420px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <Quote className="h-5 w-5 text-crimson/70" aria-hidden="true" />
                  <div className="flex gap-0.5" aria-label={`Оценка ${review.rating} из 5`}>
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} className="h-3.5 w-3.5 fill-crimson text-crimson" aria-hidden="true" />
                    ))}
                  </div>
                </div>

                <blockquote className="mt-4 text-[15px] leading-relaxed text-bone">
                  «{review.text}»
                </blockquote>

                <footer className="mt-5 flex items-center justify-between gap-3 border-t border-bone/8 pt-4">
                  <div>
                    <p className="font-display text-sm uppercase tracking-[0.1em] text-bone-dim">
                      {review.author}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text">
                      {review.quest} · {review.date}
                    </p>
                  </div>
                  <a
                    href={SOCIAL_PROOF.sources[0].url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-block py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text underline decoration-crimson/40 underline-offset-4 transition hover:text-bone"
                  >
                    источник
                  </a>
                </footer>
              </article>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
              Свайп или стрелки →
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={!canScroll.left}
                aria-label="Предыдущие отзывы"
                className="flex h-11 w-11 items-center justify-center border border-bone/20 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={!canScroll.right}
                aria-label="Следующие отзывы"
                className="flex h-11 w-11 items-center justify-center border border-bone/20 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
