// Écran « Tenues » : tenues enregistrées, historique, composer une tenue.
import * as S from '../store.js';
import { html, toast, shortDate, todayKey, plural } from '../util.js';
import { icon, openSheet, confirmDialog, itemName, photoOrIcon, tintOf } from '../ui.js';
import { CAT, SLOT_ORDER } from '../catalog.js';
import { generate } from '../engine.js';
import { lastWeather } from '../weather.js';

const st = { tab: 'saved' };

const byOrder = (ids) => ids.map((id) => S.item(id)).filter(Boolean).sort((a, b) => SLOT_ORDER.indexOf(a.cat) - SLOT_ORDER.indexOf(b.cat));

function strip(ids) {
  return html`<div class="strip">${byOrder(ids).slice(0, 4).map((it) => html`<div class="ph" style="background:${tintOf(it)}">${photoOrIcon(it, 'thumb', 22)}</div>`)}</div>`;
}

function savedList() {
  const list = S.outfits();
  if (!list.length) return html`<div class="card mt16"><div class="empty">
    <div class="big">${icon('heart', 28, 1.6)}</div><h3>Aucune tenue enregistrée</h3>
    <p>Compose une tenue pièce par pièce, ou enregistre celle que je te propose le matin.</p>
    <button type="button" class="btn btn-primary" data-act="compose">${icon('sparkle', 20)}Composer une tenue</button></div></div>`;
  return html`<div class="stack mt16">${list.map((o) => {
    const worn = S.wears().filter((w) => w.outfitId === o.id).length;
    return html`<button type="button" class="look" data-act="openOutfit" data-id="${o.id}">${strip(o.itemIds)}<span class="info"><b>${o.name}</b><small>${S.occasion(o.occasion).label}${worn ? ` · portée ${worn} fois` : ''}</small></span><span style="color:#B5ADA7">${icon('chev', 14, 2.8)}</span></button>`;
  })}</div>`;
}

function history() {
  const list = S.wears().slice(0, 60);
  if (!list.length) return html`<div class="card mt16"><div class="empty">
    <div class="big">${icon('calendar', 28, 1.6)}</div><h3>Pas encore d'historique</h3>
    <p>Chaque fois que tu touches « Porter cette tenue », je la note ici. Ça m'aide à varier.</p></div></div>`;
  return html`<div class="stack mt16">${list.map((w) => html`<button type="button" class="look" data-act="openWear" data-date="${w.date}">${strip(w.itemIds)}<span class="info"><b style="text-transform:capitalize">${w.date === todayKey() ? "Aujourd'hui" : shortDate(w.date)}</b><small>${S.occasion(w.occasion).label} · ${plural(w.itemIds.length, 'pièce', 'pièces')}</small></span></button>`)}</div>`;
}

export default {
  render() {
    return html`<main class="screen">
      <div class="top"><h1 class="large-title">Tenues</h1><button type="button" class="pill-btn" data-act="compose">Composer</button></div>
      <div class="seg mt16" role="group" aria-label="Affichage"><button type="button" aria-pressed="${st.tab === 'saved'}" data-act="tab" data-v="saved">Enregistrées</button><button type="button" aria-pressed="${st.tab === 'history'}" data-act="tab" data-v="history">Historique</button></div>
      ${st.tab === 'saved' ? savedList() : history()}
    </main>`;
  },
  actions: {
    tab(el) { st.tab = el.dataset.v; S.notify(); },
    compose() { openComposer(); },
    openOutfit(el) { openOutfitDetail({ outfitId: el.dataset.id }); },
    openWear(el) { openOutfitDetail({ date: el.dataset.date }); }
  }
};

