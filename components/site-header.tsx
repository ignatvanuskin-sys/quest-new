"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Phone, X } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { LogoLockup } from "@/components/logo";
import { SoundRow } from "@/components/sound";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#quests", label: "Квесты" },
  { href: "/#characters", label: "Персонажи" },
  { href: "/#inside", label: "Что внутри" },
  { href: "/#reviews", label: "Отзывы" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contacts", label: "Контакты" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Меню закрывается при смене страницы и блокирует скролл, пока открыто
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) {
      document.documentElement.style.overflow = "";
      return;
    }
    document.documentElement.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        // paddingTop учитывает «шторку» и вырез на iPhone: без него шапка
        // в режиме приложения уезжает под системную полосу
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        className={cn(
          "fixed inset-x-0 top-0 z-[68] transition-all duration-500",
          scrolled
            ? "border-b border-bone/10 bg-ink/92 backdrop-blur-md supports-[backdrop-filter]:bg-ink/80"
            : "border-b border-transparent bg-gradient-to-b from-ink/85 to-transparent",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            data-cursor="[ НАЧАЛО ]"
            className="group flex min-h-[44px] items-center text-bone"
            aria-label={`${BUSINESS.name} — на главную`}
          >
            <LogoLockup size={38} subtitle="Алматы · хоррор-перформансы" />
          </Link>

          <nav aria-label="Основная навигация" className="hidden items-center gap-0.5 xl:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-cursor="[ СМОТРЕТЬ ]"
                className="px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-bone-dim transition hover:text-bone"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${BUSINESS.phone}`}
              data-cursor="[ ЗВОНИТЬ ]"
              className="hidden items-center gap-2 px-3 py-2 font-mono text-[11px] tracking-[0.12em] text-bone-dim transition hover:text-bone md:flex"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {BUSINESS.phonePretty}
            </a>
            <Link
              href="/booking"
              data-cursor="[ ЗАБРОНИРОВАТЬ ]"
              className="btn-blood hidden min-h-[44px] items-center px-5 py-2.5 font-display text-[13px] uppercase tracking-[0.16em] transition-transform sm:inline-flex"
            >
              Забронировать
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Открыть меню"
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="flex h-11 w-11 items-center justify-center border border-bone/20 text-bone lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-ink/98 backdrop-blur-xl lg:hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-bone/10 px-4 py-3">
              <span className="font-display text-sm uppercase tracking-[0.2em] text-bone-dim">Меню</span>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                aria-label="Закрыть меню"
                className="flex h-11 w-11 items-center justify-center border border-bone/20 text-bone"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Прокручивается весь блок целиком — и пункты, и действия.
                На коротких экранах (iPhone SE 320×568) шесть пунктов плюс
                кнопка брони и телефон не помещаются: без общего скролла
                нижние элементы были обрезаны и недостижимы. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <nav
              aria-label="Мобильная навигация"
              className="flex flex-col gap-0.5 px-5 py-4 sm:px-6"
            >
              {NAV.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + index * 0.05 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block min-h-[52px] border-b border-bone/8 py-3 font-display text-[clamp(1.45rem,7.6vw,2.2rem)] uppercase leading-tight tracking-tight text-bone transition hover:text-crimson"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            <div className="space-y-3 border-t border-bone/10 px-5 pb-8 pt-5 sm:px-6">
              {/* На телефоне плавающая кнопка звука не показывается,
                  поэтому управление звуком живёт здесь — всегда под рукой */}
              <SoundRow />
              <Link
                href="/booking"
                onClick={() => setOpen(false)}
                className="btn-blood flex min-h-[56px] items-center justify-center px-6 py-4 font-display text-base uppercase tracking-[0.16em]"
              >
                Забронировать игру
              </Link>
              <a
                href={`tel:${BUSINESS.phone}`}
                className="flex min-h-[48px] items-center justify-center gap-2 border border-bone/20 px-6 py-3 font-mono text-xs tracking-[0.16em] text-bone-dim"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {BUSINESS.phonePretty}
              </a>
              <div className="safe-bottom" />
            </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
