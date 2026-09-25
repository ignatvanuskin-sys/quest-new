"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/* ───────────────────────────────────────────────────────────────────────────
   Атмосферный звук — процедурный (WebAudio), без аудиофайлов.

   Почему так: 30 секунд mp3-«дрона» весят больше, чем вся остальная графика,
   а синтез даёт бесконечную, не повторяющуюся атмосферу бесплатно.

   Жёсткие правила:
   • звук НИКОГДА не включается сам — только по клику пользователя;
   • по умолчанию выключен на всех устройствах, включая мобильные;
   • на мобильном управление вынесено в меню, потому что плавающая кнопка
     там мешала бы контенту.
   ─────────────────────────────────────────────────────────────────────────── */

function useAmbientSound() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const AudioCtor =
      typeof window !== "undefined"
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AudioCtor) setSupported(false);
  }, []);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = ctxRef.current ?? new AudioCtor();
    ctxRef.current = ctx;
    void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // Медленный «вдох» громкости — звук не бьёт в уши при включении
    master.gain.linearRampToValueAtTime(0.085, ctx.currentTime + 3);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 240;
    lowpass.Q.value = 0.7;
    lowpass.connect(master);

    // Два расстроенных осциллятора = гудящий подвал
    const oscillators: OscillatorNode[] = [];
    [
      { freq: 43.65, type: "sine" as OscillatorType, gain: 0.55 },
      { freq: 65.41, type: "triangle" as OscillatorType, gain: 0.22 },
      { freq: 87.31, type: "sine" as OscillatorType, gain: 0.1 },
    ].forEach(({ freq, type, gain }) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const oscGain = ctx.createGain();
      oscGain.gain.value = gain;
      osc.connect(oscGain).connect(lowpass);
      osc.start();
      oscillators.push(osc);
    });

    // Дыхание: очень медленная модуляция фильтра
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(lowpass.frequency);
    lfo.start();

    // Редкие скрипы: отфильтрованный шум с короткой огибающей
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    let creepTimer = 0;
    const scheduleCreep = () => {
      creepTimer = window.setTimeout(
        () => {
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer;
          const bandpass = ctx.createBiquadFilter();
          bandpass.type = "bandpass";
          bandpass.frequency.value = 600 + Math.random() * 1400;
          bandpass.Q.value = 9;
          const gain = ctx.createGain();
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.5, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
          source.connect(bandpass).connect(gain).connect(master);
          source.start(now);
          source.stop(now + 1.6);
          scheduleCreep();
        },
        4000 + Math.random() * 9000,
      );
    };
    scheduleCreep();

    // Сердцебиение: редкие двойные удары, чтобы пульс не был предсказуемым
    const thump = (when: number, level: number, freq: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, when);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, when + 0.28);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(level, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, when + 0.5);
      osc.connect(gain).connect(master);
      osc.start(when);
      osc.stop(when + 0.55);
    };

    let heartbeatTimer = 0;
    const scheduleHeartbeat = () => {
      heartbeatTimer = window.setTimeout(
        () => {
          const start = ctx.currentTime + 0.05;
          thump(start, 0.5, 58);
          thump(start + 0.34, 0.34, 52);
          scheduleHeartbeat();
        },
        13000 + Math.random() * 11000,
      );
    };
    scheduleHeartbeat();

    // Jump scare на экране подкрепляем глухим ударом — только если звук уже включён
    const onScare = () => thump(ctx.currentTime + 0.01, 0.62, 74);
    window.addEventListener("hc:scare", onScare);

    stopRef.current = () => {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(0, now + 0.6);
      window.clearTimeout(creepTimer);
      window.clearTimeout(heartbeatTimer);
      window.removeEventListener("hc:scare", onScare);
      window.setTimeout(() => {
        oscillators.forEach((osc) => {
          try {
            osc.stop();
          } catch {
            /* уже остановлен */
          }
        });
        lfo.stop();
        master.disconnect();
      }, 700);
    };
  }, []);

  const toggle = useCallback(() => {
    if (enabled) {
      stop();
      setEnabled(false);
    } else {
      start();
      setEnabled(true);
    }
  }, [enabled, start, stop]);

  return { enabled, supported, toggle };
}

/** Плавающая кнопка звука — только на десктопе, где она не мешает контенту */
export function SoundToggle() {
  const { enabled, supported, toggle } = useAmbientSound();

  if (!supported) return null;

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "Выключить атмосферный звук" : "Включить атмосферный звук"}
      data-cursor={enabled ? "[ ТИШИНА ]" : "[ ЗВУК ]"}
      onClick={toggle}
      className="fixed bottom-4 left-4 z-[66] hidden min-h-[40px] items-center gap-2 border border-bone/20 bg-ink/80 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-bone-dim backdrop-blur transition hover:border-crimson/60 hover:text-bone md:flex"
    >
      {enabled ? (
        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {enabled ? "Звук включён" : "Звук выключен"}
    </button>
  );
}

/** Строка звука внутри мобильного меню: там кнопка всегда под рукой */
export function SoundRow() {
  const { enabled, supported, toggle } = useAmbientSound();

  if (!supported) return null;

  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={toggle}
      className="flex min-h-[52px] w-full items-center justify-between gap-4 border border-bone/20 px-5 py-3 text-left"
    >
      <span className="flex items-center gap-3">
        {enabled ? (
          <Volume2 className="h-4 w-4 text-crimson" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4 text-bone-dim" aria-hidden="true" />
        )}
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bone-dim">
          Атмосферный звук
        </span>
      </span>
      <span className="flex items-center gap-3">
        {/* Текстовое состояние нужно и зрячему пользователю: один только
            переключатель без подписи не говорит, включён звук или нет */}
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
            enabled ? "text-crimson" : "text-ash-text"
          }`}
        >
          {enabled ? "вкл" : "выкл"}
        </span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 border transition ${
          enabled ? "border-crimson bg-blood-deep/60" : "border-bone/25 bg-ink"
        }`}
      >
          <span
            className={`absolute top-0.5 h-4 w-4 transition-all duration-300 ${
              enabled ? "left-[26px] bg-crimson" : "left-0.5 bg-steel"
            }`}
          />
        </span>
      </span>
    </button>
  );
}
