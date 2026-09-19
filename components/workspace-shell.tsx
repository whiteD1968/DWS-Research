"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { CapturePanel } from "@/components/capture-panel";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/discover", label: "Discover" },
  { href: "/projects", label: "Projects" },
  { href: "/research", label: "Research" },
    { href: "/collections", label: "Collections" },
  { href: "/boards", label: "Boards" },
  { href: "/library", label: "Library" },
  { href: "/atlas", label: "Atlas · planned" },
];

export function WorkspaceShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname();
  if (/^\/boards\/[^/]+$/.test(pathname)) return <>{children}</>;

  return (
    <div className="workspace-shell"><a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <span className="brand-title">DWS Research</span>
          <span className="brand-subtitle">A studio for inquiry and design.</span>
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
          <div className="mobile-brand">DWS Research</div><p className="workspace-location">Research / Design / Practice</p>
          <div className="topbar-actions" aria-label="Global actions">
            <Link className="button" href="/discover">Search sources</Link>
            <CapturePanel />
          </div>
        </header>

        <main id="workspace-content" className="content-wrap">{children}</main>
      </div>
    </div>
  );
}
