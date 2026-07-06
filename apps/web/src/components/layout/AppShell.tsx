import type { ReactNode } from "react";

interface AppShellProps {
  title: string;
  sidebarItems: string[];
  children: ReactNode;
}

export function AppShell({ title, sidebarItems, children }: AppShellProps) {
  return (
    <div className="appShell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">{title}</div>
        <nav>
          {sidebarItems.map((item) => (
            <a href="/" key={item}>
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>Repository Skeleton</span>
        </header>
        {children}
      </main>
    </div>
  );
}
