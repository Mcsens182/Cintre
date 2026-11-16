// Écran « Réglages ».
import * as S from '../store.js';
import * as Drive from '../drive.js';
import { html, toast, uid, formatBytes, relDay, todayKey } from '../util.js';
import { icon, openSheet, confirmDialog } from '../ui.js';
import { FORMALITY_LABELS, DEFAULT_OCCASIONS } from '../catalog.js';
import { QUALITY } from '../photo.js';
import { openCityPicker } from './city.js';
import { loadDemo } from '../demo.js';
import { testKey, providerOf, PROVIDERS } from '../ai.js';
import { estimate } from '../db.js';
import { kvSet } from '../db.js';
import { openMePhoto } from './fitting.js';

let storage = null;
const chev = () => html`<span class="chev">${icon('chev', 12, 3)}</span>`;

function syncLabel(d) {
  if (Drive.status.state === 'syncing') return 'Synchronisation…';
  if (Drive.status.state === 'auth') return 'Touchez « Synchroniser » pour reprendre';
  if (Drive.status.state === 'error') return `Erreur : ${Drive.status.error}`;
  if (d.lastSync) {
    const t = new Date(d.lastSync);
    const same = todayKey(t) === todayKey();
    return `Dernière synchronisation ${same ? 'à ' + t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : relDay(todayKey(t))}.`;
  }
  return '';
}

function driveGroup() {
  const d = S.getLocal().drive;
  if (!Drive.configured()) {
    return html`<div class="group">
      <div class="row"><span class="lbl">Google Drive<small>Pas encore configuré</small></span><span class="val">Bientôt</span></div>
    </div>
    <p class="group-f">Pour l'instant, tout est gardé sur ce téléphone. La sauvegarde Drive s'activera dès que l'identifiant Google de l'app sera ajouté.</p>`;
  }
  if (!d.connected) {
    return html`<div class="group"><button type="button" class="row" data-act="driveConnect"><span class="lbl">Google Drive<small>Sauvegarde et synchro entre tes appareils</small></span><span class="val" style="color:var(--accent)">Se connecter</span></button></div>`;
  }
  const busy = Drive.status.state === 'syncing';
  return html`<div class="group">
    <div class="row"><span class="lbl">Google Drive<small>${d.email || 'Compte connecté'}</small></span><span class="val" style="color:var(--ok)"><span class="dot" style="background:#2F9E55;box-shadow:none;width:8px;height:8px"></span>Connecté</span></div>
    <button type="button" class="row" data-act="driveLocation"><span>Emplacement</span><span class="val"><span>${d.folderPath || 'Mon Drive › Cintre'}</span>${chev()}</span></button>
    <button type="button" class="row" data-act="driveSync" ${busy ? 'disabled' : ''}><span style="color:var(--accent)">Synchroniser maintenant</span>${busy ? html`<span class="spin" style="color:var(--accent)"></span>` : ''}</button>
    <button type="button" class="row" data-act="driveOut"><span class="muted">Se déconnecter</span></button>
  </div>
  <p class="group-f">${syncLabel(d)} Cintre n'a accès qu'à son propre dossier.</p>`;
}

