import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { startServer, isPng, sleep } from "./helpers.js";

let s;
let auth;
const today = new Date().toISOString().slice(0, 10);

before(async () => {
  s = await startServer();
  fs.writeFileSync(path.join(s.scripts, "ok.js"), 'console.log("bonjour " + process.argv.slice(2).join(","));');
  fs.writeFileSync(path.join(s.scripts, "echec.sh"), "#!/bin/sh\necho oups >&2\nexit 3\n");
  fs.writeFileSync(path.join(s.scripts, "lent.js"), "setTimeout(() => console.log('fini'), 1500);");
  fs.writeFileSync(path.join(s.scripts, "note.txt"), "pas un script");
});
after(async () => {
  await s.close();
});

async function login() {
  const { data } = await s.json("POST", "/api/auth/login", { password: "mot-de-passe-test" });
  auth = { Authorization: `Bearer ${data.token}` };
}

async function waitRun(taskId, timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const { data } = await s.json("GET", `/api/admin/tasks/${taskId}/runs`, undefined, auth);
    if (data.runs[0] && data.runs[0].status !== "running") return data.runs[0];
    await sleep(100);
  }
  throw new Error("délai dépassé en attendant la fin de la tâche");
}

test("authentification : accès refusé sans jeton valide", async () => {
  assert.equal((await s.get("/api/admin/settings")).status, 401);
  assert.equal((await s.get("/api/admin/settings", { Authorization: "Bearer faux.jeton" })).status, 401);
  assert.equal((await s.json("POST", "/api/auth/login", { password: "mauvais" })).res.status, 401);
  assert.equal((await s.json("POST", "/api/auth/login", {})).res.status, 401);
});

test("authentification : connexion réussie puis accès", async () => {
  const { res, data } = await s.json("POST", "/api/auth/login", { password: "mot-de-passe-test" });
  assert.equal(res.status, 200);
  assert.ok(data.token.includes("."));
  assert.ok(Date.parse(data.expiresAt) > Date.now());
  auth = { Authorization: `Bearer ${data.token}` };
  assert.equal((await s.get("/api/admin/settings", auth)).status, 200);
  assert.equal((await s.get("/api/auth/me", auth)).status, 200);
});

test("réglages : validation des modèles de chemin", async () => {
  const bad = async (tpl) =>
    (await s.json("PUT", "/api/admin/settings", { sources: { vent: { mode: "files", pathTemplate: tpl } } }, auth)).res.status;
  assert.equal(await bad("relatif/{run}.png"), 400);
  assert.equal(await bad("/data/{inconnu}/x.png"), 400);
  assert.equal(await bad("/data/../etc/{run}.png"), 400);
  assert.equal(await bad("/data/{run}.txt"), 400);
  // interdit : le cache interne est vidé à chaque actualisation
  assert.equal(await bad(`${s.dataDir}/guidances/{category}/{run}.png`), 400);
  assert.equal(
    (await s.json("PUT", "/api/admin/settings", { sources: { satellites: { mode: "files", directory: `${s.dataDir}/guidances/satellites` } } }, auth)).res.status,
    400
  );
  assert.equal((await s.json("PUT", "/api/admin/settings", { archiveDays: 500 }, auth)).res.status, 400);
  assert.equal((await s.json("PUT", "/api/admin/settings", { autoRefresh: { intervalHours: 0 } }, auth)).res.status, 400);
  assert.equal((await s.json("PUT", "/api/admin/settings", { sources: { nimporte: { mode: "files" } } }, auth)).res.status, 400);
});

