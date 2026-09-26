import Image from "next/image";
import { Camera, Instagram } from "lucide-react";
import { BUSINESS } from "@/lib/content";
import { IMAGE_PLACEHOLDERS } from "@/lib/image-placeholders";
import { Reveal } from "@/components/reveal";
import { SectionHeading, MonoLabel } from "@/components/ui";

/**
 * Эмоции реальных игроков — самый сильный аргумент в хоррор-индустрии.
 *
 * На макете стоит сгенерированное изображение, и мы это прямо подписываем:
 * выдавать сток за фото клиентов — обман, который рушит доверие.
 * В README описано, как заменить его на реальные фото команд.
 */
export function Gallery() {
  return (
    <section id="after" className="scroll-mt-24 border-t border-bone/8 bg-ink py-16 sm:py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="После игры"
            title={
              <>
                Вот за это <span className="text-crimson">здесь и платят</span>
              </>
            }
            lead="Никакая афиша не передаёт момент, когда команда выходит из локации. Смотрите, как это выглядит на самом деле — фото и видео игроков в Instagram площадки."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <figure className="card-horror relative overflow-hidden">
              <div className="relative aspect-[3/2]">
                <Image
                  src="/images/team-emotions.jpg"
                  alt="Команда игроков сразу после выхода из хоррор-квеста: смех, шок и адреналин"
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  placeholder="blur"
                  blurDataURL={IMAGE_PLACEHOLDERS["team-emotions"]}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
              </div>
              <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 p-5">
                <span className="font-display text-lg uppercase tracking-[0.1em] text-bone">
                  Команда вышла. Живая.
                </span>
              {/* Раньше здесь стояла подпись «демо-изображение для макета».
                  В продакшене она читалась как «фото у нас настоящие, но
                  показан не настоящий» — и обесценивала всю секцию.
                  Теперь сказано прямо: снимок иллюстрирует раздел, а реальные
                  кадры команд лежат в Instagram, ссылка на который рядом. */}
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">
                  иллюстрация раздела
                </span>
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={1}>
            <div className="flex h-full flex-col justify-between gap-6 border border-bone/10 bg-charcoal/60 p-6">
              <div>
                <MonoLabel>Instagram площадки</MonoLabel>
                <h3 className="mt-5 font-display text-2xl uppercase leading-tight tracking-tight text-bone">
                  Больше хоррора в {BUSINESS.instagramHandle}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-bone-dim">
                  Реальные видео из локаций, реакции команд, новые сценарии и объявления о ночных играх.
                  Там же — записи на закрытые сеансы.
                </p>

                <ul className="mt-6 space-y-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text">
                  <li className="flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
                    Съёмка внутри локации — по согласованию
                  </li>
                  <li className="flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
                    Фото команды после игры — бесплатно
                  </li>
                </ul>
              </div>

              <a
                href={BUSINESS.instagram}
                target="_blank"
                rel="noopener noreferrer nofollow"
                data-cursor="[ ОТКРЫТЬ ]"
                className="btn-ghost flex min-h-[48px] items-center justify-center gap-3 px-6 py-4 font-display text-sm uppercase tracking-[0.16em]"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                Смотреть больше хоррора
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
