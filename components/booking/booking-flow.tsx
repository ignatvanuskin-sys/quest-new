"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { BUSINESS, FEAR_MODES, QUESTS, getFearMode, getQuest } from "@/lib/content";
import type { MonthDaySummary } from "@/lib/availability";
import { MIN_GAME_PRICE, PER_PERSON_FROM, PER_PERSON_PRICE, computePrice } from "@/lib/pricing";
import type {
  BookingConfirmation,
  BookingRecord,
  BookingSelection,
  DayAvailability,
  FearModeId,
} from "@/lib/types";
import { track } from "@/lib/analytics";
import { formatHumanDate, formatKzt, fromISODate, todayISO } from "@/lib/utils";
import { FEATURED_REVIEW } from "@/lib/reviews";
import { PhoneInput } from "@/components/booking/phone-input";
import { Calendar } from "@/components/booking/calendar";
import { TimeSlots } from "@/components/booking/time-slots";
import { Extras } from "@/components/booking/extras";
import { BookingSummary } from "@/components/booking/summary";
import { BookingSuccess } from "@/components/booking/success";

type Step = 1 | 2 | 3;

const STEPS: Array<{ id: Step; label: string; hint: string }> = [
  { id: 1, label: "Квест", hint: "что играем и сколько вас" },
  { id: 2, label: "Дата и время", hint: "свободные слоты" },
  { id: 3, label: "Контакт", hint: "куда написать" },
];

/** Ключ черновика: он же версия — если структура изменится, старый не подхватится */
const DRAFT_KEY = "hc:booking-draft:v1";

/**
 * Последнее подтверждение — чтобы обновление страницы не отнимало номер брони.
 *
 * Хранятся только неперсональные поля (BookingConfirmation): имени, телефона
 * и комментария здесь нет, поэтому локальное хранилище не превращается
 * в копию клиентской базы.
 */
const CONFIRMATION_KEY = "hc:booking-confirmation:v1";

