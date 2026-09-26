import { getQuest } from "./content";
import { businessAddDays, businessToday, isSlotInPast } from "./time";
import type { DayAvailability, TimeSlot } from "./types";
import { hashString, seededRandom } from "./utils";

// ─────────────────────────────────────────────────────────────────────────────
//  ЗАНЯТОСТЬ СЛОТОВ
//
//  Единственный источник правды о вместимости — реальные брони. Слот свободен,
//  пока в нём есть места: площадка работает по фиксированной сетке стартов,
//  и все старты доступны, если их никто не занял.
//
//  Раньше расписание было «демо»: занятость генерировалась из хэша от
//  «квест + дата + время». Для показательной версии это выглядело живым,
//  но в продакшене это ложь в интерфейсе — сайт показывал «мест нет»
//  там, где места есть, и «осталось 2 места» вместо реальной вместимости.
//  Поэтому теперь два честно разделённых режима:
//
//   • "schedule" — реальная сетка + реальные брони (используется по умолчанию);
//   • "demo"     — та же сетка плюс детерминированная имитация занятости,
//                  включается только явным флагом (DEMO_AVAILABILITY=1)
//                  и никогда не включается в production.
//
//  Как подключить внешний календарь/CRM: не трогать этот файл, а подключить
//  другой провайдер (lib/providers/availability.ts) — интерфейс тот же.
// ─────────────────────────────────────────────────────────────────────────────

/** Режим источника занятости */
export type AvailabilityMode = "schedule" | "demo";

/** Сетка стартов игры: 60 минут игра + 30 минут на перезапуск локации */
export const SLOT_START_TIMES = [
  "12:00",
  "13:30",
  "15:00",
  "16:30",
  "18:00",
  "19:30",
  "21:00",
  "22:30",
] as const;

/**
 * Включена ли демонстрационная занятость.
 *
 * В production флаг по умолчанию выключен — сайт обязан показывать только
 * реальные брони. В разработке он включён, чтобы расписание выглядело живым
 * при пустой базе.
 */
export function availabilityMode(): AvailabilityMode {
  const flag = process.env.DEMO_AVAILABILITY;
  if (flag === "1" || flag === "true") return "demo";
  if (flag === "0" || flag === "false") return "schedule";
  return process.env.NODE_ENV === "production" ? "schedule" : "demo";
}

/** Совместимость: раньше этот флаг означал «расписание ненастоящее» */
export const AVAILABILITY_IS_MOCK = availabilityMode() === "demo";

export interface AvailabilityOptions {
  /** Сколько мест уже занято в каждом слоте (из базы броней или CRM) */
  bookedSeatsByTime?: Record<string, number>;
  mode?: AvailabilityMode;
  /** Момент проверки «прошло ли время» — подставляется в тестах */
  now?: Date;
}

function isWeekend(dateISO: string): boolean {
  const [year, month, day] = dateISO.split("-").map(Number);
  const weekday = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1)).getUTCDay();
  return weekday === 0 || weekday === 5 || weekday === 6;
}

/**
 * Имитация занятости для демонстрационного режима.
 *
 * Возвращает занятые места, а не готовые статусы: так демо-профиль проходит
 * через тот же код, что и реальные брони, и не может «разойтись» с ним.
 * Формулы оставлены прежними, чтобы демо-версия выглядела как раньше.
 */
export function demoOccupancy(questSlug: string, dateISO: string, capacity: number): Record<string, number> {
  const weekend = isWeekend(dateISO);
  const occupied: Record<string, number> = {};

  for (const time of SLOT_START_TIMES) {
    const random = seededRandom(hashString(`${questSlug}|${dateISO}|${time}`))();
    const hour = Number(time.slice(0, 2));
    const eveningBoost = hour >= 18 ? 0.12 : 0;
    const weekendBoost = weekend ? 0.08 : 0;
    const roll = random - eveningBoost - weekendBoost;

    if (roll < 0.3) {
      occupied[time] = capacity;
    } else if (roll < 0.56) {
      const seatsLeft = 1 + Math.floor(Math.abs(random * 1000) % 4);
      occupied[time] = Math.max(0, capacity - seatsLeft);
    } else {
      const freeRandom = seededRandom(hashString(`${questSlug}|${dateISO}|${time}|free`))();
      const seatsLeft = Math.max(5, Math.round(capacity * (0.55 + freeRandom * 0.45)));
      occupied[time] = Math.max(0, capacity - seatsLeft);
    }
  }

  return occupied;
}

