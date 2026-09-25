import { DoorOpen, HandHeart, Timer } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/ui";

/**
 * «Как проходит игра» — снятие главного страха новичка.
 *
 * Человек, который никогда не был на хоррор-квесте, боится не актёров,
 * а неизвестности: что от меня будут требовать, куда идти, не опозорюсь ли
 * перед друзьями. Три шага отвечают на это до брони, а не после.
 *
 * Все три пункта — реальные правила площадки: приход за 15 минут,
 * инструктаж со стоп-словом, 60 минут игры.
 */
const STEPS = [
  {
    icon: DoorOpen,
    time: "За 15 минут",
    title: "Приходите и находите вход",
    text: "Адрес и ориентир отправляем после подтверждения. У входа звоните администратору — вас встречают и проводят внутрь.",
  },
  {
    icon: HandHeart,
    time: "5 минут",
    title: "Инструктаж и стоп-слово",
    text: "Коротко объясняем правила и договариваемся о стоп-слове. Скажете его — администратор выведет вас из локации немедленно и без вопросов.",
  },
  {
    icon: Timer,
    time: "60 минут",
    title: "Игра",
    text: "Команда внутри, актёры работают по выбранному уровню страха. Задания, комнаты, выход — искать и решать нужно вместе.",
  },
] as const;

export function HowItWorks({ compact = false }: { compact?: boolean }) {
  return (
    <section
      id="how"
      aria-label="Как проходит игра"
      className={`relative scroll-mt-24 border-t border-bone/8 bg-ink ${compact ? "py-12" : "py-16 sm:py-24"}`}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <SectionHeading
            eyebrow="Как это проходит"
            title={
              <>
                Три шага — и вы <span className="text-crimson">внутри</span>
              </>
            }
            lead="Если вы ни разу не были на хоррор-квесте, порядок такой. Ничего не нужно приносить, знать заранее или готовить."
          />
        </Reveal>

        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={((index % 3) as 0 | 1 | 2)}>
                <li className="card-horror h-full p-5">
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6 text-crimson" aria-hidden="true" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
                      {step.time}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg uppercase leading-tight tracking-[0.04em] text-bone">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-bone-dim">{step.text}</p>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
