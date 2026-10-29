import { studioTimeZone, studioToday } from "@/lib/journal";

// A reminder is any note with metadata.remind_at; completing it sets metadata.done_at.
export type ReminderMeta = { remind_at?: string; done_at?: string };

export function parseRemindAt(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100 ? null : date.toISOString();
}

// Quick choices, computed in the browser's own time so "9am" means 9am where you are.
export function reminderPresets(now = new Date()) {
  const at = (days: number, hour: number) => { const date = new Date(now); date.setDate(date.getDate() + days); date.setHours(hour, 0, 0, 0); return date; };
  const laterToday = now.getHours() < 16 ? at(0, 17) : new Date(Math.ceil((now.getTime() + 3 * 3600000) / 3600000) * 3600000);
  const monday = at(((8 - now.getDay()) % 7) || 7, 9);
  return [
    { label: "In 1 hour", at: new Date(Math.ceil((now.getTime() + 3600000) / 900000) * 900000) },
    { label: "Later today", at: laterToday },
    { label: "Tomorrow 9am", at: at(1, 9) },
    { label: "Next Monday", at: monday },
  ];
}

const dayIn = (date: Date) => studioToday(date);

export function reminderBucket(remindAt: string, now = new Date()): "overdue" | "today" | "upcoming" {
  const due = new Date(remindAt);
  if (due.getTime() <= now.getTime()) return "overdue";
  return dayIn(due) === dayIn(now) ? "today" : "upcoming";
}

// Lists render on the server in studio time; the composer passes null for the browser's own zone so a chip reads back as picked.
export function formatReminder(remindAt: string, now = new Date(), zone: string | null = studioTimeZone) {
  const timeZone = zone ?? undefined;
  const due = new Date(remindAt);
  const time = due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const dayOf = (date: Date) => date.toLocaleDateString("en-CA", { timeZone });
  const today = dayOf(now); const day = dayOf(due);
  const tomorrow = dayOf(new Date(now.getTime() + 86400000)); const yesterday = dayOf(new Date(now.getTime() - 86400000));
  if (day === today) return `Today ${time}`;
  if (day === tomorrow) return `Tomorrow ${time}`;
  if (day === yesterday) return `Yesterday ${time}`;
  return `${due.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone })}, ${time}`;
}
