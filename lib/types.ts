// ─────────────────────────────────────────────────────────────────────────────
// Типы данных проекта.
// Всё, что описывает бизнес и квесты, живёт в `lib/content.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export type FearModeId = "no-actors" | "light" | "medium" | "hard";

export interface FearMode {
  id: FearModeId;
  /** Название режима — так, как его называют игрокам */
  name: string;
  /** Короткое пояснение для карточки режима */
  note: string;
  /** Контакт с актёрами (для понятной маркировки в UI) */
  contact: "нет" | "без контакта" | "средний контакт" | "полный контакт";
  /** Минимальный возраст, с которого доступен режим */
  minAge: number;
}

export interface QuestLocation {
  id: string;
  label: string;
  address: string;
  city: string;
  /** Ориентир / как найти вход */
  entrance: string;
  parking: string;
  mapUrl: string;
  /** Geo для карты и structured data */
  lat: number;
  lng: number;
}

export interface QuestSpec {
  playersMin: number;
  playersMax: number;
  /** Длительность игры в минутах */
  duration: number;
  ageMin: number;
  /** Площадь локации, м² — реальная цифра заведения */
  areaM2?: number;
  genre: string;
}

export interface Quest {
  id: string;
  slug: string;
  title: string;
  /** Короткий слоган-крючок для карточки */
  hook: string;
  /** Одна строка для сетки каталога */
  tagline: string;
  genre: string;
  spec: QuestSpec;
  locationId: string;
  /** Уровень страха 1–10 (редакторская оценка, правится в одном месте) */
  fear: number;
  /** Сложность 1–10 (редакторская оценка) */
  difficulty: number;
  /** Минимальная цена за игру, ₸ */
  priceFrom: number;
  /** Сюжет короткими фрагментами — используются как scroll-storytelling */
  story: string[];
  /** Задача команды внутри локации */
  mission: string;
  /** Реальные особенности локации (из публичных данных заведения) */
  features: string[];
  /** Доступные режимы страха */
  fearModes: FearModeId[];
  image: string;
  imageAlt: string;
  /** Кто подтверждает контент: real — с официального сайта, editorial — черновик */
  contentStatus: "real" | "editorial";
}

export interface Extra {
  id: string;
  name: string;
  description: string;
  /** fixed — фиксированная сумма, perPerson — за человека, request — по запросу, free — бесплатно */
  priceType: "fixed" | "perPerson" | "request" | "free";
  amount?: number;
  /** Группировка в блоке upsell */
  group: "scarier" | "team" | "corporate";
  icon: string;
  /** Условие доступности (например, только для команд 5+) */
  availableWhen?: "always" | "playersOver4" | "playersOver5";
}

export interface BookingSelection {
  questSlug: string;
  players: number;
  fearMode: FearModeId;
  dateISO: string;
  time: string;
  extraIds: string[];
  isBirthday: boolean;
  name: string;
  phone: string;
  messenger: "whatsapp" | "telegram" | "call";
  comment: string;
}

/**
 * Статусы брони. Соответствуют машине состояний в lib/domain/booking-status.ts:
 * new — ожидает подтверждения, expired — не подтвердили вовремя.
 */
export type BookingStatus = "new" | "confirmed" | "completed" | "cancelled" | "expired";

export interface BookingStatusHistoryEntry {
  status: BookingStatus;
  at: string;
  /** Кто изменил: admin, customer, system (истечение), payment-webhook */
  by: string;
  /** Пояснение к переходу — например, причина автоматического истечения */
  note?: string;
}

export interface BookingRecord extends BookingSelection {
  id: string;
  /** Рассчитанная стоимость на момент брони, ₸ */
  total: number;
  extraNames: string[];
  priceBreakdown: PriceLine[];
  status: BookingStatus;
  createdAt: string;
  /** История переходов — чтобы администратор видел, что и когда произошло */
  statusHistory?: BookingStatusHistoryEntry[];
  /** Связь с оплатой: кто и когда подтвердил предоплату */
  payment?: {
    provider: string;
    status: "not_required" | "pending" | "paid" | "failed" | "cancelled";
    amount?: number;
    reference?: string;
    updatedAt?: string;
  };
  /** Ключ идемпотентности, с которым создана бронь (защита от двойного submit) */
  idempotencyKey?: string;
  /**
   * Результат выгрузки во внешнюю систему учёта.
   * Заполняется, только если внешний CRM настроен: администратор должен
   * видеть, что бронь не попала в чужую систему, а не узнавать об этом
   * от клиента. При локальном учёте остаётся пустым.
   */
  crmSync?: {
    status: "synced" | "failed" | "skipped";
    provider: string;
    at: string;
    reason?: string;
  };
  /** Метки отправленных напоминаний: «24h», «2h». Защита от повторной отправки */
  remindersSent?: string[];
}

/**
 * Минимум данных для экрана успеха и восстановления подтверждения.
 *
 * Зачем отдельный тип: после брони человеку нужно вернуться к номеру брони
 * (например, он обновил страницу). Хранить для этого полную запись с именем
 * и телефоном на устройстве незачем — экрану успеха персональные данные
 * не нужны вообще. Так на клиенте не остаётся лишних личных данных.
 */
export type BookingConfirmation = Pick<
  BookingRecord,
  "id" | "questSlug" | "dateISO" | "time" | "players" | "fearMode" | "total" | "extraNames"
>;

export interface PriceLine {
  label: string;
  amount: number;
  /** Пояснение к строке (например, тариф 5+ человек) */
  note?: string;
}

export interface PriceResult {
  lines: PriceLine[];
  total: number;
  /** Варианты, которые нельзя посчитать автоматически */
  requests: string[];
}

export interface TimeSlot {
  time: string;
  status: "available" | "sold-out" | "few-left" | "past";
  /** Сколько мест ещё свободно в слоте */
  seatsLeft: number;
  /** Всего мест в слоте */
  capacity: number;
  /** Почему слот недоступен — показывается игроку, чтобы не было «мёртвых» кликов */
  reason?: string;
}

export interface DayAvailability {
  dateISO: string;
  slots: TimeSlot[];
  /** Все места заняты */
  full: boolean;
}

export interface Review {
  id: string;
  author: string;
  quest: string;
  date: string;
  rating: number;
  text: string;
  /** Откуда отзыв — для прозрачности */
  source: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}
