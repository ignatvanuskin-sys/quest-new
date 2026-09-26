import { minutesUntilSlot } from "../time";
import type { BookingStatus } from "../types";

/**
 * МАШИНА СОСТОЯНИЙ БРОНИ
 *
 * Бронь не может «прыгать» между любыми статусами: из отменённой нельзя
 * вернуться в подтверждённую, проведённую игру нельзя отменить задним числом,
 * а новая бронь не может стать «проведённой» до того, как её подтвердили.
 *
 * Раньше админка позволяла поставить любой статус в любой момент — это
 * опаснее, чем кажется: случайный клик по «Проведена» ломает отчётность
 * и делает отмену невозможной. Теперь переходы проверяются в одном месте,
 * и то же правило действует на сервере.
 *
 * Статусы соответствуют полям в хранилище, поэтому старые данные читаются
 * без миграции: new — «ожидает подтверждения», остальные как раньше.
 */

/** Допустимые переходы. Ключ — текущий статус, значение — куда можно перейти. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  // new = PENDING: ждём подтверждения администратора (и предоплату)
  new: ["confirmed", "cancelled", "expired"],
  confirmed: ["completed", "cancelled"],
  // проведённую игру не отменяем: деньги уже отработаны
  completed: [],
  // отменённую не возвращаем в работу — при необходимости создаётся новая бронь
  cancelled: [],
  // expired = бронь не подтвердили вовремя (например, не пришла предоплата)
  expired: ["cancelled"],
};

export const MANUAL_STATUSES: readonly BookingStatus[] = ["new", "confirmed", "completed", "cancelled"];

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true; // повторная установка того же статуса безопасна
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Недопустимый переход статуса: ${from} → ${to}`);
  }
}

export function allowedTransitions(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Бронь не подтвердили, а время игры уже прошло.
 *
 * Это самый опасный для бизнеса случай: слот прошёл, клиента не было,
 * а в списке бронь всё ещё выглядит «новой». Администратор должен видеть
 * такие строки отдельно, а планировщик — переводить их в «истекла»
 * (см. lib/services/reminders.ts).
 */
export function isStaleUnconfirmed(
  record: { status: BookingStatus; dateISO: string; time: string },
  now: Date = new Date(),
): boolean {
  if (record.status !== "new") return false;
  return minutesUntilSlot(record.dateISO, record.time, now) < 0;
}

/** Что показывать администратору как «следующий разумный шаг» */
export function nextStatusHint(status: BookingStatus): string {
  switch (status) {
    case "new":
      return "Подтвердить после предоплаты или отменить";
    case "confirmed":
      return "Отметить проведённой после игры";
    case "completed":
      return "Игра проведена";
    case "cancelled":
      return "Отменена клиентом или площадкой";
    case "expired":
      return "Не подтверждена вовремя";
  }
}
