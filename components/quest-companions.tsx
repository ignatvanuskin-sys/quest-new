import Image from "next/image";
import { Eye, Fingerprint } from "lucide-react";
import { CHARACTERS, INSIDE_SHOTS } from "@/lib/content";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import type { Quest } from "@/lib/types";
import { Reveal } from "@/components/reveal";
import { MonoLabel } from "@/components/ui";

/**
 * «Кто вас встретит» на странице квеста: персонажи этого сценария
 * (если для него есть роль) и три кадра локации изнутри.
 */
export function QuestCompanions({ quest }: { quest: Quest }) {
  const cast = CHARACTERS.filter((character) => character.questSlug === quest.slug);
  const shots = INSIDE_SHOTS.slice(0, 3);

  return (
    <section className="border-t border-bone/8 bg-charcoal/40 py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <MonoLabel>Кто вас встретит</MonoLabel>
          <h2 className="mt-5 font-display text-[clamp(1.6rem,5.4vw,2.8rem)] uppercase leading-none tracking-tight text-bone">
            Роли этого сценария
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-base">
            Актёры работают по уровню страха, который выбрала команда. Один и тот же сценарий может пройти
            почти без контакта — или так, что команда выйдет не сразу.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            {cast.length > 0 ? (
              cast.map((character) => {
                const placeholder = IMAGE_PLACEHOLDERS[
                  character.image.replace("/images/", "").replace(".jpg", "")
                ];
                return (
                  <Reveal key={character.id}>
                    <article className="flex gap-4 border border-bone/12 bg-ink/60 p-4">
                      <div className="relative h-32 w-24 shrink-0 overflow-hidden sm:h-40 sm:w-32" data-scare>
                        <Image
                          src={character.image}
                          alt={character.imageAlt}
                          fill
                          sizes="128px"
                          placeholder={placeholder ? "blur" : "empty"}
                          blurDataURL={placeholder}
                          className="object-cover object-top brightness-[0.75]"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-xl uppercase tracking-[0.04em] text-bone">
                            {character.name}
                          </h3>
                          <span className="border border-crimson/45 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-crimson">
                            {character.contact}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-bone-dim">{character.description}</p>
                        <p className="mt-3 flex items-start gap-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-crimson">
                          <Fingerprint className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                          {character.detail}
                        </p>
                      </div>
                    </article>
                  </Reveal>
                );
              })
            ) : (
              <Reveal>
                <div className="border border-bone/12 bg-ink/60 p-5">
                  <Eye className="h-5 w-5 text-crimson" aria-hidden="true" />
                  <p className="mt-3 text-sm leading-relaxed text-bone-dim">
                    На этом сценарии состав ролей зависит от выбранного уровня страха: при «без актёров» вы
                    проходите локацию одни, при остальных режимах работают актёры.
                  </p>
                </div>
              </Reveal>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {shots.map((shot, index) => {
              const placeholder = IMAGE_PLACEHOLDERS[
                shot.image.replace("/images/", "").replace(".jpg", "")
              ];
              return (
                <Reveal key={shot.id} delay={((index % 3) as 0 | 1 | 2)}>
                  <figure className="card-horror group relative" data-scare>
                    <div className="relative aspect-[3/2]">
                      <Image
                        src={shot.image}
                        alt={shot.imageAlt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 40vw"
                        placeholder={placeholder ? "blur" : "empty"}
                        blurDataURL={placeholder}
                        className="object-cover brightness-[0.68]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
                    </div>
                    <figcaption className="absolute inset-x-0 bottom-0 p-4">
                      <span className="block font-display text-base uppercase tracking-[0.04em] text-bone">
                        {shot.caption}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-bone-dim">{shot.note}</span>
                    </figcaption>
                  </figure>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
