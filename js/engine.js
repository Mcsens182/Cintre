// Moteur de tenues : règles (météo, occasion, rotation) + harmonie des couleurs, avec une part de hasard.
import { SUB, CAT } from './catalog.js';
import { harmonyScore } from './color.js';
import { daysSinceWorn } from './store.js';

const SLOTS = ['outer', 'top', 'bottom', 'shoes', 'acc'];

// Température « ressentie par toi » sur la période utile de la journée.
export function effectiveTemp(w, feel = 0, evening = false) {
  if (!w) return 17 + feel * 3;
  let t = evening && w.eveningFeels != null ? w.eveningFeels * 0.7 + w.dayFeels * 0.3 : w.dayFeels * 0.6 + w.minFeels * 0.4;
  if (w.wind >= 35) t -= 2;
  return t + feel * 3;
}

function needs(T, w, formality) {
  const rainy = !!(w && w.rainy);
  const outerNeeded = T < 19.5 || rainy || (w && w.wind >= 35 && T < 24) || (formality >= 3 && T < 25);
  const outerWarm = T < 7 ? 3 : T < 13 ? 2.4 : T < 17 ? 1.6 : 1;
  const topWarm = T < 9 ? 2 : T < 16 ? 1.5 : 1;
  return { rainy, outerNeeded, outerWarm, topWarm, shortsOk: T >= 23 && formality <= 1, sandalsOk: T >= 22 && !rainy, coldAcc: T < 8, sunny: w && ['sun', 'partly'].includes(w.icon) && T >= 20 };
}

function allowed(it, slot, n, occ) {
  const sub = it.sub;
  if (slot === 'bottom' && sub === 'short' && !n.shortsOk && occ.id !== 'sport') return false;
  if (slot === 'bottom' && sub === 'jogging' && occ.formality > 0) return false;
  if (slot === 'shoes' && sub === 'sandales' && !n.sandalsOk) return false;
  if (slot === 'shoes' && sub === 'running' && occ.formality >= 2) return false;
  if (slot === 'outer' && it.warmth >= 3 && n.outerWarm < 1.5) return false; // pas de doudoune quand il fait doux
  if (slot === 'top' && it.warmth >= 2 && n.topWarm <= 1 && !n.outerNeeded) return false; // pas de pull en pleine chaleur
  return true;
}

function itemScore(it, slot, n, occ, occs, avoidDays) {
  let s = 0;
  const tags = it.occasions || [];
  if (tags.includes(occ.id)) s += 3;
  else {
    // pas taguée pour cette occasion : on regarde si elle va avec une occasion du même style
    const diffs = tags.map((t) => occs.find((x) => x.id === t)).filter(Boolean).map((o) => Math.abs(o.formality - occ.formality));
    const d = diffs.length ? Math.min(...diffs) : 9;
    s += d === 0 ? 1.8 : d === 1 ? (occ.formality >= 3 ? -1.2 : 0.3) : -3.5;
  }
  const ideal = slot === 'outer' ? n.outerWarm : slot === 'top' ? n.topWarm : 2;
  if (slot === 'outer' || slot === 'top') s -= 1.6 * Math.abs((it.warmth || 2) - ideal);
  if (slot === 'shoes' && it.sub === 'bottines' && !n.rainy && n.topWarm <= 1) s -= 1;
  if (slot === 'bottom' && it.sub === 'short' && n.shortsOk) s += 1;
  if (n.rainy && (slot === 'outer' || slot === 'shoes')) s += it.rain ? 2 : -1.2;
  const d = daysSinceWorn(it.id);
  if (d >= 1 && d < avoidDays) s -= 6;
  s += d === Infinity ? 0.8 : Math.min(d, 30) / 30;
  return s;
}