// ---------- Détail d'une tenue ----------
function openOutfitDetail({ outfitId = null, date = null }) {
  openSheet({
    title: () => (outfitId ? S.outfit(outfitId)?.name || 'Tenue' : date === todayKey() ? "Aujourd'hui" : shortDate(date)),
    tall: true, live: true,
    left: { label: 'Fermer' },
    right: outfitId ? { label: 'Modifier', act: 'edit' } : null,
    body: () => {
      const o = outfitId ? S.outfit(outfitId) : S.wearOn(date);
      if (!o) return html`<div class="empty"><p>Cette tenue n'existe plus.</p></div>`;
      const its = byOrder(o.itemIds);
      return html`<div class="outfit-grid mt8">${its.map((it) => html`<div class="tile" style="background:${tintOf(it)}"><div class="ph">${photoOrIcon(it, 'thumb', 40)}</div><span class="cap ${it.photo ? '' : 'light'}"><small>${CAT[it.cat].label}</small><b>${itemName(it)}</b></span></div>`)}</div>
        <p class="why">${S.occasion(o.occasion).label}${date ? ` · portée ${shortDate(date)}` : ''}</p>
        ${outfitId ? html`<button type="button" class="btn btn-primary mt16" data-act="wear">Porter aujourd'hui</button>
          <div class="group mt20"><button type="button" class="row danger" data-act="del">Supprimer la tenue</button></div>`
        : html`<button type="button" class="btn btn-soft mt16" data-act="saveIt">${icon('heart', 18, 2)}Enregistrer cette tenue</button>
          <div class="group mt20"><button type="button" class="row danger" data-act="delWear">Retirer de l'historique</button></div>`}`;
    },
    actions: {
      wear(s) { const o = S.outfit(outfitId); S.wearToday(o.itemIds.filter((id) => S.item(id)), o.occasion, o.id); toast("C'est noté. Bonne journée !"); s.close(); },
      edit(s) { const o = S.outfit(outfitId); s.close(); setTimeout(() => openComposer({ outfit: o }), 230); },
      async del(s) { if (await confirmDialog({ title: 'Supprimer cette tenue ?', text: 'Les pièces restent dans ta garde-robe.', ok: 'Supprimer', danger: true })) { S.deleteOutfit(outfitId); s.close(); } },
      saveIt(s) { const w = S.wearOn(date); s.close(); setTimeout(() => openSaveOutfit(w.itemIds, w.occasion), 230); },
      async delWear(s) { if (await confirmDialog({ title: "Retirer de l'historique ?", ok: 'Retirer', danger: true })) { S.unwear(date); s.close(); } }
    }
  });
}

// ---------- Enregistrer une tenue ----------
export function openSaveOutfit(itemIds, occasionId, existing = null) {
  openSheet({
    title: existing ? 'Renommer' : 'Enregistrer la tenue',
    left: { label: 'Annuler' },
    right: { label: 'Enregistrer', act: 'save' },
    state: { name: existing?.name || '', occ: occasionId },
    body: (s) => html`<div class="mt8" style="display:flex;gap:6px;justify-content:center">${byOrder(itemIds).map((it) => html`<div style="width:64px;height:64px;border-radius:14px;overflow:hidden;background:${tintOf(it)};display:flex;align-items:center;justify-content:center">${photoOrIcon(it, 'thumb', 28)}</div>`)}</div>
      <div class="group mt20"><label class="block"><span class="lbl">Nom</span><input id="oname" class="field" type="text" value="${s.state.name}" placeholder="Ex. Lundi au bureau" data-input="name" autocomplete="off"></label>
      <div class="block"><span class="lbl">Occasion</span><div class="chips">${S.occasions().map((o) => html`<button type="button" class="chip" aria-pressed="${s.state.occ === o.id}" data-act="occ" data-id="${o.id}">${o.label}</button>`)}</div></div></div>`,
    onMount(s) { setTimeout(() => s.body.querySelector('#oname')?.focus(), 300); },
    actions: {
      name(s, el) { s.state.name = el.value; },
      occ(s, el) { s.state.occ = el.dataset.id; s.render(); },
      save(s) {
        const name = s.state.name.trim() || `Tenue ${S.occasion(s.state.occ).label.toLowerCase()}`;
        S.saveOutfit({ id: existing?.id, name, itemIds: itemIds.filter((id) => S.item(id)), occasion: s.state.occ });
        toast('Tenue enregistrée'); s.close();
      }
    }
  });
}

