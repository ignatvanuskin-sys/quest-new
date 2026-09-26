import {
  buildDayAvailability,
  buildMonthSummary,
  availabilityMode,
  nextAvailableSlots,
  type AvailabilityMode,
} from "../availability";
import { getQuest } from "../content";
import { log } from "../logger";
import { businessToday } from "../time";
import type { DayAvailability, TimeSlot } from "../types";

/* ───────────────────────────────────────────────────────────────────────────
   ПРОВАЙДЕР РАСПИСАНИЯ

   Интерфейс нужен, чтобы интерфейс сайта не знал, откуда берутся слоты:
   из собственной базы (сегодня), из календаря заведения, из CRM или из
   внешней системы бронирования. Меняется провайдер — не меняется ни один
   компонент и ни один ответ API.

   Два правила, заложенные в контракт:

   1. Вместимость проверяется только здесь и только на сервере. Считать
      «сколько мест осталось» в браузере можно, но верить этому числу нельзя.

   2. Резерв места — критическая секция. `withSlotSection` гарантирует, что
      проверка вместимости и запись брони происходят внутри одной блокировки
      (advisory-замок PostgreSQL или очередь процесса для файлового хранилища).
      Без этого два одновременных запроса займут последнее место дважды.
   ─────────────────────────────────────────────────────────────────────────── */

export interface SlotRef {
  questSlug: string;
  dateISO: string;
  time: string;
}

export interface SlotState extends SlotRef {
  capacity: number;
  /** Сколько мест уже занято активными бронями */
  occupied: number;
  seatsLeft: number;
}

export interface ReserveRequest extends SlotRef {
  players: number;
}

export type ReserveResult =
  | { ok: true; seatsLeft: number }
  | { ok: false; reason: "sold-out" | "not-enough-seats" | "unknown-slot" | "provider-unavailable"; seatsLeft: number; message: string };

export interface AvailabilityProvider {
  readonly id: string;
  /** Источник внешний (CRM/календарь) — от этого зависит текст в интерфейсе */
  readonly external: boolean;
  /** Доступен ли провайдер прямо сейчас */
  isConfigured(): boolean;
  getAvailableSlots(query: { questSlug: string; dateISO: string }): Promise<DayAvailability>;
  getSlot(query: SlotRef): Promise<TimeSlot | null>;
  getMonthSummary(questSlug: string, year: number, month: number): Promise<Record<string, { dateISO: string; freeSlots: number; totalSlots: number; full: boolean }>>;
  getNextAvailable(questSlug: string, daysToScan?: number): Promise<Array<{ dateISO: string; time: string; seatsLeft: number }>>;
  /**
   * Критическая секция слота. Внутри неё нельзя делать ничего, кроме проверки
   * мест и записи брони: любая сетевая операция растянет блокировку и
   * затормозит параллельные брони на тот же слот.
   */
  withSlotSection<T>(slot: SlotRef, task: (state: SlotState) => Promise<T>): Promise<T>;
  reserveSlot(request: ReserveRequest): Promise<ReserveResult>;
  releaseSlot(slot: SlotRef): Promise<void>;
}

/** Читатель занятости — реализуется хранилищем броней */
export interface SeatsReader {
  bookedSeatsByTime(questSlug: string, dateISO: string): Promise<Record<string, number>>;
  bookedSeatsByDate(questSlug: string): Promise<Record<string, Record<string, number>>>;
  withSlotLock<T>(
    slot: SlotRef,
    task: (context: { bookedSeats: number }) => Promise<T>,
  ): Promise<T>;
}

function capacityOf(questSlug: string): number {
  return getQuest(questSlug)?.spec.playersMax ?? 15;
}

/**
 * Штатный провайдер: расписание площадки + реальные брони.
 *
 * Это не «заглушка»: сетка стартов — реальное расписание заведения, а
 * занятость считается по броням, которые действительно созданы. Если заведение
 * ведёт часть записей вне сайта, брони приходят через CRM-провайдера
 * (lib/providers/crm.ts) — контракт для интерфейса тот же.
 */
export class ScheduleAvailabilityProvider implements AvailabilityProvider {
  readonly id = "schedule";
  readonly external = false;

  constructor(
    private readonly seats: SeatsReader,
    private readonly mode: AvailabilityMode = availabilityMode(),
  ) {}

  isConfigured(): boolean {
    return true;
  }

  async getAvailableSlots(query: { questSlug: string; dateISO: string }): Promise<DayAvailability> {
    const booked = await this.seats.bookedSeatsByTime(query.questSlug, query.dateISO);
    return buildDayAvailability(query.questSlug, query.dateISO, {
      bookedSeatsByTime: booked,
      mode: this.mode,
    });
  }