function weightedPick(list) {
  // softmax avec une température douce : les meilleurs sortent souvent, pas toujours
  const max = Math.max(...list.map((x) => x.s));
  const ws = list.map((x) => Math.exp((x.s - max) / 1.2));
  const tot = ws.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

export const signature = (pieces) => SLOTS.map((s) => pieces[s]?.id || '-').join('|');

/**
 * items     : pièces disponibles
 * w         : résumé météo ou null
 * occ       : { id, label, formality }
 * opts      : { occasions, feel, avoidDays, locked: {slot:item}, exclude: Set(signature), evening }
 */
export function generate(items, w, occ, opts = {}) {
  const { occasions = [], feel = 0, avoidDays = 3, locked = {}, exclude = new Set(), evening = false } = opts;
  const T = effectiveTemp(w, feel, evening);
  const n = needs(T, w, occ.formality);
  const bySlot = Object.fromEntries(SLOTS.map((s) => [s, []]));
  items.forEach((it) => { if (bySlot[it.cat]) bySlot[it.cat].push(it); });

  const cands = {};
  for (const slot of SLOTS) {
    if (locked[slot]) { cands[slot] = [{ it: locked[slot], s: 0 }]; continue; }
    let pool = bySlot[slot].filter((it) => allowed(it, slot, n, occ));
    if (!pool.length) pool = bySlot[slot];
    cands[slot] = pool.map((it) => ({ it, s: itemScore(it, slot, n, occ, occasions, avoidDays) }));
  }

  const missing = ['top', 'bottom', 'shoes'].filter((s) => !cands[s].length);
  if (missing.length) return { pieces: null, missing, T, n };

  let best = [];
  const tries = 240;
  for (let k = 0; k < tries; k++) {
    const pieces = {};
    let total = 0;
    for (const slot of ['top', 'bottom', 'shoes']) { const p = weightedPick(cands[slot]); pieces[slot] = p.it; total += p.s; }
    // veste : si besoin, ou verrouillée
    if (locked.outer) pieces.outer = locked.outer;
    else if (n.outerNeeded && cands.outer.length) { const p = weightedPick(cands.outer); pieces.outer = p.it; total += p.s; }
    else if (n.outerNeeded) total -= 2;
    // accessoire : seulement s'il apporte quelque chose
    if (locked.acc) pieces.acc = locked.acc;
    else if (cands.acc.length) {
      const useful = cands.acc.filter((c) => {
        const sub = c.it.sub;
        if (n.coldAcc && (sub === 'echarpe' || sub === 'bonnet')) return true;
        if (n.sunny && (sub === 'casquette' || sub === 'lunettes') && occ.formality <= 1) return true;
        if ((sub === 'montre' || sub === 'ceinture') && occ.formality >= 2) return true;
        return false;
      });
      if (useful.length && Math.random() < 0.75) { const p = weightedPick(useful); pieces.acc = p.it; total += p.s * 0.3 + 0.5; }
    }
    const colors = SLOTS.map((s) => pieces[s]?.color).filter(Boolean);
    total += harmonyScore(colors) * 1.6;
    const sig = signature(pieces);
    if (exclude.has(sig)) total -= 8;
    best.push({ pieces, total, sig });
  }
  // dédoublonner, garder les meilleures, en tirer une parmi les 4 premières
  const seen = new Set();
  best = best.sort((a, b) => b.total - a.total).filter((b) => (seen.has(b.sig) ? false : seen.add(b.sig)));
  // tirer au sort parmi les meilleures, à condition qu'elles soient vraiment proches de la première
  const top = best.filter((b) => b.total >= best[0].total - 2.5).slice(0, 4);
  const chosen = top[Math.floor(Math.random() * top.length)];
  return { pieces: chosen.pieces, sig: chosen.sig, score: chosen.total, T, n, missing: [] };
}

// ---------- Phrases ----------
const adj = (T) => (T < 4 ? 'très froid' : T < 10 ? 'froid' : T < 15 ? 'frais' : T < 20 ? 'doux' : T < 26 ? 'bon' : 'chaud');

export function weatherSentence(w, place) {
  if (!w) return null;
  const where = place ? ` à ${place}` : '';
  let s = `Il fait ${w.temp}° et ${adj(w.feels)}${where}.`;
  const extra = [];
  if (w.rainy) extra.push(`Pluie possible dans la journée (${w.rainProb} %).`);
  if (w.eveningFeels != null && w.eveningFeels <= w.feels - 4) extra.push(`Il fera ${w.eveningFeels}° ce soir.`);
  else if (w.feels <= w.temp - 4) extra.push(`Ressenti ${w.feels}°, à cause du vent.`);
  if (!extra.length && w.wind >= 35) extra.push('Ça souffle fort aujourd\'hui.');
  return [s, ...extra.slice(0, 1)].join(' ');
}

export function whySentence(res, w, occ) {
  if (!res?.pieces) return '';
  const p = res.pieces;
  const parts = [];
  const name = (it) => (it.name || SUB[it.sub]?.label || CAT[it.cat].label).toLowerCase();
  if (!w) parts.push('Sans la météo, je pars sur une tenue de mi-saison.');
  if (p.outer) {
    if (w && w.rainy && p.outer.rain) parts.push(`${cap(name(p.outer))} pour la pluie.`);
    else if (p.outer.warmth >= 3) parts.push(`${cap(name(p.outer))} : il fera ${w ? w.minFeels + '° au plus froid' : 'froid'}.`);
    else if (w && w.eveningFeels != null && w.eveningFeels <= w.dayFeels - 4) parts.push(`${cap(name(p.outer))} pour la fraîcheur du soir.`);
    else parts.push(`Une ${p.outer.warmth >= 2 ? 'veste' : 'veste légère'} suffit.`);
  } else if (w) parts.push(res.T >= 24 ? 'Pas besoin de veste, il fait chaud toute la journée.' : 'Pas besoin de veste, il fait doux toute la journée.');
  if (w && w.rainy && p.shoes && p.shoes.rain) parts.push(`${cap(name(p.shoes))} qui ne craignent pas l'eau.`);
  if (occ.formality >= 3) parts.push('Sobre et habillé.');
  else if (occ.id === 'sport') parts.push('Confortable pour bouger.');
  return parts.slice(0, 2).join(' ');
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
