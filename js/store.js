// État de l'app : données synchronisées (pièces, tenues, historique, réglages) + réglages locaux.
import { kvGet, kvSet, photoGet, photoPut, photoDelete } from './db.js';
import { DEFAULT_OCCASIONS, SUB } from './catalog.js';
import { uid, todayKey, daysBetween, debounce } from './util.js';

const SYNCED_DEFAULTS = {
  occasions: DEFAULT_OCCASIONS,
  feel: 0,            // -1 frileux, 0 normal, 1 j'ai chaud
  avoidDays: 3,       // ne pas reproposer une pièce portée il y a moins de N jours
  quality: 'balanced',
  name: ''
};

const LOCAL_DEFAULTS = {
  onboarded: false,
  useLocation: true,
  city: null,         // { name, lat, lon } si position refusée ou désactivée
  aiKey: '',
  me: null,           // photo en pied pour la cabine : { photoId, w, h, zones, auto, at }
  tryon: { realistic: true, hfToken: '' },
  drive: { connected: false, folderId: null, folderPath: '', dataFileId: null, lastSync: null, email: '' }
};

let data = { v: 1, items: {}, outfits: {}, wears: {}, settings: { ...SYNCED_DEFAULTS, updatedAt: 0 }, deletedPhotos: {} };
let local = structuredClone(LOCAL_DEFAULTS);
const listeners = new Set();
const changeHooks = new Set();
let wornIndex = null;

export async function load() {
  try {
    const d = await kvGet('data');
    if (d) data = { ...data, ...d, settings: { ...SYNCED_DEFAULTS, ...(d.settings || {}) } };
    const l = await kvGet('local');
    if (l) local = { ...structuredClone(LOCAL_DEFAULTS), ...l, drive: { ...LOCAL_DEFAULTS.drive, ...(l.drive || {}) } };
  } catch (e) { console.warn('Lecture locale impossible', e); }
  wornIndex = null;
}

const saveData = debounce(() => kvSet('data', data).catch((e) => console.warn(e)), 150);
const saveLocal = () => kvSet('local', local).catch((e) => console.warn(e));

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const onDataChange = (fn) => { changeHooks.add(fn); };
export function notify() { listeners.forEach((fn) => fn()); }

function changed() {
  wornIndex = null;
  saveData();
  changeHooks.forEach((fn) => fn());
  notify();
}

// ---------- Accès brut (synchro) ----------
export const getData = () => data;
export function replaceData(next) { data = next; data.settings = { ...SYNCED_DEFAULTS, ...(data.settings || {}) }; wornIndex = null; kvSet('data', data); notify(); }

// ---------- Réglages ----------
export const settings = () => data.settings;
export function setSettings(patch) { data.settings = { ...data.settings, ...patch, updatedAt: Date.now() }; changed(); }
export const getLocal = () => local;
export function setLocal(patch) { local = { ...local, ...patch }; saveLocal(); notify(); }
export function setDrive(patch) { local = { ...local, drive: { ...local.drive, ...patch } }; saveLocal(); notify(); }

export const occasions = () => data.settings.occasions || DEFAULT_OCCASIONS;
export const occasion = (id) => occasions().find((o) => o.id === id) || { id, label: id, formality: 1 };

// ---------- Pièces ----------
export const items = () => Object.values(data.items).filter((i) => !i.deleted).sort((a, b) => b.createdAt - a.createdAt);
export const item = (id) => (data.items[id] && !data.items[id].deleted ? data.items[id] : null);

export function saveItem(it) {
  const now = Date.now();
  const prev = data.items[it.id];
  const next = { ...prev, ...it, updatedAt: now };
  if (!next.id) next.id = uid();
  if (!next.createdAt) next.createdAt = now;
  data.items[next.id] = next;
  changed();
  return next;
}

export function deleteItem(id) {
  const it = data.items[id];
  if (!it) return;
  if (it.photo) {
    data.deletedPhotos[it.photo.id] = { ...it.photo, at: Date.now() };
    photoDelete(it.photo.id).catch(() => { });
    dropPhotoUrl(it.photo.id);
  }
  data.items[id] = { id, deleted: true, updatedAt: Date.now() };
  // retirer la pièce des tenues enregistrées
  Object.values(data.outfits).forEach((o) => {
    if (!o.deleted && o.itemIds.includes(id)) data.outfits[o.id] = { ...o, itemIds: o.itemIds.filter((x) => x !== id), updatedAt: Date.now() };
  });
  changed();
}

