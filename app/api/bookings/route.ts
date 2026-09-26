import { after, NextResponse } from "next/server";
import { createBooking, saveCrmSync } from "@/lib/bookings";
import { tooManyRequests } from "@/lib/http";
import { log } from "@/lib/logger";
import { syncBookingToCrm } from "@/lib/providers/crm";
import { notifyNewBooking } from "@/lib/services/notifications";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { FearModeId } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings — приём заявки с публичной формы бронирования.
 *
 * Это единственный способ создать бронь: панели администратора у сайта нет,
 * заявка уходит владельцу в Telegram или на вебхук, а подтверждает он её
 * перепиской в WhatsApp. Поэтому ответ здесь — только «приняли», и он
 * честно обещает дальнейшее действие, а не «бронь подтверждена».
 *
 * Намеренно НЕ реализовано: GET /api/bookings. Список броней с именами и
 * телефонами — это персональные данные клиентов, и публичный эндпоинт,
 * отдающий их по ссылке, — готовая утечка. Читать заявки должен только
 * владелец, через свой канал уведомлений.
 */

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
    /* Выгрузка во внешнюю систему и уведомление идут ПОСЛЕ ответа клиенту:
       бронь уже сохранена, и ожидание чужого сервиса не должно заставлять
       человека смотреть на «отправляем…».

       Раньше здесь стоял `void (async () => {…})()` — и это была критическая
       ошибка для serverless. Такой промис не удерживает инстанс: как только
       сервер отдал ответ HTTP, платформа могла закрыть функцию, и уведомление
       в Telegram просто не уходило. Клиент видел «заявка принята», заявка
       лежала в базе, а владелец её не получал — и не узнавал об этом.

       `after()` из next/server — штатный механизм Next.js для фоновой работы:
       платформа держит инстанс живым до завершения задачи, поэтому
       уведомление гарантированно дольше ответа клиенту. */
    after(async () => {
      try {
        const crmSync = await syncBookingToCrm(result.record!);
        if (crmSync.status !== "skipped") {
          const updated = await saveCrmSync(result.record!.id, crmSync);
          await notifyNewBooking(updated ?? { ...result.record!, crmSync });
          return;
        }
        await notifyNewBooking(result.record!);
      } catch (error) {
        /* Бронь уже сохранена, уведомление — нет. Ошибку не глотаем: если
           это повторится, владелец будет узнавать о заявках с задержкой в
           часы, и это заметят клиенты, а не разработчик. */
        log.error("notification_failed", {
          publicId: result.record!.id,
          channel: "post_booking",
          reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
        });
      }
    });
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
