"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { CapturePanel } from "@/components/capture-panel";
import { CommandSearch } from "@/components/command-search";

const icons = {
  home: <><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="13" width="8" height="8" /></>,
  research: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>,
  library: <><rect x="3" y="4" width="4" height="16" /><rect x="9" y="4" width="4" height="16" /><path d="M15.5 4.8l3.8-.9 3.2 15.3-3.8.9z" /></>,
  canvas: <><rect x="3" y="3" width="18" height="18" /><rect x="6" y="7" width="6" height="5" /><rect x="13" y="12" width="5" height="6" /></>,
};

// Each destination groups the routes that belong to it, so related pages share one menu item.
const navItems = [
  { href: "/", label: "Home", icon: icons.home, routes: [] as string[] },
  { href: "/research", label: "Research", icon: icons.research, routes: ["/research", "/projects"] },
  { href: "/library", label: "Library", icon: icons.library, routes: ["/library", "/collections", "/discover"] },
  { href: "/boards", label: "Canvas", icon: icons.canvas, routes: ["/boards"] },
];

const sectionTabs = [
  { routes: ["/research", "/projects"], label: "Research sections", tabs: [{ href: "/research", label: "Topics" }, { href: "/projects", label: "Projects" }] },
  { routes: ["/library", "/collections", "/discover"], label: "Library sections", tabs: [{ href: "/library", label: "Library" }, { href: "/collections", label: "Collections" }, { href: "/discover", label: "Discover" }] },
];

const within = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

export function WorkspaceShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string;
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
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
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
      </div>
    </div>
  );
}
