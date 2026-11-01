"use client";

import { InstallApp } from "@/components/install-app";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { CapturePanel } from "@/components/capture-panel";
import { CommandSearch } from "@/components/command-search";
import { QuickNote } from "@/components/quick-note";

const icons = {
  home: <><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="13" width="8" height="8" /></>,
  journal: <><path d="M5 3h11l3 3v15H5z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  research: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>,
  library: <><rect x="3" y="4" width="4" height="16" /><rect x="9" y="4" width="4" height="16" /><path d="M15.5 4.8l3.8-.9 3.2 15.3-3.8.9z" /></>,
  opportunities: <><path d="M4 20V5" /><path d="M4 5h11l-2 3.5 2 3.5H4" /><path d="M17 20h3" /></>,
  tenure: <><path d="M12 3l9 4.5-9 4.5-9-4.5z" /><path d="M6 9.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3V9.5" /><path d="M21 7.5V13" /></>,
  projects: <><path d="M3 7h7l2 2h9v11H3z" /><path d="M3 7V4h7l2 3" /></>,
  canvas: <><rect x="3" y="3" width="18" height="18" /><rect x="6" y="7" width="6" height="5" /><rect x="13" y="12" width="5" height="6" /></>,
};

// Each destination groups the routes that belong to it, so related pages share one menu item.
const navItems = [
  { href: "/", label: "Home", icon: icons.home, routes: [] as string[] },
  { href: "/journal", label: "Journal", icon: icons.journal, routes: ["/journal"] },
  { href: "/projects", label: "Projects", icon: icons.projects, routes: ["/projects"] },
  { href: "/boards", label: "Boards", icon: icons.canvas, routes: ["/boards"] },
  { href: "/library", label: "Library", icon: icons.library, routes: ["/library", "/discover", "/collections"] },
  { href: "/research", label: "Topics", icon: icons.research, routes: ["/research"] },
  { href: "/opportunities", label: "Practice", icon: icons.opportunities, routes: ["/opportunities", "/contacts", "/kit"] },
  { href: "/tenure", label: "Tenure", icon: icons.tenure, routes: ["/tenure"] },
];

// Collections are no longer linked from the menus; their pages still open from old links.
const sectionTabs = [
  { routes: ["/library", "/discover"], label: "Library sections", tabs: [{ href: "/library", label: "Library" }, { href: "/discover", label: "Discover" }] },
  { routes: ["/opportunities", "/contacts", "/kit"], label: "Practice sections", tabs: [{ href: "/opportunities", label: "Opportunities" }, { href: "/contacts", label: "Contacts" }, { href: "/kit", label: "Kit" }] },
  { routes: ["/tenure"], label: "Tenure sections", tabs: [{ href: "/tenure", label: "Dossier" }, { href: "/tenure/cv", label: "CV" }] },
];

const within = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

export function WorkspaceShell({
  children,
  userEmail,
  dueReminders = 0,
}: {
  children: React.ReactNode;
  userEmail?: string;
  dueReminders?: number;
}) {
  const pathname = usePathname();
  if (/^\/boards\/[^/]+$/.test(pathname)) return <>{children}</>;
  const section = sectionTabs.find(group => group.routes.some(route => within(pathname, route)));
  const activeTab = section?.tabs.filter(tab => within(pathname, tab.href)).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div className="workspace-shell"><a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <Link className="brand" href="/" aria-label="DWS Research home">
          <BrandMark className="brand-mark" title="DWS" />
          <span className="brand-subtitle">Research · Practice · Tenure</span>
        </Link>

        <nav className="primary-nav">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : item.routes.some(route => within(pathname, route));

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
                href={item.href}
                key={item.href}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{item.icon}</svg>
                <span>{item.label}</span>
                {item.href === "/" && dueReminders > 0 && <span className="nav-badge" aria-label={`${dueReminders} reminders due`}>{dueReminders}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <InstallApp />
          <span>{userEmail ?? "Authenticated workspace"}</span>
          <form action={signOut}>
            <button className="text-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <BrandMark className="mobile-brand" title="DWS Research" />
          {section ? (
            <nav className="section-tabs" aria-label={section.label}>
              {section.tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={tab === activeTab ? "page" : undefined}>{tab.label}</Link>)}
            </nav>
          ) : <p className="workspace-location">Dustin White Studio</p>}
          <div className="topbar-actions" aria-label="Global actions">
            <CommandSearch />
            <CapturePanel />
          </div>
        </header>

        <main id="workspace-content" className="content-wrap">{children}</main>
        <QuickNote />
      </div>
    </div>
  );
}
