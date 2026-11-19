import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, isPng } from "./helpers.js";

let s;
before(async () => {
  s = await startServer();
});
after(async () => {
  await s.close();
});

const today = new Date().toISOString().slice(0, 10);

test("santé : version et état", async () => {
  const { res, data } = await s.json("GET", "/api/health");
  assert.equal(res.status, 200);
  assert.equal(data.status, "ok");
  assert.equal(data.scheduler, false);
  assert.equal(data.adminConfigured, true);
});

test("catégories : 6 catégories avec leur structure", async () => {
  const { data } = await s.json("GET", "/api/guidance/categories");
  assert.equal(data.length, 6);
  const vent = data.find((c) => c.id === "vent");
  assert.deepEqual(vent.runs, ["Run00", "Run06", "Run12", "Run18"]);
  assert.equal(vent.maxDay, 5);
});

test("image : PNG valide, source simulée", async () => {
  const res = await s.get("/api/guidance/vent/image?run=Run00&model=GFS&day=1");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.equal(res.headers.get("x-image-source"), "simulated");
  assert.ok(isPng(Buffer.from(await res.arrayBuffer())));
});

test("image : valeurs par défaut quand aucun paramètre", async () => {
  for (const cat of ["pluies", "houles", "temperatures", "previsions_specifiques"]) {
    const res = await s.get(`/api/guidance/${cat}/image`);
    assert.equal(res.status, 200, cat);
  }
});

test("image : paramètres invalides refusés (400/404)", async () => {
  const cases = [
    ["/api/guidance/inconnue/image", 404],
    ["/api/guidance/satellites/image", 400],
    ["/api/guidance/vent/image?run=Run99", 400],
    ["/api/guidance/vent/image?model=../../etc/passwd", 400],
    ["/api/guidance/vent/image?day=9", 400],
    ["/api/guidance/vent/image?day=abc", 400],
    ["/api/guidance/vent/image?date=2020-01-01", 400],
    ["/api/guidance/vent/image?date=pas-une-date", 400],
    ["/api/guidance/previsions_specifiques/image?item=nimporte", 400],
  ];
  for (const [url, status] of cases) {
    const res = await s.get(url);
    assert.equal(res.status, status, url);
  }
  const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  assert.equal((await s.get(`/api/guidance/vent/image?date=${future}`)).status, 400);
});

test("image : date, run et modèle changent le résultat ; même requête = même image", async () => {
  const get = async (q) => Buffer.from(await (await s.get(`/api/guidance/vent/image?${q}`)).arrayBuffer());
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const a = await get("run=Run00&model=GFS&day=2");
  const a2 = await get("run=Run00&model=GFS&day=2");
  const b = await get(`run=Run00&model=GFS&day=2&date=${yesterday}`);
  const c = await get("run=Run06&model=GFS&day=2");
  assert.ok(a.equals(a2));
  assert.ok(!a.equals(b));
  assert.ok(!a.equals(c));
});

test("archives : 14 dates, la plus récente est aujourd'hui", async () => {
  const { data } = await s.json("GET", "/api/guidance/archives/dates");
  assert.equal(data.dates.length, 14);
  assert.equal(data.dates[0], today);
});

test("ZIP : 5 images pour un run", async () => {
  const res = await s.get("/api/guidance/vent/zip?run=Run00&model=GFS");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/zip");
  assert.match(res.headers.get("content-disposition"), /attachment; filename="vent_/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const entries = buf.toString("latin1").split("PK\x03\x04").length - 1;
  assert.equal(entries, 5);
});

test("ZIP : prévisions spécifiques = un PNG par phénomène", async () => {
  const buf = Buffer.from(await (await s.get("/api/guidance/previsions_specifiques/zip")).arrayBuffer());
  assert.equal(buf.toString("latin1").split("PK\x03\x04").length - 1, 5);
});

test("satellites : 8 vignettes lisibles", async () => {
  const { data } = await s.json("GET", "/api/guidance/satellites");
  assert.equal(data.source, "simulated");
  assert.equal(data.items.length, 8);
  const img = await s.get(data.items[7].url);
  assert.equal(img.status, 200);
  assert.ok(isPng(Buffer.from(await img.arrayBuffer())));
  assert.equal((await s.get("/api/guidance/satellites/image/f_inexistant")).status, 404);
  assert.equal((await s.get("/api/guidance/satellites/image/..%2F..%2Fetc")).status, 404);
});

test("statut initial : toutes les catégories disponibles sans actualisation préalable", async () => {
  const { data } = await s.json("GET", "/api/guidance/status");
  assert.equal(Object.keys(data.categories).length, 6);
  assert.ok(Object.values(data.categories).every((c) => c.status === "disponible"));
});

test("actualisation : epoch incrémenté, statut et évènement", async () => {
  const before = (await s.json("GET", "/api/guidance/status")).data.epoch;
  const { res, data } = await s.json("POST", "/api/guidance/refresh");
  assert.equal(res.status, 200);
  assert.equal(data.status, "ok");
  assert.equal(data.epoch, before + 1);
  const status = (await s.json("GET", "/api/guidance/status")).data;
  assert.equal(status.categories.vent.status, "disponible");
  const events = (await s.json("GET", "/api/guidance/events")).data.events;
  assert.ok(events.some((e) => /Actualisation/.test(e.message)));
});

test("planning : prochaine actualisation automatique annoncée", async () => {
  const { data } = await s.json("GET", "/api/guidance/schedule");
  assert.equal(data.enabled, true);
  assert.equal(data.intervalHours, 6);
  assert.ok(Date.parse(data.nextRunAt) > Date.now());
});

test("sources : modes publics sans chemins", async () => {
  const { data } = await s.json("GET", "/api/guidance/sources");
  assert.equal(data.sources.vent.mode, "simulated");
  assert.equal(data.sources.vent.pathTemplate, undefined);
});

test("route inconnue et JSON invalide", async () => {
  assert.equal((await s.get("/api/nimporte")).status, 404);
  const res = await fetch(s.base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{pas du json" });
  assert.equal(res.status, 400);
});
