// Génère une carte PNG "façon sortie de modèle météo" : grille colorée sur
// toute l'étendue, contour réel de Madagascar, axes en degrés, légende.
// La grille est actuellement remplie par un champ simulé (fieldSynth.js) —
// c'est le seul endroit à changer pour brancher une vraie sortie de modèle :
// remplacer `fieldValue01(lon, lat, seed)` par une lecture de votre grille
// réelle (GRIB/NetCDF déjà interpolée sur lon/lat).

import sharp from "sharp";
import { LON_MIN, LON_MAX, LAT_MIN, LAT_MAX, lonTicks, latTicks } from "../data/geoExtent.js";
import { ISLAND_PATH_DEG } from "../data/madagascarShape.js";
import { getColormap } from "../data/colormaps.js";
import { fieldValue01, windAngle } from "./fieldSynth.js";

const SCALE = 50; // pixels par degré
const PLOT_X0 = 70;
const PLOT_Y0 = 130;
const PLOT_W = SCALE * (LON_MAX - LON_MIN); // 600
const PLOT_H = SCALE * 14; // 700 (-LAT_MAX=12 à -LAT_MIN=26)
const CANVAS_W = PLOT_X0 + PLOT_W + 150; // 820
const CANVAS_H = PLOT_Y0 + PLOT_H + 70; // 900

