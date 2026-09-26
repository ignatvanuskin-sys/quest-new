/**
 * СТРУКТУРНЫЕ ЛОГИ
 *
 * Требование к продакшену: по логам должно быть понятно, что произошло
 * с конкретной бронью, без чтения кода и без доступа к базе.
 * Поэтому события пишутся одной строкой JSON с фиксированным полем `event`.
 *
 * Жёсткое правило безопасности: в логи не попадают телефон, имя и другие
 * персональные данные. Для связи с конкретной бронью используется её
 * публичный номер (без ФИО и контактов) — этого достаточно для разбора
 * инцидента и безопасно для журнала.
 */

type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "booking_created"
  | "booking_duplicate"
  | "booking_failed"
  // Бронь не принята, потому что хранилище не может её сохранить: на serverless
  // без базы запись исчезает вместе с инстансом. Это отказ продажи, требующий
  // вмешательства, а не ошибка пользователя в данных.
  | "booking_rejected_storage_not_durable"
  | "booking_storage_not_durable"
  | "booking_cancelled"
  | "booking_status_changed"
  | "slot_unavailable"
  | "availability_provider_error"
  | "payment_started"
  | "payment_confirmed"
  | "payment_failed"
  | "payment_webhook_rejected"
  | "crm_sync_failed"
  | "notification_failed"
  | "notification_sent"
  | "rate_limited"
  | "storage_degraded"
  | "reminder_scan"
  | "reminder_enqueued";

interface LogPayload {
  /** Публичный номер брони, id квеста, ключ идемпотентности — без персональных данных */
  [key: string]: string | number | boolean | undefined;
}

/** Поля, которые нельзя писать в лог даже случайно */
const FORBIDDEN_KEYS = ["phone", "name", "customerName", "email", "comment", "password", "token"];

function sanitize(payload: LogPayload): LogPayload {
  const clean: LogPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.includes(key)) continue;
    if (typeof value === "string" && value.length > 200) {
      clean[key] = `${value.slice(0, 200)}…`;
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function write(level: LogLevel, event: LogEvent, payload: LogPayload = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitize(payload),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: LogEvent, payload?: LogPayload) => write("info", event, payload),
  warn: (event: LogEvent, payload?: LogPayload) => write("warn", event, payload),
  error: (event: LogEvent, payload?: LogPayload) => write("error", event, payload),
};
