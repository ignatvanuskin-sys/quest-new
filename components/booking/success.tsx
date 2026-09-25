"use client";

import Link from "next/link";
import { Check, MessageCircle, Phone } from "lucide-react";
import { BUSINESS, getFearMode, getLocation, getQuest } from "@/lib/content";
import type { BookingRecord } from "@/lib/types";
import { formatHumanDate, formatKzt, pluralPlayers } from "@/lib/utils";

/**
 * Экран успеха. Свет становится спокойнее: после брони напряжение не нужно,
 * человек должен почувствовать, что всё под контролем и заявка не потеряется.
 */
export function BookingSuccess({ booking }: { booking: BookingRecord }) {
  const quest = getQuest(booking.questSlug);
  const location = quest ? getLocation(quest.locationId) : null;
  const mode = getFearMode(booking.fearMode);

  return (
    <div className="relative border border-crimson/30 bg-gradient-to-b from-blood-deep/25 via-charcoal to-charcoal p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(230,225,216,0.08),transparent_60%)]" aria-hidden="true" />

      <div className="relative">
        <span className="flex h-12 w-12 items-center justify-center border border-bone/30 bg-ink/60">
          <Check className="h-6 w-6 text-bone" aria-hidden="true" />
        </span>

        <h2 className="mt-6 font-display text-[clamp(1.8rem,6vw,3rem)] uppercase leading-none tracking-tight text-bone">
          Заявка принята
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
          Номер брони <span className="font-mono text-bone">{booking.id}</span>. Мы сохранили её и передали
          администратору. {BUSINESS.prepaymentNote}
        </p>

        <dl className="mt-7 grid gap-x-6 gap-y-4 border-y border-bone/10 py-5 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Квест</dt>
            <dd className="mt-1 text-bone">{quest?.title}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Когда</dt>
            <dd className="mt-1 text-bone">
              {formatHumanDate(booking.dateISO)}, {booking.time}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Команда</dt>
            <dd className="mt-1 text-bone">{pluralPlayers(booking.players)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Уровень страха</dt>
            <dd className="mt-1 text-bone">
              {mode.name} <span className="text-ash-text">({mode.contact})</span>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Адрес</dt>
            <dd className="mt-1 text-bone">
              {location?.address}
              <span className="block text-xs text-ash-text">{location?.label}</span>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">Итого</dt>
            <dd className="mt-1 font-display text-xl text-bone">{formatKzt(booking.total)}</dd>
          </div>
        </dl>

        {booking.extraNames.length > 0 ? (
          <p className="mt-4 text-sm text-bone-dim">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">Дополнительно: </span>
            {booking.extraNames.join(", ")}
          </p>
        ) : null}

        <div className="mt-7 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-crimson">Что дальше</p>
          <ol className="space-y-2.5 text-sm leading-relaxed text-bone-dim">
            <li>1. Администратор свяжется с вами для подтверждения и предоплаты.</li>
            <li>2. Приходите за 15 минут до старта — проверим команду и проведём инструктаж.</li>
            <li>3. Если планы изменятся, отмените бронь не позднее чем за 24 часа — перенесём дату.</li>
          </ol>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a
            href={`${BUSINESS.whatsapp}?text=${encodeURIComponent(
              `Здравствуйте! Бронь ${booking.id} на ${formatHumanDate(booking.dateISO)} в ${booking.time}, квест «${quest?.title}», ${pluralPlayers(booking.players)}.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-blood flex flex-1 items-center justify-center gap-2 px-6 py-4 font-display text-sm uppercase tracking-[0.16em]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Подтвердить в WhatsApp
          </a>
          <a
            href={`tel:${BUSINESS.phone}`}
            className="btn-ghost flex flex-1 items-center justify-center gap-2 px-6 py-4 font-mono text-[11px] uppercase tracking-[0.18em]"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {BUSINESS.phonePretty}
          </a>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text underline decoration-crimson/50 underline-offset-4 hover:text-bone"
          >
            Вернуться на главную
          </Link>
          <Link
            href="/#quests"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text underline decoration-crimson/50 underline-offset-4 hover:text-bone"
          >
            Посмотреть другие квесты
          </Link>
        </div>
      </div>
    </div>
  );
}
