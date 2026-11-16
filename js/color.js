// Couleurs : détection de la couleur dominante d'une photo et harmonie d'une tenue.
import { COLORS, COLOR } from './catalog.js';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToLab([r, g, b]) {
  const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g3 = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = g3(x); y = g3(y); z = g3(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const PALETTE_LAB = COLORS.filter((c) => !c.pattern).map((c) => ({ id: c.id, lab: rgbToLab(hexToRgb(c.hex)) }));

export function nearestColor(rgb) {
  const lab = rgbToLab(rgb);
  let best = null, bd = Infinity;
  for (const p of PALETTE_LAB) {
    const d = (p.lab[0] - lab[0]) ** 2 + (p.lab[1] - lab[1]) ** 2 + (p.lab[2] - lab[2]) ** 2;
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}

// Analyse le centre de l'image (là où se trouve la pièce) avec un petit k-means.
export function dominantColor(canvas) {
  const S = 40;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  ctx.drawImage(canvas, w * 0.22, h * 0.22, w * 0.56, h * 0.56, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S).data;
  const pts = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) pts.push([px[i], px[i + 1], px[i + 2]]);
  if (!pts.length) return null;
  const K = 4;
  let centers = Array.from({ length: K }, (_, k) => pts[Math.floor((k + 0.5) * pts.length / K)].slice());
  let assign = new Array(pts.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < pts.length; i++) {
      let bi = 0, bd = Infinity;
      for (let k = 0; k < K; k++) {
        const d = (pts[i][0] - centers[k][0]) ** 2 + (pts[i][1] - centers[k][1]) ** 2 + (pts[i][2] - centers[k][2]) ** 2;
        if (d < bd) { bd = d; bi = k; }
      }
      assign[i] = bi;
    }
    const sums = Array.from({ length: K }, () => [0, 0, 0, 0]);
    pts.forEach((p, i) => { const s = sums[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    centers = sums.map((s, k) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[k]));
  }
  const counts = new Array(K).fill(0);
  assign.forEach((a) => counts[a]++);
  const order = counts.map((n, k) => [n, k]).sort((a, b) => b[0] - a[0]);
  const rgb = centers[order[0][1]].map(Math.round);
  return { id: nearestColor(rgb), rgb };
}

// ---------- Harmonie ----------
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Score positif = bonne association. Les neutres vont avec tout ; au plus deux couleurs vives,
// et si deux, proches (camaïeu) ou complémentaires.
export function harmonyScore(colorIds) {
  const cols = colorIds.map((id) => COLOR[id]).filter(Boolean);
  const vivid = cols.filter((c) => !c.neutral && !c.pattern);
  const patterns = cols.filter((c) => c.pattern).length;
  let s = 0;
  if (patterns > 1) s -= 6;
  if (patterns === 1 && vivid.length > 1) s -= 3;
  const hues = [...new Set(vivid.map((c) => c.id))].map((id) => COLOR[id].h);
  if (hues.length === 0) s += 1.8;
  else if (hues.length === 1) s += 2;
  else if (hues.length === 2) {
    const d = hueDist(hues[0], hues[1]);
    if (d <= 35) s += 1.5;            // camaïeu
    else if (d >= 150) s += 1;        // complémentaires
    else s -= 2.5;                     // ça se bat
  } else s -= 3 * (hues.length - 2) + 2;
  // Noir + marine côte à côte : souvent peu flatteur
  const ids = cols.map((c) => c.id);
  if (ids.includes('noir') && ids.includes('marine')) s -= 1;
  // Tout blanc ou tout noir : correct mais plat
  if (ids.length >= 3 && new Set(ids).size === 1) s -= 1;
  return s;
}

export const colorLabel = (id) => COLOR[id]?.label || '';
export const colorSwatch = (id) => {
  const c = COLOR[id];
  if (!c) return '#DDD';
  return c.hex;
};
