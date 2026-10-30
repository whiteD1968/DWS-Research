import { agenda } from "@/lib/practice";
import { studioToday } from "@/lib/journal";
import type { Contact } from "@/lib/contacts";
import type { Opportunity } from "@/lib/opportunities";
import type { Lead } from "@/lib/opportunity-scout";

// The morning email: what's due today, the week's deadlines, people to follow up with, and new scout leads.

export const digestParent = "digest_settings";
export const digestHour = 7;
export type DigestSettings = { enabled: boolean; email: string; lastSent: string };
const emailPattern = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function parseEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 254 && emailPattern.test(email) ? email : "";
}
export function digestSettingsFrom(meta: unknown, fallbackEmail = ""): DigestSettings {
  const m = (meta || {}) as Record<string, unknown>;
  return { enabled: m.enabled === true, email: parseEmail(m.email) || parseEmail(fallbackEmail), lastSent: typeof m.last_sent === "string" ? m.last_sent : "" };
}

// Vercel cron runs in UTC, so the job is scheduled for both 7am EDT and 7am EST and only sends on the one that is 7am in New York.
export function digestDue(settings: DigestSettings, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now));
  return settings.enabled && !!settings.email && hour === digestHour && settings.lastSent !== studioToday(now);
}

export type ReminderRow = { id: string; title: string | null; plain_text: string | null; parent_type: string | null; metadata: unknown };
type Line = { title: string; detail: string; href: string };
export type Digest = { subject: string; html: string; text: string; sections: { heading: string; lines: Line[] }[] };

const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export function buildDigest({ reminders, opportunities, contacts, leads, reviewDate, baseUrl, now = new Date(), quiet = false }: { reminders: ReminderRow[]; opportunities: Opportunity[]; contacts: Contact[]; leads: Lead[]; reviewDate: string; baseUrl: string; now?: Date; quiet?: boolean }): Digest | null {
  const today = studioToday(now);
  const groups = agenda({ opportunities, contacts, reviewDate, today, days: 7 });
  const items = groups.flatMap(group => group.items.map(item => ({ ...item, label: group.label })));

  // Opportunity and contact reminders are covered by the deadline and follow-up lists below.
  const due = reminders.flatMap(row => {
    const meta = (row.metadata || {}) as { remind_at?: unknown; done_at?: unknown };
    if (typeof meta.remind_at !== "string" || meta.done_at || row.parent_type === "opportunity" || row.parent_type === "contact") return [];
    const at = Date.parse(meta.remind_at);
    if (Number.isNaN(at) || studioToday(new Date(at)) > today) return [];
    const late = studioToday(new Date(at)) < today;
    return [{ at, line: { title: row.title || (row.plain_text || "").slice(0, 120) || "Reminder", detail: late ? `Overdue since ${shortDate(studioToday(new Date(at)))}` : timeOf(meta.remind_at), href: `${baseUrl}/library/items/note/${row.id}` } }];
  }).sort((a, b) => a.at - b.at).map(item => item.line);

  const deadlines = items.filter(item => item.kind === "deadline").map(item => ({ title: item.title, detail: [item.label, item.detail].filter(Boolean).join(" · "), href: baseUrl + item.href }));
  const followUps = items.filter(item => item.kind === "follow_up" && (item.overdue || item.day === today)).map(item => ({ title: item.title, detail: item.detail, href: baseUrl + item.href }));
  const review = items.find(item => item.kind === "review");
  const since = now.getTime() - 26 * 3600000;
  const fresh = leads.filter(lead => Date.parse(lead.foundAt) >= since).slice(0, 5).map(lead => ({ title: lead.title, detail: [lead.source, lead.deadline ? `Due ${shortDate(lead.deadline)}` : ""].filter(Boolean).join(" · "), href: `${baseUrl}/opportunities` }));

  const sections = [
    { heading: "Today", lines: due },
    { heading: "Deadlines this week", lines: deadlines },
    { heading: "Follow up", lines: followUps },
    { heading: "New leads from the scout", lines: fresh },
  ].filter(section => section.lines.length);
  if (review) sections.unshift({ heading: "Tenure review", lines: [{ title: `Your review is ${review.label === "Today" ? "today" : review.label === "Tomorrow" ? "tomorrow" : `on ${shortDate(review.day)}`}`, detail: "Dossier due", href: `${baseUrl}/tenure` }] });
  // Quiet mornings send nothing, except a test, which says so.
  if (!sections.length && !quiet) return null;
  if (!sections.length) sections.push({ heading: "Today", lines: [{ title: "Nothing due. A clear morning.", detail: "No reminders, deadlines this week, follow-ups, or new leads.", href: `${baseUrl}/` }] });

  const counts = [
    due.length ? `${due.length} ${due.length === 1 ? "reminder" : "reminders"}` : "",
    deadlines.length ? `${deadlines.length} ${deadlines.length === 1 ? "deadline" : "deadlines"} this week` : "",
    followUps.length ? `${followUps.length} to follow up` : "",
    fresh.length ? `${fresh.length} new ${fresh.length === 1 ? "lead" : "leads"}` : "",
  ].filter(Boolean);
  const dayName = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const subject = review && daysAway(review.day, today) <= 3 ? `${dayName}: tenure review ${review.label === "Today" ? "today" : "soon"}${counts.length ? ` · ${counts.join(" · ")}` : ""}` : `${dayName}: ${counts.join(" · ") || "your morning"}`;
  return { subject, sections, text: digestText(dayName, sections, baseUrl), html: digestHtml(dayName, sections, baseUrl) };
}
const daysAway = (day: string, today: string) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);

function digestText(dayName: string, sections: Digest["sections"], baseUrl: string) {
  return [`Good morning. Here's ${dayName}.`, "", ...sections.flatMap(section => [section.heading.toUpperCase(), ...section.lines.map(line => `- ${line.title}${line.detail ? ` (${line.detail})` : ""}\n  ${line.href}`), ""]), `Open the dashboard: ${baseUrl}/`, "", "You get this because the morning email is on. Turn it off from Home → Morning email."].join("\n");
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Inline styles and a single table column, so it reads the same in Gmail, Apple Mail, and Outlook.
function digestHtml(dayName: string, sections: Digest["sections"], baseUrl: string) {
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const body = sections.map(section => `<tr><td style="padding:22px 0 6px;${font};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5e5b55">${escapeHtml(section.heading)}</td></tr>${section.lines.map(line => `<tr><td style="padding:10px 0;border-top:1px solid #e4e0d8;${font}"><a href="${escapeHtml(line.href)}" style="font-size:16px;font-weight:600;color:#121212;text-decoration:none">${escapeHtml(line.title)}</a>${line.detail ? `<div style="font-size:13px;color:#5e5b55;margin-top:3px">${escapeHtml(line.detail)}</div>` : ""}</td></tr>`).join("")}`).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f4ef"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e0d8;border-radius:14px"><tr><td style="padding:28px 28px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="${font};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#2b44e8">DWS Research</td></tr><tr><td style="padding-top:6px;${font};font-size:24px;font-weight:650;letter-spacing:-.02em;color:#121212">${escapeHtml(dayName)}</td></tr>${body}<tr><td style="padding-top:26px"><a href="${escapeHtml(baseUrl)}/" style="display:inline-block;padding:11px 18px;border-radius:999px;background:#2b44e8;color:#ffffff;${font};font-size:14px;font-weight:600;text-decoration:none">Open the dashboard</a></td></tr></table></td></tr></table><p style="${font};font-size:12px;color:#8c887f;margin:16px 0 0">You get this because the morning email is on. Turn it off from Home → Morning email.</p></td></tr></table></body></html>`;
}
