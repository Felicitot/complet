// Champ météo continu simulé, utilisé pour produire des images d'exemple
// réalistes tant que les vrais scripts de prévision ne sont pas branchés.
// À REMPLACER par la vraie sortie de modèle (GRIB/NetCDF déjà interpolée
// sur une grille) : voir chartRenderer.js pour le point d'insertion exact.

import { LON_MIN, LON_MAX, LAT_MIN, LAT_MAX } from "../data/geoExtent.js";

function baseField01(nx, ny, seed) {
  const s1 = Math.sin((nx * 3 + seed * 0.7) * Math.PI);
  const s2 = Math.cos((ny * 4 - seed * 0.5) * Math.PI);
  const s3 = Math.sin((nx * 1.5 + ny * 2 + seed) * Math.PI * 2);
  let v = (s1 + s2 + s3) / 3;

  // Une cellule plus intense (façon perturbation/cyclone), qui se déplace
  // avec le seed, pour un champ visuellement plausible.
  const cx = 0.78 + 0.14 * Math.sin(seed * 1.3);
  const cy = 0.25 + 0.55 * (((seed * 0.37) % 1) + 1) % 1;
  const d2 = (nx - cx) ** 2 + (ny - cy) ** 2;
  const blob = Math.exp(-d2 * 16) * 1.4;

  v = v * 0.45 + blob;
  return Math.max(0, Math.min(1, (v + 1) / 2));
}

export function fieldValue01(lon, lat, seed) {
  const nx = (lon - LON_MIN) / (LON_MAX - LON_MIN);
  const ny = (lat - LAT_MIN) / (LAT_MAX - LAT_MIN);
  return baseField01(nx, ny, seed);
}

export function windAngle(lon, lat, seed) {
  const nx = (lon - LON_MIN) / (LON_MAX - LON_MIN);
  const ny = (lat - LAT_MIN) / (LAT_MAX - LAT_MIN);
  return Math.sin((nx * 2 + ny * 2 + seed * 0.6) * Math.PI) * 70 + (nx - 0.5) * 50;
}

// Dérive un seed numérique stable à partir d'une chaîne (catégorie+run+
// modèle+jour), pour que la même combinaison redonne toujours le même champ
// tant qu'on n'a pas cliqué sur "Actualiser".
export function seedFromKey(key, salt = 0) {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return (h % 1000) / 100 + salt;
}
