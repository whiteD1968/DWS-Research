"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/projects", label: "Projects" },
  { href: "/research", label: "Research" },
  { href: "/atlas", label: "Atlas" },
  { href: "/collections", label: "Collections" },
  { href: "/boards", label: "Boards" },
  { href: "/library", label: "Library" },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="workspace-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <span className="brand-title">DWS Research</span>
          <span className="brand-subtitle">Architecture, references, and project knowledge.</span>
        </div>

        <nav className="primary-nav">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
                href={item.href}
                key={item.href}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          Initial workspace shell. Supabase clients are wired for browser and server use.
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="mobile-brand">DWS Research</div>
          <div className="topbar-actions" aria-label="Global actions">
            <button className="button" type="button">
              Ask
            </button>
            <button className="button button-primary" type="button">
              + Capture
            </button>
          </div>
        </header>

        <main className="content-wrap">{children}</main>
      </div>
    </div>
  );
}
