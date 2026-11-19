import { useEffect, useState } from "react";
import { useAppData } from "../context/AppDataContext.jsx";
import { fmtDateTime, untilLabel } from "../lib/format.js";

const LEGEND = [
  { dot: "bg-pluies", label: "Disponible" },
  { dot: "bg-houles", label: "En cours" },
  { dot: "bg-previsions", label: "Erreur" },
  { dot: "bg-inkmuted", label: "Non disponible" },
];

export default function StatusPanel() {
  const { status, schedule, categories } = useAppData();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const entries = Object.entries(status?.categories || {});
  const errors = entries.filter(([, v]) => v.status === "erreur").map(([id]) => categories.find((c) => c.id === id)?.label || id);
  const running = entries.some(([, v]) => v.status === "en_cours");
  const lastUpdate = entries.reduce((latest, [, v]) => (v.lastUpdate > latest ? v.lastUpdate : latest), "");

  let tone = "bg-pluies";
  let message = entries.length ? "Tous les systèmes opérationnels" : "En attente de la première actualisation";
  if (!entries.length) tone = "bg-inkmuted";
  if (running) {
    tone = "bg-houles";
    message = "Mise à jour en cours";
  }
  if (errors.length) {
    tone = "bg-previsions";
    message = `Anomalie : ${errors.join(", ")}`;
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-4 text-sm shadow-sm" role="status">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
          <p className="font-medium text-ink">{message}</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs text-inkmuted">
          <p>Dernière mise à jour : {fmtDateTime(lastUpdate)}</p>
          <p>
            Prochaine actualisation automatique :{" "}
            {schedule?.enabled ? <span className="font-medium text-ink">{untilLabel(schedule.nextRunAt, now)}</span> : "désactivée"}
            {schedule?.enabled && <span> (toutes les {schedule.intervalHours} h)</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-inkmuted">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
