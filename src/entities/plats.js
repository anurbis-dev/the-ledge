import { runtime } from '../core/runtime.js';
import { rectFree } from '../core/map.js';

export function mkPlats(){
  var LV = runtime.LV;
  return (LV.plats || []).map(function(a){
    return { x:a.x, y:a.y, w:a.w, h:a.h,
             x0:a.x0 !== undefined ? a.x0 : a.x, x1:a.x1 !== undefined ? a.x1 : a.x,
             y0:a.y0 !== undefined ? a.y0 : a.y, y1:a.y1 !== undefined ? a.y1 : a.y,
             v:a.v, dir:a.dir, dx:0, dy:0, vert: !!a.vert };
  });
}
export function stepPlats(S, dt){
  for (var i = 0; i < S.plats.length; i++){
    var q = S.plats[i];
    if (q.vert){
      var ny = q.y + q.v * q.dir * dt;
      if (ny > q.y1){ ny = q.y1; q.dir = -1; }
      if (ny < q.y0){ ny = q.y0; q.dir = 1; }
      if (!rectFree(q.x, ny - 1, q.w, q.h + 1)){ ny = q.y; q.dir = -q.dir; }   // не вминаться в тайлы
      q.dy = ny - q.y; q.y = ny; q.dx = 0;
    } else {
      var nx = q.x + q.v * q.dir * dt;
      if (nx > q.x1){ nx = q.x1; q.dir = -1; }
      if (nx < q.x0){ nx = q.x0; q.dir = 1; }
      if (!rectFree(nx, q.y, q.w, q.h)){ nx = q.x; q.dir = -q.dir; }
      q.dx = nx - q.x; q.x = nx; q.dy = 0;
    }
  }
}
export function platUnder(S, p, probeY){
  var i, q;
  for (i = 0; i < S.plats.length; i++){
    q = S.plats[i];
    if (p.x + p.w > q.x + 1 && p.x < q.x + q.w - 1 && probeY >= q.y - 1 && probeY <= q.y + q.h) return q;
  }
  for (i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i];
    if (p.x + p.w > L.x + 1 && p.x < L.x + L.w - 1 && probeY >= L.y - 1 && probeY <= L.y + 8) return L;
  }
  return null;
}
