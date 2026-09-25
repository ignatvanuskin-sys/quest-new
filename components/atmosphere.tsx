"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/* ───────────────────────────────────────────────────────────────────────────
   Атмосферный слой: зерно, виньетка, свет от курсора, кастомный прицел.
   Всё — только desktop-friendly и с уважением к prefers-reduced-motion.
   ─────────────────────────────────────────────────────────────────────────── */

export function Atmosphere() {
  const lightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinePointer || reduced) return;

    let frame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.4;
    let currentX = targetX;
    let currentY = targetY;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const tick = () => {
      // лёгкая инерция: свет «догоняет» курсор, а не липнет к нему
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      const node = lightRef.current;
      if (node) {
        node.style.setProperty("--mx", `${currentX}px`);
        node.style.setProperty("--my", `${currentY}px`);
      }
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={lightRef} className="cursor-light" aria-hidden="true" />
      <div className="fx-grain" aria-hidden="true" />
      <div className="fx-vignette" aria-hidden="true" />
    </>
  );
}

/**
 * Кастомный прицел-«точка» с подписью действия.
 * Мы НЕ прячем системный курсор: в хоррор-интерфейсе важнее, чтобы человек
 * всегда понимал, где находится указатель. Подпись берётся из data-cursor.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinePointer || reduced) return;
    setEnabled(true);

    let frame = 0;
    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;

    let labelTick = 0;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      updateLabel(event.target);
    };

    const updateLabel = (target: EventTarget | null) => {
      // Целью pointer-события может быть не элемент (document, текстовая нода),
      // поэтому сначала проверяем тип — иначе closest() падает с TypeError.
      const interactive =
        target instanceof Element ? target.closest<HTMLElement>("[data-cursor]") : null;
      const next = interactive?.dataset.cursor ?? null;
      setLabel((current) => (current === next ? current : next));
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.22;
      currentY += (targetY - currentY) * 0.22;
      const node = dotRef.current;
      if (node) node.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

      // Раз в ~20 кадров проверяем, что под курсором всё ещё тот же элемент.
      // Иначе подпись «залипает»: например, после закрытия интро кнопка SKIP
      // исчезает, а подпись [ SKIP ] остаётся висеть на экране.
      labelTick += 1;
      if (labelTick % 20 === 0 && targetX > 0) {
        updateLabel(document.elementFromPoint(targetX, targetY));
      }

      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[70] hidden md:block"
      style={{ transform: "translate3d(-100px, -100px, 0)" }}
    >
      <span className="absolute -left-[3px] -top-[3px] block h-1.5 w-1.5 rounded-full bg-crimson/90 shadow-[0_0_12px_rgba(176,18,27,0.9)]" />
      {label ? (
        <span className="absolute left-4 top-1 whitespace-nowrap border border-crimson/50 bg-ink/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-bone">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/** Тонкая кровавая линия прогресса чтения — держит ощущение «мы идём внутрь» */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX: width }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[65] h-[2px] origin-left bg-gradient-to-r from-blood-deep via-crimson to-bone/70"
    />
  );
}

/** Короткое «моргание света» при переходе между страницами */
export function RouteFlicker() {
  const pathname = usePathname();
  const [flicker, setFlicker] = useState(false);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    setFlicker(true);
    const timer = window.setTimeout(() => setFlicker(false), 260);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <AnimatePresence>
      {flicker ? (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: [0.85, 0.12, 0.7, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, times: [0, 0.3, 0.55, 1] }}
          className="pointer-events-none fixed inset-0 z-[75] bg-ink"
        />
      ) : null}
    </AnimatePresence>
  );
}
