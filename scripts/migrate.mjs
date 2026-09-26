#!/usr/bin/env node
/**
 * Применение миграций к PostgreSQL.
 *
 * Правила, которые делает этот скрипт:
 *   • детерминированность. Файлы берутся из db/migrations и применяются строго
 *     по имени (001_, 002_, …). Один и тот же набор файлов даёт один и тот же
 *     результат на пустой базе.
 *   • однократность. Применённые миграции записываются в schema_migrations;
 *     повторный запуск ничего не делает.
 *   • атомарность. Каждая миграция идёт в своей транзакции: если файл упал
 *     посередине, база остаётся в прежнем состоянии, а не в полу-применённом.
 *
 * Запуск:  node scripts/migrate.mjs
 * Нужен DATABASE_URL и установленный пакет `pg`.
 *
 * Скрипт намеренно не «делает вид», что база есть: без драйвера или без
 * DATABASE_URL он завершается с понятным сообщением и кодом 1.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

function fail(message) {
  console.error(`\n[migrate] ${message}\n`);
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  fail(
    "Не задан DATABASE_URL.\n" +
      "Пример: postgres://user:password@host:5432/quest_horror\n" +
      "Пока переменная не задана, приложение работает на файловом хранилище — это штатный режим, а не ошибка.",
  );
}

let Pool;
try {
  ({ Pool } = await import("pg"));
} catch {
  fail(
    "Пакет `pg` не установлен. Установите его командой:\n  npm install pg\n" +
      "Без драйвера приложение продолжает работать на файловом хранилище.",
  );
}

const pool = new Pool({ connectionString, max: 1 });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en"));

  if (files.length === 0) fail(`В ${MIGRATIONS_DIR} нет ни одного .sql файла.`);

  const applied = new Set(
    (await pool.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name),
  );

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] уже применена: ${file}`);
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`[migrate] применена: ${file}`);
      count += 1;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw new Error(`миграция ${file} не применена: ${error instanceof Error ? error.message : error}`);
    } finally {
      client.release();
    }
  }

  console.log(`[migrate] готово. Новых миграций: ${count}.`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await pool.end().catch(() => undefined);
}
