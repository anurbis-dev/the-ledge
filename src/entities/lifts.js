import { T, C } from '../core/constants.js';
import { runtime, mapIx, inMap } from '../core/runtime.js';
import { tileAt, isSolidV } from '../core/map.js';

export function mkLifts(){
  var LV = runtime.LV;
  return (LV.lifts || []).map(function(a, i){
    return { id:i, x:a.x, w:a.w, hh:a.hh, y:a.y, floors:(a.floors || []).slice(), idx:0,
             st:'dwell', t:C.LIFT_DWELL, dy:0, want:0 };
  });
}
export function buildGates(S){
  var map = {};
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i];
    var c0 = Math.floor(L.x / T), c1 = Math.floor((L.x + L.w - 1) / T);
    for (var f = 0; f < L.floors.length; f++){
      var R = Math.floor(L.floors[f] / T);
      // ворота — только дверные проёмы по бокам шахты, не её нутро
      var sides = [c0 - 1, c1 + 1];
      for (var si = 0; si < 2; si++){
        var c = sides[si];
        for (var r = R - 2; r <= R - 1; r++)
          if (inMap(c, r) && !isSolidV(tileAt(c, r))) map[mapIx(c, r)] = { lift: L, y: L.floors[f] };
      }
    }
  }
  S.gates = map;
}
export function gateClosed(c, r){
  var W = runtime.W;
  if (!W || !W.gates || !inMap(c, r)) return false;
  var g = W.gates[mapIx(c, r)];
  if (!g) return false;
  return Math.abs(g.lift.y - g.y) > 3;      // кабины нет на этаже -> проём закрыт
}
export function inLift(p, L){
  return p.x + p.w > L.x + 2 && p.x < L.x + L.w - 2 &&
         Math.abs((p.y + p.h) - L.y) < 4;
}
export function stepLifts(S, dt){
  var p = S.p;
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i], ride = inLift(p, L);
    if (L.st === 'dwell'){
      L.dy = 0;
      if (L.t > 0) L.t -= dt;
      var halfOut = p.x + p.w > L.x - 3 && p.x < L.x + L.w + 3 && !inLift(p, L);
      if (halfOut) L.want = 0;                       // не уезжаем, пока героиня в проёме
      if (L.t <= 0 && ride && L.want !== 0){
        var ni = L.idx + L.want;
        if (ni >= 0 && ni < L.floors.length){ L.idx = ni; L.st = 'move'; }
        L.want = 0;
      }
      if (!ride) L.want = 0;
    } else {
      var tgt = L.floors[L.idx], d = tgt - L.y;
      var stp = C.LIFT_V * dt;
      if (Math.abs(d) <= stp){ L.dy = d; L.y = tgt; L.st = 'dwell'; L.t = C.LIFT_DWELL; L.want = 0; S.p.events.push('liftstop'); }
      else { L.dy = (d > 0 ? stp : -stp); L.y += L.dy; }
    }
  }
}
export function liftSideOpen(L, side){                     // side: -1 влево, 1 вправо
  var c0 = Math.floor(L.x / T) - 1, c1 = Math.floor((L.x + L.w - 1) / T) + 1;
  var c = side < 0 ? c0 : c1;
  var r = Math.floor(L.y / T);
  if (Math.abs(L.y - Math.round(L.y)) > 0.5) return false;
  return isSolidV(tileAt(c, r)) && !isSolidV(tileAt(c, r - 1)) && !isSolidV(tileAt(c, r - 2));
}
export function liftConstrain(S){
  var p = S.p;
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i];
    if (!inLift(p, L)) continue;
    if (L.st === 'dwell'){                           // стоим: открыта только рабочая сторона
      if (p.x < L.x + 1 && !liftSideOpen(L, -1)){ p.x = L.x + 1; if (p.vx < 0) p.vx = 0; }
      if (p.x + p.w > L.x + L.w - 1 && !liftSideOpen(L, 1)){
        p.x = L.x + L.w - 1 - p.w; if (p.vx > 0) p.vx = 0;
      }
      continue;
    }
    if (p.x < L.x + 1){ p.x = L.x + 1; if (p.vx < 0) p.vx = 0; }
    if (p.x + p.w > L.x + L.w - 1){ p.x = L.x + L.w - 1 - p.w; if (p.vx > 0) p.vx = 0; }
  }
}

import { hooks } from '../core/runtime.js';
hooks.gateClosed = gateClosed;
