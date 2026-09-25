import { MessageCircle, Phone } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { FAQ } from "@/lib/faq";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { SectionBackdrop } from "@/components/backdrop";

/**
 * FAQ собран на нативных <details>: работает без JS, доступен с клавиатуры
 * и корректно читается скринридером. Тот же контент уходит в FAQPage-разметку.
 */
export function Faq() {
  return (
    <section
      id="faq"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-ink py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/tex-concrete.jpg" opacity={0.13} position="bottom" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <SectionHeading
                eyebrow="Вопросы"
                title={
                  <>
                    Отвечаем <span className="text-crimson">прямо</span>
                  </>
                }
                lead="Собрали вопросы, которые чаще всего задают перед первой игрой. Если своего не нашли — напишите в WhatsApp, ответим быстро."
              />

              <div className="mt-8 space-y-3">
                <a
                  href={BUSINESS.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  data-cursor="[ НАПИСАТЬ ]"
                  className="btn-blood flex items-center justify-center gap-3 px-6 py-4 font-display text-sm uppercase tracking-[0.16em]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Задать вопрос в WhatsApp
                </a>
                <a
                  href={`tel:${BUSINESS.phone}`}
                  className="flex items-center justify-center gap-3 border border-bone/20 px-6 py-4 font-mono text-xs tracking-[0.14em] text-bone-dim transition hover:border-crimson/60 hover:text-bone"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {BUSINESS.phonePretty}
                </a>
              </div>
            </div>
          </Reveal>

          <div className="divide-y divide-bone/10 border-y border-bone/10">
            {FAQ.map((item, index) => (
              <details key={item.question} className="group">
                <summary
                  data-cursor="[ ОТКРЫТЬ ]"
                  className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 transition hover:text-crimson [&::-webkit-details-marker]:hidden"
                >
                  <span className="flex items-baseline gap-4">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-ash-text">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-lg uppercase leading-snug tracking-[0.02em] text-bone transition group-hover:text-crimson sm:text-xl">
                      {item.question}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="relative mt-1 flex h-5 w-5 shrink-0 items-center justify-center border border-bone/25 transition group-open:border-crimson/70"
                  >
                    <span className="absolute h-[1px] w-2.5 bg-bone-dim" />
                    <span className="absolute h-2.5 w-[1px] bg-bone-dim transition group-open:scale-y-0" />
                  </span>
                </summary>
                <div className="pb-6 pl-0 sm:pl-9">
                  <p className="max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-[15px]">
                    {item.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