function toPx(lon, lat) {
  return { x: PLOT_X0 + (lon - LON_MIN) * SCALE, y: PLOT_Y0 + (-lat - 12) * SCALE };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  const c = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function interpolateStops(stops, t) {
  const clamped = Math.max(0, Math.min(1, t));
  const segments = stops.length - 1;
  const scaled = clamped * segments;
  const idx = Math.min(segments - 1, Math.floor(scaled));
  const localT = scaled - idx;
  const a = hexToRgb(stops[idx]);
  const b = hexToRgb(stops[idx + 1]);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * localT));
}
function getColor(cmap, value) {
  const [min, max] = cmap.domain;
  const t = (value - min) / (max - min);
  return interpolateStops(cmap.stops, t);
}
function esc(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildGrid(seed, step = 0.35) {
  const cells = [];
  for (let lat = LAT_MIN; lat <= LAT_MAX + 1e-6; lat += step) {
    for (let lon = LON_MIN; lon <= LON_MAX + 1e-6; lon += step) {
      cells.push({ lon, lat, value01: fieldValue01(lon, lat, seed) });
    }
  }
  return cells;
}

function buildSvg({ title, subtitleLeft, subtitleRight, colormapId, seed, showBarbs, footnote }) {
  const cmap = getColormap(colormapId);
  const step = 0.35;
  const cells = buildGrid(seed, step);

  const cellRects = cells
    .map((c) => {
      const value = cmap.domain[0] + c.value01 * (cmap.domain[1] - cmap.domain[0]);
      const color = getColor(cmap, value);
      const x = c.lon - step / 2;
      const y = -c.lat - step / 2;
      return `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${(step * 1.05).toFixed(3)}" height="${(step * 1.05).toFixed(3)}" fill="${color}"/>`;
    })
    .join("");

  let barbMarkup = "";
  if (showBarbs) {
    const barbs = [];
    for (let lat = LAT_MIN + 1; lat <= LAT_MAX - 0.5; lat += 1.6) {
      for (let lon = LON_MIN + 1; lon <= LON_MAX - 0.5; lon += 1.6) {
        barbs.push({ lon, lat, angle: windAngle(lon, lat, seed) });
      }
    }
    barbMarkup = barbs
      .map((b) => {
        const rad = (b.angle * Math.PI) / 180;
        const len = 0.45;
        const dx = Math.cos(rad) * len;
        const dy = Math.sin(rad) * len;
        const x = b.lon;
        const y = -b.lat;
        const lineAttrs = 'stroke="#12261E" stroke-width="1.2" vector-effect="non-scaling-stroke" opacity="0.55" stroke-linecap="round"';
        return `<line ${lineAttrs} x1="${(x - dx).toFixed(3)}" y1="${(y - dy).toFixed(3)}" x2="${(x + dx).toFixed(3)}" y2="${(y + dy).toFixed(3)}"/>
          <line ${lineAttrs} x1="${(x + dx * 0.3).toFixed(3)}" y1="${(y + dy * 0.3).toFixed(3)}" x2="${(x + dx * 0.3 - dy * 0.3).toFixed(3)}" y2="${(y + dy * 0.3 + dx * 0.3).toFixed(3)}"/>`;
      })
      .join("");
  }

  const gridLines = [];
  lonTicks(2).forEach((lon) => {
    const { x } = toPx(lon, LAT_MIN);
    gridLines.push(
      `<line x1="${x}" y1="${PLOT_Y0}" x2="${x}" y2="${PLOT_Y0 + PLOT_H}" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="2 4" opacity="0.7"/>`
    );
    gridLines.push(
      `<text x="${x}" y="${PLOT_Y0 + PLOT_H + 24}" font-size="13" text-anchor="middle" fill="#5B6E64" font-family="Arial, sans-serif">${lon}E</text>`
    );
  });
  latTicks(2).forEach((lat) => {
    const { y } = toPx(LON_MIN, lat);
    gridLines.push(
      `<line x1="${PLOT_X0}" y1="${y}" x2="${PLOT_X0 + PLOT_W}" y2="${y}" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="2 4" opacity="0.7"/>`
    );
    gridLines.push(
      `<text x="${PLOT_X0 - 10}" y="${y + 4}" font-size="13" text-anchor="end" fill="#5B6E64" font-family="Arial, sans-serif">${Math.abs(lat)}S</text>`
    );
  });

  const legendX = PLOT_X0 + PLOT_W + 30;
  const bands = 7;
  const bandH = PLOT_H / bands;
  let legendMarkup = `<text x="${legendX}" y="${PLOT_Y0 - 12}" font-size="13" fill="#12261E" font-family="Arial, sans-serif" font-weight="bold">${esc(cmap.unit)}</text>`;
  for (let i = 0; i < bands; i++) {
    const t = 1 - (i + 0.5) / bands;
    const value = cmap.domain[0] + t * (cmap.domain[1] - cmap.domain[0]);
    const color = getColor(cmap, value);
    const y = PLOT_Y0 + i * bandH;
    legendMarkup += `<rect x="${legendX}" y="${y.toFixed(1)}" width="32" height="${bandH.toFixed(1)}" fill="${color}" stroke="#FFFFFF" stroke-width="1"/>`;
  }
  for (let i = 0; i <= bands; i++) {
    const frac = 1 - i / bands;
    const value = cmap.domain[0] + frac * (cmap.domain[1] - cmap.domain[0]);
    const y = PLOT_Y0 + i * bandH;
    legendMarkup += `<text x="${legendX + 38}" y="${(y + 4).toFixed(1)}" font-size="12" fill="#5B6E64" font-family="Arial, sans-serif">${Math.round(value * 10) / 10}</text>`;
  }

  const transform = `translate(${PLOT_X0 - LON_MIN * SCALE},${PLOT_Y0 - 12 * SCALE}) scale(${SCALE})`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <defs>
    <clipPath id="plotClip"><rect x="${PLOT_X0}" y="${PLOT_Y0}" width="${PLOT_W}" height="${PLOT_H}"/></clipPath>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#FFFFFF"/>

  <text x="24" y="34" font-size="19" font-weight="bold" fill="#12261E" font-family="Arial, sans-serif">${esc(title)}</text>
  <text x="24" y="58" font-size="13" fill="#5B6E64" font-family="Arial, sans-serif">${esc(subtitleLeft)}</text>
  <text x="${CANVAS_W - 24}" y="58" font-size="13" fill="#5B6E64" font-family="Arial, sans-serif" text-anchor="end">${esc(subtitleRight)}</text>

  <g clip-path="url(#plotClip)">
    <rect x="${PLOT_X0}" y="${PLOT_Y0}" width="${PLOT_W}" height="${PLOT_H}" fill="#F4F8F6"/>
    <g transform="${transform}">${cellRects}</g>
  </g>

  ${gridLines.join("")}

  <g transform="${transform}">
    <path d="${ISLAND_PATH_DEG}" fill="none" stroke="#12261E" stroke-width="2" vector-effect="non-scaling-stroke" opacity="0.85"/>
    ${barbMarkup}
  </g>

  <rect x="${PLOT_X0}" y="${PLOT_Y0}" width="${PLOT_W}" height="${PLOT_H}" fill="none" stroke="#12261E" stroke-width="1.5"/>

  ${legendMarkup}

  <text x="24" y="${CANVAS_H - 20}" font-size="11" fill="#8a948f" font-family="Arial, sans-serif">${esc(footnote || "")}</text>
</svg>`;
}

export async function renderChartPNG(options) {
  const svg = buildSvg(options);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
