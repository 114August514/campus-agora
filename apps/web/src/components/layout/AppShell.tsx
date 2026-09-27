import type { ReactNode } from "react";

interface AppShellProps {
  title: string;
  sidebarItems: readonly string[];
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
            <a href="/" key={item}>
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>身份、权限与认证外壳</span>
          {topbarContent}
        </header>
        {children}
      </main>
    </div>
  );
}
