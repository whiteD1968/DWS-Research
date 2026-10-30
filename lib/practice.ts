import { cvCategory, type CvFields } from "@/lib/cv";
import { countdownLabel, daysUntil } from "@/lib/dossier";
import { isQuiet, type Contact } from "@/lib/contacts";
import { deadlineDays, stageOf, type Opportunity } from "@/lib/opportunities";

// Everything here is pure so the Home dashboard stays a thin page and the rules stay testable.

export type AgendaItem = { day: string; kind: "deadline" | "follow_up" | "review"; title: string; detail: string; href: string; overdue: boolean };

const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// The next two weeks of dated commitments. Follow-ups that slipped stay at the top until they're logged or moved;
// a deadline that passed is the board's business, not the week's.
export function agenda({ opportunities, contacts, reviewDate, today, days = 14 }: { opportunities: Opportunity[]; contacts: Contact[]; reviewDate: string; today: string; days?: number }) {
  const items: AgendaItem[] = [];
  for (const item of opportunities) {
    if (!item.deadline || stageOf(item.status) === "submitted" || stageOf(item.status) === "decided") continue;
    const left = deadlineDays(item.deadline, today);
    if (left < 0 || left > days) continue;
    const ready = item.materials.filter(material => material.done).length;
    items.push({ day: item.deadline, kind: "deadline", title: item.title, detail: [item.organization, item.materials.length ? `${ready}/${item.materials.length} materials ready` : ""].filter(Boolean).join(" · "), href: `/opportunities?o=${item.id}`, overdue: false });
  }
  for (const contact of contacts) {
    if (!contact.followUp) continue;
    const left = daysUntil(contact.followUp, today);
    if (left > days) continue;
    items.push({ day: left < 0 ? today : contact.followUp, kind: "follow_up", title: contact.name, detail: left < 0 ? `Follow-up was due ${shortDay(contact.followUp)}` : contact.organization || "Follow up", href: `/contacts?c=${contact.id}`, overdue: left < 0 });
  }
  if (reviewDate) {
    const left = daysUntil(reviewDate, today);
    if (left >= 0 && left <= days) items.push({ day: reviewDate, kind: "review", title: "Tenure review", detail: "Dossier due", href: "/tenure", overdue: false });
  }
  const order = { review: 0, deadline: 1, follow_up: 2 };
  items.sort((a, b) => a.day.localeCompare(b.day) || Number(b.overdue) - Number(a.overdue) || order[a.kind] - order[b.kind] || a.title.localeCompare(b.title));
  const groups: { day: string; label: string; items: AgendaItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.day === item.day) last.items.push(item);
    else groups.push({ day: item.day, label: dayLabel(item.day, today), items: [item] });
  }
  return groups;
}

export function dayLabel(day: string, today: string) {
  const left = daysUntil(day, today);
  return left === 0 ? "Today" : left === 1 ? "Tomorrow" : shortDay(day);
}

export type Glance = {
  applications: { active: number; waiting: number; next: Opportunity | null; nextLabel: string };
  people: { due: number; quiet: number; total: number };
  tenure: { days: number | null; label: string; written: number; sections: number; evidence: number };
  year: { label: string; logged: number; accepted: number; top: string };
};

export function glance({ opportunities, contacts, reviewDate, statements, evidence, cv, today }: { opportunities: Opportunity[]; contacts: Contact[]; reviewDate: string; statements: string[]; evidence: number; cv: (Pick<CvFields, "category" | "date">)[]; today: string }): Glance {
  const year = today.slice(0, 4);
  const open = opportunities.filter(item => item.status === "interested" || item.status === "preparing");
  const next = open.filter(item => item.deadline && item.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title))[0] ?? null;
  const left = next ? deadlineDays(next.deadline, today) : 0;
  const thisYear = cv.filter(entry => entry.date.startsWith(year));
  const counts = new Map<string, number>();
  for (const entry of thisYear) counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  const [topKey, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
  const days = reviewDate ? daysUntil(reviewDate, today) : null;
  return {
    applications: {
      active: opportunities.filter(item => item.status === "preparing" || item.status === "submitted").length,
      waiting: opportunities.filter(item => item.status === "submitted").length,
      next,
      nextLabel: !next ? "" : left === 0 ? "Due today" : left === 1 ? "Due tomorrow" : left < 14 ? `${left} days left` : `Due ${new Date(`${next.deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`,
    },
    people: {
      due: contacts.filter(contact => contact.followUp && contact.followUp <= today).length,
      quiet: contacts.filter(contact => contact.log.length && isQuiet(contact, today)).length,
      total: contacts.length,
    },
    tenure: { days, label: days === null ? "" : countdownLabel(days), written: statements.filter(text => text.trim()).length, sections: 3, evidence },
    year: {
      label: year,
      logged: thisYear.length,
      accepted: opportunities.filter(item => item.status === "accepted" && (item.decidedAt || item.deadline).startsWith(year)).length,
      top: topKey && topCount ? `${topCount} ${topCount === 1 ? cvCategory(topKey as CvFields["category"]).one.toLowerCase() : cvCategory(topKey as CvFields["category"]).label.toLowerCase()}` : "",
    },
  };
}

// One plain sentence under the page title, so the day's shape reads before any card does.
export function summaryLine(groups: ReturnType<typeof agenda>, today: string) {
  const items = groups.flatMap(group => group.items);
  const week = items.filter(item => daysUntil(item.day, today) <= 6);
  const deadlines = week.filter(item => item.kind === "deadline").length;
  const followUps = week.filter(item => item.kind === "follow_up").length;
  const review = week.some(item => item.kind === "review");
  const parts = [
    review ? "your tenure review" : "",
    deadlines ? `${deadlines === 1 ? "one deadline" : `${words(deadlines)} deadlines`}` : "",
    followUps ? `${followUps === 1 ? "one person" : `${words(followUps)} people`} to follow up with` : "",
  ].filter(Boolean);
  if (!parts.length) return items.length ? "A clear week. The next thing on the calendar is further out." : "A clear week. Nothing on the calendar for the next two weeks.";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `This week: ${list}.`;
}

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n: number) => numberWords[n] ?? String(n);

export type RecentItem = { at: string; kind: "cv" | "journal" | "accepted" | "contact"; title: string; detail: string; href: string };

export function recentWork(items: RecentItem[], limit = 6) {
  return [...items].filter(item => item.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
