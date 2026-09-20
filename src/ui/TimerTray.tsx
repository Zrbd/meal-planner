// Feature 3: the timer tray. Timers live in the database, so they keep running while you are on
// the shopping list, while the phone is locked, and after the app is swiped away and reopened.
// The tray floats above the tab bar wherever you are in the app.
import { Pause, Play, Plus, Timer as TimerIcon, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_TIMERS, QUICK_TIMERS, formatLeft, isDone, isPaused, progress, remaining,
} from '../domain/timers';
import { nudgeTimer, pauseTimer, resumeTimer, startTimer, stopTimer } from '../services/timers';
import { Sheet } from './components';
import { useAppData } from './data';

/** One second tick, only while there is something to count down. */
function useSecond(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** A short double beep plus a buzz. No audio file: a tone the browser synthesizes. */
function alarm() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400]);
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const beep = (at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.5);
    };
    beep(0);
    beep(0.6);
    window.setTimeout(() => void ctx.close(), 2000);
  } catch {
    // An alarm that cannot make noise is not worth a crash.
  }
}

export function TimerTray() {
  const { timers } = useAppData();
  const now = useSecond(timers.length > 0);
  const [open, setOpen] = useState(false);
  const fired = useRef(new Set<string>());

  const done = useMemo(() => timers.filter((t) => isDone(t, now)), [timers, now]);

  useEffect(() => {
    for (const t of done) {
      if (fired.current.has(t.id)) continue;
      fired.current.add(t.id);
      alarm();
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(t.label, { body: 'Timer finished', tag: t.id });
        } catch {
          // Safari only allows notifications from the service worker in some versions.
        }
      }
    }
    // Forget timers that no longer exist, so a reused id can fire again.
    const live = new Set(timers.map((t) => t.id));
    for (const id of fired.current) if (!live.has(id)) fired.current.delete(id);
  }, [done, timers]);

  if (!timers.length) return null;

  const soonest = [...timers].sort((a, b) => remaining(a, now) - remaining(b, now))[0];
  const ringing = done.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`bottom-safe-tab fixed right-4 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition ${
          ringing ? 'animate-pulse bg-red-600 text-white' : 'bg-stone-900 text-white'
        }`}
      >
        <TimerIcon size={18} />
        <span className="tabular-nums">{formatLeft(remaining(soonest, now))}</span>
        {timers.length > 1 && <span className="text-xs opacity-70">+{timers.length - 1}</span>}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Timers">
        <ul className="space-y-2">
          {[...timers]
            .sort((a, b) => remaining(a, now) - remaining(b, now))
            .map((t) => {
              const over = isDone(t, now);
              return (
                <li key={t.id} className="card p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.label}</div>
                      <div className={`text-2xl font-bold tabular-nums ${over ? 'text-red-600' : ''}`}>
                        {formatLeft(remaining(t, now))}
                      </div>
                    </div>
                    <button className="icon-btn" aria-label={isPaused(t) ? 'Resume' : 'Pause'} onClick={() => void (isPaused(t) ? resumeTimer(t.id) : pauseTimer(t.id))}>
                      {isPaused(t) ? <Play size={20} /> : <Pause size={20} />}
                    </button>
                    <button className="icon-btn" aria-label="Stop" onClick={() => void stopTimer(t.id)}>
                      <X size={20} />
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-brand'}`}
                      style={{ width: `${Math.round(progress(t, now) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="chip" onClick={() => void nudgeTimer(t.id, -60)}>−1 min</button>
                    <button className="chip" onClick={() => void nudgeTimer(t.id, 60)}>+1 min</button>
                    <button className="chip" onClick={() => void nudgeTimer(t.id, 300)}>+5 min</button>
                  </div>
                </li>
              );
            })}
        </ul>
        {timers.length < MAX_TIMERS && <QuickAdd />}
      </Sheet>
    </>
  );
}

/** The add row, shared by the tray and cook mode. */
export function QuickAdd({ recipeId, suggestSec }: { recipeId?: string; suggestSec?: number } = {}) {
  const [custom, setCustom] = useState('');
  return (
    <div className="mt-4">
      <div className="label">{suggestSec ? 'Timers that keep running' : 'Start another'}</div>
      <div className="flex flex-wrap gap-2">
        {suggestSec ? (
          <button
            className="chip bg-stone-900 font-semibold text-white"
            onClick={() => void startTimer('This step', suggestSec, recipeId)}
          >
            {Math.round(suggestSec / 60)} min from this step
          </button>
        ) : null}
        {QUICK_TIMERS.map((q) => (
          <button key={q.label} className="chip" onClick={() => void startTimer(q.label, q.seconds, recipeId)}>
            {q.label}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const mins = Number(custom);
          if (mins > 0) void startTimer(`${mins} min`, Math.round(mins * 60), recipeId);
          setCustom('');
        }}
      >
        <input
          className="input"
          inputMode="decimal"
          placeholder="Minutes"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button className="btn btn-secondary" type="submit" aria-label="Start timer">
          <Plus size={18} />
        </button>
      </form>
    </div>
  );
}
