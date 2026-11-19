import { useEffect, useState } from "react";
import { Archive, SplitSquareHorizontal, Download } from "lucide-react";
import { guidanceImageUrl, guidanceZipUrl, fetchSatellites, satelliteImageUrl } from "../api/guidanceApi.js";
import { useAppData } from "../context/AppDataContext.jsx";
import { fmtDateFr, todayUtc, validTimeLabel } from "../lib/format.js";
import { DayTabs, ImageFrame, Pill, SourceBadge, StatusDot } from "./ui.jsx";
import Lightbox from "./Lightbox.jsx";

function CardShell({ category, className = "", children }) {
  const { sources, status } = useAppData();
  return (
    <section id={category.id} className={`scroll-mt-4 rounded-2xl border border-line bg-paper p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold" style={{ color: category.color }}>
              {category.label}
            </p>
            <StatusDot state={status?.categories?.[category.id]?.status} />
          </div>
          {category.description && <p className="text-xs text-inkmuted">{category.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge mode={sources[category.id]?.mode} />
          {category.badge && (
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: `${category.color}1A`, color: category.color }}>
              {category.badge}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Group({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-inkmuted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

const titleOf = (category, p) => `${category.label} · ${p.model} · ${p.type ? p.type + " · " : ""}${p.run}`;

// --- Vent, Pluies, Houles, Températures : (type) x run x modèle x échéance ---
export function ForecastCard({ category }) {
  const { epoch, selections, setSelection } = useAppData();
  const sel = selections[category.id];
  const date = todayUtc();
  const [compare, setCompare] = useState({ on: false, by: "model", value: null });
  const [lightbox, setLightbox] = useState(null);
  if (!sel) return null;

  const change = (patch) => setSelection(category.id, { ...sel, ...patch });
  const optionsFor = (by) => (by === "model" ? category.models : category.runs);
  const compareValue =
    compare.value && compare.value !== sel[compare.by] && optionsFor(compare.by).includes(compare.value)
      ? compare.value
      : optionsFor(compare.by).find((v) => v !== sel[compare.by]);

  const variants = compare.on ? [sel, { ...sel, [compare.by]: compareValue }] : [sel];

  const urlFor = (p, day = p.day) => guidanceImageUrl(category.id, { date, ...p, day, epoch });
  const nameFor = (p, day = p.day) => `${category.id}_${date}_${p.type ? p.type + "_" : ""}${p.run}_${p.model}_J${day}.png`;
  const framesFor = (p) =>
    Array.from({ length: category.maxDay }, (_, i) => i + 1).map((d) => ({
      label: titleOf(category, p),
      sub: `${p.run} du ${fmtDateFr(date)} · échéance +${d * 24}h · valable le ${validTimeLabel(date, p.run, d)}`,
      short: `+${d * 24}h`,
      src: urlFor(p, d),
      downloadName: nameFor(p, d),
    }));

  return (
    <CardShell category={category} className={compare.on ? "xl:col-span-2" : ""}>
      <div className="flex flex-col gap-5 md:flex-row">
        <div className="space-y-4 md:w-48 md:flex-shrink-0">
          {category.types && (
            <Group label="Types">
              {category.types.map((t) => (
                <Pill key={t} small label={t} active={sel.type === t} onClick={() => change({ type: t })} />
              ))}
            </Group>
          )}
          <Group label="Runs">
            {category.runs.map((r) => (
              <Pill key={r} small label={r} active={sel.run === r} onClick={() => change({ run: r })} />
            ))}
          </Group>
          <Group label="Modèles">
            {category.models.map((m) => (
              <Pill key={m} small label={m} active={sel.model === m} onClick={() => change({ model: m })} />
            ))}
          </Group>
        </div>

        <div className="min-w-0 flex-1">
          <div className={compare.on ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : ""}>
            {variants.map((p, i) => (
              <div key={i}>
                {compare.on && <p className="mb-1 text-xs font-semibold text-ink">{p[compare.by]}</p>}
                <ImageFrame
                  src={urlFor(p)}
                  alt={titleOf(category, p)}
                  downloadName={nameFor(p)}
                  className={compare.on ? "h-80" : "h-96"}
                  onOpen={() => setLightbox({ frames: framesFor(p), index: sel.day - 1 })}
                />
                <p className="mt-1.5 text-xs text-inkmuted">
                  {p.run} du {fmtDateFr(date)} · valable le {validTimeLabel(date, p.run, sel.day)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <DayTabs maxDay={category.maxDay} day={sel.day} onChange={(d) => change({ day: d })} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompare((c) => ({ ...c, on: !c.on }))}
                aria-pressed={compare.on}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${compare.on ? "border-navy bg-navy text-white" : "border-line text-ink hover:bg-canvas"}`}
              >
                <SplitSquareHorizontal size={14} /> Comparer
              </button>
              <a
                href={guidanceZipUrl(category.id, { date, ...sel })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
                title="Télécharger les 5 échéances de ce run"
              >
                <Archive size={14} /> ZIP {category.maxDay} jours
              </a>
            </div>
          </div>

          {compare.on && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-canvas px-3 py-2 text-xs">
              <span className="font-medium text-inkmuted">Comparer par :</span>
              <div className="flex gap-1.5">
                <Pill small label="Modèle" active={compare.by === "model"} onClick={() => setCompare({ on: true, by: "model", value: null })} />
                <Pill small label="Run" active={compare.by === "run"} onClick={() => setCompare({ on: true, by: "run", value: null })} />
              </div>
              <label className="flex items-center gap-2 text-inkmuted">
                avec
                <select
                  value={compareValue}
                  onChange={(e) => setCompare((c) => ({ ...c, value: e.target.value }))}
                  className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink"
                >
                  {optionsFor(compare.by)
                    .filter((v) => v !== sel[compare.by])
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              </label>
            </div>
          )}

          {(category.thresholds || category.anomalyThresholds) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-inkmuted">Seuils :</span>
              {category.thresholds?.map((t) => (
                <span key={t} className="rounded-full bg-houles/10 px-2.5 py-1 text-xs font-medium text-houles">
                  &gt; {t} m
                </span>
              ))}
              {category.anomalyThresholds?.map((t) => (
                <span key={t} className="rounded-full bg-temperatures/10 px-2.5 py-1 text-xs font-medium text-temperatures">
                  +{t}°C
                </span>
              ))}
            </div>
          )}

          {category.probabilityBands && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <p className="w-full text-[11px] font-medium uppercase tracking-wide text-inkmuted">Probabilités (mm/24h)</p>
              {category.probabilityBands.map((b) => (
                <span key={b.label} className="flex items-center gap-1.5 text-xs text-inkmuted">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <Lightbox frames={lightbox.frames} index={lightbox.index} onIndex={(i) => setLightbox((l) => ({ ...l, index: i }))} onClose={() => setLightbox(null)} />
      )}
    </CardShell>
  );
}

// --- Prévisions spécifiques : un PNG par phénomène ---
export function SpecificItemsCard({ category }) {
  const { epoch } = useAppData();
  const date = todayUtc();
  const [lightbox, setLightbox] = useState(null);

  const frames = category.items.map((item) => ({
    label: `${category.label} — ${item.label}`,
    sub: `Analyse du ${fmtDateFr(date)}`,
    short: item.label.split(" ")[0],
    src: guidanceImageUrl(category.id, { date, item: item.id, epoch }),
    downloadName: `${category.id}_${date}_${item.id}.png`,
  }));

  return (
    <CardShell category={category}>
      <ul className="divide-y divide-line">
        {category.items.map((item, i) => (
          <li key={item.id} className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-sm text-ink">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setLightbox({ index: i })} aria-label={`Agrandir ${item.label}`}>
                <img src={frames[i].src} alt={item.label} loading="lazy" className="h-14 w-16 cursor-zoom-in rounded-md border border-line bg-canvas object-cover" />
              </button>
              <a href={frames[i].src} download={frames[i].downloadName} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas">
                <Download size={13} /> Télécharger
              </a>
            </div>
          </li>
        ))}
      </ul>
      <a href={guidanceZipUrl(category.id, { date })} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas">
        <Archive size={14} /> Tout télécharger (ZIP)
      </a>
      {lightbox && <Lightbox frames={frames} index={lightbox.index} onIndex={(i) => setLightbox({ index: i })} onClose={() => setLightbox(null)} />}
    </CardShell>
  );
}

// --- Satellites / AI : galerie ---
export function SatellitesCard({ category }) {
  const { epoch } = useAppData();
  const [data, setData] = useState({ items: [], source: null });
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSatellites()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ items: [], source: null }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [epoch]);

  const frames = data.items.map((img) => ({
    label: "Image satellite",
    sub: img.label,
    short: img.label.slice(5, 16),
    src: satelliteImageUrl(img.url),
    downloadName: `satellite_${img.label.replace(/[^0-9]/g, "")}.png`,
  }));

  return (
    <CardShell category={category}>
      <p className="text-xs text-inkmuted">Mise à jour toutes les {category.updateFrequencyHours} heures — cliquez sur une image pour l'agrandir ou lancer l'animation.</p>
      {loading ? (
        <p className="mt-3 text-sm text-inkmuted">Chargement…</p>
      ) : data.items.length === 0 ? (
        <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-inkmuted">Aucune image satellite disponible (vérifiez le dossier configuré dans Paramètres).</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {frames.map((f, i) => (
            <button key={f.src} onClick={() => setLightbox({ index: i })} className="overflow-hidden rounded-lg border border-line text-left">
              <img src={f.src} alt={f.sub} loading="lazy" className="h-24 w-full cursor-zoom-in object-cover" />
              <p className="truncate px-1.5 py-1 text-[10px] text-inkmuted">{f.sub}</p>
            </button>
          ))}
        </div>
      )}
      {lightbox && <Lightbox frames={frames} index={lightbox.index} onIndex={(i) => setLightbox({ index: i })} onClose={() => setLightbox(null)} />}
    </CardShell>
  );
}
