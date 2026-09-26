import { Car, ExternalLink, MapPin, Navigation, Phone } from "lucide-react";
import { BUSINESS, LOCATIONS } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { SectionBackdrop } from "@/components/backdrop";

/** Стилизованная схема входа — рисуем сами, без внешних карт и трекеров */
function EntranceScheme({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 260 140" role="img" aria-label={`Схема входа: ${label}`} className="h-auto w-full">
      <rect x="1" y="1" width="258" height="138" fill="none" stroke="#26262e" />
      {/* Подписи сделаны светлее и крупнее: в мелком кегле тонкие штрихи SVG
          «съедаются» при масштабировании и контраст падает ниже нормы */}
      <rect x="30" y="24" width="150" height="92" fill="#0b0b0f" stroke="#6b665f" />
      <text x="42" y="18" fill="#b3aea6" fontSize="11" fontFamily="monospace" letterSpacing="2">
        ЗДАНИЕ
      </text>
      <rect x="176" y="58" width="18" height="26" fill="#470a0e" stroke="#e0626b" />
      <text x="202" y="74" fill="#e6e1d8" fontSize="11" fontFamily="monospace" letterSpacing="1.5">
        ВХОД
      </text>
      <path d="M244 88 L214 88 L214 82 L200 90 L214 98 L214 92 L244 92 Z" fill="#e0626b" />
      <text x="30" y="133" fill="#b3aea6" fontSize="10" fontFamily="monospace" letterSpacing="1.5">
        СПУСК ВНИЗ · ЖДИТЕ АДМИНИСТРАТОРА
      </text>
      <circle cx="185" cy="71" r="2.5" fill="#e6e1d8" />
    </svg>
  );
}

export function LocationSection() {
  return (
    <section
      id="contacts"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-charcoal/40 py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/band-stairs.jpg" opacity={0.2} position="top" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="Как добраться"
            title={
              <>
                Два филиала <span className="text-crimson">в Алматы</span>
              </>
            }
            lead="Оба адреса — действующие площадки заведения. У входа звоните администратору: вас встретят, проведут инструктаж и только потом впустят в локацию."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {LOCATIONS.map((location, index) => (
            <Reveal key={location.id} delay={(index % 2) as 0 | 1}>
              <article className="card-horror h-full p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl uppercase leading-tight tracking-[0.04em] text-bone">
                      {location.label}
                    </h3>
                    <p className="mt-2 flex items-center gap-2 text-base text-bone-dim">
                      <MapPin className="h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
                      {location.city}, {location.address}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
                    0{index + 1}
                  </span>
                </div>

                <div className="mt-5">
                  <EntranceScheme label={location.label} />
                </div>

                <dl className="mt-5 space-y-4 border-t border-bone/8 pt-5">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
                      Как найти вход
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-bone-dim">{location.entrance}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
                      <Car className="h-3.5 w-3.5" aria-hidden="true" />
                      Парковка
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-bone-dim">{location.parking}</dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap gap-2">
                  <a
                    href={location.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    data-cursor="[ ОТКРЫТЬ ]"
                    className="btn-ghost inline-flex min-h-[44px] items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em]"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                    Маршрут в 2ГИС
                  </a>
                  <a
                    href={`tel:${BUSINESS.phone}`}
                    className="btn-blood inline-flex min-h-[44px] items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em]"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Позвонить на входе
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={2}>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-bone/10 bg-ink/60 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone-dim">
              Режим работы: <span className="text-bone">{BUSINESS.workingHours}</span>
            </p>
            <a
              href={BUSINESS.instagram}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex min-h-[44px] items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-bone-dim underline decoration-crimson/50 underline-offset-4 hover:text-bone"
            >
              {BUSINESS.instagramHandle}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
