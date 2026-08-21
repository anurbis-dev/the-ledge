import { T, C } from '../core/constants.js';
import { runtime, mapIx, inMap } from '../core/runtime.js';
import { tileAt, isSolidV } from '../core/map.js';
import { allocId } from './ids.js';

export var LIFT_DEF = {
  w: 48,
  hh: 34,
  v: null,              /* null → C.LIFT_V */
  dwell: null,          /* null → C.LIFT_DWELL; пауза на каждом этаже */
  travel: 'pingpong',   /* pingpong | oneway */
  loop: 'infinite',     /* infinite | once */
  trigger: 'call',      /* call | auto | ride */
  onLeave: 'stay',      /* stay | return */
  homeIdx: 0,
  floorSpan: 6          /* тайлов между этажами при постановке */
};

function liftSpeed(L){
  return L.v != null && Number.isFinite(L.v) ? L.v : C.LIFT_V;
}

function liftDwell(L){
  return L.dwell != null && Number.isFinite(L.dwell) ? L.dwell : C.LIFT_DWELL;
}

function sortFloors(floors){
  return (floors || []).slice().sort(function(a, b){ return b - a; });
}

export function normLift(a, i){
  var floors = sortFloors(a.floors && a.floors.length ? a.floors : [a.y != null ? a.y : 0]);
  if (floors.length < 2) floors.push(floors[0] - LIFT_DEF.floorSpan * T);
  floors = sortFloors(floors);
  var homeIdx = a.homeIdx != null ? a.homeIdx : LIFT_DEF.homeIdx;
  if (homeIdx < 0) homeIdx = 0;
  if (homeIdx >= floors.length) homeIdx = 0;
  var y = a.y != null ? a.y : floors[homeIdx];
  return {
    id: a.id != null ? a.id : i,
    x: a.x != null ? a.x : 0,
    w: a.w != null ? a.w : LIFT_DEF.w,
    hh: a.hh != null ? a.hh : LIFT_DEF.hh,
    y: y,
    floors: floors,
    idx: a.idx != null ? a.idx : homeIdx,
    st: a.st || 'dwell',
    t: a.t != null ? a.t : liftDwell({ dwell: a.dwell }),
    dy: 0,
    want: 0,
    v: a.v != null ? a.v : LIFT_DEF.v,
    dwell: a.dwell != null ? a.dwell : LIFT_DEF.dwell,
    travel: a.travel || LIFT_DEF.travel,
    loop: a.loop || LIFT_DEF.loop,
    trigger: a.trigger || LIFT_DEF.trigger,
    onLeave: a.onLeave || LIFT_DEF.onLeave,
    homeIdx: homeIdx,
    dir: a.dir != null ? a.dir : 1,
    done: !!a.done,
    wasRide: false
  };
}

export function mkLifts(){
  var LV = runtime.LV;
  return (LV.lifts || []).map(normLift);
}

export function mkLiftAt(S, x, y){
  var yy = Math.round(y);
  var raw = {
    x: Math.round(x - LIFT_DEF.w / 2),
    w: LIFT_DEF.w,
    hh: LIFT_DEF.hh,
    y: yy,
    floors: [yy, yy - LIFT_DEF.floorSpan * T],
    v: LIFT_DEF.v,
    dwell: LIFT_DEF.dwell,
    travel: LIFT_DEF.travel,
    loop: LIFT_DEF.loop,
    trigger: LIFT_DEF.trigger,
    onLeave: LIFT_DEF.onLeave,
    homeIdx: 0
  };
  if (!S.lifts) S.lifts = [];
  raw.id = allocId(S.lifts);
  var L = normLift(raw, raw.id);
  S.lifts.push(L);
  return L;
}

export function packLift(L){
  var floors = sortFloors(L.floors || []);
  return {
    id: L.id,
    x: L.x,
    w: L.w,
    hh: L.hh,
    y: floors.length ? floors[L.homeIdx != null ? L.homeIdx : 0] : L.y,
    floors: floors,
    v: L.v,
    dwell: L.dwell,
    travel: L.travel || LIFT_DEF.travel,
    loop: L.loop || LIFT_DEF.loop,
    trigger: L.trigger || LIFT_DEF.trigger,
    onLeave: L.onLeave || LIFT_DEF.onLeave,
    homeIdx: L.homeIdx != null ? L.homeIdx : 0
  };
}

