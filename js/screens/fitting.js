// Cabine d'essayage : ta photo en pied, les pièces posées dessus, un swipe pour changer.
// Aperçu instantané (collage), puis rendu réaliste gratuit qui vient le remplacer en fondu.
import * as S from '../store.js';
import { html, raw, toast, uid } from '../util.js';
import { icon, openSheet, itemName, garmentIcon } from '../ui.js';
import { CAT } from '../catalog.js';
import { loadImage, compress, canvasToBase64Jpeg } from '../photo.js';
import { detectZones, DEFAULT_ZONES } from '../pose.js';
import * as T from '../tryon.js';
import { photoPut, photoDelete } from '../db.js';
import { openSaveOutfit } from './outfits.js';

const SLOTS = ['shoes', 'bottom', 'top', 'outer'];         // ordre d'empilement (dessous → dessus)
const PICK_ORDER = ['outer', 'top', 'bottom', 'shoes'];    // priorité quand une zone en recouvre une autre
const IDLE_MS = 1300;

const meInfo = () => S.getLocal().me;
const tryonPrefs = () => ({ realistic: true, hfToken: '', ...(S.getLocal().tryon || {}) });

// ---------- Photo de l'utilisateur ----------
export function openMePhoto(done) {
  openSheet({
    title: 'Ma photo',
    tall: true,
    state: { step: 'intro', canvas: null, zones: null, auto: false, preview: '' },
    left: { label: 'Annuler' },
    right: (s) => s.state.step === 'check' ? { act: 'ok', label: 'Valider', busy: s.state.saving } : null,
    body(s) {
      const st = s.state;
      if (st.step === 'busy') return html`<div class="empty" style="padding-top:60px"><span class="spin" style="color:var(--accent);width:28px;height:28px"></span><p class="mt12">Je repère ta silhouette…</p></div>`;
      if (st.step === 'check') {
        return html`<p class="muted" style="margin:4px 4px 12px">${st.auto ? 'Voilà où je poserai tes pièces.' : 'Je n\'ai pas trouvé ta silhouette, je placerai les pièces approximativement. Une photo de face, en pied, bien éclairée marche mieux.'}</p>
          <div class="fit-check"><img src="${st.preview}" alt="Ta photo">
            ${Object.entries(st.zones).filter(([k]) => k !== 'outer').map(([k, z]) => html`<span class="fit-zone" style="left:${z.x * 100}%;top:${z.y * 100}%;width:${z.w * 100}%;height:${z.h * 100}%"><em>${CAT[k].label}</em></span>`)}
          </div>
          <label class="btn btn-text mt8" style="cursor:pointer">Prendre une autre photo<input type="file" accept="image/*" class="sr" data-input="file"></label>`;
      }
      return html`<div class="fit-guide">${raw(SILHOUETTE)}</div>
        <h3 style="margin:16px 4px 6px;font-size:18px">Une photo de toi, de la tête aux pieds</h3>
        <ul class="fit-tips">
          <li>De face, debout, bras légèrement écartés du corps</li>
          <li>Tenue simple et près du corps (t-shirt uni, pantalon fin)</li>
          <li>Fond clair et bonne lumière, téléphone à hauteur de taille</li>
        </ul>
        <p class="group-f" style="margin:10px 4px 0">La photo reste sur ce téléphone. Elle n'est envoyée que pour le rendu réaliste, si tu l'actives.</p>
        <label class="btn btn-primary mt16" style="cursor:pointer">${icon('camera', 20)}Choisir ou prendre une photo<input type="file" accept="image/*" class="sr" data-input="file"></label>`;
    },
    actions: {
      async file(s, el) {
        const f = el.files?.[0];
        if (!f) return;
        s.state.step = 'busy'; s.render();
        try {
          const canvas = await loadImage(f);
          const { zones, auto } = await detectZones(canvas);
          if (s.state.preview) URL.revokeObjectURL(s.state.preview);
          const b = await compress(canvas, 'light');
          Object.assign(s.state, { step: 'check', canvas, zones, auto, preview: URL.createObjectURL(b.thumb) });
        } catch (e) {
          toast(e.message || 'Photo illisible');
          s.state.step = 'intro';
        }
        s.render();
      },
      async ok(s) {
        const st = s.state;
        st.saving = true; s.renderNav();
        try {
          const id = 'me-' + uid();
          const c = await compress(st.canvas, 'balanced');
          // copie dédiée au rendu réaliste : JPEG 1024 px, envoi plus rapide
          const b64 = await canvasToBase64Jpeg(st.canvas, 1024);
          const vto = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
          await photoPut({ id, full: c.full, thumb: c.thumb, vto, at: Date.now() });
          const old = meInfo();
          if (old?.photoId) { photoDelete(old.photoId).catch(() => { }); T.clearFor(old.photoId); }
          S.setLocal({ me: { photoId: id, w: c.w, h: c.h, zones: st.zones, auto: st.auto, at: Date.now() } });
          if (st.preview) URL.revokeObjectURL(st.preview);
          s.close();
          toast('Photo enregistrée');
          done?.();
        } catch (e) {
          toast('Impossible d\'enregistrer la photo');
          st.saving = false; s.renderNav();
        }
      }
    }
  });
}

