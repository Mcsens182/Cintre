// Sauvegarde Google Drive : un dossier « Cintre » (accès limité aux fichiers créés par l'app),
// un fichier de données JSON et les photos dans un sous-dossier « Photos ».
import { CONFIG } from '../config.js';
import * as S from './store.js';
import { debounce } from './util.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const DATA_NAME = 'cintre-donnees.json';

export const configured = () => !!CONFIG.googleClientId;
export const pickerConfigured = () => !!(CONFIG.googleClientId && CONFIG.googleApiKey && CONFIG.googleAppId);

let token = null, tokenExp = 0, tokenClient = null;
let syncing = false, again = false;
export const status = { state: 'idle', error: '' }; // idle | syncing | error

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Chargement Google impossible'));
    document.head.appendChild(s);
  });
}

try {
  const t = JSON.parse(sessionStorage.getItem('cintre-token') || 'null');
  if (t && t.exp > Date.now() + 60000) { token = t.token; tokenExp = t.exp; }
} catch { }

async function getToken(interactive = false) {
  if (token && Date.now() < tokenExp - 60000) return token;
  if (!configured()) throw new Error('Drive non configuré');
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.googleClientId,
      scope: SCOPE + ' https://www.googleapis.com/auth/userinfo.email',
      callback: (r) => {
        if (r.error) return reject(new Error(r.error));
        token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
        try { sessionStorage.setItem('cintre-token', JSON.stringify({ token, exp: tokenExp })); } catch { }
        resolve(token);
      },
      error_callback: (e) => reject(new Error(e?.type === 'popup_closed' ? 'Connexion annulée' : 'Connexion Google impossible'))
    });
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '', hint: S.getLocal().drive.email || undefined });
  });
}

async function api(path, opts = {}, base = API) {
  const t = await getToken(false);
  const r = await fetch(base + path, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  if (r.status === 401) { token = null; throw new Error('Session Google expirée'); }
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return r;
}
const json = async (path, opts) => (await api(path, opts)).json();
const q = (s) => encodeURIComponent(s);

async function findOne(query) {
  const j = await json(`/files?q=${q(query + ' and trashed=false')}&fields=files(id,name,parents)&spaces=drive&pageSize=5`);
  return j.files?.[0] || null;
}

async function createFolder(name, parent) {
  return json('/files?fields=id,name,parents', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined })
  });
}

async function uploadNew(name, blob, parent, mime) {
  const meta = { name, parents: [parent], mimeType: mime || blob.type };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);
  const r = await api('/files?uploadType=multipart&fields=id', { method: 'POST', body: form }, UPLOAD);
  return (await r.json()).id;
}

