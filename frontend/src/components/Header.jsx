import { useEffect, useState } from "react";
import { RefreshCw, Sun } from "lucide-react";
import { useAppData } from "../context/AppDataContext.jsx";
import SearchBox from "./SearchBox.jsx";
import NotificationsMenu from "./NotificationsMenu.jsx";

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Header({ onPick }) {
  const { doRefresh, isRefreshing } = useAppData();
  const now = useUtcClock();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const timeLabel = `${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

  return (
    <header className="flex items-center justify-between gap-4 bg-navy px-4 py-3 text-white sm:px-6">
      <a href="#/" className="flex flex-shrink-0 items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-yellow-300">
          <Sun size={18} />
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="font-display text-base font-semibold">Météo Madagascar</p>
          <p className="text-[11px] uppercase tracking-wide text-white/50">Guidances de prévision</p>
        </div>
      </a>

      <SearchBox onPick={onPick} />

      <div className="flex flex-shrink-0 items-center gap-3">
        <div className="hidden text-right text-xs leading-tight text-white/70 xl:block">
          <p className="capitalize">{dateLabel}</p>
          <p>{timeLabel}</p>
        </div>
        <NotificationsMenu />
        <button
          onClick={doRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/20 disabled:opacity-60 sm:px-4"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">{isRefreshing ? "Actualisation…" : "Actualiser"}</span>
        </button>
      </div>
    </header>
  );
}
