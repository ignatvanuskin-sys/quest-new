import { getFearMode, getLocation, getQuest } from "./content";
import { formatKzt, formatLongDate, prettyPhone } from "./utils";
import type { BookingRecord } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Уведомления о новых бронях.
//
//  Если заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID — заявка уходит
//  сообщением в Telegram-чат отдела бронирования (мгновенно, ничего не теряется).
//  Если нет — просто пишем в лог сервера: заявка всё равно лежит в базе
//  и видна в /admin.
// ─────────────────────────────────────────────────────────────────────────────

export function bookingToMessage(record: BookingRecord): string {
  const quest = getQuest(record.questSlug);
  const location = quest ? getLocation(quest.locationId) : null;
  const mode = getFearMode(record.fearMode);

  return [
    `🩸 НОВАЯ БРОНЬ ${record.id}`,
    ``,
    `Квест: ${quest?.title ?? record.questSlug}`,
    location ? `Адрес: ${location.address} (${location.label})` : "",
    `Дата: ${formatLongDate(record.dateISO)} в ${record.time}`,
    `Игроков: ${record.players}`,
    `Уровень страха: ${mode.name} (${mode.contact})`,
    record.isBirthday ? `Акция: именинник — бесплатно` : "",
    record.extraNames.length > 0 ? `Доп. услуги: ${record.extraNames.join(", ")}` : "",
    ``,
    `Итого: ${formatKzt(record.total)}`,
    ``,
    `Клиент: ${record.name}`,
    `Телефон: ${prettyPhone(record.phone)}`,
    `Связь: ${record.messenger}`,
    record.comment ? `Комментарий: ${record.comment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function notifyNewBooking(record: BookingRecord): Promise<void> {
  const message = bookingToMessage(record);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.info(`[booking] ${record.id} — Telegram не настроен, заявка сохранена в базе.\n${message}`);
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      console.error(`[booking] Telegram вернул ${response.status} для ${record.id}`);
    }
  } catch (error) {
    // Уведомление не должно ломать бронь: заявка уже сохранена
    console.error("[booking] Не удалось отправить уведомление в Telegram", error);
  }
}
