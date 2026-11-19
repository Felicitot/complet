import { guidanceImageUrl } from "../api/guidanceApi.js";
import { useAppData } from "../context/AppDataContext.jsx";
import { todayUtc } from "../lib/format.js";

export default function SummaryRow({ onCategory }) {
  const { categories, selections, epoch } = useAppData();
  const date = todayUtc();
  return (
    <div className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-inkmuted">Résumé des guidances (échéance +24h)</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((c) => {
          const sel = selections[c.id] || {};
          const params = c.kind === "items" ? { date, item: c.items[0].id, epoch } : { date, run: sel.run, model: sel.model, type: sel.type, day: 1, epoch };
          return (
            <button key={c.id} onClick={() => onCategory(c.id)} className="overflow-hidden rounded-lg border border-line text-left transition-shadow hover:shadow-md">
              {c.kind === "gallery" ? (
                <div className="flex h-20 items-center justify-center bg-navy text-xs text-white/70">Galerie</div>
              ) : (
                <img src={guidanceImageUrl(c.id, params)} alt="" loading="lazy" className="h-20 w-full object-cover" />
              )}
              <p className="truncate px-2 py-1 text-[11px] font-medium" style={{ color: c.color }}>
                {c.label.split(" / ")[0]}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
