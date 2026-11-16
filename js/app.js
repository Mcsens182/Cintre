// Point d'entrée : chargement, navigation par onglets, rendu.
import * as S from './store.js';
import * as Drive from './drive.js';
import { icon, refreshSheets } from './ui.js';
import { html } from './util.js';
import { persist } from './db.js';
import today from './screens/today.js';
import wardrobe from './screens/wardrobe.js';
import outfits from './screens/outfits.js';
import settings from './screens/settings.js';
import welcome from './screens/welcome.js';
import { openAddItem } from './screens/item.js';

const ROUTES = {
  aujourdhui: today,
  'garde-robe': wardrobe,
  tenues: outfits,
  reglages: settings
};

const root = document.getElementById('app');
let current = null;
let currentName = '';
let raf = 0;

function routeName() {
  const h = location.hash.replace('#', '');
  return ROUTES[h] ? h : 'aujourdhui';
}

function tabbar(active) {
  const tab = (id, label, ic) => html`<a href="#${id}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic, 26, 1.7)}${label}</a>`;
  return html`<div class="tabbar"><nav aria-label="Navigation principale">
    ${tab('aujourdhui', "Aujourd'hui", 'sun')}
    ${tab('garde-robe', 'Garde-robe', 'hanger')}
    <button type="button" data-act="add-item">${icon('plusCircle', 26, 1.7)}Ajouter</button>
    ${tab('tenues', 'Tenues', 'layers')}
  </nav></div>`;
}

// Garde le focus, la sélection et les défilements pendant un nouveau rendu.
function preserve(fn) {
  const a = document.activeElement;
  const focus = a && a.id && root.contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  const scrolls = [...root.querySelectorAll('[data-keep]')].map((el) => [el.dataset.keep, el.scrollLeft, el.scrollTop]);
  fn();
  scrolls.forEach(([k, l, t]) => { const el = root.querySelector(`[data-keep="${k}"]`); if (el) { el.scrollLeft = l; el.scrollTop = t; } });
  if (focus) {
    const el = document.getElementById(focus.id);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focus.s, focus.e); } catch { } }
  }
}

export function render() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!S.getLocal().onboarded) {
      if (current !== welcome) { current = welcome; currentName = 'welcome'; window.scrollTo(0, 0); }
      preserve(() => { root.innerHTML = String(welcome.render()); });
      welcome.mounted?.(root);
      return;
    }
    const name = routeName();
    const screen = ROUTES[name];
    const changed = screen !== current;
    if (changed) { current?.leave?.(); current = screen; currentName = name; }
    preserve(() => { root.innerHTML = String(screen.render()) + String(tabbar(name)); });
    if (changed) { window.scrollTo(0, 0); screen.enter?.(); }
    screen.mounted?.(root);
    refreshSheets();
  });
}

// Délégation des actions : data-act="nom" sur un élément cliquable, data-input="nom" sur un champ.
root.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (!a || !root.contains(a)) return;
  const name = a.dataset.act;
  if (name === 'add-item') { openAddItem(); return; }
  current?.actions?.[name]?.(a, e);
});
root.addEventListener('input', (e) => { const a = e.target.closest('[data-input]'); if (a) current?.actions?.[a.dataset.input]?.(a, e); });
root.addEventListener('change', (e) => { const a = e.target.closest('[data-change]'); if (a) current?.actions?.[a.dataset.change]?.(a, e); });
root.addEventListener('keydown', (e) => { const a = e.target.closest('[data-enter]'); if (a && e.key === 'Enter') { e.preventDefault(); current?.actions?.[a.dataset.enter]?.(a, e); } });

window.addEventListener('hashchange', render);

async function boot() {
  await S.load();
  S.subscribe(render);
  Drive.init();
  render();
  persist();
  if (S.getLocal().drive.connected && Drive.hasToken()) Drive.sync();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
}

boot();
