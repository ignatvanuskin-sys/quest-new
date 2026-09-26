"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Ticket } from "lucide-react";
import { BUSINESS } from "@/lib/content";

/**
 * Постоянная панель брони на мобильных — главный конверсионный элемент
 * телефонной версии, поэтому она:
 * • появляется сразу после первого экрана, а не после долгого скролла;
 * • даёт два действия: бронь и быстрый вопрос в WhatsApp;
 * • учитывает safe-area-inset-bottom;
 * • не перекрывает контент: под неё в разметке оставлен отступ;
 * • скрыта на странице брони, в админке и на странице квеста, где работает
 *   своя липкая кнопка с ценой именно этого сценария.
 */
export function MobileBookingBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const hiddenHere =
    pathname?.startsWith("/booking") || pathname?.startsWith("/quests");

  useEffect(() => {
    if (hiddenHere) return;
    const onScroll = () => setVisible(window.scrollY > 260);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hiddenHere]);

  if (hiddenHere) return null;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ y: 96 }}
          animate={{ y: 0 }}
          exit={{ y: 96 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-[67] border-t border-bone/12 bg-ink/95 backdrop-blur-md lg:hidden"
        >
          <div className="safe-bottom flex items-center gap-2 px-3 pt-2.5 sm:px-4 sm:pt-3">
            {/* Ширина узкая, поэтому текст сокращается по шагам:
                до 380 px — только цена, дальше — цена со слотом.
                `truncate` оставлен как страховка: даже если в будущем строка
                удлинится, она обрежется многоточием, а не залезет под кнопку
                (именно это случилось в предыдущей сборке на 320 px). */}
            <div className="min-w-0 flex-1">
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text min-[380px]:block">
                Бронь онлайн
              </p>
              {/* Цена за игру, а не «от 3 500 ₸»: именно её человек увидит
                  в форме, поэтому расхождения быть не должно */}
              <p className="truncate font-display text-[12px] uppercase leading-tight tracking-[0.02em] text-bone min-[380px]:text-[13px]">
                <span className="min-[380px]:hidden">15 000 ₸ за игру</span>
                <span className="hidden min-[380px]:inline">
                  15 000 ₸ за игру · от 3 500 ₸/чел.
                </span>
              </p>
            </div>

            <a
              href={BUSINESS.whatsapp}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label="Спросить в WhatsApp"
              className="flex h-12 w-12 shrink-0 items-center justify-center border border-bone/20 text-bone"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>

            <Link
              href="/booking"
              className="btn-blood flex h-12 shrink-0 items-center gap-2 px-3 font-display text-[13px] uppercase tracking-[0.1em] min-[380px]:px-4 sm:px-5 sm:text-sm"
            >
              {/* На самых узких экранах иконка скрыта — так кнопка короче,
                  а текст цены получает больше места */}
              <Ticket className="hidden h-4 w-4 min-[380px]:block" aria-hidden="true" />
              Забронировать
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
