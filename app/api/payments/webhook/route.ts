import { NextResponse } from "next/server";
import {
  applyPayment,
  changeBookingStatus,
  getBookingStorage,
} from "@/lib/bookings";
import { log } from "@/lib/logger";
import { getPaymentProvider } from "@/lib/providers/payment";
import { notifyStatusChanged } from "@/lib/services/notifications";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook — уведомление платёжного провайдера.
 *
 * Правила, без которых этот эндпоинт опасен:
 *
 * 1. Источник истины — вебхук, а не редирект клиента. Оплата «на экране
 *    успеха» ничего не подтверждает: браузер может вернуться на returnUrl
 *    и без платежа.
 *
 * 2. Подпись проверяется по СЫРОМУ телу запроса и сравнивается в постоянном
 *    времени. Тело запроса само по себе недоверенное, поэтому оно сначала
 *    проверяется, и только потом разбирается.
 *
 * 3. Обработка идемпотентна. Провайдеры повторяют вебхуки при таймауте,
 *    поэтому повтор того же события с тем же статусом возвращает ok и
 *    ничего не меняет. Отменить это можно только одним способом: делать
 *    операцию идемпотентной, а не «надеяться, что повтора не будет».
 *
 * 4. Ручной режим оплаты вебхуков не принимает вообще: предоплату
 *    подтверждает администратор, и внешний POST не может «оплатить» бронь.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "payment_webhook"), 60, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter, "Слишком много запросов");

  const provider = getPaymentProvider();

  // Читаем сырое тело: подпись считается именно по нему
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, message: "Не удалось прочитать тело запроса" }, { status: 400 });
  }

  const parsed = await provider.parseWebhook(rawBody, request.headers);
  if (!parsed.ok) {
    log.warn("payment_webhook_rejected", { provider: provider.id, reason: parsed.reason });
    // 400 без пояснения: наружу не сообщаем, что именно не совпало
    return NextResponse.json({ ok: false, message: "Событие не принято" }, { status: 400 });
  }

  const event = parsed.event;

  /* Ищем бронь по номеру платежа, а если провайдер вернул номер брони —
     сначала по нему. Второй запрос того же события найдёт уже обновлённую
     бронь и не сделает ничего. */
  const storage = getBookingStorage();
  let booking = event.bookingId ? await storage.findById(event.bookingId) : null;

  if (!booking) {
    const all = await storage.list();
    booking = all.find((record) => record.payment?.reference === event.reference) ?? null;
  }

  if (!booking) {
    /* Отвечаем 200: событие корректно подписано, но относится к платежу,
       которого у нас нет (например, тестовое). Повторять его бессмысленно. */
    log.warn("payment_webhook_rejected", { provider: provider.id, reason: "booking_not_found" });
    return NextResponse.json({ ok: true, ignored: true });
  }

  const alreadyProcessed =
    booking.payment?.reference === event.reference && booking.payment?.status === event.status;

  if (alreadyProcessed) {
    log.info("payment_confirmed", {
      publicId: booking.id,
      status: event.status,
      duplicate: true,
    });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const payment = {
    provider: provider.id,
    status: event.status,
    amount: event.amount ?? booking.payment?.amount,
    reference: event.reference,
    updatedAt: new Date().toISOString(),
  } as NonNullable<typeof booking.payment>;

  await applyPayment(booking.id, payment);

  if (event.status === "paid") {
    log.info("payment_confirmed", { publicId: booking.id, provider: provider.id });

    /* Оплата подтверждает бронь, но только по правилам машины состояний:
       из «отменена» или «проведена» назад пути нет. */
    if (booking.status === "new") {
      const result = await changeBookingStatus(booking.id, "confirmed", "payment-webhook");
      if (result.ok) void notifyStatusChanged(result.record, "confirmed");
    }
  } else if (event.status === "failed" || event.status === "cancelled" || event.status === "expired") {
    log.warn("payment_failed", { publicId: booking.id, status: event.status });
    /* Бронь не отменяем автоматически: клиент может оплатить другим способом.
       Администратор видит статус платежа в панели и решает сам. */
  }

  return NextResponse.json({ ok: true });
}
