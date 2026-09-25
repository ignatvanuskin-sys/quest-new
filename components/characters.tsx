import Image from "next/image";
import Link from "next/link";
import { Eye, Fingerprint, ShieldCheck } from "lucide-react";
import { CHARACTERS, CHARACTER_RULES } from "@/lib/content";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";
import { BloodDivider, EyesWatch } from "@/components/scenery";
import { SectionBackdrop } from "@/components/backdrop";

/**
 * «Кто будет рядом» — персонажи сценариев.
 *
 * Актёры на площадке реальны, уровень контакта выбирает команда. Конкретные
 * роли — художественная подача сюжетов (состав и грим меняются от игры к игре),
 * поэтому под сеткой стоит честная приписка, а не выдуманный «кастинг».
 */
export function Characters() {
  return (
    <section
      id="characters"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-bone/8 bg-ink py-16 sm:py-24"
    >
      <SectionBackdrop image="/images/tex-rust.jpg" opacity={0.13} />
      <EyesWatch side="right" className="top-[14%]" size="1.2rem" />
      <EyesWatch side="left" className="bottom-[22%]" size="0.9rem" />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="Кто будет рядом"
            title={
              <>
                Внутри ждут <span className="blood-text">не декорации</span>
              </>
            }
            lead="Игру ведут живые актёры: они видят команду, слышат её и работают по её уровню страха. Ниже — роли, которые вы встретите в сценариях, и то, насколько близко они подходят."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CHARACTERS.map((character, index) => {
            const placeholder = IMAGE_PLACEHOLDERS[character.image.replace("/images/", "").replace(".jpg", "")];
            return (
              <Reveal key={character.id} delay={((index % 4) as 0 | 1 | 2 | 3)}>
                <article className="group relative flex h-full flex-col border border-bone/10 bg-gradient-to-b from-ash to-ink transition-colors duration-500 hover:border-crimson/45">
                  <div className="relative aspect-[3/4] overflow-hidden" data-scare>
                    <Image
                      src={character.image}
                      alt={character.imageAlt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      placeholder={placeholder ? "blur" : "empty"}
                      blurDataURL={placeholder}
                      className="object-cover object-top brightness-[0.72] contrast-[1.1] transition-all duration-700 group-hover:brightness-[0.92] group-hover:contrast-[1.22] group-hover:saturate-[0.8]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />

                    <span className="absolute left-3 top-3 border border-crimson/45 bg-ink/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-crimson backdrop-blur">
                      {character.contact}
                    </span>

                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="font-display text-[clamp(1.4rem,4.6vw,2rem)] uppercase leading-none tracking-tight text-bone">
                        {character.name}
                      </h3>
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-crimson">
                        {character.role}
                      </p>
                    </div>

                    {/* Наведение: «он замечает вас» — лёгкий зум и проявление детали */}
                    <div className="hover-only pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                      <span className="flex items-center gap-2 border border-bone/20 bg-ink/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-bone-dim backdrop-blur">
                        <Eye className="h-3 w-3 text-crimson" aria-hidden="true" />
                        смотрит на вас
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-sm leading-relaxed text-bone-dim">{character.description}</p>
                    <p className="mt-4 flex items-start gap-2 border-t border-bone/8 pt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-crimson">
                      <Fingerprint className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {character.detail}
                    </p>
                    <Link
                      href={`/quests/${character.questSlug}`}
                      data-cursor="[ ОТКРЫТЬ ]"
                      className="mt-4 inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim underline decoration-crimson/50 underline-offset-4 transition hover:text-bone"
                    >
                      Сценарий целиком
                    </Link>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <BloodDivider className="mt-12" />

        <Reveal delay={1}>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CHARACTER_RULES.map((rule) => (
              <li
                key={rule}
                className="flex items-start gap-3 border border-bone/10 bg-charcoal/50 p-4 text-xs leading-relaxed text-bone-dim"
              >
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-ash-text">
            Роли — часть сценариев площадки. Состав актёров, грим и детали меняются от игры к игре.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
