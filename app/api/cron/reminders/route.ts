import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { runReminderSweep } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

/**
 * GET|POST /api/cron/reminders — проход планировщика.
 *
 * Зачем отдельный эндпоинт, а не таймер внутри процесса: на serverless
 * процесса-долгожителя нет, а на обычном сервере таймеры в приложении
 * мешают масштабированию и перезапускам. Проход инициируется извне
 * (cron хостинга или системный планировщик) — см. PRODUCTION.md.
 *
 * Доступ:
 * • заголовок Authorization: Bearer CRON_SECRET (основной способ);
 * • либо сессия администратора — чтобы владелец мог запустить проход
 *   кнопкой из панели, не зная секрета.
 *
 * Без CRON_SECRET эндпоинт закрыт для внешних вызовов: иначе любой желающий
 * мог бы рассылать напоминания сколько угодно раз.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const authorizedBySecret = Boolean(secret) && provided === secret;
  const authorizedByAdmin = await isAdmin();

  if (!authorizedBySecret && !authorizedByAdmin) {
    return NextResponse.json({ ok: false, message: "Требуется авторизация" }, { status: 401 });
  }

  const result = await runReminderSweep();
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
