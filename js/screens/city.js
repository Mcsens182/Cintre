// Choix d'une ville pour la météo (quand la position n'est pas disponible ou désactivée).
import * as S from '../store.js';
import { html, debounce } from '../util.js';
import { icon, openSheet } from '../ui.js';
import { searchCity } from '../weather.js';

export function openCityPicker(onDone) {
  const run = debounce(async (s, q) => {
    if (q.trim().length < 2) { s.state.res = []; s.refresh('res'); return; }
    s.state.busy = true; s.refresh('res');
    try { s.state.res = await searchCity(q); } catch { s.state.res = []; s.state.err = true; }
    s.state.busy = false; s.refresh('res');
  }, 300);
  openSheet({
    title: 'Ville pour la météo',
    tall: true,
    left: { label: 'Annuler' },
    state: { q: '', res: [], busy: false },
    body: () => html`<label class="search mt8">${icon('search', 16, 2.2)}<span class="sr">Ville</span><input id="cityq" type="search" placeholder="Nice, Saint-Raphaël…" data-input="q" autocomplete="off"></label>
      <div data-part="res"></div>`,
    parts: { res: (s) => parts.res(s) },
    onMount(s) { setTimeout(() => s.body.querySelector('#cityq')?.focus(), 300); s.refresh('res'); },
    actions: {
      q(s, el) { s.state.q = el.value; run(s, el.value); },
      pick(s, el) {
        const r = s.state.res[+el.dataset.i];
        S.setLocal({ city: { name: r.name, lat: r.lat, lon: r.lon } });
        s.close(); onDone?.();
      }
    }
  });
}

const parts = {
  res: (s) => {
    if (!s) return '';
    const cur = S.getLocal().city;
    if (s.state.busy) return html`<div class="center mt20"><span class="spin" style="color:var(--accent)"></span></div>`;
    if (!s.state.res.length) return html`${cur ? html`<div class="group-h">Ville actuelle</div><div class="group"><div class="row"><span>${cur.name}</span><span style="color:var(--accent)">${icon('check', 20, 2.4)}</span></div></div>` : ''}
      <p class="group-f">${s.state.q.length >= 2 ? 'Aucune ville trouvée.' : 'Tape le nom de ta ville.'}</p>`;
    return html`<div class="group mt16">${s.state.res.map((r, i) => html`<button type="button" class="row" data-act="pick" data-i="${i}"><span class="lbl">${r.name}<small>${r.detail}</small></span></button>`)}</div>`;
  }
};
