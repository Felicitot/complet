# Rivotra — Portail des guidances de prévision (Météo Madagascar)

Portail web qui rassemble les cartes de guidance de prévision (vent, pluies,
houles, températures, images satellites, prévisions spécifiques), les organise
par **catégorie → run → modèle → échéance** (selon votre manuel de procédures)
et permet de les consulter, comparer, animer et télécharger.

> **À savoir avant tout :** livré tel quel, le portail affiche des **images
> d'exemple générées** (badge « Données simulées », mention « exemple
> provisoire » sur chaque carte). Ce ne sont pas de vraies prévisions. Pour
> afficher vos vrais PNG, voir [« Brancher vos vrais fichiers »](#brancher-vos-vrais-fichiers).

```
rivotra/
├── backend/     API Node.js / Express (images, archives, tâches, réglages)
├── frontend/    Interface React + Vite + Tailwind
├── docs/uml/    Diagrammes UML (séquences, classes, déploiement, paquetage)
├── docker-compose.yml
└── .env.example
```

## Fonctionnalités

**Pour les prévisionnistes**
- Dashboard à 6 cartes (Vent, Pluies, Houles, Températures, Satellites, Prévisions spécifiques) avec choix du type, du run, du modèle et de l'échéance (+24 h à +120 h).
- **Heures exactes** sous chaque carte : « Run00 du 13/11/2026 · valable le 14/11/2026 00Z ».
- **Visionneuse plein écran** : zoom (molette, +/−, double-clic), déplacement, navigation entre échéances (← →) et **animation** J+1 → J+5 (espace).
- **Comparaison côte à côte** de deux modèles (même run) ou de deux runs (même modèle).
- **Téléchargement** d'une carte (PNG) ou des 5 échéances d'un run (**ZIP**).
- **Archives** : les 14 derniers jours (réglable), mêmes sélecteurs.
- **Recherche rapide** (Ctrl + K) : « vent gfs », « houles », « orages »…
- **Notifications** (cloche), statut par catégorie (disponible / en cours / erreur), compte à rebours de la prochaine actualisation automatique.
- Sélections mémorisées dans le navigateur, affichage adapté au téléphone, page **Aide** intégrée.

**Pour l'administrateur** (mot de passe)
- **Paramètres** : brancher vos vrais PNG par modèle de chemin (avec bouton « Tester »), dossier des images satellites, fréquence d'actualisation, durée des archives.
- **Scripts & Tâches** : planificateur, exécution de vos scripts (.js, .py, .sh), historique, durées et journaux ; un échec passe la catégorie en rouge et envoie une notification.

**Qualité et exploitation**
- 27 tests automatiques (`npm test` dans `backend/`).
- Validation stricte de toutes les entrées, protection contre les traversées de chemin, scripts lancés sans shell, limitation du débit (connexion, actualisation), en-têtes de sécurité.
- Docker Compose prêt à l'emploi.

## Démarrage rapide (développement)

Prérequis : **Node.js 22 LTS** (ou 20.19 minimum).

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env        # OBLIGATOIRE pour l'espace admin : puis changez ADMIN_PASSWORD
npm start                   # http://localhost:4000

# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

> **Windows** : `cp` fonctionne dans Git Bash ; dans PowerShell ou l'invite de
> commandes, utilisez `copy .env.example .env`. Sans fichier `.env`, le portail
> fonctionne mais « Paramètres » et « Scripts & Tâches » restent désactivés
> (le serveur l'indique au démarrage : « ADMIN_PASSWORD non défini »).
> Modifiez le `.env` puis **redémarrez** le backend.

Ouvrez http://localhost:5173. Les images s'affichent immédiatement. Pour
l'espace administrateur, ouvrez « Paramètres » ou « Scripts & Tâches » et
saisissez le `ADMIN_PASSWORD` du backend.

## Démarrage avec Docker

```bash
cp .env.example .env        # définissez ADMIN_PASSWORD (et TOKEN_SECRET)
docker compose up --build   # portail sur http://localhost:8080
```

nginx sert l'interface et relaie `/api` vers le backend. Les données
(réglages, historique) sont conservées dans le volume `rivotra-data`.

> Les fichiers Docker ont été écrits avec soin mais **n'ont pas pu être
> exécutés** dans l'environnement où le projet a été produit (pas de Docker
> disponible) : testez le premier `docker compose up --build` et signalez tout
> écart.

## Brancher vos vrais fichiers

Chaque catégorie peut fonctionner en mode **Données simulées** (défaut) ou
**Fichiers réels**. En mode fichiers, le serveur lit le PNG que **vos scripts**
ont déjà produit ; il ne génère plus rien.

1. Vos scripts déposent leurs PNG dans une arborescence régulière, par exemple :
   `/sorties/vent/2026-11-13/Run00/GFS/J1.png`
2. (Docker) montez ce dossier en lecture seule dans `docker-compose.yml` :
   `- /chemin/vers/vos/sorties:/sorties:ro`
3. Ouvrez **Paramètres**, choisissez « Fichiers réels » pour la catégorie et
   saisissez le modèle de chemin :
   `/sorties/{category}/{date}/{run}/{model}/J{day}.png`
4. Cliquez sur **Tester** : le chemin résolu s'affiche avec « fichier trouvé »
   ou « introuvable ». Enregistrez.

Variables disponibles : `{category}` `{date}` `{yyyy}` `{mm}` `{dd}` `{run}`
`{runHour}` `{model}` `{type}` `{item}` `{day}`. Le badge de la carte devient
« Fichiers réels ». Une image absente s'affiche comme **indisponible** (jamais
remplacée par une image simulée). Pour les satellites, indiquez le dossier
où arrivent les images (.png / .jpg) : les plus récentes sont affichées.