test("mode fichiers : sert le vrai PNG, 404 si absent, test de chemin", async () => {
  const root = path.join(s.tmp, "sorties");
  const dir = path.join(root, "vent", today, "Run00", "GFS");
  fs.mkdirSync(dir, { recursive: true });
  const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#336699" } }).png().toBuffer();
  fs.writeFileSync(path.join(dir, "J1.png"), png);

  const tpl = `${root}/{category}/{date}/{run}/{model}/J{day}.png`;
  const put = await s.json("PUT", "/api/admin/settings", { sources: { vent: { mode: "files", pathTemplate: tpl } } }, auth);
  assert.equal(put.res.status, 200);
  assert.equal((await s.json("GET", "/api/guidance/sources")).data.sources.vent.mode, "files");

  const ok = await s.get("/api/guidance/vent/image?run=Run00&model=GFS&day=1");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-image-source"), "file");
  const body = Buffer.from(await ok.arrayBuffer());
  assert.ok(isPng(body));
  assert.ok(body.equals(png));

  assert.equal((await s.get("/api/guidance/vent/image?run=Run00&model=GFS&day=2")).status, 404);

  const zip = await s.get("/api/guidance/vent/zip?run=Run00&model=GFS");
  assert.equal(zip.status, 200); // seul J+1 existe : le ZIP contient 1 fichier
  assert.equal(Buffer.from(await zip.arrayBuffer()).toString("latin1").split("PK\x03\x04").length - 1, 1);

  const t1 = await s.json("GET", `/api/admin/settings/test?category=vent&run=Run00&model=GFS&day=1`, undefined, auth);
  assert.equal(t1.data.exists, true);
  assert.equal(t1.data.sizeBytes, png.length);
  const t2 = await s.json("GET", `/api/admin/settings/test?category=vent&run=Run00&model=GFS&day=3`, undefined, auth);
  assert.equal(t2.data.exists, false);
  assert.ok(t2.data.path.endsWith("/J3.png"));

  // retour au mode simulé
  await s.json("PUT", "/api/admin/settings", { sources: { vent: { mode: "simulated" } } }, auth);
  assert.equal((await s.get("/api/guidance/vent/image?run=Run00&model=GFS&day=2")).status, 200);
});

test("satellites : dossier de fichiers réels", async () => {
  const dir = path.join(s.tmp, "sat");
  fs.mkdirSync(dir);
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#ffffff" } }).png().toBuffer();
  fs.writeFileSync(path.join(dir, "a.png"), png);
  fs.writeFileSync(path.join(dir, "notes.txt"), "ignoré");
  await s.json("PUT", "/api/admin/settings", { sources: { satellites: { mode: "files", directory: dir } } }, auth);
  const { data } = await s.json("GET", "/api/guidance/satellites");
  assert.equal(data.source, "file");
  assert.equal(data.items.length, 1);
  const img = await s.get(data.items[0].url);
  assert.equal(img.status, 200);
  assert.ok(Buffer.from(await img.arrayBuffer()).equals(png));
  // un nom de fichier forgé hors liste n'est pas servi
  const forged = "f_" + Buffer.from("../a.png").toString("base64url");
  assert.equal((await s.get(`/api/guidance/satellites/image/${forged}`)).status, 404);
  await s.json("PUT", "/api/admin/settings", { sources: { satellites: { mode: "simulated" } } }, auth);
});

test("tâches : liste, création, exécution, journaux", async () => {
  const list = (await s.json("GET", "/api/admin/tasks", undefined, auth)).data.tasks;
  assert.deepEqual(list.filter((t) => t.builtin).map((t) => t.id).sort(), ["refresh-guidances", "satellite-update"]);
  assert.deepEqual((await s.json("GET", "/api/admin/scripts", undefined, auth)).data.scripts, ["echec.sh", "lent.js", "ok.js"]);

  const created = await s.json("POST", "/api/admin/tasks", { name: "Test OK", script: "ok.js", args: ["a", "b"], intervalHours: 6 }, auth);
  assert.equal(created.res.status, 201);
  const id = created.data.task.id;

  const run = await s.json("POST", `/api/admin/tasks/${id}/run`, undefined, auth);
  assert.equal(run.res.status, 202);
  const final = await waitRun(id);
  assert.equal(final.status, "success");
  assert.equal(final.exitCode, 0);
  assert.match(final.logs, /bonjour a,b/);
  assert.ok(final.endedAt);

  const task = (await s.json("GET", "/api/admin/tasks", undefined, auth)).data.tasks.find((t) => t.id === id);
  assert.equal(task.lastRun.status, "success");
  assert.ok(Date.parse(task.nextRunAt) > Date.now());
});

