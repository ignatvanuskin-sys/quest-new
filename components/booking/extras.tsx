"use client";

import { useState } from "react";
import { Camera, FileText, Gift, Minus, Plus, UserPlus, Zap } from "lucide-react";
import { BIRTHDAY_PROMO, EXTRAS, PLAYER_UPSELL, getFearMode } from "@/lib/content";
import type { FearModeId, Quest } from "@/lib/types";
import { formatKzt, pluralPlayers } from "@/lib/utils";

const ICONS: Record<string, typeof Zap> = {
  zap: Zap,
  "file-text": FileText,
  camera: Camera,
  users: UserPlus,
};

/**
 * Апселл-блок «Сделать страшнее».
 *
 * Здесь только реальные опции площадки: уровень страха, дополнительный игрок
 * по тарифу 3 500 ₸, пакет документов для бухгалтерии и акция для именинника.
 * Фото и видео помечены как «по запросу» — это запрос администратору,
 * а не проданная услуга, поэтому и цена не выдумывается.
 */
export function Extras({
  quest,
  players,
  fearMode,
  extraIds,
  isBirthday,
  onPlayersChange,
  onFearModeChange,
  onToggleExtra,
  onToggleBirthday,
}: {
  quest: Quest;
  players: number;
  fearMode: FearModeId;
  extraIds: string[];
  isBirthday: boolean;
  onPlayersChange: (players: number) => void;
  onFearModeChange: (mode: FearModeId) => void;
  onToggleExtra: (id: string) => void;
  onToggleBirthday: (value: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const hardAvailable = quest.fearModes.includes("hard");
  const hardActive = fearMode === "hard";
  const mode = getFearMode(fearMode);
  const canAddPlayer = players < quest.spec.playersMax;
  const selectedCount = extraIds.length + (isBirthday ? 1 : 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-xl uppercase tracking-[0.08em] text-bone">Сделать страшнее</h3>
        <p className="mt-2 text-sm leading-relaxed text-bone-dim">
          Уровень страха меняет всё: от «просто атмосферно» до полного контакта с актёрами. Дополнительные
          опции — только те, что площадка действительно предоставляет.
        </p>
      </div>

      {/* Главный апселл: полный контакт */}
      <button
        type="button"
        disabled={!hardAvailable}
        aria-pressed={hardActive}
        onClick={() => onFearModeChange(hardActive ? "light" : "hard")}
        data-cursor={hardAvailable ? "[ ВКЛЮЧИТЬ ]" : undefined}
        className={`flex w-full items-start gap-4 border p-4 text-left transition ${
          hardActive ? "border-crimson bg-blood-deep/40" : "border-bone/12 hover:border-crimson/50"
        } ${!hardAvailable ? "cursor-not-allowed opacity-45" : ""}`}
      >
        <Zap className={`mt-0.5 h-5 w-5 shrink-0 ${hardActive ? "text-crimson" : "text-bone-dim"}`} aria-hidden="true" />
        <span className="flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-base uppercase tracking-[0.08em] text-bone">
              Максимум страха · полный контакт
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-crimson">включено</span>
          </span>
          <span className="mt-2 block text-sm leading-relaxed text-bone-dim">
            {hardAvailable
              ? "Актёры касаются, уводят и разделяют команду. Самый жёсткий режим площадки. Возраст 16+ и согласие всех участников."
              : `Для «${quest.title}» этот режим недоступен — доступны: ${quest.fearModes.map((id) => getFearMode(id).name).join(", ")}.`}
          </span>
          {hardActive ? (
            <span className="mt-3 block font-mono text-[10px] uppercase tracking-[0.18em] text-crimson">
              Выбрано: {mode.name} · {mode.contact}
            </span>
          ) : null}
        </span>
      </button>

      {/* Дополнительный игрок — реальный тариф от 5 человек */}
      <div className="flex items-center justify-between gap-4 border border-bone/12 p-4">
        <div className="flex items-start gap-4">
          <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-bone-dim" aria-hidden="true" />
          <div>
            <p className="font-display text-base uppercase tracking-[0.08em] text-bone">
              {PLAYER_UPSELL.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-bone-dim">{PLAYER_UPSELL.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onPlayersChange(Math.max(quest.spec.playersMin, players - 1))}
            disabled={players <= quest.spec.playersMin}
            aria-label="Убрать одного игрока"
            className="flex h-10 w-10 items-center justify-center border border-bone/20 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="w-10 text-center font-display text-xl tabular-nums text-bone" aria-live="polite">
            {players}
          </span>
          <button
            type="button"
            onClick={() => onPlayersChange(Math.min(quest.spec.playersMax, players + 1))}
            disabled={!canAddPlayer}
            aria-label="Добавить одного игрока"
            className="flex h-10 w-10 items-center justify-center border border-bone/20 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text">
        {players >= PLAYER_UPSELL.perPersonFrom
          ? `${pluralPlayers(players)} · тариф ${formatKzt(PLAYER_UPSELL.perPersonPrice)} с человека`
          : `${pluralPlayers(players)} · ${formatKzt(15000)} за игру (тариф 3–4 человека)`}
      </p>

      {/* Всё остальное спрятано за одним переключателем: человек, которому нужна
          просто бронь, видит короткую форму, а тот, кто хочет документы или
          съёмку, открывает список одним касанием. */}
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="extras-list"
        className="flex min-h-[48px] w-full items-center justify-between gap-3 border border-bone/12 px-4 py-3 text-left transition hover:border-crimson/50"
      >
        <span className="flex items-center gap-3">
          {expanded ? (
            <Minus className="h-4 w-4 text-crimson" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4 text-crimson" aria-hidden="true" />
          )}
          <span className="font-display text-sm uppercase tracking-[0.08em] text-bone">
            {expanded ? "Скрыть опции" : "Ещё опции"}
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
          {selectedCount > 0
            ? `выбрано: ${selectedCount}`
            : "документы · фото · именинник"}
        </span>
      </button>

      {expanded ? (
        <div id="extras-list" className="space-y-5">
            <ul className="grid gap-3 sm:grid-cols-2">
              {EXTRAS.filter((extra) => extra.id !== "full-contact").map((extra) => {
                const Icon = ICONS[extra.icon] ?? FileText;
                const active = extraIds.includes(extra.id);
                const priceLabel =
                  extra.priceType === "free"
                    ? "бесплатно"
                    : extra.priceType === "request"
                      ? "цена по запросу"
                      : formatKzt(extra.amount ?? 0);

                return (
                  <li key={extra.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggleExtra(extra.id)}
                      data-cursor="[ ВЫБРАТЬ ]"
                      className={`flex h-full w-full items-start gap-3 border p-4 text-left transition ${
                        active ? "border-crimson bg-blood-deep/30" : "border-bone/12 hover:border-crimson/50"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${
                          active ? "border-crimson bg-crimson" : "border-bone/35"
                        }`}
                      >
                        {active ? <span className="text-[10px] leading-none text-ink">✓</span> : null}
                      </span>
                      <span className="flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-display text-sm uppercase tracking-[0.08em] text-bone">
                            {extra.name}
                          </span>
                          <Icon className="h-4 w-4 shrink-0 text-bone-dim" aria-hidden="true" />
                        </span>
                        <span className="mt-2 block text-xs leading-relaxed text-bone-dim">
                          {extra.description}
                        </span>
                        <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-crimson">
                          {priceLabel}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Акция: именинник */}
            <button
              type="button"
              aria-pressed={isBirthday}
              onClick={() => onToggleBirthday(!isBirthday)}
              data-cursor="[ ОТМЕТИТЬ ]"
              className={`flex w-full items-start gap-4 border p-4 text-left transition ${
                isBirthday ? "border-crimson bg-blood-deep/30" : "border-bone/12 hover:border-crimson/50"
              }`}
            >
              <Gift className={`mt-0.5 h-5 w-5 shrink-0 ${isBirthday ? "text-crimson" : "text-bone-dim"}`} aria-hidden="true" />
              <span>
                <span className="font-display text-base uppercase tracking-[0.08em] text-bone">
                  {BIRTHDAY_PROMO.title}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-bone-dim">{BIRTHDAY_PROMO.detail}</span>
                {isBirthday && players < 6 ? (
                  <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-crimson">
                    Нужно минимум 6 человек — сейчас {players}
                  </span>
                ) : null}
              </span>
            </button>
        </div>
      ) : null}
    </div>
  );
}
