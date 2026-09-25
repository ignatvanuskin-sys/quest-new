"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Lock, MessageCircle, Phone } from "lucide-react";
import { BUSINESS, FEAR_MODES, QUESTS, getQuest } from "@/lib/content";
import type { MonthDaySummary } from "@/lib/availability";
import { computePrice } from "@/lib/pricing";
import type { BookingRecord, DayAvailability, FearModeId } from "@/lib/types";
import { formatHumanDate, fromISODate, todayISO } from "@/lib/utils";
import { Calendar } from "@/components/booking/calendar";
import { TimeSlots } from "@/components/booking/time-slots";
import { Extras } from "@/components/booking/extras";
import { BookingSummary } from "@/components/booking/summary";
import { BookingSuccess } from "@/components/booking/success";

type Step = 1 | 2 | 3;

const STEPS: Array<{ id: Step; label: string; hint: string }> = [
  { id: 1, label: "Квест", hint: "Что играем и сколько вас" },
  { id: 2, label: "Дата и время", hint: "Свободные слоты в реальном времени" },
  { id: 3, label: "Контакты", hint: "Куда написать для подтверждения" },
];

/**
 * Бронирование в три шага.
 *
 * Логика шагов: квест + команда → дата, время и апселл → контакт и подтверждение.
 * Все шесть смысловых этапов брифа (квест, игроки, дата, время, контакт, доп.
 * услуги) сохранены, но сгруппированы так, чтобы форма проходилась одной рукой
 * с телефона: дата и время — на одном экране, доп. услуги — там же, где выбор
 * времени, а не отдельным шагом после контактов.
 */
