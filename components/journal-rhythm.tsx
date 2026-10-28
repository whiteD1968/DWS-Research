import { formatDay, rhythmWeeks } from "@/lib/journal";

// A quiet record of the days you wrote or sketched; darker squares mean more entries that day.
export function JournalRhythm({ counts, today, weeks = 20 }: { counts: Map<string, number>; today: string; weeks?: number }) {
  const grid = rhythmWeeks(today, weeks);
  const days = grid.flat().filter((day): day is string => !!day && (counts.get(day) || 0) > 0).length;
  const month = today.slice(0, 7);
  const thisMonth = [...counts.keys()].filter(day => day.startsWith(month)).length;
  return (
    <section className="journal-rhythm" aria-label="Journal rhythm">
      <div className="journal-rhythm-text"><p className="eyebrow">Rhythm</p><p><strong>{thisMonth}</strong> {thisMonth === 1 ? "day" : "days"} this month · {days} in the last {weeks} weeks</p></div>
      <div className="journal-rhythm-grid" role="img" aria-label={`${days} journal days in the last ${weeks} weeks`}>
        {grid.map((week, index) => <div key={index} className="journal-rhythm-week">{week.map((day, slot) => {
          const count = day ? counts.get(day) || 0 : 0;
          return <span key={slot} className={`journal-rhythm-day${day ? "" : " journal-rhythm-future"}${day === today ? " journal-rhythm-today" : ""}`} data-level={Math.min(count, 3)} title={day ? `${formatDay(day)}: ${count} ${count === 1 ? "entry" : "entries"}` : undefined} />;
        })}</div>)}
      </div>
    </section>
  );
}
