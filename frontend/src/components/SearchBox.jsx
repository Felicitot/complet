import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useAppData } from "../context/AppDataContext.jsx";
import { norm } from "../lib/format.js";

function buildIndex(categories) {
  const out = [];
  categories.forEach((c) => {
    out.push({ key: c.id, label: c.label, sub: "Catégorie", category: c.id, patch: null });
    c.models?.forEach((m) => out.push({ key: `${c.id}-m-${m}`, label: `${c.label} · ${m}`, sub: "Modèle", category: c.id, patch: { model: m } }));
    c.runs?.forEach((r) => out.push({ key: `${c.id}-r-${r}`, label: `${c.label} · ${r}`, sub: "Run", category: c.id, patch: { run: r } }));
    c.types?.forEach((t) => out.push({ key: `${c.id}-t-${t}`, label: `${c.label} · ${t}`, sub: "Type", category: c.id, patch: { type: t } }));
    c.items?.forEach((i) => out.push({ key: `${c.id}-i-${i.id}`, label: `${c.label} · ${i.label}`, sub: "Phénomène", category: c.id, patch: null }));
  });
  return out;
}

// Recherche rapide (Ctrl+K ou /) : saute à une catégorie et présélectionne
// le modèle, le run ou le type trouvé.
export default function SearchBox({ onPick }) {
  const { categories } = useAppData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  const index = useMemo(() => buildIndex(categories), [categories]);
  const results = useMemo(() => {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return index.filter((r) => tokens.every((t) => norm(`${r.label} ${r.sub}`).includes(t))).slice(0, 8);
  }, [q, index]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const pick = (r) => {
    onPick(r);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) pick(results[active]);
    else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Rechercher (ex : vent GFS, houles, orages)…"
        aria-label="Rechercher une guidance"
        role="combobox"
        aria-expanded={open && results.length > 0}
        className="w-full rounded-lg bg-white/10 py-2 pl-9 pr-12 text-sm text-white placeholder-white/40 outline-none focus:bg-white/15"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50 sm:block">Ctrl K</kbd>
      {open && q && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-paper py-1 text-ink shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-inkmuted">Aucun résultat pour « {q} »</li>
          ) : (
            results.map((r, i) => (
              <li key={r.key} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${i === active ? "bg-canvas" : ""}`}
                >
                  <span>{r.label}</span>
                  <span className="text-xs text-inkmuted">{r.sub}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
