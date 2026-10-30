// Turns the rows calendar_feed() returns into an iCalendar file that Google, Apple, and Outlook can subscribe to.

export const calendarParent = "calendar_settings";
export const calendarTokenPattern = /^[A-Za-z0-9_-]{32,64}$/;

export type FeedRow = { id: string | null; kind: string; title: string | null; detail: string | null; day: string | null; at: string | null; status: string | null; updated_at: string | null };
type FeedEvent = { uid: string; summary: string; description: string; url: string; stamp: Date } & ({ day: string } | { at: Date });

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (value: unknown): value is string => typeof value === "string" && isoDay.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export function newCalendarToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function feedEvents(rows: FeedRow[], baseUrl: string, now = new Date()): FeedEvent[] {
  // Keep a month of history so a just-missed item doesn't vanish, without growing the feed forever.
  const since = new Date(now.getTime() - 31 * 86400000);
  const sinceDay = since.toISOString().slice(0, 10);
  const events: FeedEvent[] = [];
  for (const row of rows) {
    if (!row.id) continue;
    const stamp = row.updated_at && !Number.isNaN(Date.parse(row.updated_at)) ? new Date(row.updated_at) : now;
    const title = (row.title || "").trim();
    const detail = (row.detail || "").trim();
    if (row.kind === "deadline" && validDay(row.day) && row.day >= sinceDay) {
      events.push({ uid: `deadline-${row.id}`, day: row.day, summary: `Deadline: ${title || "Opportunity"}`, description: [detail, row.status === "preparing" ? "Preparing" : "Interested"].filter(Boolean).join(" · "), url: `${baseUrl}/opportunities?o=${row.id}`, stamp });
    } else if (row.kind === "follow_up" && validDay(row.day) && row.day >= sinceDay) {
      events.push({ uid: `follow-up-${row.id}`, day: row.day, summary: `Follow up: ${title || "Contact"}`, description: detail, url: `${baseUrl}/contacts?c=${row.id}`, stamp });
    } else if (row.kind === "review" && validDay(row.day)) {
      events.push({ uid: `review-${row.id}`, day: row.day, summary: "Tenure review", description: "Dossier due", url: `${baseUrl}/tenure`, stamp });
    } else if (row.kind === "reminder" && row.at && !Number.isNaN(Date.parse(row.at)) && new Date(row.at) >= since) {
      events.push({ uid: `reminder-${row.id}`, at: new Date(row.at), summary: title || "Reminder", description: detail, url: `${baseUrl}/library/items/note/${row.id}`, stamp });
    }
  }
  return events.sort((a, b) => eventKey(a).localeCompare(eventKey(b)));
}
const eventKey = (event: FeedEvent) => ("day" in event ? `${event.day}T00:00:00.000Z` : event.at.toISOString());

export function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// RFC 5545 lines stop at 75 octets; continuation lines start with a space. Split on code points so emoji survive.
export function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = ""; let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > (parts.length ? 74 : 75)) { parts.push(current); current = ""; size = 0; }
    current += char; size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const stampOf = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dayValue = (day: string) => day.replace(/-/g, "");
const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

export function toIcs(events: FeedEvent[], host: string) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DWS Research//Practice calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:DWS Research", "X-WR-TIMEZONE:America/New_York", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${event.uid}@${host}`, `DTSTAMP:${stampOf(event.stamp)}`);
    if ("day" in event) lines.push(`DTSTART;VALUE=DATE:${dayValue(event.day)}`, `DTEND;VALUE=DATE:${dayValue(nextDay(event.day))}`, "TRANSP:TRANSPARENT");
    else lines.push(`DTSTART:${stampOf(event.at)}`, "DURATION:PT15M");
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    lines.push(`URL:${event.url}`);
    if (!("day" in event)) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.summary)}`, "TRIGGER:PT0S", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