/** Собрать занятость слота: реальные брони (+ демо-профиль, если он включён) */
export function occupancyFor(
  questSlug: string,
  dateISO: string,
  capacity: number,
  options: AvailabilityOptions = {},
): Record<string, number> {
  const mode = options.mode ?? availabilityMode();
  const real = options.bookedSeatsByTime ?? {};

  if (mode !== "demo") return real;

  const demo = demoOccupancy(questSlug, dateISO, capacity);
  const merged: Record<string, number> = { ...real };
  for (const [time, seats] of Object.entries(demo)) {
    merged[time] = (merged[time] ?? 0) + seats;
  }
  return merged;
}

export function buildDayAvailability(
  questSlug: string,
  dateISO: string,
  options: AvailabilityOptions = {},
): DayAvailability {
  const quest = getQuest(questSlug);
  const capacity = quest?.spec.playersMax ?? 15;
  const occupied = occupancyFor(questSlug, dateISO, capacity, options);
  const now = options.now ?? new Date();

  const slots: TimeSlot[] = SLOT_START_TIMES.map((time) => {
    if (isSlotInPast(dateISO, time, now)) {
      return {
        time,
        status: "past" as const,
        seatsLeft: 0,
        capacity,
        reason: "Это время уже прошло",
      };
    }

    const seatsLeft = Math.max(0, capacity - (occupied[time] ?? 0));

    if (seatsLeft === 0) {
      return {
        time,
        status: "sold-out" as const,
        seatsLeft: 0,
        capacity,
        reason: "Все места заняты — выберите другое время",
      };
    }

    if (seatsLeft <= 4) {
      return {
        time,
        status: "few-left" as const,
        seatsLeft,
        capacity,
        reason: `Свободно ${seatsLeft} из ${capacity} мест`,
      };
    }

    return { time, status: "available" as const, seatsLeft, capacity };
  });

  return {
    dateISO,
    slots,
    full: slots.every((slot) => slot.status === "sold-out" || slot.status === "past"),
  };
}

export interface MonthDaySummary {
  dateISO: string;
  freeSlots: number;
  totalSlots: number;
  full: boolean;
}

/** Быстрая сводка по месяцу — для точек в календаре */
export function buildMonthSummary(
  questSlug: string,
  year: number,
  month: number,
  bookedByDate: Record<string, Record<string, number>> = {},
  mode?: AvailabilityMode,
  now: Date = new Date(),
): Record<string, MonthDaySummary> {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const summary: Record<string, MonthDaySummary> = {};

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${`${month + 1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
    const availability = buildDayAvailability(questSlug, iso, {
      bookedSeatsByTime: bookedByDate[iso],
      mode,
      now,
    });
    const bookable = availability.slots.filter((slot) => slot.status !== "past");
    const free = bookable.filter((slot) => slot.status !== "sold-out").length;
    summary[iso] = {
      dateISO: iso,
      freeSlots: free,
      totalSlots: bookable.length,
      full: bookable.length > 0 && free === 0,
    };
  }

  return summary;
}

/**
 * Ближайшие свободные слоты — для блока честной срочности на главной.
 *
 * Отсчёт идёт от даты площадки (см. lib/time.ts), а не от `new Date()`
 * устройства: на сервере в другом поясе «первый день» мог быть уже прошедшим.
 */
export function nextAvailableSlots(
  questSlug: string,
  fromDateISO: string = businessToday(),
  daysToScan = 3,
  bookedByDate: Record<string, Record<string, number>> = {},
  mode?: AvailabilityMode,
): Array<{ dateISO: string; time: string; seatsLeft: number }> {
  const result: Array<{ dateISO: string; time: string; seatsLeft: number }> = [];

  for (let offset = 0; offset < daysToScan && result.length < 3; offset += 1) {
    const iso = businessAddDays(fromDateISO, offset);
    const availability = buildDayAvailability(questSlug, iso, {
      bookedSeatsByTime: bookedByDate[iso],
      mode,
    });
    for (const slot of availability.slots) {
      if (slot.status === "available" || slot.status === "few-left") {
        result.push({ dateISO: iso, time: slot.time, seatsLeft: slot.seatsLeft });
        if (result.length >= 3) break;
      }
    }
  }

  return result;
}
