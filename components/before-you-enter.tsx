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
import { BEFORE_YOU_ENTER } from "@/lib/content";
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
            lead="Восемь пунктов, после которых не остаётся вопросов: во что одеться, с какого возраста, что делать, если страшно, и как отменить бронь без потерь."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {BEFORE_YOU_ENTER.map((item, index) => {
            const Icon = ICONS[item.icon] ?? ShieldAlert;
            return (
              <Reveal key={item.title} delay={((index % 4) as 0 | 1 | 2 | 3)}>
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
          })}
        </div>
      </div>
    </section>
  );
}