const SILHOUETTE = `<svg viewBox="0 0 120 220" width="120" height="220" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 5" stroke-linecap="round" aria-hidden="true">
  <circle cx="60" cy="26" r="15"/><path d="M38 52c6-6 14-8 22-8s16 2 22 8l8 46M38 52l-8 46M44 56v60h32V56M44 116l-4 90M76 116l4 90M60 130v76M34 210h14M72 210h14"/></svg>`;

// ---------- Cabine ----------
export function openFitting({ pieces = {}, occasionId = null, onClose = null } = {}) {
  if (!meInfo()?.photoId) {
    openMePhoto(() => openFitting({ pieces, occasionId, onClose }));
    return;
  }

  const lists = {};
  const cur = {};
  SLOTS.forEach((slot) => {
    const its = S.items().filter((i) => i.cat === slot).sort((a, b) => a.createdAt - b.createdAt);
    lists[slot] = slot === 'outer' ? [null, ...its] : (its.length ? its : [null]);
    const want = pieces[slot]?.id;
    const idx = want ? lists[slot].findIndex((i) => i && i.id === want) : -1;
    cur[slot] = idx >= 0 ? idx : (slot === 'outer' ? 0 : 0);
  });
  const piece = (slot) => lists[slot][cur[slot]] || null;
  // l'accessoire n'est pas affiché dans la cabine mais reste dans la tenue
  const acc = pieces.acc && S.item(pieces.acc.id) ? pieces.acc : null;
  const currentPieces = () => {
    const out = Object.fromEntries(SLOTS.map((s) => [s, piece(s)]).filter(([, v]) => v));
    if (acc) out.acc = acc;
    return out;
  };

  const st = { real: null, realKey: null, status: 'idle', msg: '', rendering: false, timer: 0, closed: false, meUrl: null, label: '' };
  const me = meInfo();
  const zones = { ...DEFAULT_ZONES, ...(me.zones || {}) };

  const wrap = document.createElement('div');
  wrap.className = 'fit-wrap';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', 'Cabine d\'essayage');
  wrap.innerHTML = String(html`
    <header class="fit-head">
      <button type="button" class="fit-x" data-act="close" aria-label="Fermer">${icon('close', 22, 2.2)}</button>
      <h1>Cabine</h1>
      <span class="fit-status" data-status></span>
    </header>
    <div class="fit-stage" data-stage>
      <div class="fit-box" data-box>
        <img class="fit-me" data-me alt="Toi">
        ${SLOTS.map((s) => html`<div class="fit-layer fit-${s}" data-layer="${s}" style="left:${zones[s].x * 100}%;top:${zones[s].y * 100}%;width:${zones[s].w * 100}%;height:${zones[s].h * 100}%"></div>`)}
        <img class="fit-real" data-real alt="Rendu réaliste de la tenue">
        <div class="fit-label" data-label></div>
      </div>
    </div>
    <div class="fit-bar" data-bar></div>
    <div class="fit-acts">
      <button type="button" class="btn btn-soft" data-act="save">${icon('heart', 18, 2)}Enregistrer</button>
      <button type="button" class="btn btn-primary" data-act="wear">Porter cette tenue</button>
    </div>`);
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';

  const $ = (sel) => wrap.querySelector(sel);
  const stage = $('[data-stage]'), box = $('[data-box]'), realImg = $('[data-real]'), meImg = $('[data-me]');

  // Taille du cadre : la photo entière, la plus grande possible.
  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const ar = me.w / me.h;
    let w = W, h = W / ar;
    if (h > H) { h = H; w = H * ar; }
    box.style.width = w + 'px'; box.style.height = h + 'px';
  }
  const ro = new ResizeObserver(layout);
  ro.observe(stage);

  S.photoBlob(me.photoId, 'full').then((b) => { if (b) { st.meUrl = URL.createObjectURL(b); meImg.src = st.meUrl; } });

  function layerHtml(slot) {
    const it = piece(slot);
    if (!it) return '';
    const url = it.photo ? S.photoUrl(it.photo, 'full') || S.photoUrl(it.photo, 'thumb') : null;
    return String(url ? html`<img src="${url}" alt="">` : html`<span class="fit-ico">${garmentIcon(slot, 48, 1.1)}</span>`);
  }
  function paintLayers() { SLOTS.forEach((s) => { const el = $(`[data-layer="${s}"]`); const h = layerHtml(s); if (el.innerHTML !== h) el.innerHTML = h; }); }

  function paintBar() {
    $('[data-bar]').innerHTML = String(html`${PICK_ORDER.filter((s) => lists[s].length > 1 || lists[s][0]).map((s) => {
      const it = piece(s);
      return html`<div class="fit-row">
        <button type="button" data-act="prev" data-slot="${s}" aria-label="${CAT[s].label} précédent">${icon('back', 18, 2.4)}</button>
        <span><small>${CAT[s].label}</small><b>${it ? itemName(it) : (s === 'outer' ? 'Sans veste' : 'Aucune')}</b></span>
        <button type="button" data-act="next" data-slot="${s}" aria-label="${CAT[s].label} suivant">${icon('chev', 18, 2.4)}</button>
      </div>`;
    })}`);
  }

  function paintStatus() {
    const el = $('[data-status]');
    const p = tryonPrefs();
    let txt = 'Aperçu', cls = '';
    if (!p.realistic) txt = 'Aperçu';
    else if (st.status === 'loading') { txt = 'Rendu réaliste…'; cls = 'busy'; }
    else if (st.status === 'done') { txt = 'Réaliste'; cls = 'ok'; }
    else if (st.status === 'error') { txt = 'Aperçu'; cls = 'warn'; }
    el.className = `fit-status ${cls}`;
    el.innerHTML = String(html`${cls === 'busy' ? raw('<span class="spin"></span>') : ''}${txt}`);
    el.title = st.msg || '';
  }

  function showReal(blob, key) {
    if (st.real) URL.revokeObjectURL(st.real);
    st.real = URL.createObjectURL(blob); st.realKey = key;
    realImg.src = st.real;
    realImg.onload = () => { if (st.realKey === key) wrap.classList.add('is-real'); };
    st.status = 'done'; st.msg = ''; paintStatus();
  }
  function hideReal() { wrap.classList.remove('is-real'); }

  function flash(text) {
    const el = $('[data-label]');
    el.textContent = text; el.classList.add('show');
    clearTimeout(st.labelT); st.labelT = setTimeout(() => el.classList.remove('show'), 1400);
  }

  // Rendu réaliste après une courte pause sans changement.
  function schedule() {
    clearTimeout(st.timer);
    hideReal();
    const p = tryonPrefs();
    const key = T.renderKey(me.photoId, currentPieces());
    if (!key) { st.status = 'idle'; paintStatus(); return; }
    T.cached(key).then((b) => {
      if (st.closed || T.renderKey(me.photoId, currentPieces()) !== key) return;
      if (b) { showReal(b, key); return; }
      if (!p.realistic) { st.status = 'idle'; paintStatus(); return; }
      if (!st.rendering) { st.status = 'idle'; paintStatus(); }
      st.timer = setTimeout(runRender, IDLE_MS);
    });
  }

  async function runRender() {
    if (st.closed || st.rendering) return;
    const pcs = currentPieces();
    const key = T.renderKey(me.photoId, pcs);
    if (!key) return;
    const u = pcs.outer || pcs.top;
    const b = pcs.bottom;
    const garments = {};
    if (u?.photo) { const blob = await S.photoBlob(u.photo.id, 'full'); if (blob) garments.upper = { blob, desc: itemName(u) }; }
    if (b?.photo) { const blob = await S.photoBlob(b.photo.id, 'full'); if (blob) garments.bottom = { blob }; }
    if (!garments.upper && !garments.bottom) return;
    const person = (await S.photoBlob(me.photoId, 'vto')) || (await S.photoBlob(me.photoId, 'full'));
    st.rendering = true; st.status = 'loading'; paintStatus();
    try {
      const out = await T.render(key, person, garments, tryonPrefs().hfToken || undefined);
      if (st.closed) return;
      if (T.renderKey(me.photoId, currentPieces()) === key) showReal(out, key);
    } catch (e) {
      if (st.closed) return;
      st.status = 'error'; st.msg = e.message; paintStatus();
      toast(e.message);
    } finally {
      st.rendering = false;
    }
    // la tenue a changé pendant le rendu : on enchaîne sur la nouvelle
    if (!st.closed && st.status !== 'error' && T.renderKey(me.photoId, currentPieces()) !== key) schedule();
  }

  function step(slot, dir, animate = true) {
    const n = lists[slot].length;
    if (n < 2) { flash(`Pas d'autre ${CAT[slot].label.toLowerCase()}`); return; }
    cur[slot] = (cur[slot] + dir + n) % n;
    const el = $(`[data-layer="${slot}"]`);
    if (animate) {
      el.style.transition = 'none';
      el.style.transform = `translateX(${dir > 0 ? 40 : -40}%)`;
      el.style.opacity = '0';
      paintLayers();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = ''; el.style.transform = ''; el.style.opacity = '';
      }));
    } else paintLayers();
    const it = piece(slot);
    flash(it ? itemName(it) : 'Sans veste');
    paintBar();
    schedule();
  }

  // ---------- Swipe ----------
  function slotAt(clientX, clientY) {
    const r = box.getBoundingClientRect();
    const x = (clientX - r.left) / r.width, y = (clientY - r.top) / r.height;
    const inside = PICK_ORDER.filter((s) => {
      if (s === 'outer' && !piece('outer')) return false;
      const z = zones[s];
      return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
    });
    // veste et haut se recouvrent : la veste si elle est portée, sinon le haut
    if (inside.length) return inside[0];
    const centers = ['top', 'bottom', 'shoes'].map((s) => [s, Math.abs(y - (zones[s].y + zones[s].h / 2))]);
    return centers.sort((a, b) => a[1] - b[1])[0][0];
  }

  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, slot: slotAt(e.clientX, e.clientY), moving: false };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { drag.moving = true; hideReal(); }
    if (drag.moving) {
      const el = $(`[data-layer="${drag.slot}"]`);
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 260));
    }
  });
  const end = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    const dx = e.clientX - d.x;
    const el = $(`[data-layer="${d.slot}"]`);
    el.style.transition = ''; el.style.transform = ''; el.style.opacity = '';
    if (d.moving && Math.abs(dx) > 45) step(d.slot, dx < 0 ? 1 : -1);
    else if (d.moving && st.realKey === T.renderKey(me.photoId, currentPieces())) wrap.classList.add('is-real');
    else if (!d.moving) {
      // toucher la photo : basculer entre aperçu et rendu réaliste
      if (st.realKey && st.realKey === T.renderKey(me.photoId, currentPieces())) wrap.classList.toggle('is-real');
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  // ---------- Actions ----------
  function close() {
    if (st.closed) return;
    st.closed = true;
    clearTimeout(st.timer);
    unsub(); ro.disconnect();
    document.removeEventListener('keydown', onKey);
    wrap.classList.add('closing');
    setTimeout(() => {
      wrap.remove();
      if (!document.querySelector('.sheet-wrap')) document.body.style.overflow = '';
      if (st.real) URL.revokeObjectURL(st.real);
      if (st.meUrl) URL.revokeObjectURL(st.meUrl);
    }, 220);
    onClose?.(currentPieces());
  }
  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('.sheet-wrap')) close();
    if (e.key === 'ArrowRight') step('top', 1);
    if (e.key === 'ArrowLeft') step('top', -1);
  };
  document.addEventListener('keydown', onKey);

  wrap.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'close') close();
    else if (act === 'next') step(a.dataset.slot, 1);
    else if (act === 'prev') step(a.dataset.slot, -1);
    else if (act === 'wear') {
      const ids = Object.values(currentPieces()).map((p) => p.id);
      if (!ids.length) return;
      S.wearToday(ids, occasionId || 'casual');
      toast('C\'est noté. Bonne journée !');
      close();
    } else if (act === 'save') {
      const ids = Object.values(currentPieces()).map((p) => p.id);
      if (ids.length) openSaveOutfit(ids, occasionId || 'casual');
    }
  });

  // les photos des pièces arrivent de façon asynchrone
  const unsub = S.subscribe(() => { if (!st.closed) paintLayers(); });

  layout();
  paintLayers();
  paintBar();
  paintStatus();
  schedule();
  if (!me.auto) setTimeout(() => flash('Pièces placées approximativement'), 400);
  else setTimeout(() => flash('Swipe sur une pièce pour la changer'), 400);
}
