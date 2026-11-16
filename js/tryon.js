// Rendu réaliste de la cabine d'essayage, 100 % gratuit :
// modèles d'essayage virtuel publics hébergés sur Hugging Face (Leffa, IDM-VTON en secours).
// Chaque rendu terminé est gardé sur le téléphone : une tenue déjà vue s'affiche tout de suite.
import { photoGet, photoPut, photoKeys, photoDelete } from './db.js';

const GRADIO = 'https://cdn.jsdelivr.net/npm/@gradio/client@2.8.0/dist/browser.js';
const LEFFA = 'franciszzj/Leffa';
const IDM = 'yisol/IDM-VTON';
const CACHE_MAX = 80;

let modP = null;
const mod = () => modP || (modP = import(GRADIO).catch((e) => { modP = null; throw e; }));

const clients = new Map();
async function client(space, token) {
  const k = `${space}|${token || ''}`;
  if (!clients.has(k)) {
    clients.set(k, mod().then(({ Client }) => Client.connect(space, token ? { token } : {})));
  }
  try { return await clients.get(k); } catch (e) { clients.delete(k); throw e; }
}

const asFile = (blob, name) => new File([blob], name, { type: blob.type || 'image/jpeg' });

async function outBlob(out) {
  const v = Array.isArray(out) ? out[0] : out;
  const url = typeof v === 'string' ? v : v?.url;
  if (!url) throw new Error('Rendu vide');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Image du rendu introuvable (${r.status})`);
  return r.blob();
}

function friendly(e) {
  const m = String(e?.message || e || '');
  if (/quota|ZeroGPU|exceeded your GPU/i.test(m)) {
    const err = new Error('Quota gratuit de rendu atteint pour le moment. Réessaie plus tard, ou ajoute un jeton Hugging Face gratuit dans Réglages.');
    err.code = 'quota';
    return err;
  }
  if (/Failed to fetch|NetworkError|Load failed|offline/i.test(m) || !navigator.onLine) {
    const err = new Error('Pas de connexion : je reste sur l\'aperçu.');
    err.code = 'offline';
    return err;
  }
  return new Error('Le rendu réaliste n\'a pas abouti. L\'aperçu reste affiché.');
}

async function leffa(person, garment, garmentType, token) {
  const { handle_file } = await mod();
  const c = await client(LEFFA, token);
  // Leffa : modèle VITON-HD pour le haut, DressCode pour le bas.
  const model = garmentType === 'lower_body' ? 'dress_code' : 'viton_hd';
  const r = await c.predict('/leffa_predict_vt', [
    handle_file(asFile(person, 'person.jpg')), handle_file(asFile(garment, 'garment.jpg')),
    false, 30, 2.5, 42, model, garmentType, false
  ]);
  return outBlob(r.data);
}

async function idm(person, garment, description, token) {
  const { handle_file } = await mod();
  const c = await client(IDM, token);
  const r = await c.predict('/tryon', [
    { background: handle_file(asFile(person, 'person.jpg')), layers: [], composite: null },
    handle_file(asFile(garment, 'garment.jpg')), description, true, true, 30, 42
  ]);
  return outBlob(r.data);
}

async function upper(person, garment, description, token) {
  try { return await leffa(person, garment, 'upper_body', token); }
  catch (e) {
    if (friendly(e).code === 'offline') throw e;
    console.warn('Leffa indisponible, essai avec IDM-VTON', e);
    return idm(person, garment, description, token);
  }
}

// Clé de cache : la photo de l'utilisateur + les pièces rendues (veste ou haut, et bas).
export function renderKey(mePhotoId, pieces) {
  const u = pieces.outer || pieces.top;
  const b = pieces.bottom;
  if (!u && !b) return null;
  const part = (it) => (it ? `${it.id}.${it.photo?.id || 'x'}` : '-');
  return `vto:${mePhotoId}:${part(u)}:${part(b)}`;
}

export async function cached(key) {
  const rec = await photoGet(key).catch(() => null);
  return rec?.full || null;
}

async function prune() {
  try {
    const keys = (await photoKeys()).filter((k) => String(k).startsWith('vto:'));
    if (keys.length <= CACHE_MAX) return;
    const recs = await Promise.all(keys.map((k) => photoGet(k).then((r) => ({ k, at: r?.at || 0 }))));
    recs.sort((a, b) => a.at - b.at).slice(0, keys.length - CACHE_MAX).forEach((r) => photoDelete(r.k));
  } catch { }
}

// Efface les rendus liés à une ancienne photo de l'utilisateur.
export async function clearFor(mePhotoId) {
  try {
    const keys = await photoKeys();
    keys.filter((k) => String(k).startsWith(`vto:${mePhotoId}:`)).forEach((k) => photoDelete(k));
  } catch { }
}

// person : Blob de la photo de l'utilisateur. garments : { upper: {blob, desc}, bottom: {blob} }.
// Le bas d'abord, puis le haut par-dessus (la ceinture du haut tombe mieux ainsi).
export async function render(key, person, garments, token) {
  try {
    let img = person;
    if (garments.bottom) img = await leffa(img, garments.bottom.blob, 'lower_body', token);
    if (garments.upper) img = await upper(img, garments.upper.blob, garments.upper.desc, token);
    await photoPut({ id: key, full: img, at: Date.now() });
    prune();
    return img;
  } catch (e) {
    console.warn('Rendu réaliste', e);
    throw friendly(e);
  }
}
