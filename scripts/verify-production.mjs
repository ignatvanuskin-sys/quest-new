#!/usr/bin/env node
/**
 * ПРОВЕРКА ГОТОВНОСТИ К ПРОДАКШЕНУ
 *
 * Запуск: npm run verify:production
 *
 * Отвечает на один вопрос: можно ли этому развёртыванию принимать реальные
 * брони. Проверка идёт от окружения к живой системе, потому что по отдельности
 * каждая часть может выглядеть здоровой:
 *
 *   • переменные окружения заданы, но содержат заглушку;
 *   • база отвечает, но схема не применена;
 *   • приложение поднято, но хранилище не пишет;
 *   • сайт открывается, но канал уведомлений молчит.
 *
 * Код выхода: 0 — блокеров нет; 1 — есть блокеры.
 * Предупреждения (⚠) на код выхода не влияют: они обозначают режимы, которые
 * допустимы, но должны быть подтверждены владельцем (ручная оплата, отсутствие
 * внешнего расписания).
 *
 * Значения переменных не печатаются никогда — только имена.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const blockers = [];
const warnings = [];
const passed = [];

/* ── Чтение .env.local без зависимостей ────────────────────────────────────
   Скрипт запускается вне Next.js, поэтому переменные подхватываем сами.
   Приоритет у реального окружения: в CI и на хостинге .env.local нет. */
function loadEnvFile(file) {
  if (!existsSync(file)) return 0;
  let loaded = 0;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) continue; // окружение важнее файла
    process.env[name] = rawValue.trim().replace(/^["']|["']$/g, "");
    loaded += 1;
  }
  return loaded;
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const read = (name) => (process.env[name] ?? "").trim();
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/* ── 1. Сайт и админка ───────────────────────────────────────────────────── */
const siteUrl = read("NEXT_PUBLIC_SITE_URL");
if (/^https?:\/\/[^\s]+$/i.test(siteUrl)) {
  passed.push(`SITE URL — ${siteUrl}`);
} else if (siteUrl) {
  blockers.push("SITE URL — значение не похоже на адрес (нужно вида https://example.kz)");
} else {
  blockers.push("SITE URL — NEXT_PUBLIC_SITE_URL не задан: canonical, OG и sitemap будут битыми");
}

if (read("ADMIN_PASSWORD")) {
  passed.push("ADMIN — пароль задан");
} else {
  blockers.push("ADMIN — ADMIN_PASSWORD не задан: панель администратора закрыта");
}

if (read("ADMIN_SESSION_SECRET")) {
  passed.push("ADMIN SESSION — секрет задан");
} else {
  blockers.push("ADMIN SESSION — ADMIN_SESSION_SECRET не задан: вход в панель не работает");
}

/* ── 2. Заглушки ─────────────────────────────────────────────────────────── */
const PLACEHOLDERS = /^(placeholder|change-?me.*|your[-_]?.*|todo|tbd|xxx|test|example|<.*>)$/i;
for (const name of [
  "NEXT_PUBLIC_SITE_URL",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
  "DATABASE_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "NOTIFY_WEBHOOK_URL",
  "PAYMENT_API_KEY",
  "PAYMENT_WEBHOOK_SECRET",
]) {
  const value = read(name);
  if (value && PLACEHOLDERS.test(value.trim())) {
    blockers.push(`${name} — значение является заглушкой и не работает`);
  }
}

/* ── 3. Хранилище и база ─────────────────────────────────────────────────── */
const databaseUrl = read("DATABASE_URL");
if (databaseUrl) {
  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 8000 });
    await client.connect();
    const version = await client.query("SELECT version() AS v");
    passed.push(`DATABASE — подключение установлено (${String(version.rows[0].v).split(",")[0]})`);

    // Схема должна быть применена: иначе приложение упадёт на первой брони
    try {
      const table = await client.query(
        "SELECT to_regclass('public.bookings') AS t, to_regclass('public.schema_migrations') AS m",
      );
      const hasBookings = Boolean(table.rows[0]?.t);
      const hasMigrations = Boolean(table.rows[0]?.m);
      if (hasBookings && hasMigrations) {
        const applied = await client.query("SELECT count(*)::int AS n FROM schema_migrations");
        passed.push(`MIGRATIONS — применено: ${applied.rows[0].n}`);
      } else {
        blockers.push("MIGRATIONS — схема не применена, выполните: npm run migrate");
      }
    } catch (error) {
      blockers.push(`MIGRATIONS — не удалось проверить схему: ${error.message}`);
    }
    await client.end();
  } catch (error) {
    blockers.push(`DATABASE — подключение не удалось: ${error.message}`);
  }
} else if (isServerless) {
  blockers.push(
    "STORAGE — DATABASE_URL не задан на serverless-хостинге: файловое хранилище не переживает перезапуск, брони теряются",
  );
} else {
  warnings.push(
    "STORAGE — используется файловое хранилище (.data/bookings.json). Для одного сервера это рабочий режим; для нескольких инстансов нужна база",
  );
}

