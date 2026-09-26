import { getLocation, getQuest } from "../content";
import { log } from "../logger";
import type { BookingRecord, BookingStatus } from "../types";
import type { BookingPatch, BookingStorage, SlotLockContext } from "../bookings";
import type { SqlClient, SqlExecutor } from "./sql-executor";

/* ───────────────────────────────────────────────────────────────────────────
   РЕПОЗИТОРИЙ БРОНЕЙ НА POSTGRES

   Что здесь принципиально важно для продакшена:

   • атомарность. Создание брони идёт внутри транзакции, а слот блокируется
     advisory-замком PostgreSQL на ключ «квест + дата + время». Два сервера
     (или два процесса) не смогут одновременно занять последние места —
     проверка вместимости и вставка происходят в одной критической секции.

   • защита от дублей на уровне базы, а не кода: уникальные индексы
     на (квест, дата, время, телефон) и на ключ идемпотентности. Даже если
     приложение ошибётся, база не даст создать вторую такую же бронь.

   • снимок цены. Сумма, строки расчёта и название квеста сохраняются в брони,
     поэтому изменение прайса не переписывает историю.

   Файл не зависит от конкретного драйвера: работает через SqlClient.
   Если `pg` не установлен или база недоступна — приложение продолжает
   работать на файловом хранилище (см. lib/bookings.ts).
   ─────────────────────────────────────────────────────────────────────────── */

interface BookingRow {
  id: string;
  public_id: string;
  quest_slug: string;
  quest_title: string;
  location_id: string;
  date_iso: string | Date;
  start_time: string;
  players: number;
  fear_mode: string;
  customer_name: string;
  customer_phone: string;
  messenger: string;
  comment: string;
  extras: string[] | null;
  extra_names: string[] | null;
  price_breakdown: BookingRecord["priceBreakdown"] | null;
  is_birthday: boolean;
  total_price: number;
  status: BookingStatus;
  status_history: BookingRecord["statusHistory"] | null;
  payment: BookingRecord["payment"] | null;
  idempotency_key: string | null;
  crm_sync: BookingRecord["crmSync"] | null;
  reminders_sent: string[] | null;
  created_at: string | Date;
}

