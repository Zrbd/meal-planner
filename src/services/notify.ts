// Phone notifications within what iPhone web apps allow: notifications + badge while the app runs
// (installed to the Home Screen, iOS 16.4+), and calendar reminders for anything scheduled.
import type { Alert } from '../domain/forecast';
import { buildICS, reminderEvents } from '../domain/ics';

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void>; standalone?: boolean };

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as BadgeNavigator).standalone === true;

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export async function setBadge(count: number): Promise<void> {
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    /* badging not allowed */
  }
}

const SENT_KEY = 'notify:sent';
const DAY = 86_400_000;
/** Kinds worth interrupting you for; "low" waits for the shopping list. */
const PUSH_KINDS = new Set(['expired', 'thaw', 'short', 'out', 'expiring', 'old']);

/** Notify about alerts not already notified in the last 2 days. */
export async function pushNewAlerts(alerts: Alert[], now = Date.now()): Promise<number> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return 0;
  let sent: Record<string, number> = {};
  try {
    sent = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}');
  } catch {
    /* fresh start */
  }
  for (const [id, at] of Object.entries(sent)) if (now - at > 2 * DAY) delete sent[id];
  const fresh = alerts.filter((a) => PUSH_KINDS.has(a.kind) && !sent[a.id]);
  if (!fresh.length) return 0;
  const reg = await navigator.serviceWorker.ready;
  const title = fresh.length === 1 ? fresh[0].title : `${fresh.length} things in your kitchen need attention`;
  const body = fresh.length === 1 ? fresh[0].detail : fresh.slice(0, 4).map((a) => `• ${a.title}`).join('\n');
  await reg.showNotification(title, { body, tag: 'kitchen-digest', icon: 'pwa-192x192.png' });
  for (const a of fresh) sent[a.id] = now;
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch {
    /* storage blocked */
  }
  return fresh.length;
}

/** Share a .ics file with the next week's thaw / cook / use-by / shopping reminders. */
export async function shareReminders(input: Parameters<typeof reminderEvents>[0]): Promise<'shared' | 'downloaded' | 'cancelled' | 'empty'> {
  const events = reminderEvents(input);
  if (!events.length) return 'empty';
  const file = new File([buildICS(events, Date.now())], 'meal-planner-reminders.ics', { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meal Planner reminders' });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
