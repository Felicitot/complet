import { Wind, CloudRain, Waves, Thermometer, Satellite, AlertTriangle, LayoutDashboard, Archive, ListChecks, Settings, HelpCircle, Lock, LogOut } from "lucide-react";
import { useAppData } from "../context/AppDataContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const CATEGORY_ICONS = { vent: Wind, pluies: CloudRain, houles: Waves, temperatures: Thermometer, satellites: Satellite, previsions_specifiques: AlertTriangle };

export const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/archives", label: "Archives", icon: Archive },
  { path: "/taches", label: "Scripts & Tâches", icon: ListChecks, admin: true },
  { path: "/parametres", label: "Paramètres", icon: Settings, admin: true },
  { path: "/aide", label: "Aide", icon: HelpCircle },
];

export default function Sidebar({ route, onCategory }) {
  const { categories } = useAppData();
  const { isAdmin, logout } = useAuth();

  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-line bg-paper md:flex">
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        <ul className="space-y-0.5">
          {NAV.map(({ path, label, icon: Icon, admin }) => {
            const active = route === path;
            return (
              <li key={path}>
                <a
                  href={`#${path}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-navy/5 font-medium text-navy" : "text-ink/80 hover:bg-canvas"}`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={17} />
                    {label}
                  </span>
                  {admin && !isAdmin && <Lock size={12} className="text-inkmuted/60" aria-label="Accès administrateur" />}
                </a>
              </li>
            );
          })}
        </ul>

        {categories.length > 0 && (
          <>
            <p className="mt-6 px-3 text-xs uppercase tracking-wide text-inkmuted/70">Aller à</p>
            <ul className="mt-1 space-y-0.5">
              {categories.map((c) => {
                const Icon = CATEGORY_ICONS[c.id] || LayoutDashboard;
                return (
                  <li key={c.id}>
                    <button onClick={() => onCategory(c.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink/80 transition-colors hover:bg-canvas">
                      <Icon size={16} style={{ color: c.color }} />
                      {c.label.split(" / ")[0]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {isAdmin && (
        <div className="border-t border-line p-3">
          <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-canvas">
            <LogOut size={15} /> Quitter le mode admin
          </button>
        </div>
      )}
    </aside>
  );
}

// Navigation compacte pour petits écrans.
export function MobileNav({ route }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line bg-paper px-3 py-2 md:hidden" aria-label="Navigation principale">
      {NAV.map(({ path, label }) => (
        <a key={path} href={`#${path}`} className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm ${route === path ? "bg-navy text-white" : "text-inkmuted"}`}>
          {label}
        </a>
      ))}
    </nav>
  );
}
