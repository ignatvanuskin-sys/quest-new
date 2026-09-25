import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
  checkPassword,
  createSessionToken,
  isAdminConfigured,
} from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { forbiddenOrigin, isSameOrigin, tooManyRequests } from "@/lib/http";

export const dynamic = "force-dynamic";

/** POST /api/admin/session — вход в админку по паролю */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  // Перебор пароля: 8 попыток за 15 минут с одного адреса
  const limit = rateLimit(clientKey(request, "admin-login"), 8, 15 * 60 * 1000);
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfter, "Слишком много попыток входа. Попробуйте позже.");
  }

  if (!isAdminConfigured()) {
    console.error(
      "[admin] Вход невозможен: в продакшене не заданы ADMIN_PASSWORD и ADMIN_SESSION_SECRET.",
    );
    return NextResponse.json(
      {
        ok: false,
        message: "Панель отключена: администратор не настроил доступ. Обратитесь к разработчику.",
      },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ ok: false, message: "Неверный запрос" }, { status: 400 });
  }

  if (!body.password || !checkPassword(body.password)) {
    return NextResponse.json(
      { ok: false, message: "Неверный пароль" },
      { status: 401 },
    );
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionToken(), ADMIN_COOKIE_OPTIONS);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/session — выход */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
