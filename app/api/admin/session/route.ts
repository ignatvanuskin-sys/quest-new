import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, checkPassword, createSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/admin/session — вход в админку по паролю */
export async function POST(request: Request) {
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
export async function DELETE() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
