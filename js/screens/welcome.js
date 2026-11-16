// Premier lancement : prénom, sauvegarde Drive, météo.
import * as S from '../store.js';
import * as Drive from '../drive.js';
import { html } from '../util.js';
import { icon } from '../ui.js';
import { getPosition } from '../weather.js';
import { openCityPicker } from './city.js';

const st = { name: '', geo: 'idle', drive: 'idle', err: '' };

function stepIcon(state, n) {
  if (state === 'done') return html`<span class="step-n done">${icon('check', 14, 3)}</span>`;
  return html`<span class="step-n ${state === 'on' ? 'on' : ''}">${n}</span>`;
}

export default {
  render() {
    const local = S.getLocal();
    const d = local.drive;
    const geoDone = st.geo === 'ok' || !!local.city;
    const driveDone = d.connected;
    return html`<main class="welcome">
      <div class="logo">${icon('hanger', 36, 1.6)}</div>
      <h1 class="large-title" style="margin-top:24px;font-size:40px">Cintre</h1>
      <p class="lead" style="font-size:19px;font-weight:300">Ta garde-robe, pensée pour <b style="font-weight:500">aujourd'hui.</b></p>

      <div class="group steps" style="margin-top:32px;border-radius:20px;box-shadow:var(--shadow)">
        <div class="row">
          ${stepIcon(st.name ? 'done' : 'on', 1)}
          <label style="display:flex;flex-direction:column;gap:8px;flex:1"><span style="font-weight:600">Comment tu t'appelles ?</span>
            <input id="wname" class="field" type="text" value="${st.name}" placeholder="Ton prénom" data-input="name" autocomplete="given-name"></label>
        </div>
        ${Drive.configured() ? html`<div class="row">
          ${stepIcon(driveDone ? 'done' : 'on', 2)}
          <div style="display:flex;flex-direction:column;gap:10px;flex:1">
            <span class="lbl"><span style="font-weight:600">${driveDone ? 'Google Drive connecté' : 'Sauvegarde sur Google Drive'}</span><small>${driveDone ? d.email : 'Cintre crée son dossier dans ton Drive et n\'a accès qu\'à lui.'}</small></span>
            ${driveDone ? html`<button type="button" class="btn btn-soft" style="height:46px;justify-content:space-between;font-weight:400;font-size:15px" data-act="location"><span style="display:flex;align-items:center;gap:8px">${icon('folder', 18)}${d.folderPath || 'Mon Drive › Cintre'}</span><span style="color:var(--accent);font-weight:500">Modifier</span></button>`
          : html`<button type="button" class="btn btn-soft" style="height:46px" data-act="drive">${st.drive === 'busy' ? html`<span class="spin"></span>` : 'Se connecter avec Google'}</button>`}
          </div></div>` : ''}
        <div class="row">
          ${stepIcon(geoDone ? 'done' : 'on', Drive.configured() ? 3 : 2)}
          <div style="display:flex;flex-direction:column;gap:10px;flex:1">
            <span class="lbl"><span style="font-weight:600">Météo de là où tu es</span><small>${geoDone ? (local.city && st.geo !== 'ok' ? `Ville : ${local.city.name}` : 'Position autorisée') : 'Pour choisir une tenue adaptée au temps.'}</small></span>
            ${geoDone ? '' : html`<button type="button" class="btn btn-soft" style="height:46px" data-act="geo">${st.geo === 'busy' ? html`<span class="spin"></span>` : 'Autoriser ma position'}</button>
              ${st.geo === 'denied' ? html`<button type="button" class="btn btn-text" style="height:36px" data-act="city">Choisir une ville à la place</button>` : ''}`}
          </div>
        </div>
      </div>
      ${st.err ? html`<p class="group-f">${st.err}</p>` : ''}
      <div style="flex:1;min-height:28px"></div>
      <button type="button" class="btn btn-primary" data-act="go">Continuer</button>
      <p class="group-f center" style="margin-top:14px">${Drive.configured() ? "Tes photos restent dans ton Drive et sur ton téléphone. Rien n'est stocké ailleurs." : 'Tes photos restent sur ton téléphone. Rien n\'est envoyé ailleurs.'}</p>
    </main>`;
  },
  actions: {
    name(el) { const had = !!st.name; st.name = el.value; if (had !== !!st.name) S.notify(); },
    async geo() {
      st.geo = 'busy'; S.notify();
      try { await getPosition(); st.geo = 'ok'; S.setLocal({ useLocation: true }); }
      catch { st.geo = 'denied'; }
      S.notify();
    },
    city() { openCityPicker(() => S.notify()); },
    async drive() {
      st.drive = 'busy'; st.err = ''; S.notify();
      try { await Drive.connect(); st.drive = 'done'; }
      catch (e) { st.drive = 'idle'; st.err = e.message; }
      S.notify();
    },
    async location() { try { await Drive.pickLocation(); } catch (e) { st.err = 'Tu pourras déplacer le dossier « Cintre » directement dans Drive, l\'app le suivra.'; S.notify(); } },
    go() {
      if (st.name.trim()) S.setSettings({ name: st.name.trim() });
      S.setLocal({ onboarded: true });
      location.hash = '#aujourdhui';
    }
  }
};
