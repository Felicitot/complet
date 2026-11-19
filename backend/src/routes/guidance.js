import { Router } from "express";
import { ZipArchive } from "archiver";
import { CATEGORIES, getCategory } from "../data/categories.js";
import {
  getChartImage,
  getStatus,
  getSatelliteThumbnails,
  getSatelliteImage,
  validateParams,
  todayUtc,
  addDays,
} from "../services/guidanceGenerator.js";
import { getSettings } from "../services/settings.js";
import { listEvents } from "../services/events.js";
import { runTask, getAutoSchedule } from "../services/tasks.js";
import { HttpError, ah } from "../utils/http.js";
import { rateLimit } from "../utils/rateLimit.js";

const router = Router();

// Une seule actualisation à la fois, espacées d'au moins N ms (anti-abus).
const refreshLimiter = rateLimit({
  windowMs: Number(process.env.REFRESH_MIN_INTERVAL_MS ?? 10000),
  max: 1,
  keyFn: () => "global",
  message: "Actualisation trop fréquente, patientez quelques secondes.",
});

router.get("/categories", (req, res) => res.json(CATEGORIES));

router.get("/status", ah(async (req, res) => res.json(await getStatus())));

router.get("/schedule", ah(async (req, res) => res.json(await getAutoSchedule())));

// Mode de chaque catégorie (simulé ou fichiers réels), sans révéler les chemins.
router.get("/sources", ah(async (req, res) => {
  const s = await getSettings();
  const sources = Object.fromEntries(Object.entries(s.sources).map(([id, c]) => [id, { mode: c.mode }]));
  res.json({ sources, archiveDays: s.archiveDays });
}));

router.get("/events", ah(async (req, res) => res.json({ events: await listEvents(req.query.limit) })));

router.get("/archives/dates", ah(async (req, res) => {
  const { archiveDays } = await getSettings();
  const today = todayUtc();
  res.json({ dates: Array.from({ length: archiveDays }, (_, i) => addDays(today, -i)) });
}));

// Équivaut au bouton "Actualiser" : exécute la tâche intégrée et attend sa fin.
router.post("/refresh", refreshLimiter, ah(async (req, res) => {
  const { done } = await runTask("refresh-guidances", "manual");
  const result = await done;
  if (result.status !== "success") throw new HttpError(500, result.logs || "L'actualisation a échoué.");
  const status = await getStatus();
  res.json({ status: "ok", processedAt: result.endedAt, epoch: status.epoch });
}));

router.get("/satellites", ah(async (req, res) => res.json(await getSatelliteThumbnails(8))));

router.get("/satellites/image/:key", ah(async (req, res) => {
  const img = await getSatelliteImage(req.params.key);
  if (!img) throw new HttpError(404, "Image non trouvée.");
  res.set({ "Content-Type": img.contentType, "Cache-Control": "public, max-age=3600" });
  res.send(img.buffer);
}));

function categoryOr404(id) {
  const category = getCategory(id);
  if (!category) throw new HttpError(404, "Catégorie inconnue.");
  if (category.kind === "gallery") throw new HttpError(400, "Cette catégorie est une galerie : utilisez /satellites.");
  return category;
}

router.get("/:category/image", ah(async (req, res) => {
  const category = categoryOr404(req.params.category);
  const params = await validateParams(category, req.query);
  const { buffer, source } = await getChartImage(category.id, params);
  res.set({
    "Content-Type": "image/png",
    "Cache-Control": source === "file" ? "no-cache" : "public, max-age=300",
    "X-Image-Source": source,
  });
  res.send(buffer);
}));

// Archive ZIP des échéances J+1..J+n du run choisi (ou de tous les phénomènes).
router.get("/:category/zip", ah(async (req, res) => {
  const category = categoryOr404(req.params.category);
  const base = await validateParams(category, req.query);

  const selections =
    category.kind === "items"
      ? category.items.map((i) => ({ params: { ...base, item: i.id }, name: `${category.id}_${base.date}_${i.id}.png` }))
      : Array.from({ length: category.maxDay }, (_, i) => ({
          params: { ...base, day: i + 1 },
          name: `${category.id}_${base.date}_${base.type ? base.type + "_" : ""}${base.run}_${base.model}_J${i + 1}.png`,
        }));

  const files = [];
  for (const s of selections) {
    try {
      files.push({ name: s.name, buffer: (await getChartImage(category.id, s.params)).buffer });
    } catch (err) {
      if (!(err instanceof HttpError && err.status === 404)) throw err; // fichier réel absent : on l'ignore
    }
  }
  if (!files.length) throw new HttpError(404, "Aucune image disponible pour cette sélection.");

  const zipName = `${category.id}_${base.date}${base.run ? "_" + base.run : ""}${base.model ? "_" + base.model : ""}.zip`;
  res.set({ "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${zipName}"` });
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("error", (err) => res.destroy(err));
  archive.pipe(res);
  files.forEach((f) => archive.append(f.buffer, { name: f.name }));
  await archive.finalize();
}));

export default router;
