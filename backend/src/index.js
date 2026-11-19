import "dotenv/config";
import { createApp } from "./app.js";
import { startScheduler } from "./services/tasks.js";
import { adminConfigured } from "./services/auth.js";

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, async () => {
  console.log(`Rivotra backend à l'écoute sur http://localhost:${PORT}`);
  if (!adminConfigured()) {
    console.warn("⚠  ADMIN_PASSWORD non défini : les pages Paramètres et Scripts & Tâches sont désactivées.");
  } else if (process.env.ADMIN_PASSWORD === "change-me") {
    console.warn("⚠  ADMIN_PASSWORD a encore la valeur d'exemple « change-me » : changez-la avant toute mise en production.");
  }
  if (await startScheduler()) console.log("Planificateur de tâches démarré.");
});
