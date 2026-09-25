import { NextResponse } from "next/server";
import { resetRateLimits } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Служебный сброс счётчиков частоты — только для автотестов.
 *
 * Эндпоинт включается переменной ALLOW_TEST_ENDPOINTS=1 (она есть только
 * в локальном .env.local). Без неё маршрут отвечает 404, как будто его
 * не существует: в продакшене такой двери нет.
 */
export async function POST(request: Request) {
  if (process.env.ALLOW_TEST_ENDPOINTS !== "1") {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const cleared = resetRateLimits();
  return NextResponse.json({ ok: true, cleared });
}