export default {
  enter() { estimate().then((e) => { storage = e; S.notify(); }); },
  render() {
    const set = S.settings(); const local = S.getLocal();
    const q = QUALITY[set.quality] || QUALITY.balanced;
    const tryon = { realistic: true, hfToken: '', ...(local.tryon || {}) };
    return html`<main class="screen">
      <a href="#aujourdhui" style="display:inline-flex;align-items:center;gap:2px;color:var(--accent);text-decoration:none;font-size:17px;min-height:44px;margin-left:-6px">${icon('back', 22, 2.4)}Aujourd'hui</a>
      <h1 class="large-title">Réglages</h1>

      <div class="group-h">Toi</div>
      <div class="group"><label class="row"><span>Prénom</span><input id="sname" type="text" value="${set.name}" placeholder="Ton prénom" data-change="name" style="border:none;background:none;text-align:right;font-size:16px;outline:none;min-width:0;flex:1;color:var(--muted)" autocomplete="given-name"></label></div>

      <div class="group-h">Tenues</div>
      <div class="group">
        <button type="button" class="row" data-act="occasions"><span>Mes occasions</span><span class="val">${S.occasions().length}${chev()}</span></button>
        <div class="block"><span class="lbl">Ne pas reproposer une pièce portée depuis moins de</span>
          <div class="seg">${[1, 3, 5, 7].map((n) => html`<button type="button" aria-pressed="${set.avoidDays === n}" data-act="avoid" data-v="${n}">${n} jour${n > 1 ? 's' : ''}</button>`)}</div></div>
      </div>

      <div class="group-h">Météo</div>
      <div class="group">
        <div class="row"><span>Utiliser ma position</span><button type="button" class="switch" role="switch" aria-checked="${local.useLocation}" aria-label="Utiliser ma position" data-act="loc"></button></div>
        <button type="button" class="row" data-act="city"><span class="lbl">Ville${local.useLocation ? html`<small>Si la position n'est pas disponible</small>` : ''}</span><span class="val"><span>${local.city?.name || 'Aucune'}</span>${chev()}</span></button>
        <div class="block"><span class="lbl">Je suis plutôt</span>
          <div class="seg">${[[-1, 'Frileux'], [0, 'Normal'], [1, "J'ai chaud"]].map(([v, l]) => html`<button type="button" aria-pressed="${set.feel === v}" data-act="feel" data-v="${v}">${l}</button>`)}</div></div>
      </div>

      <div class="group-h">Photos</div>
      <div class="group"><div class="block"><span class="lbl">Qualité d'enregistrement</span>
        <div class="seg">${Object.entries(QUALITY).map(([k, v]) => html`<button type="button" aria-pressed="${set.quality === k}" data-act="quality" data-v="${k}">${v.label}</button>`)}</div></div></div>
      <p class="group-f">${q.label} : ${q.hint}, ${q.max} px de côté au maximum. Les photos déjà ajoutées ne changent pas.</p>

      <div class="group-h">Cabine d'essayage</div>
      <div class="group">
        <button type="button" class="row" data-act="mePhoto"><span class="lbl">Ma photo en pied<small>${local.me ? (local.me.auto ? 'Silhouette repérée' : 'Pièces placées approximativement') : 'Pour essayer tes tenues sur toi'}</small></span><span class="val">${local.me ? 'Changer' : 'Ajouter'}${chev()}</span></button>
        <div class="row"><span class="lbl">Rendu réaliste<small>Gratuit, quota limité par jour</small></span><button type="button" class="switch" role="switch" aria-checked="${tryon.realistic}" aria-label="Rendu réaliste" data-act="realistic"></button></div>
        <button type="button" class="row" data-act="hfToken"><span class="lbl">Jeton Hugging Face<small>Optionnel, gratuit : plus de rendus par jour</small></span><span class="val">${tryon.hfToken ? 'Ajouté' : 'Aucun'}${chev()}</span></button>
      </div>
      <p class="group-f">Le rendu réaliste passe par des modèles d'essayage gratuits hébergés sur Hugging Face : ta photo et celles des pièces y sont envoyées. Les chaussures restent en aperçu. Sans connexion, la cabine affiche l'aperçu.</p>

      <div class="group-h">Sauvegarde</div>
      ${driveGroup()}

      <div class="group-h">Intelligence artificielle</div>
      <div class="group"><button type="button" class="row" data-act="ai"><span class="lbl">Reconnaissance des photos<small>${local.aiKey ? `Activée avec ${PROVIDERS[providerOf(local.aiKey)].label}` : 'Optionnelle, gratuite avec Gemini'}</small></span><span class="val">${local.aiKey ? 'Activée' : 'Désactivée'}${chev()}</span></button></div>
      <p class="group-f">Sans IA, Cintre détecte la couleur et compose avec ses propres règles. Avec, il reconnaît aussi la pièce et comprend des phrases comme « dîner en terrasse ».</p>

      <div class="group-h">Données</div>
      <div class="group">
        <button type="button" class="row" data-act="export"><span style="color:var(--accent)">Exporter une sauvegarde</span></button>
        <label class="row" style="cursor:pointer"><span style="color:var(--accent)">Importer une sauvegarde</span><input type="file" accept="application/json,.json" class="sr" data-change="import"></label>
        ${S.hasDemo() ? html`<button type="button" class="row" data-act="undemo"><span style="color:var(--accent)">Retirer les pièces d'exemple</span></button>` : html`<button type="button" class="row" data-act="demo"><span style="color:var(--accent)">Ajouter une garde-robe d'exemple</span></button>`}
        ${storage?.usage ? html`<div class="row"><span>Espace utilisé sur ce téléphone</span><span class="val">${formatBytes(storage.usage)}</span></div>` : ''}
        <button type="button" class="row danger" data-act="wipe">Tout effacer sur ce téléphone</button>
      </div>
      <p class="group-f center" style="margin-top:28px">Cintre · version 1.0</p>
    </main>`;
  },
  actions: {
    name(el) { S.setSettings({ name: el.value.trim() }); },
    avoid(el) { S.setSettings({ avoidDays: +el.dataset.v }); },
    feel(el) { S.setSettings({ feel: +el.dataset.v }); },
    quality(el) { S.setSettings({ quality: el.dataset.v }); },
    loc() {
      const on = !S.getLocal().useLocation;
      S.setLocal({ useLocation: on });
      if (!on && !S.getLocal().city) openCityPicker();
    },
    city() { openCityPicker(); },
    occasions() { openOccasions(); },
    async driveConnect() {
      try { await Drive.connect(); toast('Google Drive connecté'); }
      catch (e) { toast(e.message || 'Connexion impossible'); }
    },
    async driveSync() { await Drive.sync({ interactive: true }); if (Drive.status.state === 'idle') toast('À jour'); },
    async driveLocation() {
      if (!Drive.pickerConfigured()) {
        toast('Déplace le dossier « Cintre » dans Drive : l\'app le suivra.');
        return;
      }
      try { if (await Drive.pickLocation()) toast('Dossier déplacé'); } catch (e) { toast(e.message); }
    },
    async driveOut() {
      if (await confirmDialog({ title: 'Se déconnecter de Drive ?', text: 'Tes données restent sur ce téléphone et dans ton Drive.', ok: 'Déconnecter' })) Drive.disconnect();
    },
    ai() { openAiKey(); },
    mePhoto() { openMePhoto(); },
    realistic() {
      const t = { realistic: true, hfToken: '', ...(S.getLocal().tryon || {}) };
      S.setLocal({ tryon: { ...t, realistic: !t.realistic } });
    },
    hfToken() { openHfToken(); },
    export() {
      const blob = new Blob([JSON.stringify({ app: 'cintre', at: new Date().toISOString(), data: S.getData() }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `cintre-sauvegarde-${todayKey()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Sauvegarde exportée (sans les photos)');
    },
    async import(el) {
      const f = el.files?.[0]; el.value = '';
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        const d = j.data || j;
        if (!d.items) throw new Error();
        if (!(await confirmDialog({ title: 'Importer cette sauvegarde ?', text: 'Elle sera fusionnée avec tes données actuelles.', ok: 'Importer' }))) return;
        const cur = S.getData();
        const mergeMap = (a, b) => { const o = { ...a }; Object.entries(b || {}).forEach(([k, v]) => { if (!o[k] || (v.updatedAt || 0) > (o[k].updatedAt || 0)) o[k] = v; }); return o; };
        S.replaceData({ ...cur, items: mergeMap(cur.items, d.items), outfits: mergeMap(cur.outfits, d.outfits), wears: mergeMap(cur.wears, d.wears), settings: (d.settings?.updatedAt || 0) > (cur.settings.updatedAt || 0) ? d.settings : cur.settings });
        toast('Sauvegarde importée');
      } catch { toast('Ce fichier n\'est pas une sauvegarde Cintre.'); }
    },
    demo() { loadDemo().then(() => toast("Garde-robe d'exemple ajoutée")); },
    async undemo() { if (await confirmDialog({ title: "Retirer les pièces d'exemple ?", ok: 'Retirer' })) { S.removeDemo(); toast('Exemples retirés'); } },
    async wipe() {
      if (!(await confirmDialog({ title: 'Tout effacer ?', text: S.getLocal().drive.connected ? 'Les données de ce téléphone seront supprimées. Ta sauvegarde Drive est conservée.' : 'Tes pièces, tenues et photos seront définitivement supprimées de ce téléphone.', ok: 'Tout effacer', danger: true }))) return;
      await new Promise((res) => { const r = indexedDB.deleteDatabase('cintre'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
      try { localStorage.clear(); sessionStorage.clear(); } catch { }
      location.hash = ''; location.reload();
    }
  }
};

// ---------- Occasions ----------
function openOccasions() {
  openSheet({
    title: 'Mes occasions',
    tall: true,
    left: { label: 'OK' },
    state: { editing: null },
    body: (s) => html`<p class="sub" style="margin:4px 4px 0">Les occasions servent à choisir les pièces. Ajoute les tiennes : mariage, rendez-vous client…</p>
      <div class="group mt16">${S.occasions().map((o) => html`<button type="button" class="row" data-act="edit" data-id="${o.id}"><span class="lbl">${o.label}<small>${FORMALITY_LABELS[o.formality]}</small></span>${chev()}</button>`)}</div>
      <button type="button" class="btn btn-soft mt16" data-act="add">${icon('plus', 18, 2)}Ajouter une occasion</button>
      ${S.occasions().length !== DEFAULT_OCCASIONS.length || S.occasions().some((o, i) => o.label !== DEFAULT_OCCASIONS[i]?.label) ? html`<button type="button" class="btn btn-text mt8" data-act="reset">Revenir aux occasions de base</button>` : ''}`,
    actions: {
      add(s) { editOccasion(null, () => s.render()); },
      edit(s, el) { editOccasion(el.dataset.id, () => s.render()); },
      async reset(s) {
        if (await confirmDialog({ title: 'Revenir aux occasions de base ?', text: 'Tes occasions personnalisées seront retirées.', ok: 'Rétablir' })) { S.setSettings({ occasions: DEFAULT_OCCASIONS }); s.render(); }
      }
    }
  });
}

function editOccasion(id, done) {
  const o = id ? S.occasion(id) : { id: null, label: '', formality: 2 };
  openSheet({
    title: id ? 'Occasion' : 'Nouvelle occasion',
    left: { label: 'Annuler' },
    right: { label: 'OK', act: 'save' },
    state: { label: o.label, formality: o.formality },
    body: (s) => html`<div class="group mt8">
        <label class="block"><span class="lbl">Nom</span><input id="olabel" class="field" type="text" value="${s.state.label}" placeholder="Ex. Mariage, Rendez-vous client" data-input="label" autocomplete="off"></label>
        <div class="block"><span class="lbl">Style attendu</span><div class="seg">${FORMALITY_LABELS.map((l, i) => html`<button type="button" aria-pressed="${s.state.formality === i}" data-act="f" data-v="${i}">${l}</button>`)}</div></div>
      </div>
      <p class="group-f">Pour une nouvelle occasion, je choisis d'abord les pièces que tu y as associées, puis celles du même style.</p>
      ${id && S.occasions().length > 1 ? html`<div class="group mt20"><button type="button" class="row danger" data-act="del">Supprimer l'occasion</button></div>` : ''}`,
    onMount(s) { if (!id) setTimeout(() => s.body.querySelector('#olabel')?.focus(), 300); },
    actions: {
      label(s, el) { s.state.label = el.value; },
      f(s, el) { s.state.formality = +el.dataset.v; s.render(); },
      save(s) {
        const label = s.state.label.trim();
        if (!label) { toast('Donne-lui un nom.'); return; }
        const list = [...S.occasions()];
        if (id) { const i = list.findIndex((x) => x.id === id); list[i] = { ...list[i], label, formality: s.state.formality }; }
        else list.push({ id: 'o' + uid(), label, formality: s.state.formality });
        S.setSettings({ occasions: list });
        s.close(); done?.();
      },
      async del(s) {
        if (!(await confirmDialog({ title: `Supprimer « ${o.label} » ?`, text: 'Les pièces ne sont pas supprimées.', ok: 'Supprimer', danger: true }))) return;
        S.setSettings({ occasions: S.occasions().filter((x) => x.id !== id) });
        s.close(); done?.();
      }
    }
  });
}

// ---------- Clé IA ----------
function openAiKey() {
  const cur = S.getLocal().aiKey || '';
  openSheet({
    title: 'Reconnaissance IA',
    left: { label: 'Annuler' },
    right: (s) => ({ label: 'Enregistrer', act: 'save', busy: s.state.busy }),
    state: { key: cur, prov: cur ? providerOf(cur) : 'gemini', busy: false },
    body: (s) => {
      const p = s.state.prov;
      return html`<div class="seg mt8" role="group" aria-label="Fournisseur">${Object.entries(PROVIDERS).map(([k, v]) => html`<button type="button" aria-pressed="${p === k}" data-act="prov" data-v="${k}">${v.label} · ${v.hint}</button>`)}</div>
      ${p === 'gemini'
        ? html`<div class="notice mt16">${icon('sparkle', 18)}<span>Clé gratuite de Google. Crée-la sur <b style="font-weight:600">aistudio.google.com/apikey</b> avec ton compte Gmail. Le quota gratuit suffit pour quelques pièces par jour. En version gratuite, Google peut utiliser les photos envoyées pour améliorer ses services.</span></div>`
        : html`<div class="notice mt16">${icon('sparkle', 18)}<span>Clé API Claude, payante à l'usage (une fraction de centime par photo). Crée-la sur <b style="font-weight:600">console.anthropic.com</b>, rubrique « API Keys », après avoir ajouté un peu de crédit.</span></div>`}
      <div class="group mt16"><label class="block"><span class="lbl">Clé API</span><input id="aikey" class="field" type="password" value="${s.state.key}" placeholder="${PROVIDERS[p].prefix}…" data-input="key" autocomplete="off" spellcheck="false" autocapitalize="off"></label></div>
      <p class="group-f">La clé reste sur ce téléphone. Elle n'est ni synchronisée sur Drive ni envoyée ailleurs qu'à ${p === 'gemini' ? 'Google' : 'Anthropic'}.</p>
      ${cur ? html`<div class="group mt20"><button type="button" class="row danger" data-act="remove">Désactiver l'IA</button></div>` : ''}`;
    },
    actions: {
      prov(s, el) { s.state.prov = el.dataset.v; s.render(); },
      key(s, el) { s.state.key = el.value.trim(); },
      async save(s) {
        const key = s.state.key;
        if (!key) { s.close(); return; }
        if (providerOf(key) !== s.state.prov) { toast(`Cette clé ressemble à une clé ${PROVIDERS[providerOf(key)].label}.`); s.state.prov = providerOf(key); s.render(); return; }
        s.state.busy = true; s.renderNav();
        try { await testKey(key); S.setLocal({ aiKey: key }); toast(`IA activée avec ${PROVIDERS[providerOf(key)].label}`); s.close(); }
        catch (e) { toast(e.message || 'Clé refusée'); s.state.busy = false; s.renderNav(); }
      },
      remove(s) { S.setLocal({ aiKey: '' }); toast('IA désactivée'); s.close(); }
    }
  });
}

// ---------- Jeton Hugging Face (cabine, rendu réaliste) ----------
function openHfToken() {
  const t = { realistic: true, hfToken: '', ...(S.getLocal().tryon || {}) };
  openSheet({
    title: 'Jeton Hugging Face',
    state: { token: t.hfToken },
    left: { label: 'Annuler' },
    right: { act: 'save', label: 'OK' },
    body: (s) => html`<div class="notice mt8">${icon('sparkle', 18)}<span>Sans jeton, les rendus réalistes utilisent un petit quota gratuit anonyme. Avec un compte Hugging Face gratuit, le quota est plus large : crée le jeton sur <b style="font-weight:600">huggingface.co › Settings › Access Tokens</b>, type « Read ».</span></div>
      <div class="group mt16"><label class="block"><span class="lbl">Jeton</span><input id="hftok" class="field" type="password" value="${s.state.token}" placeholder="hf_…" data-input="tok" autocomplete="off" spellcheck="false" autocapitalize="off"></label></div>
      <p class="group-f">Le jeton reste sur ce téléphone et n'est envoyé qu'à Hugging Face.</p>
      ${t.hfToken ? html`<div class="group mt20"><button type="button" class="row danger" data-act="remove">Retirer le jeton</button></div>` : ''}`,
    actions: {
      tok(s, el) { s.state.token = el.value.trim(); },
      save(s) {
        const tok = s.state.token;
        if (tok && !tok.startsWith('hf_')) { toast('Un jeton commence par « hf_ »'); return; }
        S.setLocal({ tryon: { ...t, hfToken: tok } });
        toast(tok ? 'Jeton enregistré' : 'Jeton retiré');
        s.close();
      },
      remove(s) { S.setLocal({ tryon: { ...t, hfToken: '' } }); toast('Jeton retiré'); s.close(); }
    }
  });
}
