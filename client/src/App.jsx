// App shell: scrollable sidebar + top bar (theme toggle) + status dots footer.
// Responsive: sidebar on md+, horizontal nav bar on mobile.
import { useEffect, useState } from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Companies from "./pages/Companies.jsx";
import Practice from "./pages/Practice.jsx";
import Settings from "./pages/Settings.jsx";
import Profiling from "./pages/Profiling.jsx";
import { useAppStore } from "./store/useAppStore.js";

const icon = (d) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    {d}
  </svg>
);

const navItems = [
  { to: "/", label: "Home", end: true, icon: icon(<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />) },
  { to: "/companies", label: "Companies", icon: icon(<><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>) },
  { to: "/practice", label: "Practice", icon: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>) },
  { to: "/settings", label: "Settings", icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" /></>) },
];

function NavLinks({ collapsed = false, className = "" }) {
  return navItems.map(({ to, label, end, icon }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      title={label}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
          collapsed ? "justify-center !px-0" : ""
        } ${className} ${
          isActive ? "bg-accent/10 text-accent font-semibold" : "text-soft hover:bg-line/40 hover:text-strong"
        }`
      }
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  ));
}

// Minimal live status — blinking dots instead of a whole card.
function StatusDots({ compact = false }) {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    async function check() {
      try {
        const r = await fetch("/api/health");
        setHealth(await r.json());
      } catch {
        setHealth(false); // unreachable
      }
    }
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, []);

  const Dot = ({ ok, label }) => (
    <span className="flex items-center gap-1.5" title={label}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400 dot-live" : "bg-red-400"}`} />
      {!compact && <span className="text-[10px] text-soft">{label}</span>}
    </span>
  );

  return (
    <div className={`flex items-center gap-4 ${compact ? "flex-col gap-2.5 py-1" : ""}`}>
      <Dot ok={!!health} label="API" />
      <Dot ok={!!health?.groqKeyConfigured} label="AI" />
      <Dot ok={!!health?.mongoConnected} label="DB" />
    </div>
  );
}

function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-soft shadow-sm transition-all hover:text-strong hover:shadow"
    >
      {theme === "dark" ? (
        /* sun */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        /* moon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <div className="flex min-h-screen">
      {/* ---- Collapsible sidebar (md+), scrollable ---- */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface/60 p-3 backdrop-blur transition-all duration-300 md:flex ${
          collapsed ? "w-[64px]" : "w-56"
        }`}
      >
        <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
          {collapsed ? (
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-sm font-extrabold text-accent">C</span>
          ) : (
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">
                Career<span className="text-accent">Pilot</span>
              </h1>
              <p className="text-[11px] text-soft">Your career copilot</p>
            </div>
          )}
        </div>
        <NavLinks collapsed={collapsed} />
        {/* Collapse / expand slider control */}
        <button
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mt-4 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-soft transition-colors hover:bg-line/40 hover:text-strong ${
            collapsed ? "justify-center !px-0" : ""
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
            <path d="m15 6-6 6 6 6" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
        <div className={`mt-auto border-t border-line pt-3 ${collapsed ? "" : "px-1"}`}>
          <StatusDots compact={collapsed} />
        </div>
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: mobile nav + theme toggle */}
        <header className="flex items-center justify-between gap-2 px-4 pt-4 md:px-8">
          <div className="flex items-center gap-1 overflow-x-auto md:hidden">
            <span className="mr-2 text-sm font-extrabold tracking-tight">
              Career<span className="text-accent">Pilot</span>
            </span>
            <NavLinks className="whitespace-nowrap !px-2.5 !py-1.5 text-xs" />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 pb-6 pt-2 md:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profiling" element={<Profiling />} />
          </Routes>
        </main>

        {/* Mobile status footer */}
        <footer className="border-t border-line px-4 py-2 md:hidden">
          <StatusDots />
        </footer>
      </div>
    </div>
  );
}
