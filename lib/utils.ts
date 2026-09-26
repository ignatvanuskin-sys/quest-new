// ─────────────────────────────────────────────────────────────────────────────
// Небольшие утилиты без внешних зависимостей.
// ─────────────────────────────────────────────────────────────────────────────

import { BUSINESS_TIMEZONE, businessIcsStamp, businessToday, isSlotInPast } from "./time";

/** Склейка классов без зависимости от clsx */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const KZT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** 15000 → «15 000 ₸» (с неразрывными пробелами, чтобы цена не рвалась на две строки) */
export function formatKzt(value: number): string {
  return `${KZT.format(value).replace(/\s/g, "\u00A0")}\u00A0₸`;
}

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/**
 * Локальная дата в формате YYYY-MM-DD.
 * ВАЖНО: не используем toISOString() — он переводит дату в UTC и для Алматы (UTC+5)
 * сдвигает календарный день назад.
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Разбор YYYY-MM-DD в локальную дату (без UTC-сдвига) */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Сегодняшняя дата площадки (Алматы), а не дата устройства.
 *
 * Экран выбора даты должен ориентироваться на день заведения: человек,
 * открывший сайт из другого пояса, иначе увидит недоступный «вчерашний» день
 * или не найдёт сегодняшние слоты.
 */
export function todayISO(): string {
  return businessToday();
}

/** «пт, 3 октября» */
export function formatHumanDate(iso: string): string {
  const date = fromISODate(iso);
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`;
}

/** «3 октября 2026» */
export function formatLongDate(iso: string): string {
  const date = fromISODate(iso);
  return `${date.getDate()} ${MONTHS_GEN[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS_NOM[month]} ${year}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** «2 часа 15 минут» — используется в подтверждении брони */
export function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hourWord = h === 1 ? "час" : h < 5 ? "часа" : "часов";
  return m === 0 ? `${h} ${hourWord}` : `${h} ${hourWord} ${m} мин`;
}

/** Нормализация телефона: +7 777 399 98 43 → +77773999843 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("8") && digits.length === 11) return `+7${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("+")) return digits;
  return digits ? `+${digits}` : "";
}

/** Валидация казахстанского/российского мобильного номера */
export function isValidPhone(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return /^\+7\d{10}$/.test(normalized) || /^\+7\d{10}$/.test(normalized.replace(/\D/g, "").padStart(11, "+"));
}

/** «+7 777 399 98 43» — человекочитаемый вид */
export function prettyPhone(raw: string): string {
  const n = normalizePhone(raw).replace(/[^\d]/g, "");
  if (n.length !== 11) return raw;
  return `+${n[0]} ${n.slice(1, 4)} ${n.slice(4, 7)}-${n.slice(7, 9)}-${n.slice(9, 11)}`;
}

/** Детерминированный хеш строки → 32-битное число. Нужен для «mock-бэкенда» слотов. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Быстрый seeded-PRNG (mulberry32) — стабильная «псевдослучайность» для расписания */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Прошёл ли слот — считается по времени площадки.
 *
 * Раньше здесь сравнивалось локальное время устройства/сервера: на телефоне
 * в другом поясе подсветка «прошло» съезжала на часы. Единственный верный
 * ориентир — бизнес-зона (см. lib/time.ts).
 */
export function isSlotPast(dateISO: string, time: string): boolean {
  return isSlotInPast(dateISO, time);
}

/** Плюрализация: 1 игрок / 2 игрока / 5 игроков */
export function pluralPlayers(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} игрок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} игрока`;
  return `${n} игроков`;
}

/* ───────────────────────────────────────────────────────────────────────────
   Файл календаря (.ics) для брони.

   Зачем: после брони человеку нужно не потерять дату. Кнопка «добавить
   в календарь» убирает риск забыть (а забытая бронь — это потерянный слот
   и потерянные деньги площадки). Файл собирается на клиенте, сервер не нужен.

   ВАЖНО ПРО ЧАСОВОЙ ПОЯС. Раньше время события собиралось через локальную
   дату устройства и помечалось как Asia/Almaty: у человека в Москве или
   Берлине событие вставало в календарь на несколько часов раньше реального
   старта. Теперь настенное время берётся прямо из строк брони («27.09»,
   «18:00») — это и есть время площадки, — а конечное время считается
   арифметикой по минутам, без пересчёта через зону устройства.
   ─────────────────────────────────────────────────────────────────────────── */

/** Экранирование значений по RFC 5545 (запятые и точки с запятой ломают .ics) */
function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildCalendarHref(options: {
  id: string;
  title: string;
  dateISO: string;
  time: string;
  durationMinutes: number;
  location: string;
  description: string;
}): string {
  const stamp = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Quest Horror Clinic//Booking//RU",
    "CALSCALE:GREGORIAN",
    // Календарь явно объявляет зону, в которой заданы DTSTART/DTEND
    `X-WR-TIMEZONE:${BUSINESS_TIMEZONE}`,
    "BEGIN:VEVENT",
    `UID:${options.id}@quest-horror-clinic`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${BUSINESS_TIMEZONE}:${businessIcsStamp(options.dateISO, options.time)}`,
    `DTEND;TZID=${BUSINESS_TIMEZONE}:${businessIcsStamp(options.dateISO, options.time, options.durationMinutes)}`,
    `SUMMARY:${icsEscape(options.title)}`,
    `LOCATION:${icsEscape(options.location)}`,
    `DESCRIPTION:${icsEscape(options.description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Выезжайте на квест",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

/** Плюрализация отзывов */
export function pluralReviews(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} отзыв`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} отзыва`;
  return `${n} отзывов`;
}

export function pluralSlots(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} места`;
  return `${n} мест`;
}
