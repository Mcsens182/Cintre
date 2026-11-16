// Météo : position du téléphone (ou ville choisie) + prévisions Open-Meteo (gratuit, sans clé).
import { kvGet, kvSet } from './db.js';

const CODES = {
  0: ['Ensoleillé', 'sun'], 1: ['Plutôt ensoleillé', 'sun'], 2: ['Éclaircies', 'partly'], 3: ['Couvert', 'cloud'],
  45: ['Brouillard', 'fog'], 48: ['Brouillard givrant', 'fog'],
  51: ['Bruine légère', 'drizzle'], 53: ['Bruine', 'drizzle'], 55: ['Bruine forte', 'drizzle'], 56: ['Bruine verglaçante', 'drizzle'], 57: ['Bruine verglaçante', 'drizzle'],
  61: ['Pluie faible', 'rain'], 63: ['Pluie', 'rain'], 65: ['Forte pluie', 'rain'], 66: ['Pluie verglaçante', 'rain'], 67: ['Pluie verglaçante', 'rain'],
  71: ['Neige faible', 'snow'], 73: ['Neige', 'snow'], 75: ['Forte neige', 'snow'], 77: ['Grésil', 'snow'],
  80: ['Averses', 'rain'], 81: ['Averses', 'rain'], 82: ['Fortes averses', 'rain'], 85: ['Averses de neige', 'snow'], 86: ['Averses de neige', 'snow'],
  95: ['Orage', 'storm'], 96: ['Orage et grêle', 'storm'], 99: ['Orage et grêle', 'storm']
};

export const WEATHER_ICONS = {
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"></path>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
  partly: '<path d="M8 3v1.5M3.5 8H5M4.8 4.8l1 1M11.2 4.8l-1 1"></path><path d="M5.5 10.5a3 3 0 0 1 5.4-1.8"></path><path d="M8.5 20a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5A3.25 3.25 0 0 1 17.5 20z"></path>',
  cloud: '<path d="M7 19a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.5 4.5 0 0 1-.5 9.5z"></path>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14"></path>',
  drizzle: '<path d="M7 15a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 5.5a4.5 4.5 0 0 1-.5 9.5z"></path><path d="M9 18v1M13 18v1M17 18v1"></path>',
  rain: '<path d="M7 14a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 4.5a4.5 4.5 0 0 1-.5 9.5z"></path><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3"></path>',
  snow: '<path d="M7 14a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 4.5a4.5 4.5 0 0 1-.5 9.5z"></path><path d="M9 18h.01M13 20h.01M17 18h.01M11 22h.01M15 22h.01"></path>',
  storm: '<path d="M7 14a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 4.5a4.5 4.5 0 0 1-.5 9.5z"></path><path d="M12 14l-2 4h4l-2 4"></path>'
};

const CACHE_MS = 25 * 60 * 1000;

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Localisation indisponible'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 30 * 60 * 1000 }
    );
  });
}

async function cityName(lat, lon) {
  const key = `city:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const c = await kvGet(key).catch(() => null);
  if (c) return c;
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
    const j = await r.json();
    const name = j.city || j.locality || j.principalSubdivision || '';
    if (name) kvSet(key, name).catch(() => { });
    return name;
  } catch { return ''; }
}

export async function searchCity(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`);
  const j = await r.json();
  return (j.results || []).map((x) => ({ name: x.name, detail: [x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude }));
}

async function forecast(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(3) + '&longitude=' + lon.toFixed(3) +
    '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day' +
    '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset' +
    '&timezone=auto&forecast_days=2';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Météo indisponible');
  return r.json();
}

// Résume la journée restante (jusqu'à 22 h) : ce qui compte pour s'habiller.
export function summarize(f, now = new Date()) {
  const cur = f.current || {};
  const H = f.hourly;
  const pad = (n) => String(n).padStart(2, '0');
  const dayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nowH = now.getHours();
  const idx = [];
  H.time.forEach((t, i) => {
    if (!t.startsWith(dayStr)) return;
    const h = +t.slice(11, 13);
    if (h >= Math.max(nowH, 7) && h <= 22) idx.push(i);
  });
  if (!idx.length) H.time.forEach((t, i) => { if (t.startsWith(dayStr)) idx.push(i); });
  const vals = (k) => idx.map((i) => H[k][i]).filter((v) => v != null);
  const feelsArr = vals('apparent_temperature');
  const tempArr = vals('temperature_2m');
  const rainArr = vals('precipitation_probability');
  const precArr = vals('precipitation');
  const windArr = vals('wind_speed_10m');
  const evening = idx.filter((i) => +H.time[i].slice(11, 13) >= 19).map((i) => H.apparent_temperature[i]);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const code = cur.weather_code ?? 0;
  const [label, icon] = CODES[code] || ['', 'cloud'];
  const rainProb = rainArr.length ? Math.max(...rainArr) : 0;
  const precip = precArr.reduce((s, x) => s + x, 0);
  return {
    temp: Math.round(cur.temperature_2m ?? avg(tempArr) ?? 15),
    feels: Math.round(cur.apparent_temperature ?? avg(feelsArr) ?? 15),
    dayFeels: Math.round(avg(feelsArr) ?? cur.apparent_temperature ?? 15),
    minFeels: Math.round(feelsArr.length ? Math.min(...feelsArr) : cur.apparent_temperature ?? 15),
    eveningFeels: evening.length ? Math.round(Math.min(...evening)) : null,
    tMax: Math.round(f.daily?.temperature_2m_max?.[0] ?? cur.temperature_2m ?? 15),
    tMin: Math.round(f.daily?.temperature_2m_min?.[0] ?? cur.temperature_2m ?? 15),
    rainProb: Math.round(rainProb),
    precip: Math.round(precip * 10) / 10,
    rainy: rainProb >= 45 || precip >= 1 || ['rain', 'drizzle', 'storm', 'snow'].includes(icon),
    wind: Math.round(windArr.length ? Math.max(...windArr) : cur.wind_speed_10m ?? 0),
    code, label, icon: icon === 'sun' && cur.is_day === 0 ? 'moon' : icon
  };
}

// Point d'entrée : renvoie { place, w } ou lève une erreur explicite.
export async function getWeather(local, { force = false } = {}) {
  let pos = null, place = '';
  if (local.useLocation) {
    try { pos = await getPosition(); } catch (e) { if (!local.city) throw Object.assign(new Error('position'), { code: 'position' }); }
  }
  if (!pos && local.city) { pos = { lat: local.city.lat, lon: local.city.lon }; place = local.city.name; }
  if (!pos) throw Object.assign(new Error('no-place'), { code: 'no-place' });

  const key = `wx:${pos.lat.toFixed(2)},${pos.lon.toFixed(2)}`;
  let cached = await kvGet(key).catch(() => null);
  let f;
  if (!force && cached && Date.now() - cached.at < CACHE_MS) f = cached.f;
  else {
    try { f = await forecast(pos.lat, pos.lon); kvSet(key, { at: Date.now(), f }).catch(() => { }); kvSet('wx:last', { at: Date.now(), f, pos }).catch(() => { }); }
    catch (e) { if (cached) f = cached.f; else throw Object.assign(new Error('network'), { code: 'network' }); }
  }
  if (!place) place = await cityName(pos.lat, pos.lon);
  return { place, w: summarize(f), at: Date.now() };
}

// Hors ligne : dernière météo connue.
export async function lastWeather() {
  const l = await kvGet('wx:last').catch(() => null);
  if (!l) return null;
  return { place: '', w: summarize(l.f), at: l.at, stale: true };
}
