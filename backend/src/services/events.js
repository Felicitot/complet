// Journal d'évènements (notifications) : fin de traitement, échec d'un
// script, changement de réglages... Affiché dans la cloche du Dashboard.
import crypto from "crypto";
import { dataPath, readJson, writeJson } from "./jsonStore.js";

const FILE = () => dataPath("events.json");
const MAX = 100;

export async function addEvent(level, message) {
  const events = await readJson(FILE(), []);
  events.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), level, message });
  await writeJson(FILE(), events.slice(0, MAX));
}

export async function listEvents(limit = 20) {
  const events = await readJson(FILE(), []);
  return events.slice(0, Math.min(Math.max(Number(limit) || 20, 1), MAX));
}
