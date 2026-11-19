// Génère des vignettes "façon image satellite" stylisées (tourbillons
// nuageux), en attendant le vrai flux (ex. EUMETSAT / localhost AI Guides
// mentionné dans le document). Clairement un placeholder, pas une vraie
// capture — à remplacer par la vraie source d'images dans guidanceStore.js.

import sharp from "sharp";

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}
function rand(seed) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export async function renderSatelliteThumbnail({ timestampLabel, seedKey }) {
  const seed = hashSeed(seedKey);
  const W = 420;
  const H = 420;

  // Amas nuageux diffus dispersés sur l'image (simule une couverture
  // nuageuse générale), via des cercles flous superposés.
  let clouds = "";
  const cloudCount = 10 + Math.floor(rand(seed) * 6);
  for (let i = 0; i < cloudCount; i++) {
    const cx = rand(seed + i * 3) * W;
    const cy = rand(seed + i * 3 + 1) * H;
    const r = 40 + rand(seed + i * 3 + 2) * 90;
    const opacity = 0.12 + rand(seed + i * 7) * 0.18;
    clouds += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="#FFFFFF" opacity="${opacity.toFixed(2)}" filter="url(#blur)"/>`;
  }

  // Spirale (façon bandes nuageuses d'un système dépressionnaire), centrée
  // sur un point qui varie selon le seed.
  const cx = W * (0.35 + rand(seed + 50) * 0.3);
  const cy = H * (0.35 + rand(seed + 51) * 0.3);
  let spiral = "";
  const turns = 2.2;
  const steps = 70;
  for (let arm = 0; arm < 3; arm++) {
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2 + (arm * (Math.PI * 2)) / 3;
      const radius = 10 + t * 150;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.92;
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    spiral += `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${16 - arm * 2}" stroke-linecap="round" opacity="${0.55 - arm * 0.1}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="ocean" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stop-color="#173B5E"/>
        <stop offset="100%" stop-color="#0B1E33"/>
      </radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="14"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#ocean)"/>
    ${clouds}
    ${spiral}
    <circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="10" fill="#FFFFFF" opacity="0.9"/>
    <text x="12" y="${H - 14}" font-size="13" fill="#CFE0DE" font-family="Arial, sans-serif">${timestampLabel} · exemple provisoire</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
