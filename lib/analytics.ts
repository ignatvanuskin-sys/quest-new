/* ───────────────────────────────────────────────────────────────────────────
   АНАЛИТИКА

   Задача: владелец должен видеть воронку и понимать, где люди уходят —
   от просмотра квеста до подтверждения брони.

   Два правила, которые здесь соблюдаются жёстко:

   1. Никаких персональных данных. Ни имя, ни телефон, ни номер брони не
      попадают в события: номер брони — это ключ к данным клиента, и в
      аналитике он не нужен. Для связи событий используется обезличенный
      идентификатор сессии формы (случайная строка), который нигде не
      хранится на сервере как персональные данные.

   2. Никаких обязательных внешних скриптов. События уходят в приёмник
      только если он настроен (NEXT_PUBLIC_ANALYTICS_ENDPOINT) или если на
      странице уже есть dataLayer/gtag. В остальных случаях вызовы ничего
      не делают — и это не ошибка, а нормальный режим: аналитика не должна
      ни замедлять сайт, ни ломать бронирование.
   ─────────────────────────────────────────────────────────────────────────── */

export type AnalyticsEvent =
  | "page_view"
  | "quest_view"
  | "booking_started"
  | "booking_step_completed"
  | "slot_selected"
  | "booking_submitted"
  | "booking_success"
  | "booking_failed"
  | "payment_started"
  | "payment_success"
  | "payment_failed"
  | "share_clicked"
  | "calendar_added"
  | "contact_clicked";

/** Свойства события: только неличные значения */
export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

const FORBIDDEN = ["phone", "name", "email", "comment", "bookingId", "id", "token"];

function sanitize(props: AnalyticsProps): AnalyticsProps {
  const clean: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN.includes(key)) continue;
    if (typeof value === "string" && value.length > 80) {
      clean[key] = `${value.slice(0, 80)}…`;
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

interface GtagWindow {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
}

/** Обезличенный идентификатор визита формы — живёт только в этой вкладке */
let sessionId = "";

function currentSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const key = "hc:analytics-session";
    const stored = window.sessionStorage.getItem(key);
    if (stored) {
      sessionId = stored;
      return sessionId;
    }
    sessionId = Math.random().toString(36).slice(2, 10);
    window.sessionStorage.setItem(key, sessionId);
  } catch {
    // Приватный режим: работаем без идентификатора, это не критично
    sessionId = "anonymous";
  }
  return sessionId;
}

/**
 * Отправить событие.
 *
 * Функция никогда не бросает исключение: аналитика не имеет права ломать
 * бронирование. Любая её ошибка остаётся внутри и не доходит до интерфейса.
 */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  try {
    const payload = {
      event,
      session: currentSessionId(),
      at: new Date().toISOString(),
      path: window.location.pathname,
      ...sanitize(props),
    };

    const gtagWindow = window as unknown as GtagWindow;
    if (typeof gtagWindow.gtag === "function") {
      gtagWindow.gtag("event", event, payload);
    } else if (Array.isArray(gtagWindow.dataLayer)) {
      gtagWindow.dataLayer.push(payload);
    }

    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    if (endpoint) {
      /* keepalive нужен, чтобы событие успело уйти при уходе со страницы
         (например, «перешёл в WhatsApp»), но ответ сервера нас не интересует */
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    /* молча: аналитика не критична */
  }
}

/** Настроена ли отправка во внешний приёмник */
export function analyticsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT);
}
