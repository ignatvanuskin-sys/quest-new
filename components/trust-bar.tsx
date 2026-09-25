import Link from "next/link";
import { CalendarClock, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { BUSINESS, SOCIAL_PROOF, getLocation } from "@/lib/content";
import { pluralReviews } from "@/lib/utils";
import { Reveal } from "@/components/reveal";

/**
 * Полоса доверия.
 *
 * Задача — ответить на вопросы, которые возникают ровно перед нажатием
 * «забронировать»: это реальное место? где оно? что если планы изменятся?
 * Раньше эти ответы лежали в разных секциях далеко внизу — здесь они
 * собираются в одну строку и ставятся сразу после первого экрана.
 *
 * Все данные реальные: адрес площадки, телефон, оценка с её сайта,
 * правило переноса брони.
 */
export function TrustBar() {
  const location = getLocation("shagabutdinova");

  return (
    <section aria-label="Коротко о площадке" className="border-b border-bone/8 bg-charcoal/60">
      <Reveal>
        <ul className="mx-auto grid max-w-[1400px] gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
          <li className="flex items-start gap-2.5">
            <Star className="mt-0.5 h-4 w-4 shrink-0 fill-crimson text-crimson" aria-hidden="true" />
            <span className="text-xs leading-relaxed text-bone-dim">
              <span className="text-bone">{BUSINESS.rating} / 10</span> — оценка игроков,{" "}
              {pluralReviews(SOCIAL_PROOF.reviewCount)} на официальном сайте
            </span>
          </li>

          <li className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
            <span className="text-xs leading-relaxed text-bone-dim">
              <span className="text-bone">
                {location.city}, {location.address}
              </span>{" "}
              — реальное бомбоубежище, 250 м²
            </span>
          </li>

          <li className="flex items-start gap-2.5">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
            <span className="text-xs leading-relaxed text-bone-dim">
              Отмена и перенос — <span className="text-bone">не позднее чем за 24 часа</span>, без потери
              предоплаты
            </span>
          </li>

          <li className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
            <span className="text-xs leading-relaxed text-bone-dim">
              Стоп-слово работает всегда: администратор выводит из игры сразу
            </span>
          </li>
        </ul>
      </Reveal>

      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 border-t border-bone/8 px-4 py-3 sm:px-6 lg:px-10">
        <a
          href={`tel:${BUSINESS.phone}`}
          className="inline-flex min-h-[40px] items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim transition hover:text-bone"
        >
          <Phone className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
          {BUSINESS.phonePretty}
        </a>
        <a
          href={BUSINESS.instagram}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex min-h-[40px] items-center font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim transition hover:text-bone"
        >
          Фото команд в {BUSINESS.instagramHandle}
        </a>
        <Link
          href="/#reviews"
          className="inline-flex min-h-[40px] items-center font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim transition hover:text-bone"
        >
          Читать отзывы
        </Link>
      </div>
    </section>
  );
}
