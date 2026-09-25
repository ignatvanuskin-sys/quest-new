"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "Не удалось войти");
        return;
      }
      router.refresh();
    } catch {
      setError("Сервер недоступен. Проверьте соединение и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-bone">Панель брони</h1>
      <p className="mt-3 text-sm leading-relaxed text-bone-dim">
        Служебный вход. Здесь видны заявки, их статусы и состав команд.
      </p>

      <form onSubmit={submit} className="mt-8 border border-bone/12 bg-charcoal/60 p-5">
        <label
          htmlFor="admin-password"
          className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-ash-text"
        >
          Пароль администратора
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(error)}
          className="field px-4 py-3.5"
          placeholder="••••••••"
        />
        {error ? (
          <p role="alert" className="mt-2 font-mono text-[11px] text-crimson">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="btn-blood mt-5 flex w-full items-center justify-center gap-3 px-6 py-4 font-display text-sm uppercase tracking-[0.16em] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Проверяем…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Войти
            </>
          )}
        </button>

        <p className="mt-4 text-xs leading-relaxed text-ash-text">
          Пароль задаётся переменной окружения <span className="font-mono text-bone-dim">ADMIN_PASSWORD</span>.
        </p>
      </form>
    </div>
  );
}
