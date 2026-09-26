import { changeBookingStatus, getBookingStorage, markReminderSent } from "../bookings";
import { log } from "../logger";
import { minutesUntilSlot } from "../time";
import type { BookingRecord } from "../types";
import { notificationsConfigured, sendReminder, type ReminderKind } from "./notifications";

/* ───────────────────────────────────────────────────────────────────────────
   НАПОМИНАНИЯ И ИСТЕЧЕНИЕ БРОНЕЙ

   Зачем: забытая бронь — это пустой слот вечером и потерянная выручка.
   Схема — 24 часа и 2 часа до старта.

   Как это работает без инфраструктуры:
   • расчёт «кому пора напомнить» — чистая функция от времени площадки;
   • отправка идёт через тот же сервис уведомлений, что и новые брони:
     нет настроенного канала — сообщение уходит в журнал, а не в никуда;
   • отметка об отправке хранится в самой броне, поэтому повторный запуск
     планировщика не отправит то же напоминание дважды.

   Запуск: эндпоинт /api/cron/reminders по расписанию (см. PRODUCTION.md).
   Никаких таймеров в процессе приложения — на serverless они не живут.
   ─────────────────────────────────────────────────────────────────────────── */

export interface DueReminder {
  record: BookingRecord;
  kind: ReminderKind;
  minutesUntilStart: number;
}

/** Окна напоминаний в минутах: [от, до] */
const WINDOWS: Array<{ kind: ReminderKind; from: number; to: number }> = [
  { kind: "24h", from: 23 * 60, to: 24 * 60 + 30 },
  { kind: "2h", from: 90, to: 150 },
];

function isReminderSent(record: BookingRecord, kind: ReminderKind): boolean {
  return (record.remindersSent ?? []).includes(kind);
}

/** Кому пора напомнить — без отправки, чтобы это можно было проверить тестом */
export async function collectDueReminders(now: Date = new Date()): Promise<DueReminder[]> {
  const bookings = await getBookingStorage().list();
  const due: DueReminder[] = [];

  for (const record of bookings) {
    if (record.status !== "new" && record.status !== "confirmed") continue;

    const minutes = minutesUntilSlot(record.dateISO, record.time, now);
    if (minutes <= 0) continue;

    const window = WINDOWS.find(
      (item) => minutes >= item.from && minutes <= item.to && !isReminderSent(record, item.kind),
    );
    if (window) due.push({ record, kind: window.kind, minutesUntilStart: minutes });
  }

  return due;
}

export interface SweepResult {
  due: number;
  sent: number;
  /** Брони, которые не подтвердили, а время прошло */
  expired: number;
  /** Настроены ли каналы доставки: false означает, что напоминания только в журнале */
  channelsConfigured: boolean;
}

/**
 * Истёкшие брони.
 *
 * Бронь в статусе «ожидает подтверждения», время которой прошло больше
 * шести часов назад, не может остаться «новой»: она искажает и сводку,
 * и список «требуют внимания». Переход в «истекла» делается по машине
 * состояний (new → expired разрешён).
 */
const EXPIRY_GRACE_HOURS = 6;

export async function expireStaleBookings(now: Date = new Date()): Promise<number> {
  const bookings = await getBookingStorage().list();
  let expired = 0;

  for (const record of bookings) {
    if (record.status !== "new") continue;
    const minutes = minutesUntilSlot(record.dateISO, record.time, now);
    if (minutes > -EXPIRY_GRACE_HOURS * 60) continue;

    const result = await changeBookingStatus(
      record.id,
      "expired",
      "system",
    );
    if (result.ok) {
      expired += 1;
      log.info("booking_status_changed", {
        publicId: record.id,
        from: "new",
        to: "expired",
        by: "system",
      });
    }
  }

  return expired;
}

/** Полный проход планировщика: истечение + напоминания */
export async function runReminderSweep(now: Date = new Date()): Promise<SweepResult> {
  const expired = await expireStaleBookings(now);
  const due = await collectDueReminders(now);

  log.info("reminder_scan", {
    due: due.length,
    expired,
    channels: notificationsConfigured() ? "configured" : "log_only",
  });

  let sent = 0;
  for (const item of due) {
    try {
      await sendReminder(item.record, item.kind);
      await markReminderSent(item.record.id, item.kind);
      sent += 1;
      log.info("reminder_enqueued", {
        publicId: item.record.id,
        kind: item.kind,
        minutes: item.minutesUntilStart,
      });
    } catch (error) {
      // Одно сломанное напоминание не должно останавливать остальные
      log.error("notification_failed", {
        publicId: item.record.id,
        channel: "reminder",
        reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      });
    }
  }

  return { due: due.length, sent, expired, channelsConfigured: notificationsConfigured() };
}
