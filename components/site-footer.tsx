import Link from "next/link";
import { Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import { BUSINESS, LOCATIONS } from "@/lib/content";
import { LogoLockup } from "@/components/logo";

const NAV = [
  { href: "/#quests", label: "Квесты" },
  { href: "/#characters", label: "Персонажи" },
  { href: "/#inside", label: "Что внутри" },
  { href: "/#inside-photos", label: "Кадры изнутри" },
  { href: "/#fear-test", label: "Уровень страха" },
  { href: "/#after", label: "После игры" },
  { href: "/#reviews", label: "Отзывы" },
  { href: "/#before", label: "Перед входом" },
  { href: "/#faq", label: "Вопросы" },
  { href: "/#contacts", label: "Контакты" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-bone/10 bg-charcoal/60">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <LogoLockup size={44} subtitle="Алматы · с 11 лет" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-bone-dim">
              Хоррор-перформансы в реальном бомбоубежище Алматы. Локации 250–300 м², живые актёры и четыре
              уровня страха на выбор команды.
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
              {BUSINESS.legalName} · {BUSINESS.city}, {BUSINESS.country}
            </p>
          </div>

          <nav aria-label="Навигация в подвале">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.26em] text-ash-text">Разделы</h2>
            {/* Тап-цель 44px: по ссылке в подвале промахнуться пальцем очень
                легко, поэтому высота задана явно. Вертикальный отступ сетки
                уменьшен — иначе подвал стал бы заметно длиннее. */}
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-0.5">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-[44px] items-center text-sm text-bone-dim transition hover:text-bone"
                    data-cursor="[ СМОТРЕТЬ ]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/booking"
                  className="inline-flex min-h-[44px] items-center text-sm text-crimson transition hover:text-bone"
                >
                  Бронирование
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.26em] text-ash-text">Контакты</h2>
            {/* Телефон и мессенджеры — то, по чему звонят с телефона.
                Высота 44px и уменьшенный отступ: промахнуться нельзя. */}
            <ul className="mt-2 space-y-0.5 text-sm">
              <li>
                <a
                  href={`tel:${BUSINESS.phone}`}
                  className="flex min-h-[44px] items-center gap-2.5 text-bone-dim transition hover:text-bone"
                >
                  <Phone className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
                  {BUSINESS.phonePretty}
                </a>
              </li>
              <li>
                <a
                  href={BUSINESS.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex min-h-[44px] items-center gap-2.5 text-bone-dim transition hover:text-bone"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
                  WhatsApp: бронь и предоплата
                </a>
              </li>
              <li>
                <a
                  href={BUSINESS.instagram}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex min-h-[44px] items-center gap-2.5 text-bone-dim transition hover:text-bone"
                >
                  <Instagram className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
                  {BUSINESS.instagramHandle}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${BUSINESS.email}`}
                  className="flex min-h-[44px] items-center gap-2.5 text-bone-dim transition hover:text-bone"
                >
                  <Mail className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
                  {BUSINESS.email}
                </a>
              </li>
            </ul>

            <ul className="mt-5 space-y-2 border-t border-bone/10 pt-4">
              {LOCATIONS.map((location) => (
                <li key={location.id} className="text-xs leading-relaxed text-ash-text">
                  <span className="text-bone-dim">{location.label}:</span> {location.address}
                </li>
              ))}
              <li className="text-xs text-ash-text">{BUSINESS.workingHours}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-bone/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs leading-relaxed text-ash-text">
            © {new Date().getFullYear()} {BUSINESS.name}. Цены, адреса и режим работы — актуальные данные
            площадки. Итоговую стоимость подтверждает администратор при бронировании.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/booking"
              className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.22em] text-bone-dim hover:text-bone"
            >
              Забронировать
            </Link>
            <Link
              href="/admin"
              className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text hover:text-bone-dim"
            >
              Панель администратора
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
