-- ═══════════════════════════════════════════════════════════════════════════
--  Quest Horror Clinic — схема базы данных
--
--  Правила, которые заложены в структуру (а не только в код приложения):
--   1. одна и та же бронь не может появиться дважды — уникальный индекс
--      по квесту, дате, времени и телефону;
--   2. повторная отправка формы не создаёт дубль — уникальный индекс
--      по ключу идемпотентности;
--   3. цена и число игроков хранятся как есть (снимок на момент брони):
--      если прайс изменится, старые брони не «поедут»;
--   4. история статусов пишется отдельной таблицей — видно, кто и когда
--      подтвердил или отменил бронь;
--   5. платежи связаны с бронью и идемпотентны по внешнему идентификатору.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bookings (
  id                  TEXT PRIMARY KEY,                 -- внутренний id
  public_id           TEXT NOT NULL UNIQUE,             -- номер для клиента (HC-XXXX)
  quest_slug          TEXT NOT NULL,
  quest_title         TEXT NOT NULL,                    -- снимок названия на момент брони
  location_id         TEXT NOT NULL,
  date_iso            DATE NOT NULL,
  start_time          TIME NOT NULL,
  players             INTEGER NOT NULL CHECK (players > 0),
  fear_mode           TEXT NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT NOT NULL,
  messenger           TEXT NOT NULL,
  comment             TEXT NOT NULL DEFAULT '',
  extras              TEXT[] NOT NULL DEFAULT '{}',
  is_birthday         BOOLEAN NOT NULL DEFAULT FALSE,
  total_price         INTEGER NOT NULL CHECK (total_price >= 0),
  prepayment_amount   INTEGER NOT NULL DEFAULT 0 CHECK (prepayment_amount >= 0),
  status              TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'confirmed', 'completed', 'cancelled', 'expired')),
  status_history      JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment             JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Защита от дублей и ускорение выборок ───────────────────────────────────

-- Один и тот же слот + тот же телефон = одна бронь (двойной submit из формы)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_phone_unique
  ON bookings (quest_slug, date_iso, start_time, customer_phone)
  WHERE status <> 'cancelled';

-- Повторная отправка с тем же ключом идемпотентности не создаёт вторую бронь
CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency_unique
  ON bookings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Основные запросы: занять места в слоте, показать день, показать список
CREATE INDEX IF NOT EXISTS bookings_slot_idx
  ON bookings (quest_slug, date_iso, start_time)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS bookings_date_idx
  ON bookings (date_iso DESC, start_time);

CREATE INDEX IF NOT EXISTS bookings_status_idx
  ON bookings (status, date_iso);

-- ── Платежи ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY,
  booking_public_id   TEXT NOT NULL REFERENCES bookings (public_id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,
  provider_payment_id TEXT,                             -- id платежа на стороне провайдера
  status              TEXT NOT NULL
                        CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired')),
  amount              INTEGER NOT NULL DEFAULT 0,
  raw_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Вебхук может прийти дважды: второй раз не должен ничего менять
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_unique
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments (booking_public_id);

-- ── Уведомления (в том числе напоминания клиенту) ──────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  booking_public_id TEXT REFERENCES bookings (public_id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                          -- booking_created | reminder_24h | reminder_2h
  channel       TEXT NOT NULL,                          -- telegram | webhook | email
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Напоминание для конкретной брони отправляется один раз
CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_kind
  ON notifications (booking_public_id, kind, channel);
