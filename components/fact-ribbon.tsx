import { SOCIAL_PROOF } from "@/lib/content";
import { REVIEW_HIGHLIGHTS } from "@/lib/reviews";

/**
 * Бегущая строка с реальными фактами площадки и цитатами из настоящих отзывов.
 * Работает как «социальное доказательство на ходу» между секциями.
 */
export function FactRibbon() {
  const facts = SOCIAL_PROOF.facts.map((fact) => `${fact.value} ${fact.unit} — ${fact.label}`);
  const quotes = REVIEW_HIGHLIGHTS.map((quote) => `«${quote}»`);
  const items = [...quotes, ...facts];

  return (
    <div className="relative border-y border-bone/10 bg-charcoal/80 py-3.5" aria-hidden="true">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent" />
      <div className="marquee-track">
        {[0, 1].map((pass) => (
          <div key={pass} className="flex shrink-0 items-center">
            {items.map((item, index) => (
              <span
                key={`${pass}-${item}-${index}`}
                className={`flex shrink-0 items-center gap-4 px-5 font-mono text-[11px] uppercase tracking-[0.22em] ${
                  index < quotes.length ? "text-bone-dim" : "text-crimson"
                }`}
              >
                {item}
                <span className="text-dust">◆</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      {/* Тот же текст — для скринридеров, бегущая строка им недоступна */}
      <p className="sr-only">
        {items.join(". ")}
      </p>
    </div>
  );
}
