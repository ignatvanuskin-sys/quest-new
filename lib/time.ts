/**
 * БИЗНЕС-ВРЕМЯ ПЛОЩАДКИ
 *
 * Площадка работает в Алматы (UTC+5). Сервер может стоять где угодно —
 * на VPS в Европе, на Vercel в США, — и `new Date()` там даст чужой день.
 * Все расчёты расписания, броней, напоминаний и файлов календаря обязаны
 * идти через этот модуль, иначе в один прекрасный вечер «сегодня» на сервере
 * окажется вчера, и человек не увидит сегодняшние слоты.
 *
 * Перевод в зону делается через Intl, а не через жёсткое «+5 часов»:
 * так модуль остаётся правильным, если Казахстан когда-нибудь вернёт
 * переход на летнее время, и работает одинаково в Node и в браузере.
 */

export const BUSINESS_TIMEZONE = "Asia/Almaty";

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Какое настенное время показывает бизнес-зона в этот момент.
 * `formatToParts` вместо разбора строки — чтобы не зависеть от локали выводa.
 */
function zonedParts(instant: Date): ZoneParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts: Partial<Record<string, number>> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type === "literal") continue;
    parts[part.type] = Number(part.value);
  }

  return {
    // В en-CA 24:00 иногда приходит как «24» — приводим к 0
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    day: parts.day ?? 1,
    month: parts.month ?? 1,
    year: parts.year ?? 1970,
  };
}

/** Разбор YYYY-MM-DD и HH:MM без создания «локальной» даты сервера */
function parseDateISO(dateISO: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateISO.split("-").map(Number);
  return { year: year || 1970, month: month || 1, day: day || 1 };
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

/**
 * Смещение бизнес-зоны для конкретного настенного времени.
 * Считается по правилу «трактуем время как UTC, смотрим, что показывает зона,
 * и берём разницу» — это стандартный способ без внешних библиотек.
 */
function zoneOffsetMs(dateISO: string, time: string): number {
  const { year, month, day } = parseDateISO(dateISO);
  const { hour, minute } = parseTime(time);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  const zoned = zonedParts(new Date(asIfUtc));
  const zonedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
  return zonedAsUtc - asIfUtc;
}

/** Календарная дата в бизнес-зоне: YYYY-MM-DD */
export function businessToday(instant: Date = new Date()): string {
  const { year, month, day } = zonedParts(instant);
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

/** Текущее время в бизнес-зоне: HH:MM */
export function businessNowTime(instant: Date = new Date()): string {
  const { hour, minute } = zonedParts(instant);
  return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
}

/** Прибавить дни к календарной дате (даты чистые, без времени суток) */
export function businessAddDays(dateISO: string, days: number): string {
  const { year, month, day } = parseDateISO(dateISO);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${`${base.getUTCMonth() + 1}`.padStart(2, "0")}-${`${base.getUTCDate()}`.padStart(2, "0")}`;
}

/** Разница в календарных днях между двумя датами бизнес-зоны */
export function businessDaysBetween(fromISO: string, toISO: string): number {
  const asUtc = (iso: string) => {
    const { year, month, day } = parseDateISO(iso);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((asUtc(toISO) - asUtc(fromISO)) / 86_400_000);
}

/** Реальный момент начала слота (UTC) — нужен для напоминаний и проверок */
export function businessSlotInstant(dateISO: string, time: string): Date {
  const { year, month, day } = parseDateISO(dateISO);
  const { hour, minute } = parseTime(time);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(asIfUtc - zoneOffsetMs(dateISO, time));
}

/**
 * Прошло ли время слота.
 *
 * Раньше сравнивался календарный день и время с локальным временем сервера —
 * на сервере в другом поясе это сдвигало границу на несколько часов и давало
 * забронировать уже начавшийся слот.
 *
 * Слот считается начавшимся ровно в минуту старта: бронь на 18:00 в 18:00
 * уже недоступна (администратору останется только ручная запись).
 */
export function isSlotInPast(dateISO: string, time: string, instant: Date = new Date()): boolean {
  const today = businessToday(instant);
  if (dateISO < today) return true;
  if (dateISO > today) return false;
  return time <= businessNowTime(instant);
}

/** Сколько минут осталось до слота (может быть отрицательным) */
export function minutesUntilSlot(dateISO: string, time: string, instant: Date = new Date()): number {
  return Math.round((businessSlotInstant(dateISO, time).getTime() - instant.getTime()) / 60_000);
}

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Текст вида «26 сентября 2026, 18:00» для уведомлений и админки */
export function businessDateTimeLabel(dateISO: string, time?: string): string {
  const { year, month, day } = parseDateISO(dateISO);
  const label = `${day} ${MONTHS_GEN[month - 1] ?? ""} ${year}`.trim();
  return time ? `${label}, ${time}` : label;
}

/** Настенное время в формате календаря: YYYYMMDDTHHMMSS */
export function businessIcsStamp(dateISO: string, time: string, addMinutes = 0): string {
  const { year, month, day } = parseDateISO(dateISO);
  const { hour, minute } = parseTime(time);
  const base = new Date(Date.UTC(year, month - 1, day, hour, minute + addMinutes));
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${base.getUTCFullYear()}${pad(base.getUTCMonth() + 1)}${pad(base.getUTCDate())}T${pad(base.getUTCHours())}${pad(base.getUTCMinutes())}00`;
}
