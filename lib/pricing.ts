import { EXTRAS, getExtra, getQuest } from "./content";
import type { PriceLine, PriceResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Расчёт стоимости — по реальному прайсу заведения:
//    • 3–4 человека  → 15 000 ₸ за игру
//    • от 5 человек  → 3 500 ₸ с человека
//    • именинник     → бесплатно (при команде от 6 человек)
//  Никаких «сервисных сборов»: итог в форме = сумма к оплате.
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_GAME_PRICE = 15_000;
/** Порог, с которого действует тариф «за человека» */
export const PER_PERSON_FROM = 5;
export const PER_PERSON_PRICE = 3_500;
/** Условие акции для именинника */
export const BIRTHDAY_MIN_PLAYERS = 6;

export interface PriceInput {
  questSlug: string;
  players: number;
  extraIds: string[];
  isBirthday: boolean;
}

export function computePrice({ questSlug, players, extraIds, isBirthday }: PriceInput): PriceResult {
  const quest = getQuest(questSlug);
  const lines: PriceLine[] = [];
  const requests: string[] = [];

  const safePlayers = Math.max(1, Math.floor(players) || 1);

  if (!quest) {
    return { lines, total: 0, requests };
  }

  // ── Базовая стоимость игры ────────────────────────────────────────────────
  if (safePlayers < PER_PERSON_FROM) {
    lines.push({
      label: `Игра «${quest.title}»`,
      amount: MIN_GAME_PRICE,
      note: "тариф 3–4 человека — за игру целиком",
    });
    if (safePlayers <= 2) {
      requests.push(
        "Для команды из 2 человек стоимость подтвердит администратор: тариф за игру рассчитан на 3–4 участника.",
      );
    }
  } else {
    const amount = safePlayers * PER_PERSON_PRICE;
    lines.push({
      label: `Игра «${quest.title}»`,
      amount,
      note: `${safePlayers} × 3 500 ₸ — тариф от 5 человек`,
    });
  }

  // ── Бесплатные опции: показываем в чеке, чтобы не было вопросов ──────────
  for (const id of extraIds) {
    const extra = getExtra(id);
    if (!extra) continue;
    if (extra.priceType === "free") {
      lines.push({ label: extra.name, amount: 0, note: "включено бесплатно" });
    }
    if (extra.priceType === "request") {
      requests.push(`${extra.name} — стоимость и доступность подтвердит администратор.`);
    }
  }

  // ── Акция для именинника ────────────────────────────────────────────────
  if (isBirthday) {
    if (safePlayers >= BIRTHDAY_MIN_PLAYERS) {
      lines.push({
        label: "Именинник — бесплатно",
        amount: -PER_PERSON_PRICE,
        note: "акция площадки: доля одного игрока не оплачивается",
      });
    } else {
      requests.push(
        `Акция «имениннику — бесплатно» действует при команде от ${BIRTHDAY_MIN_PLAYERS} человек. Сейчас в заявке ${safePlayers} — допишите участников или обсудите с администратором.`,
      );
    }
  }

  const total = Math.max(0, lines.reduce((sum, line) => sum + line.amount, 0));

  return { lines, total, requests };
}

/** Свободна ли опция для текущей конфигурации команды */
export function isExtraAvailable(extraId: string, players: number): boolean {
  const extra = EXTRAS.find((e) => e.id === extraId);
  if (!extra) return false;
  if (extra.availableWhen === "playersOver4") return players >= 5;
  if (extra.availableWhen === "playersOver5") return players >= 6;
  return true;
}
