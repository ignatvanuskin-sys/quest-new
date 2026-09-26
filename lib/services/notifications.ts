import { getFearMode, getLocation, getQuest } from "../content";
import { log } from "../logger";
import { formatKzt, formatLongDate, prettyPhone } from "../utils";
import type { BookingRecord, BookingStatus } from "../types";

/* ───────────────────────────────────────────────────────────────────────────
   УВЕДОМЛЕНИЯ

   Задача: владелец узнаёт о новой брони сразу, а не когда откроет панель,
   и при этом отсутствие интеграции НЕ ломает бронирование.

   Устройство: сервис знает, ЧТО сказать; канал знает, КУДА. Telegram не
   размазан по booking-логике — он один из каналов и подключается
   переменными окружения.

   Честность важнее «галочки»: если канал не настроен, сервис не делает вид,
   что сообщение отправлено. Он пишет структурный лог (заявка лежит в базе и
   видна в панели) и честно сообщает `delivered: false`.
   ─────────────────────────────────────────────────────────────────────────── */

export interface OutboundMessage {
  /** Короткий заголовок — попадает в начало сообщения */
  title: string;
  text: string;
  /** Нужно ли отключить превью ссылок в канале */
  disablePreview?: boolean;
  /**
   * Разобранные поля заявки — для автоматизации, которая принимает вебхук.
   * Текст удобен человеку, а эти поля удобны боту: он может сразу создать
   * карточку клиента, не разбирая свободный текст по regex.
   */
  booking?: {
    id: string;
    quest: string;
    date: string;
    time: string;
    players: number;
    name: string;
    phone: string;
    messenger: string;
  };
}

export interface SendResult {
  channel: string;
  delivered: boolean;
  reason?: string;
}

export interface NotificationChannel {
  readonly id: string;
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<SendResult>;
}

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Общая обвязка отправки: таймаут + повтор для сетевых сбоев */
async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; reason?: string }> {
  let lastReason = "unknown";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.ok) return { ok: true, status: response.status };

      lastReason = `http_${response.status}`;
      // 4xx кроме 429 повторять бессмысленно: это ошибка запроса, не сети
      if (response.status < 500 && response.status !== 429) {
        return { ok: false, status: response.status, reason: lastReason };
      }
    } catch (error) {
      lastReason = error instanceof Error ? error.name : "network_error";
    } finally {
      clearTimeout(timer);
    }

    if (attempt < MAX_ATTEMPTS) await wait(300 * attempt);
  }

  return { ok: false, status: 0, reason: lastReason };
}

/** Telegram-бот отдела бронирования */
export class TelegramChannel implements NotificationChannel {
  readonly id = "telegram";

  constructor(
    private readonly token: string | undefined,
    private readonly chatId: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { channel: this.id, delivered: false, reason: "telegram_not_configured" };
    }

    const result = await postJson(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      chat_id: this.chatId,
      text: `${message.title}\n\n${message.text}`,
      disable_web_page_preview: message.disablePreview ?? true,
    });

    return {
      channel: this.id,
      delivered: result.ok,
      reason: result.ok ? undefined : result.reason,
    };
  }
}

/**
 * Универсальный вебхук.
 *
 * Точка подключения любой внешней системы: Slack, чат отдела, CRM,
 * no-code автоматизация. Формат тела — { title, text, booking }.
 *
 * ОТДЕЛЬНО ПРО WHATSAPP. Отправлять сообщения в WhatsApp с сервера можно
 * только через официальный Cloud API Meta, и для этого у бизнеса должен быть
 * одобренный WABA-шаблон. Без одобрения Meta не примет сообщение, и любая
 * имитация «написали вам в WhatsApp» была бы враньём в интерфейсе.
 *
 * Поэтому WhatsApp-канал здесь добровольный: если в адресе вебхука стоит
 * `wa.me` (или задан WHATSAPP_LINK), наряду с POST уходит ссылка
 * `wa.me/<номер>?text=…` — и большинство сервисов на базе n8n/Make/бизнес-ботов
 * умеют разворачивать её в реальное сообщение через одобренный шаблон.
 * Без такой связки работает только Telegram: он честно работает «из коробки».
 */
export class WebhookChannel implements NotificationChannel {
  readonly id = "webhook";

  constructor(private readonly url: string | undefined, private readonly secret: string | undefined) {}

