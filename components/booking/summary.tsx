"use client";

import { AlertTriangle, Info } from "lucide-react";
import { BUSINESS, getFearMode, getLocation } from "@/lib/content";
import { computePrice } from "@/lib/pricing";
import type { FearModeId, Quest } from "@/lib/types";
import { formatHumanDate, formatKzt, pluralPlayers } from "@/lib/utils";

/**
 * Сводка заказа: цена, состав и предупреждения.
 * Считается тем же кодом, что и на сервере (lib/pricing.ts), поэтому итог
 * в интерфейсе и в заявке не расходятся.
 */
export function BookingSummary({
  quest,
  players,
  fearMode,
  dateISO,
  time,
  extraIds,
  isBirthday,
  compact = false,
}: {
  quest: Quest;
  players: number;
  fearMode: FearModeId;
  dateISO: string | null;
  time: string | null;
  extraIds: string[];
  isBirthday: boolean;
  compact?: boolean;
}) {
  const price = computePrice({ questSlug: quest.slug, players, extraIds, isBirthday });
  const location = getLocation(quest.locationId);
  const mode = getFearMode(fearMode);

  return (
    <aside
      className={`border border-bone/12 bg-charcoal/70 p-5 ${compact ? "" : "lg:sticky lg:top-24"}`}
      aria-label="Ваш заказ"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg uppercase tracking-[0.1em] text-bone">Ваш заказ</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">шаг за шагом</span>
      </div>

      <dl className="mt-5 space-y-3.5 border-y border-bone/8 py-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ash-text">Квест</dt>
          <dd className="text-right text-bone">{quest.title}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ash-text">Локация</dt>
          <dd className="text-right text-bone-dim">{location.address}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ash-text">Игроков</dt>
          <dd className="text-right text-bone">{pluralPlayers(players)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ash-text">Уровень страха</dt>
          <dd className="text-right text-bone">
            {mode.name}
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
              {mode.contact}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ash-text">Дата и время</dt>
          <dd className="text-right text-bone">
            {dateISO ? formatHumanDate(dateISO) : <span className="text-dust">—</span>}
            {time ? <span className="block font-display text-base">{time}</span> : null}
          </dd>
        </div>
        {quest.spec.areaM2 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ash-text">Площадь локации</dt>
            <dd className="text-right text-bone-dim">{quest.spec.areaM2} м²</dd>
          </div>
        ) : null}
      </dl>

      <ul className="mt-4 space-y-2.5 text-sm">
        {price.lines.map((line, index) => (
          <li key={`${line.label}-${index}`} className="flex items-baseline justify-between gap-4">
            <span className="text-bone-dim">
              {line.label}
              {line.note ? (
                <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-ash-text">
                  {line.note}
                </span>
              ) : null}
            </span>
            <span className={`shrink-0 tabular-nums ${line.amount < 0 ? "text-crimson" : "text-bone"}`}>
              {line.amount === 0 ? "0 ₸" : formatKzt(line.amount)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-bone/12 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash-text">Итого к оплате</span>
        <span className="font-display text-2xl text-bone" aria-live="polite">
          {formatKzt(price.total)}
        </span>
      </div>

      {price.requests.length > 0 ? (
        <ul className="mt-4 space-y-2 border border-crimson/30 bg-blood-deep/15 p-3.5">
          {price.requests.map((request) => (
            <li key={request} className="flex gap-2.5 text-xs leading-relaxed text-bone-dim">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" aria-hidden="true" />
              {request}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 flex gap-2.5 text-xs leading-relaxed text-ash-text">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson/70" aria-hidden="true" />
        {BUSINESS.prepaymentNote}
      </p>
    </aside>
  );
}
