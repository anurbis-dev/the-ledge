import {
  T, E, ROCK, CRUMB, LADW, LADF, LADR, LADL, HTOP, BAR, SLR, SLL, RNDA, RNDB, WATER, FALL,
  SLR2, SLR3, SLL2, SLL3, SLR4A, SLR4B, SLR4C, SLR4D, SLL4A, SLL4B, SLL4C, SLL4D,
  SLRCA, SLRCB, SLLCB, SLLCA
} from './constants.js';
import { runtime, hooks, inMap, mapIx } from './runtime.js';

function spec(y0, y1, ease){ return { y0: y0, y1: y1, ease: ease || 0 }; }

export const SLOPE_SPEC = {};
SLOPE_SPEC[SLR] = spec(T, 0);
SLOPE_SPEC[SLL] = spec(0, T);
SLOPE_SPEC[LADR] = spec(T, 0);
SLOPE_SPEC[LADL] = spec(0, T);
SLOPE_SPEC[SLR2] = spec(T, T / 2);
SLOPE_SPEC[SLR3] = spec(T / 2, 0);
SLOPE_SPEC[SLL2] = spec(0, T / 2);
SLOPE_SPEC[SLL3] = spec(T / 2, T);
SLOPE_SPEC[SLR4A] = spec(T, 12);
SLOPE_SPEC[SLR4B] = spec(12, 8);
SLOPE_SPEC[SLR4C] = spec(8, 4);
SLOPE_SPEC[SLR4D] = spec(4, 0);
SLOPE_SPEC[SLL4A] = spec(0, 4);
SLOPE_SPEC[SLL4B] = spec(4, 8);
SLOPE_SPEC[SLL4C] = spec(8, 12);
SLOPE_SPEC[SLL4D] = spec(12, T);
SLOPE_SPEC[SLRCA] = spec(T, T / 2, 'in');
SLOPE_SPEC[SLRCB] = spec(T / 2, 0, 'out');
SLOPE_SPEC[SLLCB] = spec(0, T / 2, 'in');
SLOPE_SPEC[SLLCA] = spec(T / 2, T, 'out');

export const SLOPE_SEQ = {
  45: { r: [SLR], l: [SLL] },
  2: { r: [SLR2, SLR3], l: [SLL2, SLL3] },
  4: { r: [SLR4A, SLR4B, SLR4C, SLR4D], l: [SLL4A, SLL4B, SLL4C, SLL4D] },
  curve: { r: [SLRCA, SLRCB], l: [SLLCB, SLLCA] }
};

export function slopeSpec(v){ return SLOPE_SPEC[v] || null; }
export function slopeFamily(v){
  if (v === SLR || v === SLL || v === LADR || v === LADL) return '45';
  if (v === SLR2 || v === SLR3 || v === SLL2 || v === SLL3) return '2';
  if (v === SLRCA || v === SLRCB || v === SLLCA || v === SLLCB) return 'curve';
  if (SLOPE_SPEC[v]) return '4';
  return null;
}
export function slopeRiseRight(v){
  var s = SLOPE_SPEC[v];
  return !!(s && s.y1 < s.y0);
}
function easeF(f, ease){
  if (ease === 'in') return f * f;
  if (ease === 'out') return 1 - (1 - f) * (1 - f);
  return f;
}

export function fillR(c, r, w, h, v){
  v = v === undefined ? ROCK : v;
  for (var y = r; y < r + h; y++)
    for (var x = c; x < c + w; x++)
      if (inMap(x, y)) runtime.base[mapIx(x, y)] = v;
}
export function varR(c, r, w, h, v){                  // ручной узор рисунка (см. varAt) поверх прямоугольника
  for (var y = r; y < r + h; y++)
    for (var x = c; x < c + w; x++)
      if (inMap(x, y)) runtime.vary[mapIx(x, y)] = v;
}
export function slopeRun(c, r, n, dir, downTo){        // косой уступ с телом под ним
  for (var i = 0; i < n; i++){
    var cc = c + dir*i, rr = r - i;
    if (!inMap(cc, rr)) continue;
    fillR(cc, rr, 1, 1, dir > 0 ? LADR : LADL);
    for (var k = rr + 1; k <= downTo; k++) fillR(cc, k, 1, 1, ROCK);
  }
}
export function line(c, r, n, dc, dr, v){ for (var i = 0; i < n; i++) fillR(c + dc*i, r + dr*i, 1, 1, v); }