// ---------- Composer ----------
export function openComposer({ outfit = null, lockIds = [] } = {}) {
  const sel = {}; const locked = {};
  const pre = outfit ? outfit.itemIds : lockIds;
  pre.forEach((id) => { const it = S.item(id); if (it) { sel[it.cat] = it.id; if (!outfit) locked[it.cat] = true; } });
  let wx = null;
  lastWeather().then((r) => { wx = r?.w || null; });

  const sheet = openSheet({
    title: outfit ? 'Modifier la tenue' : 'Composer',
    tall: true, live: true,
    left: { label: 'Annuler' },
    right: (s) => ({ label: 'Enregistrer', act: 'save', disabled: !['top', 'bottom'].some((k) => s.state.sel[k]) }),
    state: { sel, locked, occ: outfit?.occasion || 'casual' },
    body: (s) => {
      const items = S.items();
      return html`<p class="sub" style="margin:0 4px 14px">Choisis une pièce par ligne. Garde celles que tu aimes, je complète le reste.</p>
        <div class="seg-scroll" data-keep="cocc" style="margin-bottom:16px"><div class="chips" style="flex-wrap:nowrap">${S.occasions().map((o) => html`<button type="button" class="chip" aria-pressed="${s.state.occ === o.id}" data-act="occ" data-id="${o.id}">${o.label}</button>`)}</div></div>
        ${SLOT_ORDER.map((slot) => {
        const list = items.filter((i) => i.cat === slot);
        const cur = s.state.sel[slot] ? S.item(s.state.sel[slot]) : null;
        const lk = !!s.state.locked[slot];
        return html`<section style="margin:0 -16px 16px">
            <div class="slot-h"><span class="t">${CAT[slot].label} · <b>${cur ? itemName(cur) : 'Aucun'}</b></span>
              ${cur ? html`<button type="button" class="lock" aria-pressed="${lk}" data-act="lock" data-slot="${slot}">${icon(lk ? 'lock' : 'unlock', 12, 2.4)}${lk ? 'Gardée' : 'Garder'}</button>` : ''}</div>
            <div class="row-scroll mt8" data-keep="c-${slot}">
              ${slot === 'outer' || slot === 'acc' ? html`<button type="button" class="opt none" aria-pressed="${!cur}" data-act="pick" data-slot="${slot}" data-id="">Aucun${!cur ? html`<span class="sel-ring"></span>` : ''}</button>` : ''}
              ${list.map((it) => html`<button type="button" class="opt" aria-pressed="${cur?.id === it.id}" aria-label="${itemName(it)}" data-act="pick" data-slot="${slot}" data-id="${it.id}" style="background:${tintOf(it)}">${photoOrIcon(it, 'thumb', 34)}${cur?.id === it.id ? html`<span class="sel-ring"></span>` : ''}</button>`)}
              ${!list.length ? html`<span class="muted" style="font-size:14px;align-self:center">Aucune pièce dans cette catégorie.</span>` : ''}
            </div></section>`;
      })}
        <button type="button" class="btn btn-primary" data-act="fill">${icon('sparkle', 18, 1.9)}Compléter le reste</button>
        <button type="button" class="btn btn-text mt8" data-act="wear" ${['top', 'bottom'].some((k) => s.state.sel[k]) ? '' : 'disabled'}>Porter aujourd'hui</button>`;
    },
    actions: {
      occ(s, el) { s.state.occ = el.dataset.id; s.render(); },
      pick(s, el) { const slot = el.dataset.slot; s.state.sel[slot] = el.dataset.id || null; if (!el.dataset.id) s.state.locked[slot] = false; s.render(); },
      lock(s, el) { const k = el.dataset.slot; s.state.locked[k] = !s.state.locked[k]; s.render(); },
      fill(s) {
        const lockedItems = {};
        Object.entries(s.state.locked).forEach(([k, v]) => { if (v && s.state.sel[k]) lockedItems[k] = S.item(s.state.sel[k]); });
        const r = generate(S.items(), wx, S.occasion(s.state.occ), { occasions: S.occasions(), feel: S.settings().feel, avoidDays: S.settings().avoidDays, locked: lockedItems });
        if (!r.pieces) { toast('Il me manque des pièces pour compléter.'); return; }
        SLOT_ORDER.forEach((k) => { if (!s.state.locked[k]) s.state.sel[k] = r.pieces[k]?.id || null; });
        s.render();
      },
      wear(s) {
        const ids = Object.values(s.state.sel).filter(Boolean);
        S.wearToday(ids, s.state.occ, outfit?.id || null);
        toast("C'est noté. Bonne journée !"); s.close();
      },
      save(s) {
        const ids = Object.values(s.state.sel).filter(Boolean);
        if (outfit) { S.saveOutfit({ ...outfit, itemIds: ids, occasion: s.state.occ }); toast('Tenue mise à jour'); s.close(); }
        else { s.close(); setTimeout(() => openSaveOutfit(ids, s.state.occ), 230); }
      }
    }
  });
  return sheet;
}
