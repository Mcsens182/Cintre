// Petits outils partagés : gabarits HTML sûrs, identifiants, dates, toasts.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw { constructor(v) { this.v = v; } toString() { return this.v; } }
export const raw = (v) => new Raw(v);

function flat(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.v;
  if (Array.isArray(v)) return v.map(flat).join('');
  return esc(v);
}

// html`<div>${valeur}</div>` échappe les valeurs ; raw() ou html`` imbriqué passent tels quels.
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += flat(vals[i]); });
  return raw(out);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const todayKey = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const longDate = (d = new Date()) => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
export const shortDate = (key) => { const d = new Date(key + 'T12:00'); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
export const relDay = (key) => {
  const n = daysBetween(key, todayKey());
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n < 7) return `il y a ${n} jours`;
  if (n < 14) return 'la semaine dernière';
  if (n < 60) return `il y a ${Math.round(n / 7)} semaines`;
  return `il y a ${Math.round(n / 30)} mois`;
};

export const formatBytes = (b) => b > 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(b / 1e3)) + ' Ko';

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
