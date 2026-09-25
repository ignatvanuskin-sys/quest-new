"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { BOOKING_STATUS_LABELS, getFearMode, getQuest } from "@/lib/content";
import type { BookingRecord, BookingStatus } from "@/lib/types";
import { formatHumanDate, formatKzt, prettyPhone } from "@/lib/utils";

type Tab = "new" | "today" | "upcoming" | "all";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "new", label: "Новые" },
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
}

const STATUS_TONE: Record<BookingStatus, string> = {
  new: "border-crimson/60 text-crimson",
  confirmed: "border-bone/40 text-bone",
  completed: "border-steel text-ash-text",
  cancelled: "border-steel text-dust line-through",
};

/**
 * Рабочее место администратора: все брони, счётчики и смена статуса в один клик.
 * Данные обновляются каждые 60 секунд — страницу не нужно перезагружать вручную.
 */
export function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("new");
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(
    async (withSpinner = false) => {
      if (withSpinner) setLoading(true);
      try {
        const response = await fetch(`/api/bookings?scope=${tab === "all" ? "" : tab}`, {
          cache: "no-store",
        });
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
        setError("Сервер не отвечает. Проверьте соединение.");
      } finally {
        setLoading(false);
      }
    },
    [router, tab],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(false), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const changeStatus = async (id: string, status: BookingStatus) => {
    setPendingId(id);
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setError(data.message ?? "Не удалось изменить статус");
        return;
      }
      await load(false);
    } catch {
      setError("Не удалось изменить статус: нет связи с сервером.");
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
      { label: "Всего броней", value: stats?.total ?? 0, tone: "text-bone" },
      { label: "Новых", value: stats?.new ?? 0, tone: "text-crimson" },
      { label: "Сегодня", value: stats?.today ?? 0, tone: "text-bone" },
      { label: "Предстоящих", value: stats?.upcoming ?? 0, tone: "text-bone" },
    ],
    [stats],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-bone">Брони</h1>
          <p className="mt-2 text-sm text-bone-dim">
            Заявки с сайта. Сумма активных броней:{" "}
            <span className="text-bone">{formatKzt(stats?.revenue ?? 0)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            className="btn-ghost flex items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Обновить
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="btn-ghost flex items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em]"
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
            <p className={`mt-2 font-display text-3xl leading-none ${item.tone}`}>{item.value}</p>
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
            className={`inline-flex min-h-[40px] items-center border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
              tab === item.id
                ? "border-crimson bg-blood-deep/50 text-bone"
                : "border-bone/15 text-bone-dim hover:border-bone/35 hover:text-bone"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="mt-5 border border-crimson/50 bg-blood-deep/25 p-4 text-sm text-bone">
          {error}
        </div>
      ) : null}

      {loading && bookings.length === 0 ? (
        <div className="mt-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash-text">
          <Loader2 className="h-4 w-4 animate-spin text-crimson" aria-hidden="true" />
          Загружаем брони…
        </div>
      ) : null}

      {!loading && bookings.length === 0 ? (
        <div className="mt-8 border border-bone/12 bg-charcoal/60 p-8 text-center">
          <p className="font-display text-xl uppercase tracking-[0.06em] text-bone-dim">
            В этой вкладке пока пусто
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-ash-text">
            Новые заявки с сайта появятся здесь автоматически — страницу можно не перезагружать.
          </p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {bookings.map((booking) => {
          const quest = getQuest(booking.questSlug);
          const mode = getFearMode(booking.fearMode);
          const message = encodeURIComponent(
            `Здравствуйте, ${booking.name}! Подтверждаем бронь ${booking.id}: «${quest?.title}», ${formatHumanDate(booking.dateISO)} в ${booking.time}, ${booking.players} чел. Итого ${formatKzt(booking.total)}.`,
          );

          return (
            <li key={booking.id} className="border border-bone/12 bg-charcoal/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-crimson">{booking.id}</span>
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
                        STATUS_TONE[booking.status]
                      }`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text">
                      создано {new Date(booking.createdAt).toLocaleString("ru-RU")}
                    </span>
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
                <button
                  type="button"
                  disabled={pendingId === booking.id || booking.status === "confirmed"}
                  onClick={() => void changeStatus(booking.id, "confirmed")}
                  className="flex min-h-[42px] items-center gap-2 border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone transition enabled:hover:border-crimson/70 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Подтвердить
                </button>
                <button
                  type="button"
                  disabled={pendingId === booking.id || booking.status === "completed"}
                  onClick={() => void changeStatus(booking.id, "completed")}
                  className="inline-flex min-h-[42px] items-center border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone transition enabled:hover:border-crimson/70 disabled:opacity-40"
                >
                  Проведена
                </button>
                <button
                  type="button"
                  disabled={pendingId === booking.id || booking.status === "cancelled"}
                  onClick={() => void changeStatus(booking.id, "cancelled")}
                  className="flex min-h-[42px] items-center gap-2 border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-dim transition enabled:hover:border-crimson/70 disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Отменить
                </button>
                <button
                  type="button"
                  disabled={pendingId === booking.id || booking.status === "new"}
                  onClick={() => void changeStatus(booking.id, "new")}
                  className="inline-flex min-h-[42px] items-center border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ash-text transition enabled:hover:border-crimson/70 disabled:opacity-40"
                >
                  Вернуть в новые
                </button>

                <a
                  href={`https://wa.me/${booking.phone.replace(/\D/g, "")}?text=${message}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex min-h-[42px] items-center gap-2 border border-crimson/45 bg-blood-deep/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  WhatsApp клиенту
                </a>
                <a
                  href={`tel:${booking.phone}`}
                  aria-label={`Позвонить ${booking.name}`}
                  className="flex min-h-[42px] items-center gap-2 border border-bone/25 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-dim"
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
