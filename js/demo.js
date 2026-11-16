// Garde-robe d'exemple : pour tester l'app avant d'avoir pris ses propres photos.
import * as S from './store.js';
import { ICONS, SUB, COLOR } from './catalog.js';
import { uid } from './util.js';

const DEMO = [
  ['outer', 'blouson', 'denim', 'Veste en jean'],
  ['outer', 'blazer', 'marine', 'Blazer marine'],
  ['outer', 'manteau', 'camel', 'Manteau camel'],
  ['outer', 'impermeable', 'kaki', 'Imperméable kaki'],
  ['outer', 'surchemise', 'ecru', 'Surchemise écrue'],
  ['top', 'tshirt', 'blanc', 'T-shirt blanc'],
  ['top', 'tshirt', 'noir', 'T-shirt noir'],
  ['top', 'chemise', 'bleuciel', 'Chemise bleu ciel'],
  ['top', 'chemise', 'blanc', 'Chemise blanche'],
  ['top', 'polo', 'marine', 'Polo marine'],
  ['top', 'pull', 'grisclair', 'Pull col rond gris'],
  ['top', 'sweat', 'sapin', 'Sweat vert sapin'],
  ['top', 'colroule', 'noir', 'Col roulé noir'],
  ['bottom', 'jean', 'denim', 'Jean brut'],
  ['bottom', 'chino', 'beige', 'Chino beige'],
  ['bottom', 'pantalon', 'anthracite', 'Pantalon anthracite'],
  ['bottom', 'short', 'beige', 'Short en lin'],
  ['bottom', 'jogging', 'gris', 'Jogging gris'],
  ['shoes', 'baskets', 'blanc', 'Baskets blanches'],
  ['shoes', 'derbies', 'marron', 'Derbies marron'],
  ['shoes', 'mocassins', 'noir', 'Mocassins noirs'],
  ['shoes', 'bottines', 'camel', 'Bottines camel'],
  ['shoes', 'running', 'gris', 'Running'],
  ['acc', 'echarpe', 'bordeaux', 'Écharpe bordeaux'],
  ['acc', 'casquette', 'marine', 'Casquette marine'],
  ['acc', 'montre', 'noir', 'Montre'],
  ['acc', 'ceinture', 'marron', 'Ceinture en cuir']
];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c.join(',')})`;
}

function draw(cat, colorId, w = 600, h = 600) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#F4EFEA'); g.addColorStop(1, '#E9E2DB');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const hex = COLOR[colorId]?.hex || '#999999';
  const s = w / 24 * 0.66;
  ctx.save();
  ctx.translate(w / 2 - 12 * s, h / 2 - 12 * s);
  ctx.scale(s, s);
  const p = new Path2D(ICONS[cat]);
  ctx.shadowColor = 'rgba(60,40,30,.18)'; ctx.shadowBlur = 18 / s * 0.6; ctx.shadowOffsetY = 6 / s;
  ctx.fillStyle = hex; ctx.fill(p, 'evenodd');
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 0.35; ctx.lineJoin = 'round'; ctx.strokeStyle = shade(hex, 0.7);
  ctx.stroke(p);
  ctx.restore();
  return c;
}

const toBlob = (c, q) => new Promise((r) => c.toBlob((b) => (b && b.type === 'image/webp' ? r(b) : c.toBlob(r, 'image/jpeg', q)), 'image/webp', q));

export async function loadDemo() {
  const now = Date.now();
  let i = 0;
  for (const [cat, sub, color, name] of DEMO) {
    const full = await toBlob(draw(cat, color, 600, 600), 0.8);
    const thumb = await toBlob(draw(cat, color, 300, 300), 0.75);
    const pid = uid();
    await S.storePhoto(pid, full, thumb);
    const sd = SUB[sub];
    S.saveItem({
      cat, sub, color, name, warmth: sd.warmth, rain: !!sd.rain,
      occasions: sd.occ.filter((o) => S.occasions().some((x) => x.id === o)),
      photo: { id: pid, w: 600, h: 600, size: full.size }, demo: true,
      createdAt: now - (DEMO.length - i++) * 1000
    });
  }
}
