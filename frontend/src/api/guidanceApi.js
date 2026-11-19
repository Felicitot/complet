import { API_BASE_URL, request } from "./client.js";

export const fetchCategories = () => request("/guidance/categories");
export const fetchStatus = () => request("/guidance/status");
export const fetchSchedule = () => request("/guidance/schedule");
export const fetchSources = () => request("/guidance/sources");
export const fetchEvents = (limit = 15) => request(`/guidance/events?limit=${limit}`);
export const fetchArchiveDates = () => request("/guidance/archives/dates");
export const fetchSatellites = () => request("/guidance/satellites");
export const triggerRefresh = () => request("/guidance/refresh", { method: "POST" });

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, v));
  return p.toString();
}

// URL d'une image de guidance. `epoch` (paramètre v) force le rechargement
// par le navigateur après une actualisation.
export function guidanceImageUrl(categoryId, { date, run, model, type, item, day, epoch }) {
  return `${API_BASE_URL}/guidance/${categoryId}/image?${qs({ date, run, model, type, item, day, v: epoch })}`;
}

// Archive ZIP : toutes les échéances du run choisi (ou tous les phénomènes).
export function guidanceZipUrl(categoryId, { date, run, model, type }) {
  return `${API_BASE_URL}/guidance/${categoryId}/zip?${qs({ date, run, model, type })}`;
}

export const satelliteImageUrl = (url) => `${API_BASE_URL.replace(/\/api$/, "")}${url}`;
