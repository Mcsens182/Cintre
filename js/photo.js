// Photos : lecture, recadrage interactif, compression (WebP si possible, sinon JPEG).

export const QUALITY = {
  light: { max: 1080, q: 0.7, label: 'Légère', hint: 'environ 120 Ko par photo' },
  balanced: { max: 1600, q: 0.8, label: 'Équilibrée', hint: 'environ 250 Ko par photo' },
  high: { max: 2200, q: 0.88, label: 'Haute', hint: 'environ 500 Ko par photo' }
};
const THUMB = { max: 480, q: 0.72 };
const WORK_MAX = 2600; // taille max de la copie de travail en mémoire

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Le navigateur applique déjà l'orientation EXIF à l'affichage et au dessin.
      const s = Math.min(1, WORK_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

export function rotate(canvas, dir = 1) {
  const c = document.createElement('canvas');
  c.width = canvas.height; c.height = canvas.width;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(dir * Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

export function cropCanvas(src, r) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w)); c.height = Math.max(1, Math.round(r.h));
  c.getContext('2d').drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

function scaled(src, max) {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  if (s === 1) return src;
  // réduction en plusieurs passes pour garder du piqué
  let cur = src;
  let w = src.width, h = src.height;
  const tw = Math.round(src.width * s), th = Math.round(src.height * s);
  while (w / 2 > tw) {
    w = Math.round(w / 2); h = Math.round(h / 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, w, h); cur = c;
  }
  const c = document.createElement('canvas'); c.width = tw; c.height = th;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  return c;
}

const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));

async function encode(c, q) {
  let b = await toBlob(c, 'image/webp', q);
  if (!b || b.type !== 'image/webp') b = await toBlob(c, 'image/jpeg', q);
  return b;
}

export async function compress(canvas, qualityKey = 'balanced') {
  const preset = QUALITY[qualityKey] || QUALITY.balanced;
  const fullC = scaled(canvas, preset.max);
  const full = await encode(fullC, preset.q);
  const thumb = await encode(scaled(canvas, THUMB.max), THUMB.q);
  return { full, thumb, w: fullC.width, h: fullC.height };
}

export async function canvasToBase64Jpeg(canvas, max = 800) {
  const c = scaled(canvas, max);
  const b = await toBlob(c, 'image/jpeg', 0.8);
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------- Recadrage ----------
// Monte un cadre déplaçable et redimensionnable sur une image affichée dans `host`.
export class Cropper {
  constructor(host, canvas) {
    this.host = host;
    this.canvas = canvas;
    host.innerHTML = '';
    host.classList.add('cropper');
    this.view = document.createElement('canvas');
    this.view.className = 'crop-img';
    this.box = document.createElement('div');
    this.box.className = 'crop-box';
    this.box.innerHTML = '<span class="h tl"></span><span class="h tr"></span><span class="h bl"></span><span class="h br"></span>';
    host.append(this.view, this.box);
    this.layout();
    this.reset();
    this.bind();
    this._ro = new ResizeObserver(() => { const r = this.getCrop(); this.layout(); this.setCrop(r); });
    this._ro.observe(host);
  }

  setCanvas(canvas) { this.canvas = canvas; this.layout(); this.reset(); }

  layout() {
    const W = this.host.clientWidth || 340, H = this.host.clientHeight || 300;
    const s = Math.min(W / this.canvas.width, H / this.canvas.height);
    this.s = s;
    this.dw = this.canvas.width * s; this.dh = this.canvas.height * s;
    this.dx = (W - this.dw) / 2; this.dy = (H - this.dh) / 2;
    const dpr = window.devicePixelRatio || 1;
    this.view.width = Math.round(this.dw * dpr); this.view.height = Math.round(this.dh * dpr);
    Object.assign(this.view.style, { left: this.dx + 'px', top: this.dy + 'px', width: this.dw + 'px', height: this.dh + 'px' });
    this.view.getContext('2d').drawImage(this.canvas, 0, 0, this.view.width, this.view.height);
  }

  reset() {
    const w = this.dw * 0.78, h = this.dh * 0.72;
    this.r = { x: this.dx + (this.dw - w) / 2, y: this.dy + (this.dh - h) / 2, w, h };
    this.draw();
  }

  full() { this.r = { x: this.dx, y: this.dy, w: this.dw, h: this.dh }; this.draw(); }

  draw() {
    Object.assign(this.box.style, { left: this.r.x + 'px', top: this.r.y + 'px', width: this.r.w + 'px', height: this.r.h + 'px' });
  }

  clamp() {
    const MIN = 50;
    const r = this.r;
    r.w = Math.max(MIN, Math.min(r.w, this.dw)); r.h = Math.max(MIN, Math.min(r.h, this.dh));
    r.x = Math.max(this.dx, Math.min(r.x, this.dx + this.dw - r.w));
    r.y = Math.max(this.dy, Math.min(r.y, this.dy + this.dh - r.h));
  }

  bind() {
    let mode = null, start = null, orig = null;
    const down = (e) => {
      const t = e.target;
      mode = t.classList.contains('h') ? [...t.classList].find((c) => c !== 'h') : 'move';
      start = { x: e.clientX, y: e.clientY }; orig = { ...this.r };
      this.box.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const move = (e) => {
      if (!mode) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const r = { ...orig };
      if (mode === 'move') { r.x += dx; r.y += dy; }
      else {
        if (mode.includes('l')) { r.x = orig.x + dx; r.w = orig.w - dx; }
        if (mode.includes('r')) { r.w = orig.w + dx; }
        if (mode.includes('t')) { r.y = orig.y + dy; r.h = orig.h - dy; }
        if (mode.includes('b')) { r.h = orig.h + dy; }
        // empêcher l'inversion du cadre
        if (r.w < 50) { if (mode.includes('l')) r.x = orig.x + orig.w - 50; r.w = 50; }
        if (r.h < 50) { if (mode.includes('t')) r.y = orig.y + orig.h - 50; r.h = 50; }
        // bords de l'image
        if (r.x < this.dx) { r.w -= this.dx - r.x; r.x = this.dx; }
        if (r.y < this.dy) { r.h -= this.dy - r.y; r.y = this.dy; }
        if (r.x + r.w > this.dx + this.dw) r.w = this.dx + this.dw - r.x;
        if (r.y + r.h > this.dy + this.dh) r.h = this.dy + this.dh - r.y;
      }
      this.r = r; this.clamp(); this.draw();
    };
    const up = () => { mode = null; };
    this.box.addEventListener('pointerdown', down);
    this.box.addEventListener('pointermove', move);
    this.box.addEventListener('pointerup', up);
    this.box.addEventListener('pointercancel', up);
  }

  // rectangle en pixels de la copie de travail
  getCrop() {
    return { x: (this.r.x - this.dx) / this.s, y: (this.r.y - this.dy) / this.s, w: this.r.w / this.s, h: this.r.h / this.s };
  }
  setCrop(c) {
    this.r = { x: this.dx + c.x * this.s, y: this.dy + c.y * this.s, w: c.w * this.s, h: c.h * this.s };
    this.clamp(); this.draw();
  }
  destroy() { this._ro?.disconnect(); }
}