/* ── 4. Уведомления ──────────────────────────────────────────────────────── */
const telegramReady = Boolean(read("TELEGRAM_BOT_TOKEN") && read("TELEGRAM_CHAT_ID"));
const webhookReady = Boolean(read("NOTIFY_WEBHOOK_URL"));
if (telegramReady && read("TELEGRAM_CHAT_ID")) {
  passed.push("NOTIFICATIONS — Telegram настроен");
} else if (webhookReady) {
  passed.push("NOTIFICATIONS — вебхук настроен");
} else {
  warnings.push(
    "NOTIFICATIONS — канал не настроен: владелец узнаёт о новых бронях только открыв админку",
  );
}

/* ── 5. Оплата ───────────────────────────────────────────────────────────── */
if (read("PAYMENT_API_URL")) {
  if (read("PAYMENT_API_KEY") && read("PAYMENT_WEBHOOK_SECRET")) {
    passed.push("PAYMENTS — онлайн-эквайринг настроен");
  } else {
    blockers.push(
      "PAYMENTS — PAYMENT_API_URL задан, но нет PAYMENT_API_KEY или PAYMENT_WEBHOOK_SECRET: подпись вебхука проверить нечем",
    );
  }
} else {
  warnings.push("PAYMENTS — DISABLED, работает ручная предоплата (подтверждает администратор)");
}

/* ── 6. Планировщик ──────────────────────────────────────────────────────── */
if (read("CRON_SECRET")) {
  passed.push("CRON — секрет задан");
} else {
  warnings.push("CRON — CRON_SECRET не задан: напоминания и истечение броней не выполняются");
}

/* ── 7. Расписание ───────────────────────────────────────────────────────── */
if (read("AVAILABILITY_API_URL")) {
  passed.push("SCHEDULE — внешний источник расписания настроен");
} else {
  warnings.push(
    read("DEMO_AVAILABILITY") === "1"
      ? "SCHEDULE — ВКЛЮЧЁН ДЕМО-РЕЖИМ ЗАНЯТОСТИ: на рабочем сайте выключите DEMO_AVAILABILITY"
      : "SCHEDULE — собственное расписание площадки (все старты доступны, пока их не заняли)",
  );
}

/* ── 8. Живая проверка, если известен адрес ──────────────────────────────── */
if (/^https?:\/\//i.test(siteUrl)) {
  try {
    const response = await fetch(`${siteUrl.replace(/\/+$/, "")}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (response.ok && body.ok) {
      passed.push("HEALTH — приложение отвечает, проверки пройдены");
    } else {
      const reasons = Array.isArray(body?.warnings) ? body.warnings : [];
      blockers.push(
        `HEALTH — приложение сообщает о проблемах (${body?.checks?.storage?.mode ?? "?"}/writable=${
          body?.checks?.storage?.writable ?? "?"
        })${reasons.length ? `: ${reasons.join("; ")}` : ""}`,
      );
    }
  } catch (error) {
    warnings.push(`HEALTH — живая проверка не выполнена (${error.message})`);
  }
} else {
  warnings.push("HEALTH — живая проверка пропущена: адрес сайта не задан");
}

/* ── Итог ────────────────────────────────────────────────────────────────── */
console.log("\n══ ПРОВЕРКА ГОТОВНОСТИ К ПРОДАКШЕНУ ══\n");
for (const line of passed) console.log(`  ✓ ${line}`);
for (const line of warnings) console.log(`  ⚠ ${line}`);
for (const line of blockers) console.log(`  ✗ ${line}`);

console.log(
  `\nИтог: пройдено ${passed.length}, предупреждений ${warnings.length}, блокеров ${blockers.length}`,
);

if (blockers.length > 0) {
  console.log("\nБлокеры нужно устранить до приёма реальных броней. Порядок — в PRODUCTION.md.\n");
  process.exit(1);
}

console.log("Блокеров нет: развёртывание может принимать брони.\n");
if (warnings.length > 0) {
  console.log("Предупреждения — это режимы, которые стоит подтвердить с владельцем.\n");
}
process.exit(0);
