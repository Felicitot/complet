// Démarre l'application sur un port libre, avec un environnement isolé
// (dossiers temporaires, planificateur désactivé).
import fs from "fs";
import os from "os";
import path from "path";

export async function startServer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rivotra-test-"));
  const scripts = path.join(tmp, "scripts");
  fs.mkdirSync(scripts);

  process.env.NODE_ENV = "test";
  process.env.DATA_DIR = path.join(tmp, "data");
  process.env.SCRIPTS_DIR = scripts;
  process.env.ADMIN_PASSWORD = "mot-de-passe-test";
  process.env.TOKEN_SECRET = "secret-de-test";
  process.env.DISABLE_SCHEDULER = "1";
  process.env.REFRESH_MIN_INTERVAL_MS = "0";
  process.env.LOGIN_MAX_PER_MINUTE = "8";

  const { createApp } = await import("../src/app.js");
  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    tmp,
    scripts,
    dataDir: process.env.DATA_DIR,
    close: () => new Promise((r) => server.close(r)),
    get: (p, headers) => fetch(base + p, { headers }),
    json: async (method, p, body, headers = {}) => {
      const res = await fetch(base + p, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = null;
      try {
        data = await res.clone().json();
      } catch {
        /* pas de JSON */
      }
      return { res, data };
    },
  };
}

export const isPng = (buf) => buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
