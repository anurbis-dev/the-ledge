import { ctx, VW, VH, cam, rc } from './ctx.js';

export var FOLD_AXIS = 0.15;

export function foldEase(t){
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

export function foldScales(f, pw){
  var e = 2 / Math.max(2, pw);
  if (f <= 0) return { sx: 0, sy: 0 };
  if (f < 1) return { sx: e, sy: foldEase(f) };
  if (f < 2) return { sx: e + (1 - e) * foldEase(f - 1), sy: 1 };
  return { sx: 1, sy: 1 };
}

export function foldHeroOrigin(S){
  if (!S || !S.p) return { x: VW / 2, y: VH / 2 };
  return { x: S.p.x + S.p.w / 2 - cam.x, y: S.p.y + S.p.h / 2 - cam.y };
}

export function foldBlit(src, pw, ph, ox, oy, px, py, fold){
  var sc = foldScales(fold, pw);
  if (sc.sx <= 0 || sc.sy <= 0) return;
  var dw = Math.max(1, Math.round(pw * sc.sx));
  var dh = Math.max(1, Math.round(ph * sc.sy));
  if (dw < 2 || dh < 2) return;
  var dx = Math.round(ox + (px - ox) * sc.sx);
  var dy = Math.round(oy + (py - oy) * sc.sy);
  // узкий nearest-neighbor блит панели — шум; рисуем складку
  if (dw < 8){
    rc(dx, dy, dw, dh, '#6a5fa8');
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, pw, ph, dx, dy, dw, dh);
}
