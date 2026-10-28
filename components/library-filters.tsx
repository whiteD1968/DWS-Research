import Link from "next/link";
import { libraryLabels, libraryViews, type LibraryView } from "@/lib/library";

export function LibraryFilters({ active, counts, search }: { active: LibraryView; counts?: Partial<Record<LibraryView, number>>; search?: string }) {
  return (
    <nav className="library-filters" aria-label="Filter the library by type">
      {libraryViews.map(view => {
        const params = new URLSearchParams(view === "all" ? {} : { view });
        if (search) params.set("q", search);
        const query = params.toString();
        return (
          <Link key={view} href={query ? `/library?${query}` : "/library"} aria-current={active === view ? "page" : undefined} className={active === view ? "library-filter library-filter-active" : "library-filter"}>
            {libraryLabels[view]}
            {counts?.[view] !== undefined && <span className="library-filter-count">{counts[view]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
