import { NextResponse } from "next/server";
import { availabilityMode } from "@/lib/availability";
import { getBookingStorage } from "@/lib/bookings";
import { getCrmProvider } from "@/lib/providers/crm";
import { getPaymentProvider } from "@/lib/providers/payment";
import { notificationsConfigured } from "@/lib/services/notifications";
import { BUSINESS_TIMEZONE, businessNowTime, businessToday } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — состояние приложения для мониторинга.
 *
 * Что здесь есть и чего здесь нет:
 *
 * • показываем, какие подсистемы включены, чтобы дежурный сразу понял,
 *   работает ли система в полном режиме или в резервном;
 * • НЕ показываем значения переменных, имена хостов, строки подключения и
 *   любые другие сведения, по которым можно атаковать сервис. Эндпоинт
 *   публичный, поэтому раскрывать ему нечего.
 *
 * Код ответа 200 означает «приложение живо и может принимать брони».
 * Резервные режимы (файловое хранилище, отсутствие внешних интеграций) —
 * не ошибка: система спроектирована работать без них.
 */
export async function GET() {
  const storage = getBookingStorage();
  const payment = getPaymentProvider();
  const crm = getCrmProvider();

  let storageOk = true;
  let storageMode = "file";
  try {
    const bookings = await storage.list();
    storageMode = storage.bookedSeatsByTime ? "sql" : "file";
    void bookings;
  } catch {
    storageOk = false;
  }

  const checks = {
    storage: { ok: storageOk, mode: storageMode },
    database: {
      ok: true,
      // База подключена, если хранилище умеет агрегаты напрямую (SQL-репозиторий)
      mode: storage.bookedSeatsByTime ? "connected" : "not_configured",
    },
    payments: {
      ok: true,
      mode: payment.kind,
      configured: payment.isConfigured(),
    },
    crm: {
      ok: true,
      mode: crm.external ? "external" : "internal",
      configured: crm.isConfigured(),
    },
    notifications: {
      ok: true,
      mode: notificationsConfigured() ? "configured" : "log_only",
    },
    availability: {
      ok: true,
      mode: availabilityMode(),
    },
  };

  return NextResponse.json(
    {
      ok: storageOk,
      time: {
        today: businessToday(),
        now: businessNowTime(),
        timezone: BUSINESS_TIMEZONE,
      },
      checks,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