Garde-fou : le dossier de cache interne (`DATA_DIR/guidances`) est refusé comme
source, car il est vidé à chaque actualisation.

### Lancer vos scripts depuis le portail

1. Placez le script dans `backend/scripts/` (`.js`, `.py` ou `.sh` ; voir
   `scripts/exemple_orages.js`).
2. **Scripts & Tâches → Nouvelle tâche** : choisissez le script, ses arguments,
   un intervalle (ou lancement manuel) et la catégorie concernée.
3. Le script reçoit `RIVOTRA_DATA_DIR` et `RIVOTRA_DATE`. Code de sortie 0 =
   succès ; autre = échec (catégorie en rouge + notification).

Un script lent doit tourner **en tâche planifiée** et écrire ses PNG ; le
portail ne fait que les lire.

## Configuration (backend, fichier `.env`)

| Variable | Rôle | Défaut |
|---|---|---|
| `ADMIN_PASSWORD` | Mot de passe admin. **Sans lui, l'espace admin est désactivé.** | — |
| `TOKEN_SECRET` | Clé de signature des jetons (12 h) | aléatoire à chaque démarrage |
| `CORS_ORIGIN` | Origine(s) du frontend, séparées par des virgules | `http://localhost:5173` |
| `PORT` | Port de l'API | `4000` |
| `DATA_DIR` | Réglages, historique, cache | `./data` |
| `SCRIPTS_DIR` | Dossier des scripts exécutables | `./scripts` |
| `TRUST_PROXY` | `1` derrière nginx / un reverse proxy | — |
| `REFRESH_MIN_INTERVAL_MS` | Délai mini entre deux actualisations manuelles | `10000` |

Frontend : `VITE_API_URL` (`http://localhost:4000/api` en développement, `/api` en Docker).

## Sécurité

- Définissez un `ADMIN_PASSWORD` robuste et un `TOKEN_SECRET`. Le serveur avertit au démarrage si le mot de passe d'exemple `change-me` est conservé.
- Placez le portail derrière **HTTPS** (reverse proxy) dès qu'il sort d'un réseau de confiance : le mot de passe et le jeton transitent sinon en clair.
- **Dépendances (état au 17/11/2026)** : `sharp`, `express` et `vite` sont à jour. `npm audit` signale encore :
  - *backend* : 3 alertes « modérées » dans l'outil de recherche de fichiers interne d'`archiver`, que le code n'utilise jamais (il n'ajoute aux ZIP que des images en mémoire) ;
  - *frontend* : une alerte ReDoS sur `picomatch`, utilisé par les **outils de compilation** (Vite, Tailwind). Elle ne concerne ni le site compilé ni le serveur, et **aucune version corrigée n'existe encore** (la correction « automatique » proposée par npm rétrograde Vite et réintroduit une autre faille : ne la lancez pas).
  Relancez `npm audit` de temps en temps : la base d'avis évolue, et un correctif pourra apparaître.
- Les scripts s'exécutent avec les droits du processus Node : ne placez dans `scripts/` que du code de confiance.
- Les pages publiques (consultation, actualisation limitée à 1 fois / 10 s) n'exigent pas de compte ; seuls Paramètres et Scripts & Tâches sont protégés.

## Tests

```bash
cd backend && npm test      # 27 tests : API, validation, ZIP, fichiers réels, tâches, auth
cd frontend && npm run build
```

## Limites connues et pistes d'évolution

- **Les images sont simulées tant que vous ne branchez pas vos fichiers.** Le portail n'exécute ni ne lit aucune sortie de modèle (GRIB) par lui-même : il affiche des PNG.
- Un seul compte administrateur (mot de passe unique). Pour plusieurs comptes ou un SSO, remplacer `backend/src/services/auth.js`.
- Stockage en fichiers JSON et limitation de débit en mémoire : adaptés à **une instance** ; pour plusieurs instances, prévoir une base de données et Redis.
- Pas encore : trajectoire cyclonique (Typhoon/Track Forecast), alertes par e-mail/SMS, sonde de valeurs en un point, accès par compte utilisateur.
- Les diagrammes de `docs/uml/` décrivent le cœur du système (consultation, téléchargement, actualisation). Les ajouts récents (archives datées, ZIP, tâches planifiées, réglages, authentification) n'y figurent pas encore.
