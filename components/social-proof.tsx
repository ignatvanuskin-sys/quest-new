import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { BUSINESS, SOCIAL_PROOF } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { StatPill } from "@/components/ui";
import { SectionBackdrop } from "@/components/backdrop";

/**
 * Социальное доказательство без обмана: показываем только те цифры,
 * которые можно проверить на площадке, и даём ссылки на источники.
 */
export function SocialProof() {
  return (
    <section className="relative isolate overflow-hidden border-t border-bone/8 bg-charcoal/40 py-14 sm:py-20">
      <SectionBackdrop image="/images/tex-concrete.jpg" opacity={0.11} />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <Reveal>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-crimson">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Проверяемые цифры
              </div>
              <h2 className="mt-5 font-display text-[clamp(1.7rem,5.4vw,3.2rem)] uppercase leading-[0.98] tracking-tight text-bone">
                Ни одной цифры «из головы»
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-bone-dim">
                Площадка существует в Алматы не первый год, играет в реальном бомбоубежище и собирает команды
                от 2 до 15 человек. Всё, что вы видите на этой странице, можно проверить — ссылки на источники
                ниже.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {SOCIAL_PROOF.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    data-cursor="[ ОТКРЫТЬ ]"
                    className="inline-flex min-h-[44px] items-center gap-2 border border-bone/15 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim transition hover:border-crimson/60 hover:text-bone"
                  >
                    {source.label}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ))}
              </div>

              <p className="mt-6 max-w-xl text-xs leading-relaxed text-ash-text">
                Мы намеренно не показываем счётчики вида «10 000 игроков» и не запускаем таймеры «осталось 2
                минуты»: страх должен быть в локации, а не в интерфейсе.
              </p>
            </div>
          </Reveal>

          <Reveal delay={1}>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {SOCIAL_PROOF.facts.map((fact) => (
                  <StatPill key={fact.label} value={fact.value} unit={fact.unit} label={fact.label} />
                ))}
              </div>

              <div className="border border-crimson/35 bg-blood-deep/20 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-crimson">Рейтинг площадки</p>
                <p className="mt-2 font-display text-4xl leading-none text-bone">
                  {BUSINESS.rating}
                  <span className="ml-2 font-mono text-sm text-ash-text">/ {BUSINESS.ratingScale}</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-bone-dim">
                  Оценка по отзывам игроков с официального сайта заведения.
                </p>
                <Link
                  href="/booking"
                  data-cursor="[ ЗАБРОНИРОВАТЬ ]"
                  className="btn-blood mt-5 inline-flex px-5 py-3 font-display text-sm uppercase tracking-[0.16em]"
                >
                  Проверить на себе
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
