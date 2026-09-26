import { createHmac, timingSafeEqual } from "crypto";
import { BUSINESS } from "../content";
import { log } from "../logger";

/* ───────────────────────────────────────────────────────────────────────────
   ОПЛАТА: АБСТРАКЦИЯ ПРОВАЙДЕРА

   Схема, которую поддерживает контракт:

     Booking → PaymentIntent → Провайдер → (вебхук) → проверка на сервере
             → подтверждение брони

   Жёсткое правило безопасности: редирект клиента на «страницу успеха» НЕ
   является доказательством оплаты. Подтверждает только вебхук, подпись
   которого проверена на сервере, либо администратор вручную.

   Провайдеры:

     • manual — предоплата переводом, получение подтверждает администратор.
                Работает без внешних ключей, потому что это реальная модель
                заведения: клиент переводит, админ ставит отметку.
     • online — внешний платёжный сервис. Пока нет PAYMENT_API_URL и ключей,
                провайдер честно сообщает, что не настроен, и система
                продолжает работать в ручном режиме. Никаких «фейковых
                успешных оплат» не существует по построению.

   Контракт вебхука внешнего провайдера описан в PRODUCTION.md.
   ─────────────────────────────────────────────────────────────────────────── */

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "expired";

/** Статусы, которые вообще могут прийти от провайдера */
const PROVIDER_STATUSES: readonly PaymentStatus[] = ["pending", "paid", "failed", "cancelled", "expired"];

export interface PaymentIntentInput {
  /** Публичный номер брони (HC-…) */
  bookingId: string;
  /** Сумма предоплаты, ₸ */
  amount: number;
  description: string;
  returnUrl: string;
}

export interface PaymentIntent {
  provider: string;
  /** Идентификатор платежа у провайдера — по нему приходит вебхук */
  reference: string;
  status: PaymentStatus;
  amount: number;
  /** Куда отправить клиента (только online-провайдер) */
  redirectUrl?: string;
  /** Что делать человеку при ручной оплате */
  instructions?: string[];
}

export interface WebhookEvent {
  reference: string;
  status: PaymentStatus;
  /** Публичный номер брони, если провайдер его вернул */
  bookingId?: string;
  amount?: number;
}

export type WebhookParseResult =
  | { ok: true; event: WebhookEvent }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly id: string;
  /** manual — подтверждает человек, online — подтверждает вебхук */
  readonly kind: "manual" | "online";
  isConfigured(): boolean;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
  /** Разбор и проверка вебхука. Тело запроса само по себе не является доверенным. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookParseResult>;
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return (PROVIDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Ручная предоплата — текущая реальная модель заведения.
 *
 * Реквизиты здесь не выдумываются: их присылает администратор в мессенджере,
 * который выбрал клиент. Сайт не показывает несуществующий «номер карты».
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = "manual";
  readonly kind = "manual" as const;

  isConfigured(): boolean {
    return true;
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    return {
      provider: this.id,
      reference: `manual:${input.bookingId}`,
      status: "pending",
      amount: input.amount,
      instructions: [
        `Предоплата за игру ${input.bookingId}: ${input.amount.toLocaleString("ru-RU")} ₸.`,
        "Способ оплаты и реквизиты администратор пришлёт в выбранном мессенджере после подтверждения заявки.",
        `Если удобнее спросить самому — напишите или позвоните: ${BUSINESS.phone}.`,
      ],
    };
  }

  async parseWebhook(): Promise<WebhookParseResult> {
    /* Ручная оплата не принимает вебхуки: подтверждение может поставить только
       администратор в панели. Любой POST на вебхук от этого провайдера
       отклоняется — иначе оплату можно было бы «подтвердить» извне. */
    return { ok: false, reason: "manual_provider_has_no_webhooks" };
  }
}

