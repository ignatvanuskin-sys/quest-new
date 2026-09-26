#!/usr/bin/env node
/**
 * ДЕМО-ДАННЫЕ ДЛЯ ЛОКАЛЬНОЙ РАБОТЫ
 *
 * Запуск: npm run seed — наполнить демо-брони; npm run seed -- --clear — убрать их.
 *
 * Зачем отдельная команда: показывать владельцу пустую админку неудобно, но
 * забивать рабочие данные тестовыми бронями нельзя — их потом невозможно
 * отличить от настоящих. Поэтому:
 *
 *   • команда ОТКАЗЫВАЕТСЯ работать в продакшене и на serverless-хостинге —
 *     демо-данные не должны попадать в боевую базу;
 *   • все созданные записи помечены источником `seed-demo` и удаляются по
 *     `--clear` именно по этой метке, не затрагивая реальные заявки;
 *   • в production database попадают только настоящие брони клиентов.
 *
 * Seed не запускается автоматически ни при сборке, ни при старте: единственный
 * способ его вызвать — руками, из локального окружения.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const DATA_DIR = path.join(root, ".data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");

const clear = process.argv.includes("--clear");

/* ── Защита: только локальная разработка ─────────────────────────────────── */
const isProduction = process.env.NODE_ENV === "production";
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (isProduction || isServerless) {
  console.error(
    "\nОтказ: демо-данные нельзя заливать в продакшен или на serverless-хостинг.\n" +
      `  NODE_ENV=${process.env.NODE_ENV ?? "не задан"}, serverless=${isServerless}\n` +
      "Запускайте seed только локально: NODE_ENV=development npm run seed\n",
  );
  process.exit(1);
}

if (process.env.DATABASE_URL) {
  console.error(
    "\nОтказ: задан DATABASE_URL. Seed умеет работать только с локальным файловым\n" +
      "хранилищем, чтобы демо-записи не попали в базу с реальными бронями.\n" +
      "Уберите DATABASE_URL из окружения, если хотите наполнить локальные данные.\n",
  );
  process.exit(1);
}

async function readRecords() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

/* ── Очистка ─────────────────────────────────────────────────────────────── */
if (clear) {
  const records = await readRecords();
  const kept = records.filter((record) => record.source !== "seed-demo");
  const removed = records.length - kept.length;

  if (removed === 0) {
    console.log("Демо-броней не найдено — очищать нечего.");
    process.exit(0);
  }

  await writeRecords(kept);
  console.log(
    `Удалено демо-броней: ${removed}. Осталось настоящих записей: ${kept.length}.`,
  );
  process.exit(0);
}

/* ── Наполнение ──────────────────────────────────────────────────────────── */
/** Дата в зоне площадки, сдвинутая на N дней вперёд */
function venueDate(offsetDays) {
  const timezone = process.env.NEXT_PUBLIC_VENUE_TIMEZONE?.trim() || "Asia/Almaty";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const instant = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return formatter.format(instant); // en-CA даёт YYYY-MM-DD
}

const QUESTS = [
  { slug: "karatelnaya-psihiatriya", title: "Карательная психиатрия", players: 4, price: 15_000 },
  { slug: "ritual", title: "Ритуал", players: 3, price: 11_500 },
  { slug: "bunker-13", title: "Бункер 13", players: 5, price: 18_000 },
];

const TIMES = ["15:00", "17:00", "19:30"];

const records = await readRecords();
const existing = records.filter((record) => record.source === "seed-demo");
if (existing.length > 0) {
  console.log(
    `Демо-брони уже есть (${existing.length}). Сначала уберите их: npm run seed -- --clear`,
  );
  process.exit(0);
}

const created = [];
let index = 0;
for (const quest of QUESTS) {
  for (const time of TIMES) {
    const dateISO = venueDate(index % 3 === 0 ? 1 : index % 3 === 1 ? 2 : 4);
    const createdAt = new Date(Date.now() - index * 3600_000).toISOString();
    const players = quest.players;
    created.push({
      id: `HC-DEMO${String(index + 1).padStart(4, "0")}`,
      questSlug: quest.slug,
      questTitle: quest.title,
      locationId: "shagabutdinova",
      dateISO,
      time,
      players,
      fearMode: index % 2 === 0 ? "light" : "full",
      customerName: `Демо-клиент ${index + 1}`,
      customerPhone: `+7 700 000 00 ${String(10 + index).padStart(2, "0")}`,
      messenger: "whatsapp",
      comment: "",
      extras: [],
      extraNames: [],
      isBirthday: index === 2,
      total: quest.price * players,
      priceBreakdown: [],
      status: index % 4 === 0 ? "confirmed" : "new",
      statusHistory: [{ status: "new", at: createdAt, by: "seed-demo" }],
      payment: { status: index % 4 === 0 ? "paid" : "pending", provider: "manual" },
      source: "seed-demo",
      createdAt,
    });
    index += 1;
  }
}

await writeRecords([...created, ...records]);
console.log(`Создано демо-броней: ${created.length}.`);
console.log("Убрать их: npm run seed -- --clear");
