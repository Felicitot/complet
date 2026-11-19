// Cache disque des images générées + statut par catégorie.
import fs from "fs/promises";
import path from "path";
import { dataPath, readJson, writeJson } from "./jsonStore.js";

const ROOT = () => dataPath("guidances");
const STATUS_FILE = () => path.join(ROOT(), "_status.json");

export function keyToFilePath(category, key) {
  const safe = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return path.join(ROOT(), category, `${safe}.png`);
}

export async function getCached(category, key) {
  try {
    return await fs.readFile(keyToFilePath(category, key));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function setCached(category, key, buffer) {
  const file = keyToFilePath(category, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
}

export async function clearCategoryCache(category) {
  await fs.rm(path.join(ROOT(), category), { recursive: true, force: true });
}

// Vide le cache d'images en conservant le fichier de statut.
export async function clearAllCache() {
  const root = ROOT();
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  await Promise.all(
    entries.filter((e) => e.isDirectory()).map((e) => fs.rm(path.join(root, e.name), { recursive: true, force: true }))
  );
}

export async function readStatus() {
  return readJson(STATUS_FILE(), {});
}

export async function writeStatus(status) {
  await writeJson(STATUS_FILE(), status);
}

export async function touchCategoryStatus(categoryId, patch) {
  const status = await readStatus();
  status[categoryId] = { ...status[categoryId], ...patch };
  await writeStatus(status);
  return status[categoryId];
}
