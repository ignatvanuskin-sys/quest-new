"use client";

import { useEffect, useState } from "react";

/**
 * Подписка на media query.
 *
 * Нужна, чтобы вовсе не включать «тяжёлые» эффекты на телефонах:
 * параллакс hero и часть анимаций на мобильных только мешают скроллу,
 * хотя на десктопе добавляют глубину.
 *
 * Возвращает false до первого эффекта — на сервере и при первом рендере
 * мы не знаем ширину экрана, поэтому «по умолчанию лёгкий режим»:
 * лучше показать простую версию и включить эффект, чем наоборот.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Точный указатель (мышь/трекпад) — там, где уместны hover-эффекты и параллакс */
export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");

/** Широкий экран: с него включаем тяжёлые визуальные слои */
export const useDesktop = () => useMediaQuery("(min-width: 1024px)");
