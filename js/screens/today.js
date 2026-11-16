// Écran « Aujourd'hui » : météo en une phrase, occasion, tenue proposée.
import * as S from '../store.js';
import { html, raw, longDate, toast, todayKey } from '../util.js';
import { icon, photoOrIcon, itemName, tintOf, rawIcon } from '../ui.js';
import { CAT } from '../catalog.js';
import { getWeather, lastWeather, WEATHER_ICONS } from '../weather.js';
import { generate, weatherSentence, whySentence, signature } from '../engine.js';
import { parseIntent } from '../intent.js';
import { understand } from '../ai.js';
import { openCityPicker } from './city.js';
import { openItemDetail, openAddItem } from './item.js';
import { loadDemo } from '../demo.js';
import { openSaveOutfit } from './outfits.js';
import { openFitting } from './fitting.js';

const SLOT_SHOW = ['outer', 'top', 'bottom', 'shoes', 'acc'];

const st = {
  occ: (() => { try { return localStorage.getItem('cintre-occ') || 'casual'; } catch { return 'casual'; } })(),
  evening: false,
  ask: '',
  wx: { status: 'idle' },
  res: null,
  shown: new Set(),
  key: '',      // empreinte des données qui ont servi à générer
  asking: false
};

function setOcc(id) {
  st.occ = id;
  try { localStorage.setItem('cintre-occ', id); } catch { }
}

async function loadWeather(force = false) {
  st.wx = { ...st.wx, status: st.wx.data ? 'refresh' : 'loading' };
  S.notify();
  try {
    const r = await getWeather(S.getLocal(), { force });
    st.wx = { status: 'ok', data: r.w, place: r.place, at: r.at };
  } catch (e) {
    const last = await lastWeather();
    st.wx = { status: 'error', code: e.code || 'network', data: last?.w || null, place: '', stale: !!last };
  }
  st.key = ''; // régénérer avec la nouvelle météo
  S.notify();
}

function dataKey() {
  const its = S.items();
  return [st.occ, st.evening, st.wx.data ? st.wx.data.dayFeels + ':' + st.wx.data.rainy : 'nowx', its.length, its.map((i) => i.updatedAt).reduce((a, b) => Math.max(a, b), 0), S.settings().feel].join('|');
}

function compute({ locked = {}, excludeItems = null } = {}) {
  const occ = S.occasion(st.occ);
  let pool = S.items();
  if (excludeItems) pool = pool.filter((i) => !excludeItems.has(i.id));
  const res = generate(pool, st.wx.data, occ, {
    occasions: S.occasions(), feel: S.settings().feel, avoidDays: S.settings().avoidDays,
    locked, exclude: st.shown, evening: st.evening
  });
  st.res = res;
  if (res.pieces) st.shown.add(res.sig);
  st.key = dataKey();
}

function ensureResult() {
  if (st.wx.status === 'loading') return;
  const valid = st.res?.pieces && Object.values(st.res.pieces).every((p) => S.item(p.id));
  if (!valid || st.key !== dataKey()) {
    // garder les pièces encore valides si seule une pièce a disparu
    compute();
  }
}

function weatherBlock() {
  const w = st.wx.data;
  if (st.wx.status === 'loading' && !w) return html`<p class="lead"><span class="skeleton" style="display:inline-block;width:80%;height:18px"></span></p>`;
  if (w) {
    const sentence = weatherSentence(w, st.wx.place);
    const t = `${w.temp}°`;
    const parts = sentence.split(t);
    return html`<p class="lead">${parts[0]}<b>${t}</b>${parts.slice(1).join(t)}${st.wx.stale ? html` <span class="muted">(dernière météo connue)</span>` : ''}</p>`;
  }
  if (st.wx.code === 'position' || st.wx.code === 'no-place') {
    return html`<div class="notice mt12">${icon('location', 18)}<span>Je n'ai pas accès à ta position. <button type="button" class="btn-text" style="height:auto;padding:0;width:auto;display:inline" data-act="city">Choisir une ville</button> ou autorise la localisation pour avoir la météo.</span></div>`;
  }
  return html`<p class="lead">Météo indisponible pour le moment, je compose sans.</p>`;
}

function tile(slot, it, interactive = true) {
  const hasPhoto = !!it.photo;
  return html`<button type="button" class="tile" ${interactive ? html`data-act="swap" data-slot="${slot}"` : html`data-act="detail" data-id="${it.id}"`} style="background:${tintOf(it)}" aria-label="${CAT[slot].label} : ${itemName(it)}${interactive ? ', toucher pour échanger' : ''}">
    <div class="ph">${photoOrIcon(it, 'thumb', 40)}</div>
    ${interactive ? html`<span class="swap">${icon('swap', 14, 2)}</span>` : ''}
    <span class="cap ${hasPhoto ? '' : 'light'}"><small>${CAT[slot].label}</small><b>${itemName(it)}</b></span>
  </button>`;
}