/** Дата из Postgres приходит как Date или строкой — приводим к YYYY-MM-DD без сдвига зоны */
function toIsoDate(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Время приходит как HH:MM:SS — обрезаем секунды */
function toHhMm(value: string): string {
  return value.slice(0, 5);
}

/** Статус брони → статус в журнале платежей (набор значений уже базы) */
function normalizePaymentStatus(status: string): string {
  if (status === "paid" || status === "failed" || status === "cancelled") return status;
  return "pending";
}

/** Преобразование строки базы в запись приложения. Экспортируется для тестов. */
export function mapBookingRow(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    questSlug: row.quest_slug,
    players: row.players,
    fearMode: row.fear_mode as BookingRecord["fearMode"],
    dateISO: toIsoDate(row.date_iso),
    time: toHhMm(row.start_time),
    extraIds: Array.isArray(row.extras) ? row.extras : [],
    extraNames: Array.isArray(row.extra_names) ? row.extra_names : [],
    priceBreakdown: Array.isArray(row.price_breakdown) ? row.price_breakdown : [],
    isBirthday: row.is_birthday,
    name: row.customer_name,
    phone: row.customer_phone,
    messenger: row.messenger as BookingRecord["messenger"],
    comment: row.comment ?? "",
    total: row.total_price,
    status: row.status,
    statusHistory: row.status_history ?? undefined,
    payment: row.payment ?? undefined,
    idempotencyKey: row.idempotency_key ?? undefined,
    crmSync: row.crm_sync ?? undefined,
    remindersSent: Array.isArray(row.reminders_sent) ? row.reminders_sent : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const COLUMNS = `id, public_id, quest_slug, quest_title, location_id, date_iso, start_time,
  players, fear_mode, customer_name, customer_phone, messenger, comment, extras,
  extra_names, price_breakdown, is_birthday, total_price, status, status_history,
  payment, idempotency_key, crm_sync, reminders_sent, created_at`;

export class PostgresBookingRepository implements BookingStorage {
  constructor(private readonly client: SqlClient) {}

  private async run<Row>(text: string, params: unknown[] = []): Promise<Row[]> {
    const result = await this.client.query<Row>(text, params);
    return result.rows;
  }

  async list(): Promise<BookingRecord[]> {
    const rows = await this.run<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings ORDER BY created_at DESC LIMIT 2000`,
    );
    return rows.map(mapBookingRow);
  }

  async findById(id: string): Promise<BookingRecord | null> {
    const rows = await this.run<BookingRow>(`SELECT ${COLUMNS} FROM bookings WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ? mapBookingRow(rows[0]) : null;
  }

  async findByPublicId(publicId: string): Promise<BookingRecord | null> {
    const rows = await this.run<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings WHERE public_id = $1 LIMIT 1`,
      [publicId],
    );
    return rows[0] ? mapBookingRow(rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<BookingRecord | null> {
    if (!key) return null;
    const rows = await this.run<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings WHERE idempotency_key = $1 LIMIT 1`,
      [key],
    );
    return rows[0] ? mapBookingRow(rows[0]) : null;
  }

  async findBySlot(questSlug: string, dateISO: string, time: string): Promise<BookingRecord[]> {
    const rows = await this.run<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
        WHERE quest_slug = $1 AND date_iso = $2::date AND start_time = $3::time
          AND status <> 'cancelled'`,
      [questSlug, dateISO, time],
    );
    return rows.map(mapBookingRow);
  }

  /** Сколько мест занято в слоте (без отменённых) */
  async bookedSeats(executor: SqlExecutor, questSlug: string, dateISO: string, time: string): Promise<number> {
    const result = await executor.query<{ occupied: string | number | null }>(
      `SELECT COALESCE(SUM(players), 0) AS occupied
         FROM bookings
        WHERE quest_slug = $1 AND date_iso = $2::date AND start_time = $3::time
          AND status <> 'cancelled'`,
      [questSlug, dateISO, time],
    );
    return Number(result.rows[0]?.occupied ?? 0);
  }

  /**
   * Занятость по всем слотам дня — одним агрегирующим запросом.
   *
   * Реализует «быстрый путь» интерфейса BookingStorage: без него расчёт
   * расписания тянул бы из базы весь список броней на каждый запрос страницы.
   */
  async bookedSeatsByTime(questSlug: string, dateISO: string): Promise<Record<string, number>> {
    const rows = await this.run<{ start_time: string; occupied: string | number }>(
      `SELECT start_time::text AS start_time, COALESCE(SUM(players), 0) AS occupied
         FROM bookings
        WHERE quest_slug = $1 AND date_iso = $2::date AND status <> 'cancelled'
        GROUP BY start_time`,
      [questSlug, dateISO],
    );

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[toHhMm(row.start_time)] = Number(row.occupied);
      return acc;
    }, {});
  }

  /** Занятость по датам месяца — для точек в календаре (быстрый путь) */
  async bookedSeatsByDate(questSlug: string): Promise<Record<string, Record<string, number>>> {
    const rows = await this.run<{ date_iso: string | Date; start_time: string; occupied: string | number }>(
      `SELECT date_iso, start_time::text AS start_time, COALESCE(SUM(players), 0) AS occupied
         FROM bookings
        WHERE quest_slug = $1 AND status <> 'cancelled' AND date_iso >= CURRENT_DATE - 1
        GROUP BY date_iso, start_time`,
      [questSlug],
    );

    return rows.reduce<Record<string, Record<string, number>>>((acc, row) => {
      const date = toIsoDate(row.date_iso);
      acc[date] = acc[date] ?? {};
      acc[date][toHhMm(row.start_time)] = Number(row.occupied);
      return acc;
    }, {});
  }

  /**
   * Критическая секция слота: транзакция + advisory-замок.
   *
   * `pg_advisory_xact_lock` держит блокировку до конца транзакции, поэтому
   * проверка вместимости и вставка брони физически не могут разойтись.
   * Ключ замка — хэш от «квест + дата + время», то есть блокируются только
   * конфликтующие слоты, а не вся таблица.
   *
   * ВАЖНО: блокировка работает между процессами и серверами — именно это
   * отличает её от очереди в памяти, которая защищает только один инстанс.
   */
  async withSlotLock<T>(
    slot: { questSlug: string; dateISO: string; time: string },
    task: (context: SlotLockContext) => Promise<T>,
  ): Promise<T> {
    const lockKey = `${slot.questSlug}|${slot.dateISO}|${slot.time}`;

    return this.client.transaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
      const bookedSeats = await this.bookedSeats(tx, slot.questSlug, slot.dateISO, slot.time);
      return task({ bookedSeats });
    });
  }

  async save(record: BookingRecord): Promise<void> {
    const quest = getQuest(record.questSlug);
    const location = quest ? getLocation(quest.locationId) : null;

    await this.client.query(
      `INSERT INTO bookings (
          id, public_id, quest_slug, quest_title, location_id, date_iso, start_time,
          players, fear_mode, customer_name, customer_phone, messenger, comment,
          extras, extra_names, price_breakdown, is_birthday, total_price, status,
          status_history, payment, idempotency_key, crm_sync, reminders_sent
       ) VALUES (
          $1, $2, $3, $4, $5, $6::date, $7::time,
          $8, $9, $10, $11, $12, $13,
          $14::text[], $15::text[], $16::jsonb, $17, $18, $19,
          $20::jsonb, $21::jsonb, $22, $23::jsonb, $24::text[]
       )
       ON CONFLICT (public_id) DO NOTHING`,
      [
        record.id,
        record.id,
        record.questSlug,
        // Снимок названия и адреса: если бизнес переименует квест, история не «поедет»
        quest?.title ?? record.questSlug,
        location?.id ?? quest?.locationId ?? "unknown",
        record.dateISO,
        record.time,
        record.players,
        record.fearMode,
        record.name,
        record.phone,
        record.messenger,
        record.comment,
        record.extraIds,
        record.extraNames,
        JSON.stringify(record.priceBreakdown ?? []),
        record.isBirthday,
        record.total,
        record.status,
        JSON.stringify(record.statusHistory ?? []),
        JSON.stringify(record.payment ?? {}),
        record.idempotencyKey ?? null,
        JSON.stringify(record.crmSync ?? {}),
        record.remindersSent ?? [],
      ],
    );
  }

  /** Смена статуса с записью в историю: история ведётся в самой базе */
  async updateStatus(
    id: string,
    status: BookingStatus,
    by = "admin",
    note?: string,
  ): Promise<BookingRecord | null> {
    const entry = { status, at: new Date().toISOString(), by, ...(note ? { note } : {}) };

    const rows = await this.run<BookingRow>(
      `UPDATE bookings
          SET status = $2,
              status_history = COALESCE(status_history, '[]'::jsonb) || $3::jsonb,
              updated_at = now()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, status, JSON.stringify([entry])],
    );

    if (!rows[0]) return null;
    log.info("booking_status_changed", { publicId: id, status, by });
    return mapBookingRow(rows[0]);
  }

  /**
   * Точечное обновление служебных полей.
   *
   * Колонки подставляются из закрытого списка, а не из тела запроса: значения
   * уходят параметрами, имена колонок — константы, поэтому SQL-инъекция
   * невозможна по построению.
   *
   * Платёж дополнительно попадает в таблицу payments — это журнал для сверки
   * с провайдером. Уникальный индекс (provider, provider_payment_id) делает
   * повторную обработку вебхука безопасной: вторая запись не появится.
   */
  async updateRecord(id: string, patch: BookingPatch): Promise<BookingRecord | null> {
    const assignments: string[] = [];
    const values: unknown[] = [id];

    if (patch.payment !== undefined) {
      values.push(JSON.stringify(patch.payment));
      assignments.push(`payment = $${values.length}::jsonb`);
    }
    if (patch.crmSync !== undefined) {
      values.push(JSON.stringify(patch.crmSync));
      assignments.push(`crm_sync = $${values.length}::jsonb`);
    }
    if (patch.remindersSent !== undefined) {
      values.push(patch.remindersSent);
      assignments.push(`reminders_sent = $${values.length}::text[]`);
    }

    if (assignments.length === 0) return this.findById(id);

    const rows = await this.run<BookingRow>(
      `UPDATE bookings SET ${assignments.join(", ")}, updated_at = now()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      values,
    );

    if (!rows[0]) return null;

    const payment = patch.payment;
    if (payment?.reference) {
      await this.client
        .query(
          `INSERT INTO payments (id, booking_public_id, provider, provider_payment_id, status, amount, raw_payload)
           VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)
           ON CONFLICT (provider, provider_payment_id) DO NOTHING`,
          [
            `pay-${payment.reference}`.slice(0, 60),
            id,
            payment.provider,
            payment.reference,
            normalizePaymentStatus(payment.status),
            payment.amount ?? 0,
          ],
        )
        .catch((error: unknown) => {
          // Журнал платежей не должен ломать подтверждение брони
          log.warn("payment_failed", {
            publicId: id,
            reason: error instanceof Error ? error.message.slice(0, 120) : "payments_insert_failed",
          });
        });
    }

    return mapBookingRow(rows[0]);
  }

  /** Напоминания: брони, до которых осталось указанное число часов */
  async findUpcomingForReminders(windowStartIso: string, windowEndIso: string): Promise<BookingRecord[]> {
    const rows = await this.run<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
        WHERE status IN ('new', 'confirmed')
          AND (date_iso + start_time) BETWEEN $1::timestamp AND $2::timestamp
        ORDER BY date_iso, start_time`,
      [windowStartIso, windowEndIso],
    );
    return rows.map(mapBookingRow);
  }

  close(): Promise<void> {
    return this.client.close();
  }
}

