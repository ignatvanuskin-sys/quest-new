import { NextResponse } from "next/server";
import { buildDayAvailability, buildMonthSummary } from "@/lib/availability";
import { bookedSeatsByDate, bookedSeatsByTime } from "@/lib/bookings";
import { getQuest } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?quest=<slug>&date=YYYY-MM-DD   → слоты одного дня
 * GET /api/availability?quest=<slug>&month=YYYY-MM     → сводка по месяцу
 *
 * Занятость = демо-расписание площадки минус реальные брони из базы.
 * Когда появится CRM/календарь заведения — достаточно заменить источник
 * в lib/availability.ts, контракт ответа останется прежним.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const questSlug = url.searchParams.get("quest") ?? "";
  const date = url.searchParams.get("date");
  const month = url.searchParams.get("month");

  const quest = getQuest(questSlug);
  if (!quest) {
    return NextResponse.json({ ok: false, message: "Неизвестный квест" }, { status: 404 });
  }

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, message: "Неверный формат даты" }, { status: 400 });
    }
    const booked = await bookedSeatsByTime(questSlug, date);
    const availability = buildDayAvailability(questSlug, date, { bookedSeatsByTime: booked });
    return NextResponse.json(
      { ok: true, availability },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) {
      return NextResponse.json({ ok: false, message: "Неверный формат месяца" }, { status: 400 });
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const booked = await bookedSeatsByDate(questSlug);
    const summary = buildMonthSummary(questSlug, year, monthIndex, booked);
    return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { ok: false, message: "Укажите date=YYYY-MM-DD или month=YYYY-MM" },
    { status: 400 },
  );
}
