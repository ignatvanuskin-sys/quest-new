import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Lock, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { MonoLabel } from "@/components/ui";
import { SectionBackdrop } from "@/components/backdrop";
import { BUSINESS, FEAR_MODES, SOCIAL_PROOF } from "@/lib/content";
import type { FearModeId } from "@/lib/types";

export const metadata: Metadata = {
  title: "Онлайн-бронирование хоррор-квеста в Алматы",
  description:
    "Забронируйте хоррор-квест в Алматы за 3 шага: выберите сценарий, дату и время, уровень страха. Свободные слоты обновляются онлайн, от 3 500 ₸ за игрока.",
  alternates: { canonical: "/booking" },
  openGraph: {
    title: "Забронировать хоррор-квест в Алматы",
    description: "Свободные слоты онлайн, 6 сценариев, 4 уровня страха, предоплата для подтверждения брони.",
    images: ["/images/quest-psycho.jpg"],
  },
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ quest?: string; fear?: string }>;
}) {
  const { quest, fear } = await searchParams;
  const fearMode = FEAR_MODES.some((mode) => mode.id === fear) ? (fear as FearModeId) : undefined;

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-bone/8 bg-gradient-to-b from-blood-deep/20 via-ink to-ink pb-10 pt-32 sm:pt-36">
        {/* Атмосфера на входе в форму: кадр пустой комнаты с халатом.
            Дальше — только форма, без отвлекающих фонов: конверсия важнее */}
        <SectionBackdrop image="/images/band-mask.jpg" opacity={0.28} position="top" />
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <MonoLabel>Бронирование</MonoLabel>
          <h1 className="mt-5 max-w-3xl font-display text-[clamp(2rem,8vw,4.6rem)] uppercase leading-[0.92] tracking-tight text-bone">
            Забронировать <span className="text-crimson">игру</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-bone-dim sm:text-lg">
            Три шага — это шаги <span className="text-bone">заявки</span>: сценарий и команда → дата, время и
            уровень страха → контакт. Оплата на сайте не списывается.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-base">
            После заявки администратор напишет вам в выбранном мессенджере, подтвердит бронь и пришлёт
            реквизиты предоплаты. Слоты заняты после предоплаты, а не сразу после отправки формы.
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            <li className="flex items-start gap-3 border border-bone/10 bg-ash/50 p-4">
              <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              <span className="text-sm leading-relaxed text-bone-dim">
                Занятость слотов — из подтверждённых броней, без выдуманных «осталось 2 минуты»
              </span>
            </li>
            <li className="flex items-start gap-3 border border-bone/10 bg-ash/50 p-4">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              <span className="text-sm leading-relaxed text-bone-dim">{BUSINESS.prepaymentNote}</span>
            </li>
            <li className="flex items-start gap-3 border border-bone/10 bg-ash/50 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              <span className="text-sm leading-relaxed text-bone-dim">
                Стоп-слово работает всегда: администратор выводит участника из игры сразу
              </span>
            </li>
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/#quests"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text underline decoration-crimson/50 underline-offset-4 hover:text-bone"
            >
              Сначала посмотреть квесты
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
              Оценка игроков {SOCIAL_PROOF.ratingValue} / {BUSINESS.ratingScale}
            </span>
          </div>
        </div>
      </section>

      <BookingFlow initialQuestSlug={quest} initialFearMode={fearMode} />

      {/* Форма требует JS: даём запасной путь для тех, у кого он отключён */}
      <noscript>
        <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <div className="border border-crimson/40 bg-blood-deep/20 p-5">
            <p className="font-display text-lg uppercase tracking-[0.06em] text-bone">
              Для онлайн-брони нужен JavaScript
            </p>
            <p className="mt-2 text-sm leading-relaxed text-bone-dim">
              Включите его или забронируйте по телефону и в WhatsApp — администратор подберёт слот вручную.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`tel:${BUSINESS.phone}`}
                className="btn-blood flex items-center gap-2 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {BUSINESS.phonePretty}
              </a>
              <a
                href={BUSINESS.whatsapp}
                className="btn-ghost flex items-center gap-2 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em]"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </noscript>
    </>
  );
}
