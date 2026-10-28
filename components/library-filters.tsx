import Link from "next/link";
import { libraryHref, libraryLabels, libraryViews, type LibraryLayout, type LibraryView } from "@/lib/library";

export function LibraryFilters({ active, counts, search, layout }: { active: LibraryView; counts?: Partial<Record<LibraryView, number>>; search?: string; layout?: LibraryLayout }) {
  return (
    <nav className="library-filters" aria-label="Filter the library by type">
      {libraryViews.map(view => (
        <Link key={view} href={libraryHref({ view, q: search, layout })} aria-current={active === view ? "page" : undefined} className={active === view ? "library-filter library-filter-active" : "library-filter"}>
          {libraryLabels[view]}
          {counts?.[view] !== undefined && <span className="library-filter-count">{counts[view]}</span>}
        </Link>
      ))}
    </nav>
  );
}
