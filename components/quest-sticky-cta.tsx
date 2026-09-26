import Link from "next/link";
import { MessageCircle, Ticket } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { formatKzt } from "@/lib/utils";

/**
 * Липкая панель брони на странице квеста: цена и одно действие.
 * Появляется только на мобильных и учитывает safe-area.
 *
 * ПОЧЕМУ ДВЕ РЯДКА НА УЗКИХ ЭКРАНАХ. Раньше строка была одна: текст слева,
 * две кнопки справа. На 320px кнопки (иконка 48px + «Забронировать» с полями)
 * забирали почти всю ширину, тексту оставалось около 25px — и цена
 * «от 35 000 ₸ с человека» разваливалась по одному слову в столбик,
 * а панель раздувалась до 184px, то есть до трети экрана.
 *
 * Теперь до 360px панель складывается в две строки: сверху название и цена
 * во всю ширину, снизу два действия. Текст получает полную ширину и не рвётся,
 * панель остаётся ниже 120px, а главная кнопка занимает остаток строки.
 */
export function QuestStickyCta({
  slug,
  priceFrom,
  title,
}: {
  slug: string;
  priceFrom: number;
  title: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[67] border-t border-bone/12 bg-ink/95 backdrop-blur-md lg:hidden">
      <div className="safe-bottom flex flex-col gap-2.5 px-4 pt-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:gap-3">
        <div className="min-w-0 min-[360px]:flex-1">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
            {title}
          </p>
          {/* whitespace-nowrap: цена — единое целое, переносить её по частям нельзя */}
          <p className="flex items-baseline gap-1.5 whitespace-nowrap font-display text-base text-bone">
            от {formatKzt(priceFrom)}
            <span className="font-mono text-[10px] text-crimson">с человека</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={BUSINESS.whatsapp}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label="Написать в WhatsApp"
            className="flex h-12 w-12 shrink-0 items-center justify-center border border-bone/20 text-bone"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link
            href={`/booking?quest=${slug}`}
            className="btn-blood flex h-12 flex-1 items-center justify-center gap-2 px-5 font-display text-sm uppercase tracking-[0.14em] min-[360px]:shrink-0"
          >
            <Ticket className="h-4 w-4" aria-hidden="true" />
            Забронировать
          </Link>
        </div>
      </div>
    </div>
  );
}