  async getSlot(query: SlotRef): Promise<TimeSlot | null> {
    const day = await this.getAvailableSlots({ questSlug: query.questSlug, dateISO: query.dateISO });
    return day.slots.find((slot) => slot.time === query.time) ?? null;
  }

  async getMonthSummary(questSlug: string, year: number, month: number) {
    const booked = await this.seats.bookedSeatsByDate(questSlug);
    return buildMonthSummary(questSlug, year, month, booked, this.mode);
  }

  async getNextAvailable(questSlug: string, daysToScan = 3) {
    const booked = await this.seats.bookedSeatsByDate(questSlug);
    return nextAvailableSlots(questSlug, businessToday(), daysToScan, booked, this.mode);
  }

  withSlotSection<T>(slot: SlotRef, task: (state: SlotState) => Promise<T>): Promise<T> {
    const capacity = capacityOf(slot.questSlug);
    return this.seats.withSlotLock(slot, async ({ bookedSeats }) => {
      return task({
        ...slot,
        capacity,
        occupied: bookedSeats,
        seatsLeft: Math.max(0, capacity - bookedSeats),
      });
    });
  }

  async reserveSlot(request: ReserveRequest): Promise<ReserveResult> {
    const slot = await this.getSlot(request);
    if (!slot) {
      return {
        ok: false,
        reason: "unknown-slot",
        seatsLeft: 0,
        message: "Такого времени нет в расписании.",
      };
    }
    if (slot.status === "sold-out") {
      return {
        ok: false,
        reason: "sold-out",
        seatsLeft: 0,
        message: "Это время только что заняли. Выберите другое.",
      };
    }
    if (slot.seatsLeft < request.players) {
      return {
        ok: false,
        reason: "not-enough-seats",
        seatsLeft: slot.seatsLeft,
        message: `Свободно ${slot.seatsLeft} из ${slot.capacity} мест.`,
      };
    }

    /* Место не «бронируется» отдельной записью: вместимость слота — это сумма
       игроков в активных бронях. Поэтому фактический резерв происходит в
       withSlotSection во время создания брони, а здесь только предварительная
       проверка, чтобы не гнать человека через форму впустую. */
    return { ok: true, seatsLeft: slot.seatsLeft };
  }

  async releaseSlot(): Promise<void> {
    /* Освобождать нечего: отменённая бронь выпадает из подсчёта занятости
       автоматически (фильтр status <> 'cancelled'). Метод существует, чтобы
       внешние провайдеры (CRM, календарь) могли снять удержание. */
  }
}

/**
 * Внешний провайдер: расписание приходит из чужой системы.
 *
 * Эндпоинт не выдуман: он задаётся переменной AVAILABILITY_API_URL, и пока
 * её нет — провайдер честно сообщает, что не настроен, а приложение
 * продолжает работать на собственном расписании.
 *
 * Ожидаемый контракт ответа (описан в PRODUCTION.md):
 *   GET {AVAILABILITY_API_URL}?quest=<slug>&date=YYYY-MM-DD
 *   → { slots: [{ time: "18:00", seatsLeft: 3, capacity: 15, status?: "available" }] }
 */
export class HttpAvailabilityProvider implements AvailabilityProvider {
  readonly id = "http";
  readonly external = true;

