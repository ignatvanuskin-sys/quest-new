"use client";

import { useRef, type TouchEvent } from "react";

/**
 * Горизонтальный свайп для тач-устройств.
 *
 * Зачем отдельный хук: на телефоне листать календарь и кадры стрелками
 * неудобно — жест должен работать там, где пользователь его ожидает.
 * Вертикальный скролл при этом не перехватывается: свайп считается только
 * если движение по горизонтали заметно больше, чем по вертикали.
 */
export function useSwipe(onSwipe: (direction: 1 | -1) => void, threshold = 45) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      start.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (event: TouchEvent) => {
      const origin = start.current;
      start.current = null;
      if (!origin) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;

      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
  };
}
