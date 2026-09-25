"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Общая логика «блок уже пора показать».
 *
 * Возвращает ref и флаг. Помимо IntersectionObserver здесь есть фолбэк:
 * на каждом кадре скролла проверяется `rect.top < innerHeight`. Без этого
 * элементы, мимо которых пользователь «проскочил» (переход по якорю,
 * мгновенный scrollTo в конец страницы), оставались невидимыми навсегда —
 * IO в таком случае не срабатывает вообще.
 *
 * Именно на этом ломались анимации текста и липкие блоки, поэтому логика
 * вынесена в одно место и переиспользуется и в Reveal, и в анимации букв.
 */
export function useRevealed<T extends HTMLElement>(once = true) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    let frame = 0;

    const show = () => {
      setVisible(true);
      if (once) {
        observer.disconnect();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    };

    const check = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < viewport - 40) show();
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(check);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) show();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    observer.observe(element);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    check();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [once]);

  return { ref, visible };
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: 0 | 1 | 2 | 3 | 4;
  as?: ElementType;
  /** Скроется ли блок, если он изначально вне экрана (по умолчанию да) */
  once?: boolean;
}

/**
 * Появление блока при скролле.
 *
 * Важный нюанс: IntersectionObserver НЕ срабатывает, если элемент «проскочил»
 * мимо экрана (например, при переходе по якорю из хедера) — он не пересекал
 * вьюпорт. Поэтому дополнительно на каждом кадре скролла проверяем
 * `rect.top < innerHeight`: если блок уже выше нижней границы экрана — показываем.
 */
export function Reveal({ children, className, delay = 0, as: Tag = "div", once = true }: RevealProps) {
  const { ref, visible } = useRevealed<HTMLElement>(once);

  return (
    <Tag
      ref={ref as never}
      className={cn("reveal", visible && "is-visible", delay > 0 && `reveal-delay-${delay}`, className)}
    >
      {children}
    </Tag>
  );
}
