import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { NavigationItem } from "../../features/auth/navigation";

interface AppShellProps {
  title: string;
  sidebarItems: readonly NavigationItem[];
  topbarContent?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  title,
  sidebarItems,
  topbarContent,
  children,
}: AppShellProps) {
  return (
    <div className="appShell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">{title}</div>
        <nav>
          {sidebarItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                isActive ? "navLink navLink-active" : "navLink"
              }
              key={item.label}
              to={item.to}
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>校园资料存档</span>
          {topbarContent}
        </header>
        {children}
      </main>
    </div>
  );
}
