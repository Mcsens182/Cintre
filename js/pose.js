// Repère la silhouette sur la photo de l'utilisateur (MediaPipe, gratuit, calculé sur le téléphone)
// et en déduit où poser chaque pièce dans la cabine d'essayage.
const V = '1.2.3';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

// Zones par défaut (en fraction de la photo) si la silhouette n'est pas trouvée :
// une personne debout, de face, cadrée de la tête aux pieds.
export const DEFAULT_ZONES = {
  outer: { x: 0.19, y: 0.15, w: 0.62, h: 0.40 },
  top: { x: 0.23, y: 0.17, w: 0.54, h: 0.34 },
  bottom: { x: 0.29, y: 0.46, w: 0.42, h: 0.42 },
  shoes: { x: 0.28, y: 0.86, w: 0.44, h: 0.12 }
};

const clampZone = (z) => {
  const x = Math.max(0, Math.min(z.x, 0.98)), y = Math.max(0, Math.min(z.y, 0.98));
  return { x, y, w: Math.max(0.02, Math.min(z.w, 1 - x)), h: Math.max(0.02, Math.min(z.h, 1 - y)) };
};

function zonesFrom(p) {
  const L = (i) => p[i];
  const ls = L(11), rs = L(12), lh = L(23), rh = L(24), lk = L(25), rk = L(26), la = L(27), ra = L(28);
  const lhe = L(29), rhe = L(30), lf = L(31), rf = L(32);
  const sx1 = Math.min(ls.x, rs.x), sx2 = Math.max(ls.x, rs.x), sw = sx2 - sx1;
  const sy = (ls.y + rs.y) / 2, hy = (lh.y + rh.y) / 2, torso = hy - sy;
  if (!(sw > 0.03 && torso > 0.05)) return null;

  const zones = {
    top: { x: sx1 - 0.28 * sw, y: sy - 0.12 * torso, w: sw * 1.56, h: torso * 1.25 },
    outer: { x: sx1 - 0.36 * sw, y: sy - 0.16 * torso, w: sw * 1.72, h: torso * 1.45 }
  };

  const legsSeen = Math.min(la.visibility ?? 1, ra.visibility ?? 1) > 0.3 && Math.max(la.y, ra.y) > hy + torso * 0.6;
  if (legsSeen) {
    const ay = Math.max(la.y, ra.y);
    const xs = [lh.x, rh.x, lk.x, rk.x, la.x, ra.x];
    const x1 = Math.min(...xs), x2 = Math.max(...xs), lw = x2 - x1;
    const pad = Math.max(0.22 * lw, 0.18 * sw);
    zones.bottom = { x: x1 - pad, y: hy - 0.08 * torso, w: lw + 2 * pad, h: ay - hy + 0.12 * torso };
    const fx = [la.x, ra.x, lhe.x, rhe.x, lf.x, rf.x];
    const f1 = Math.min(...fx), f2 = Math.max(...fx), fw = Math.max(f2 - f1, 0.06);
    const fy = Math.max(ay, lf.y, rf.y, lhe.y, rhe.y);
    zones.shoes = { x: f1 - 0.3 * fw, y: ay - 0.05 * torso, w: fw * 1.6, h: fy - ay + 0.16 * torso };
  } else {
    zones.bottom = DEFAULT_ZONES.bottom;
    zones.shoes = DEFAULT_ZONES.shoes;
  }
  return Object.fromEntries(Object.entries(zones).map(([k, z]) => [k, clampZone(z)]));
}

// Renvoie { zones, auto } : auto = true si la silhouette a été trouvée.
export async function detectZones(canvas) {
  try {
    const { PoseLandmarker, FilesetResolver } = await import(`${BASE}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    const lm = await PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numPoses: 1
    });
    const r = lm.detect(canvas);
    lm.close();
    const p = r.landmarks?.[0];
    const zones = p ? zonesFrom(p) : null;
    if (zones) return { zones, auto: true };
  } catch (e) { console.warn('Silhouette non détectée', e); }
  return { zones: DEFAULT_ZONES, auto: false };
}
