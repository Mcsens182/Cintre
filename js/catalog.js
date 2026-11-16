// Catalogue : catégories (simple) → sous-catégories (fin), couleurs, occasions par défaut.

export const ICONS = {
  top: 'M9 3.5L4 6.5l2 4 2-1V20h8V9.5l2 1 2-4-5-3c-.6 1.5-1.7 2.4-3 2.4S9.6 5 9 3.5z',
  bottom: 'M7 3h10l1.2 18h-4.4L12 10.5 10.2 21H5.8z',
  shoes: 'M3 17.5c0-3 1-7.5 2.2-10h3.6c.3 2 2 3.6 4.4 4.2l6 1.6c1.4.4 1.8 1.6 1.8 3v1.2z',
  outer: 'M8.5 3L4 6v14h5.5V11M15.5 3L20 6v14h-5.5V11M8.5 3L12 8.5 15.5 3M12 8.5V20',
  acc: 'M5 10a7 7 0 0 1 14 0v1H5zM3 11h18M9 4.5V3h6v1.5'
};

// warmth : 1 léger, 2 moyen, 3 chaud. rain : supporte la pluie. occ : occasions suggérées.
export const CATEGORIES = [
  {
    id: 'outer', label: 'Veste', plural: 'Vestes', tint: '#F3E7DF', subs: [
      { id: 'blazer', label: 'Blazer', warmth: 1, occ: ['travail', 'chic', 'soiree'] },
      { id: 'surchemise', label: 'Surchemise', warmth: 1, occ: ['casual', 'soiree'] },
      { id: 'blouson', label: 'Blouson', warmth: 2, occ: ['casual', 'soiree'] },
      { id: 'coupevent', label: 'Coupe-vent', warmth: 1, rain: true, occ: ['casual', 'sport'] },
      { id: 'impermeable', label: 'Imperméable', warmth: 2, rain: true, occ: ['casual', 'travail'] },
      { id: 'manteau', label: 'Manteau', warmth: 3, occ: ['travail', 'chic', 'soiree', 'casual'] },
      { id: 'doudoune', label: 'Doudoune', warmth: 3, rain: true, occ: ['casual'] },
      { id: 'veste-autre', label: 'Autre veste', warmth: 2, occ: ['casual'] }
    ]
  },
  {
    id: 'top', label: 'Haut', plural: 'Hauts', tint: '#F7EEE8', subs: [
      { id: 'tshirt', label: 'T-shirt', warmth: 1, occ: ['casual', 'sport'] },
      { id: 'chemise', label: 'Chemise', warmth: 1, occ: ['travail', 'chic', 'soiree', 'casual'] },
      { id: 'polo', label: 'Polo', warmth: 1, occ: ['casual', 'soiree', 'travail'] },
      { id: 'pull', label: 'Pull', warmth: 2, occ: ['casual', 'travail', 'soiree'] },
      { id: 'sweat', label: 'Sweat', warmth: 2, occ: ['casual', 'sport'] },
      { id: 'colroule', label: 'Col roulé', warmth: 2, occ: ['chic', 'travail', 'soiree'] },
      { id: 'debardeur', label: 'Débardeur', warmth: 1, occ: ['sport', 'casual'] },
      { id: 'haut-autre', label: 'Autre haut', warmth: 1, occ: ['casual'] }
    ]
  },
  {
    id: 'bottom', label: 'Bas', plural: 'Bas', tint: '#ECEAE6', subs: [
      { id: 'jean', label: 'Jean', warmth: 2, occ: ['casual', 'soiree'] },
      { id: 'chino', label: 'Chino', warmth: 2, occ: ['casual', 'travail', 'soiree'] },
      { id: 'pantalon', label: 'Pantalon', warmth: 2, occ: ['travail', 'chic', 'soiree'] },
      { id: 'short', label: 'Short', warmth: 1, occ: ['casual', 'sport'] },
      { id: 'jogging', label: 'Jogging', warmth: 2, occ: ['sport'] },
      { id: 'bas-autre', label: 'Autre bas', warmth: 2, occ: ['casual'] }
    ]
  },
  {
    id: 'shoes', label: 'Chaussures', plural: 'Chaussures', tint: '#F5ECE3', subs: [
      { id: 'baskets', label: 'Baskets', warmth: 2, occ: ['casual', 'soiree'] },
      { id: 'derbies', label: 'Derbies', warmth: 2, occ: ['travail', 'chic', 'soiree'] },
      { id: 'mocassins', label: 'Mocassins', warmth: 2, occ: ['travail', 'chic', 'soiree'] },
      { id: 'bottines', label: 'Bottines', warmth: 3, rain: true, occ: ['casual', 'soiree', 'travail'] },
      { id: 'running', label: 'Running', warmth: 2, occ: ['sport'] },
      { id: 'sandales', label: 'Sandales', warmth: 1, occ: ['casual'] },
      { id: 'chaussures-autre', label: 'Autres', warmth: 2, occ: ['casual'] }
    ]
  },
  {
    id: 'acc', label: 'Accessoire', plural: 'Accessoires', tint: '#EFEAF0', subs: [
      { id: 'casquette', label: 'Casquette', warmth: 1, occ: ['casual', 'sport'] },
      { id: 'bonnet', label: 'Bonnet', warmth: 3, occ: ['casual'] },
      { id: 'echarpe', label: 'Écharpe', warmth: 3, occ: ['casual', 'travail', 'chic', 'soiree'] },
      { id: 'ceinture', label: 'Ceinture', warmth: 1, occ: ['travail', 'chic', 'soiree', 'casual'] },
      { id: 'montre', label: 'Montre', warmth: 1, occ: ['travail', 'chic', 'soiree', 'casual'] },
      { id: 'lunettes', label: 'Lunettes', warmth: 1, occ: ['casual'] },
      { id: 'acc-autre', label: 'Autre', warmth: 1, occ: ['casual'] }
    ]
  }
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const SUB = Object.fromEntries(CATEGORIES.flatMap((c) => c.subs.map((s) => [s.id, { ...s, cat: c.id }])));

// neutral : va avec tout. h : teinte (degrés) pour les couleurs non neutres.
export const COLORS = [
  { id: 'blanc', label: 'Blanc', hex: '#F7F7F5', neutral: true },
  { id: 'ecru', label: 'Écru', hex: '#EFE6D4', neutral: true },
  { id: 'beige', label: 'Beige', hex: '#D8C3A0', neutral: true },
  { id: 'camel', label: 'Camel', hex: '#B8874F', neutral: true },
  { id: 'marron', label: 'Marron', hex: '#6B4226', neutral: true },
  { id: 'grisclair', label: 'Gris clair', hex: '#C9C9CE', neutral: true },
  { id: 'gris', label: 'Gris', hex: '#8A8A94', neutral: true },
  { id: 'anthracite', label: 'Anthracite', hex: '#3E3E44', neutral: true },
  { id: 'noir', label: 'Noir', hex: '#1D1B1A', neutral: true },
  { id: 'marine', label: 'Marine', hex: '#1E2A4A', neutral: true },
  { id: 'denim', label: 'Bleu jean', hex: '#4F6D94', neutral: true },
  { id: 'kaki', label: 'Kaki', hex: '#6E6A3E', neutral: true },
  { id: 'bleuciel', label: 'Bleu ciel', hex: '#9CC3F0', h: 212 },
  { id: 'bleu', label: 'Bleu', hex: '#2F5FD0', h: 222 },
  { id: 'vert', label: 'Vert', hex: '#3E8A57', h: 140 },
  { id: 'sapin', label: 'Vert sapin', hex: '#234A3A', h: 155 },
  { id: 'rouge', label: 'Rouge', hex: '#C2352B', h: 5 },
  { id: 'bordeaux', label: 'Bordeaux', hex: '#6E1F2B', h: 350 },
  { id: 'rose', label: 'Rose', hex: '#E8A4B4', h: 345 },
  { id: 'orange', label: 'Orange', hex: '#E2702F', h: 22 },
  { id: 'jaune', label: 'Jaune', hex: '#E8C341', h: 46 },
  { id: 'violet', label: 'Violet', hex: '#6B4C9A', h: 268 },
  { id: 'motif', label: 'Motif', hex: 'conic-gradient(#C7432F, #E8C341, #3E8A57, #2F5FD0, #C7432F)', pattern: true }
];
export const COLOR = Object.fromEntries(COLORS.map((c) => [c.id, c]));

// formality : 0 sport, 1 décontracté, 2 soigné, 3 habillé.
export const DEFAULT_OCCASIONS = [
  { id: 'casual', label: 'Casual', formality: 1 },
  { id: 'travail', label: 'Travail', formality: 2 },
  { id: 'chic', label: 'Chic', formality: 3 },
  { id: 'soiree', label: 'Soirée', formality: 2 },
  { id: 'sport', label: 'Sport', formality: 0 }
];

export const FORMALITY_LABELS = ['Sportif', 'Décontracté', 'Soigné', 'Habillé'];

export const WARMTH_LABELS = { 1: 'Léger', 2: 'Moyen', 3: 'Chaud' };

export const SLOT_ORDER = ['outer', 'top', 'bottom', 'shoes', 'acc'];
