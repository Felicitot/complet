// Orchestrateur des images de guidance.
//
// Pour une catégorie + une sélection (date du run, run, modèle/type, échéance
// ou phénomène), renvoie un PNG :
//  - mode "simulated" : image d'exemple générée puis mise en cache disque ;
//  - mode "files"     : lecture du vrai PNG produit par vos scripts, selon le
//                       modèle de chemin défini dans la page Paramètres.
//
// "Actualiser" incrémente un epoch global et vide le cache : les mêmes
// sélections redonnent alors de nouvelles images (comme un nouveau run).

import fs from "fs/promises";
import path from "path";
import { getCategory, CATEGORIES } from "../data/categories.js";
import { renderChartPNG } from "./chartRenderer.js";
import { renderSatelliteThumbnail } from "./satelliteRenderer.js";
import { getCached, setCached, clearAllCache, clearCategoryCache, readStatus, writeStatus } from "./guidanceStore.js";
import { getSettings, resolveTemplate } from "./settings.js";
import { addEvent } from "./events.js";
import { HttpError } from "../utils/http.js";

// ---------- dates et horaires ----------
export const todayUtc = () => new Date().toISOString().slice(0, 10);

export function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function runHour(run) {
  const m = /^Run(\d{2})$/.exec(run || "");
  return m ? Number(m[1]) : 0;
}

const pad = (n) => String(n).padStart(2, "0");

export function fmtZ(d) {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}Z`;
}

export function validTime(date, run, day) {
  const t = new Date(`${date}T${pad(runHour(run))}:00:00Z`);
  t.setUTCHours(t.getUTCHours() + day * 24);
  return t;
}

// ---------- validation des paramètres de requête ----------
export async function validateParams(category, q = {}) {
  const settings = await getSettings();
  const today = todayUtc();
  const date = q.date || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new HttpError(400, "Paramètre « date » invalide (format AAAA-MM-JJ).");
  }
  const oldest = addDays(today, -(settings.archiveDays - 1));
  if (date > today || date < oldest) {
    throw new HttpError(400, `Date hors de la fenêtre d'archive (${settings.archiveDays} derniers jours : ${oldest} à ${today}).`);
  }

  const pick = (value, allowed, name) => {
    const v = value ?? allowed[0];
    if (!allowed.includes(v)) throw new HttpError(400, `Paramètre « ${name} » invalide. Valeurs permises : ${allowed.join(", ")}.`);
    return v;
  };
  const pickDay = () => {
    const day = q.day === undefined ? 1 : Number(q.day);
    if (!Number.isInteger(day) || day < 1 || day > category.maxDay) {
      throw new HttpError(400, `Paramètre « day » invalide (entier de 1 à ${category.maxDay}).`);
    }
    return day;
  };

  switch (category.kind) {
    case "model_run":
      return { date, run: pick(q.run, category.runs, "run"), model: pick(q.model, category.models, "model"), day: pickDay() };
    case "type_model_run":
      return {
        date,
        type: pick(q.type, category.types, "type"),
        run: pick(q.run, category.runs, "run"),
        model: pick(q.model, category.models, "model"),
        day: pickDay(),
      };
    case "items":
      return { date, item: pick(q.item, category.items.map((i) => i.id), "item") };
    default:
      return { date };
  }
}

// ---------- epoch / clés de cache ----------
function seedFromKey(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 100;
}

async function getEpoch() {
  const status = await readStatus();
  return status._epoch || 1;
}

function buildKey(category, p, epoch) {
  const parts = [category.id, p.date];
  if (p.type) parts.push(p.type);
  if (p.run) parts.push(p.run);
  if (p.model) parts.push(p.model);
  if (p.day) parts.push(`J${p.day}`);
  if (p.item) parts.push(p.item);
  parts.push(`e${epoch}`);
  return parts.join("_");
}

// ---------- rendu simulé ----------
const FOOTNOTE = "Rivotra — Météo Madagascar (exemple provisoire, pas une vraie prévision)";

async function renderSimulated(category, p, epoch) {
  const seed = seedFromKey(buildKey(category, p, epoch));

  if (category.kind === "items") {
    const item = category.items.find((i) => i.id === p.item) || category.items[0];
    return renderChartPNG({
      title: `${category.label.toUpperCase()} — ${item.label}`,
      subtitleLeft: `Analyse du ${p.date.split("-").reverse().join("/")}`,
      subtitleRight: `Dernière actualisation · v${epoch}`,
      colormapId: item.colormap,
      seed,
      showBarbs: false,
      footnote: FOOTNOTE,
    });
  }

  const vt = validTime(p.date, p.run, p.day);
  const runLabel = `${p.run} du ${p.date.split("-").reverse().join("/")}`;
  return renderChartPNG({
    title: `${category.label.toUpperCase()} — ${p.model}`,
    subtitleLeft: `${runLabel}${p.type ? " · " + p.type : ""} · Échéance +${p.day * 24}h`,
    subtitleRight: `Valable le ${fmtZ(vt)}`,
    colormapId: category.colormap,
    seed,
    showBarbs: !!category.showBarbs,
    footnote: FOOTNOTE,
  });
}