function wornCard(w) {
  const its = w.itemIds.map((id) => S.item(id)).filter(Boolean).sort((a, b) => SLOT_SHOW.indexOf(a.cat) - SLOT_SHOW.indexOf(b.cat));
  return html`<section class="card mt20">
    <div class="card-h"><h2>Tu portes aujourd'hui</h2><span class="worn-badge">${icon('check', 14, 2.6)}Noté</span></div>
    <div class="outfit-grid">${its.map((it) => tile(it.cat, it, false))}</div>
    <p class="why">Bonne journée. Je ne te proposerai pas ces pièces trop vite.</p>
    <button type="button" class="btn btn-text mt8" data-act="unwear">Changer de tenue</button>
  </section>`;
}

function outfitCard() {
  const items = S.items();
  if (!items.length) {
    return html`<section class="card mt20"><div class="empty">
      <div class="big">${icon('hanger', 30, 1.6)}</div>
      <h3>Ta garde-robe est vide</h3>
      <p>Prends en photo tes vêtements portés, je m'occupe du reste. Ou essaie d'abord avec une garde-robe d'exemple.</p>
      <button type="button" class="btn btn-primary" data-act="add-item">${icon('camera', 20)}Ajouter ma première pièce</button>
      <button type="button" class="btn btn-text mt8" data-act="demo">Essayer avec des exemples</button>
    </div></section>`;
  }
  const r = st.res;
  if (!r) return html`<section class="card mt20"><div class="skeleton" style="height:260px"></div></section>`;
  if (!r.pieces) {
    const names = { top: 'un haut', bottom: 'un bas', shoes: 'des chaussures' };
    return html`<section class="card mt20"><div class="empty">
      <div class="big">${icon('sparkle', 28, 1.6)}</div>
      <h3>Encore un peu de matière</h3>
      <p>Pour composer une tenue, il me manque ${r.missing.map((m) => names[m]).join(', ').replace(/, ([^,]*)$/, ' et $1')}.</p>
      <button type="button" class="btn btn-primary" data-act="add-item">${icon('camera', 20)}Ajouter une pièce</button>
    </div></section>`;
  }
  const occ = S.occasion(st.occ);
  return html`<section class="card mt20" aria-live="polite">
    <div class="card-h"><h2>Pour aujourd'hui</h2><span>Touche pour échanger</span></div>
    <div class="outfit-grid">${SLOT_SHOW.filter((s) => r.pieces[s]).map((s) => tile(s, r.pieces[s]))}</div>
    <p class="why">${whySentence(r, st.wx.data, occ)}</p>
    <button type="button" class="btn btn-soft mt12" data-act="fit">${icon('sparkle', 18, 2)}Essayer sur moi</button>
    <button type="button" class="btn btn-primary mt8" data-act="wear">Porter cette tenue</button>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button type="button" class="btn btn-text" data-act="another">${icon('refresh', 18, 2)}Autre proposition</button>
      <button type="button" class="btn btn-text" data-act="save">${icon('heart', 18, 2)}Enregistrer</button>
    </div>
  </section>`;
}