export function syncLiftFloors(L){
  L.floors = sortFloors(L.floors || []);
  if (L.floors.length < 1) L.floors = [Math.round(L.y)];
  if (L.idx < 0) L.idx = 0;
  if (L.idx >= L.floors.length) L.idx = L.floors.length - 1;
  if (L.homeIdx < 0) L.homeIdx = 0;
  if (L.homeIdx >= L.floors.length) L.homeIdx = 0;
  if (L.st === 'dwell') L.y = L.floors[L.idx];
}

export function buildGates(S){
  var map = {};
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i];
    var c0 = Math.floor(L.x / T), c1 = Math.floor((L.x + L.w - 1) / T);
    for (var f = 0; f < L.floors.length; f++){
      var R = Math.floor(L.floors[f] / T);
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
  return Math.abs(g.lift.y - g.y) > 3;
}

export function inLift(p, L){
  return p.x + p.w > L.x + 2 && p.x < L.x + L.w - 2 &&
         Math.abs((p.y + p.h) - L.y) < 4;
}

function nextIdx(L, dir){
  var n = L.floors.length;
  if (n < 2) return L.idx;
  var ni = L.idx + dir;
  if ((L.travel || 'pingpong') === 'oneway'){
    if (ni >= n){
      if ((L.loop || 'infinite') === 'once'){ L.done = true; return L.idx; }
      return 0; /* сброс на home/низ */
    }
    if (ni < 0) return 0;
    return ni;
  }
  if (ni >= n){ L.dir = -1; return n - 2 >= 0 ? n - 2 : 0; }
  if (ni < 0){ L.dir = 1; return 1 < n ? 1 : 0; }
  return ni;
}

function startMoveTo(L, ni){
  if (ni === L.idx || ni < 0 || ni >= L.floors.length) return false;
  L.idx = ni;
  L.st = 'move';
  L.want = 0;
  return true;
}

export function stepLifts(S, dt){
  var p = S.p;
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i], ride = inLift(p, L);
    var left = L.wasRide && !ride;
    L.wasRide = ride;

    if (L.done && L.st === 'dwell'){ L.dy = 0; continue; }

    if (left && (L.onLeave || 'stay') === 'return' && L.st === 'dwell'){
      var home = L.homeIdx != null ? L.homeIdx : 0;
      if (L.idx !== home) startMoveTo(L, home);
    }

    if (L.st === 'dwell'){
      L.dy = 0;
      if (L.t > 0) L.t -= dt;
      var halfOut = p.x + p.w > L.x - 3 && p.x < L.x + L.w + 3 && !ride;
      if (halfOut) L.want = 0;

      var trig = L.trigger || 'call';
      if (trig === 'call'){
        if (L.t <= 0 && ride && L.want !== 0){
          var ni = nextIdx(L, L.want);
          if (!L.done) startMoveTo(L, ni);
          L.want = 0;
        }
        if (!ride) L.want = 0;
      } else if (trig === 'auto'){
        if (L.t <= 0 && !L.done){
          if (!L.dir) L.dir = 1;
          var ai = nextIdx(L, L.dir);
          if (!L.done) startMoveTo(L, ai);
        }
      } else if (trig === 'ride'){
        if (L.t <= 0 && ride && !L.done){
          if (!L.dir) L.dir = 1;
          var ri = nextIdx(L, L.dir);
          if (!L.done) startMoveTo(L, ri);
        }
      }
    } else {
      var tgt = L.floors[L.idx], d = tgt - L.y;
      var stp = liftSpeed(L) * dt;
      if (Math.abs(d) <= stp){
        L.dy = d; L.y = tgt; L.st = 'dwell'; L.t = liftDwell(L); L.want = 0;
        S.p.events.push('liftstop');
        if ((L.travel || 'pingpong') === 'oneway' && L.idx === L.floors.length - 1
            && (L.loop || 'infinite') === 'once') L.done = true;
      } else {
        L.dy = (d > 0 ? stp : -stp); L.y += L.dy;
      }
    }
  }
}

export function liftSideOpen(L, side){
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
    if (L.st === 'dwell'){
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
