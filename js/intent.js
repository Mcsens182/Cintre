// « Où vas-tu aujourd'hui ? » → occasion. Mots-clés locaux, l'IA prend le relais si elle est activée.

const KEYWORDS = {
  travail: ['bureau', 'travail', 'boulot', 'taf', 'réunion', 'reunion', 'client', 'rdv pro', 'agence', 'entretien', 'meeting', 'présentation', 'presentation', 'formation', 'job'],
  chic: ['mariage', 'cérémonie', 'ceremonie', 'gala', 'baptême', 'bapteme', 'opéra', 'opera', 'cocktail', 'théâtre', 'theatre', 'chic', 'élégant', 'elegant', 'enterrement', 'obsèques', 'communion'],
  soiree: ['soirée', 'soiree', 'dîner', 'diner', 'resto', 'restaurant', 'bar', 'apéro', 'apero', 'date', 'rencard', 'rendez-vous', 'rendez vous', 'verre', 'concert', 'boîte', 'boite', 'club', 'anniversaire', 'anniv', 'sortie', 'ce soir'],
  sport: ['sport', 'salle', 'muscu', 'gym', 'footing', 'jogging', 'courir', 'course', 'run', 'foot', 'tennis', 'padel', 'vélo', 'velo', 'rando', 'randonnée', 'yoga', 'crossfit', 'piscine', 'natation', 'basket'],
  casual: ['balade', 'courses', 'marché', 'marche', 'plage', 'ciné', 'cine', 'cinéma', 'cinema', 'café', 'cafe', 'brunch', 'famille', 'potes', 'amis', 'maison', 'tranquille', 'chill', 'week-end', 'weekend', 'shopping', 'parc', 'promenade']
};

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function parseIntent(text, occasions) {
  const t = norm(text || '');
  if (!t.trim()) return null;
  // une occasion perso nommée dans la phrase gagne
  for (const o of occasions) if (t.includes(norm(o.label))) return { occasionId: o.id, evening: /soir|diner|nuit|bar|club/.test(t) };
  let best = null, bestN = 0;
  for (const [id, words] of Object.entries(KEYWORDS)) {
    const n = words.filter((w) => t.includes(norm(w))).length;
    if (n > bestN && occasions.some((o) => o.id === id)) { best = id; bestN = n; }
  }
  return { occasionId: best || 'casual', evening: /soir|diner|nuit|bar|club|concert/.test(t), matched: !!best };
}
