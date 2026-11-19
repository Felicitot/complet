// Tâches et planificateur ("Scripts & Tâches").
//
// Deux tâches intégrées (actualisation des guidances, mise à jour des images
// satellites) + des tâches personnalisées qui exécutent un script placé dans
// le dossier SCRIPTS_DIR (.js, .py ou .sh). Chaque exécution est historisée
// (statut, durée, journaux) et génère une notification.
//
// Sécurité : aucun shell n'est utilisé (execFile), les arguments sont passés
// tels quels, et seuls les fichiers de SCRIPTS_DIR peuvent être lancés.

import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { SCRIPTS_DIR, DATA_DIR } from "../config.js";
import { dataPath, readJson, writeJson } from "./jsonStore.js";
import { getSettings, updateSettings } from "./settings.js";
import { refreshAll, refreshSatellites, setCategoryStatus, todayUtc } from "./guidanceGenerator.js";
import { addEvent } from "./events.js";
import { getCategory } from "../data/categories.js";
import { HttpError } from "../utils/http.js";

const TASKS_FILE = () => dataPath("tasks.json");
const RUNS_FILE = () => dataPath("task-runs.json");
const MAX_RUNS = 200;
const MAX_LOG = 8000;
const bootTime = Date.now();
const running = new Map(); // taskId -> runId

