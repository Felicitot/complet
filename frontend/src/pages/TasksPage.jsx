import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Play, Plus, Trash2 } from "lucide-react";
import { createTask, deleteTask, getScripts, getTaskRuns, getTasks, runTaskNow, updateTask } from "../api/adminApi.js";
import { useAppData } from "../context/AppDataContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { fmtDateTime, fmtDuration, untilLabel } from "../lib/format.js";
import RequireAdmin from "../components/LoginForm.jsx";

const RUN_STATUS = {
  success: { label: "Réussie", cls: "bg-pluies/10 text-pluies" },
  error: { label: "Échec", cls: "bg-previsions/10 text-previsions" },
  running: { label: "En cours", cls: "bg-houles/10 text-houles" },
};

function RunBadge({ status }) {
  const m = RUN_STATUS[status] || { label: status, cls: "bg-canvas text-inkmuted" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
}

function RunHistory({ taskId, running }) {
  const { token, logout } = useAuth();
  const [runs, setRuns] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getTaskRuns(token, taskId)
        .then((d) => !cancelled && setRuns(d.runs))
        .catch((e) => e.status === 401 && logout());
    load();
    const id = setInterval(load, running ? 2000 : 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, taskId, running, logout]);

  if (!runs) return <p className="px-4 py-3 text-sm text-inkmuted">Chargement…</p>;
  if (!runs.length) return <p className="px-4 py-3 text-sm text-inkmuted">Aucune exécution pour le moment.</p>;

  return (
    <ul className="divide-y divide-line">
      {runs.map((r) => (
        <li key={r.id} className="px-4 py-2.5 text-sm">
          <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-left">
            {open === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <RunBadge status={r.status} />
            <span className="text-inkmuted">{fmtDateTime(r.startedAt)}</span>
            <span className="text-xs text-inkmuted">durée {fmtDuration(r.startedAt, r.endedAt)}</span>
            <span className="text-xs text-inkmuted">{r.trigger === "schedule" ? "planifiée" : "manuelle"}</span>
            {r.exitCode !== null && r.exitCode !== 0 && <span className="text-xs text-previsions">code {r.exitCode}</span>}
          </button>
          {open === r.id && (
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-navy p-3 text-xs leading-relaxed text-white/90">{r.logs || "(aucun journal)"}</pre>
          )}
        </li>
      ))}
    </ul>
  );
}

function TaskCard({ task, categories, onChanged, onError }) {
  const { token, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [interval, setIntervalValue] = useState(task.intervalHours ?? "");
  useEffect(() => {
    setIntervalValue(task.intervalHours ?? "");
  }, [task.intervalHours]);

  const act = async (fn) => {
    try {
      await fn();
      await onChanged();
    } catch (e) {
      if (e.status === 401) logout();
      else onError(e.message);
    }
  };

  const saveInterval = () =>
    act(() => updateTask(token, task.id, { intervalHours: interval === "" ? null : Number(interval) }));
  const category = categories.find((c) => c.id === task.category);

  return (
    <article className="rounded-2xl border border-line bg-paper shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">{task.name}</h2>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-inkmuted">{task.builtin ? "intégrée" : "script"}</span>
            {task.running && <RunBadge status="running" />}
            {!task.running && task.lastRun && <RunBadge status={task.lastRun.status} />}
          </div>
          <p className="mt-0.5 text-sm text-inkmuted">{task.description}</p>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-inkmuted">
            <span>Dernière exécution : {fmtDateTime(task.lastRun?.startedAt)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {task.enabled && task.nextRunAt ? `Prochaine : ${untilLabel(task.nextRunAt)}` : task.enabled ? "Planification manuelle uniquement" : "Planification désactivée"}
            </span>
            {category && <span>Catégorie liée : {category.label}</span>}
            {!task.builtin && task.args?.length > 0 && <span>Arguments : {task.args.join(" ")}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-inkmuted">
            toutes les
            <input type="number" min="1" max="168" value={interval} onChange={(e) => setIntervalValue(e.target.value)} onBlur={saveInterval} aria-label="Intervalle en heures" className="w-16 rounded-md border border-line px-2 py-1 text-sm text-ink" />
            h
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-inkmuted">
            <input type="checkbox" checked={task.enabled} onChange={(e) => act(() => updateTask(token, task.id, { enabled: e.target.checked }))} />
            Activée
          </label>
          <button disabled={task.running} onClick={() => act(() => runTaskNow(token, task.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy2 disabled:opacity-50">
            <Play size={13} /> Lancer
          </button>
          {!task.builtin && (
            <button
              onClick={() => window.confirm(`Supprimer la tâche « ${task.name} » ?`) && act(() => deleteTask(token, task.id))}
              aria-label={`Supprimer ${task.name}`}
              className="rounded-lg border border-line p-1.5 text-previsions hover:bg-previsions/10"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-line">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-inkmuted hover:bg-canvas">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Historique et journaux
        </button>
        {open && <RunHistory taskId={task.id} running={task.running} />}
      </div>
    </article>
  );
}

function NewTaskForm({ scripts, categories, onCreated, onCancel, onError }) {
  const { token, logout } = useAuth();
  const [f, setF] = useState({ name: "", script: scripts[0] || "", args: "", intervalHours: "", timeoutSec: 300, category: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createTask(token, {
        name: f.name,
        script: f.script,
        args: f.args.trim() ? f.args.trim().split(/\s+/) : [],
        intervalHours: f.intervalHours === "" ? null : Number(f.intervalHours),
        timeoutSec: Number(f.timeoutSec),
        category: f.category || null,
      });
      await onCreated();
    } catch (err) {
      if (err.status === 401) logout();
      else onError(err.message);
    }
  };

  const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink";
  return (
    <form onSubmit={submit} className="rounded-2xl border border-navy/20 bg-paper p-5 shadow-sm">
      <h2 className="text-base font-semibold text-ink">Nouvelle tâche</h2>
      {scripts.length === 0 ? (
        <p className="mt-2 text-sm text-inkmuted">Aucun script disponible. Placez un fichier .js, .py ou .sh dans le dossier des scripts du serveur (voir scripts/README.md), puis rouvrez ce formulaire.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-inkmuted">
            Nom
            <input required maxLength={80} value={f.name} onChange={set("name")} className={field} placeholder="Calcul des orages" />
          </label>
          <label className="text-xs text-inkmuted">
            Script
            <select value={f.script} onChange={set("script")} className={field}>
              {scripts.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-inkmuted">
            Arguments (séparés par des espaces)
            <input value={f.args} onChange={set("args")} className={field} placeholder="--zone madagascar" />
          </label>
          <label className="text-xs text-inkmuted">
            Catégorie concernée (passe en rouge si le script échoue)
            <select value={f.category} onChange={set("category")} className={field}>
              <option value="">Aucune</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-inkmuted">
            Répéter toutes les (heures, vide = manuel)
            <input type="number" min="1" max="168" value={f.intervalHours} onChange={set("intervalHours")} className={field} />
          </label>
          <label className="text-xs text-inkmuted">
            Délai maximal (secondes)
            <input type="number" min="5" max="3600" value={f.timeoutSec} onChange={set("timeoutSec")} className={field} />
          </label>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        {scripts.length > 0 && <button className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy2">Créer la tâche</button>}
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-canvas">
          Annuler
        </button>
      </div>
    </form>
  );
}

function TasksContent() {
  const { token, logout } = useAuth();
  const { categories } = useAppData();
  const [tasks, setTasks] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([getTasks(token), getScripts(token)]);
      setTasks(t.tasks);
      setScripts(s.scripts);
      setError(null);
    } catch (e) {
      if (e.status === 401) logout();
      else setError(e.message);
    }
  }, [token, logout]);

  useEffect(() => {
    load();
  }, [load]);

  const anyRunning = tasks.some((t) => t.running);
  useEffect(() => {
    const id = setInterval(load, anyRunning ? 2000 : 15000);
    return () => clearInterval(id);
  }, [anyRunning, load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Scripts &amp; Tâches</h1>
          <p className="text-sm text-inkmuted">Planification, exécution et journaux des traitements. Les scripts sont lancés sans shell, depuis le dossier des scripts uniquement.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy2">
          <Plus size={16} /> Nouvelle tâche
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-previsions/10 px-4 py-3 text-sm text-previsions" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <NewTaskForm
          scripts={scripts}
          categories={categories}
          onError={setError}
          onCancel={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}

      <div className="space-y-4">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} categories={categories} onChanged={load} onError={setError} />
        ))}
      </div>
    </div>
  );
}

export default function TasksPage() {
  return (
    <RequireAdmin title="Scripts & Tâches">
      <TasksContent />
    </RequireAdmin>
  );
}
