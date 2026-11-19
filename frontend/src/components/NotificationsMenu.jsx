import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { useAppData } from "../context/AppDataContext.jsx";
import { useStoredState } from "../hooks/useStoredState.js";
import { agoLabel } from "../lib/format.js";

const LEVELS = {
  info: { icon: Info, color: "text-satellites" },
  warning: { icon: AlertTriangle, color: "text-houles" },
  error: { icon: AlertTriangle, color: "text-previsions" },
  success: { icon: CheckCircle2, color: "text-pluies" },
};

export default function NotificationsMenu() {
  const { events } = useAppData();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useStoredState("rivotra.events.seen", "");
  const ref = useRef(null);

  const unread = events.filter((e) => e.time > seen).length;
  const hasError = events.some((e) => e.time > seen && e.level === "error");

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && events[0]) setSeen(events[0].time);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`} aria-expanded={open} className="relative rounded-lg bg-white/10 p-2 text-white hover:bg-white/20">
        <Bell size={17} />
        {unread > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${hasError ? "bg-previsions" : "bg-houles"}`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-paper text-ink shadow-lg">
          <p className="border-b border-line px-4 py-2.5 text-sm font-semibold">Notifications</p>
          {events.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-inkmuted">Rien à signaler pour le moment.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {events.map((e) => {
                const meta = LEVELS[e.level] || LEVELS.info;
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="flex gap-3 px-4 py-2.5">
                    <Icon size={16} className={`mt-0.5 flex-shrink-0 ${meta.color}`} />
                    <div className="min-w-0">
                      <p className="text-sm">{e.message}</p>
                      <p className="text-xs text-inkmuted">{agoLabel(e.time)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