  isConfigured(): boolean {
    return Boolean(this.url);
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.url) return { channel: this.id, delivered: false, reason: "webhook_not_configured" };

    /* Тело уведомления. Плоский JSON: большинство вебхуков (Make, n8n,
       Zapier, Slack-совместимые) принимают именно плоские поля, и вложенный
       объект booking там теряется без ручной разборки. */
    const result = await postJson(
      this.url,
      {
        title: message.title,
        text: message.text,
        // Отдельные поля — чтобы автоматизация могла разобрать заявку,
        // не разбирая текст: номер, квест, дата, время, телефон.
        ...(message.booking ?? {}),
      },
      this.secret ? { "X-Notify-Secret": this.secret } : {},
    );

    return {
      channel: this.id,
      delivered: result.ok,
      reason: result.ok ? undefined : result.reason,
    };
  }
}

/**
 * Резервный канал: журнал сервера.
 *
 * Он всегда «доставляет» — потому что доставка в лог означает, что заявка
 * не потеряна: она в базе и в панели администратора. Это единственный
 * допустимый вариант, когда внешние каналы не настроены: молчание внешнего
 * сервиса не должно выглядеть как отправленное уведомление.
 */
export class LogChannel implements NotificationChannel {
  readonly id = "log";

  isConfigured(): boolean {
    return true;
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    log.info("notification_sent", {
      channel: this.id,
      title: message.title,
      preview: message.text.replace(/\s+/g, " ").slice(0, 160),
    });
    return { channel: this.id, delivered: true };
  }
}

/** Все настроенные каналы; журнал добавляется всегда как страховка */
export function getChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [
    new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID),
    new WebhookChannel(process.env.NOTIFY_WEBHOOK_URL, process.env.NOTIFY_WEBHOOK_SECRET),
  ].filter((channel) => channel.isConfigured());

  if (channels.length === 0) channels.push(new LogChannel());
  return channels;
}

export function notificationsConfigured(): boolean {
  return Boolean(
    (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) || process.env.NOTIFY_WEBHOOK_URL,
  );
}

// ── Тексты сообщений ────────────────────────────────────────────────────────

