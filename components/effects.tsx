"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { MotionValue } from "framer-motion";

/* ───────────────────────────────────────────────────────────────────────────
   Динамические эффекты страха.

   Правила, по которым они живут:
   • ни один эффект не перекрывает элементы управления (pointer-events: none);
   • при prefers-reduced-motion выключаются полностью;
   • jump scare срабатывает редко (не чаще раза в 6 секунд) и не на тач-устройствах,
     иначе это не страх, а раздражение;
   • эффекты не блокируют CTA: бронь всегда доступна.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Прогрессивная темнота: чем глубже пользователь уходит по странице,
 * тем сильнее сжимается свет вокруг центра экрана.
 * Освещённость падает равномерно, поэтому контраст текста сохраняется.
 */
export function ProgressiveDarkness() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothed = useSpring(scrollYProgress, { stiffness: 60, damping: 24, restDelta: 0.002 });
  // Максимум 0.62 — при такой величине затемняются только края кадра,
  // а контраст текста в центре остаётся нетронутым (см. .fx-pressure в globals.css)
  const value: MotionValue<number> = useTransform(smoothed, [0, 0.3, 1], [0, 0.34, 0.62]);

  if (reduced) return null;

  return <motion.div aria-hidden="true" className="fx-pressure" style={{ opacity: value }} />;
}

/**
 * Jump scare: пара глаз в темноте на 240 мс + рывок кадра.
 *
 * Запускается наведением на элементы с атрибутом data-scare (карточки квестов,
 * кадры галереи, портреты актёров). Троттлинг — 6 секунд, только точный указатель.
 * Если звук включён пользователем, SoundToggle добавляет глухой удар.
 */
export function JumpScareLayer() {
  const [active, setActive] = useState(false);
  const lastRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduced || !finePointer) return;

    const trigger = () => {
      const now = Date.now();
      if (now - lastRef.current < 6000) return;
      lastRef.current = now;
      setActive(true);
      window.dispatchEvent(new CustomEvent("hc:scare"));
      timerRef.current = window.setTimeout(() => setActive(false), 260);
    };

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-scare]")) trigger();
    };

    window.addEventListener("pointerover", onPointerOver, { passive: true });
    return () => {
      window.removeEventListener("pointerover", onPointerOver);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="scare-flash scare-shake"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/eyes-flash.jpg"
            alt=""
            width={1200}
            height={800}
            className="h-full w-full object-cover opacity-90"
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