// Verrou simple : les lectures-modifications-écritures du fichier d'historique
// sont sérialisées pour ne jamais perdre une mise à jour.
let chain = Promise.resolve();
function withLock(fn) {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

const BUILTIN = [
  {
    id: "refresh-guidances",
    name: "Actualisation des guidances",
    description: "Vide le cache et prépare une nouvelle version des images (nouveau run).",
    run: async () => {
      const r = await refreshAll();
      return `Actualisation terminée (version ${r.epoch}).`;
    },
  },
  {
    id: "satellite-update",
    name: "Mise à jour des images satellites",
    description: "Recharge la galerie des dernières images satellites (toutes les 6 h par défaut).",
    defaultIntervalHours: 6,
    category: "satellites",
    run: async () => {
      const r = await refreshSatellites();
      return `${r.count} image(s) disponibles (source : ${r.source}).`;
    },
  },
];

async function loadTaskConfig() {
  return readJson(TASKS_FILE(), { custom: [], overrides: {} });
}

// ---------- scripts ----------
const INTERPRETERS = { ".js": process.execPath, ".py": "python3", ".sh": "sh" };

export async function listScripts() {
  let entries = [];
  try {
    entries = await fs.readdir(SCRIPTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith(".") && INTERPRETERS[path.extname(e.name)])
    .map((e) => e.name)
    .sort();
}

async function resolveScript(name) {
  if (typeof name !== "string" || !/^[\w.-]+$/.test(name) || !INTERPRETERS[path.extname(name)]) {
    throw new HttpError(400, "Nom de script invalide (extensions permises : .js, .py, .sh).");
  }
  const full = path.join(SCRIPTS_DIR, name);
  if (path.dirname(full) !== SCRIPTS_DIR) throw new HttpError(400, "Script en dehors du dossier autorisé.");
  try {
    if (!(await fs.stat(full)).isFile()) throw new Error();
  } catch {
    throw new HttpError(400, `Script introuvable dans le dossier des scripts : ${name}`);
  }
  return full;
}

// ---------- historique ----------
async function appendRun(run) {
  return withLock(async () => {
    const runs = await readJson(RUNS_FILE(), []);
    runs.unshift(run);
    await writeJson(RUNS_FILE(), runs.slice(0, MAX_RUNS));
  });
}

async function patchRun(id, patch) {
  return withLock(async () => {
    const runs = await readJson(RUNS_FILE(), []);
    const i = runs.findIndex((r) => r.id === id);
    if (i >= 0) {
      runs[i] = { ...runs[i], ...patch };
      await writeJson(RUNS_FILE(), runs);
    }
  });
}

export async function listRuns(taskId, limit = 20) {
  const runs = await readJson(RUNS_FILE(), []);
  const filtered = taskId ? runs.filter((r) => r.taskId === taskId) : runs;
  return filtered.slice(0, Math.min(Math.max(Number(limit) || 20, 1), 100));
}

// ---------- liste des tâches ----------
export async function listTasks() {
  const [config, settings, runs] = await Promise.all([loadTaskConfig(), getSettings(), readJson(RUNS_FILE(), [])]);

  const all = [
    ...BUILTIN.map((b) => {
      const ov = config.overrides[b.id] || {};
      const isRefresh = b.id === "refresh-guidances";
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        builtin: true,
        category: b.category || null,
        enabled: isRefresh ? settings.autoRefresh.enabled : ov.enabled ?? true,
        intervalHours: isRefresh ? settings.autoRefresh.intervalHours : ov.intervalHours ?? b.defaultIntervalHours ?? null,
      };
    }),
    ...config.custom.map((c) => ({ ...c, builtin: false, description: `Script : ${c.script}` })),
  ];

  return all.map((t) => {
    const last = runs.find((r) => r.taskId === t.id) || null;
    const lastStart = last ? Date.parse(last.startedAt) : bootTime;
    return {
      ...t,
      running: running.has(t.id),
      lastRun: last && { startedAt: last.startedAt, endedAt: last.endedAt, status: last.status, trigger: last.trigger },
      nextRunAt: t.enabled && t.intervalHours ? new Date(lastStart + t.intervalHours * 3600000).toISOString() : null,
    };
  });
}

export async function getAutoSchedule() {
  const t = (await listTasks()).find((x) => x.id === "refresh-guidances");
  return { enabled: t.enabled, intervalHours: t.intervalHours, nextRunAt: t.nextRunAt, lastRunAt: t.lastRun?.startedAt || null };
}

async function findTask(id) {
  return (await listTasks()).find((t) => t.id === id) || null;
}

// ---------- exécution ----------
function execScript(task, full) {
  return new Promise((resolve) => {
    const cmd = INTERPRETERS[path.extname(full)];
    execFile(
      cmd,
      [full, ...(task.args || [])],
      {
        cwd: SCRIPTS_DIR,
        timeout: (task.timeoutSec || 300) * 1000,
        maxBuffer: 1024 * 1024,
        env: { PATH: process.env.PATH, RIVOTRA_DATA_DIR: DATA_DIR, RIVOTRA_DATE: todayUtc(), LANG: "C.UTF-8" },
      },
      (err, stdout, stderr) => {
        const logs = `${stdout || ""}${stderr ? `\n[stderr]\n${stderr}` : ""}`.trim();
        if (!err) return resolve({ ok: true, exitCode: 0, logs });
        const timedOut = err.killed && err.signal === "SIGTERM";
        resolve({
          ok: false,
          exitCode: typeof err.code === "number" ? err.code : null,
          logs: `${logs}\n${timedOut ? `[Interrompu : délai de ${task.timeoutSec || 300} s dépassé]` : `[Erreur : ${err.message}]`}`.trim(),
        });
      }
    );
  });
}

// Lance une tâche. Renvoie { run, done } : `run` est l'enregistrement initial
// (statut "running"), `done` se résout quand l'exécution est terminée.
export async function runTask(taskId, trigger = "manual") {
  const task = await findTask(taskId);
  if (!task) throw new HttpError(404, "Tâche inconnue.");
  if (running.has(taskId)) throw new HttpError(409, "Cette tâche est déjà en cours d'exécution.");

  const run = {
    id: crypto.randomUUID(),
    taskId,
    taskName: task.name,
    trigger,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: "running",
    exitCode: null,
    logs: "",
  };
  running.set(taskId, run.id);
  await appendRun(run);
  if (task.category) await setCategoryStatus(task.category, "en_cours");

  const done = (async () => {
    let result;
    try {
      if (task.builtin) {
        const builtin = BUILTIN.find((b) => b.id === taskId);
        result = { ok: true, exitCode: 0, logs: await builtin.run() };
      } else {
        result = await execScript(task, await resolveScript(task.script));
      }
    } catch (err) {
      result = { ok: false, exitCode: null, logs: `[Erreur : ${err.message}]` };
    }
    const status = result.ok ? "success" : "error";
    await patchRun(run.id, { endedAt: new Date().toISOString(), status, exitCode: result.exitCode, logs: result.logs.slice(-MAX_LOG) });
    running.delete(taskId);
    if (task.category) await setCategoryStatus(task.category, result.ok ? "disponible" : "erreur");
    if (!task.builtin || !result.ok) {
      await addEvent(result.ok ? "info" : "error", result.ok ? `Tâche « ${task.name} » terminée.` : `Échec de la tâche « ${task.name} ».`);
    }
    return { ...run, status, endedAt: new Date().toISOString(), logs: result.logs.slice(-MAX_LOG) };
  })();

  return { run, done };
}

// ---------- gestion des tâches personnalisées ----------
function validateCustom(input, { partial = false } = {}) {
  const out = {};
  const bad = (m) => {
    throw new HttpError(400, m);
  };
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 80) bad("Nom invalide (1 à 80 caractères).");
    out.name = input.name.trim();
  }
  if (!partial || input.args !== undefined) {
    const args = input.args ?? [];
    if (!Array.isArray(args) || args.length > 10 || args.some((a) => typeof a !== "string" || a.length > 200)) {
      bad("Arguments invalides (10 maximum, 200 caractères chacun).");
    }
    out.args = args;
  }
  if (!partial || input.intervalHours !== undefined) {
    const h = input.intervalHours;
    if (h !== null && h !== undefined && (!Number.isInteger(h) || h < 1 || h > 168)) bad("Intervalle : entier entre 1 et 168 heures (ou vide).");
    out.intervalHours = h ?? null;
  }
  if (!partial || input.timeoutSec !== undefined) {
    const t = input.timeoutSec ?? 300;
    if (!Number.isInteger(t) || t < 5 || t > 3600) bad("Délai maximal : entier entre 5 et 3600 secondes.");
    out.timeoutSec = t;
  }
  if (!partial || input.category !== undefined) {
    if (input.category && !getCategory(input.category)) bad("Catégorie inconnue.");
    out.category = input.category || null;
  }
  if (input.enabled !== undefined) out.enabled = Boolean(input.enabled);
  return out;
}