// ---------- lecture de vrais fichiers ----------
export function sourcePathFor(category, p, template) {
  const [yyyy, mm, dd] = p.date.split("-");
  return resolveTemplate(template, {
    category: category.id,
    date: p.date,
    yyyy,
    mm,
    dd,
    run: p.run,
    runHour: p.run ? pad(runHour(p.run)) : "",
    model: p.model,
    type: p.type,
    item: p.item,
    day: p.day,
  });
}

async function readSourceFile(file) {
  try {
    return await fs.readFile(file);
  } catch (err) {
    if (["ENOENT", "EISDIR", "ENOTDIR"].includes(err.code)) {
      throw new HttpError(404, "Image non disponible pour cette sélection.");
    }
    throw err;
  }
}

// Renvoie { buffer, source: "simulated" | "file" }.
export async function getChartImage(categoryId, p) {
  const category = getCategory(categoryId);
  if (!category) throw new HttpError(404, "Catégorie inconnue.");

  const settings = await getSettings();
  const source = settings.sources[categoryId];

  if (source?.mode === "files") {
    const file = sourcePathFor(category, p, source.pathTemplate);
    return { buffer: await readSourceFile(file), source: "file" };
  }

  const epoch = await getEpoch();
  const key = buildKey(category, p, epoch);
  const cached = await getCached(categoryId, key);
  if (cached) return { buffer: cached, source: "simulated" };

  const buffer = await renderSimulated(category, p, epoch);
  await setCached(categoryId, key, buffer);
  return { buffer, source: "simulated" };
}

// ---------- actualisation et statut ----------
export async function refreshAll() {
  const status = await readStatus();
  const nextEpoch = (status._epoch || 1) + 1;
  await clearAllCache();

  const now = new Date().toISOString();
  const next = { _epoch: nextEpoch };
  CATEGORIES.forEach((c) => {
    next[c.id] = { status: "disponible", lastUpdate: now };
  });
  await writeStatus(next);
  await addEvent("info", `Actualisation des guidances terminée (v${nextEpoch}).`);
  return { processedAt: now, epoch: nextEpoch };
}

// Une catégorie sans historique est « disponible » : les images peuvent être
// produites à la demande, il n'y a pas besoin d'une première actualisation.
export async function getStatus() {
  const status = await readStatus();
  const { _epoch, ...rest } = status;
  const categories = {};
  CATEGORIES.forEach((c) => {
    categories[c.id] = { status: "disponible", lastUpdate: null, ...(rest[c.id] || {}) };
  });
  return { epoch: _epoch || 1, categories };
}

export async function setCategoryStatus(categoryId, state) {
  const status = await readStatus();
  status[categoryId] = { ...status[categoryId], status: state, lastUpdate: new Date().toISOString() };
  await writeStatus(status);
}

// ---------- satellites ----------
const IMG_EXT = /\.(png|jpe?g)$/i;
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

async function listSatelliteFiles(dir, count) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const e of entries) {
    if (!e.isFile() || !IMG_EXT.test(e.name)) continue;
    const st = await fs.stat(path.join(dir, e.name));
    files.push({ name: e.name, mtime: st.mtime });
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return files
    .slice(0, count)
    .reverse()
    .map((f) => {
      const key = `f_${Buffer.from(f.name).toString("base64url")}`;
      return {
        key,
        label: `${f.mtime.toISOString().slice(0, 16).replace("T", " ")} UTC`,
        url: `/api/guidance/satellites/image/${key}`,
      };
    });
}

export async function getSatelliteThumbnails(count = 8) {
  const settings = await getSettings();
  const cfg = settings.sources.satellites;
  if (cfg.mode === "files") {
    return { source: "file", items: await listSatelliteFiles(cfg.directory, count) };
  }

  const epoch = await getEpoch();
  const SLOT = 6 * 3600 * 1000;
  const base = Math.floor(Date.now() / SLOT) * SLOT;
  const items = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(base - i * SLOT);
    const label = `${t.toISOString().slice(0, 13).replace("T", " ")}:00 UTC`;
    const key = `sat_${t.toISOString().slice(0, 13)}_e${epoch}`;
    let buf = await getCached("satellites", key);
    if (!buf) {
      buf = await renderSatelliteThumbnail({ timestampLabel: label, seedKey: key });
      await setCached("satellites", key, buf);
    }
    items.push({ key, label, url: `/api/guidance/satellites/image/${key}` });
  }
  return { source: "simulated", items };
}

export async function getSatelliteImage(key) {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return null;
  if (key.startsWith("f_")) {
    const settings = await getSettings();
    const cfg = settings.sources.satellites;
    if (cfg.mode !== "files") return null;
    let name;
    try {
      name = Buffer.from(key.slice(2), "base64url").toString("utf-8");
    } catch {
      return null;
    }
    if (name !== path.basename(name) || !IMG_EXT.test(name)) return null;
    try {
      const buffer = await fs.readFile(path.join(cfg.directory, name));
      return { buffer, contentType: MIME[path.extname(name).toLowerCase()] || "image/png" };
    } catch {
      return null;
    }
  }
  const buffer = await getCached("satellites", key);
  return buffer ? { buffer, contentType: "image/png" } : null;
}

export async function refreshSatellites() {
  await clearCategoryCache("satellites");
  const result = await getSatelliteThumbnails(8);
  await setCategoryStatus("satellites", "disponible");
  return { count: result.items.length, source: result.source };
}
