import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { SLOT_START_TIMES } from "./availability";
import { getFearMode, getQuest } from "./content";
import { canTransition } from "./domain/booking-status";
import { log } from "./logger";
import { computePrice } from "./pricing";
import { businessNowTime, businessToday, isSlotInPast } from "./time";
import type { BookingRecord, BookingSelection, BookingStatus } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  ХРАНИЛИЩЕ БРОНЕЙ (серверный модуль)
//
//  По умолчанию — JSON-файл в `.data/bookings.json` (удобно для VPS и разработки).
//  Если файловая система недоступна (например, serverless-хостинг),
//  автоматически включается in-memory режим: заявки живут до перезапуска процесса.
//
//  Для продакшена есть репозиторий PostgreSQL (lib/storage/postgres.ts):
//  он реализует тот же интерфейс BookingStorage, поэтому подключается одной
//  строкой (`setBookingStorage`) и не требует правок ни в API, ни в админке.
//
//  Что здесь добавлено к прежней версии и почему:
//
//   • withSlotLock — критическая секция слота. Проверка вместимости и запись
//     брони обязаны быть одной неделимой операцией, иначе два одновременных
//     запроса займут последнее место дважды. Для файла это очередь, для
//     PostgreSQL — advisory-замок на ключ слота (работает между процессами).
//
//   • idempotencyKey — двойной submit из формы (или повтор при обрыве сети)
//     не создаёт вторую бронь: вторая попытка возвращает уже созданную.
//
//   • statusHistory — кто и когда менял статус. Без истории невозможно
//     разобрать спор «мы подтверждали» / «мы не подтверждали».
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotLockContext {
  /** Сколько мест занято активными бронями в этом слоте */
  bookedSeats: number;
}

/** Служебные поля, которые можно менять точечно (без статуса и суммы) */
export interface BookingPatch {
  payment?: BookingRecord["payment"];
  crmSync?: BookingRecord["crmSync"];
  /** Метки отправленных напоминаний: «24h», «2h» */
  remindersSent?: string[];
}

export interface BookingStorage {
  list(): Promise<BookingRecord[]>;
  save(record: BookingRecord): Promise<void>;
  findById(id: string): Promise<BookingRecord | null>;
  findByIdempotencyKey(key: string): Promise<BookingRecord | null>;
  findBySlot(questSlug: string, dateISO: string, time: string): Promise<BookingRecord[]>;
  /** Смена статуса с записью в историю перехода */
  updateStatus(id: string, status: BookingStatus, by?: string, note?: string): Promise<BookingRecord | null>;
  /**
   * Точечное обновление служебных полей брони.
   *
   * Набор полей закрытый: так хранилище не превращается в «сохрани что угодно»
   * и невозможно случайно перезаписать сумму или контакты клиента.
   */
  updateRecord(id: string, patch: BookingPatch): Promise<BookingRecord | null>;
  /** Критическая секция слота */
  withSlotLock<T>(
    slot: { questSlug: string; dateISO: string; time: string },
    task: (context: SlotLockContext) => Promise<T>,
  ): Promise<T>;
  /**
   * Быстрый агрегат занятости. Необязателен: SQL-репозиторий считает сумму
   * одним запросом, файловое хранилище обходится сканированием небольшого
   * списка. Без него расчёт расписания вычитывал бы все брони в память.
   */
  bookedSeatsByTime?(questSlug: string, dateISO: string): Promise<Record<string, number>>;
  /**
   * Может ли хранилище реально записать данные.
   *
   * Нужен именно отдельной проверкой: чтение пустого каталога не падает даже
   * на файловой системе только для чтения (например, в serverless), поэтому
   * «список прочитался» ещё не значит «бронь сохранится». Проверка мониторинга
   * обязана отвечать на вопрос, который действительно важен: переживёт ли
   * заявка клиента перезапуск.
   */
  probeWrite?(): Promise<boolean>;
  bookedSeatsByDate?(questSlug: string): Promise<Record<string, Record<string, number>>>;
}

export function slotKey(slot: { questSlug: string; dateISO: string; time: string }): string {
  return `${slot.questSlug}|${slot.dateISO}|${slot.time}`;
}

function isActive(record: BookingRecord): boolean {
  return record.status !== "cancelled";
}