export function BookingFlow({
  initialQuestSlug,
  initialFearMode,
}: {
  initialQuestSlug?: string;
  /** Уровень страха, выбранный в «испытании страха» на главной (?fear=...) */
  initialFearMode?: FearModeId;
}) {
  const firstQuest = useMemo(() => {
    const requested = initialQuestSlug ? getQuest(initialQuestSlug) : undefined;
    return requested ?? QUESTS[0];
  }, [initialQuestSlug]);

  const resolveFearMode = (quest: (typeof QUESTS)[number]): FearModeId => {
    if (initialFearMode && quest.fearModes.includes(initialFearMode)) return initialFearMode;
    return quest.fearModes.includes("light") ? "light" : quest.fearModes[0];
  };

  const [step, setStep] = useState<Step>(1);
  const [questSlug, setQuestSlug] = useState(firstQuest.slug);
  const quest = getQuest(questSlug) ?? firstQuest;

  const [players, setPlayers] = useState(firstQuest.spec.playersMin);
  const [fearMode, setFearMode] = useState<FearModeId>(() => resolveFearMode(firstQuest));
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [isBirthday, setIsBirthday] = useState(false);

  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [messenger, setMessenger] = useState<"whatsapp" | "telegram" | "call">("whatsapp");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [glitch, setGlitch] = useState(false);

  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const base = fromISODate(today);
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [summary, setSummary] = useState<Record<string, MonthDaySummary>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);

  const topRef = useRef<HTMLDivElement | null>(null);

  const price = computePrice({ questSlug, players, extraIds, isBirthday });

  /* ── Занятость: месяц ─────────────────────────────────────────────────── */
  useEffect(() => {
    const controller = new AbortController();
    const monthKey = `${cursor.year}-${`${cursor.month + 1}`.padStart(2, "0")}`;
    setLoadingMonth(true);

    fetch(`/api/availability?quest=${questSlug}&month=${monthKey}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data: { summary: Record<string, MonthDaySummary> }) => setSummary(data.summary ?? {}))
      .catch((error: unknown) => {
        if ((error as Error)?.name === "AbortError") return;
        setSummary({});
      })
      .finally(() => setLoadingMonth(false));

    return () => controller.abort();
  }, [cursor, questSlug]);

  /* ── Занятость: выбранный день ────────────────────────────────────────── */
  useEffect(() => {
    if (!dateISO) {
      setAvailability(null);
      return;
    }
    const controller = new AbortController();
    setLoadingDay(true);

    fetch(`/api/availability?quest=${questSlug}&date=${dateISO}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data: { availability: DayAvailability }) => setAvailability(data.availability ?? null))
      .catch((error: unknown) => {
        if ((error as Error)?.name === "AbortError") return;
        setAvailability(null);
      })
      .finally(() => setLoadingDay(false));

    return () => controller.abort();
  }, [dateISO, questSlug]);

  /* ── Сброс несовместимых опций при смене квеста ───────────────────────── */
  useEffect(() => {
    if (!quest.fearModes.includes(fearMode)) {
      setFearMode(quest.fearModes.includes("light") ? "light" : quest.fearModes[0]);
    }
    setPlayers((current) =>
      Math.min(Math.max(current, quest.spec.playersMin), quest.spec.playersMax),
    );
    setExtraIds((current) => current.filter((id) => id !== "full-contact" || quest.fearModes.includes("hard")));
  }, [quest, fearMode]);

  const flashGlitch = useCallback(() => {
    setGlitch(true);
    window.setTimeout(() => setGlitch(false), 700);
  }, []);

  const goToStep = (next: Step) => {
    setStep(next);
    setFailure(null);
    if (next === 3 || next === 2) {
      window.requestAnimationFrame(() => {
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const validateStep = (target: Step): boolean => {
    const nextErrors: Record<string, string> = {};

    if (target >= 2) {
      if (players < quest.spec.playersMin || players > quest.spec.playersMax) {
        nextErrors.players = `Для «${quest.title}» — от ${quest.spec.playersMin} до ${quest.spec.playersMax} игроков.`;
      }
    }

    if (target >= 3) {
      if (!dateISO) nextErrors.dateISO = "Выберите дату игры.";
      if (!time) nextErrors.time = "Выберите время старта.";
      if (isBirthday && players < 6) {
        nextErrors.isBirthday =
          "Акция «имениннику — бесплатно» действует при команде от 6 человек. Добавьте участников или снимите галочку.";
      }
      if (dateISO && time) {
        const slot = availability?.slots.find((item) => item.time === time);
        if (slot && slot.status !== "past" && slot.seatsLeft < players) {
          nextErrors.time = "В этом слоте уже недостаточно мест для вашей команды. Выберите другое время.";
        }
      }
    }

    setErrors((current) => ({ ...current, ...nextErrors, ...(Object.keys(nextErrors).length ? {} : {}) }));
    if (Object.keys(nextErrors).length > 0) {
      flashGlitch();
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep((step + 1) as Step)) return;
    goToStep((step + 1) as Step);
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = "Напишите, как к вам обращаться.";
    if (phone.replace(/\D/g, "").length !== 11) {
      nextErrors.phone = "Телефон в формате +7 777 000 00 00 — по нему администратор подтвердит бронь.";
    }
    if (!consent) nextErrors.consent = "Нужно согласие на обработку данных для оформления брони.";
    if (!dateISO) nextErrors.dateISO = "Выберите дату игры.";
    if (!time) nextErrors.time = "Выберите время старта.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      flashGlitch();
      return;
    }

    setErrors({});
    setFailure(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questSlug,
          players,
          fearMode,
          dateISO,
          time,
          extraIds,
          isBirthday,
          name: name.trim(),
          phone,
          messenger,
          comment: comment.trim(),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        booking?: BookingRecord;
        duplicate?: boolean;
        errors?: Record<string, string>;
        message?: string;
      };

      if (!response.ok || !data.ok || !data.booking) {
        if (data.errors) {
          setErrors(data.errors);
          // возвращаем человека к шагу с ошибкой, а не оставляем в тупике
          if (data.errors.players) goToStep(1);
          else if (data.errors.dateISO || data.errors.time) goToStep(2);
        }
        setFailure(data.message ?? "Не удалось сохранить бронь. Проверьте данные и попробуйте ещё раз.");
        flashGlitch();
        return;
      }

      setBooking(data.booking);
      window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setFailure(
        "Связь с сервером пропала. Данные не потеряны — проверьте соединение и нажмите «Подтвердить бронь» ещё раз, либо напишите нам в WhatsApp.",
      );
      flashGlitch();
    } finally {
      setSubmitting(false);
    }
  };

  const selectQuest = (slug: string) => {
    setQuestSlug(slug);
    setDateISO(null);
    setTime(null);
    setAvailability(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/booking?quest=${slug}`);
    }
  };

  const jumpToDay = (offset: number) => {
    const base = fromISODate(today);
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
    const iso = `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, "0")}-${`${next.getDate()}`.padStart(2, "0")}`;
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
    setDateISO(iso);
    setTime(null);
  };

  const suggestNextDay = () => {
    let offset = 1;
    if (dateISO) {
      const current = fromISODate(dateISO);
      const base = fromISODate(today);
      offset = Math.round((current.getTime() - base.getTime()) / 86_400_000) + 1;
    }
    jumpToDay(Math.max(1, offset));
  };

  if (booking) {
    return (
      <div ref={topRef} className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <BookingSuccess booking={booking} />
      </div>
    );
  }

  return (
    <div ref={topRef} className="mx-auto max-w-[1400px] scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
      {/* Прогресс */}
      <ol className="flex flex-col gap-3 border-b border-bone/10 pb-6 sm:flex-row sm:items-center sm:gap-6">
        {STEPS.map((item) => {
          const active = step === item.id;
          const done = step > item.id;
          return (
            <li key={item.id} className="flex flex-1 items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center border font-display text-sm ${
                  active
                    ? "border-crimson bg-blood-deep/60 text-bone"
                    : done
                      ? "border-bone/30 text-bone-dim"
                      : "border-bone/12 text-dust"
                }`}
              >
                {done ? "✓" : item.id}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-display text-sm uppercase tracking-[0.12em] ${
                    active ? "text-bone" : "text-bone-dim"
                  }`}
                >
                  {item.label}
                </span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
                  {item.hint}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div>
          {failure ? (
            <div
              role="alert"
              className="mb-6 flex gap-3 border border-crimson/50 bg-blood-deep/25 p-4 text-sm text-bone"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              <span>{failure}</span>
            </div>
          ) : null}

          {/* ── ШАГ 1 ───────────────────────────────────────────────────── */}
          {step === 1 ? (
            <section aria-labelledby="step-quest">
              <h1
                id="step-quest"
                className="font-display text-[clamp(1.7rem,7vw,3rem)] uppercase leading-none tracking-tight text-bone"
              >
                Что играем
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
                Выберите квест и количество игроков. Стоимость пересчитается сразу: 3–4 человека — 15 000 ₸ за
                игру, от 5 человек — 3 500 ₸ с человека.
              </p>

              <ul className="mt-6 space-y-3">
                {QUESTS.map((item) => {
                  const active = item.slug === questSlug;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectQuest(item.slug)}
                        data-cursor="[ ВЫБРАТЬ ]"
                        className={`flex w-full items-start justify-between gap-4 border p-4 text-left transition ${
                          active ? "border-crimson bg-blood-deep/25" : "border-bone/12 hover:border-crimson/50"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block font-display text-lg uppercase tracking-[0.04em] text-bone">
                            {item.title}
                          </span>
                          <span className="mt-1.5 block text-sm leading-relaxed text-bone-dim">
                            {item.tagline}
                          </span>
                          <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
                            {item.spec.playersMin}–{item.spec.playersMax} чел · {item.spec.duration} мин ·{" "}
                            {item.spec.ageMin}+ · страх {item.fear}/10
                          </span>
                        </span>
                        {active ? (
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-crimson">
                            выбрано
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8">
                <h2 className="font-display text-xl uppercase tracking-[0.08em] text-bone">
                  Уровень страха
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-bone-dim">
                  Его выбирает команда. Если сомневаетесь — берите «Лайт»: актёры работают рядом, но не
                  касаются.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {FEAR_MODES.map((mode) => {
                    const available = quest.fearModes.includes(mode.id) && mode.minAge <= 18;
                    const active = fearMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        disabled={!available}
                        aria-pressed={active}
                        onClick={() => setFearMode(mode.id)}
                        className={`border p-4 text-left transition ${
                          active ? "border-crimson bg-blood-deep/30" : "border-bone/12 hover:border-crimson/50"
                        } ${!available ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <span className="font-display text-base uppercase tracking-[0.06em] text-bone">
                          {mode.name}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-crimson">
                          {mode.contact} · с {mode.minAge} лет
                        </span>
                        <span className="mt-2 block text-xs leading-relaxed text-bone-dim">{mode.note}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.players ? (
                  <p role="alert" className="mt-3 font-mono text-[11px] text-crimson">
                    {errors.players}
                  </p>
                ) : null}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleNext}
                  data-cursor="[ ДАЛЬШЕ ]"
                  className="btn-blood flex items-center justify-center gap-3 px-7 py-4 font-display text-base uppercase tracking-[0.16em]"
                >
                  Выбрать дату и время
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </section>
          ) : null}

          {/* ── ШАГ 2 ───────────────────────────────────────────────────── */}
          {step === 2 ? (
            <section aria-labelledby="step-when">
              <h1
                id="step-when"
                className="font-display text-[clamp(1.7rem,7vw,3rem)] uppercase leading-none tracking-tight text-bone"
              >
                Когда заходим
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
                Занятость показана по подтверждённым броням. Выберите дату, затем время — и сразу отметьте
                опции вроде полного контакта.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => jumpToDay(0)}
                  className="inline-flex min-h-[44px] items-center border border-bone/15 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone-dim transition hover:border-crimson/60 hover:text-bone"
                >
                  Сегодня
                </button>
                <button
                  type="button"
                  onClick={() => jumpToDay(1)}
                  className="inline-flex min-h-[44px] items-center border border-bone/15 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone-dim transition hover:border-crimson/60 hover:text-bone"
                >
                  Завтра
                </button>
                <button
                  type="button"
                  onClick={() => jumpToDay(2)}
                  className="inline-flex min-h-[44px] items-center border border-bone/15 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone-dim transition hover:border-crimson/60 hover:text-bone"
                >
                  Через 2 дня
                </button>
                {dateISO ? (
                  <span className="flex items-center border border-crimson/40 bg-blood-deep/25 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone">
                    {formatHumanDate(dateISO)}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 space-y-5">
                <Calendar
                  year={cursor.year}
                  month={cursor.month}
                  selected={dateISO}
                  summary={summary}
                  loading={loadingMonth}
                  canGoBack={
                    cursor.year > fromISODate(today).getFullYear() ||
                    (cursor.year === fromISODate(today).getFullYear() &&
                      cursor.month > fromISODate(today).getMonth())
                  }
                  canGoForward={cursor.month < fromISODate(today).getMonth() + 3}
                  onMonthChange={(direction) =>
                    setCursor((current) => {
                      const next = new Date(current.year, current.month + direction, 1);
                      return { year: next.getFullYear(), month: next.getMonth() };
                    })
                  }
                  onSelect={(iso) => {
                    setDateISO(iso);
                    setTime(null);
                    setErrors((current) => ({ ...current, dateISO: "", time: "" }));
                  }}
                />

                {errors.dateISO ? (
                  <p role="alert" className="font-mono text-[11px] text-crimson">
                    {errors.dateISO}
                  </p>
                ) : null}

                <TimeSlots
                  availability={availability}
                  loading={loadingDay}
                  selected={time}
                  players={players}
                  onSelect={(value) => {
                    setTime(value);
                    setErrors((current) => ({ ...current, time: "" }));
                  }}
                  onSuggestNextDay={suggestNextDay}
                />

                {errors.time ? (
                  <p role="alert" className="font-mono text-[11px] text-crimson">
                    {errors.time}
                  </p>
                ) : null}

                <div className="border-t border-bone/10 pt-6">
                  <Extras
                    quest={quest}
                    players={players}
                    fearMode={fearMode}
                    extraIds={extraIds}
                    isBirthday={isBirthday}
                    onPlayersChange={setPlayers}
                    onFearModeChange={setFearMode}
                    onToggleExtra={(id) =>
                      setExtraIds((current) =>
                        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                      )
                    }
                    onToggleBirthday={(value) => {
                      setIsBirthday(value);
                      setErrors((current) => ({ ...current, isBirthday: "" }));
                    }}
                  />
                  {errors.isBirthday ? (
                    <p role="alert" className="mt-3 font-mono text-[11px] text-crimson">
                      {errors.isBirthday}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="btn-ghost flex items-center justify-center gap-2 px-6 py-4 font-display text-sm uppercase tracking-[0.16em]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Назад
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  data-cursor="[ ДАЛЬШЕ ]"
                  className="btn-blood flex flex-1 items-center justify-center gap-3 px-7 py-4 font-display text-base uppercase tracking-[0.16em]"
                >
                  К контактам
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </section>
          ) : null}

          {/* ── ШАГ 3 ───────────────────────────────────────────────────── */}
          {step === 3 ? (
            <section aria-labelledby="step-contact">
              <h1
                id="step-contact"
                className="font-display text-[clamp(1.7rem,7vw,3rem)] uppercase leading-none tracking-tight text-bone"
              >
                Последний шаг
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone-dim sm:text-base">
                Оставьте контакт — администратор напишет, подтвердит бронь и пришлёт реквизиты для предоплаты.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="booking-name"
                    className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text"
                  >
                    Имя *
                  </label>
                  <input
                    id="booking-name"
                    name="name"
                    autoComplete="name"
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "error-name" : undefined}
                    className="field px-4 py-3.5"
                    placeholder="Как к вам обращаться"
                  />
                  {errors.name ? (
                    <p id="error-name" role="alert" className="mt-2 font-mono text-[11px] text-crimson">
                      {errors.name}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="booking-phone"
                    className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text"
                  >
                    Телефон *
                  </label>
                  <input
                    id="booking-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? "error-phone" : "hint-phone"}
                    className="field px-4 py-3.5"
                    placeholder="+7 777 000 00 00"
                  />
                  {errors.phone ? (
                    <p id="error-phone" role="alert" className="mt-2 font-mono text-[11px] text-crimson">
                      {errors.phone}
                    </p>
                  ) : (
                    <p id="hint-phone" className="mt-2 font-mono text-[10px] text-ash-text">
                      По этому номеру администратор подтвердит бронь
                    </p>
                  )}
                </div>
              </div>

              <fieldset className="mt-6">
                <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
                  Куда удобнее написать *
                </legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      { id: "whatsapp", label: "WhatsApp", note: "быстрее всего" },
                      { id: "telegram", label: "Telegram", note: "если нет WhatsApp" },
                      { id: "call", label: "Звонок", note: "позвоним сами" },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer flex-col gap-1 border p-4 transition ${
                        messenger === option.id
                          ? "border-crimson bg-blood-deep/30"
                          : "border-bone/12 hover:border-crimson/50"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="messenger"
                          value={option.id}
                          checked={messenger === option.id}
                          onChange={() => setMessenger(option.id)}
                          className="h-4 w-4 accent-[#b0121b]"
                        />
                        <span className="font-display text-sm uppercase tracking-[0.08em] text-bone">
                          {option.label}
                        </span>
                      </span>
                      <span className="pl-[26px] font-mono text-[10px] uppercase tracking-[0.14em] text-ash-text">
                        {option.note}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Мобильный запасной путь: если печатать неудобно — можно позвонить
                  или написать, бронь администратор оформит вручную */}
              <div className="mt-5 flex flex-col gap-2 border border-bone/10 bg-ink/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-bone-dim">
                  Неудобно заполнять с телефона? Оформим бронь по звонку или в мессенджере.
                </p>
                <div className="flex gap-2">
                  <a
                    href={`tel:${BUSINESS.phone}`}
                    className="btn-ghost inline-flex min-h-[44px] items-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Позвонить
                  </a>
                  <a
                    href={BUSINESS.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-ghost inline-flex min-h-[44px] items-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>
                </div>
              </div>

              <div className="mt-6">
                <label
                  htmlFor="booking-comment"
                  className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text"
                >
                  Комментарий
                </label>
                <textarea
                  id="booking-comment"
                  name="comment"
                  rows={4}
                  enterKeyHint="done"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="field px-4 py-3.5"
                  placeholder="День рождения, корпоратив, ограничения по здоровью, пожелания по уровню страха"
                />
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-bone-dim">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  aria-invalid={Boolean(errors.consent)}
                  className="mt-0.5 h-4 w-4 accent-[#b0121b]"
                />
                <span>
                  Согласен на обработку персональных данных для оформления и подтверждения брони.
                  {errors.consent ? (
                    <span role="alert" className="mt-1 block font-mono text-[11px] text-crimson">
                      {errors.consent}
                    </span>
                  ) : null}
                </span>
              </label>

              {/* Мобильная сводка: цена всегда под рукой */}
              <div className="mt-7 lg:hidden">
                <BookingSummary
                  quest={quest}
                  players={players}
                  fearMode={fearMode}
                  dateISO={dateISO}
                  time={time}
                  extraIds={extraIds}
                  isBirthday={isBirthday}
                  compact
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="btn-ghost flex items-center justify-center gap-2 px-6 py-4 font-display text-sm uppercase tracking-[0.16em]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Назад
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  data-cursor="[ ПОДТВЕРДИТЬ ]"
                  className={`btn-blood flex flex-1 items-center justify-center gap-3 px-7 py-4 font-display text-base uppercase tracking-[0.16em] disabled:opacity-70 ${
                    glitch ? "animate-[shake-x_0.42s_cubic-bezier(0.36,0.07,0.19,0.97)]" : ""
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Сохраняем…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      Подтвердить бронь · {price.total.toLocaleString("ru-RU")} ₸
                    </>
                  )}
                </button>
              </div>

              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ash-text">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson/70" aria-hidden="true" />
                Оплата на сайте не списывается. {BUSINESS.prepaymentNote}
              </p>
            </section>
          ) : null}
        </div>

        <div className="hidden lg:block">
          <BookingSummary
            quest={quest}
            players={players}
            fearMode={fearMode}
            dateISO={dateISO}
            time={time}
            extraIds={extraIds}
            isBirthday={isBirthday}
          />
        </div>
      </div>
    </div>
  );
}