export function tileAt(c, r){
  if (!inMap(c, r)) return E;
  var ls = runtime.layers, ix = mapIx(c, r);
  if (!ls || !ls.length) return runtime.base[ix];
  var i, v, found = false;
  for (i = ls.length - 1; i >= 0; i--){
    if (!ls[i].collide || !ls[i].base) continue;
    found = true;
    v = ls[i].base[ix];
    if (v) return v;
  }
  return found ? E : runtime.base[ix];
}
/* 0 — авто-узор по хэшу позиции, 1..N — узор, выбранный вручную в редакторе */
export function varAt(c, r){
  if (!inMap(c, r)) return 0;
  var ls = runtime.layers, ix = mapIx(c, r);
  if (!ls || !ls.length) return runtime.vary[ix];
  var i;
  for (i = ls.length - 1; i >= 0; i--){
    if (!ls[i].collide || !ls[i].base) continue;
    if (ls[i].base[ix]) return ls[i].vary ? ls[i].vary[ix] : 0;
  }
  return runtime.vary[ix];
}
export function isSolidV(v){ return v === ROCK || v === CRUMB || v === HTOP || v === RNDA || v === RNDB; }
export function isSlopeV(v){ return !!SLOPE_SPEC[v]; }
export function isWaterV(v){ return v === WATER; }          // плавание только в бассейнах
export function isFlowV(v){ return v === FALL; }            // падающая вода — не жидкость для физики
export function isWetV(v){ return v === WATER || v === FALL; }
/* высота поверхности скоса внутри тайла: 0 у верха тайла, T у низа */
export function slopeTop(v, c, px){
  var s = SLOPE_SPEC[v];
  if (!s) return 0;
  var f = (px - c*T) / T;
  if (f < 0) f = 0; if (f > 1) f = 1;
  return s.y0 + (s.y1 - s.y0) * easeF(f, s.ease);
}
/* |dy/dx| в точке — для скорости вдоль склона */
export function slopeGrade(v, c, px){
  var s = SLOPE_SPEC[v];
  if (!s) return 0;
  var f = (px - c*T) / T;
  if (f < 0) f = 0; if (f > 1) f = 1;
  var df = 1;
  if (s.ease === 'in') df = 2 * f;
  else if (s.ease === 'out') df = 2 * (1 - f);
  return Math.abs(s.y1 - s.y0) / T * df;
}
export function slopeSurfaceY(c, r, px){
  var v = tileAt(c, r);
  if (!isSlopeV(v)) return null;
  return r*T + slopeTop(v, c, px);
}
export function isHalfV(v){ return v === HTOP; }        // твёрдая только верхняя половина тайла
export function isBarV(v){ return v === BAR; }
export function isLadV(v){ return v === LADW || v === LADF; }   // диагонали теперь склоны

export function solidTile(c, r){
  var v = tileAt(c, r);
  if (!isSolidV(v)) return hooks.gateClosed(c, r);
  if (v === CRUMB && runtime.W && runtime.W.gone[mapIx(c, r)] > 0) return false;
  return true;
}
export function ladderTile(c, r){ return isLadV(tileAt(c, r)); }
export function ladderTop(c, r){                        // верхняя перекладина держит как земля
  var v = tileAt(c, r);
  if (v !== LADW && v !== LADF) return false;
  return !isLadV(tileAt(c, r - 1));
}
export function solidAt(px, py){ return solidTile(Math.floor(px / T), Math.floor(py / T)); }
export function ladderAt(px, py){ return ladderTile(Math.floor(px / T), Math.floor(py / T)); }
export function tileBlocks(c, r, y, h){
  var v = tileAt(c, r);
  if (isHalfV(v)) return y < r*T + 8;            // занята только верхняя половина
  if (isSlopeV(v)) return false;                 // скос не блокирует — работает как поверхность
  return solidTile(c, r);
}
/* высота земли под точкой с учётом скосов */
export function waterSurfaceY(px, py){
  var c = Math.floor(px / T), r = Math.floor(py / T);
  if (!isWaterV(tileAt(c, r))) return null;
  while (r > 0 && isWaterV(tileAt(c, r - 1))) r--;
  return r * T;
}
export function groundYAt(px, py){
  var c = Math.floor(px / T), r = Math.floor(py / T);
  for (var k = 0; k < 2; k++){
    var rr = r + k, v = tileAt(c, rr);
    if (isSlopeV(v)){
      var sy = rr*T + slopeTop(v, c, px);
      if (py <= sy + 2) return sy;
    }
    if (solidTile(c, rr)) return rr*T;
  }
  return null;
}
export function rectFree(x, y, w, h){
  var c0 = Math.floor(x/T), c1 = Math.floor((x+w-1)/T), r0 = Math.floor(y/T), r1 = Math.floor((y+h-1)/T);
  for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) if (tileBlocks(c, r, y, h)) return false;
  return true;
}
