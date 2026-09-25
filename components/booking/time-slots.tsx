"use client";

import { Loader2 } from "lucide-react";
import type { DayAvailability } from "@/lib/types";
import { formatHumanDate, pluralSlots } from "@/lib/utils";

export function TimeSlots({
  availability,
  loading,
  selected,
  onSelect,
  players,
  onSuggestNextDay,
}: {
  availability: DayAvailability | null;
  loading: boolean;
  selected: string | null;
  onSelect: (time: string) => void;
  players: number;
  onSuggestNextDay?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 border border-bone/10 bg-ash/50 p-5 font-mono text-[11px] uppercase tracking-[0.2em] text-ash-text">
        <Loader2 className="h-4 w-4 animate-spin text-crimson" aria-hidden="true" />
        Смотрим, что свободно…
      </div>
    );
  }

  if (!availability) {
    return (
      <div className="border border-bone/10 bg-ash/50 p-5 text-sm text-bone-dim">
        Выберите дату в календаре — покажем свободное время.
      </div>
    );
  }

  const bookable = availability.slots.filter((slot) => slot.status !== "past");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-base uppercase tracking-[0.1em] text-bone">
          {formatHumanDate(availability.dateISO)}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text">
          игра длится 60 минут
        </p>
      </div>

      {bookable.length === 0 ? (
        <div className="border border-crimson/40 bg-blood-deep/20 p-5">
          <p className="font-display text-lg uppercase tracking-[0.06em] text-bone">
            На этот день всё занято
          </p>
          <p className="mt-2 text-sm leading-relaxed text-bone-dim">
            Так бывает на выходных. Посмотрите соседнюю дату — на ней почти всегда есть окно.
          </p>
          {onSuggestNextDay ? (
            <button
              type="button"
              onClick={onSuggestNextDay}
              className="btn-ghost mt-4 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em]"
            >
              Показать следующий день
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {bookable.map((slot) => {
              const soldOut = slot.status === "sold-out";
              const notEnoughSeats = !soldOut && slot.seatsLeft < players;
              const disabled = soldOut || notEnoughSeats;
              const isSelected = selected === slot.time;

              return (
                <li key={slot.time}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSelected}
                    data-cursor={disabled ? undefined : "[ ВЗЯТЬ ]"}
                    title={
                      soldOut
                        ? slot.reason
                        : notEnoughSeats
                          ? `Свободно ${slot.seatsLeft} мест — для вашей команды нужно ${players}`
                          : slot.reason
                    }
                    onClick={() => onSelect(slot.time)}
                    className={`flex w-full flex-col items-start gap-1 border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-crimson bg-blood-deep/60"
                        : disabled
                          ? "border-bone/8 opacity-45"
                          : "border-bone/15 hover:border-crimson/60"
                    }`}
                  >
                    <span className="font-display text-lg leading-none tabular-nums text-bone">
                      {slot.time}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                        soldOut
                          ? "text-dust"
                          : slot.status === "few-left" || notEnoughSeats
                            ? "text-crimson"
                            : "text-ash-text"
                      }`}
                    >
                      {soldOut
                        ? "занято"
                        : notEnoughSeats
                          ? `мало мест · ${slot.seatsLeft}`
                          : slot.status === "few-left"
                            ? `осталось ${pluralSlots(slot.seatsLeft)}`
                            : "свободно"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-ash-text">
            Занятость обновляется с учётом подтверждённых броней. Слот может уйти в момент оформления — в этом
            случае администратор предложит ближайшее свободное время.
          </p>
        </>
      )}
    </div>
  );
}
