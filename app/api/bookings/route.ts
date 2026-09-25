import { NextResponse } from "next/server";
import { createBooking, getBookingStorage } from "@/lib/bookings";
import { isAdmin } from "@/lib/auth";
import { notifyNewBooking } from "@/lib/notify";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/http";
import type { BookingStatus, FearModeId } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST /api/bookings — создание брони с публичной формы */
export async function POST(request: Request) {
  // Публичная форма: без ограничения один скрипт забивает базу фейковыми
  // заявками за минуту. Лимит щедрый для человека и жёсткий для бота.
  const limit = rateLimit(clientKey(request, "booking"), 12, 15 * 60 * 1000);
  if (!limit.ok) {
    return tooManyRequests(
      limit.retryAfter,
      "Слишком много заявок с одного адреса. Подождите пару минут или напишите нам в WhatsApp — оформим бронь вручную.",
    );
  }

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Не удалось прочитать данные заявки. Обновите страницу и попробуйте снова." },
      { status: 400 },
    );
  }

  const result = await createBooking({
    questSlug: String(payload.questSlug ?? ""),
    players: Number(payload.players ?? 0),
    fearMode: String(payload.fearMode ?? "light") as FearModeId,
    dateISO: String(payload.dateISO ?? ""),
    time: String(payload.time ?? ""),
    extraIds: Array.isArray(payload.extraIds) ? payload.extraIds.map(String) : [],
    isBirthday: Boolean(payload.isBirthday),
    name: String(payload.name ?? "").slice(0, 120),
    phone: String(payload.phone ?? "").slice(0, 32),
    messenger: (["whatsapp", "telegram", "call"] as const).includes(
      payload.messenger as "whatsapp" | "telegram" | "call",
    )
      ? (payload.messenger as "whatsapp" | "telegram" | "call")
      : "whatsapp",
    comment: String(payload.comment ?? "").slice(0, 800),
  });

  if (!result.ok || !result.record) {
    return NextResponse.json(
      {
        ok: false,
        errors: result.errors ?? {},
        message: "Проверьте выделенные поля — заявка пока не сохранена.",
      },
      { status: 422 },
    );
  }

  if (!result.duplicate) {
    // Уведомление не должно блокировать ответ клиенту
    void notifyNewBooking(result.record);
  }

  return NextResponse.json(
    {
      ok: true,
      booking: result.record,
      duplicate: Boolean(result.duplicate),
      message: result.duplicate
        ? "Такая бронь уже есть — мы показали её вам, чтобы не создавать дубль."
        : undefined,
    },
    { status: result.duplicate ? 200 : 201 },
  );
}

/** GET /api/bookings — список для админки */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, message: "Требуется вход" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as BookingStatus | null;
  const scope = url.searchParams.get("scope"); // today | upcoming | new

  const storage = getBookingStorage();
  let bookings = await storage.list();

  if (status) bookings = bookings.filter((booking) => booking.status === status);

  const todayISO = new Date().toISOString().slice(0, 10);
  if (scope === "today") {
    bookings = bookings.filter((booking) => booking.dateISO === todayISO);
  }
  if (scope === "upcoming") {
    bookings = bookings.filter((booking) => booking.dateISO >= todayISO);
  }
  if (scope === "new") {
    bookings = bookings.filter((booking) => booking.status === "new");
  }

  const all = await storage.list();
  const stats = {
    total: all.length,
    new: all.filter((booking) => booking.status === "new").length,
    today: all.filter((booking) => booking.dateISO === todayISO && booking.status !== "cancelled").length,
    upcoming: all.filter((booking) => booking.dateISO > todayISO && booking.status !== "cancelled").length,
    revenue: all
      .filter((booking) => booking.status !== "cancelled")
      .reduce((sum, booking) => sum + booking.total, 0),
  };

  return NextResponse.json({ ok: true, bookings, stats }, { headers: { "Cache-Control": "no-store" } });
}
