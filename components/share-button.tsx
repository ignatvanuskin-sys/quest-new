"use client";

import { useCallback, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * «Поделиться с командой» — кнопка под системный шер-шит телефона.
 *
 * Зачем в хоррор-квесте: решение принимает не один человек, а компания
 * в чате. Без такой кнопки человек закрывает сайт, чтобы «скинуть ссылку
 * друзьям», и в половине случаев не возвращается. С кнопкой ссылка уходит
 * в мессенджер в один тап, и возвращаться уже не нужно.
 *
 * Использует Web Share API там, где он есть (телефоны), и копирование
 * в буфер на десктопе. Если и то и другое недоступно — показывает ссылку.
 */
export function ShareButton({
  title,
  text,
  url,
  className,
  label = "Поделиться с командой",
}: {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");

  const share = useCallback(async () => {
    const target = url ?? (typeof window !== "undefined" ? window.location.href : "");
    const payload = { title, text: text ?? "", url: target };

    track("share_clicked", { hasUrl: Boolean(url) });

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch {
      // пользователь закрыл системное окно — это не ошибка
      return;
    }

    try {
      await navigator.clipboard.writeText(text ? `${title}\n${text}\n${target}` : `${title}\n${target}`);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2400);
    } catch {
      setState("manual");
      window.setTimeout(() => setState("idle"), 6000);
    }
  }, [text, title, url]);

  return (
    <button
      type="button"
      onClick={share}
      aria-live="polite"
      data-cursor="[ ОТПРАВИТЬ ]"
      className={cn(
        "btn-ghost inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em]",
        className,
      )}
    >
      {state === "copied" ? (
        <>
          <Check className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
          ссылка скопирована
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          {state === "manual" ? "скопируйте ссылку из адресной строки" : label}
        </>
      )}
    </button>
  );
}
