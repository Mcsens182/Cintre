// IA optionnelle : Gemini (clé gratuite Google AI Studio) ou Claude (clé API Anthropic).
// La clé est saisie dans les Réglages et reste sur l'appareil.
// Sert à reconnaître une pièce sur la photo et à comprendre « Où vas-tu ? ».
import { CATEGORIES, COLORS } from './catalog.js';

export const PROVIDERS = {
  gemini: { label: 'Gemini', hint: 'Gratuit', prefix: 'AQ.', where: 'aistudio.google.com/apikey' },
  claude: { label: 'Claude', hint: 'Payant à l\'usage', prefix: 'sk-ant-', where: 'console.anthropic.com' }
};

// Devine le fournisseur à partir de la forme de la clé.
export const providerOf = (key) => (key || '').startsWith('sk-ant-') ? 'claude' : 'gemini';

function parseJson(text) {
  const m = (text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse IA illisible');
  return JSON.parse(m[0]);
}

// ---------- Gemini ----------
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

async function gemini(key, parts) {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } })
    });
    if (r.ok) {
      const j = await r.json();
      const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      return parseJson(text);
    }
    if (r.status === 401) throw new Error('Google refuse cette clé (401). Recrée-en une sur aistudio.google.com/apikey');
    if (r.status === 400 || r.status === 403) {
      const t = await r.text().catch(() => '');
      throw new Error(/API key not valid|API_KEY_INVALID/i.test(t) ? 'Clé Gemini refusée' : 'Clé Gemini non autorisée pour ce site');
    }
    // 429 (quota) ou 404 (modèle) : on essaie le modèle suivant, plus léger
    lastErr = r.status === 429 ? new Error('Quota gratuit du jour atteint, réessaie demain') : new Error(`Gemini indisponible (${r.status})`);
  }
  throw lastErr;
}

// ---------- Claude ----------
async function claude(key, content, maxTokens = 400) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content }] })
  });
  if (!r.ok) throw new Error(r.status === 401 ? 'Clé Claude refusée' : `Claude indisponible (${r.status})`);
  const j = await r.json();
  return parseJson((j.content || []).map((c) => c.text || '').join(''));
}

// Un seul point d'entrée : texte seul ou image + texte.
function ask(key, text, imageB64 = null, maxTokens = 400) {
  if (providerOf(key) === 'claude') {
    const content = imageB64 ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } }, { type: 'text', text }] : [{ type: 'text', text }];
    return claude(key, content, maxTokens);
  }
  const parts = imageB64 ? [{ inline_data: { mime_type: 'image/jpeg', data: imageB64 } }, { text }] : [{ text }];
  return gemini(key, parts);
}

export async function recognize(key, base64Jpeg, occasions) {
  const cats = CATEGORIES.map((c) => `${c.id} (${c.label}) : ${c.subs.map((s) => `${s.id}=${s.label}`).join(', ')}`).join('\n');
  const cols = COLORS.map((c) => c.id).join(', ');
  const occ = occasions.map((o) => `${o.id}=${o.label}`).join(', ');
  const prompt = `Tu regardes la photo d'un vêtement porté ou posé. Identifie la pièce principale au centre de l'image.
Réponds UNIQUEMENT en JSON, sans texte autour :
{"cat":"...","sub":"...","color":"...","name":"...","warmth":1,"rain":false,"occasions":["..."],"phrase":"..."}
- cat et sub parmi :\n${cats}
- color parmi : ${cols}
- name : nom court et naturel en français, 2 à 4 mots (ex. « Chemise en lin bleue »)
- warmth : 1 léger, 2 moyen, 3 chaud
- rain : la pièce supporte-t-elle la pluie ? (true ou false)
- occasions parmi : ${occ}
- phrase : une phrase chaleureuse et simple en français, tutoiement, qui décrit ce que tu as reconnu (ex. « J'ai reconnu une chemise bleu ciel, légère, plutôt pour le travail. »)`;
  return ask(key, prompt, base64Jpeg);
}

export async function understand(key, text, occasions) {
  const occ = occasions.map((o) => `${o.id}=${o.label}`).join(', ');
  return ask(key, `Quelqu'un dit où il va aujourd'hui : « ${text} ». Choisis l'occasion vestimentaire la plus adaptée parmi : ${occ}. Indique aussi si c'est surtout le soir. Réponds UNIQUEMENT en JSON : {"occasionId":"...","evening":true}`, null, 80);
}

export async function testKey(key) {
  await ask(key, 'Réponds uniquement ce JSON : {"ok":true}', null, 20);
  return true;
}
