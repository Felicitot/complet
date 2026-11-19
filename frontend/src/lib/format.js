export const pad2 = (n) => String(n).padStart(2, "0");

export const todayUtc = () => new Date().toISOString().slice(0, 10);

// "2026-11-04" -> "04/11/2026"
export const fmtDateFr = (d) => (d ? d.split("-").reverse().join("/") : "");

export function runHour(run) {
  const m = /^Run(\d{2})$/.exec(run || "");
  return m ? Number(m[1]) : 0;
}

// Heure de validité d'une échéance : date du run + heure du run + jour × 24 h.
export function validTimeLabel(date, run, day) {
  const t = new Date(`${date}T${pad2(runHour(run))}:00:00Z`);
  t.setUTCHours(t.getUTCHours() + day * 24);
  return `${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()} ${pad2(t.getUTCHours())}Z`;
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return "—";
  const s = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 1000));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

// "dans 4 h 12 min" / "dans 35 min" / "imminente"
export function untilLabel(iso, now = Date.now()) {
  if (!iso) return null;
  const min = Math.round((Date.parse(iso) - now) / 60000);
  if (min <= 0) return "imminente";
  if (min < 60) return `dans ${min} min`;
  return `dans ${Math.floor(min / 60)} h ${pad2(min % 60)} min`;
}

export function agoLabel(iso, now = Date.now()) {
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`;
  return `il y a ${Math.floor(min / 1440)} j`;
}

// Normalise pour la recherche : minuscules, sans accents.
export const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
