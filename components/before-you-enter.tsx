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
            lead="Восемь пунктов, после которых не остаётся вопросов: во что одеться, с какого возраста, что делать, если страшно, и как отменить бронь без потерь."
          />
        </Reveal>

        {/* Восемь карточек — это длинная стена текста; на телефоне показываем
            четыре главные, остальные открываются по желанию. Правила никуда
            не исчезают: они просто не пугают объёмом до того, как человек
            вообще решил бронировать. */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              Ещё {BEFORE_YOU_ENTER.length - 4} правил: одежда, безопасность, оплата
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
