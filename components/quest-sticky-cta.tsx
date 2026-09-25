import Link from "next/link";
import { MessageCircle, Ticket } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { formatKzt } from "@/lib/utils";

/**
 * Липкая панель брони на странице квеста: цена и одно действие.
 * Появляется только на мобильных и учитывает safe-area.
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
      <div className="safe-bottom flex items-center gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">{title}</p>
          <p className="font-display text-base text-bone">
            от {formatKzt(priceFrom)} <span className="font-mono text-[10px] text-crimson">с человека</span>
          </p>
        </div>
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
          className="btn-blood flex shrink-0 items-center gap-2 px-5 py-3.5 font-display text-sm uppercase tracking-[0.14em]"
        >
          <Ticket className="h-4 w-4" aria-hidden="true" />
          Забронировать
        </Link>
      </div>
    </div>
  );
}
