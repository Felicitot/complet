# Rivotra — Backend

API Node.js / Express : sert les cartes de guidance (PNG), les archives, les
ZIP, les vignettes satellites, le planificateur de tâches et les réglages.
Voir le [README principal](../README.md) pour la vue d'ensemble, la
configuration et l'intégration de vos fichiers réels.

```bash
npm install
cp .env.example .env     # définir ADMIN_PASSWORD
npm start                # http://localhost:4000
npm test                 # 27 tests
```
Node.js 22 LTS recommandé (20.9 minimum).

## API publique (`/api`)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/health` | Version, uptime, état du planificateur |
| GET | `/guidance/categories` | Registre : catégories, runs, modèles, seuils |
| GET | `/guidance/status` | Statut par catégorie + epoch |
| GET | `/guidance/schedule` | Prochaine actualisation automatique |
| GET | `/guidance/sources` | Mode (simulé / fichiers) par catégorie |
| GET | `/guidance/events?limit=` | Notifications récentes |
| GET | `/guidance/archives/dates` | Dates consultables (archive) |
| GET | `/guidance/:categorie/image?date&run&model&type&item&day` | PNG (`X-Image-Source: simulated \| file`) |
| GET | `/guidance/:categorie/zip?date&run&model&type` | ZIP des échéances J+1..J+5 |
| GET | `/guidance/satellites` · `/satellites/image/:key` | Galerie satellite |
| POST | `/guidance/refresh` | Actualisation immédiate (1 / 10 s) |
| POST | `/auth/login` `{password}` | Jeton administrateur (12 h) |

Paramètres : `date` = `AAAA-MM-JJ` (aujourd'hui par défaut, dans la fenêtre d'archive) ;
`run` = `Run00|06|12|18` ; `day` = 1..5. Toute valeur hors registre → **400** ;
catégorie inconnue → **404** ; fichier réel absent → **404**.

## API administrateur (`Authorization: Bearer <jeton>`)

| Méthode | Route | Rôle |
|---|---|---|
| GET / PUT | `/admin/settings` | Lire / modifier les réglages |
| GET | `/admin/settings/test?category&template` | Résoudre un modèle de chemin et vérifier le fichier |
| GET | `/admin/scripts` | Scripts disponibles dans `SCRIPTS_DIR` |
| GET / POST | `/admin/tasks` | Lister / créer une tâche personnalisée |
| PATCH / DELETE | `/admin/tasks/:id` | Modifier (activation, intervalle…) / supprimer |
| POST | `/admin/tasks/:id/run` | Lancer maintenant (202) |
| GET | `/admin/tasks/:id/runs` · `/admin/runs` | Historique et journaux |

## Structure

```
src/
  app.js, index.js          application Express, démarrage + planificateur
  config.js                 DATA_DIR, SCRIPTS_DIR
  data/                     catégories, palettes, étendue, contour de Madagascar
  routes/                   guidance.js (public), auth.js, admin.js
  services/
    guidanceGenerator.js    validation, dates, rendu simulé OU lecture des fichiers réels
    chartRenderer.js        carte SVG → PNG (sharp)
    settings.js             réglages persistants + validation des chemins
    tasks.js                tâches intégrées / scripts, historique, planificateur
    auth.js                 mot de passe + jeton signé
    events.js, guidanceStore.js, jsonStore.js, satelliteRenderer.js, fieldSynth.js
  utils/                    HttpError, limiteur de débit
scripts/                    scripts exécutables depuis l'interface (exemples)
test/                       tests node:test (api.test.js, admin.test.js)
```

## Où brancher vos données

Pas de code à modifier : utilisez la page **Paramètres** (modèle de chemin). Si
vous voulez aller plus loin (autre source que des fichiers), le point d'entrée
unique est `getChartImage()` dans `src/services/guidanceGenerator.js`.
