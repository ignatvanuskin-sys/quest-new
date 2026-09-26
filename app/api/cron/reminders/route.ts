import { NextResponse } from "next/server";
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
 * Доступ — только заголовком `Authorization: Bearer CRON_SECRET`.
 * Раньше здесь же принималась сессия администратора, чтобы владелец мог
 * запустить проход кнопкой из панели: панели больше нет, значит и этого
 * пути нет. Второй способ авторизации здесь означал бы, что любой,
 * кто может войти в удалённую панель, запускает рассылку всем клиентам.
 *
 * Без CRON_SECRET эндпоинт закрыт для внешних вызовов: иначе любой желающий
 * мог бы рассылать напоминания сколько угодно раз.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const authorized = Boolean(secret) && provided === secret;

  if (!authorized) {
    return NextResponse.json({ ok: false, message: "Требуется авторизация" }, { status: 401 });
  }

  const result = await runReminderSweep();
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
