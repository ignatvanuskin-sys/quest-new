"use client";

import { useCallback, useRef, useState } from "react";

/* ───────────────────────────────────────────────────────────────────────────
   ПОЛЕ ТЕЛЕФОНА С МАСКОЙ И ЖЁСТКИМ ЛИМИТОМ

   Проблема, которую это решает: на телефоне человек набирает номер как привык —
   с восьмёркой, со скобками, с лишними цифрами, — и форма отклоняет заявку уже
   после отправки. Здесь номер приводится к формату +7 XXX XXX-XX-XX прямо
   во время ввода, а 12-я цифра просто не вводится.

   Что учтено:
   • любая первая цифра (7, 8 или сразу 9) приводится к коду +7;
   • вставка из буфера обрезается до 11 цифр;
   • Backspace работает как обычно, форматирование восстанавливается само;
   • курсор остаётся в конце — для телефона это ожидаемое поведение;
   • в форму уходит отформатированная строка, сервер по-прежнему проверяет
     11 цифр (нормализация уже есть в lib/utils.ts).
   ─────────────────────────────────────────────────────────────────────────── */

const MAX_DIGITS = 11;

/** Оставить только цифры, привести к 11 знакам с кодом 7 */
export function limitDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  // 8XXXXXXXXXX → 7XXXXXXXXXX, 9XXXXXXXXX → 79XXXXXXXXX
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  else if (digits.length > 0 && !digits.startsWith("7")) digits = `7${digits}`;

  return digits.slice(0, MAX_DIGITS);
}

/** 77773999843 → +7 777 399-98-43 (промежуточные состояния тоже форматируются) */
export function formatPhone(digits: string): string {
  if (!digits) return "";

  const rest = digits.slice(1);
  let out = "+7";

  if (rest.length > 0) out += ` ${rest.slice(0, 3)}`;
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;

  return out;
}

export function PhoneInput({
  id,
  value,
  onChange,
  invalid = false,
  describedBy,
  onComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Вызывается, когда номер набран полностью — удобно для подсказки «всё верно» */
  onComplete?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);

  const digits = limitDigits(value);
  const display = formatPhone(digits);
  const left = MAX_DIGITS - digits.length;

  const handleChange = useCallback(
    (raw: string) => {
      const nextDigits = limitDigits(raw);
      onChange(formatPhone(nextDigits));

      if (nextDigits.length === MAX_DIGITS) onComplete?.();

      // Держим курсор в конце: на телефоне номер набирают последовательно
      window.requestAnimationFrame(() => {
        const node = inputRef.current;
        if (node && document.activeElement === node) {
          const end = node.value.length;
          node.setSelectionRange(end, end);
        }
      });
    },
    [onChange, onComplete],
  );

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        maxLength={18}
        value={display}
        /* Обязательность телефона объявлена нативно: подпись помечена
           звёздочкой, и без этого атрибута поле для скринридера выглядит
           необязательным. */
        required
        /* Якорь для автоматической фокусировки после ошибки отправки */
        data-error-field="phone"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder="+7 777 000 00 00"
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(event) => {
          event.preventDefault();
          handleChange(event.clipboardData.getData("text"));
        }}
        className="field px-4 py-3.5 tabular-nums"
      />

      {/* Подсказка меняется по ходу ввода: человек всегда видит, сколько осталось,
          и не гадает, почему форма «не пускает» дальше */}
      <p
        id="hint-phone"
        className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ash-text"
      >
        {digits.length === MAX_DIGITS ? (
          <span className="text-crimson">номер готов · проверьте цифры</span>
        ) : focused || digits.length > 1 ? (
          <>осталось {left} {left === 1 ? "цифра" : left < 5 ? "цифры" : "цифр"}</>
        ) : (
          <>11 цифр: 8 или +7 в начале — не важно, приведём сами</>
        )}
      </p>
    </div>
  );
}
