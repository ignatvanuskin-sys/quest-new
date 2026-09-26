/**
 * ПРОВЕРКА КОНФИГУРАЦИИ
 *
 * Зачем это вообще нужно.
 *
 * На живом деплое случились две ошибки, которые не видно в коде и которые
 * никакой линтер не поймает:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` содержала заглушку. Сайт сообщал поисковику и
 *      мессенджерам, что каноническая версия каждой страницы — недостижимый
 *      адрес. Индексация и превью ссылок ломались молча.
 *   2. Не было `DATABASE_URL`. Клиент получал экран «вы записаны», а бронь
 *      исчезала вместе с инстансом.
 *
 * Оба случая объединяет одно: приложение работало, отвечало 200 и выглядело
 * здоровым. Поэтому проверка конфигурации должна быть явной, машиночитаемой и
 * доступной и в логах старта, и в /api/health, и в `npm run verify:production`.
 *
 * Принципы:
 *   • значения переменных НИКОГДА не попадают в вывод — только имена;
 *   • приложение не падает при отсутствии переменной, а честно сообщает
 *     о деградации: бизнесу хуже от полностью лежащего сайта, чем от сайта
 *     с закрытым бронированием и работающим телефоном;
 *   • «похоже на заглушку» — отдельная проверка, потому что это самый
 *     коварный вид ошибки: переменная задана, значит выглядит настроенной.
 */

export interface EnvIssue {
  /** Имя переменной окружения. Значение не раскрывается никогда. */
  variable: string;
  /** Что именно не так и чем это грозит. */
  why: string;
}

export interface EnvReport {
  environment: string;
  /** Без этого продакшен работать не должен. */
  missingRequired: EnvIssue[];
  /** Работать можно, но что-то деградирует. */
  warnings: EnvIssue[];
  ok: boolean;
}

/** Значения, которые встречаются в примерах и не являются настоящими настройками. */
const PLACEHOLDER_VALUES = new Set([
  "placeholder",
  "change-me",
  "change-me-please",
  "changeme",
  "todo",
  "tbd",
  "xxx",
  "test",
  "example",
  "your-password",
  "secret",
  "password",
]);

function read(name: string): string {
  return (process.env[name] ?? "").trim();
}

function isPlaceholder(name: string): boolean {
  const value = read(name);
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/[\s_\-.]/g, "");
  if (PLACEHOLDER_VALUES.has(normalized)) return true;
  // «change-me-too-long-random-string» из примера и подобные
  return /^change-?me|^placeholder|^your[-_]?|^<.*>$/.test(value.toLowerCase());
}

function looksLikeUrl(name: string): boolean {
  const value = read(name);
  return /^https?:\/\/[^\s]+$/i.test(value);
}

/** Платформа без общего диска: файловое хранилище там не переживает перезапуск. */
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function hasDatabase(): boolean {
  return Boolean(read("DATABASE_URL"));
}

export function notificationChannel(): "telegram" | "webhook" | "none" {
  if (read("TELEGRAM_BOT_TOKEN") && read("TELEGRAM_CHAT_ID")) return "telegram";
  if (read("NOTIFY_WEBHOOK_URL")) return "webhook";
  return "none";
}

export function paymentMode(): "online" | "manual" {
  return read("PAYMENT_API_URL") ? "online" : "manual";
}

/**
 * Собрать отчёт о конфигурации для текущего окружения.
 *
 * `strict` включает проверки уровня продакшена. В разработке они не нужны:
 * локально брони лежат в файле, админка доступна с паролем по умолчанию,
 * и требовать боевые переменные было бы бессмысленно.
 */
