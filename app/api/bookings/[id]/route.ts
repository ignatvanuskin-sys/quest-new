import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { changeBookingStatus, getBookingStorage } from "@/lib/bookings";
import { allowedTransitions, MANUAL_STATUSES, nextStatusHint } from "@/lib/domain/booking-status";
import { forbiddenOrigin, isSameOrigin } from "@/lib/http";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/bookings/:id — смена статуса брони из админки.
 *
 * Доступ только администратору, переходы проверяются машиной состояний.
 * Раньше эндпоинт принимал любой статус: случайный повторный клик по
 * «Проведена» или «Отменить» проходил молча и ломал отчётность.
 *
 * IDOR: найти чужую бронь «перебором id» нельзя — за эндпоинтом стоит сессия
 * администратора, а идентификаторы броней формируются криптографически,
 * а не по порядку.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  // Изменяющая операция по cookie: сначала проверяем, что запрос пришёл
  // с нашего же домена (вторая линия после sameSite=lax)
  if (!isSameOrigin(request)) return forbiddenOrigin();

  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, message: "Требуется вход" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ ok: false, message: "Неверное тело запроса" }, { status: 400 });
  }

  const status = body.status as BookingStatus | undefined;
  if (!status || !MANUAL_STATUSES.includes(status)) {
    return NextResponse.json(
      { ok: false, message: `Статус должен быть одним из: ${MANUAL_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const storage = getBookingStorage();
  const current = await storage.findById(id);
  if (!current) {
    return NextResponse.json({ ok: false, message: "Бронь не найдена" }, { status: 404 });
  }

  const result = await changeBookingStatus(id, status, "admin");
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: result.error,
        // Клиенту отдаём список допустимых шагов — интерфейсу не нужно
        // дублировать машину состояний у себя
        allowed: allowedTransitions(current.status),
        hint: nextStatusHint(current.status),
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, booking: result.record });
}

/**
 * GET /api/bookings/:id — одна бронь для админки.
 *
 * Публичного доступа к брони по номеру нет намеренно: номер брони человек
 * видит на экране успеха, и если бы он открывал чужие данные, это была бы
 * утечка персональных данных (IDOR).
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, message: "Требуется вход" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const booking = await getBookingStorage().findById(id);
  if (!booking) {
    return NextResponse.json({ ok: false, message: "Бронь не найдена" }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, booking },
    { headers: { "Cache-Control": "no-store" } },
  );
}
