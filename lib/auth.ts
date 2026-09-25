import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
//  Простая, но корректная защита админки: пароль + подписанная cookie.
//
//  • пароль сравнивается через timingSafeEqual (не даём угадывать по времени ответа);
//  • cookie подписана HMAC-SHA256 секретом ADMIN_SESSION_SECRET;
//  • сессия живёт 12 часов;
//  • cookie httpOnly + sameSite=lax, поэтому её не украдёт скрипт со страницы.
//
//  Этого достаточно для админки одного квеста. Если появится несколько
//  сотрудников с разными правами — меняем на нормальный провайдер авторизации,
//  не переписывая остальной код.
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_COOKIE = "hc_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * В продакшене админка работает ТОЛЬКО с заданными переменными окружения.
 *
 * Раньше был молчаливый дефолт: если забыть задать ADMIN_PASSWORD, панель
 * открывалась паролем «horror-clinic» — то есть любой, кто читал репозиторий,
 * получал доступ к персональным данным клиентов. Теперь при отсутствии
 * переменных вход отключён, а в лог пишется понятное объяснение.
 */
export function isAdminConfigured(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

function secret(): string {
  const fromEnv = process.env.ADMIN_SESSION_SECRET;
  if (fromEnv) return fromEnv;

  // В продакшене без секрета подписывать токены нельзя — берём случайный
  // для процесса: тогда подделать cookie нельзя даже зная код,
  // а после перезапуска старые сессии просто становятся недействительными.
  if (process.env.NODE_ENV === "production") return randomBytes(32).toString("hex");
  return "quest-horror-clinic-dev-secret";
}

/** Подпись полезной нагрузки токена — HMAC-SHA256 на секрете процесса */
function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function checkPassword(candidate: string): boolean {
  const expected =
    process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "horror-clinic");
  if (!expected) return false;
  const a = Buffer.from(candidate.padEnd(64, "\u0000"));
  const b = Buffer.from(expected.padEnd(64, "\u0000"));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [scope, expires, signature] = parts;
  if (scope !== "admin") return false;
  const expected = sign(`${scope}.${expires}`);
  if (expected.length !== signature.length) return false;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;
  return Number(expires) > Date.now();
}

/** Проверка доступа из server component / route handler */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Флаг `secure` включаем только если сайт реально открывается по https.
 *
 * Иначе получается ловушка: `npm run build && npm start` на localhost по http
 * (или хостинг без TLS) — браузер просто не примет cookie, и админ не сможет
 * войти, хотя пароль верный. Проверяем адрес сайта, а не NODE_ENV.
 */
function usesHttps(): boolean {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (url.startsWith("https://")) return true;
  // Развёртывание на Vercel всегда https, даже если переменная не задана
  return Boolean(process.env.VERCEL);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
  secure: usesHttps(),
};
