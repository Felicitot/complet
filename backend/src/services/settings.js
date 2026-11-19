// Réglages persistants (modifiables depuis la page "Paramètres").
//
// Chaque catégorie peut fonctionner en deux modes :
//  - "simulated" : images d'exemple générées par le serveur (par défaut) ;
//  - "files"     : lecture des vrais PNG produits par vos scripts, à partir
//                  d'un modèle de chemin configurable, par exemple
//                  /sorties/{category}/{date}/{run}/{model}/J{day}.png

import path from "path";
import { DATA_DIR } from "../config.js";
import { dataPath, readJson, writeJson } from "./jsonStore.js";
import { HttpError } from "../utils/http.js";

export const TEMPLATE_TOKENS = ["category", "date", "yyyy", "mm", "dd", "run", "runHour", "model", "type", "item", "day"];

const DEFAULTS = {
  sources: {
    vent: { mode: "simulated", pathTemplate: "/sorties/{category}/{date}/{run}/{model}/J{day}.png" },
    pluies: { mode: "simulated", pathTemplate: "/sorties/{category}/{date}/{type}/{run}/{model}/J{day}.png" },
    houles: { mode: "simulated", pathTemplate: "/sorties/{category}/{date}/{run}/{model}/J{day}.png" },
    temperatures: { mode: "simulated", pathTemplate: "/sorties/{category}/{date}/{run}/{model}/J{day}.png" },
    previsions_specifiques: { mode: "simulated", pathTemplate: "/sorties/{category}/{date}/{item}.png" },
    satellites: { mode: "simulated", directory: "/sorties/satellites" },
  },
  autoRefresh: { enabled: true, intervalHours: 6 },
  archiveDays: 14,
};

const FILE = () => dataPath("settings.json");

function merge(stored = {}) {
  const sources = {};
  for (const id of Object.keys(DEFAULTS.sources)) {
    sources[id] = { ...DEFAULTS.sources[id], ...(stored.sources?.[id] || {}) };
  }
  return {
    sources,
    autoRefresh: { ...DEFAULTS.autoRefresh, ...(stored.autoRefresh || {}) },
    archiveDays: stored.archiveDays ?? DEFAULTS.archiveDays,
  };
}

export async function getSettings() {
  return merge(await readJson(FILE(), {}));
}

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;

// Le cache interne (DATA_DIR/guidances) est vidé à chaque actualisation : y
// pointer vos vrais fichiers les ferait supprimer. On l'interdit donc.
function assertOutsideCache(p, label) {
  const root = path.resolve(DATA_DIR, "guidances");
  const prefix = path.resolve(p.split("{")[0] || "/");
  if (prefix === root || prefix.startsWith(root + path.sep)) {
    throw new HttpError(400, `${label} : ce dossier est le cache interne de Rivotra (vidé à chaque actualisation). Choisissez un autre emplacement pour vos fichiers.`);
  }
}

export function validatePathTemplate(tpl, label) {
  if (typeof tpl !== "string" || !tpl.trim() || tpl.length > 300) {
    throw new HttpError(400, `${label} : modèle de chemin invalide.`);
  }
  if (!ABSOLUTE.test(tpl)) throw new HttpError(400, `${label} : le chemin doit être absolu (ex. /data/guidances/...).`);
  if (tpl.includes("..")) throw new HttpError(400, `${label} : « .. » n'est pas autorisé dans le chemin.`);
  if (!/\.png$/i.test(tpl)) throw new HttpError(400, `${label} : le modèle doit se terminer par .png.`);
  assertOutsideCache(tpl, label);
  const tokens = [...tpl.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  const unknown = tokens.filter((t) => !TEMPLATE_TOKENS.includes(t));
  if (unknown.length) {
    throw new HttpError(400, `${label} : variable(s) inconnue(s) {${unknown.join("}, {")}}. Variables permises : ${TEMPLATE_TOKENS.map((t) => `{${t}}`).join(" ")}.`);
  }
}

export async function updateSettings(patch) {
  const current = await getSettings();
  const next = merge({
    ...current,
    ...patch,
    sources: { ...current.sources },
    autoRefresh: { ...current.autoRefresh, ...(patch.autoRefresh || {}) },
  });

  if (patch.sources) {
    for (const [id, cfg] of Object.entries(patch.sources)) {
      if (!DEFAULTS.sources[id]) throw new HttpError(400, `Catégorie inconnue : ${id}`);
      if (!["simulated", "files"].includes(cfg.mode ?? next.sources[id].mode)) {
        throw new HttpError(400, `${id} : mode invalide (simulated ou files).`);
      }
      next.sources[id] = { ...current.sources[id], ...cfg };
      if (id === "satellites") {
        if (next.sources[id].mode === "files") {
          const dir = next.sources[id].directory;
          if (typeof dir !== "string" || !ABSOLUTE.test(dir) || dir.includes("..") || dir.length > 300) {
            throw new HttpError(400, "satellites : dossier invalide (chemin absolu requis).");
          }
          assertOutsideCache(dir, "satellites");
        }
      } else if (next.sources[id].mode === "files") {
        validatePathTemplate(next.sources[id].pathTemplate, id);
      }
    }
  }
  if (patch.autoRefresh) {
    const h = Number(next.autoRefresh.intervalHours);
    if (!Number.isInteger(h) || h < 1 || h > 168) throw new HttpError(400, "Intervalle d'actualisation : entier entre 1 et 168 heures.");
    next.autoRefresh = { enabled: Boolean(next.autoRefresh.enabled), intervalHours: h };
  }
  if (patch.archiveDays !== undefined) {
    const d = Number(patch.archiveDays);
    if (!Number.isInteger(d) || d < 1 || d > 90) throw new HttpError(400, "Fenêtre d'archive : entier entre 1 et 90 jours.");
    next.archiveDays = d;
  }

  await writeJson(FILE(), next);
  return next;
}

// Remplace les {variables} par des valeurs assainies : aucune valeur de
// requête ne peut ajouter de séparateur de chemin ni remonter l'arborescence.
export function resolveTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? "").replace(/[^A-Za-z0-9_-]/g, "_"));
}
