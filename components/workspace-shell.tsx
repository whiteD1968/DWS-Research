"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/projects", label: "Projects" },
  { href: "/research", label: "Research" },
  { href: "/atlas", label: "Atlas" },
  { href: "/collections", label: "Collections" },
  { href: "/boards", label: "Boards" },
  { href: "/library", label: "Library" },
];

export function WorkspaceShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string;
}) {
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
          <div className="mobile-brand">DWS Research</div>
          <div className="topbar-actions" aria-label="Global actions">
            <button className="button" type="button">
              Ask
            </button>
            <Link className="button button-primary" href="/library/references">
              + Capture
            </Link>
          </div>
        </header>

        <main className="content-wrap">{children}</main>
      </div>
    </div>
  );
}
