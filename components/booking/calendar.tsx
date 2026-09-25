"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MonthDaySummary } from "@/lib/availability";
import { monthTitle, todayISO } from "@/lib/utils";
import { useSwipe } from "@/components/use-swipe";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export interface CalendarProps {
  year: number;
  month: number;
  selected: string | null;
  summary: Record<string, MonthDaySummary>;
  loading?: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onMonthChange: (direction: -1 | 1) => void;
  onSelect: (iso: string) => void;
}

/**
 * Календарь без внешних библиотек: крупные кнопки под палец (не меньше 44 px),
 * точки занятости под датой и полная доступность с клавиатуры.
 */
export function Calendar({
  year,
  month,
  selected,
  summary,
  loading,
  canGoBack,
  canGoForward,
  onMonthChange,
  onSelect,
}: CalendarProps) {
  const today = todayISO();
  // Свайп влево/вправо переключает месяц — привычный мобильный жест
  const swipe = useSwipe((direction) => {
    if (direction === 1 && canGoForward) onMonthChange(1);
    if (direction === -1 && canGoBack) onMonthChange(-1);
  });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // приводим к пн=0
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div className="touch-pan-y border border-bone/10 bg-ash/50 p-3 sm:p-4" {...swipe}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(-1)}
          disabled={!canGoBack}
          aria-label="Предыдущий месяц"
          className="flex h-10 w-10 items-center justify-center border border-bone/15 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <p aria-live="polite" className="font-display text-base uppercase tracking-[0.12em] text-bone">
          {monthTitle(year, month)}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(1)}
          disabled={!canGoForward}
          aria-label="Следующий месяц"
          className="flex h-10 w-10 items-center justify-center border border-bone/15 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text"
          >
            {day}
          </div>
        ))}

        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} aria-hidden="true" />;

          const iso = `${year}-${`${month + 1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
          const info = summary[iso];
          const isPast = iso < today;
          const isFull = info ? info.full : false;
          const disabled = isPast || isFull;
          const isSelected = selected === iso;
          const isToday = iso === today;
          const free = info?.freeSlots ?? 0;

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${day} ${monthTitle(year, month)}${isPast ? " — дата прошла" : isFull ? " — всё занято" : `, свободно слотов: ${free}`}`}
              onClick={() => onSelect(iso)}
              data-cursor={disabled ? undefined : "[ ВЫБРАТЬ ]"}
              className={`relative flex aspect-square min-h-[44px] flex-col items-center justify-center border transition ${
                isSelected
                  ? "border-crimson bg-blood-deep/60 text-bone"
                  : disabled
                    ? "border-transparent text-ash-text/50"
                    : "border-bone/8 text-bone-dim hover:border-crimson/50 hover:text-bone"
              }`}
            >
              <span className="font-display text-[15px] leading-none tabular-nums">
                {day}
                {isToday ? <span className="sr-only"> (сегодня)</span> : null}
              </span>

              {/* Точки занятости: 3 квадратика = вечер заполнен */}
              {!isPast && info ? (
                <span className="mt-1 flex gap-[2px]" aria-hidden="true">
                  {Array.from({ length: 3 }).map((_, barIndex) => {
                    const level = info.totalSlots === 0 ? 0 : info.freeSlots / info.totalSlots;
                    const active = level > (barIndex === 0 ? 0 : barIndex === 1 ? 0.34 : 0.67);
                    return (
                      <span
                        key={barIndex}
                        className={`h-[3px] w-1.5 ${active ? "bg-crimson" : "bg-steel/70"}`}
                      />
                    );
                  })}
                </span>
              ) : null}

              {isToday && !isSelected ? (
                <span className="absolute inset-x-2 bottom-1 h-px bg-crimson/60" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-bone/8 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-1.5 bg-crimson" aria-hidden="true" /> есть свободные слоты
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-1.5 bg-steel/70" aria-hidden="true" /> мало мест
        </span>
        <span className="flex items-center gap-1.5 text-ash-text">
          {loading ? "Обновляем занятость…" : "серые даты — всё занято"}
        </span>
      </div>
    </div>
  );
}
