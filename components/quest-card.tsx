import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Users } from "lucide-react";
import { getLocation } from "@/lib/content";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import type { Quest } from "@/lib/types";
import {
  GAME_PRICE_TEAM,
  MIN_GAME_PRICE,
  PER_PERSON_FROM,
  PER_PERSON_PRICE,
} from "@/lib/pricing";
import { formatHumanDate, formatKzt, pluralSlots } from "@/lib/utils";
import { FearMeter } from "@/components/fear-meter";

/**
 * Карточка квеста = отдельный хоррор-экспириенс, а не строка прайса.
 * Ссылка растянута на всю карточку (stretched link), поэтому вложенных
 * ссылок нет — и «Забронировать» остаётся отдельной кликабельной целью.
 */
export function QuestCard({
  quest,
  priority = false,
  teaser,
}: {
  quest: Quest;
  priority?: boolean;
  /** Ближайшее реальное свободное время — честная срочность у точки решения */
  teaser?: { dateISO: string; time: string; seatsLeft: number };
}) {
  const location = getLocation(quest.locationId);
  const placeholder = IMAGE_PLACEHOLDERS[quest.image.replace("/images/", "").replace(".jpg", "")];

  return (
    <article
      className="card-horror beam-border group relative flex flex-col"
      data-emphasis="fear"
    >
      <div className="fx-aberration relative aspect-[3/2] overflow-hidden" data-scare>
        <Image
          src={quest.image}
          alt={quest.imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={priority}
          placeholder={placeholder ? "blur" : "empty"}
          blurDataURL={placeholder}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="border border-bone/20 bg-ink/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-bone-dim backdrop-blur">
            {quest.spec.genre}
          </span>
          <span className="border border-crimson/40 bg-blood-deep/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-bone backdrop-blur">
            {quest.spec.ageMin}+
          </span>
        </div>

        {/* Hover-слой: приглашение войти, а не просто «подробнее».
            На тач-устройствах hover не существует, поэтому класс hover-only
            показывает его сразу — иначе телефонный пользователь его не увидит.
            Подпись на русском: сайт русскоязычный, и английская вставка здесь
            выглядела как недоделка шаблона. */}
        <div className="hover-only absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 opacity-0 transition-all duration-500 group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="font-display text-lg uppercase tracking-[0.14em] text-bone">
            Войти в перформанс
          </span>
          <span className="flex h-9 w-9 items-center justify-center border border-crimson/60 bg-ink/70 text-crimson backdrop-blur">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Заголовок — одновременно и ссылка на сценарий, и крупная тап-цель.
            Собственной высоты у ссылки раньше не было: её размер задавал
            текст заголовка (30 px на мобильном), и палец промахивался мимо
            квеста. Карточка целиком кликабельна через `after`, но у самой
            ссылки теперь есть честные 44 px — так рекомендует WCAG 2.5.8,
            и не приходится целиться в мелкий текст. */}
        <h3 className="font-display text-[clamp(1.25rem,4.4vw,1.7rem)] uppercase leading-tight tracking-tight text-bone">
          <Link
            href={`/quests/${quest.slug}`}
            data-cursor="[ ОТКРЫТЬ ]"
            className="inline-flex min-h-[44px] items-center after:absolute after:inset-0 after:z-10 after:content-['']"
          >
            {quest.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-bone-dim">{quest.tagline}</p>

        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-bone/8 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
          <li className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
            {quest.spec.playersMin}–{quest.spec.playersMax} чел.
          </li>
          <li className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
            {quest.spec.duration} мин
          </li>
          <li className="col-span-2 flex items-start gap-2 normal-case tracking-[0.06em]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" aria-hidden="true" />
            <span className="text-bone-dim">{location.address}</span>
          </li>
        </ul>

        <div className="mt-4 space-y-3">
          <FearMeter value={quest.fear} />
          <FearMeter kind="difficulty" value={quest.difficulty} />
        </div>

        {/* Ближайшее реальное время — самый честный аргумент «почему сейчас».
            Данные приходят с сервера из подтверждённых броней. */}
        {teaser ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border border-crimson/30 bg-blood-deep/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-dim">
            <span className="text-crimson">ближайшее</span>
            {formatHumanDate(teaser.dateISO)}, {teaser.time}
            <span className="text-bone">· {pluralSlots(teaser.seatsLeft)}</span>
          </p>
        ) : null}

        <div className="mt-5 flex items-end justify-between gap-3 pt-1">
          {/* Оба реальных числа сразу: цена за игру целиком и тариф за человека.
              Раньше было только «от 3 500 ₸», и человек, придя в форму с командой
              из трёх человек, видел 15 000 ₸ — это читалось как обман. */}
          <div>
            <p className="font-display text-xl leading-none text-bone">{formatKzt(MIN_GAME_PRICE)}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
              за игру · {GAME_PRICE_TEAM}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-crimson">
              от {formatKzt(PER_PERSON_PRICE)} с человека от {PER_PERSON_FROM} чел.
            </p>
          </div>
          <Link
            href={`/booking?quest=${quest.slug}`}
            data-cursor="[ ЗАБРОНИРОВАТЬ ]"
            className="btn-blood relative z-20 inline-flex min-h-[44px] items-center px-4 py-3 font-display text-xs uppercase tracking-[0.16em]"
          >
            {/* «Выбрать время» вместо «Забронировать»: меньше обязательства
                на шаге знакомства с квестом, а действие — то же */}
            Выбрать время
          </Link>
        </div>
      </div>
    </article>
  );
}