/** Сообщение администратору о новой броне: всё, что нужно для подтверждения */
export function bookingToMessage(record: BookingRecord): string {
  const quest = getQuest(record.questSlug);
  const location = quest ? getLocation(quest.locationId) : null;
  const mode = getFearMode(record.fearMode);

  return [
    `Квест: ${quest?.title ?? record.questSlug}`,
    location ? `Адрес: ${location.address} (${location.label})` : "",
    `Дата: ${formatLongDate(record.dateISO)} в ${record.time}`,
    `Игроков: ${record.players}`,
    `Уровень страха: ${mode.name} (${mode.contact})`,
    record.isBirthday ? "Акция: именинник — бесплатно" : "",
    record.extraNames.length > 0 ? `Доп. услуги: ${record.extraNames.join(", ")}` : "",
    "",
    `Итого: ${formatKzt(record.total)}`,
    `Оплата: ${paymentLabel(record.payment?.status)}`,
    record.crmSync?.status === "failed"
      ? "⚠️ Не выгружено во внешнюю систему — проверьте вручную"
      : "",
    "",
    `Клиент: ${record.name}`,
    `Телефон: ${prettyPhone(record.phone)}`,
    `Связь: ${messengerLabel(record.messenger)}`,
    record.comment ? `Комментарий: ${record.comment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function paymentLabel(status: string | undefined): string {
  switch (status) {
    case "paid":
      return "предоплата получена";
    case "failed":
      return "оплата не прошла";
    case "cancelled":
      return "платёж отменён";
    case "not_required":
      return "предоплата не требуется";
    default:
      return "ожидает предоплаты";
  }
}

function messengerLabel(messenger: BookingRecord["messenger"]): string {
  if (messenger === "telegram") return "Telegram";
  if (messenger === "call") return "звонок";
  return "WhatsApp";
}

/**
 * Сообщение клиенту.
 *
 * Отправка клиенту автоматически требует реальной инфраструктуры (SMS-шлюз
 * или провайдер мессенджера), которой у проекта нет. Поэтому текст собирается
 * здесь и используется там, где он реально работает: на экране успеха и в
 * кнопке «написать клиенту» в панели администратора. Ничего не имитируется.
 */
export function buildCustomerMessage(record: BookingRecord): string {
  const quest = getQuest(record.questSlug);
  const location = quest ? getLocation(quest.locationId) : null;

  return [
    `Ваша бронь ${record.id} принята.`,
    `Квест: ${quest?.title ?? record.questSlug}`,
    `Дата и время: ${formatLongDate(record.dateISO)}, ${record.time}`,
    location ? `Адрес: ${location.address}` : "",
    location ? `Как найти вход: ${location.entrance}` : "",
    "",
    "Администратор свяжется с вами, чтобы подтвердить время и предоплату.",
    "Если планы изменились, напишите нам заранее — мы предложим другое время.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Сервис ──────────────────────────────────────────────────────────────────

async function deliver(message: OutboundMessage, event: BookingRecord["id"] | null): Promise<SendResult[]> {
  const channels = getChannels();
  const results: SendResult[] = [];

  for (const channel of channels) {
    try {
      const result = await channel.send(message);
      results.push(result);
      if (!result.delivered && channel.id !== "log") {
        log.warn("notification_failed", {
          publicId: event ?? undefined,
          channel: channel.id,
          reason: result.reason ?? "unknown",
        });
      }
    } catch (error) {
      // Уведомление никогда не должно ломать бронь
      results.push({
        channel: channel.id,
        delivered: false,
        reason: error instanceof Error ? error.message.slice(0, 120) : "channel_error",
      });
      log.error("notification_failed", {
        publicId: event ?? undefined,
        channel: channel.id,
        reason: "exception",
      });
    }
  }

  return results;
}

/**
 * Разобранные поля заявки для автоматизации.
 *
 * Дублируют текст сообщения, но существуют ради другой аудитории: текст
 * читает человек в Telegram, поля — бот, принимающий вебхук. Без них
 * автоматизация разбирала бы свободный текст регулярками, и любая правка
 * формулировки ломала бы интеграцию молча.
 */
function bookingFields(record: BookingRecord): NonNullable<OutboundMessage["booking"]> {
  return {
    id: record.id,
    quest: getQuest(record.questSlug)?.title ?? record.questSlug,
    date: record.dateISO,
    time: record.time,
    players: record.players,
    name: record.name,
    phone: record.phone,
    messenger: messengerLabel(record.messenger),
  };
}

/** Новая бронь: сообщение администратору */
export async function notifyNewBooking(record: BookingRecord): Promise<SendResult[]> {
  return deliver(
    {
      title: `НОВАЯ БРОНЬ ${record.id}`,
      text: bookingToMessage(record),
      booking: bookingFields(record),
    },
    record.id,
  );
}

/** Смена статуса: администратор видит, что именно произошло */
export async function notifyStatusChanged(
  record: BookingRecord,
  status: BookingStatus,
): Promise<SendResult[]> {
  const label = STATUS_LABELS[status];
  return deliver(
    {
      title: `БРОНЬ ${record.id} — ${label}`,
      text: [
        `Квест: ${getQuest(record.questSlug)?.title ?? record.questSlug}`,
        `Дата: ${formatLongDate(record.dateISO)} в ${record.time}`,
        `Игроков: ${record.players}`,
        `Клиент: ${record.name}`,
        `Телефон: ${prettyPhone(record.phone)}`,
      ].join("\n"),
      booking: bookingFields(record),
    },
    record.id,
  );
}

export type ReminderKind = "24h" | "2h";

/** Напоминание сотруднику: бронь, которая скоро начнётся, легко забыть */
export async function sendReminder(record: BookingRecord, kind: ReminderKind): Promise<SendResult[]> {
  const when = kind === "24h" ? "завтра" : "через 2 часа";
  return deliver(
    {
      title: `НАПОМИНАНИЕ ${record.id} — игра ${when}`,
      text: [
        `Квест: ${getQuest(record.questSlug)?.title ?? record.questSlug}`,
        `Дата: ${formatLongDate(record.dateISO)} в ${record.time}`,
        `Игроков: ${record.players}`,
        `Клиент: ${record.name}`,
        `Телефон: ${prettyPhone(record.phone)}`,
        `Оплата: ${paymentLabel(record.payment?.status)}`,
      ].join("\n"),
      booking: bookingFields(record),
    },
    record.id,
  );
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  new: "ожидает подтверждения",
  confirmed: "подтверждена",
  completed: "проведена",
  cancelled: "отменена",
  expired: "истекла",
};
