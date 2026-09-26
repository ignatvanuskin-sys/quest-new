import { log } from "../logger";
import type { BookingRecord, BookingStatus, DayAvailability } from "../types";

/* ───────────────────────────────────────────────────────────────────────────
   CRM: ИНТЕГРАЦИОННЫЙ СЛОЙ

   У заведения может быть своя система учёта (CRM, Google-календарь, таблица
   администратора). Внешнего API мы не знаем и не выдумываем — поэтому здесь
   описан контракт и адаптер, а не «рабочие» эндпоинты.

   Ключевое требование: если внешняя система недоступна, система НЕ должна
   делать вид, что всё хорошо. Бронь остаётся в состоянии «ожидает
   подтверждения» (status = new), а рядом честно фиксируется неудачная
   синхронизация — её видит администратор в панели.

   Поэтому у провайдера три режима:
     • local  — система учёта это наша база. Работает всегда.
     • http   — внешний CRM-сервис (CRM_API_URL + CRM_API_TOKEN).
     • ни одного из них — приложение работает как local, без выдуманных данных.
   ─────────────────────────────────────────────────────────────────────────── */

export interface CrmResult {
  ok: boolean;
  /** Идентификатор брони в чужой системе */
  externalId?: string;
  /** Стоит ли повторить попытку (сеть, таймаут, 5xx) */
  retryable: boolean;
  reason?: string;
}

export interface CrmProvider {
  readonly id: string;
  /** Внешняя ли это система (local — значит учёт ведём мы сами) */
  readonly external: boolean;
  isConfigured(): boolean;
  createBooking(record: BookingRecord): Promise<CrmResult>;
  updateBooking(publicId: string, patch: { status?: BookingStatus }): Promise<CrmResult>;
  cancelBooking(publicId: string, reason?: string): Promise<CrmResult>;
  getAvailability(questSlug: string, dateISO: string): Promise<DayAvailability | null>;
}

/**
 * Локальный «CRM»: система учёта — наша база.
 *
 * Это не заглушка ради галочки. У небольшого заведения источником правды
 * действительно является панель администратора; отдельная CRM нужна, только
 * если она уже есть. Провайдер существует, чтобы подключение внешней системы
 * не требовало правок ни в booking-flow, ни в API.
 */
export class LocalCrmProvider implements CrmProvider {
  readonly id = "local";
  readonly external = false;

  isConfigured(): boolean {
    return true;
  }

  async createBooking(record: BookingRecord): Promise<CrmResult> {
    return { ok: true, externalId: record.id, retryable: false };
  }

  async updateBooking(): Promise<CrmResult> {
    return { ok: true, retryable: false };
  }

  async cancelBooking(): Promise<CrmResult> {
    return { ok: true, retryable: false };
  }

  async getAvailability(): Promise<DayAvailability | null> {
    // Расписание считает провайдер доступности, а не CRM
    return null;
  }
}

/** Настройки повторных попыток: короткие, чтобы не задерживать ответ клиенту */
const MAX_ATTEMPTS = 2;
const BASE_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface HttpCrmOptions {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
}

/**
 * Адаптер внешнего CRM.
 *
 * Что закрыто по требованиям к интеграции:
 *   • timeout — запрос не может висеть дольше timeoutMs;
 *   • retry — повтор только для сетевых ошибок и 5xx/429, с задержкой;
 *   • idempotency — заголовок Idempotency-Key с номером брони: повтор
 *     не создаёт вторую запись в чужой системе;
 *   • logging — результат пишется структурным логом без персональных данных;
 *   • graceful failure — ошибка возвращается как результат, а не бросается
 *     наружу: бронь не теряется из-за недоступной интеграции.
 */
export class HttpCrmProvider implements CrmProvider {
  readonly id = "http";
  readonly external = true;

  constructor(private readonly options: HttpCrmOptions) {}

  isConfigured(): boolean {
    return Boolean(this.options.baseUrl);
  }

  private async call(
    method: "POST" | "PATCH",
    path: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<CrmResult> {
    const timeoutMs = this.options.timeoutMs ?? 5000;
    let lastReason = "unknown";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${this.options.baseUrl}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(this.options.token ? { Authorization: `Bearer ${this.options.token}` } : {}),
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { id?: string };
          return { ok: true, externalId: payload.id, retryable: false };
        }

        const retryable = response.status >= 500 || response.status === 429;
        lastReason = `crm_${response.status}`;
        if (!retryable) return { ok: false, retryable: false, reason: lastReason };
      } catch (error) {
        // Сеть, таймаут, обрыв — повторяем
        lastReason = error instanceof Error ? error.name : "crm_network_error";
      } finally {
        clearTimeout(timer);
      }

      if (attempt < MAX_ATTEMPTS) await delay(BASE_DELAY_MS * attempt);
    }

    return { ok: false, retryable: true, reason: lastReason };
  }

  createBooking(record: BookingRecord): Promise<CrmResult> {
    return this.call(
      "POST",
      "/bookings",
      {
        publicId: record.id,
        questSlug: record.questSlug,
        date: record.dateISO,
        startTime: record.time,
        players: record.players,
        fearMode: record.fearMode,
        customerName: record.name,
        customerPhone: record.phone,
        comment: record.comment,
        total: record.total,
      },
      record.id,
    );
  }

  updateBooking(publicId: string, patch: { status?: BookingStatus }): Promise<CrmResult> {
    return this.call("PATCH", `/bookings/${encodeURIComponent(publicId)}`, patch, `${publicId}:status`);
  }

  cancelBooking(publicId: string, reason?: string): Promise<CrmResult> {
    return this.call(
      "PATCH",
      `/bookings/${encodeURIComponent(publicId)}`,
      { status: "cancelled", reason },
      `${publicId}:cancel`,
    );
  }

  async getAvailability(): Promise<DayAvailability | null> {
    // Расписание забирает провайдер доступности: разделение ответственности
    return null;
  }
}

let cached: CrmProvider | null = null;

export function getCrmProvider(): CrmProvider {
  if (cached) return cached;

  const baseUrl = process.env.CRM_API_URL;
  cached = baseUrl
    ? new HttpCrmProvider({ baseUrl, token: process.env.CRM_API_TOKEN })
    : new LocalCrmProvider();
  return cached;
}

export function resetCrmProvider(): void {
  cached = null;
}

export interface CrmSyncOutcome {
  status: "synced" | "failed" | "skipped";
  provider: string;
  at: string;
  reason?: string;
}

/**
 * Синхронизировать бронь с внешней системой.
 *
 * Возвращает результат, который сохраняется в броне и виден администратору.
 * Бронь НЕ удаляется и НЕ помечается подтверждённой, если синхронизация
 * не прошла: человек увидит «заявка принята, администратор подтвердит»,
 * а владелец — предупреждение в панели.
 */
export async function syncBookingToCrm(record: BookingRecord): Promise<CrmSyncOutcome> {
  const provider = getCrmProvider();
  const at = new Date().toISOString();

  if (!provider.external) {
    return { status: "skipped", provider: provider.id, at };
  }

  if (!provider.isConfigured()) {
    return { status: "skipped", provider: provider.id, at, reason: "crm_not_configured" };
  }

  const result = await provider.createBooking(record);
  if (result.ok) {
    log.info("notification_sent", { publicId: record.id, channel: "crm", provider: provider.id });
    return { status: "synced", provider: provider.id, at };
  }

  log.error("crm_sync_failed", {
    publicId: record.id,
    provider: provider.id,
    reason: result.reason ?? "unknown",
    retryable: result.retryable,
  });

  return { status: "failed", provider: provider.id, at, reason: result.reason };
}
