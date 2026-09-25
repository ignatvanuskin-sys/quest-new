import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getFearMode, getQuest } from "./content";
import { computePrice } from "./pricing";
import type { BookingRecord, BookingSelection, BookingStatus } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  ХРАНИЛИЩЕ БРОНЕЙ (серверный модуль)
//
//  По умолчанию — JSON-файл в `.data/bookings.json` (удобно для VPS и разработки).
//  Если файловая система недоступна (например, serverless-хостинг),
//  автоматически включается in-memory режим: заявки живут до перезапуска процесса.
//
//  Как подключить настоящую базу: реализуйте интерфейс BookingStorage
//  под свою БД/Supabase/Postgres и передайте его в `setBookingStorage`.
//  Остальной код (API, админка) менять не нужно.
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingStorage {
  list(): Promise<BookingRecord[]>;
  save(record: BookingRecord): Promise<void>;
  updateStatus(id: string, status: BookingStatus): Promise<BookingRecord | null>;
  findBySlot(questSlug: string, dateISO: string, time: string): Promise<BookingRecord[]>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");

class FileStorage implements BookingStorage {
  private cache: BookingRecord[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private async read(): Promise<BookingRecord[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as BookingRecord[];
      this.cache = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  private async persist(records: BookingRecord[]): Promise<void> {
    this.cache = records;
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
    });
    await this.writeQueue;
  }

  async list(): Promise<BookingRecord[]> {
    const records = await this.read();
    return [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async save(record: BookingRecord): Promise<void> {
    const records = await this.read();
    if (records.some((r) => r.id === record.id)) return;
    await this.persist([record, ...records]);
  }

  async updateStatus(id: string, status: BookingStatus): Promise<BookingRecord | null> {
    const records = await this.read();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return null;
    const updated = { ...records[index], status };
    const next = [...records];
    next[index] = updated;
    await this.persist(next);
    return updated;
  }

  async findBySlot(questSlug: string, dateISO: string, time: string): Promise<BookingRecord[]> {
    const records = await this.read();
    return records.filter(
      (r) =>
        r.questSlug === questSlug &&
        r.dateISO === dateISO &&
        r.time === time &&
        r.status !== "cancelled",
    );
  }
}

class MemoryStorage implements BookingStorage {
  private records: BookingRecord[] = [];

  async list() {
    return [...this.records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async save(record: BookingRecord) {
    this.records = [record, ...this.records];
  }

  async updateStatus(id: string, status: BookingStatus) {
    const record = this.records.find((r) => r.id === id);
    if (!record) return null;
    record.status = status;
    return record;
  }

  async findBySlot(questSlug: string, dateISO: string, time: string) {
    return this.records.filter(
      (r) =>
        r.questSlug === questSlug &&
        r.dateISO === dateISO &&
        r.time === time &&
        r.status !== "cancelled",
    );
  }
}

let storage: BookingStorage = new FileStorage();

export function setBookingStorage(next: BookingStorage): void {
  storage = next;
}

export function getBookingStorage(): BookingStorage {
  return storage;
}

/** Резервный in-memory режим — вызывается, если запись на диск упала */
export function switchToMemoryStorage(): void {
  storage = new MemoryStorage();
}

// ─────────────────────────────────────────────────────────────────────────────
//  СОЗДАНИЕ БРОНИ
// ─────────────────────────────────────────────────────────────────────────────

export function generateBookingId(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const salt = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `HC-${stamp}${salt}`;
}

export type CreateBookingInput = BookingSelection;

export interface CreateBookingResult {
  ok: boolean;
  record?: BookingRecord;
  /** Совпадающая бронь — не создаём дубль */
  duplicate?: BookingRecord;
  errors?: Record<string, string>;
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const errors: Record<string, string> = {};

  const quest = getQuest(input.questSlug);
  if (!quest) errors.questSlug = "Такого квеста нет — выберите из каталога.";

  if (!input.dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) {
    errors.dateISO = "Выберите дату игры.";
  }
  if (!input.time || !/^\d{2}:\d{2}$/.test(input.time)) {
    errors.time = "Выберите время старта.";
  }
  if (quest) {
    if (input.players < quest.spec.playersMin || input.players > quest.spec.playersMax) {
      errors.players = `«${quest.title}» — от ${quest.spec.playersMin} до ${quest.spec.playersMax} игроков.`;
    }
    const mode = getFearMode(input.fearMode);
    if (!quest.fearModes.includes(input.fearMode)) {
      errors.fearMode = "Этот режим страха недоступен на выбранном квесте.";
    } else if (mode.minAge > 16 && quest.spec.ageMin < 16) {
      errors.fearMode = `Режим «${mode.name}» доступен с ${mode.minAge} лет.`;
    }
  }
  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Напишите, как к вам обращаться.";
  }
  const digits = (input.phone ?? "").replace(/\D/g, "");
  if (digits.length !== 11) {
    errors.phone = "Телефон в формате +7 777 000 00 00 — по нему администратор подтвердит бронь.";
  }
  if (!input.messenger) {
    errors.messenger = "Выберите, куда написать: WhatsApp, Telegram или звонок.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // Защита от дублей: та же команда на тот же слот
  const sameSlot = await storage.findBySlot(input.questSlug, input.dateISO, input.time);
  const duplicate = sameSlot.find(
    (r) => r.phone.replace(/\D/g, "") === digits,
  );
  if (duplicate) {
    return { ok: true, record: duplicate, duplicate };
  }

  const price = computePrice({
    questSlug: input.questSlug,
    players: input.players,
    extraIds: input.extraIds,
    isBirthday: input.isBirthday,
  });

  const record: BookingRecord = {
    ...input,
    id: generateBookingId(),
    total: price.total,
    extraNames: input.extraIds
      .map((id) => questExtrasName(id))
      .filter((name): name is string => Boolean(name)),
    priceBreakdown: price.lines,
    status: "new",
    createdAt: new Date().toISOString(),
  };

  try {
    await storage.save(record);
  } catch {
    switchToMemoryStorage();
    await storage.save(record);
  }

  return { ok: true, record };
}

function questExtrasName(id: string): string | null {
  // Локальный импорт, чтобы не тянуть весь контент в клиентский бандл
  const map: Record<string, string> = {
    "full-contact": "Максимум страха (полный контакт)",
    "corporate-docs": "Пакет документов для бухгалтерии",
    "photo-video": "Фото и видео с игры (по запросу)",
  };
  return map[id] ?? null;
}

/** Сколько мест занято по слотам на конкретную дату — для расчёта доступности */
export async function bookedSeatsByTime(
  questSlug: string,
  dateISO: string,
): Promise<Record<string, number>> {
  const records = await storage.list();
  return records
    .filter(
      (r) =>
        r.questSlug === questSlug && r.dateISO === dateISO && r.status !== "cancelled",
    )
    .reduce<Record<string, number>>((acc, record) => {
      acc[record.time] = (acc[record.time] ?? 0) + record.players;
      return acc;
    }, {});
}

/** Все занятые места по датам месяца — для точек в календаре */
export async function bookedSeatsByDate(
  questSlug: string,
): Promise<Record<string, Record<string, number>>> {
  const records = await storage.list();
  return records
    .filter((r) => r.questSlug === questSlug && r.status !== "cancelled")
    .reduce<Record<string, Record<string, number>>>((acc, record) => {
      acc[record.dateISO] = acc[record.dateISO] ?? {};
      acc[record.dateISO][record.time] = (acc[record.dateISO][record.time] ?? 0) + record.players;
      return acc;
    }, {});
}
