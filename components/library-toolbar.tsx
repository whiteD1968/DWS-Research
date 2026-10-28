"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { libraryHref, type LibraryLayout, type LibraryState } from "@/lib/library";

type Option = { value: string; label: string };
const layoutLabels: Record<LibraryLayout, string> = { grid: "Grid", compact: "Compact", list: "List" };

export function LibraryToolbar({ state, tags, places }: { state: LibraryState; tags?: { id: string; name: string; count: number }[]; places?: { label: string; options: Option[] }[] }) {
  const router = useRouter();
  const active = state.tags || [];
  const layout = state.layout || "grid";
  // Changing a filter returns to the first page, since the old page number no longer means anything.
  const go = (next: Partial<LibraryState>) => libraryHref({ ...state, page: 1, ...next });
  return (
    <div className="library-toolbar">
      <div className="library-toolbar-row">
        <nav className="library-layouts" aria-label="Layout">
          {(Object.keys(layoutLabels) as LibraryLayout[]).map(item => <Link key={item} href={go({ layout: item })} aria-current={layout === item ? "page" : undefined}>{layoutLabels[item]}</Link>)}
        </nav>
        {places && places.some(group => group.options.length) && (
          <select className="library-within" aria-label="Show items used in" value={state.within || ""} onChange={event => router.push(go({ within: event.target.value || undefined }))}>
            <option value="">Used anywhere</option>
            {places.map(group => group.options.length > 0 && <optgroup key={group.label} label={group.label}>{group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}
          </select>
        )}
      </div>
      {tags && tags.length > 0 && (
        <nav className="library-tags" aria-label="Filter by tag">
          {tags.map(tag => {
            const on = active.includes(tag.id);
            return <Link key={tag.id} href={go({ tags: on ? active.filter(id => id !== tag.id) : [...active, tag.id] })} aria-pressed={on} className={on ? "library-tag library-tag-active" : "library-tag"}>{tag.name}<span>{tag.count}</span></Link>;
          })}
          {active.length > 0 && <Link className="library-tag-clear" href={go({ tags: [] })}>Clear tags</Link>}
        </nav>
      )}
    </div>
  );
}
