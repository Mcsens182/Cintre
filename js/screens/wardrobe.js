// Écran « Garde-robe » : rangées par catégorie, vue détaillée par catégorie, recherche, tri.
import * as S from '../store.js';
import { html, plural, daysBetween, todayKey } from '../util.js';
import { icon, photoOrIcon, itemName, colorDot, openSheet } from '../ui.js';
import { CATEGORIES, CAT, SUB, COLOR } from '../catalog.js';
import { openItemDetail, openAddItem } from './item.js';
import { loadDemo } from '../demo.js';

const st = { cat: null, sub: null, q: '', sort: 'recent', dormant: false };

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function isDormant(it) {
  const w = S.wornInfo(it.id);
  const ageDays = (Date.now() - it.createdAt) / 86400000;
  if (ageDays < 30) return false;
  return !w.last || daysBetween(w.last, todayKey()) > 30;
}

function sorted(list) {
  const l = [...list];
  if (st.sort === 'least') l.sort((a, b) => S.wornInfo(a.id).count - S.wornInfo(b.id).count || (S.wornInfo(a.id).last || '').localeCompare(S.wornInfo(b.id).last || ''));
  else if (st.sort === 'color') { const order = Object.keys(COLOR); l.sort((a, b) => order.indexOf(a.color) - order.indexOf(b.color)); }
  else l.sort((a, b) => b.createdAt - a.createdAt);
  return l;
}

function matches(it) {
  if (st.dormant && !isDormant(it)) return false;
  if (!st.q) return true;
  const q = norm(st.q);
  return [itemName(it), SUB[it.sub]?.label, CAT[it.cat]?.label, COLOR[it.color]?.label, it.notes].some((s) => norm(s).includes(q));
}

function mini(it) {
  return html`<button type="button" class="mini" data-act="open" data-id="${it.id}">
    <div class="ph" style="background:${CAT[it.cat]?.tint}">${photoOrIcon(it, 'thumb', 42)}${colorDot(it.color)}</div>
    <span class="n">${itemName(it)}</span>
  </button>`;
}

function overview(items) {
  return CATEGORIES.map((c) => {
    const list = sorted(items.filter((i) => i.cat === c.id));
    if (!list.length) return '';
    return html`<section class="mt24">
      <button type="button" class="pad" data-act="cat" data-id="${c.id}" style="display:flex;align-items:center;gap:6px;border:none;background:none;padding-top:0;padding-bottom:0;min-height:32px;color:inherit">
        <h2 class="section-h">${c.plural}</h2><span class="muted" style="font-size:15px">${list.length}</span><span style="color:#B5ADA7">${icon('chev', 14, 2.8)}</span>
      </button>
      <div class="row-scroll mt8" data-keep="row-${c.id}">${list.slice(0, 12).map(mini)}${list.length > 12 ? html`<button type="button" class="mini add" data-act="cat" data-id="${c.id}"><div class="ph">Tout voir</div></button>` : ''}</div>
    </section>`;
  });
}

function catView(items) {
  const c = CAT[st.cat];
  let list = items.filter((i) => i.cat === st.cat);
  const subs = c.subs.filter((s) => list.some((i) => i.sub === s.id));
  if (st.sub) list = list.filter((i) => i.sub === st.sub);
  list = sorted(list);
  return html`
    ${subs.length > 1 ? html`<div class="seg-scroll mt16" data-keep="subs"><div class="chips" style="flex-wrap:nowrap">
      <button type="button" class="chip" aria-pressed="${!st.sub}" data-act="sub" data-id="">Tout</button>
      ${subs.map((s) => html`<button type="button" class="chip" aria-pressed="${st.sub === s.id}" data-act="sub" data-id="${s.id}">${s.label}</button>`)}
    </div></div>` : ''}
    <div class="grid3 pad mt16">${list.map(mini)}
      <button type="button" class="mini add" data-act="add-item"><div class="ph">${icon('plus', 26, 1.8)}</div><span class="n">Ajouter</span></button>
    </div>`;
}

function results(items) {
  const list = sorted(items);
  if (!list.length) return html`<div class="empty"><p>${st.dormant && !st.q ? 'Aucune pièce dormante, tout est porté régulièrement.' : 'Aucune pièce ne correspond.'}</p></div>`;
  return html`<div class="grid3 pad mt16">${list.map(mini)}</div>`;
}

