import { getQuest } from "./content";
import type { DayAvailability, TimeSlot } from "./types";
import { hashString, isSlotPast, seededRandom } from "./utils";

// ─────────────────────────────────────────────────────────────────────────────
//  ЗАНЯТОСТЬ СЛОТОВ
//
//  ⚠️ Сейчас это ДЕМО-расписание (mock): слоты генерируются детерминированно
//  из хэша «квест + дата + время», поэтому расписание стабильно для всех
//  посетителей и не «прыгает» при перезагрузке.
//
//  Как подключить реальный бэкенд:
//  1) замените тело `buildDayAvailability` на запрос к календарю/CRM
//     (например, fetch(`${CRM_URL}/slots?quest=...&date=...`));
//  2) либо оставьте расчёт как есть, но передавайте `bookedSeatsByTime` из
//     своей базы — здесь уже вычитаются реальные брони, сделанные на сайте.
//  Контракт функции менять не нужно: UI работает с типом DayAvailability.
// ─────────────────────────────────────────────────────────────────────────────

export const AVAILABILITY_IS_MOCK = true;

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

export interface AvailabilityOptions {
  /** Сколько мест уже занято в каждом слоте (из базы броней или CRM) */
  bookedSeatsByTime?: Record<string, number>;
}

export function buildDayAvailability(
  questSlug: string,
  dateISO: string,
  options: AvailabilityOptions = {},
): DayAvailability {
  const quest = getQuest(questSlug);
  const capacity = quest?.spec.playersMax ?? 15;
  const booked = options.bookedSeatsByTime ?? {};
  const [year, month, day] = dateISO.split("-").map(Number);
  const isWeekend = (() => {
    const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
    return weekday === 0 || weekday === 5 || weekday === 6;
  })();

  const slots: TimeSlot[] = SLOT_START_TIMES.map((time) => {
    if (isSlotPast(dateISO, time)) {
      return {
        time,
        status: "past" as const,
        seatsLeft: 0,
        capacity,
        reason: "Это время уже прошло",
      };
    }

    const random = seededRandom(hashString(`${questSlug}|${dateISO}|${time}`))();
    // Вечерние слоты загружены сильнее — как в реальной жизни
    const hour = Number(time.slice(0, 2));
    const eveningBoost = hour >= 18 ? 0.12 : 0;
    const weekendBoost = isWeekend ? 0.08 : 0;
    const roll = random - eveningBoost - weekendBoost;

    if (roll < 0.3) {
      return {
        time,
        status: "sold-out" as const,
        seatsLeft: 0,
        capacity,
        reason: "Все места заняты — выберите другое время",
      };
    }

    if (roll < 0.56) {
      const seatsLeft = 1 + Math.floor(Math.abs(random * 1000) % 4);
      return {
        time,
        status: "few-left" as const,
        seatsLeft,
        capacity,
        reason: `Свободно ${seatsLeft} из ${capacity} мест`,
      };
    }

    const freeRandom = seededRandom(hashString(`${questSlug}|${dateISO}|${time}|free`))();
    const seatsLeft = Math.max(5, Math.round(capacity * (0.55 + freeRandom * 0.45)));
    return {
      time,
      status: "available" as const,
      seatsLeft,
      capacity,
    };
  });

  // Вычитаем места, уже занятые реальными бронями через сайт
  const adjusted = slots.map((slot) => {
    const taken = booked[slot.time] ?? 0;
    if (taken <= 0 || slot.status === "past" || slot.status === "sold-out") return slot;
    const seatsLeft = Math.max(0, slot.seatsLeft - taken);
    if (seatsLeft === 0) {
      return {
        ...slot,
        status: "sold-out" as const,
        seatsLeft: 0,
        reason: "Этот слот только что заняли",
      };
    }
    if (seatsLeft <= 4) {
      return { ...slot, status: "few-left" as const, seatsLeft };
    }
    return { ...slot, seatsLeft };
  });

  return {
    dateISO,
    slots: adjusted,
    full: adjusted.every((slot) => slot.status === "sold-out" || slot.status === "past"),
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
): Record<string, MonthDaySummary> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const summary: Record<string, MonthDaySummary> = {};

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${`${month + 1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
    const availability = buildDayAvailability(questSlug, iso, {
      bookedSeatsByTime: bookedByDate[iso],
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

/** Ближайшие свободные слоты — для блока честной срочности на главной */
export function nextAvailableSlots(
  questSlug: string,
  fromDate: Date,
  daysToScan = 3,
  bookedByDate: Record<string, Record<string, number>> = {},
): Array<{ dateISO: string; time: string; seatsLeft: number }> {
  const result: Array<{ dateISO: string; time: string; seatsLeft: number }> = [];

  for (let offset = 0; offset < daysToScan && result.length < 3; offset += 1) {
    const date = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + offset);
    const iso = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
    const availability = buildDayAvailability(questSlug, iso, {
      bookedSeatsByTime: bookedByDate[iso],
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
