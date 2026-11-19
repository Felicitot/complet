// Lecture/écriture JSON atomique (écriture dans un fichier temporaire puis
// renommage) pour éviter les fichiers tronqués en cas d'arrêt brutal.
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "../config.js";

export function dataPath(...parts) {
  return path.join(DATA_DIR, ...parts);
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    if (err instanceof SyntaxError) {
      console.error(`[jsonStore] fichier corrompu ignoré : ${file}`);
      return fallback;
    }
    throw err;
  }
}

export async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}
