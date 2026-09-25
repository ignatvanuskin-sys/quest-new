import Image from "next/image";
import Link from "next/link";
import { Clock, MessageCircle, Phone, Ticket } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import { Reveal } from "@/components/reveal";
import { FogLayer, EyesWatch } from "@/components/scenery";
import { SectionBackdrop } from "@/components/backdrop";

/**
 * Финальный экран: почти чёрный, одна фраза, одно действие.
 * Свет из-под двери «дышит» — это единственная анимация здесь,
 * и она не мешает нажать кнопку.
 */
export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden border-t border-bone/8 bg-ink">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <Image
          src="/images/door-final.jpg"
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={IMAGE_PLACEHOLDERS["door-final"]}
          className="object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-ink/72" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(176,18,27,0.18),transparent_60%)] animate-[breathe_7s_ease-in-out_infinite]" />
      </div>

      <FogLayer />
      <EyesWatch side="right" className="top-[24%]" size="1.15rem" />
      <EyesWatch side="left" className="bottom-[26%]" size="0.9rem" />

      {/* Тот же язык, что и в остальных секциях: поверх кадра двери лежит
          фактура бетона, и финальный экран не выглядит отдельным сайтом */}
      <SectionBackdrop image="/images/tex-concrete.jpg" opacity={0.1} position="bottom" />

      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-crimson">
            {BUSINESS.workingHours}
          </p>
        </Reveal>

        <Reveal delay={1}>
          <h2 className="mt-6 font-display text-[clamp(2.4rem,11vw,6.4rem)] uppercase leading-[0.88] tracking-[-0.01em] text-bone animate-[flicker_9s_infinite_steps(1,end)]">
            Ты готов войти?
          </h2>
        </Reveal>

        <Reveal delay={2}>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-bone-dim sm:text-lg">
            Свободные слоты на сегодня видны в форме брони. Выбирайте квест, время и уровень страха — остальное
            сделает команда площадки.
          </p>
        </Reveal>

        <Reveal delay={3}>
          <div className="mt-10 flex w-full flex-col items-center gap-3">
            <Link
              href="/booking"
              data-cursor="[ ЗАБРОНИРОВАТЬ ]"
              className="btn-blood beam-border flex w-full max-w-sm items-center justify-center gap-3 px-8 py-5 font-display text-lg uppercase tracking-[0.16em] sm:text-xl"
            >
              <Ticket className="h-5 w-5" aria-hidden="true" />
              Забронировать ночь
            </Link>

            <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
              <a
                href={BUSINESS.whatsapp}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn-ghost flex flex-1 items-center justify-center gap-2 px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em]"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                WhatsApp
              </a>
              <a
                href={`tel:${BUSINESS.phone}`}
                className="btn-ghost flex flex-1 items-center justify-center gap-2 px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Позвонить
              </a>
            </div>

            <p className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {BUSINESS.prepaymentNote}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
