import { T, E, ROCK, CRUMB, LADW, LADF, LADR, LADL, HTOP, BAR, SLR, SLL, RNDA, RNDB, WATER, FALL } from './constants.js';
import { runtime, hooks } from './runtime.js';

export function fillR(c, r, w, h, v){
  v = v === undefined ? ROCK : v;
  for (var y = r; y < r + h; y++)
    for (var x = c; x < c + w; x++)
      if (x >= 0 && y >= 0 && x < runtime.MAP_W && y < runtime.MAP_H) runtime.base[y * runtime.MAP_W + x] = v;
}
export function slopeRun(c, r, n, dir, downTo){        // косой уступ с телом под ним
  for (var i = 0; i < n; i++){
    var cc = c + dir*i, rr = r - i;
    if (cc < 0 || cc >= runtime.MAP_W || rr < 0) continue;
    fillR(cc, rr, 1, 1, dir > 0 ? LADR : LADL);
    for (var k = rr + 1; k <= downTo; k++) fillR(cc, k, 1, 1, ROCK);
  }
}
export function line(c, r, n, dc, dr, v){ for (var i = 0; i < n; i++) fillR(c + dc*i, r + dr*i, 1, 1, v); }

export function tileAt(c, r){
  if (c < 0 || c >= runtime.MAP_W) return ROCK;
  if (r < 0 || r >= runtime.MAP_H) return E;
  return runtime.base[r * runtime.MAP_W + c];
}
export function isSolidV(v){ return v === ROCK || v === CRUMB || v === HTOP || v === RNDA || v === RNDB; }
export function isSlopeV(v){ return v === SLR || v === SLL || v === LADR || v === LADL; }
export function isWaterV(v){ return v === WATER; }          // плавание только в бассейнах
export function isFlowV(v){ return v === FALL; }            // падающая вода — не жидкость для физики
export function isWetV(v){ return v === WATER || v === FALL; }
/* высота поверхности скоса внутри тайла: 0 у высокого края, T у низкого */
export function slopeTop(v, c, px){
  var f = (px - c*T) / T;
  if (f < 0) f = 0; if (f > 1) f = 1;
  var up = (v === SLR || v === LADR);        // поднимается вправо
  return up ? (T - f*T) : (f*T);
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
  if (v === CRUMB && runtime.W && runtime.W.gone[r * runtime.MAP_W + c] > 0) return false;
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