/**
 * Общая часть файлового и in-memory хранилища.
 *
 * Разница только в том, куда уходит состояние, поэтому логика работы со
 * списком броней и очередь слотов живут здесь, а не дублируются в двух местах.
 */
abstract class BaseBookingStorage implements BookingStorage {
  private chains = new Map<string, Promise<void>>();

  protected abstract read(): Promise<BookingRecord[]>;
  protected abstract persist(records: BookingRecord[]): Promise<void>;

  async list(): Promise<BookingRecord[]> {
    const records = await this.read();
    return [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async findById(id: string): Promise<BookingRecord | null> {
    const records = await this.read();
    return records.find((record) => record.id === id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<BookingRecord | null> {
    if (!key) return null;
    const records = await this.read();
    return records.find((record) => record.idempotencyKey === key) ?? null;
  }

  async findBySlot(questSlug: string, dateISO: string, time: string): Promise<BookingRecord[]> {
    const records = await this.read();
    return records.filter(
      (record) =>
        record.questSlug === questSlug &&
        record.dateISO === dateISO &&
        record.time === time &&
        isActive(record),
    );
  }

  async save(record: BookingRecord): Promise<void> {
    const records = await this.read();
    if (records.some((existing) => existing.id === record.id)) return;
    await this.persist([record, ...records]);
  }

  async updateStatus(
    id: string,
    status: BookingStatus,
    by = "admin",
    note?: string,
  ): Promise<BookingRecord | null> {
    const records = await this.read();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) return null;

    const current = records[index];
    const history = [
      ...(current.statusHistory ?? []),
      { status, at: new Date().toISOString(), by, ...(note ? { note } : {}) },
    ];
    const updated: BookingRecord = { ...current, status, statusHistory: history };
    const next = [...records];
    next[index] = updated;
    await this.persist(next);
    return updated;
  }

  async updateRecord(id: string, patch: BookingPatch): Promise<BookingRecord | null> {
    const records = await this.read();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) return null;

    const updated: BookingRecord = { ...records[index], ...patch };
    const next = [...records];
    next[index] = updated;
    await this.persist(next);
    return updated;
  }

  /**
   * Очередь по слоту.
   *
   * Ключ очереди — конкретный слот, а не весь сервис: брони на разные слоты
   * не должны ждать друг друга. Внутри критической секции занятость читается
   * заново, поэтому «прочитал устаревшее состояние и записал поверх» невозможно.
   */
  withSlotLock<T>(
    slot: { questSlug: string; dateISO: string; time: string },
    task: (context: SlotLockContext) => Promise<T>,
  ): Promise<T> {
    const key = slotKey(slot);
    const previous = this.chains.get(key) ?? Promise.resolve();

    const run = previous.then(async () => {
      const records = await this.findBySlot(slot.questSlug, slot.dateISO, slot.time);
      const bookedSeats = records.reduce((sum, record) => sum + record.players, 0);
      return task({ bookedSeats });
    });

    const guarded = run.then(
      () => undefined,
      () => undefined,
    );
    this.chains.set(key, guarded);
    void guarded.then(() => {
      if (this.chains.get(key) === guarded) this.chains.delete(key);
    });

    return run;
  }
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");

class FileStorage extends BaseBookingStorage {
  private cache: BookingRecord[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  protected async read(): Promise<BookingRecord[]> {
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

  protected async persist(records: BookingRecord[]): Promise<void> {
    this.cache = records;
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
    });
    await this.writeQueue;
  }

  /**
   * Пробная запись в каталог данных.
   *
   * Зачем: на serverless-хостинге каталог приложения обычно доступен только
   * для чтения, а на некоторых платформах — для записи, но не переживает
   * перезапуск инстанса. В обоих случаях бронь, созданная клиентом, исчезнет,
   * поэтому мониторинг обязан это показать, а не рапортовать «всё в порядке».
   *
   * Пробный файл удаляется сразу и не мешает основному файлу броней.
   */
  async probeWrite(): Promise<boolean> {
    const probe = path.join(DATA_DIR, `.write-probe-${process.pid}`);
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(probe, "ok", "utf8");
      await unlink(probe);
      return true;
    } catch {
      return false;
    }
  }
}

class MemoryStorage extends BaseBookingStorage {
  private records: BookingRecord[] = [];

  protected async read(): Promise<BookingRecord[]> {
    return this.records;
  }

  protected async persist(records: BookingRecord[]): Promise<void> {
    this.records = records;
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

/** Публичный идентификатор брони. Формируется криптографически, а не Math.random() */
export function generateBookingId(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const salt = randomBytes(6).toString("hex").toUpperCase().slice(0, 6);
  return `HC-${stamp}${salt}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  СОЗДАНИЕ БРОНИ
// ─────────────────────────────────────────────────────────────────────────────

export type CreateBookingInput = BookingSelection & {
  /** Ключ идемпотентности от клиента: защита от двойного нажатия и повторов */
  idempotencyKey?: string;
};

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
    if (!quest.fearModes.includes(input.fearMode)) {
      errors.fearMode = "Этот режим страха недоступен на выбранном квесте.";
    } else {
      const mode = getFearMode(input.fearMode);
      if (mode.minAge > 16 && quest.spec.ageMin < 16) {
        errors.fearMode = `Режим «${mode.name}» доступен с ${mode.minAge} лет.`;
      }
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
    log.warn("booking_failed", { quest: input.questSlug, reason: "validation", fields: Object.keys(errors).join(",") });
    return { ok: false, errors };
  }

  // ── Повторная отправка той же заявки ──────────────────────────────────────
  // Два независимых признака дубля: ключ идемпотентности (клиент сказал
  // «это тот же запрос») и совпадение слот+телефон (человек нажал дважды,
  // но ключ не передал).
  if (input.idempotencyKey) {
    const byKey = await storage.findByIdempotencyKey(input.idempotencyKey);
    if (byKey) {
      log.info("booking_duplicate", { publicId: byKey.id, via: "idempotency_key" });
      return { ok: true, record: byKey, duplicate: byKey };
    }
  }

  const sameSlot = await storage.findBySlot(input.questSlug, input.dateISO, input.time);
  const byPhone = sameSlot.find((record) => record.phone.replace(/\D/g, "") === digits);
  if (byPhone) {
    log.info("booking_duplicate", { publicId: byPhone.id, via: "slot_phone" });
    return { ok: true, record: byPhone, duplicate: byPhone };
  }

  // ── Слот: проверяется на сервере, а не только в интерфейсе ───────────────
  if (!SLOT_START_TIMES.includes(input.time as (typeof SLOT_START_TIMES)[number])) {
    log.warn("booking_failed", { quest: input.questSlug, reason: "slot_not_in_grid" });
    return {
      ok: false,
      errors: { time: "Такого времени нет в расписании — выберите из доступных." },
    };
  }

  if (isSlotInPast(input.dateISO, input.time)) {
    log.warn("booking_failed", { quest: input.questSlug, reason: "slot_in_past" });
    return { ok: false, errors: { time: "Это время уже прошло — выберите другое." } };
  }

  // Цена считается только на сервере: сумму из браузера не принимаем вообще
  const price = computePrice({
    questSlug: input.questSlug,
    players: input.players,
    extraIds: input.extraIds,
    isBirthday: input.isBirthday,
  });

  const now = new Date();
  const record: BookingRecord = {
    ...input,
    id: generateBookingId(),
    total: price.total,
    extraNames: input.extraIds.map(questExtrasName).filter((name): name is string => Boolean(name)),
    priceBreakdown: price.lines,
    status: "new",
    statusHistory: [{ status: "new", at: now.toISOString(), by: "customer" }],
    payment: { provider: "manual", status: "pending" },
    createdAt: now.toISOString(),
  };

  /* Критическая секция: проверка вместимости и запись — одна операция.
     Раньше между проверкой и записью был зазор, в который пролезали
     две параллельные брони на последнее место. */
  const outcome = await storage.withSlotLock(
    { questSlug: input.questSlug, dateISO: input.dateISO, time: input.time },
    async ({ bookedSeats }) => {
      const capacity = quest?.spec.playersMax ?? 15;
      const seatsLeft = capacity - bookedSeats;

      if (seatsLeft <= 0) {
        return {
          ok: false as const,
          errors: { time: "Этот слот только что заняли. Выберите другое время — свободные места есть рядом." },
        };
      }
      if (seatsLeft < input.players) {
        return {
          ok: false as const,
          errors: {
            time: `В этом слоте свободно ${seatsLeft} из ${capacity} мест, а в заявке ${input.players}. Уменьшите команду или выберите другое время.`,
          },
        };
      }

      try {
        await storage.save(record);
      } catch {
        // Диск недоступен — заявку нельзя терять: продолжаем в памяти
        // и помечаем деградацию в логах, чтобы это не осталось незамеченным
        switchToMemoryStorage();
        await storage.save(record);
        log.warn("storage_degraded", { reason: "file_write_failed", publicId: record.id });
      }

      return { ok: true as const, record };
    },
  );

  if (!outcome.ok) {
    log.warn("slot_unavailable", {
      quest: input.questSlug,
      date: input.dateISO,
      time: input.time,
      players: input.players,
    });
    return { ok: false, errors: outcome.errors };
  }

  log.info("booking_created", {
    publicId: record.id,
    quest: record.questSlug,
    date: record.dateISO,
    time: record.time,
    players: record.players,
    total: record.total,
  });

  return { ok: true, record };
}

function questExtrasName(id: string): string | null {
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
  if (storage.bookedSeatsByTime) return storage.bookedSeatsByTime(questSlug, dateISO);

  const records = await storage.list();
  return records
    .filter((record) => record.questSlug === questSlug && record.dateISO === dateISO && isActive(record))
    .reduce<Record<string, number>>((acc, record) => {
      acc[record.time] = (acc[record.time] ?? 0) + record.players;
      return acc;
    }, {});
}

/** Все занятые места по датам месяца — для точек в календаре */
export async function bookedSeatsByDate(
  questSlug: string,
): Promise<Record<string, Record<string, number>>> {
  if (storage.bookedSeatsByDate) return storage.bookedSeatsByDate(questSlug);

  const records = await storage.list();
  return records
    .filter((record) => record.questSlug === questSlug && isActive(record))
    .reduce<Record<string, Record<string, number>>>((acc, record) => {
      acc[record.dateISO] = acc[record.dateISO] ?? {};
      acc[record.dateISO][record.time] = (acc[record.dateISO][record.time] ?? 0) + record.players;
      return acc;
    }, {});
}

/** Критическая секция слота для внешних модулей (провайдер расписания) */
export function withSlotLock<T>(
  slot: { questSlug: string; dateISO: string; time: string },
  task: (context: SlotLockContext) => Promise<T>,
): Promise<T> {
  return storage.withSlotLock(slot, task);
}

/**
 * Смена статуса брони с проверкой допустимости перехода.
 *
 * Проверка живёт здесь, а не только в админке: админский API — не единственный
 * возможный вызывающий, и «проведена → отменена» не должно проходить ни при
 * каком сценарии.
 */
export async function changeBookingStatus(
  id: string,
  status: BookingStatus,
  by = "admin",
): Promise<{ ok: true; record: BookingRecord } | { ok: false; error: string }> {
  const current = await storage.findById(id);
  if (!current) return { ok: false, error: "Бронь не найдена" };

  if (!canTransition(current.status, status)) {
    return {
      ok: false,
      error: `Из статуса «${current.status}» нельзя перейти в «${status}».`,
    };
  }

  const updated = await storage.updateStatus(id, status, by);
  if (!updated) return { ok: false, error: "Бронь не найдена" };

  log.info("booking_status_changed", { publicId: id, from: current.status, to: status, by });
  if (status === "cancelled") log.info("booking_cancelled", { publicId: id, by });

  return { ok: true, record: updated };
}

/** Применить данные оплаты к брони (используется вебхуком и админкой) */
export function applyPayment(
  id: string,
  payment: NonNullable<BookingRecord["payment"]>,
): Promise<BookingRecord | null> {
  return storage.updateRecord(id, { payment });
}

/** Зафиксировать результат выгрузки во внешнюю систему учёта */
export function saveCrmSync(
  id: string,
  crmSync: NonNullable<BookingRecord["crmSync"]>,
): Promise<BookingRecord | null> {
  return storage.updateRecord(id, { crmSync });
}

/** Отметить, что напоминание отправлено — чтобы не отправить его дважды */
export async function markReminderSent(id: string, kind: string): Promise<void> {
  const record = await storage.findById(id);
  if (!record) return;
  const sent = new Set([...(record.remindersSent ?? []), kind]);
  await storage.updateRecord(id, { remindersSent: [...sent] });
}

/** Текущее время площадки — для админских сводок */
export { businessNowTime, businessToday };
