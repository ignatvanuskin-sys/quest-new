import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { applyPayment, changeBookingStatus, getBookingStorage } from "@/lib/bookings";
import { forbiddenOrigin, isSameOrigin } from "@/lib/http";
import { log } from "@/lib/logger";
import { getPaymentProvider } from "@/lib/providers/payment";
import { notifyStatusChanged } from "@/lib/services/notifications";
import type { BookingRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const ADMIN_PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled"] as const;
type AdminPaymentStatus = (typeof ADMIN_PAYMENT_STATUSES)[number];

/**
 * POST /api/bookings/:id/payment — отметка о предоплате из админки.
 *
 * Назначение: администратор получил перевод и подтверждает факт оплаты.
 * Это реальная модель заведения, а не обход платёжной интеграции: пока
 * PAYMENT_API_URL не настроен, деньги приходят переводом, и подтвердить их
 * может только человек.
 *
 * Что эндпоинт делает осознанно:
 * • сохранённый статус платежа пишется в бронь (виден в панели и в списке);
 * • по флагу `confirm` бронь переводится в «подтверждена» — но только по
 *   правилам машины состояний, поэтому повторный клик безопасен;
 * • никакой «автоподтверждённой оплаты» от клиента: эндпоинт только админский.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, message: "Требуется вход" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: { paymentStatus?: string; confirm?: boolean; amount?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Неверное тело запроса" }, { status: 400 });
  }

  const status = body.paymentStatus as AdminPaymentStatus | undefined;
  if (!status || !ADMIN_PAYMENT_STATUSES.includes(status)) {
    return NextResponse.json(
      {
        ok: false,
        message: `Статус оплаты должен быть одним из: ${ADMIN_PAYMENT_STATUSES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const storage = getBookingStorage();
  const booking = await storage.findById(id);
  if (!booking) {
    return NextResponse.json({ ok: false, message: "Бронь не найдена" }, { status: 404 });
  }

  const provider = getPaymentProvider();
  const payment: NonNullable<BookingRecord["payment"]> = {
    ...booking.payment,
    provider: booking.payment?.provider ?? provider.id,
    status,
    // Сумму задаёт админ или берём итог брони: из браузера произвольную сумму не принимаем
    amount: typeof body.amount === "number" && body.amount >= 0 ? body.amount : booking.total,
    reference: booking.payment?.reference ?? `manual:${booking.id}`,
    updatedAt: new Date().toISOString(),
  };

  const updated = await applyPayment(id, payment);
  if (!updated) {
    return NextResponse.json({ ok: false, message: "Бронь не найдена" }, { status: 404 });
  }

  log.info(status === "paid" ? "payment_confirmed" : "payment_failed", {
    publicId: id,
    status,
    by: "admin",
  });

  let result = updated;

  if (status === "paid" && body.confirm) {
    const transition = await changeBookingStatus(id, "confirmed", "admin");
    if (transition.ok) {
      result = transition.record;
      void notifyStatusChanged(transition.record, "confirmed");
    } else {
      /* Оплата сохранена, но подтвердить не удалось (например, бронь уже
         отменена). Возвращаем и данные, и причину — молча «проглотить»
         это нельзя, администратор должен понять состояние. */
      return NextResponse.json(
        { ok: true, booking: result, warning: transition.error },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { ok: true, booking: result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