/**
 * Внешний платёжный сервис (адаптер).
 *
 * Настраивается переменными:
 *   PAYMENT_API_URL        — база API провайдера
 *   PAYMENT_API_KEY        — ключ для создания платежа
 *   PAYMENT_WEBHOOK_SECRET — секрет для проверки подписи вебхука
 *
 * Пока переменных нет, провайдер сообщает `isConfigured() === false`,
 * и приложение остаётся в ручном режиме. Ничего не «имитируется».
 */
export class HttpPaymentProvider implements PaymentProvider {
  readonly id = "online";
  readonly kind = "online" as const;

  constructor(
    private readonly apiUrl: string | undefined,
    private readonly apiKey: string | undefined,
    private readonly webhookSecret: string | undefined,
    private readonly timeoutMs = 8000,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey);
  }

  /** Подпись вебхука: HMAC-SHA256 по сырому телу запроса */
  private signatureOf(rawBody: string): string | null {
    if (!this.webhookSecret) return null;
    return createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    if (!this.isConfigured()) {
      // Возвращаем честный статус вместо исключения: вызывающий код решает,
      // показать ли ручную оплату.
      return {
        provider: this.id,
        reference: `unconfigured:${input.bookingId}`,
        status: "pending",
        amount: input.amount,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/intents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "Idempotency-Key": input.bookingId,
        },
        body: JSON.stringify({
          amount: input.amount,
          currency: "KZT",
          description: input.description,
          metadata: { bookingId: input.bookingId },
          returnUrl: input.returnUrl,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        log.error("payment_failed", { publicId: input.bookingId, reason: `provider_${response.status}` });
        throw new Error(`Платёжный сервис ответил ${response.status}`);
      }

      const payload = (await response.json()) as {
        id?: string;
        status?: string;
        redirectUrl?: string;
      };

      return {
        provider: this.id,
        reference: payload.id ?? `unknown:${input.bookingId}`,
        status: payload.status && isPaymentStatus(payload.status) ? payload.status : "pending",
        amount: input.amount,
        redirectUrl: payload.redirectUrl,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookParseResult> {
    if (!this.isConfigured()) {
      return { ok: false, reason: "payment_provider_not_configured" };
    }

    const secret = this.webhookSecret;
    if (!secret) {
      /* Без секрета вебхук проверить нечем, а доверять телу запроса нельзя:
         иначе любой желающий «оплатит» бронь POST-запросом. */
      return { ok: false, reason: "webhook_secret_missing" };
    }

    const provided =
      headers.get("x-payment-signature") ??
      headers.get("x-signature") ??
      headers.get("x-webhook-signature");

    if (!provided) return { ok: false, reason: "signature_missing" };

    const expected = this.signatureOf(rawBody);
    if (!expected) return { ok: false, reason: "signature_unavailable" };

    const providedBuffer = Buffer.from(provided.trim().toLowerCase(), "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return { ok: false, reason: "signature_mismatch" };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: "malformed_json" };
    }

    const reference = typeof payload.id === "string" ? payload.id : undefined;
    const status = typeof payload.status === "string" ? payload.status : undefined;
    if (!reference || !status || !isPaymentStatus(status)) {
      return { ok: false, reason: "unknown_payload_shape" };
    }

    const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
    const bookingId = typeof metadata.bookingId === "string" ? metadata.bookingId : undefined;

    return {
      ok: true,
      event: {
        reference,
        status,
        bookingId,
        amount: typeof payload.amount === "number" ? payload.amount : undefined,
      },
    };
  }
}

let cached: PaymentProvider | null = null;

/**
 * Текущий платёжный провайдер.
 *
 * Online включается только если заданы PAYMENT_API_URL и PAYMENT_API_KEY;
 * иначе используется ручной режим — он рабочий, а не заглушка.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const apiUrl = process.env.PAYMENT_API_URL;
  const apiKey = process.env.PAYMENT_API_KEY;
  if (apiUrl && apiKey) {
    cached = new HttpPaymentProvider(apiUrl, apiKey, process.env.PAYMENT_WEBHOOK_SECRET);
    return cached;
  }

  cached = new ManualPaymentProvider();
  return cached;
}

export function resetPaymentProvider(): void {
  cached = null;
}
