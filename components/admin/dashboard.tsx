"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import {
  BOOKING_STATUS_LABELS,
  getFearMode,
  getQuest,
  PAYMENT_STATUS_LABELS,
} from "@/lib/content";
import { allowedTransitions, isStaleUnconfirmed } from "@/lib/domain/booking-status";
import type { BookingRecord, BookingStatus } from "@/lib/types";
import { formatHumanDate, formatKzt, prettyPhone } from "@/lib/utils";

/**
 * Рабочее место администратора.
 *
 * Главный критерий, по которому всё собрано: утром владелец должен за десять
 * секунд понять, сколько игр сегодня, что требует действия и сколько денег
 * подтверждено. Поэтому сверху — сводка дня, затем вкладка «Требуют внимания»
 * по умолчанию, и только потом полный список.
 *
 * Что здесь принципиально:
 * • кнопки статуса строятся из машины состояний (lib/domain/booking-status).
 *   Недоступный переход просто не показывается, а не «падает» с ошибкой;
 * • отмена требует подтверждения: это необратимое действие для бизнеса;
 * • оплата отмечается отдельной кнопкой — статус платежа виден в списке
 *   и участвует в сводке.
 */

type Tab = "attention" | "today" | "upcoming" | "all";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "attention", label: "Требуют внимания" },
  { id: "today", label: "Сегодня" },
  { id: "upcoming", label: "Предстоящие" },
  { id: "all", label: "Все" },
];

interface Stats {
  total: number;
  new: number;
  today: number;
  upcoming: number;
  revenue: number;
  needsAttention: number;
  paid: number;
  stale: number;
  playersToday: number;
}

const STATUS_TONE: Record<BookingStatus, string> = {
  new: "border-crimson/60 text-crimson",
  confirmed: "border-bone/40 text-bone",
  completed: "border-steel text-ash-text",
  cancelled: "border-steel text-dust line-through",
  expired: "border-steel text-dust",
};

const PAYMENT_TONE: Record<string, string> = {
  paid: "border-emerald-500/50 text-emerald-300",
  pending: "border-bone/25 text-bone-dim",
  failed: "border-crimson/50 text-crimson",
  cancelled: "border-steel text-dust",
  not_required: "border-bone/20 text-ash-text",
};

/** Что за чем следует — подписи кнопок для переходов машины состояний */
const TRANSITION_LABELS: Partial<Record<BookingStatus, string>> = {
  new: "Вернуть в ожидание",
  confirmed: "Подтвердить",
  completed: "Проведена",
  cancelled: "Отменить",
};

