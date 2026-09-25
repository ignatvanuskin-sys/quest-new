import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getBookingStorage } from "@/lib/bookings";
import { forbiddenOrigin, isSameOrigin } from "@/lib/http";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED: BookingStatus[] = ["new", "confirmed", "completed", "cancelled"];

/** PATCH /api/bookings/:id — смена статуса брони из админки */
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
  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json(
      { ok: false, message: `Статус должен быть одним из: ${ALLOWED.join(", ")}` },
      { status: 400 },
    );
  }

  const updated = await getBookingStorage().updateStatus(id, status);
  if (!updated) {
    return NextResponse.json({ ok: false, message: "Бронь не найдена" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, booking: updated });
}
