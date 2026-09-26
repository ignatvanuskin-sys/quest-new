#!/usr/bin/env node
/**
 * СКВОЗНАЯ ПРОВЕРКА БРОНИРОВАНИЯ НА ЖИВОМ САЙТЕ
 *
 * Запуск:
 *   npm run test:booking                              — против localhost:3000
 *   npm run test:booking -- --base=https://site.kz    — против боевого сайта
 *
 * Проверяет ровно тот путь, по которому идёт деньги: доступность → заявка →
 * подтверждение сервером → занятость выросла → повторная отправка не создала
 * вторую бронь.
 *
 * БЕЗОПАСНОСТЬ. Тестовая бронь помечается узнаваемым именем и телефоном
 * заглушки, чтобы её было видно в админке и легко отличить от настоящих.
 * Ничего не удаляется автоматически: удалять чужие записи в боевой базе —
 * решение владельца, а не скрипта. В ответе печатается номер брони, который
 * нужно отменить в панели.
 *
 * Код выхода 0 — путь работает; 1 — где-то разорван.
 */

const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = (baseArg ? baseArg.slice("--base=".length) : "http://localhost:3000").replace(
  /\/+$/,
  "",
);

const TEST_NAME = "ПРОВЕРКА БРОНИРОВАНИЯ (тест, отменить в админке)";
const TEST_PHONE = "+7 700 000 09 99";

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function venueDate(offsetDays) {
  const timezone = process.env.NEXT_PUBLIC_VENUE_TIMEZONE?.trim() || "Asia/Almaty";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

const quest = process.argv.find((arg) => arg.startsWith("--quest="))?.slice("--quest=".length) ??
  "ritual";

console.log(`\n══ СКВОЗНАЯ ПРОВЕРКА БРОНИРОВАНИЯ ══\nАдрес: ${base}\nКвест: ${quest}\n`);

/* ── 1. Приложение отвечает ──────────────────────────────────────────────── */
let health;
try {
  const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
  health = await response.json();
  check("GET /api/health отвечает", response.ok || response.status === 503, `status ${response.status}`);
} catch (error) {
  check("GET /api/health отвечает", false, error.message);
  console.log("\nПриложение недоступно — дальше проверять нечего.\n");
  process.exit(1);
}

if (health?.checks?.storage?.writable === false) {
  console.log(
    "\nХранилище недоступно для записи, бронирование намеренно отключено.\n" +
      "Это ожидаемое поведение без DATABASE_URL на serverless.\n" +
      "Сквозную проверку можно выполнить только там, где брони сохраняются.\n",
  );
  process.exit(1);
}

/* ── 2. Ищем свободный слот ──────────────────────────────────────────────── */
let slot = null;
for (let offset = 1; offset <= 21 && !slot; offset += 1) {
  const dateISO = venueDate(offset);
  try {
    const response = await fetch(`${base}/api/availability?quest=${quest}&date=${dateISO}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) continue;
    const body = await response.json();
    const free = (body?.availability?.slots ?? []).find(
      (item) => item.status === "available" && Number(item.seatsLeft) >= 3,
    );
    if (free) slot = { dateISO, time: free.time, seatsLeft: Number(free.seatsLeft) };
  } catch {
    /* недоступная дата — просто идём дальше */
  }
}
check("найден свободный слот с 3+ местами", Boolean(slot), slot ? `${slot.dateISO} ${slot.time} (${slot.seatsLeft} мест)` : "не найден за 21 день");

if (!slot) {
  console.log("\nСвободных слотов нет — проверка остановлена.\n");
  process.exit(1);
}

/* ── 3. Создаём бронь ────────────────────────────────────────────────────── */
const idempotencyKey = `test-booking-${Date.now()}`;
const payload = {
  questSlug: quest,
  players: 3,
  fearMode: "light",
  dateISO: slot.dateISO,
  time: slot.time,
  extraIds: [],
  isBirthday: false,
  name: TEST_NAME,
  phone: TEST_PHONE,
  messenger: "whatsapp",
  comment: "Автоматическая проверка бронирования",
};

async function post(body, key) {
  const response = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    /* тело может быть пустым */
  }
  return { status: response.status, body: parsed };
}

let bookingNumber = null;
try {
  const created = await post(payload, idempotencyKey);
  bookingNumber = created.body?.booking?.id ?? null;
  check(
    "POST /api/bookings создаёт бронь",
    created.status === 201 && Boolean(bookingNumber),
    `status ${created.status}${bookingNumber ? `, номер ${bookingNumber}` : ""}`,
  );
  if (created.body?.booking?.total) {
    check(
      "сервер вернул рассчитанную стоимость",
      Number(created.body.booking.total) > 0,
      `${created.body.booking.total} ₸`,
    );
  }
} catch (error) {
  check("POST /api/bookings создаёт бронь", false, error.message);
}

/* ── 4. Повторная отправка с тем же ключом не создаёт дубль ──────────────── */
try {
  const repeated = await post(payload, idempotencyKey);
  const repeatedNumber = repeated.body?.booking?.id ?? null;
  check(
    "повторная отправка возвращает ту же бронь",
    repeatedNumber === bookingNumber && bookingNumber !== null,
    `получен ${repeatedNumber ?? "без номера"}`,
  );
} catch (error) {
  check("повторная отправка возвращает ту же бронь", false, error.message);
}

/* ── 5. Занятость выросла ────────────────────────────────────────────────── */
try {
  const response = await fetch(
    `${base}/api/availability?quest=${quest}&date=${slot.dateISO}`,
    { signal: AbortSignal.timeout(15000) },
  );
  const body = await response.json();
  const now = (body?.availability?.slots ?? []).find((item) => item.time === slot.time);
  check(
    "занятость слота увеличилась",
    now && Number(now.seatsLeft) === slot.seatsLeft - 3,
    `было ${slot.seatsLeft}, стало ${now?.seatsLeft ?? "?"}`,
  );
} catch (error) {
  check("занятость слота увеличилась", false, error.message);
}

/* ── 6. Переполнение отклоняется ─────────────────────────────────────────── */
try {
  const overflow = await post({ ...payload, players: 15, phone: "+7 700 000 09 98" }, null);
  const rejected = overflow.status === 422 || overflow.status === 409;
  check(
    "запрос сверх вместимости отклонён",
    rejected,
    `status ${overflow.status}${overflow.body?.errors?.time ? `: ${overflow.body.errors.time}` : ""}`,
  );
} catch (error) {
  check("запрос сверх вместимости отклонён", false, error.message);
}

/* ── Итог ────────────────────────────────────────────────────────────────── */
const failed = results.filter((result) => !result.ok);
console.log(
  `\nИтог: пройдено ${results.length - failed.length} из ${results.length}${failed.length ? `, провалено ${failed.length}` : ""}`,
);

if (bookingNumber) {
  console.log(
    `\nСоздана тестовая бронь ${bookingNumber}.\n` +
      `Это НАСТОЯЩАЯ запись в базе — отмените её в админке (статус «Отменена»),\n` +
      `чтобы она не занимала место и не попала в отчётность.\n`,
  );
}

console.log(failed.length === 0 ? "Путь бронирования работает.\n" : "Есть разрывы — см. выше.\n");
process.exit(failed.length === 0 ? 0 : 1);