export function inspectEnv(options?: { strict?: boolean }): EnvReport {
  const environment = process.env.NODE_ENV ?? "development";
  const strict = options?.strict ?? environment === "production";

  const missingRequired: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];

  if (strict) {
    // ── Обязательное ──────────────────────────────────────────────────────
    if (!read("NEXT_PUBLIC_SITE_URL")) {
      missingRequired.push({
        variable: "NEXT_PUBLIC_SITE_URL",
        why: "canonical, og:url, og:image, robots.txt и sitemap соберутся с неверным адресом: поисковик увидит недостижимую каноническую ссылку, а превью в мессенджерах придёт без картинки",
      });
    } else if (!looksLikeUrl("NEXT_PUBLIC_SITE_URL")) {
      missingRequired.push({
        variable: "NEXT_PUBLIC_SITE_URL",
        why: "значение не похоже на адрес вида https://example.kz — ссылки в разметке будут битыми",
      });
    }

    if (!read("ADMIN_PASSWORD")) {
      missingRequired.push({
        variable: "ADMIN_PASSWORD",
        why: "панель администратора полностью закрыта: владелец не увидит брони",
      });
    }

    if (!read("ADMIN_SESSION_SECRET")) {
      missingRequired.push({
        variable: "ADMIN_SESSION_SECRET",
        why: "cookie админ-сессии нечем подписывать, вход не работает",
      });
    }

    // На serverless файловое хранилище не переживает перезапуск инстанса,
    // поэтому без базы брони теряются. Это не «предупреждение», а блокер.
    if (isServerless() && !hasDatabase()) {
      missingRequired.push({
        variable: "DATABASE_URL",
        why: "на serverless-хостинге без базы данных брони не сохраняются между запросами, поэтому онлайн-бронирование отключено",
      });
    }

    // ── Предупреждения ────────────────────────────────────────────────────
    if (!read("CRON_SECRET")) {
      warnings.push({
        variable: "CRON_SECRET",
        why: "планировщик напоминаний не защищён секретом, поэтому внешний вызов недоступен: напоминания и истечение броней не выполняются",
      });
    }

    if (notificationChannel() === "none") {
      warnings.push({
        variable: "TELEGRAM_BOT_TOKEN / NOTIFY_WEBHOOK_URL",
        why: "канал уведомлений не настроен: владелец узнаёт о новых бронях только открыв админку",
      });
    }

    if (paymentMode() === "manual") {
      warnings.push({
        variable: "PAYMENT_API_URL",
        why: "онлайн-оплата отключена, работает ручная предоплата — это допустимый режим, но его стоит подтвердить с владельцем",
      });
    }

    if (!read("NEXT_PUBLIC_VENUE_TIMEZONE")) {
      warnings.push({
        variable: "NEXT_PUBLIC_VENUE_TIMEZONE",
        why: "не задан, используется Asia/Almaty — проверьте, что пояс площадки именно этот",
      });
    }
  }

  // ── Проверки, которые полезны всегда ────────────────────────────────────
  for (const name of [
    "NEXT_PUBLIC_SITE_URL",
    "ADMIN_PASSWORD",
    "ADMIN_SESSION_SECRET",
    "DATABASE_URL",
    "TELEGRAM_BOT_TOKEN",
    "NOTIFY_WEBHOOK_URL",
    "PAYMENT_API_KEY",
    "PAYMENT_WEBHOOK_SECRET",
  ]) {
    if (isPlaceholder(name)) {
      const issue: EnvIssue = {
        variable: name,
        why:
          read(name).toLowerCase() === "placeholder"
            ? "значение выглядит как заглушка «placeholder»: переменная задана, но не работает"
            : "значение не заменено с примера из .env.example",
      };
      if (strict) missingRequired.push(issue);
      else warnings.push(issue);
    }
  }

  // Половина настроенной интеграции оплаты опаснее её отсутствия: вебхук
  // включится, а подпись проверять будет нечем.
  if (read("PAYMENT_API_URL") && !read("PAYMENT_WEBHOOK_SECRET")) {
    warnings.push({
      variable: "PAYMENT_WEBHOOK_SECRET",
      why: "оплата подключена без секрета вебхука: невозможно проверить подпись платёжного уведомления, принимать его нельзя",
    });
  }

  return {
    environment,
    missingRequired,
    warnings,
    ok: missingRequired.length === 0,
  };
}

/** Человекочитаемая сводка для логов старта и консольных команд. */
export function formatEnvReport(report: EnvReport): string {
  const lines: string[] = [];
  if (report.missingRequired.length > 0) {
    lines.push(`Отсутствуют или неверны критичные переменные (${report.missingRequired.length}):`);
    for (const issue of report.missingRequired) {
      lines.push(`  ✗ ${issue.variable} — ${issue.why}`);
    }
  }
  if (report.warnings.length > 0) {
    lines.push(`Предупреждения (${report.warnings.length}):`);
    for (const issue of report.warnings) {
      lines.push(`  ⚠ ${issue.variable} — ${issue.why}`);
    }
  }
  if (lines.length === 0) lines.push("Конфигурация в порядке, замечаний нет.");
  return lines.join("\n");
}