async function uploadUpdate(id, blob) {
  await api(`/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'content-type': blob.type }, body: blob }, UPLOAD);
}

export async function download(id) {
  const r = await api(`/files/${id}?alt=media`);
  return r.blob();
}

// ---------- Dossier ----------
async function ensureFolders() {
  const d = S.getLocal().drive;
  let folderId = d.folderId;
  if (folderId) {
    try { const f = await json(`/files/${folderId}?fields=id,trashed`); if (f.trashed) folderId = null; } catch { folderId = null; }
  }
  if (!folderId) {
    const found = await findOne(`name='Cintre' and mimeType='${FOLDER}'`);
    folderId = found ? found.id : (await createFolder('Cintre', d.parentId || undefined)).id;
    S.setDrive({ folderId, folderPath: d.folderPath || 'Mon Drive › Cintre' });
  }
  let photosId = S.getLocal().drive.photosId;
  if (photosId) { try { await json(`/files/${photosId}?fields=id`); } catch { photosId = null; } }
  if (!photosId) {
    const found = await findOne(`name='Photos' and '${folderId}' in parents and mimeType='${FOLDER}'`);
    photosId = found ? found.id : (await createFolder('Photos', folderId)).id;
    S.setDrive({ photosId });
  }
  return { folderId, photosId };
}

// ---------- Connexion ----------
export async function connect() {
  await getToken(true);
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } });
    const u = await r.json();
    S.setDrive({ email: u.email || '' });
  } catch { }
  S.setDrive({ connected: true });
  await sync();
}

export function disconnect() {
  try { if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token); } catch { }
  token = null; tokenExp = 0;
  try { sessionStorage.removeItem('cintre-token'); } catch { }
  S.setDrive({ connected: false, dataFileId: null, lastSync: null });
}

// ---------- Choix de l'emplacement (sélecteur Google Drive) ----------
export async function pickLocation() {
  if (!pickerConfigured()) throw new Error('Sélecteur non configuré');
  const t = await getToken(false).catch(() => getToken(true));
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((res) => gapi.load('picker', res));
  const parent = await new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true).setIncludeFolders(true).setMimeTypes(FOLDER).setParent('root');
    const picker = new google.picker.PickerBuilder()
      .setTitle('Où ranger le dossier Cintre ?')
      .addView(view)
      .setOAuthToken(t).setDeveloperKey(CONFIG.googleApiKey).setAppId(CONFIG.googleAppId)
      .setLocale('fr')
      .setCallback((d) => {
        if (d.action === google.picker.Action.PICKED) resolve(d.docs[0]);
        if (d.action === google.picker.Action.CANCEL) resolve(null);
      }).build();
    picker.setVisible(true);
  });
  if (!parent) return false;
  const { folderId } = await ensureFolders();
  const cur = await json(`/files/${folderId}?fields=parents`);
  const remove = (cur.parents || []).join(',');
  await api(`/files/${folderId}?addParents=${parent.id}${remove ? '&removeParents=' + remove : ''}&fields=id`, { method: 'PATCH' });
  S.setDrive({ parentId: parent.id, folderPath: `${parent.name} › Cintre` });
  return true;
}

// ---------- Fusion ----------
function mergeMaps(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || (v.updatedAt || 0) > (out[k].updatedAt || 0)) out[k] = v;
  return out;
}
function merge(a, b) {
  if (!b) return a;
  return {
    v: 1,
    items: mergeMaps(a.items, b.items),
    outfits: mergeMaps(a.outfits, b.outfits),
    wears: mergeMaps(a.wears, b.wears),
    settings: (b.settings?.updatedAt || 0) > (a.settings?.updatedAt || 0) ? b.settings : a.settings,
    deletedPhotos: { ...(b.deletedPhotos || {}), ...(a.deletedPhotos || {}) }
  };
}

// ---------- Synchro ----------
export const hasToken = () => !!(token && Date.now() < tokenExp - 60000);

export async function sync({ interactive = false } = {}) {
  const d = S.getLocal().drive;
  if (!configured() || !d.connected) return;
  if (!hasToken()) {
    // sans geste de l'utilisateur, Google bloque la fenêtre de connexion : on attend un appui
    if (!interactive) { status.state = 'auth'; S.notify(); return; }
    try { await getToken(false); } catch (e) { status.state = 'auth'; status.error = e.message; S.notify(); return; }
  }
  if (syncing) { again = true; return; }
  syncing = true; status.state = 'syncing'; status.error = ''; S.notify();
  try {
    const { folderId, photosId } = await ensureFolders();
    // 1. récupérer la version Drive
    let dataFileId = S.getLocal().drive.dataFileId;
    if (!dataFileId) { const f = await findOne(`name='${DATA_NAME}' and '${folderId}' in parents`); dataFileId = f?.id || null; }
    let remote = null;
    if (dataFileId) { try { remote = JSON.parse(await (await download(dataFileId)).text()); } catch { dataFileId = null; } }
    let merged = merge(structuredClone(S.getData()), remote);

    // 2. envoyer les photos qui ne sont pas encore sur Drive
    for (const it of Object.values(merged.items)) {
      if (it.deleted || !it.photo || it.demo) continue;
      const ph = it.photo;
      if (ph.fullDrive && ph.thumbDrive) continue;
      const full = await S.photoBlob(ph.id, 'full');
      const thumb = await S.photoBlob(ph.id, 'thumb');
      if (!full) continue; // photo ajoutée sur un autre appareil et pas encore téléchargée
      const ext = full.type === 'image/webp' ? 'webp' : 'jpg';
      const fullDrive = ph.fullDrive || await uploadNew(`${ph.id}.${ext}`, full, photosId);
      const thumbDrive = ph.thumbDrive || (thumb ? await uploadNew(`${ph.id}-mini.${ext}`, thumb, photosId) : fullDrive);
      merged.items[it.id] = { ...it, photo: { ...ph, fullDrive, thumbDrive }, updatedAt: Date.now() };
    }

    // 3. supprimer sur Drive les photos des pièces supprimées
    for (const [pid, ph] of Object.entries(merged.deletedPhotos || {})) {
      for (const fid of [ph.fullDrive, ph.thumbDrive]) {
        if (fid) await api(`/files/${fid}`, { method: 'DELETE' }).catch(() => { });
      }
      if (ph.fullDrive || ph.thumbDrive || Date.now() - (ph.at || 0) > 30 * 86400000) delete merged.deletedPhotos[pid];
      else merged.deletedPhotos[pid] = ph;
    }

    // 4. enregistrer les données sur Drive
    const blob = new Blob([JSON.stringify(merged)], { type: 'application/json' });
    if (dataFileId) await uploadUpdate(dataFileId, blob);
    else dataFileId = await uploadNew(DATA_NAME, blob, folderId, 'application/json');

    // 5. ré-appliquer les modifs faites pendant la synchro
    merged = merge(merged, S.getData());
    S.replaceData(merged);
    S.setDrive({ dataFileId, lastSync: Date.now() });
    status.state = 'idle';
  } catch (e) {
    console.warn('Synchro', e);
    status.state = 'error'; status.error = e.message || 'Erreur';
  } finally {
    syncing = false; S.notify();
    if (again) { again = false; setTimeout(sync, 500); }
  }
}

export const scheduleSync = debounce(() => { if (navigator.onLine !== false) sync(); }, 4000);

export function init() {
  S.onDataChange(() => { if (S.getLocal().drive.connected) scheduleSync(); });
  S.setPhotoFetcher(async (photo, kind) => {
    const id = kind === 'thumb' ? photo.thumbDrive || photo.fullDrive : photo.fullDrive;
    if (!id || !S.getLocal().drive.connected || !token) return null;
    return download(id);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.getLocal().drive.connected && token) sync(); });
}