export function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("attention");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "">("");
  const [dateFilter, setDateFilter] = useState("");
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  /** Номер запроса: защита от гонки, когда медленный ответ приходит после быстрого */
  const requestRef = useRef(0);

  const load = useCallback(
    async (withSpinner = false) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (withSpinner) setLoading(true);

      try {
        const params = new URLSearchParams();
        if (tab !== "all") params.set("scope", tab);
        if (statusFilter) params.set("status", statusFilter);
        if (dateFilter) params.set("date", dateFilter);
        if (query.trim()) params.set("q", query.trim());

        const response = await fetch(`/api/bookings?${params.toString()}`, { cache: "no-store" });
        if (requestId !== requestRef.current) return;

        if (response.status === 401) {
          router.refresh();
          return;
        }
        const data = (await response.json()) as {
          ok?: boolean;
          bookings?: BookingRecord[];
          stats?: Stats;
          message?: string;
        };
        if (!data.ok) {
          setError(data.message ?? "Не удалось получить список броней");
          return;
        }
        setBookings(data.bookings ?? []);
        setStats(data.stats ?? null);
        setError(null);
      } catch {
        if (requestId === requestRef.current) {
          setError("Сервер не отвечает. Проверьте соединение — данные в форме не потеряются.");
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [router, tab, statusFilter, dateFilter, query],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  /* Поиск с задержкой: без неё каждый символ отправляет запрос и список
     мигает результатами промежуточных состояний */
  useEffect(() => {
    const timer = window.setTimeout(() => void load(false), 300);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(false), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const changeStatus = async (id: string, status: BookingStatus) => {
    setPendingId(id);
    setNotice(null);
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; hint?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Не удалось изменить статус");
        return;
      }
      setConfirmCancelId(null);
      await load(false);
    } catch {
      setError("Не удалось изменить статус: нет связи с сервером.");
    } finally {
      setPendingId(null);
    }
  };

  const markPayment = async (id: string, paymentStatus: string, confirm = false) => {
    setPendingId(id);
    setNotice(null);
    try {
      const response = await fetch(`/api/bookings/${id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus, confirm }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; warning?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Не удалось отметить оплату");
        return;
      }
      if (data.warning) setNotice(data.warning);
      await load(false);
    } catch {
      setError("Не удалось отметить оплату: нет связи с сервером.");
    } finally {
      setPendingId(null);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.refresh();
  };

  const summary = useMemo(
    () => [
      {
        label: "Игр сегодня",
        value: stats?.today ?? 0,
        hint: stats ? `${stats.playersToday} чел.` : "",
        tone: "text-bone",
      },
      {
        label: "Требуют внимания",
        value: stats?.needsAttention ?? 0,
        hint: stats?.stale ? `из них просрочено: ${stats.stale}` : "новые и без оплаты",
        tone: stats?.needsAttention ? "text-crimson" : "text-bone",
      },
      {
        label: "Предоплата получена",
        value: stats?.paid ?? 0,
        hint: `из ${stats?.total ?? 0} броней`,
        tone: "text-bone",
      },
      {
        label: "Сумма активных",
        value: formatKzt(stats?.revenue ?? 0),
        hint: "без отменённых",
        tone: "text-bone",
      },
    ],
    [stats],
  );

  const emptyText: Record<Tab, string> = {
    attention: "Броней, требующих внимания, нет. Все заявки подтверждены или проведены.",
    today: "На сегодня игр нет. Загляните во вкладку «Предстоящие».",
    upcoming: "Предстоящих броней пока нет. Новые заявки появятся здесь автоматически.",
    all: "Заявок нет. Как только придёт первая бронь с сайта, она появится здесь — страницу перезагружать не нужно.",
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-bone">Брони</h1>
          <p className="mt-2 text-sm text-bone-dim">
            Обновляется автоматически. Список можно не перезагружать.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            className="btn-ghost flex min-h-[44px] items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Обновить
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="btn-ghost flex min-h-[44px] items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Выйти
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-bone/12 bg-charcoal/60 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash-text">{item.label}</p>
            <p className={`mt-2 font-display text-2xl leading-none sm:text-3xl ${item.tone}`}>{item.value}</p>
            {item.hint ? (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ash-text">
                {item.hint}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex min-h-[44px] items-center border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
              tab === item.id
                ? "border-crimson bg-blood-deep/50 text-bone"
                : "border-bone/15 text-bone-dim hover:border-bone/35 hover:text-bone"
            }`}
          >
            {item.label}
            {item.id === "attention" && stats?.needsAttention ? (
              <span className="ml-2 border border-crimson/60 px-1.5 py-0.5 font-mono text-[10px] text-crimson">
                {stats.needsAttention}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Поиск по номеру, имени или телефону</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash-text"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Номер брони, имя или телефон"
            className="min-h-[44px] w-full border border-bone/15 bg-ink/60 pl-10 pr-3 py-3 text-sm text-bone placeholder:text-dust focus:border-crimson/60 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="sr-only">Фильтр по статусу</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as BookingStatus | "")}
            className="min-h-[44px] w-full border border-bone/15 bg-ink/60 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-bone focus:border-crimson/60 focus:outline-none sm:w-auto"
          >
            <option value="">Все статусы</option>
            <option value="new">Ожидают подтверждения</option>
            <option value="confirmed">Подтверждены</option>
            <option value="completed">Проведены</option>
            <option value="cancelled">Отменены</option>
            <option value="expired">Истекли</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Фильтр по дате игры</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="min-h-[44px] w-full border border-bone/15 bg-ink/60 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-bone focus:border-crimson/60 focus:outline-none sm:w-auto"
          />
        </label>
      </div>

      {error ? (
        <div role="alert" className="mt-5 border border-crimson/50 bg-blood-deep/25 p-4 text-sm text-bone">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-5 border border-bone/25 bg-charcoal/60 p-4 text-sm text-bone-dim">{notice}</div>
      ) : null}

      {loading && bookings.length === 0 ? (
        <div className="mt-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash-text">
          <Loader2 className="h-4 w-4 animate-spin text-crimson" aria-hidden="true" />
          Загружаем брони…
        </div>
      ) : null}

      {!loading && bookings.length === 0 ? (
        <div className="mt-8 border border-bone/12 bg-charcoal/60 p-8 text-center">
          <p className="font-display text-xl uppercase tracking-[0.06em] text-bone-dim">Здесь пусто</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-ash-text">{emptyText[tab]}</p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {bookings.map((booking) => {
          const quest = getQuest(booking.questSlug);
          const mode = getFearMode(booking.fearMode);
          const stale = isStaleUnconfirmed(booking);
          const paymentStatus = booking.payment?.status ?? "pending";
          const nextSteps = allowedTransitions(booking.status).filter((status) => status !== "expired");
          const message = encodeURIComponent(
            `Здравствуйте, ${booking.name}! Подтверждаем бронь ${booking.id}: «${quest?.title}», ${formatHumanDate(booking.dateISO)} в ${booking.time}, ${booking.players} чел. Итого ${formatKzt(booking.total)}.`,
          );

          return (
            <li
              key={booking.id}
              className={`border bg-charcoal/60 p-4 sm:p-5 ${
                stale ? "border-crimson/50" : "border-bone/12"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-crimson">{booking.id}</span>
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
                        STATUS_TONE[booking.status]
                      }`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
                        PAYMENT_TONE[paymentStatus]
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}
                    </span>
                    {stale ? (
                      <span className="inline-flex items-center gap-1 border border-crimson/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-crimson">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Время прошло, не подтверждена
                      </span>
                    ) : null}
                    {booking.crmSync?.status === "failed" ? (
                      <span className="inline-flex items-center gap-1 border border-crimson/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-crimson">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Не выгружено в CRM
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2.5 font-display text-lg uppercase tracking-[0.04em] text-bone">
                    {quest?.title}
                  </p>

                  <p className="mt-1.5 text-sm text-bone-dim">
                    {formatHumanDate(booking.dateISO)}, {booking.time} · {booking.players} чел · {mode.name} (
                    {mode.contact})
                    {booking.isBirthday ? " · именинник" : ""}
                  </p>

                  <p className="mt-1.5 text-sm text-bone-dim">
                    {booking.name} ·{" "}
                    <a href={`tel:${booking.phone}`} className="underline decoration-crimson/50 underline-offset-4">
                      {prettyPhone(booking.phone)}
                    </a>{" "}
                    · {booking.messenger}
                  </p>

                  {booking.extraNames.length > 0 ? (
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash-text">
                      доп: {booking.extraNames.join(", ")}
                    </p>
                  ) : null}

                  {booking.comment ? (
                    <p className="mt-2 max-w-2xl border-l border-bone/20 pl-3 text-xs leading-relaxed text-bone-dim">
                      {booking.comment}
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="font-display text-2xl text-bone">{formatKzt(booking.total)}</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash-text">
                    {booking.priceBreakdown.map((line, index) => (
                      <li key={`${booking.id}-line-${index}`}>
                        {line.label}: {line.amount} ₸
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-bone/8 pt-4">
                {paymentStatus !== "paid" ? (
                  <button
                    type="button"
                    disabled={pendingId === booking.id}
                    onClick={() => void markPayment(booking.id, "paid", booking.status === "new")}
                    className="flex min-h-[44px] items-center gap-2 border border-crimson/45 bg-blood-deep/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone transition enabled:hover:border-crimson disabled:opacity-40"
                  >
                    <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                    Предоплата получена
                  </button>
                ) : null}

                {nextSteps
                  .filter((status) => status !== "cancelled")
                  .map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={pendingId === booking.id}
                      onClick={() => void changeStatus(booking.id, status)}
                      className="inline-flex min-h-[44px] items-center gap-2 border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone transition enabled:hover:border-crimson/70 disabled:opacity-40"
                    >
                      {status === "confirmed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : null}
                      {TRANSITION_LABELS[status] ?? BOOKING_STATUS_LABELS[status]}
                    </button>
                  ))}

                {nextSteps.includes("cancelled") ? (
                  confirmCancelId === booking.id ? (
                    <span className="flex items-center gap-2 border border-crimson/50 bg-blood-deep/25 px-2 py-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone">
                        Отменить бронь?
                      </span>
                      <button
                        type="button"
                        disabled={pendingId === booking.id}
                        onClick={() => void changeStatus(booking.id, "cancelled")}
                        className="min-h-[36px] border border-crimson/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone disabled:opacity-40"
                      >
                        Да, отменить
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancelId(null)}
                        className="min-h-[36px] border border-bone/25 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-dim"
                      >
                        Оставить
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pendingId === booking.id}
                      onClick={() => setConfirmCancelId(booking.id)}
                      className="flex min-h-[44px] items-center gap-2 border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-dim transition enabled:hover:border-crimson/70 disabled:opacity-40"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Отменить
                    </button>
                  )
                ) : null}

                <a
                  href={`https://wa.me/${booking.phone.replace(/\D/g, "")}?text=${message}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex min-h-[44px] items-center gap-2 border border-crimson/45 bg-blood-deep/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  WhatsApp клиенту
                </a>
                <a
                  href={`tel:${booking.phone}`}
                  aria-label={`Позвонить ${booking.name}`}
                  className="flex min-h-[44px] items-center gap-2 border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-dim"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Звонок
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
