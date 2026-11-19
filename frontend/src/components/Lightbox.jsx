import { useCallback, useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Play, Pause, Download, ImageOff } from "lucide-react";

// Visionneuse plein écran : zoom (molette, +/-, double-clic), déplacement à
// la souris/au doigt, navigation entre échéances (←/→), animation (espace).
// `frames` = [{ label, sub, short, src, downloadName }]
export default function Lightbox({ frames, index, onIndex, onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const drag = useRef(null);
  const indexRef = useRef(index);
  indexRef.current = index;

  const frame = frames[index];
  const multi = frames.length > 1;

  const resetView = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((factor) => {
    setScale((s) => {
      const next = Math.min(6, Math.max(1, s * factor));
      if (next === 1) setPos({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const go = useCallback(
    (delta) => onIndex((indexRef.current + delta + frames.length) % frames.length),
    [frames.length, onIndex]
  );

  useEffect(() => {
    setFailed(false);
  }, [index]);

  // Précharge toutes les échéances pour une animation fluide.
  useEffect(() => {
    frames.forEach((f) => {
      const img = new Image();
      img.src = f.src;
    });
  }, [frames]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => go(1), 1200);
    return () => clearInterval(id);
  }, [playing, go]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0") resetView();
      else if (e.key === " " && multi) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, zoomBy, resetView, multi]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onPointerDown = (e) => {
    if (scale <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onPointerMove = (e) => {
    if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  if (!frame) return null;

  const btn = "rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={frame.label}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{frame.label}</p>
          {frame.sub && <p className="truncate text-xs text-white/60">{frame.sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          {multi && (
            <button className={btn} onClick={() => setPlaying((p) => !p)} title="Animation (espace)" aria-label={playing ? "Mettre en pause" : "Lancer l'animation"}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
          <button className={btn} onClick={() => zoomBy(0.8)} disabled={scale <= 1} title="Réduire (-)" aria-label="Réduire">
            <ZoomOut size={18} />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-white/70">{Math.round(scale * 100)} %</span>
          <button className={btn} onClick={() => zoomBy(1.25)} disabled={scale >= 6} title="Agrandir (+)" aria-label="Agrandir">
            <ZoomIn size={18} />
          </button>
          <button className={btn} onClick={resetView} title="Réinitialiser (0)" aria-label="Réinitialiser le zoom">
            <RotateCcw size={18} />
          </button>
          <a className={btn} href={frame.src} download={frame.downloadName} title="Télécharger" aria-label="Télécharger l'image">
            <Download size={18} />
          </a>
          <button className={btn} onClick={onClose} title="Fermer (Échap)" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.15 : 0.87)}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {multi && (
          <>
            <button className={`${btn} absolute left-3 z-10`} onClick={() => go(-1)} aria-label="Échéance précédente">
              <ChevronLeft size={22} />
            </button>
            <button className={`${btn} absolute right-3 z-10`} onClick={() => go(1)} aria-label="Échéance suivante">
              <ChevronRight size={22} />
            </button>
          </>
        )}
        {failed ? (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <ImageOff size={32} />
            <p className="text-sm">Image indisponible pour cette échéance.</p>
          </div>
        ) : (
          <img
            src={frame.src}
            alt={frame.label}
            draggable={false}
            onError={() => setFailed(true)}
            onDoubleClick={() => (scale > 1 ? resetView() : setScale(2.5))}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              cursor: scale > 1 ? (drag.current ? "grabbing" : "grab") : "zoom-in",
              touchAction: "none",
            }}
          />
        )}
      </div>

      {multi && frames.length <= 8 && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => onIndex(i)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${i === index ? "bg-white text-navy" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {f.short || i + 1}
            </button>
          ))}
          <span className="ml-3 hidden text-[11px] text-white/40 sm:inline">← → échéances · espace animation · molette zoom · Échap fermer</span>
        </div>
      )}
    </div>
  );
}
