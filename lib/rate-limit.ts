/**
 * Простой ограничитель частоты запросов (in-memory, скользящее окно).
 *
 * Зачем: публичная форма брони и вход в админку — это две точки, через
 * которые в проект попадает мусор. Без ограничения один скрипт может
 * создать сотни фейковых заявок за минуту, а пароль администратора можно
 * перебирать бесконечно.
 *
 * Ограничения подхода (честно): счётчики живут в памяти процесса, поэтому
 * на нескольких инстансах лимит считается отдельно на каждом, а перезапуск
 * процесса его сбрасывает. Для одного сервера (VPS + pm2) этого достаточно;
 * при переходе на несколько инстансов лимитер переносится в Redis.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

export interface RateLimitResult {
  ok: boolean;
  /** Сколько секунд ждать до следующей попытки */
  retryAfter: number;
  remaining: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Периодическая уборка: не даём карте расти бесконечно при потоке запросов
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.hits.every((time) => now - time > windowMs)) buckets.delete(bucketKey);
    }
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((time) => now - time < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    buckets.set(key, bucket);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      remaining: 0,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  return { ok: true, retryAfter: 0, remaining: Math.max(0, limit - bucket.hits.length) };
}

/**
 * Сброс счётчиков. Нужен автотестам: проверка лимита специально исчерпывает
 * окно, и без сброса следующий прогон не сможет проверить обычную бронь.
 * Наружу отдаётся только через служебный эндпоинт, который включается
 * переменной ALLOW_TEST_ENDPOINTS и в продакшене недоступен.
 */
export function resetRateLimits(): number {
  const size = buckets.size;
  buckets.clear();
  return size;
}

/** IP клиента с учётом прокси; для локальной разработки — «local» */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || real || "local";
  return `${scope}:${ip}`;
}