// ---------- Tenues ----------
export const outfits = () => Object.values(data.outfits).filter((o) => !o.deleted && o.itemIds.some((id) => item(id))).sort((a, b) => b.updatedAt - a.updatedAt);
export const outfit = (id) => (data.outfits[id] && !data.outfits[id].deleted ? data.outfits[id] : null);
export function saveOutfit(o) {
  const now = Date.now();
  const next = { ...data.outfits[o.id], ...o, updatedAt: now };
  if (!next.id) next.id = uid();
  if (!next.createdAt) next.createdAt = now;
  data.outfits[next.id] = next;
  changed();
  return next;
}
export function deleteOutfit(id) { data.outfits[id] = { id, deleted: true, updatedAt: Date.now() }; changed(); }

// ---------- Historique ----------
export const wears = () => Object.values(data.wears).filter((w) => !w.deleted && w.itemIds?.length).sort((a, b) => (a.date < b.date ? 1 : -1));
export const wearOn = (date = todayKey()) => (data.wears[date] && !data.wears[date].deleted ? data.wears[date] : null);
export function wearToday(itemIds, occasionId, outfitId = null, date = todayKey()) {
  data.wears[date] = { date, itemIds: [...itemIds], occasion: occasionId, outfitId, updatedAt: Date.now() };
  changed();
}
export function unwear(date = todayKey()) { data.wears[date] = { date, deleted: true, updatedAt: Date.now() }; changed(); }

function buildWornIndex() {
  wornIndex = {};
  wears().forEach((w) => w.itemIds.forEach((id) => {
    const e = wornIndex[id] || (wornIndex[id] = { count: 0, last: null });
    e.count++;
    if (!e.last || w.date > e.last) e.last = w.date;
  }));
}
export function wornInfo(id) {
  if (!wornIndex) buildWornIndex();
  return wornIndex[id] || { count: 0, last: null };
}
export function daysSinceWorn(id, ref = todayKey()) {
  const w = wornInfo(id);
  if (!w.last) return Infinity;
  return daysBetween(w.last, ref);
}

// ---------- Photos ----------
const urlCache = new Map(); // `${id}:${kind}` -> objectURL
const pending = new Map();
let photoFetcher = null; // fourni par la synchro Drive pour télécharger une photo manquante
export const setPhotoFetcher = (fn) => { photoFetcher = fn; };

export async function storePhoto(id, full, thumb) {
  await photoPut({ id, full, thumb, at: Date.now() });
  dropPhotoUrl(id);
}

function dropPhotoUrl(id) {
  ['thumb', 'full'].forEach((k) => {
    const key = `${id}:${k}`;
    if (urlCache.has(key)) { URL.revokeObjectURL(urlCache.get(key)); urlCache.delete(key); }
  });
}

// Renvoie l'URL tout de suite si connue, sinon lance le chargement et rafraîchit l'écran ensuite.
export function photoUrl(photo, kind = 'thumb') {
  if (!photo) return null;
  const key = `${photo.id}:${kind}`;
  if (urlCache.has(key)) return urlCache.get(key);
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      let rec = await photoGet(photo.id).catch(() => null);
      let blob = rec && (rec[kind] || rec.full || rec.thumb);
      if (!blob && photoFetcher) {
        try {
          const got = await photoFetcher(photo, kind);
          if (got) {
            rec = { id: photo.id, ...(rec || {}), [kind]: got };
            await photoPut(rec);
            blob = got;
          }
        } catch (e) { console.warn('Photo indisponible', e); }
      }
      if (blob) { urlCache.set(key, URL.createObjectURL(blob)); notify(); }
      pending.delete(key);
    })());
  }
  return null;
}

export async function photoBlob(photoId, kind = 'full') {
  const rec = await photoGet(photoId).catch(() => null);
  return rec ? rec[kind] : null;
}

// ---------- Exemples ----------
export const hasDemo = () => items().some((i) => i.demo);
export function removeDemo() {
  items().filter((i) => i.demo).forEach((i) => deleteItem(i.id));
}

export function suggestedFor(subId) {
  const s = SUB[subId];
  return s ? { warmth: s.warmth, rain: !!s.rain, occasions: [...s.occ] } : { warmth: 2, rain: false, occasions: ['casual'] };
}
