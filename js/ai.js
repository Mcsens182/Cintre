// IA optionnelle (clé API Claude saisie dans les Réglages, gardée sur l'appareil uniquement).
// Sert à reconnaître une pièce sur la photo et à comprendre « Où vas-tu ? ».
import { CATEGORIES, COLORS } from './catalog.js';

const MODEL = 'claude-haiku-5-5';

async function call(key, content, maxTokens = 400) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content }] })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(r.status === 401 ? 'Clé API refusée' : `IA indisponible (${r.status}) ${t.slice(0, 80)}`);
  }
  const j = await r.json();
  const text = (j.content || []).map((c) => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse IA illisible');
  return JSON.parse(m[0]);
}

export async function recognize(key, base64Jpeg, occasions) {
  const cats = CATEGORIES.map((c) => `${c.id} (${c.label}) : ${c.subs.map((s) => `${s.id}=${s.label}`).join(', ')}`).join('\n');
  const cols = COLORS.map((c) => c.id).join(', ');
  const occ = occasions.map((o) => `${o.id}=${o.label}`).join(', ');
  const prompt = `Tu regardes la photo d'un vêtement porté ou posé. Identifie la pièce principale au centre de l'image.
Réponds UNIQUEMENT en JSON, sans texte autour :
{"cat":"...","sub":"...","color":"...","name":"...","warmth":1|2|3,"rain":true|false,"occasions":["..."],"phrase":"..."}
- cat et sub parmi :\n${cats}
- color parmi : ${cols}
- name : nom court et naturel en français, 2 à 4 mots (ex. « Chemise en lin bleue »)
- warmth : 1 léger, 2 moyen, 3 chaud
- rain : la pièce supporte-t-elle la pluie ?
- occasions parmi : ${occ}
- phrase : une phrase chaleureuse et simple en français, tutoiement, qui décrit ce que tu as reconnu (ex. « J'ai reconnu une chemise bleu ciel, légère, plutôt pour le travail. »)`;
  return call(key, [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } },
    { type: 'text', text: prompt }
  ]);
}

export async function understand(key, text, occasions) {
  const occ = occasions.map((o) => `${o.id}=${o.label}`).join(', ');
  return call(key, [{ type: 'text', text: `Quelqu'un dit où il va aujourd'hui : « ${text} ». Choisis l'occasion vestimentaire la plus adaptée parmi : ${occ}. Indique aussi si c'est surtout le soir. Réponds UNIQUEMENT en JSON : {"occasionId":"...","evening":true|false}` }], 80);
}

export async function testKey(key) {
  await call(key, [{ type: 'text', text: 'Réponds {"ok":true}' }], 20);
  return true;
}
