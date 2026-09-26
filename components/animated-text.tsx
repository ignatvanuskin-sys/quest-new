"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRevealed } from "@/components/reveal";

/* ───────────────────────────────────────────────────────────────────────────
   АНИМИРОВАННЫЙ ТЕКСТ

   Буквы выходят по одной: сначала «из темноты» (размытие + сдвиг вверх),
   затем случайные буквы коротко мигают, как неисправная лампа. Так ключевая
   фраза читается как что-то, что появляется само, а не как набирающий текст.

   Важно: анимация включается только когда блок попадает в кадр, поэтому
   текст не «проигрывается» пока его не видно. При prefers-reduced-motion
   фраза просто показывается целиком.

   ПРО ПЕРЕНОСЫ СЛОВ — здесь была ошибка, из-за которой слово рвалось
   посередине. Каждая буква анимируется отдельным <span> с display:inline-block,
   а у любого inline-block есть место для переноса строки справа. В результате
   браузер мог разбить «глубоко» как «глубок / о», а «комната» как «комна / та»:
   строка рвалась в середине слова там, где браузеру было выгоднее.

   Лечится группировкой: буквы собираются в блок-слово с white-space: nowrap,
   поэтому переносится только слово целиком. Пробелы остаются обычными пробелами
   между группами — ровно там, где перенос и должен происходить. Тайминг анимации
   сохранён: индекс буквы считается сквозным по всей фразе, поэтому пробел
   не сбивает задержки.
   ─────────────────────────────────────────────────────────────────────────── */

interface AnimatedHeadlineProps {
  text: string;
  className?: string;
  /** Задержка перед началом, в секундах */
  delay?: number;
  /** Шаг между буквами */
  stagger?: number;
  /** Сколько случайных букв мигнёт после появления */
  flickerCount?: number;
  as?: "h1" | "h2" | "p" | "span";
  /** Показать «световую полосу» под фразой — приём из финального экрана */
  underline?: boolean;
}

export function AnimatedHeadline({
  text,
  className,
  delay = 0,
  stagger = 0.035,
  flickerCount = 2,
  as: Tag = "h2",
  underline = false,
}: AnimatedHeadlineProps) {
  // useRevealed, а не useInView: он дополнительно ловит случай, когда
  // пользователь «проскочил» секцию мгновенным скроллом — тогда буквы
  // иначе остались бы прозрачными навсегда
  const { ref, visible } = useRevealed<HTMLElement>();
  const reduced = useReducedMotion();

  /* Слова с их местом в общей фразе: слово — то, что нельзя разрывать,
     а сквозной индекс нужен, чтобы задержка шла по всей фразе без сброса. */
  let cursor = 0;
  const wordGroups = text.split(" ").map((word, wordIndex) => {
    const letters = Array.from(word);
    const start = cursor;
    // +1 — реальный пробел между словами, он тоже занимает шаг тайминга
    cursor += letters.length + 1;
    return { wordIndex, letters, start };
  });
  const totalCharacters = Math.max(0, cursor - 1);

  // Детерминированный выбор «мигающих» букв: нельзя использовать Math.random
  // на рендере — это ломает гидрацию. Берём буквы по фиксированному шагу.
  const flickerIndexes = new Set<number>();
  if (flickerCount > 0 && totalCharacters > 4) {
    const step = Math.max(2, Math.floor(totalCharacters / (flickerCount + 1)));
    for (let i = 1; i <= flickerCount; i += 1) {
      flickerIndexes.add(Math.min(totalCharacters - 1, i * step));
    }
  }

  if (reduced) {
    return (
      <Tag ref={ref as never} className={className}>
        {text}
      </Tag>
    );
  }

  return (
    <Tag ref={ref as never} className={cn("relative", className)}>
      <span className="sr-only">{text}</span>

      <span aria-hidden="true" className="inline-block">
        {wordGroups.map((group) => (
          <Fragment key={group.wordIndex}>
            {/* Обычный пробел между словами: единственное законное место переноса */}
            {group.wordIndex > 0 ? " " : null}
            {/* whitespace-nowrap — слово не рвётся на части ни при какой ширине */}
            <span className="inline-block whitespace-nowrap">
              {group.letters.map((character, letterIndex) => {
                const index = group.start + letterIndex;
                const flickers = flickerIndexes.has(index);
                return (
                  <motion.span
                    key={`${character}-${index}`}
                    initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                    animate={
                      visible
                        ? {
                            opacity: flickers ? [0, 1, 0.25, 1, 0.6, 1] : 1,
                            y: 0,
                            filter: "blur(0px)",
                          }
                        : undefined
                    }
                    transition={{
                      duration: flickers ? 1.1 : 0.6,
                      delay: delay + index * stagger,
                      ease: [0.22, 1, 0.36, 1],
                      times: flickers ? [0, 0.2, 0.35, 0.5, 0.7, 1] : undefined,
                    }}
                    className="inline-block"
                  >
                    {character}
                  </motion.span>
                );
              })}
            </span>
          </Fragment>
        ))}
      </span>

      {underline ? (
        <motion.span
          aria-hidden="true"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={visible ? { scaleX: 1, opacity: 1 } : undefined}
          transition={{ duration: 1.4, delay: delay + totalCharacters * stagger, ease: "easeOut" }}
          className="mt-4 block h-px w-full origin-left bg-gradient-to-r from-crimson via-crimson/40 to-transparent"
        />
      ) : null}
    </Tag>
  );
}

/**
 * Строка-«шёпот»: появляется раньше основного текста и гаснет,
 * как будто её прошептали в темноте.
 */
export function WhisperLine({
  text,
  delay = 0,
  className,
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useRevealed<HTMLParagraphElement>();
  const reduced = useReducedMotion();

  return (
    <p
      ref={ref}
      className={cn("font-mono text-[10px] uppercase tracking-[0.34em] text-crimson", className)}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={visible && !reduced ? { opacity: [0, 1, 0.35, 1, 0] } : { opacity: 1 }}
        transition={{ duration: 3.4, delay, times: [0, 0.15, 0.4, 0.6, 1] }}
        className="inline-block"
      >
        {text}
      </motion.span>
    </p>
  );
}