export default {
  render() {
    const all = S.items();
    const items = all.filter(matches);
    const dormantN = all.filter(isDormant).length;
    const filtering = !!st.q || st.dormant;
    const head = st.cat
      ? html`<div class="top pad"><button type="button" data-act="back" style="border:none;background:none;color:var(--accent);font-size:17px;display:flex;align-items:center;gap:2px;padding:0;min-height:44px;margin-left:-6px">${icon('back', 22, 2.4)}Garde-robe</button>
          <button type="button" class="icon-btn" data-act="sort" aria-label="Trier">${icon('filter', 20, 1.9)}</button></div>
          <h1 class="large-title pad">${CAT[st.cat].plural}</h1>`
      : html`<div class="top pad"><h1 class="large-title">Garde-robe</h1><button type="button" class="icon-btn" data-act="sort" aria-label="Trier et filtrer">${icon('filter', 20, 1.9)}</button></div>
          <div class="sub pad">${plural(all.length, 'pièce', 'pièces')}${dormantN ? ` · ${dormantN} pas portée${dormantN > 1 ? 's' : ''} depuis un mois` : ''}</div>`;
    let body;
    if (!all.length) {
      body = html`<div class="pad mt24"><section class="card"><div class="empty">
        <div class="big">${icon('camera', 28, 1.6)}</div><h3>Ajoute tes vêtements</h3>
        <p>Une photo de toi qui portes la pièce suffit : tu recadres, je compresse, et c'est rangé.</p>
        <button type="button" class="btn btn-primary" data-act="add-item">${icon('camera', 20)}Ajouter une pièce</button>
        <button type="button" class="btn btn-text mt8" data-act="demo">Essayer avec des exemples</button>
      </div></section></div>`;
    } else if (st.cat) body = catView(items);
    else if (filtering) body = results(items);
    else body = overview(items);
    return html`<main class="screen flush">
      ${head}
      ${all.length ? html`<label class="search pad" style="margin:14px 20px 0;padding:0 10px">${icon('search', 16, 2.2, 'style="color:var(--muted)"')}<span class="sr">Rechercher</span><input id="wsearch" type="search" placeholder="Rechercher une pièce, une couleur…" value="${st.q}" data-input="q" autocomplete="off"></label>` : ''}
      ${st.dormant ? html`<div class="pad mt12"><button type="button" class="chip" aria-pressed="true" data-act="undormant">Pièces dormantes ${icon('close', 14, 2.4)}</button></div>` : ''}
      ${body}
    </main>`;
  },
  actions: {
    open(el) { openItemDetail(el.dataset.id); },
    cat(el) { st.cat = el.dataset.id; st.sub = null; window.scrollTo(0, 0); S.notify(); },
    back() { st.cat = null; st.sub = null; S.notify(); },
    sub(el) { st.sub = el.dataset.id || null; S.notify(); },
    q(el) { st.q = el.value; S.notify(); },
    undormant() { st.dormant = false; S.notify(); },
    demo() { loadDemo(); },
    sort() {
      openSheet({
        title: 'Trier et filtrer',
        right: { label: 'OK', act: 'close' },
        body: () => html`<div class="group-h">Trier par</div>
          <div class="group">${[['recent', 'Ajout le plus récent'], ['least', 'Les moins portées'], ['color', 'Couleur']].map(([k, l]) => html`<button type="button" class="row" data-act="set" data-k="${k}"><span>${l}</span>${st.sort === k ? html`<span style="color:var(--accent)">${icon('check', 20, 2.4)}</span>` : ''}</button>`)}</div>
          <div class="group-h">Filtrer</div>
          <div class="group"><div class="row"><span class="lbl">Pièces dormantes<small>Pas portées depuis plus d'un mois</small></span><button type="button" class="switch" role="switch" aria-checked="${st.dormant}" aria-label="Pièces dormantes" data-act="dormant"></button></div></div>`,
        actions: {
          set(s, el) { st.sort = el.dataset.k; s.render(); S.notify(); },
          dormant(s) { st.dormant = !st.dormant; s.render(); S.notify(); }
        }
      });
    }
  }
};
