import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createBooking, getBookingStorage, saveCrmSync } from "@/lib/bookings";
import { isStaleUnconfirmed } from "@/lib/domain/booking-status";
import { tooManyRequests } from "@/lib/http";
import { log } from "@/lib/logger";
import { syncBookingToCrm } from "@/lib/providers/crm";
import { notifyNewBooking } from "@/lib/services/notifications";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { businessToday } from "@/lib/time";
import type { BookingStatus, FearModeId } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST /api/bookings — создание брони с публичной формы */
export async function POST(request: Request) {
  // Публичная форма: без ограничения один скрипт забивает базу фейковыми
  // заявками за минуту. Лимит щедрый для человека и жёсткий для бота.
  const limit = rateLimit(clientKey(request, "booking"), 12, 15 * 60 * 1000);
  if (!limit.ok) {
    log.warn("rate_limited", { scope: "booking_create", retryAfter: limit.retryAfter });
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

  /* Ключ идемпотентности приходит от формы и переиспользуется при повторе:
     двойное нажатие или повтор после обрыва сети не создаст вторую бронь. */
  const idempotencyKey =
    typeof payload.idempotencyKey === "string" && payload.idempotencyKey.length <= 80
      ? payload.idempotencyKey
      : undefined;

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
    idempotencyKey,
  });

  if (!result.ok || !result.record) {
    if (result.storageUnavailable) {
      /* Хранилище не может сохранить бронь. Без этого различия клиент получил бы
         экран «вы записаны», а заявка исчезла бы вместе с инстансом: площадка
         потеряла бы и клиента, и деньги. Отказываем честно и даём телефон. */
      log.error("booking_rejected_storage_not_durable", {
        quest: String(payload.questSlug ?? ""),
      });
      return NextResponse.json(
        {
          ok: false,
          retryable: false,
          message:
            "Онлайн-бронирование временно недоступно. Позвоните или напишите нам в WhatsApp — забронируем вручную за минуту.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

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
    /* Выгрузка во внешнюю систему и уведомление администратора идут после
       ответа клиенту: бронь уже сохранена, и ожидание чужого сервиса не
       должно заставлять человека смотреть на «отправляем…».
       Порядок важен: сначала фиксируем результат синхронизации в броне
       (чтобы администратор видел сбой), потом отправляем уведомление —
       в нём этот статус уже упоминается. */
    void (async () => {
      const crmSync = await syncBookingToCrm(result.record!);
      if (crmSync.status !== "skipped") {
        const updated = await saveCrmSync(result.record!.id, crmSync);
        await notifyNewBooking(updated ?? { ...result.record!, crmSync });
        return;
      }
      await notifyNewBooking(result.record!);
    })();
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

interface AdminStats {
  total: number;
  new: number;
  today: number;
  upcoming: number;
  revenue: number;
  /** Требуют внимания: новая бронь или бронь без подтверждённой предоплаты */
  needsAttention: number;
  /** Оплата подтверждена */
  paid: number;
  /** Не подтвердили, а время уже прошло */
  stale: number;
  /** Сколько сегодня людей по подтверждённым и новым броням */
  playersToday: number;
}

/** GET /api/bookings — список броней для админки с поиском и фильтрами */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, message: "Требуется вход" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as BookingStatus | null;
  const scope = url.searchParams.get("scope"); // today | upcoming | new | attention
  const date = url.searchParams.get("date"); // YYYY-MM-DD
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const today = businessToday();

  const storage = getBookingStorage();
  const all = await storage.list();
  let bookings = all;

  if (status) bookings = bookings.filter((booking) => booking.status === status);
  if (date) bookings = bookings.filter((booking) => booking.dateISO === date);

  if (scope === "today") bookings = bookings.filter((booking) => booking.dateISO === today);
  if (scope === "upcoming") bookings = bookings.filter((booking) => booking.dateISO >= today);
  if (scope === "new") bookings = bookings.filter((booking) => booking.status === "new");
  if (scope === "attention") {
    bookings = bookings.filter(
      (booking) =>
        booking.status === "new" ||
        isStaleUnconfirmed(booking) ||
        booking.payment?.status === "failed",
    );
  }

  /* Поиск по номеру брони, имени и телефону.
     Телефон сравниваем по цифрам: администратор набирает «8705…», а в базе
     номер лежит как «+7705…» — иначе поиск «не находит» существующую бронь. */
  if (query) {
    const digits = query.replace(/\D/g, "");
    bookings = bookings.filter((booking) => {
      if (booking.id.toLowerCase().includes(query)) return true;
      if (booking.name.toLowerCase().includes(query)) return true;
      if (digits.length >= 3 && booking.phone.replace(/\D/g, "").includes(digits)) return true;
      if (booking.questSlug.includes(query)) return true;
      return false;
    });
  }

  const active = all.filter((booking) => booking.status !== "cancelled");

  const stats: AdminStats = {
    total: all.length,
    new: all.filter((booking) => booking.status === "new").length,
    today: active.filter((booking) => booking.dateISO === today).length,
    upcoming: active.filter((booking) => booking.dateISO > today).length,
    revenue: active
      .filter((booking) => booking.status !== "expired")
      .reduce((sum, booking) => sum + booking.total, 0),
    needsAttention: all.filter(
      (booking) => booking.status === "new" || isStaleUnconfirmed(booking),
    ).length,
    paid: all.filter((booking) => booking.payment?.status === "paid").length,
    stale: all.filter((booking) => isStaleUnconfirmed(booking)).length,
    playersToday: active
      .filter((booking) => booking.dateISO === today)
      .reduce((sum, booking) => sum + booking.players, 0),
  };

  return NextResponse.json(
    { ok: true, bookings, stats, today },
    { headers: { "Cache-Control": "no-store" } },
  );
}