test("tâches : un échec est historisé et notifié", async () => {
  const { data } = await s.json("POST", "/api/admin/tasks", { name: "Test échec", script: "echec.sh", category: "orages_inconnue" }, auth);
  assert.equal(data.status, "error"); // catégorie inconnue refusée
  const created = await s.json("POST", "/api/admin/tasks", { name: "Test échec", script: "echec.sh", category: "previsions_specifiques" }, auth);
  const id = created.data.task.id;
  await s.json("POST", `/api/admin/tasks/${id}/run`, undefined, auth);
  const final = await waitRun(id);
  assert.equal(final.status, "error");
  assert.equal(final.exitCode, 3);
  assert.match(final.logs, /oups/);
  const status = (await s.json("GET", "/api/guidance/status")).data;
  assert.equal(status.categories.previsions_specifiques.status, "erreur");
  const events = (await s.json("GET", "/api/guidance/events")).data.events;
  assert.ok(events.some((e) => e.level === "error" && /Test échec/.test(e.message)));
});

test("tâches : refus des scripts non autorisés et des doublons", async () => {
  const mk = (script) => s.json("POST", "/api/admin/tasks", { name: "X", script }, auth);
  assert.equal((await mk("../package.json")).res.status, 400);
  assert.equal((await mk("inexistant.js")).res.status, 400);
  assert.equal((await mk("note.txt")).res.status, 400);
  assert.equal((await mk("/etc/passwd")).res.status, 400);
  assert.equal((await s.json("POST", "/api/admin/tasks", { name: "", script: "ok.js" }, auth)).res.status, 400);
  assert.equal((await s.json("POST", "/api/admin/tasks", { name: "A", script: "ok.js", args: new Array(11).fill("x") }, auth)).res.status, 400);

  const { data } = await mk("lent.js");
  const id = data.task.id;
  assert.equal((await s.json("POST", `/api/admin/tasks/${id}/run`, undefined, auth)).res.status, 202);
  assert.equal((await s.json("POST", `/api/admin/tasks/${id}/run`, undefined, auth)).res.status, 409);
  assert.equal((await waitRun(id)).status, "success");
});

test("tâches : modification, activation, suppression", async () => {
  const { data } = await s.json("POST", "/api/admin/tasks", { name: "À modifier", script: "ok.js", intervalHours: 2 }, auth);
  const id = data.task.id;
  const patched = await s.json("PATCH", `/api/admin/tasks/${id}`, { enabled: false, name: "Renommée" }, auth);
  assert.equal(patched.data.task.enabled, false);
  assert.equal(patched.data.task.name, "Renommée");
  assert.equal(patched.data.task.nextRunAt, null);
  assert.equal((await s.json("DELETE", `/api/admin/tasks/${id}`, undefined, auth)).res.status, 204);
  assert.equal((await s.json("DELETE", `/api/admin/tasks/${id}`, undefined, auth)).res.status, 404);
  assert.equal((await s.json("DELETE", "/api/admin/tasks/refresh-guidances", undefined, auth)).res.status, 400);
});

test("tâche intégrée : réglage de l'actualisation automatique", async () => {
  const p = await s.json("PATCH", "/api/admin/tasks/refresh-guidances", { enabled: false }, auth);
  assert.equal(p.data.task.enabled, false);
  assert.equal((await s.json("GET", "/api/guidance/schedule")).data.enabled, false);
  await s.json("PATCH", "/api/admin/tasks/refresh-guidances", { enabled: true, intervalHours: 3 }, auth);
  assert.equal((await s.json("GET", "/api/guidance/schedule")).data.intervalHours, 3);
  const run = await s.json("POST", "/api/admin/tasks/satellite-update/run", undefined, auth);
  assert.equal(run.res.status, 202);
  assert.equal((await waitRun("satellite-update")).status, "success");
});

test("fenêtre d'archive configurable", async () => {
  await s.json("PUT", "/api/admin/settings", { archiveDays: 3 }, auth);
  assert.equal((await s.json("GET", "/api/guidance/archives/dates")).data.dates.length, 3);
  const old = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  assert.equal((await s.get(`/api/guidance/vent/image?date=${old}`)).status, 400);
});

test("limitation des tentatives de connexion", async () => {
  let blocked = false;
  for (let i = 0; i < 12 && !blocked; i++) {
    const { res } = await s.json("POST", "/api/auth/login", { password: "mauvais" });
    if (res.status === 429) {
      blocked = true;
      assert.ok(Number(res.headers.get("retry-after")) > 0);
    }
  }
  assert.ok(blocked, "le limiteur aurait dû répondre 429");
});
