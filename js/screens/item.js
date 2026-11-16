// Ajout, modification et fiche d'une pièce.
import * as S from '../store.js';
import { html, raw, uid, toast, formatBytes, relDay, plural } from '../util.js';
import { icon, openSheet, confirmDialog, itemName, photoOrIcon, garmentIcon } from '../ui.js';
import { CATEGORIES, CAT, SUB, COLORS, COLOR, WARMTH_LABELS } from '../catalog.js';
import { loadImage, rotate, cropCanvas, compress, Cropper, canvasToBase64Jpeg, QUALITY } from '../photo.js';
import { dominantColor } from '../color.js';
import { recognize } from '../ai.js';

// ---------- Formulaire commun ----------
function blankForm() {
  return { cat: null, sub: null, color: null, name: '', warmth: 2, rain: false, occasions: [], touched: {} };
}

function applySub(f, subId) {
  const sub = SUB[subId];
  if (!sub) return;
  f.sub = subId; f.cat = sub.cat;
  if (!f.touched.warmth) f.warmth = sub.warmth;
  if (!f.touched.rain) f.rain = !!sub.rain;
  if (!f.touched.occasions) f.occasions = sub.occ.filter((o) => S.occasions().some((x) => x.id === o));
}

const autoName = (f) => (f.sub ? `${SUB[f.sub].label}${f.color && !COLOR[f.color].pattern ? ' ' + COLOR[f.color].label.toLowerCase() : ''}` : '');

