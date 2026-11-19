import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import { getSettings, saveSettings, testPath } from "../api/adminApi.js";
import { useAppData } from "../context/AppDataContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import RequireAdmin from "../components/LoginForm.jsx";

function SourceEditor({ category, cfg, tokens, onChange }) {
  const { token, logout } = useAuth();
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);
  const isSat = category.kind === "gallery";

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await testPath(token, { category: category.id, template: cfg.pathTemplate }));
    } catch (e) {
      if (e.status === 401) logout();
      else setTest({ error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const input = "mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-xs text-ink";

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold" style={{ color: category.color }}>
          {category.label}
        </h2>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs" role="radiogroup" aria-label={`Source ${category.label}`}>
          {[
            ["simulated", "Données simulées"],
            ["files", "Fichiers réels"],
          ].map(([mode, label]) => (
            <button key={mode} role="radio" aria-checked={cfg.mode === mode} onClick={() => onChange({ ...cfg, mode })} className={`px-3 py-1.5 font-medium ${cfg.mode === mode ? "bg-navy text-white" : "bg-paper text-inkmuted hover:bg-canvas"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {cfg.mode === "files" && (
        <div className="mt-4">
          {isSat ? (
            <label className="block text-xs text-inkmuted">
              Dossier contenant les images satellites (.png, .jpg) — les plus récentes sont affichées
              <input value={cfg.directory || ""} onChange={(e) => onChange({ ...cfg, directory: e.target.value })} placeholder="/data/satellites" className={input} />
            </label>
          ) : (
            <>
              <label className="block text-xs text-inkmuted">
                Modèle de chemin du fichier PNG
                <input value={cfg.pathTemplate || ""} onChange={(e) => onChange({ ...cfg, pathTemplate: e.target.value })} className={input} spellCheck={false} />
              </label>
              <p className="mt-2 text-xs text-inkmuted">
                Variables (cliquez pour insérer) :{" "}
                {tokens.map((t) => (
                  <button key={t} onClick={() => onChange({ ...cfg, pathTemplate: `${cfg.pathTemplate || ""}{${t}}` })} className="mr-1 rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink hover:bg-line">
                    {`{${t}}`}
                  </button>
                ))}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={runTest} disabled={testing} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-50">
                  {testing ? "Test…" : "Tester avec une sélection d'exemple"}
                </button>
                {test && !test.error && (
                  <span className="flex min-w-0 items-center gap-1.5 text-xs">
                    {test.exists ? <CheckCircle2 size={15} className="flex-shrink-0 text-pluies" /> : <XCircle size={15} className="flex-shrink-0 text-previsions" />}
                    <code className="truncate">{test.path}</code>
                    <span className="flex-shrink-0 text-inkmuted">— {test.exists ? `fichier trouvé (${Math.round(test.sizeBytes / 1024)} Ko)` : "fichier introuvable"}</span>
                  </span>
                )}
                {test?.error && <span className="text-xs text-previsions">{test.error}</span>}
              </div>
            </>
          )}
          <p className="mt-3 text-xs text-inkmuted">En mode « Fichiers réels », une image absente s'affiche comme indisponible : aucune image simulée ne la remplace.</p>
        </div>
      )}
    </section>
  );
}

function SettingsContent() {
  const { token, logout } = useAuth();
  const { categories, reloadLight } = useAppData();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getSettings(token);
      setSaved(d.settings);
      setDraft(d.settings);
      setTokens(d.templateTokens);
    } catch (e) {
      if (e.status === 401) logout();
      else setMessage({ type: "error", text: e.message });
    }
  }, [token, logout]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  if (!draft) return message ? <p className="text-sm text-previsions">{message.text}</p> : <p className="text-sm text-inkmuted">Chargement…</p>;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await saveSettings(token, {
        sources: draft.sources,
        autoRefresh: draft.autoRefresh,
        archiveDays: Number(draft.archiveDays),
      });
      setSaved(res.settings);
      setDraft(res.settings);
      setMessage({ type: "ok", text: "Paramètres enregistrés." });
      reloadLight();
    } catch (e) {
      if (e.status === 401) logout();
      else setMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const setSource = (id, cfg) => setDraft({ ...draft, sources: { ...draft.sources, [id]: cfg } });
  const field = "mt-1 w-24 rounded-lg border border-line px-3 py-2 text-sm text-ink";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Paramètres</h1>
          <p className="text-sm text-inkmuted">Branchez vos vrais fichiers PNG, réglez l'actualisation automatique et la durée des archives.</p>
        </div>
        <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy2 disabled:opacity-40">
          <Save size={16} /> {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {message && (
        <p role={message.type === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${message.type === "ok" ? "bg-pluies/10 text-pluies" : "bg-previsions/10 text-previsions"}`}>
          {message.text}
        </p>
      )}

      <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">Actualisation et archives</h2>
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={draft.autoRefresh.enabled} onChange={(e) => setDraft({ ...draft, autoRefresh: { ...draft.autoRefresh, enabled: e.target.checked } })} />
            Actualisation automatique
          </label>
          <label className="text-xs text-inkmuted">
            Toutes les (heures)
            <input type="number" min="1" max="168" value={draft.autoRefresh.intervalHours} onChange={(e) => setDraft({ ...draft, autoRefresh: { ...draft.autoRefresh, intervalHours: Number(e.target.value) } })} className={`${field} block`} />
          </label>
          <label className="text-xs text-inkmuted">
            Durée des archives (jours)
            <input type="number" min="1" max="90" value={draft.archiveDays} onChange={(e) => setDraft({ ...draft, archiveDays: e.target.value })} className={`${field} block`} />
          </label>
        </div>
      </section>

      <div>
        <h2 className="mb-3 text-base font-semibold text-ink">Sources des images</h2>
        <div className="space-y-4">
          {categories.map((c) => (
            <SourceEditor key={c.id} category={c} cfg={draft.sources[c.id]} tokens={tokens} onChange={(cfg) => setSource(c.id, cfg)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAdmin title="Paramètres">
      <SettingsContent />
    </RequireAdmin>
  );
}