export default {
  enter() {
    if (st.wx.status === 'idle' || (st.wx.at && Date.now() - st.wx.at > 20 * 60 * 1000)) loadWeather();
  },
  render() {
    const local = S.getLocal();
    const name = S.settings().name;
    const worn = S.wearOn(todayKey());
    if (!worn) ensureResult();
    const occs = S.occasions();
    if (!occs.some((o) => o.id === st.occ)) setOcc(occs[0]?.id || 'casual');
    const initial = (name || 'M').trim().charAt(0).toUpperCase();
    return html`<main class="screen">
      <div class="top">
        <h1 class="large-title">${name ? `Bonjour ${name}` : 'Bonjour'}</h1>
        <a class="avatar" href="#reglages" aria-label="Réglages">${initial}</a>
      </div>
      <div class="sub">${longDate().replace(/^./, (c) => c.toUpperCase())}</div>
      ${weatherBlock()}
      ${worn ? wornCard(worn) : html`
        <label class="ask">
          <span class="sr">Où vas-tu aujourd'hui ?</span>
          <input id="ask" type="text" placeholder="Où vas-tu aujourd'hui ?" value="${st.ask}" data-input="ask" data-enter="askGo" enterkeyhint="go" autocomplete="off">
          <button type="button" data-act="${st.ask ? 'askGo' : 'mic'}" aria-label="${st.ask ? 'Valider' : 'Dicter'}">${st.asking ? raw('<span class="spin"></span>') : icon(st.ask ? 'arrow' : 'mic', 18, 1.9)}</button>
        </label>
        <div class="seg-scroll mt12" data-keep="occ" role="group" aria-label="Occasion">
          <div class="seg" style="min-width:100%;flex-shrink:0;grid-auto-columns:minmax(64px,1fr)">
            ${occs.map((o) => html`<button type="button" aria-pressed="${o.id === st.occ}" data-act="occ" data-id="${o.id}">${o.label}</button>`)}
          </div>
        </div>
        ${outfitCard()}
      `}
    </main>`;
  },
  actions: {
    occ(el) { setOcc(el.dataset.id); st.evening = false; st.shown = new Set(); compute(); S.notify(); },
    ask(el) {
      const had = !!st.ask; st.ask = el.value;
      if (had !== !!st.ask) S.notify();
    },
    async askGo() {
      const text = st.ask.trim();
      if (!text) return;
      const occs = S.occasions();
      let r = parseIntent(text, occs);
      const key = S.getLocal().aiKey;
      if (key && !r.matched) {
        st.asking = true; S.notify();
        try { const a = await understand(key, text, occs); if (occs.some((o) => o.id === a.occasionId)) r = { occasionId: a.occasionId, evening: !!a.evening }; } catch { }
        st.asking = false;
      }
      setOcc(r.occasionId); st.evening = r.evening; st.shown = new Set();
      compute();
      document.getElementById('ask')?.blur();
      toast(`${S.occasion(r.occasionId).label}${r.evening ? ', plutôt pour le soir' : ''} : c'est noté.`);
      S.notify();
    },
    mic() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const input = document.getElementById('ask');
      if (!SR) { input?.focus(); toast('Utilise la dictée de ton clavier.'); return; }
      const rec = new SR();
      rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1;
      st.asking = true; S.notify();
      rec.onresult = (e) => { st.ask = e.results[0][0].transcript; st.asking = false; S.notify(); this.askGo(); };
      rec.onerror = () => { st.asking = false; S.notify(); toast('Je n\'ai pas bien entendu.'); };
      rec.onend = () => { if (st.asking) { st.asking = false; S.notify(); } };
      try { rec.start(); } catch { st.asking = false; S.notify(); }
    },
    swap(el) {
      const slot = el.dataset.slot;
      const cur = st.res?.pieces;
      if (!cur) return;
      const locked = {};
      Object.entries(cur).forEach(([k, v]) => { if (k !== slot) locked[k] = v; });
      const prev = st.res;
      compute({ locked, excludeItems: new Set([cur[slot].id]) });
      if (!st.res.pieces || !st.res.pieces[slot] || st.res.pieces[slot].id === cur[slot].id) {
        st.res = prev; toast(`Pas d'autre ${CAT[slot].label.toLowerCase()} adapté pour l'instant.`);
      }
      // garder l'ordre : si la veste n'est plus nécessaire, la remettre
      if (st.res.pieces && !st.res.pieces.outer && cur.outer && slot !== 'outer') st.res.pieces.outer = cur.outer;
      st.res.sig = signature(st.res.pieces);
      S.notify();
    },
    another() { compute(); S.notify(); },
    fit() {
      const p = st.res?.pieces; if (!p) return;
      openFitting({
        pieces: p, occasionId: st.occ,
        // ce qui a été choisi dans la cabine devient la proposition du jour
        onClose(next) {
          if (!st.res?.pieces || !Object.keys(next).length) return;
          if (signature(next) === signature(st.res.pieces)) return;
          st.res = { ...st.res, pieces: next, sig: signature(next) };
          st.shown.add(st.res.sig);
          S.notify();
        }
      });
    },
    wear() {
      const p = st.res?.pieces; if (!p) return;
      S.wearToday(Object.values(p).map((x) => x.id), st.occ);
      toast("C'est noté. Bonne journée !");
    },
    unwear() { S.unwear(todayKey()); st.key = ''; },
    save() {
      const p = st.res?.pieces; if (!p) return;
      openSaveOutfit(Object.values(p).map((x) => x.id), st.occ);
    },
    detail(el) { openItemDetail(el.dataset.id); },
    city() { openCityPicker(() => loadWeather(true)); },
    demo() { loadDemo().then(() => { st.key = ''; toast('Garde-robe d\'exemple ajoutée.'); }); },
    'add-item'() { openAddItem(); }
  },
  mounted(root) {
    const b = root.querySelector('[data-keep="occ"] [aria-pressed="true"]');
    const box = root.querySelector('[data-keep="occ"]');
    if (b && box) {
      const l = b.offsetLeft, r = l + b.offsetWidth;
      if (l < box.scrollLeft || r > box.scrollLeft + box.clientWidth) box.scrollLeft = Math.max(0, r - box.clientWidth + 24);
    }
  },
  refreshWeather: () => loadWeather(true)
};
