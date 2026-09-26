import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { getAvailabilityProvider } from "@/lib/providers/availability";
import { getQuest } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?quest=<slug>&date=YYYY-MM-DD   → слоты одного дня
 * GET /api/availability?quest=<slug>&month=YYYY-MM     → сводка по месяцу
 *
 * Источник расписания скрыт за провайдером (lib/providers/availability.ts):
 * это может быть собственная база, календарь заведения или внешняя система.
 * Контракт ответа при этом не меняется, поэтому интерфейс о подмене не знает.
 *
 * Отдельно про ошибки: если внешний источник не ответил, отдаём 503 с
 * понятным текстом, а НЕ устаревшее или выдуманное расписание. Показать
 * «сегодня 15:00, 4 места» из кеша, когда это неправда, — хуже, чем честно
 * сказать «расписание недоступно».
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

  const provider = await getAvailabilityProvider();

  try {
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ ok: false, message: "Неверный формат даты" }, { status: 400 });
      }
      const availability = await provider.getAvailableSlots({ questSlug, dateISO: date });

      // Провайдер без слотов — это не «всё занято», а «данных нет».
      // Интерфейс обязан показать разные сообщения в этих случаях.
      if (provider.external && availability.slots.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Не удалось загрузить расписание. Обновите страницу или напишите нам — подберём время вручную.",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }

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
      const summary = await provider.getMonthSummary(questSlug, year, monthIndex);
      return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    log.error("availability_provider_error", {
      quest: questSlug,
      reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не удалось загрузить расписание. Обновите страницу или напишите нам — подберём время вручную.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: false, message: "Укажите date=YYYY-MM-DD или month=YYYY-MM" },
    { status: 400 },
  );
}