  constructor(
    private readonly baseUrl: string | undefined,
    private readonly token: string | undefined,
    private readonly timeoutMs = 4000,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  private async request(query: { questSlug: string; dateISO: string }): Promise<DayAvailability | null> {
    if (!this.baseUrl) return null;

    const url = new URL(this.baseUrl);
    url.searchParams.set("quest", query.questSlug);
    url.searchParams.set("date", query.dateISO);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        log.warn("availability_provider_error", { provider: this.id, status: response.status });
        return null;
      }

      const payload = (await response.json()) as {
        slots?: Array<Partial<TimeSlot> & { time: string }>;
      };
      if (!Array.isArray(payload.slots)) return null;

      const capacity = capacityOf(query.questSlug);
      const slots: TimeSlot[] = payload.slots.map((slot) => {
        const seatsLeft = Math.max(0, Number(slot.seatsLeft ?? 0));
        return {
          time: slot.time,
          seatsLeft,
          capacity: Number(slot.capacity ?? capacity),
          status:
            slot.status ?? (seatsLeft === 0 ? "sold-out" : seatsLeft <= 4 ? "few-left" : "available"),
          reason: slot.reason,
        };
      });

      return {
        dateISO: query.dateISO,
        slots,
        full: slots.every((slot) => slot.status === "sold-out" || slot.status === "past"),
      };
    } catch (error) {
      // Внешняя система недоступна — вызывающий код решает, что показать.
      // Молча подставлять «всё свободно» нельзя: это была бы ложь о расписании.
      log.warn("availability_provider_error", {
        provider: this.id,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async getAvailableSlots(query: { questSlug: string; dateISO: string }): Promise<DayAvailability> {
    const external = await this.request(query);
    if (external) return external;

    // Провайдер не отвечает: отдаём пустой день с явной причиной.
    // Интерфейс покажет «расписание недоступно», а не выдуманные места.
    return {
      dateISO: query.dateISO,
      slots: [],
      full: false,
    };
  }

  async getSlot(query: SlotRef): Promise<TimeSlot | null> {
    const day = await this.getAvailableSlots({ questSlug: query.questSlug, dateISO: query.dateISO });
    return day.slots.find((slot) => slot.time === query.time) ?? null;
  }

  async getMonthSummary(questSlug: string, year: number, month: number) {
    // Внешний источник обычно отдаёт день, а не месяц: месяц собираем по дням.
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const result: Record<string, { dateISO: string; freeSlots: number; totalSlots: number; full: boolean }> = {};

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${`${month + 1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
      const availability = await this.getAvailableSlots({ questSlug, dateISO: iso });
      const bookable = availability.slots.filter((slot) => slot.status !== "past");
      const free = bookable.filter((slot) => slot.status !== "sold-out").length;
      result[iso] = { dateISO: iso, freeSlots: free, totalSlots: bookable.length, full: bookable.length > 0 && free === 0 };
    }

    return result;
  }

  async getNextAvailable(questSlug: string, daysToScan = 3) {
    const result: Array<{ dateISO: string; time: string; seatsLeft: number }> = [];
    let cursor = businessToday();

    for (let offset = 0; offset < daysToScan && result.length < 3; offset += 1) {
      const availability = await this.getAvailableSlots({ questSlug, dateISO: cursor });
      for (const slot of availability.slots) {
        if (slot.status === "available" || slot.status === "few-left") {
          result.push({ dateISO: cursor, time: slot.time, seatsLeft: slot.seatsLeft });
          if (result.length >= 3) break;
        }
      }
      cursor = businessToday(new Date(Date.now() + (offset + 1) * 86_400_000));
    }

    return result;
  }

  withSlotSection<T>(slot: SlotRef, task: (state: SlotState) => Promise<T>): Promise<T> {
    /* У внешней системы своей критической секции нет: атомарность брони
       обеспечивает наша база, а провайдер отвечает только за чтение
       расписания. Так две системы не блокируют друг друга. */
    return (async () => {
      const current = await this.getSlot(slot);
      return task({
        ...slot,
        capacity: current?.capacity ?? capacityOf(slot.questSlug),
        occupied: current ? current.capacity - current.seatsLeft : 0,
        seatsLeft: current?.seatsLeft ?? 0,
      });
    })();
  }

  async reserveSlot(request: ReserveRequest): Promise<ReserveResult> {
    const slot = await this.getSlot(request);
    if (!slot) {
      return { ok: false, reason: "provider-unavailable", seatsLeft: 0, message: "Расписание недоступно." };
    }
    if (slot.seatsLeft < request.players) {
      return { ok: false, reason: "not-enough-seats", seatsLeft: slot.seatsLeft, message: `Свободно ${slot.seatsLeft} мест.` };
    }
    return { ok: true, seatsLeft: slot.seatsLeft };
  }

  async releaseSlot(): Promise<void> {
    /* Внешнее удержание снимается CRM-провайдером при отмене брони. */
  }
}

/**
 * Провайдер по умолчанию.
 *
 * Читатель занятости подгружается динамически, чтобы не возникло циклического
 * импорта «провайдер → хранилище → провайдер».
 */
let cached: AvailabilityProvider | null = null;

export async function getAvailabilityProvider(): Promise<AvailabilityProvider> {
  if (cached) return cached;

  const externalUrl = process.env.AVAILABILITY_API_URL;
  if (externalUrl) {
    cached = new HttpAvailabilityProvider(externalUrl, process.env.AVAILABILITY_API_TOKEN);
    return cached;
  }

  const { bookedSeatsByTime, bookedSeatsByDate, withSlotLock } = await import("../bookings");
  cached = new ScheduleAvailabilityProvider({
    bookedSeatsByTime,
    bookedSeatsByDate,
    withSlotLock,
  });
  return cached;
}

/** Сбросить кэш провайдера — нужно тестам после смены переменных окружения */
export function resetAvailabilityProvider(): void {
  cached = null;
}