export async function createCustomTask(input) {
  const fields = validateCustom(input);
  await resolveScript(input.script);
  const config = await loadTaskConfig();
  if (config.custom.length >= 30) throw new HttpError(400, "Nombre maximal de tâches personnalisées atteint (30).");
  const task = {
    id: `custom-${crypto.randomBytes(4).toString("hex")}`,
    script: input.script,
    enabled: input.enabled ?? true,
    createdAt: new Date().toISOString(),
    ...fields,
  };
  config.custom.push(task);
  await writeJson(TASKS_FILE(), config);
  await addEvent("info", `Tâche « ${task.name} » créée.`);
  return task;
}

export async function updateTask(id, patch) {
  const config = await loadTaskConfig();
  const builtin = BUILTIN.find((b) => b.id === id);

  if (builtin) {
    if (id === "refresh-guidances") {
      const ar = {};
      if (patch.enabled !== undefined) ar.enabled = Boolean(patch.enabled);
      if (patch.intervalHours !== undefined) ar.intervalHours = patch.intervalHours;
      await updateSettings({ autoRefresh: ar });
    } else {
      const h = patch.intervalHours;
      if (h !== undefined && h !== null && (!Number.isInteger(h) || h < 1 || h > 168)) throw new HttpError(400, "Intervalle : entier entre 1 et 168 heures.");
      config.overrides[id] = { ...(config.overrides[id] || {}), ...(patch.enabled !== undefined ? { enabled: Boolean(patch.enabled) } : {}), ...(h !== undefined ? { intervalHours: h } : {}) };
      await writeJson(TASKS_FILE(), config);
    }
    return findTask(id);
  }

  const i = config.custom.findIndex((c) => c.id === id);
  if (i < 0) throw new HttpError(404, "Tâche inconnue.");
  const fields = validateCustom(patch, { partial: true });
  if (patch.script !== undefined) {
    await resolveScript(patch.script);
    fields.script = patch.script;
  }
  config.custom[i] = { ...config.custom[i], ...fields };
  await writeJson(TASKS_FILE(), config);
  return findTask(id);
}

export async function deleteTask(id) {
  if (BUILTIN.some((b) => b.id === id)) throw new HttpError(400, "Les tâches intégrées ne peuvent pas être supprimées.");
  const config = await loadTaskConfig();
  const i = config.custom.findIndex((c) => c.id === id);
  if (i < 0) throw new HttpError(404, "Tâche inconnue.");
  const [removed] = config.custom.splice(i, 1);
  await writeJson(TASKS_FILE(), config);
  await addEvent("info", `Tâche « ${removed.name} » supprimée.`);
}

// ---------- planificateur ----------
let timer = null;

async function tick() {
  try {
    const now = Date.now();
    for (const t of await listTasks()) {
      if (t.enabled && t.intervalHours && !t.running && t.nextRunAt && now >= Date.parse(t.nextRunAt)) {
        runTask(t.id, "schedule").catch((e) => console.error(`[planificateur] ${t.id} :`, e.message));
      }
    }
  } catch (err) {
    console.error("[planificateur] erreur :", err.message);
  }
}

export async function startScheduler() {
  if (process.env.DISABLE_SCHEDULER === "1") return false;
  // Les exécutions restées "running" après un arrêt brutal sont marquées interrompues.
  await withLock(async () => {
    const runs = await readJson(RUNS_FILE(), []);
    let changed = false;
    for (const r of runs) {
      if (r.status === "running") {
        r.status = "error";
        r.endedAt = new Date().toISOString();
        r.logs = `${r.logs}\n[Interrompu par un redémarrage du serveur]`.trim();
        changed = true;
      }
    }
    if (changed) await writeJson(RUNS_FILE(), runs);
  });
  timer = setInterval(tick, 30000);
  timer.unref();
  return true;
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
