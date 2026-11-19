import { useEffect, useState } from "react";
import { Download, ImageOff, Maximize2 } from "lucide-react";

export function Pill({ label, active, onClick, small }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border text-left transition-colors ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
        active ? "border-navy bg-navy text-white" : "border-line bg-paper text-inkmuted hover:border-navy/30 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export function DayTabs({ maxDay, day, onChange }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Échéance">
      {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
        <button
          key={d}
          role="tab"
          aria-selected={day === d}
          onClick={() => onChange(d)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${day === d ? "bg-navy text-white" : "bg-canvas text-inkmuted hover:text-ink"}`}
        >
          +{d * 24}h
        </button>
      ))}
    </div>
  );
}

// Image avec squelette de chargement, repli en cas d'erreur, boutons Agrandir/Télécharger.
export function ImageFrame({ src, alt, onOpen, downloadName, className = "h-80" }) {
  const [state, setState] = useState("loading");
  useEffect(() => {
    setState("loading");
  }, [src]);

  return (
    <div className={`group relative overflow-hidden rounded-xl border border-line bg-canvas ${className}`}>
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-line/60" />}
      {state === "error" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-inkmuted">
          <ImageOff size={24} />
          <p className="text-xs">Image indisponible pour cette sélection</p>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          onClick={onOpen}
          className={`h-full w-full object-contain ${onOpen ? "cursor-zoom-in" : ""}`}
        />
      )}
      {state === "ok" && (
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          {onOpen && (
            <button onClick={onOpen} aria-label="Agrandir" className="inline-flex items-center gap-1.5 rounded-lg bg-navy/90 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-navy">
              <Maximize2 size={13} /> Agrandir
            </button>
          )}
          <a href={src} download={downloadName} className="inline-flex items-center gap-1.5 rounded-lg bg-navy/90 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-navy">
            <Download size={13} /> PNG
          </a>
        </div>
      )}
    </div>
  );
}

const STATUS_META = {
  disponible: { dot: "bg-pluies", label: "Disponible" },
  en_cours: { dot: "bg-houles animate-pulse", label: "Mise à jour en cours" },
  erreur: { dot: "bg-previsions", label: "Erreur" },
  non_disponible: { dot: "bg-inkmuted", label: "Non disponible" },
};

export function StatusDot({ state }) {
  const meta = STATUS_META[state] || STATUS_META.non_disponible;
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot}`} title={meta.label} aria-label={meta.label} />;
}

export function SourceBadge({ mode }) {
  if (!mode) return null;
  return mode === "files" ? (
    <span className="rounded-full bg-pluies/10 px-2 py-0.5 text-[11px] font-medium text-pluies" title="Images lues depuis vos fichiers réels">
      Fichiers réels
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800" title="Images d'exemple générées par le serveur : ce ne sont pas de vraies prévisions">
      Données simulées
    </span>
  );
}