function readConfirmation(): BookingConfirmation | null {
  try {
    const raw = window.localStorage.getItem(CONFIRMATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingConfirmation;
    return parsed?.id && parsed?.questSlug ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Ключ идемпотентности для текущей попытки брони.
 *
 * Живёт до тех пор, пока данные формы не изменились: повторная отправка
 * (двойное нажатие, повтор после обрыва сети) уходит на сервер с тем же
 * ключом, и сервер возвращает уже созданную бронь вместо второй.
 * Как только человек что-то поменял — это новая заявка, и ключ новый.
 */
function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* старый браузер — соберём ключ вручную */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const MESSENGERS = [
  { id: "whatsapp", label: "WhatsApp", note: "быстрее всего — и предоплата там же" },
  { id: "telegram", label: "Telegram", note: "если WhatsApp не используете" },
  { id: "call", label: "Звонок", note: "позвоним сами и всё оформим" },
] as const;

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
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [glitch, setGlitch] = useState(false);

  /** Ключ идемпотентности и подпись данных, к которым он относится */
  const idempotencyRef = useRef<string>("");
  const signatureRef = useRef<string>("");

  const currentIdempotencyKey = (): string => {
    if (!idempotencyRef.current) idempotencyRef.current = newIdempotencyKey();
    return idempotencyRef.current;
  };

  /* Одно событие «начал бронировать» на визит формы: по нему считается
     конверсия «дошёл до формы → оформил», и дублировать его нельзя */
  const startedTrackedRef = useRef(false);

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

  /* ── Черновик заявки и шаг в адресе ────────────────────────────────────
     Черновик спасает от самой обидной потери: человек заполнил форму,
     случайно обновил страницу или свернул браузер — и всё заново.
     Шаг хранится в адресе, поэтому кнопки «назад/вперёд» браузера работают
     как ожидается, а ссылку на конкретный шаг можно переслать. */
  const [draftRestored, setDraftRestored] = useState(false);
  /**
   * После захода по ссылке на другой квест эффект сохранения срабатывает
   * сразу после восстановления и затирает предыдущий черновик сброшенным
   * состоянием — вернуть его было бы неоткуда. Поэтому первую запись
   * в таком случае пропускаем: черновик обновится, когда человек сам
   * что-то изменит.
   */
  /**
   * Признак «человек что-то сделал в форме».
   *
   * Записываем черновик только после реального действия. Иначе эффект
   * сохранения срабатывает сразу после монтирования — ещё со старым
   * состоянием, — и затирает черновик другого сценария. Проверять порядок
   * эффектов и «первый запуск» оказалось ненадёжно: флаг гасился раньше,
   * чем состояние успевало примениться. Флаг по событию такой проблемы
   * не имеет: без действия пользователя запись не происходит вообще.
   */
  const interactedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const questFromUrl = params.get("quest") ? getQuest(params.get("quest") as string) : undefined;
    const stepFromUrl = Number(params.get("step"));
    const initialStep: Step =
      stepFromUrl >= 1 && stepFromUrl <= 3 ? (stepFromUrl as Step) : 1;
    let resolvedQuestSlug = questFromUrl?.slug ?? questSlug;

    /* Обновление страницы на экране успеха.
       Раньше номер брони терялся: состояние жило только в памяти, а черновик
       уже удалён. Теперь подтверждение восстанавливается из локального
       хранилища — и человек снова видит свой номер, адрес и кнопку календаря.
       Параметров брони в адресе нет намеренно: URL попадает в историю,
       аналитику и чужие чаты, персональным данным там не место. */
    if (params.get("done") === "1") {
      const confirmation = readConfirmation();
      if (confirmation) {
        setBooking(confirmation);
        setStep(initialStep);
        track("booking_success", { quest: confirmation.questSlug, restored: true });
        return;
      }
    }

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<BookingSelection> & { step?: number };
        const draftQuest = draft.questSlug ? getQuest(draft.questSlug) : undefined;

        /* Разделяем два похожих случая:
           • человек открыл ссылку на ДРУГОЙ квест — тогда данные прежнего
             сценария (игроки, опции, дата) не подходят и не подставляются;
           • человек просто обновил страницу — в адресе тоже есть ?quest=,
             потому что форма сама его туда пишет. Тут черновик обязан
             восстановиться целиком, иначе обновление страницы теряет всё.

           Отличаем их сравнением квестов, а не наличием параметра. */
        const urlQuestSlug = questFromUrl?.slug;
        const sameQuest = Boolean(urlQuestSlug && draftQuest && urlQuestSlug === draftQuest.slug);
        const questChanged = Boolean(urlQuestSlug && draftQuest && !sameQuest);
        const targetQuest = questFromUrl ?? draftQuest;

        if (targetQuest) {
          resolvedQuestSlug = targetQuest.slug;
          setQuestSlug(targetQuest.slug);

          if (questChanged) {
            setPlayers(targetQuest.spec.playersMin);
            setFearMode(
              targetQuest.fearModes.includes("light") ? "light" : targetQuest.fearModes[0],
            );
            setExtraIds([]);
            setIsBirthday(false);
          } else {
            if (typeof draft.players === "number") {
              setPlayers(
                Math.min(
                  Math.max(draft.players, targetQuest.spec.playersMin),
                  targetQuest.spec.playersMax,
                ),
              );
            } else {
              setPlayers(targetQuest.spec.playersMin);
            }
            if (draft.fearMode && targetQuest.fearModes.includes(draft.fearMode)) {
              setFearMode(draft.fearMode);
            }
            if (Array.isArray(draft.extraIds)) setExtraIds(draft.extraIds);
            if (typeof draft.isBirthday === "boolean") setIsBirthday(draft.isBirthday);
          }
        }

        // Дата и время относятся к сценарию: при смене квеста их не переносим
        if (!questChanged) {
          if (draft.dateISO) setDateISO(draft.dateISO);
          if (draft.time) setTime(draft.time);
        }

        // Контакты от сценария не зависят — их подставляем всегда,
        // чтобы человеку не пришлось набирать номер заново
        if (draft.name) setName(draft.name);
        if (draft.phone) setPhone(draft.phone);
        if (draft.messenger) setMessenger(draft.messenger);
        if (draft.comment) setComment(draft.comment);

        if (!questChanged && (draft.name || draft.phone || draft.dateISO)) setDraftRestored(true);
      }
    } catch {
      /* приватный режим или испорченные данные — просто начинаем с чистого листа */
    }

    setStep(initialStep);

    /* История для кнопки «назад».
       Если человек открыл ссылку сразу на второй шаг, «назад» должна вести
       на первый шаг формы, а не выбрасывать со страницы: сначала подменяем
       текущую запись на шаг 1, затем кладём поверх неё исходный шаг. */
    // Квест в адресе берём из уже разрешённого состояния (ссылка или черновик),
    // иначе на первом рендере в URL попадал квест по умолчанию и адрес
    // расходился с тем, что на экране
    const query = (step: number) => {
      const next = new URLSearchParams(window.location.search);
      next.set("quest", resolvedQuestSlug);
      next.set("step", String(step));
      return `/booking?${next.toString()}`;
    };

    if (initialStep > 1) {
      window.history.replaceState(null, "", query(1));
      window.history.pushState(null, "", query(initialStep));
    } else {
      window.history.replaceState(null, "", query(1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- начальное состояние читается один раз
  }, []);

  useEffect(() => {
    if (!interactedRef.current) return;

    const payload = {
      questSlug,
      players,
      fearMode,
      extraIds,
      isBirthday,
      dateISO,
      time,
      name,
      phone,
      messenger,
      comment,
      step,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      /* хранилище недоступно — форма всё равно работает */
    }

    /* Подпись содержимого заявки. Пока она не менялась, повторная отправка
       считается той же самой попыткой и уходит с прежним ключом идемпотентности.
       Как только человек поправил данные — это другая заявка, ключ новый. */
    const signature = [questSlug, players, fearMode, extraIds.join(","), isBirthday, dateISO, time, name, phone].join("|");
    if (signatureRef.current !== signature) {
      signatureRef.current = signature;
      idempotencyRef.current = newIdempotencyKey();
    }

    if (!startedTrackedRef.current) {
      startedTrackedRef.current = true;
      track("booking_started", { quest: questSlug, players });
    }
  }, [questSlug, players, fearMode, extraIds, isBirthday, dateISO, time, name, phone, messenger, comment, step]);

  useEffect(() => {
    const onPopState = () => {
      const stepParam = Number(new URLSearchParams(window.location.search).get("step"));
      // Без параметра Number(null) даёт 0 — раньше шаг просто не менялся,
      // и адрес расходился с тем, что на экране. Теперь отсутствие шага
      // трактуется как первый шаг.
      setStep(stepParam >= 1 && stepParam <= 3 ? (stepParam as Step) : 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const resetDraft = () => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ничего страшного */
    }
    const quest = getQuest(questSlug);
    setDraftRestored(false);
    setStep(1);
    setPlayers(quest ? quest.spec.playersMin : 2);
    setFearMode(quest?.fearModes.includes("light") ? "light" : (quest?.fearModes[0] ?? "light"));
    setDateISO(null);
    setTime(null);
    setExtraIds([]);
    setIsBirthday(false);
    setName("");
    setPhone("");
    setComment("");
    setErrors({});
    window.history.replaceState(null, "", `/booking?quest=${questSlug}&step=1`);
  };

  const flashGlitch = useCallback(() => {
    setGlitch(true);
    window.setTimeout(() => setGlitch(false), 700);
  }, []);

  const goToStep = (next: Step) => {
    if (next !== step) track("booking_step_completed", { from: step, to: next });
    setStep(next);
    setFailure(null);
    // pushState, а не replaceState: тогда кнопка «назад» возвращает на
    // предыдущий шаг формы, а не выкидывает со страницы
    window.history.pushState(null, "", `/booking?quest=${questSlug}&step=${next}`);
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

    const idempotencyKey = currentIdempotencyKey();
    track("booking_submitted", { quest: questSlug, players, isBirthday, hasComment: Boolean(comment.trim()) });

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
          idempotencyKey,
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
        // Различаем два разных случая: занятый слот и сбой сервера.
        // Первому нужен другой выбор времени, второму — просто повторить.
        const reason = data.errors?.time
          ? "slot_unavailable"
          : response.status >= 500
            ? "server_error"
            : "validation";
        track("booking_failed", { quest: questSlug, reason });
        setFailure(data.message ?? "Не удалось сохранить бронь. Проверьте данные и попробуйте ещё раз.");
        // при ошибке ключ сохраняем: повторная отправка не должна создать дубль
        flashGlitch();
        return;
      }

      /* На экран успеха отдаём только неперсональные поля: имени и телефона
         в компоненте нет, значит их не нужно и держать в браузере. */
      const confirmation: BookingConfirmation = {
        id: data.booking.id,
        questSlug: data.booking.questSlug,
        dateISO: data.booking.dateISO,
        time: data.booking.time,
        players: data.booking.players,
        fearMode: data.booking.fearMode,
        total: data.booking.total,
        extraNames: data.booking.extraNames,
      };

      setBooking(confirmation);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
        // Подтверждение сохраняем, чтобы обновление страницы не потеряло номер брони
        window.localStorage.setItem(CONFIRMATION_KEY, JSON.stringify(confirmation));
      } catch {
        /* не критично: без хранилища обновление страницы просто вернёт форму */
      }
      // Ключ израсходован: следующая заявка должна получить новый
      idempotencyRef.current = "";
      track("booking_success", {
        quest: questSlug,
        players,
        duplicate: Boolean(data.duplicate),
        total: confirmation.total,
      });
      window.history.replaceState(null, "", `/booking?quest=${questSlug}&done=1`);
      window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      // Ключ НЕ сбрасываем: повтор уйдёт с тем же ключом и не создаст вторую бронь
      track("booking_failed", { quest: questSlug, reason: "network" });
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
    window.history.replaceState(null, "", `/booking?quest=${slug}&step=1`);
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
    // Любое касание формы (клик, клавиша, изменение поля) включает сохранение
    // черновика — до первого действия в localStorage ничего не пишется
    <div
      ref={topRef}
      onPointerDownCapture={() => {
        interactedRef.current = true;
      }}
      onKeyDownCapture={() => {
        interactedRef.current = true;
      }}
      onChangeCapture={() => {
        interactedRef.current = true;
      }}
      // click нужен отдельно: синтетический клик (скринридер, расширение,
      // автозаполнение) не порождает pointerdown/keydown
      onClickCapture={() => {
        interactedRef.current = true;
      }}
      className="mx-auto max-w-[1400px] scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-10"
    >
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
          {draftRestored ? (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-bone/15 bg-charcoal/60 px-4 py-3">
              <p className="text-sm text-bone-dim">
                Черновик заявки восстановлен — можно продолжить с того же места.
              </p>
              <button
                type="button"
                onClick={resetDraft}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash-text underline decoration-crimson/50 underline-offset-4 transition hover:text-bone"
              >
                начать заново
              </button>
            </div>
          ) : null}

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

              {/* Счётчик игроков живёт на первом шаге — там, где человек решает
                  «что играем и сколько нас». Раньше он был только на втором,
                  и подпись шага не совпадала с содержимым. */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-bone/12 bg-ash/40 p-4">
                <div>
                  <p className="font-display text-base uppercase tracking-[0.08em] text-bone">
                    Сколько вас
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
                    от {quest.spec.playersMin} до {quest.spec.playersMax} ·{" "}
                    {players < PER_PERSON_FROM
                      ? `${formatKzt(MIN_GAME_PRICE)} за игру`
                      : `${players} × ${formatKzt(PER_PERSON_PRICE)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlayers(Math.max(quest.spec.playersMin, players - 1))}
                    disabled={players <= quest.spec.playersMin}
                    aria-label="Убрать одного игрока"
                    className="flex h-11 w-11 items-center justify-center border border-bone/20 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span
                    className="w-12 text-center font-display text-2xl tabular-nums text-bone"
                    aria-live="polite"
                  >
                    {players}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPlayers(Math.min(quest.spec.playersMax, players + 1))}
                    disabled={players >= quest.spec.playersMax}
                    aria-label="Добавить одного игрока"
                    className="flex h-11 w-11 items-center justify-center border border-bone/20 text-bone transition enabled:hover:border-crimson/60 disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Выбор страха — четыре компактные кнопки вместо четырёх карточек:
                  в форме человеку важнее пройти дальше, чем читать описания.
                  Пояснение показываем только для выбранного уровня. */}
              <div className="mt-8">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-xl uppercase tracking-[0.08em] text-bone">
                    Уровень страха
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
                    можно поменять на месте
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Уровень страха">
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
                        className={`flex min-h-[60px] flex-col items-start justify-center border px-3 py-2.5 text-left transition ${
                          active ? "border-crimson bg-blood-deep/40" : "border-bone/12 hover:border-crimson/50"
                        } ${!available ? "cursor-not-allowed opacity-35" : ""}`}
                      >
                        <span className="font-display text-[15px] uppercase leading-none tracking-[0.04em] text-bone">
                          {mode.name}
                        </span>
                        <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-crimson">
                          с {mode.minAge}+
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-sm leading-relaxed text-bone-dim">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-crimson">
                    {getFearMode(fearMode).contact}
                  </span>
                  {getFearMode(fearMode).note}
                </p>
                {errors.players ? (
                  <p role="alert" className="mt-3 font-mono text-[11px] text-crimson">
                    {errors.players}
                  </p>
                ) : null}
              </div>

              <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex flex-col gap-3 border-t border-bone/12 bg-ink/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:backdrop-blur-none">
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

              <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex flex-col gap-3 border-t border-bone/12 bg-ink/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:backdrop-blur-none">
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
                  {/* Маска и жёсткий лимит: лишние цифры просто не вводятся,
                      номер приводится к формату сам */}
                  <PhoneInput
                    id="booking-phone"
                    value={phone}
                    onChange={(value) => {
                      setPhone(value);
                      setErrors((current) => ({ ...current, phone: "" }));
                    }}
                    invalid={Boolean(errors.phone)}
                    describedBy={errors.phone ? "error-phone" : "hint-phone"}
                  />
                  {errors.phone ? (
                    <p id="error-phone" role="alert" className="mt-2 font-mono text-[11px] text-crimson">
                      {errors.phone}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Три узких кнопки вместо трёх карточек: WhatsApp выбран заранее,
                  менять нужно редко — значит, и места это занимать не должно */}
              <fieldset className="mt-6">
                <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text">
                  Как с вами связаться
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {MESSENGERS.map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-[52px] cursor-pointer items-center justify-center border px-2 py-2.5 text-center transition focus-within:border-crimson focus-within:ring-1 focus-within:ring-crimson/40 ${
                        messenger === option.id
                          ? "border-crimson bg-blood-deep/40"
                          : "border-bone/12 hover:border-crimson/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="messenger"
                        value={option.id}
                        checked={messenger === option.id}
                        onChange={() => setMessenger(option.id)}
                        className="sr-only"
                      />
                      <span className="font-display text-[13px] uppercase leading-none tracking-[0.04em] text-bone">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
                  {MESSENGERS.find((option) => option.id === messenger)?.note}
                </p>
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

              {/* Реальное социальное доказательство и правила отмены прямо
                  перед кнопкой: именно здесь возникают последние сомнения
                  «а если не понравится / если планы изменятся» */}
              <div className="mt-7 border border-bone/12 bg-charcoal/50 p-4">
                <blockquote className="text-sm leading-relaxed text-bone-dim">
                  «{FEATURED_REVIEW.text}»
                </blockquote>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
                  {FEATURED_REVIEW.author} · {FEATURED_REVIEW.quest} · отзыв с сайта площадки
                </p>
                <ul className="mt-4 space-y-1.5 border-t border-bone/10 pt-3">
                  <li className="flex items-center gap-2 text-xs text-bone-dim">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-crimson" aria-hidden="true" />
                    Отмена и перенос — за 24 часа, предоплата переносится
                  </li>
                  <li className="flex items-center gap-2 text-xs text-bone-dim">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-crimson" aria-hidden="true" />
                    Оплата не списывается на сайте: сначала подтверждение администратора
                  </li>
                </ul>
              </div>

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

              <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex flex-col gap-3 border-t border-bone/12 bg-ink/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:backdrop-blur-none">
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
                  className={`btn-blood flex flex-1 items-center justify-center gap-2 px-4 py-4 font-display text-[13px] uppercase tracking-[0.1em] disabled:opacity-70 min-[400px]:gap-3 min-[400px]:px-7 min-[400px]:text-base min-[400px]:tracking-[0.16em] ${
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
