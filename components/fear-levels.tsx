import { Hand, HandHeart, ShieldOff, Volume2 } from "lucide-react";
import { FEAR_MODES } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { SectionBackdrop } from "@/components/backdrop";

const ICONS = {
  "no-actors": Volume2,
  light: ShieldOff,
  medium: HandHeart,
  hard: Hand,
} as const;

/**
 * Реальная фишка площадки: четыре уровня страха, которые команда выбирает сама.
 * Это не маркетинговая выдумка — так работает заведение, поэтому и продаём честно.
 */
export function FearLevels() {
  return (
    <section className="relative isolate overflow-hidden border-t border-bone/8 bg-charcoal/40 py-16 sm:py-24">
      <SectionBackdrop image="/images/tex-tiles.jpg" opacity={0.12} />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="Уровень страха"
            title={
              <>
                Насколько жутко — <span className="text-crimson">решаете вы</span>
              </>
            }
            lead="Один и тот же сценарий можно пройти как мистический детектив или как полный контакт с актёрами. Уровень выбирается при бронировании и подтверждается всей командой."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FEAR_MODES.map((mode, index) => {
            const Icon = ICONS[mode.id];
            const intensity = (index + 1) * 2.5;
            return (
              <Reveal key={mode.id} delay={(index % 4) as 0 | 1 | 2 | 3}>
                <article className="card-horror beam-border h-full p-5">
                  <div className="flex items-center justify-between">
                    <Icon
                      className={`h-6 w-6 ${index >= 2 ? "text-crimson" : "text-bone-dim"}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">
                      0{index + 1}
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-2xl uppercase tracking-[0.04em] text-bone">
                    {mode.name}
                  </h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-crimson">
                    {mode.contact}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-bone-dim">{mode.note}</p>

                  <div className="mt-5 flex items-center justify-between border-t border-bone/8 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
                    <span>с {mode.minAge} лет</span>
                    <span className="flex gap-[3px]" aria-hidden="true">
                      {Array.from({ length: 4 }).map((_, barIndex) => (
                        <span
                          key={barIndex}
                          className={`h-3 w-1.5 ${
                            barIndex <= index ? "bg-crimson" : "bg-steel/60"
                          }`}
                        />
                      ))}
                    </span>
                    <span className="sr-only">Интенсивность {intensity} из 10</span>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={2}>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-ash-text">
            У каждой команды есть стоп-слово. Если участнику станет плохо, администратор немедленно выводит его
            из локации — без вопросов и объяснений. Игра продолжится для остальных.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
