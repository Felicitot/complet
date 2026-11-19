import { Router } from "express";
import fs from "fs/promises";
import { requireAdmin } from "../services/auth.js";
import { getSettings, updateSettings, validatePathTemplate, TEMPLATE_TOKENS } from "../services/settings.js";
import { addEvent } from "../services/events.js";
import { getCategory } from "../data/categories.js";
import { validateParams, sourcePathFor } from "../services/guidanceGenerator.js";
import { listTasks, runTask, listRuns, createCustomTask, updateTask, deleteTask, listScripts } from "../services/tasks.js";
import { HttpError, ah } from "../utils/http.js";

const router = Router();
router.use(requireAdmin);

router.get("/settings", ah(async (req, res) => res.json({ settings: await getSettings(), templateTokens: TEMPLATE_TOKENS })));

router.put("/settings", ah(async (req, res) => {
  const settings = await updateSettings(req.body || {});
  await addEvent("info", "Paramètres modifiés par l'administrateur.");
  res.json({ settings });
}));

// Vérifie un modèle de chemin pour une sélection d'exemple, sans l'enregistrer.
router.get("/settings/test", ah(async (req, res) => {
  const category = getCategory(req.query.category);
  if (!category || category.kind === "gallery") throw new HttpError(400, "Catégorie invalide pour ce test.");
  const template = req.query.template || (await getSettings()).sources[category.id].pathTemplate;
  validatePathTemplate(template, category.id);
  const params = await validateParams(category, req.query);
  const file = sourcePathFor(category, params, template);
  let exists = false;
  let sizeBytes = null;
  try {
    const st = await fs.stat(file);
    exists = st.isFile();
    sizeBytes = exists ? st.size : null;
  } catch {
    /* fichier absent */
  }
  res.json({ path: file, exists, sizeBytes });
}));

router.get("/scripts", ah(async (req, res) => res.json({ scripts: await listScripts() })));

router.get("/tasks", ah(async (req, res) => res.json({ tasks: await listTasks() })));

router.post("/tasks", ah(async (req, res) => res.status(201).json({ task: await createCustomTask(req.body || {}) })));

router.patch("/tasks/:id", ah(async (req, res) => res.json({ task: await updateTask(req.params.id, req.body || {}) })));

router.delete("/tasks/:id", ah(async (req, res) => {
  await deleteTask(req.params.id);
  res.status(204).end();
}));

router.post("/tasks/:id/run", ah(async (req, res) => {
  const { run } = await runTask(req.params.id, "manual");
  res.status(202).json({ run });
}));

router.get("/tasks/:id/runs", ah(async (req, res) => res.json({ runs: await listRuns(req.params.id, req.query.limit) })));

router.get("/runs", ah(async (req, res) => res.json({ runs: await listRuns(null, req.query.limit) })));

export default router;
