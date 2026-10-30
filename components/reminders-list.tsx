"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeReminder, rescheduleReminder } from "@/app/(workspace)/journal/actions";
import { formatReminder, reminderBucket, reminderPresets } from "@/lib/reminders";

export type Reminder = { id: string; title: string; text: string; remindAt: string };
const bucketLabels = { overdue: "Overdue", today: "Today", upcoming: "Upcoming" } as const;

export function RemindersList({ reminders }: { reminders: Reminder[] }) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>([]);
  const [snoozing, setSnoozing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function act(id: string, task: () => Promise<unknown>) {
    setError("");
    start(async () => {
      try { await task(); router.refresh(); }
      catch (failure) { setDone(current => current.filter(item => item !== id)); setError(failure instanceof Error ? failure.message : "Could not update that reminder."); }
    });
  }
  // The check animates first, then the row leaves once the server confirms.
  const complete = (id: string) => { setDone(current => [...current, id]); act(id, () => completeReminder(id)); };
  const snooze = (id: string, at: Date) => { setSnoozing(null); act(id, () => rescheduleReminder(id, at.toISOString())); };

  if (!reminders.length) return null;
  const groups = (["overdue", "today", "upcoming"] as const).map(bucket => ({ bucket, items: reminders.filter(item => reminderBucket(item.remindAt) === bucket) })).filter(group => group.items.length);

  return <div className="reminders" aria-label="Reminders">
    <p className="eyebrow">Reminders</p>
    {groups.map(group => <section key={group.bucket} className={`reminders-group reminders-${group.bucket}`}>
      <h3>{bucketLabels[group.bucket]}<span>{group.items.length}</span></h3>
      <ul>{group.items.map(item => {
        const checked = done.includes(item.id);
        return <li key={item.id} className={checked ? "reminder reminder-done" : "reminder"}>
          <button type="button" className="reminder-check" aria-label={`Mark “${item.title || item.text}” done`} aria-pressed={checked} disabled={checked} onClick={() => complete(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" /></svg></button>
          <Link href={`/library/items/note/${item.id}`} className="reminder-body"><strong>{item.title || item.text}</strong>{item.title && item.text && <span>{item.text}</span>}</Link>
          <span className="reminder-when">{formatReminder(item.remindAt)}</span>
          <div className="reminder-snooze">
            <button type="button" className="text-button" aria-expanded={snoozing === item.id} disabled={checked} onClick={() => setSnoozing(current => current === item.id ? null : item.id)}>Snooze</button>
            {snoozing === item.id && <div className="reminder-snooze-menu" role="menu">{reminderPresets().map(preset => <button key={preset.label} type="button" role="menuitem" onClick={() => snooze(item.id, preset.at)}>{preset.label}</button>)}</div>}
          </div>
        </li>;
      })}</ul>
    </section>)}
    {error && <p className="reminders-error" role="alert">{error}</p>}
  </div>;
}
