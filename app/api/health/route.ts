import { NextResponse } from "next/server";
import { availabilityMode } from "@/lib/availability";
import { getBookingStorage } from "@/lib/bookings";
import { inspectEnv } from "@/lib/config/env";
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

  /* Проверяем не только чтение, но и запись.
     Чтение пустого каталога не падает даже на файловой системе, доступной
     только для чтения, поэтому «список прочитался» ещё не значит, что бронь
     клиента сохранится. Для дежурного это разница между «работает» и
     «заявки теряются». */
  const writable = storage.probeWrite ? await storage.probeWrite().catch(() => false) : true;

  /* Serverless-платформа плюс файловое хранилище — это риск потери броней:
     каталог инстанса не общий и не переживает перезапуск. Прятать это нельзя,
     поэтому отдаём предупреждением, а не молчанием. */
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const durableWarnings: string[] = [];
  if (serverless && storageMode === "file") {
    durableWarnings.push(
      "Хранилище файловое на serverless-платформе: брони могут не пережить перезапуск инстанса. Задайте DATABASE_URL (см. PRODUCTION.md).",
    );
  }
  if (!writable) {
    durableWarnings.push(
      "Каталог данных недоступен для записи: брони не сохраняются. Задайте DATABASE_URL (см. PRODUCTION.md).",
    );
  }

  /* Конфигурация окружения. Секретов здесь нет по построению: inspectEnv
     возвращает только имена переменных и суть проблемы, но не значения. */
  const envReport = inspectEnv();

  const checks = {
    config: {
      ok: envReport.ok,
      missing: envReport.missingRequired.map((issue) => issue.variable),
      warn: envReport.warnings.map((issue) => issue.variable),
    },
    storage: { ok: storageOk && writable, mode: storageMode, writable },
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
      // Приложение считается здоровым, только если и хранилище переживает
      // перезапуск, и конфигурация не имеет критичных пропусков
      ok: storageOk && writable && envReport.ok,
      /* Короткий вердикт для дежурного: читается с первого взгляда, без
         разбора вложенных проверок. Главный вопрос после удаления панели —
         «дойдёт ли до меня заявка», и он вынесен в первую строку. */
      headline: notificationSummary(envReport),
      warnings: [
        ...durableWarnings,
        ...envReport.missingRequired.map((issue) => `${issue.variable}: ${issue.why}`),
        ...envReport.warnings.map((issue) => `${issue.variable}: ${issue.why}`),
      ],
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

/**
 * Короткий вердикт одним предложением: система работает / не работает и
 * из-за чего. Отдельная функция, потому что это первое, что читает человек
 * после открытия /api/health, а собирать его inline среди JSON-полей —
 * значит спрятать.
 */
function notificationSummary(report: ReturnType<typeof inspectEnv>): string {
  const delivered = notificationsConfigured();
  const durable = report.missingRequired.every((issue) => issue.variable !== "DATABASE_URL");

  if (!delivered) {
    return "НЕ РАБОТАЕТ: заявки сохраняются, но уведомления не настроены — вы их не увидите";
  }
  if (!durable) {
    return "НЕ РАБОТАЕТ: нет базы данных, заявки не переживут перезапуск";
  }
  return "Работает: заявка сохраняется и приходит в Telegram/вебхук";
}
