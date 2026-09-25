/**
 * Проверки на уровне HTTP.
 *
 * Задача — не дать чужому сайту дернуть наши изменяющие эндпоинты
 * (админские операции выполняются по cookie, а cookie уходят с запросом
 * автоматически). Основную защиту уже даёт `sameSite=lax`, но этого мало:
 * проверка Origin — вторая линия обороны, и она дешёвая.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  // Запросы без Origin (curl, тесты, серверные вызовы) не являются
  // браузерной CSRF-атакой: браузер всегда прикладывает Origin
  // к кросс-доменным POST/PATCH/DELETE.
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Единый ответ «слишком часто» — с Retry-After, чтобы клиент знал, что делать */
export function tooManyRequests(retryAfter: number, message: string): Response {
  return Response.json(
    { ok: false, message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Ответ на запрос с чужого домена */
export function forbiddenOrigin(): Response {
  return Response.json(
    { ok: false, message: "Запрос с внешнего домена отклонён" },
    { status: 403 },
  );
}
