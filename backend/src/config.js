import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, "..");

// Dossier des données persistantes (images en cache, réglages, historique).
// En Docker, y monter un volume.
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));

// Dossier des scripts exécutables depuis la page "Scripts & Tâches".
// Seuls les fichiers situés dans ce dossier peuvent être lancés.
export const SCRIPTS_DIR = path.resolve(process.env.SCRIPTS_DIR || path.join(ROOT, "scripts"));

export const VERSION = "1.0.0";
