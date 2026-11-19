# Rivotra — Frontend

Interface React 18 + Vite + Tailwind. Voir le [README principal](../README.md).

Node.js 22 LTS recommandé (20.19 minimum pour Vite 7).

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm run dev               # http://localhost:5173
npm run build             # production -> dist/
```

## Pages (routage par `#/`)

| Route | Page | Accès |
|---|---|---|
| `#/` | Dashboard : 6 cartes, statut, résumé | public |
| `#/archives` | Runs des derniers jours | public |
| `#/aide` | Guide utilisateur, glossaire, raccourcis | public |
| `#/taches` | Scripts & Tâches | admin |
| `#/parametres` | Sources d'images, actualisation, archives | admin |

## Structure

```
src/
  App.jsx                   mise en page + routage
  context/                  AppDataContext (données partagées, sondage 60 s), AuthContext
  api/                      client.js, guidanceApi.js, adminApi.js
  hooks/                    useHashRoute, useStoredState (localStorage)
  lib/format.js             dates, heures « valable le », durées
  components/
    GuidanceCards.jsx       cartes (sélecteurs, comparaison, ZIP, visionneuse)
    Lightbox.jsx            visionneuse : zoom, déplacement, animation
    Header / SearchBox / NotificationsMenu / Sidebar / StatusPanel / SummaryRow
    ui.jsx, LoginForm.jsx
  pages/                    Dashboard, Archives, Tasks, Settings, Help
```

Les sélections (run, modèle, type, échéance) sont mémorisées dans le
navigateur ; le jeton administrateur n'est conservé que le temps de la session.
