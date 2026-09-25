import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { SectionBackdrop } from "@/components/backdrop";
import { EyesWatch } from "@/components/scenery";

export default function NotFound() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-ink px-4 py-32 text-center">
      <SectionBackdrop image="/images/band-corridor.jpg" opacity={0.34} />
      <div className="pointer-events-none absolute inset-0 -z-[1] bg-[radial-gradient(ellipse_at_50%_60%,rgba(109,14,19,0.22),transparent_65%)]" aria-hidden="true" />
      <EyesWatch side="right" className="top-[22%]" size="1rem" />

      <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-crimson">Ошибка 404</p>
      <h1
        className="glitch-text mt-6 font-display text-[clamp(2.4rem,12vw,6rem)] uppercase leading-[0.9] text-bone"
        data-active="true"
        data-text="Этой двери нет"
      >
        Этой двери нет
      </h1>
      <p className="mt-6 max-w-lg text-base leading-relaxed text-bone-dim">
        Страница либо закрылась сама, либо её никогда не было. Настоящие локации — там, где есть свет: в
        каталоге квестов.
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/#quests"
          className="btn-blood flex items-center justify-center gap-3 px-7 py-4 font-display text-sm uppercase tracking-[0.16em]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          К каталогу квестов
        </Link>
        <a
          href={`tel:${BUSINESS.phone}`}
          className="btn-ghost flex items-center justify-center gap-3 px-7 py-4 font-mono text-[11px] uppercase tracking-[0.16em]"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {BUSINESS.phonePretty}
        </a>
      </div>
    </section>
  );
}
