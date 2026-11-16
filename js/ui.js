// Briques d'interface : icônes, feuilles (sheets), dialogues, tuiles de pièces.
import { html, raw } from './util.js';
import { ICONS, CAT, SUB, COLOR } from './catalog.js';
import { photoUrl } from './store.js';

const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  swap: '<path d="M17 4l3 3-3 3M20 7H8M7 20l-3-3 3-3M4 17h12"/>',
  sparkle: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-5-5-8.5 8.5"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5z"/>',
  cloudOk: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5z"/><path d="M9.5 13l2 2 3.5-3.5"/>',
  hanger: '<path d="M10 6a2 2 0 1 1 2 2v1.5l8.4 6a1 1 0 0 1-.6 1.8H4.2a1 1 0 0 1-.6-1.8L12 9.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  location: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  shirt: ICONS.top
};

export function icon(name, size = 22, sw = 1.8, extra = '') {
  const d = P[name] || '';
  return raw(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`);
}

export function garmentIcon(cat, size = 40, sw = 1.2, cls = 'icon') {
  return raw(`<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#1D1B1A" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[cat] || ICONS.top}"/></svg>`);
}

export function rawIcon(paths, size = 22, sw = 1.8) {
  return raw(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`);
}

export const itemName = (it) => it.name || SUB[it.sub]?.label || CAT[it.cat]?.label || 'Pièce';
export const subLabel = (it) => SUB[it.sub]?.label || CAT[it.cat]?.label || '';
export const tintOf = (it) => CAT[it.cat]?.tint || '#F3EDE8';

// Contenu d'une vignette : photo si disponible, sinon pictogramme sur fond teinté.
export function photoOrIcon(it, kind = 'thumb', size = 40) {
  const url = it.photo ? photoUrl(it.photo, kind) : null;
  if (url) return html`<img src="${url}" alt="" loading="lazy" decoding="async">`;
  return garmentIcon(it.cat, size);
}

export function colorDot(id) {
  const c = COLOR[id];
  if (!c) return '';
  return raw(`<span class="dot" style="background:${c.hex}"></span>`);
}

// ---------- Feuilles ----------
let sheetStack = [];

export function openSheet(def) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-back" data-close></div><section class="sheet ${def.tall ? 'tall' : ''}" role="dialog" aria-modal="true" aria-label="${def.title || ''}"><div class="grabber"></div><div class="sheet-nav" data-nav></div><div class="sheet-body" data-body></div></section>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  const s = {
    def, wrap,
    el: wrap.querySelector('.sheet'),
    body: wrap.querySelector('[data-body]'),
    nav: wrap.querySelector('[data-nav]'),
    state: def.state || {},
    renderNav() {
      const L = typeof def.left === 'function' ? def.left(s) : def.left;
      const R = typeof def.right === 'function' ? def.right(s) : def.right;
      const T = typeof def.title === 'function' ? def.title(s) : def.title;
      s.nav.innerHTML = `${L ? `<button type="button" data-act="${L.act || 'close'}">${L.label}</button>` : '<span></span>'}<h1>${T || ''}</h1>${R ? `<button type="button" data-act="${R.act}" ${R.disabled ? 'disabled' : ''}>${R.busy ? '<span class="spin"></span>' : R.label}</button>` : '<span></span>'}`;
    },
    render() {
      s.renderNav();
      const keep = [...s.body.querySelectorAll('[data-keep]')].map((el) => [el.dataset.keep, el.scrollLeft]);
      const top = s.body.scrollTop;
      const a = document.activeElement;
      const focus = a && a.id && s.body.contains(a) ? { id: a.id, p: a.selectionStart } : null;
      s.body.innerHTML = String(def.body(s));
      keep.forEach(([k, l]) => { const el = s.body.querySelector(`[data-keep="${k}"]`); if (el) el.scrollLeft = l; });
      s.body.scrollTop = top;
      if (focus) { const el = s.body.querySelector('#' + focus.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focus.p, focus.p); } catch { } } }
      def.onRender?.(s);
    },
    refresh(part) {
      s.renderNav();
      const nodes = part ? s.body.querySelectorAll(`[data-part="${part}"]`) : s.body.querySelectorAll('[data-part]');
      nodes.forEach((n) => { const fn = def.parts?.[n.dataset.part]; if (fn) n.innerHTML = String(fn(s)); });
      def.onRender?.(s);
    },
    close(result) { closeSheet(s, result); }
  };
  const onClick = (e) => {
    if (e.target.closest('[data-close]')) { if (!def.modal) s.close(); return; }
    const a = e.target.closest('[data-act]');
    if (!a || !wrap.contains(a)) return;
    const name = a.dataset.act;
    if (name === 'close') return s.close();
    def.actions?.[name]?.(s, a, e);
  };
  const onInput = (e) => { const a = e.target.closest('[data-input]'); if (a) def.actions?.[a.dataset.input]?.(s, a, e); };
  wrap.addEventListener('click', onClick);
  wrap.addEventListener('input', onInput);
  wrap.addEventListener('change', onInput);
  s.onKey = (e) => { if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === s && !def.modal) s.close(); };
  document.addEventListener('keydown', s.onKey);
  sheetStack.push(s);
  s.render();
  def.onMount?.(s);
  return s;
}

function closeSheet(s, result) {
  if (s.closed) return;
  s.closed = true;
  s.def.onClose?.(s, result);
  s.wrap.classList.add('closing');
  s.el.classList.add('closing');
  document.removeEventListener('keydown', s.onKey);
  sheetStack = sheetStack.filter((x) => x !== s);
  setTimeout(() => { s.wrap.remove(); if (!sheetStack.length) document.body.style.overflow = ''; }, 220);
}

export const sheetOpen = () => sheetStack.length > 0;
export const refreshSheets = () => sheetStack.forEach((s) => { if (s.def.live) (s.def.parts ? s.refresh() : s.render()); });

// ---------- Dialogue de confirmation ----------
export function confirmDialog({ title, text, ok = 'OK', cancel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const d = document.createElement('div');
    d.className = 'dialog-wrap';
    d.innerHTML = String(html`<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t"><div class="body"><h3 id="dlg-t">${title}</h3>${text ? html`<p>${text}</p>` : ''}</div><div class="acts"><button type="button" data-v="0">${cancel}</button><button type="button" data-v="1" class="${danger ? 'danger' : 'strong'}">${ok}</button></div></div>`);
    document.body.appendChild(d);
    d.querySelector('[data-v="1"]').focus();
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b && e.target !== d) return;
      d.remove(); resolve(b ? b.dataset.v === '1' : false);
    });
  });
}
