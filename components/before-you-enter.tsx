import {
  Baby,
  Ban,
  Clock,
  CreditCard,
  HeartPulse,
  ShieldAlert,
  Shirt,
  Users,
} from "lucide-react";
import { BEFORE_YOU_ENTER, CONTRAINDICATIONS } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { SectionBackdrop } from "@/components/backdrop";

const ICONS: Record<string, typeof Clock> = {
  clock: Clock,
  users: Users,
  shirt: Shirt,
  "heart-pulse": HeartPulse,
  "shield-alert": ShieldAlert,
  baby: Baby,
  ban: Ban,
  "credit-card": CreditCard,
};

/** Карточка одного правила — общая для видимой части списка и для раскрытой */
function RuleCard({
  item,
  index,
}: {
  item: { icon: string; title: string; text: string };
  index: number;
}) {
  const Icon = ICONS[item.icon] ?? ShieldAlert;

  return (
    <Reveal delay={((index % 4) as 0 | 1 | 2 | 3)}>
      <article className="card-horror h-full p-5">
        <Icon
          className={`h-5 w-5 ${index === 4 || index === 7 ? "text-crimson" : "text-bone-dim"}`}
          aria-hidden="true"
        />
        <h3 className="mt-4 font-display text-lg uppercase leading-tight tracking-[0.04em] text-bone">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-bone-dim">{item.text}</p>
      </article>
    </Reveal>
  );
}

/**
 * «Перед входом» снимает возражения до оплаты: возраст, опоздания, одежда,
 * безопасность, стоп-слово и предоплата. Это не медицинская памятка —
 * это честные правила, написанные человеческим языком.
 */
export function BeforeYouEnter() {
  return (
    <section
      id="before"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-charcoal/40 py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/tex-rust.jpg" opacity={0.12} />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="Перед входом"
            title={
              <>
                Что нужно знать <span className="text-crimson">заранее</span>
              </>
            }
            lead="Противопоказания — сразу и без клика. Остальные семь пунктов: во что одеться, с какого возраста, что делать, если страшно, и как отменить бронь без потерь."
          />
        </Reveal>

        {/* Противопоказания — всегда открыты и идут ПЕРЕД остальными правилами.
            Это осознанное решение, а не компоновка: человек должен узнать
            о них до оплаты, а не после. Поэтому блок не прячется в
            аккордеон и стоит первым — раньше он был седьмым пунктом
            внутри «Ещё 3 правила», то есть требовал клика. */}
        <Reveal>
          <div className="mt-12 border border-crimson/40 bg-blood-deep/20 p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <Ban className="mt-1 h-6 w-6 shrink-0 text-crimson" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="font-display text-xl uppercase tracking-[0.06em] text-bone sm:text-2xl">
                  {CONTRAINDICATIONS.title}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-bone-dim sm:text-base">
                  {CONTRAINDICATIONS.text}
                </p>

                <ul className="mt-5 flex flex-wrap gap-2">
                  {CONTRAINDICATIONS.items.map((item) => (
                    <li
                      key={item}
                      className="border border-crimson/30 bg-ink/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-bone-dim"
                    >
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-bone-dim">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
                  {CONTRAINDICATIONS.advice}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Остальные семь правил — длинная стена текста; на телефоне показываем
            четыре главные, остальные открываются по желанию. Здесь прятать
            безопасно: цена ошибки в одежде или опоздании нулевая, в отличие
            от противопоказаний выше. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {BEFORE_YOU_ENTER.slice(0, 4).map((item, index) => (
            <RuleCard key={item.title} item={item} index={index} />
          ))}
        </div>

        <details className="group mt-4">
          <summary
            data-cursor="[ ОТКРЫТЬ ]"
            className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 border border-bone/12 bg-charcoal/50 px-5 py-4 transition hover:border-crimson/50 [&::-webkit-details-marker]:hidden"
          >
            <span className="font-display text-sm uppercase tracking-[0.1em] text-bone">
              Ещё {BEFORE_YOU_ENTER.length - 4} правил: безопасность, возраст, оплата
            </span>
            <span aria-hidden="true" className="font-mono text-[10px] uppercase tracking-[0.2em] text-crimson">
              показать
            </span>
          </summary>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {BEFORE_YOU_ENTER.slice(4).map((item, index) => (
              <RuleCard key={item.title} item={item} index={index + 4} />
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