const formParts = {
  cat: (s) => {
    const f = s.state.f;
    return html`<div class="group-h" style="margin-top:18px">La pièce</div>
      <div class="group"><div class="block">
        <div class="chips" role="group" aria-label="Catégorie">${CATEGORIES.map((c) => html`<button type="button" class="chip" aria-pressed="${f.cat === c.id}" data-act="cat" data-id="${c.id}">${c.label}</button>`)}</div>
        ${f.cat ? html`<div class="chips" role="group" aria-label="Type">${CAT[f.cat].subs.map((x) => html`<button type="button" class="chip ghost" aria-pressed="${f.sub === x.id}" data-act="sub" data-id="${x.id}">${x.label}</button>`)}</div>` : html`<span class="muted" style="font-size:14px">Choisis d'abord la catégorie.</span>`}
      </div>
      <div class="block">
        <span class="lbl">Couleur${f.color ? html` <span class="muted">· ${COLOR[f.color].label}</span>` : ''}</span>
        <div class="swatches" role="group" aria-label="Couleur">${COLORS.map((c) => html`<button type="button" class="swatch" aria-pressed="${f.color === c.id}" aria-label="${c.label}" title="${c.label}" data-act="color" data-id="${c.id}" style="background:${c.hex}"></button>`)}</div>
      </div>
      <label class="block"><span class="lbl">Nom</span><input id="iname" class="field" type="text" value="${f.name}" placeholder="${autoName(f) || 'Ex. Chemise en lin'}" data-input="name" autocomplete="off"></label>
      </div>`;
  },
  when: (s) => {
    const f = s.state.f;
    return html`<div class="group-h">Quand la porter</div>
      <div class="group">
        <div class="block"><span class="lbl">Chaleur</span>
          <div class="seg" role="group" aria-label="Chaleur">${[1, 2, 3].map((w) => html`<button type="button" aria-pressed="${f.warmth === w}" data-act="warmth" data-v="${w}">${WARMTH_LABELS[w]}</button>`)}</div>
        </div>
        <div class="block"><span class="lbl">Occasions</span>
          <div class="chips" role="group" aria-label="Occasions">${S.occasions().map((o) => html`<button type="button" class="chip" aria-pressed="${f.occasions.includes(o.id)}" data-act="occ" data-id="${o.id}">${o.label}</button>`)}</div>
        </div>
        <div class="row"><span class="lbl">Supporte la pluie<small>Proposée en priorité quand il pleut</small></span><button type="button" class="switch" role="switch" aria-checked="${f.rain}" aria-label="Supporte la pluie" data-act="rain"></button></div>
      </div>`;
  }
};

const formActions = {
  cat(s, el) {
    const f = s.state.f;
    f.cat = el.dataset.id;
    if (f.sub && SUB[f.sub].cat !== f.cat) f.sub = null;
    s.refresh();
  },
  sub(s, el) { applySub(s.state.f, el.dataset.id); s.refresh(); },
  color(s, el) { s.state.f.color = el.dataset.id; s.state.f.touched.color = true; s.refresh(); },
  name(s, el) { s.state.f.name = el.value; },
  warmth(s, el) { s.state.f.warmth = +el.dataset.v; s.state.f.touched.warmth = true; s.refresh('when'); },
  occ(s, el) {
    const f = s.state.f; const id = el.dataset.id;
    f.occasions = f.occasions.includes(id) ? f.occasions.filter((x) => x !== id) : [...f.occasions, id];
    f.touched.occasions = true; s.refresh('when');
  },
  rain(s) { s.state.f.rain = !s.state.f.rain; s.state.f.touched.rain = true; s.refresh('when'); }
};

const ready = (f) => !!(f.cat && f.sub);

// ---------- Photo ----------
function photoPicker() {
  return html`<div class="picker-zone">
    <div class="big">${icon('camera', 30, 1.6)}</div>
    <div><b style="font-size:17px">Prends la pièce en photo</b><p class="muted" style="margin:6px 0 0;font-size:14px;line-height:1.4">Portée sur toi, c'est parfait. Tu recadreras ensuite autour de la pièce.</p></div>
    <label class="btn btn-primary" style="max-width:280px">${icon('camera', 20)}Prendre une photo<input type="file" accept="image/*" capture="environment" class="sr" data-input="file"></label>
    <label class="btn btn-soft" style="max-width:280px">${icon('image', 20)}Choisir dans mes photos<input type="file" accept="image/*" class="sr" data-input="file"></label>
  </div>
  <button type="button" class="btn btn-text mt8" data-act="nophoto">Continuer sans photo</button>`;
}

async function readFile(s, file) {
  if (!file) return;
  s.state.loading = true; s.refresh();
  try {
    s.state.canvas = await loadImage(file);
    s.state.origSize = file.size;
    s.state.step = 'edit';
    s.state.newPhoto = true;
    s.render();
    analyse(s, true);
  } catch {
    toast("Je n'arrive pas à lire cette image.");
    s.state.loading = false; s.refresh();
  }
}

function currentCrop(s) {
  return s.state.cropper ? cropCanvas(s.state.canvas, s.state.cropper.getCrop()) : s.state.canvas;
}

async function analyse(s, first = false) {
  const f = s.state.f;
  const c = currentCrop(s);
  if (!f.touched.color) {
    const d = dominantColor(c);
    if (d) f.color = d.id;
  }
  const key = S.getLocal().aiKey;
  if (key && first) {
    s.state.ai = { status: 'busy' }; s.refresh();
    try {
      const b64 = await canvasToBase64Jpeg(c, 800);
      const r = await recognize(key, b64, S.occasions());
      if (s.closed) return;
      if (r.sub && SUB[r.sub] && !f.sub) applySub(f, r.sub);
      if (r.color && COLOR[r.color] && !f.touched.color) f.color = r.color;
      if (r.name && !f.name) f.name = r.name;
      if ([1, 2, 3].includes(r.warmth) && !f.touched.warmth) f.warmth = r.warmth;
      if (typeof r.rain === 'boolean' && !f.touched.rain) f.rain = r.rain;
      if (Array.isArray(r.occasions) && !f.touched.occasions) {
        const ok = r.occasions.filter((o) => S.occasions().some((x) => x.id === o));
        if (ok.length) f.occasions = ok;
      }
      s.state.ai = { status: 'done', phrase: r.phrase || '' };
    } catch (e) {
      s.state.ai = { status: 'error', msg: e.message };
    }
  }
  if (!s.closed) s.refresh();
}

function noticePart(s) {
  const f = s.state.f;
  const ai = s.state.ai;
  if (ai?.status === 'busy') return html`<div class="notice">${raw('<span class="spin" style="color:var(--accent);flex-shrink:0"></span>')}<span>Je regarde ta photo…</span></div>`;
  if (ai?.status === 'done' && ai.phrase) return html`<div class="notice">${icon('sparkle', 18, 1.8)}<span>${ai.phrase} Corrige si besoin.</span></div>`;
  if (s.state.step === 'edit' && s.state.newPhoto) {
    const col = f.color ? COLOR[f.color].label.toLowerCase() : null;
    return html`<div class="notice">${icon('sparkle', 18, 1.8)}<span>${col ? html`Je vois du <b style="font-weight:600">${col}</b>. ` : ''}${f.sub ? 'Vérifie les détails, puis ajoute.' : 'Dis-moi ce que c\'est, je remplis le reste.'}${ai?.status === 'error' ? html` <span class="muted">(IA : ${ai.msg})</span>` : ''}</span></div>`;
  }
  return '';
}

function photoEditor(s) {
  return html`<div class="photo-zone" id="cropzone"></div>
    <div class="photo-tools">
      <button type="button" class="chip" data-act="rotate">${icon('rotate', 16, 2)}Pivoter</button>
      <button type="button" class="chip" data-act="fullimg">${icon('expand', 16, 2)}Toute la photo</button>
      <label class="chip" style="cursor:pointer">${icon('camera', 16, 2)}Reprendre<input type="file" accept="image/*" class="sr" data-input="file"></label>
    </div>`;
}

function existingPhoto(s) {
  const it = s.state.item;
  return html`<div class="photo-zone" style="display:flex;align-items:center;justify-content:center;background:${CAT[it.cat]?.tint}">${it.photo ? photoOrIcon(it, 'full', 80) : garmentIcon(it.cat, 80)}</div>
    <div class="photo-tools"><label class="chip" style="cursor:pointer">${icon('camera', 16, 2)}${it.photo ? 'Changer la photo' : 'Ajouter une photo'}<input type="file" accept="image/*" class="sr" data-input="file"></label></div>`;
}

async function save(s, again = false) {
  const st = s.state; const f = st.f;
  if (!ready(f) || st.saving) return;
  st.saving = true; s.renderNav();
  try {
    let photo = st.item?.photo || null;
    if (st.canvas) {
      const c = currentCrop(s);
      const q = S.settings().quality;
      const out = await compress(c, q);
      const pid = uid();
      await S.storePhoto(pid, out.full, out.thumb);
      if (photo) { S.getData().deletedPhotos[photo.id] = { ...photo, at: Date.now() }; }
      photo = { id: pid, w: out.w, h: out.h, size: out.full.size };
      if (st.origSize && st.origSize > out.full.size * 1.3) toast(`Photo optimisée : ${formatBytes(st.origSize)} → ${formatBytes(out.full.size)}`);
    }
    const saved = S.saveItem({
      id: st.item?.id, cat: f.cat, sub: f.sub, color: f.color || 'gris', name: f.name.trim() || autoName(f),
      warmth: f.warmth, rain: f.rain, occasions: f.occasions.length ? f.occasions : ['casual'], photo
    });
    if (!st.origSize || st.origSize <= (photo?.size || 0) * 1.3) toast(st.item ? 'Modifications enregistrées' : `« ${saved.name} » rangé dans ta garde-robe`);
    st.cropper?.destroy();
    if (again) {
      Object.assign(st, { step: 'pick', f: blankForm(), canvas: null, cropper: null, ai: null, saving: false, newPhoto: false, origSize: 0 });
      s.render();
    } else s.close();
  } catch (e) {
    console.error(e);
    toast("L'enregistrement a échoué. Réessaie.");
    st.saving = false; s.renderNav();
  }
}

function itemSheet({ item = null } = {}) {
  const f = blankForm();
  if (item) Object.assign(f, { cat: item.cat, sub: item.sub, color: item.color, name: item.name || '', warmth: item.warmth || 2, rain: !!item.rain, occasions: [...(item.occasions || [])], touched: { color: true, warmth: true, rain: true, occasions: true } });
  return openSheet({
    title: item ? 'Modifier' : 'Nouvelle pièce',
    tall: true,
    left: { label: 'Annuler' },
    right: (s) => (s.state.step === 'pick' ? null : { label: item ? 'OK' : 'Ajouter', act: 'save', disabled: !ready(s.state.f), busy: s.state.saving }),
    state: { step: item ? 'edit' : 'pick', f, item },
    body: (s) => {
      if (s.state.step === 'pick') return s.state.loading ? html`<div class="picker-zone"><span class="spin" style="color:var(--accent)"></span><span class="muted">Préparation de la photo…</span></div>` : photoPicker();
      return html`${s.state.canvas ? photoEditor(s) : existingPhoto(s)}
        <div class="mt12" data-part="notice">${noticePart(s)}</div>
        <div data-part="cat">${formParts.cat(s)}</div>
        <div data-part="when">${formParts.when(s)}</div>
        ${item ? '' : html`<button type="button" class="btn btn-soft mt24" data-act="saveAgain" ${ready(f) ? '' : 'disabled'} data-part="again">Ajouter et en prendre une autre</button>`}
        ${S.settings().quality ? html`<p class="group-f center" style="margin-top:12px">Photo enregistrée en qualité ${QUALITY[S.settings().quality].label.toLowerCase()}, ${QUALITY[S.settings().quality].hint}.</p>` : ''}`;
    },
    parts: { notice: noticePart, cat: formParts.cat, when: formParts.when },
    onRender(s) {
      if (s.state.step === 'edit' && s.state.canvas) {
        const zone = s.body.querySelector('#cropzone');
        if (zone && !zone.querySelector('.crop-box')) {
          s.state.cropper?.destroy();
          s.state.cropper = new Cropper(zone, s.state.canvas);
          zone.querySelector('.crop-box').addEventListener('pointerup', () => { if (!s.state.f.touched.color) analyse(s); });
        }
      }
      const again = s.body.querySelector('[data-act="saveAgain"]');
      if (again) again.disabled = !ready(s.state.f);
    },
    onClose(s) { s.state.cropper?.destroy(); },
    actions: {
      ...formActions,
      file(s, el) { const file = el.files?.[0]; el.value = ''; if (s.state.cropper) { s.state.cropper.destroy(); s.state.cropper = null; } readFile(s, file); },
      nophoto(s) { s.state.step = 'edit'; s.render(); },
      rotate(s) { s.state.canvas = rotate(s.state.canvas, 1); s.state.cropper.setCanvas(s.state.canvas); if (!s.state.f.touched.color) analyse(s); },
      fullimg(s) { s.state.cropper?.full(); if (!s.state.f.touched.color) analyse(s); },
      save(s) { save(s, false); },
      saveAgain(s) { save(s, true); }
    }
  });
}

export const openAddItem = () => itemSheet();
export const openEditItem = (id) => { const it = S.item(id); if (it) itemSheet({ item: it }); };

// ---------- Fiche ----------
export function openItemDetail(id) {
  openSheet({
    title: '',
    tall: true,
    live: true,
    left: { label: 'Fermer' },
    right: { label: 'Modifier', act: 'edit' },
    body: () => {
      const it = S.item(id);
      if (!it) return html`<div class="empty"><p>Cette pièce n'existe plus.</p></div>`;
      const w = S.wornInfo(id);
      const occs = (it.occasions || []).map((o) => S.occasion(o).label).join(', ');
      return html`<div class="hero-photo" style="background:${CAT[it.cat]?.tint}">${photoOrIcon(it, 'full', 90)}</div>
        <h2 style="margin:16px 4px 0;font-size:24px;font-weight:700;letter-spacing:-.4px">${itemName(it)}</h2>
        <div class="sub" style="margin:2px 4px 0">${SUB[it.sub]?.label || CAT[it.cat].label} · ${COLOR[it.color]?.label || ''}</div>
        <div class="stats">
          <div class="stat"><b>${w.count}</b><small>fois portée</small></div>
          <div class="stat"><b style="font-size:15px;line-height:22px">${w.last ? relDay(w.last) : 'Jamais'}</b><small>dernière fois</small></div>
          <div class="stat"><b style="font-size:15px;line-height:22px">${WARMTH_LABELS[it.warmth || 2]}</b><small>chaleur</small></div>
        </div>
        <div class="group-h">Détails</div>
        <div class="group">
          <div class="row"><span>Occasions</span><span class="val"><span>${occs || '—'}</span></span></div>
          <div class="row"><span>Supporte la pluie</span><span class="val">${it.rain ? 'Oui' : 'Non'}</span></div>
          ${it.photo?.size ? html`<div class="row"><span>Photo</span><span class="val">${formatBytes(it.photo.size)}${it.photo.fullDrive ? ' · sur Drive' : ''}</span></div>` : ''}
        </div>
        <div class="group mt20">
          <button type="button" class="row" data-act="compose"><span style="color:var(--accent)">Composer une tenue avec</span><span class="chev">${icon('chev', 14, 2.8)}</span></button>
          <button type="button" class="row" data-act="wearIt"><span style="color:var(--accent)">Je la porte aujourd'hui</span></button>
        </div>
        <div class="group mt20"><button type="button" class="row danger" data-act="del">Supprimer la pièce</button></div>`;
    },
    actions: {
      edit(s) { s.close(); setTimeout(() => openEditItem(id), 230); },
      async del(s) {
        const ok = await confirmDialog({ title: 'Supprimer cette pièce ?', text: 'Elle sera retirée de ta garde-robe et de tes tenues.', ok: 'Supprimer', danger: true });
        if (ok) { S.deleteItem(id); s.close(); toast('Pièce supprimée'); }
      },
      compose(s) { s.close(); import('./outfits.js').then((m) => setTimeout(() => m.openComposer({ lockIds: [id] }), 230)); },
      wearIt(s) {
        const today = S.wearOn();
        const ids = today ? [...new Set([...today.itemIds, id])] : [id];
        S.wearToday(ids, today?.occasion || 'casual');
        toast('Ajoutée à ta tenue du jour');
      }
    }
  });
}
