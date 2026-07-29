// App shell: left sidebar (your "scrollmenu") + routed page content.
import { NavLink, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Companies from "./pages/Companies.jsx";
import Practice from "./pages/Practice.jsx";
import Settings from "./pages/Settings.jsx";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/companies", label: "Companies" },
  { to: "/practice", label: "Practice" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  return (
    <div className="flex min-h-screen">
      {/* ---- Sidebar ---- */}
      <aside className="w-60 shrink-0 border-r border-line bg-ink p-4 flex flex-col gap-1">
        <div className="mb-6 px-2">
          <h1 className="text-lg font-bold tracking-tight">
            Career<span className="text-accent">Pilot</span> AI
          </h1>
          <p className="text-xs text-soft">Your career copilot</p>
        </div>
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-surface text-accent font-medium" : "text-soft hover:bg-surface hover:text-slate-100"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </aside>

      {/* ---- Page content ---- */}
      <main className="flex-1 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
