import { useEffect, useMemo, useState } from "react";
import { Archive } from "lucide-react";
import { fetchArchiveDates, guidanceImageUrl, guidanceZipUrl } from "../api/guidanceApi.js";
import { useAppData, defaultSelectionFor } from "../context/AppDataContext.jsx";
import { fmtDateFr, validTimeLabel } from "../lib/format.js";
import { ImageFrame } from "../components/ui.jsx";
import Lightbox from "../components/Lightbox.jsx";

function Select({ label, value, onChange, options, render = (v) => v }) {
  return (
    <label className="flex flex-col text-xs text-inkmuted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink">
        {options.map((o) => (
          <option key={o} value={o}>
            {render(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

// Consultation des runs passés : mêmes sélecteurs que le Dashboard + une date.
export default function ArchivesPage() {
  const { categories, epoch, sources } = useAppData();
  const browsable = useMemo(() => categories.filter((c) => c.kind !== "gallery"), [categories]);
  const [dates, setDates] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [date, setDate] = useState(null);
  const [sel, setSel] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArchiveDates()
      .then((d) => {
        setDates(d.dates);
        setDate((cur) => cur || d.dates[1] || d.dates[0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  const category = browsable.find((c) => c.id === (categoryId || browsable[0]?.id));
  useEffect(() => {
    if (category && !categoryId) {
      setCategoryId(category.id);
      setSel(defaultSelectionFor(category));
    }
  }, [category, categoryId]);

  if (!category) return <p className="text-sm text-inkmuted">Chargement…</p>;

  const changeCategory = (id) => {
    setCategoryId(id);
    setSel(defaultSelectionFor(browsable.find((c) => c.id === id)));
  };

  const frames =
    category.kind === "items"
      ? category.items.map((item) => ({
          label: `${category.label} — ${item.label}`,
          sub: `Analyse du ${fmtDateFr(date)}`,
          short: item.label.split(" ")[0],
          src: guidanceImageUrl(category.id, { date, item: item.id, epoch }),
          downloadName: `${category.id}_${date}_${item.id}.png`,
          caption: item.label,
        }))
      : Array.from({ length: category.maxDay }, (_, i) => i + 1).map((d) => ({
          label: `${category.label} · ${sel.model} · ${sel.type ? sel.type + " · " : ""}${sel.run}`,
          sub: `${sel.run} du ${fmtDateFr(date)} · échéance +${d * 24}h · valable le ${validTimeLabel(date, sel.run, d)}`,
          short: `+${d * 24}h`,
          src: guidanceImageUrl(category.id, { date, ...sel, day: d, epoch }),
          downloadName: `${category.id}_${date}_${sel.type ? sel.type + "_" : ""}${sel.run}_${sel.model}_J${d}.png`,
          caption: `+${d * 24}h · valable le ${validTimeLabel(date, sel.run, d)}`,
        }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Archives</h1>
        <p className="text-sm text-inkmuted">
          Retrouvez les guidances des {dates.length || "derniers"} derniers jours. {sources[category.id]?.mode === "files" && "Les images sont lues depuis vos fichiers : une date sans fichier s'affiche comme indisponible."}
        </p>
      </div>

      {error && <p className="rounded-lg bg-previsions/10 px-4 py-3 text-sm text-previsions">{error}</p>}

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-line bg-paper p-4 shadow-sm">
        <Select label="Catégorie" value={category.id} onChange={changeCategory} options={browsable.map((c) => c.id)} render={(id) => browsable.find((c) => c.id === id).label} />
        <Select label="Date du run" value={date || ""} onChange={setDate} options={dates} render={fmtDateFr} />
        {category.types && <Select label="Type" value={sel.type} onChange={(v) => setSel({ ...sel, type: v })} options={category.types} />}
        {category.runs && <Select label="Run" value={sel.run} onChange={(v) => setSel({ ...sel, run: v })} options={category.runs} />}
        {category.models && <Select label="Modèle" value={sel.model} onChange={(v) => setSel({ ...sel, model: v })} options={category.models} />}
        <a href={guidanceZipUrl(category.id, { date, ...sel })} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy2">
          <Archive size={16} /> Télécharger le ZIP
        </a>
      </div>

      {date && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {frames.map((f, i) => (
            <figure key={f.src} className="rounded-xl border border-line bg-paper p-2 shadow-sm">
              <ImageFrame src={f.src} alt={f.label} downloadName={f.downloadName} className="h-60" onOpen={() => setLightbox({ index: i })} />
              <figcaption className="mt-1.5 px-1 text-xs text-inkmuted">{f.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {lightbox && <Lightbox frames={frames} index={lightbox.index} onIndex={(i) => setLightbox({ index: i })} onClose={() => setLightbox(null)} />}
    </div>
  );
}
