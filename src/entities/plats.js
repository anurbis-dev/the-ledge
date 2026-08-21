import { runtime } from '../core/runtime.js';
import { rectFree } from '../core/map.js';
import { allocId } from './ids.js';
import { T } from '../core/constants.js';

export var PLAT_DEF = {
  w: 38,
  h: 8,
  v: 30,
  pause0: 0,
  pause1: 0,
  travel: 'pingpong',   /* pingpong | oneway */
  loop: 'infinite',     /* infinite | once */
  trigger: 'auto',      /* auto | ride */
  onLeave: 'continue',  /* continue | return | stop */
  dir: 1,
  spanTiles: 4
};

function pick(a, key, d){
  return a && a[key] != null ? a[key] : d;
}

/** A = min (x0/y0), B = max (x1/y1). Старт по умолчанию в A. */
export function normPlat(a, i){
  var vert = !!(a && a.vert);
  var x = a.x != null ? a.x : 0;
  var y = a.y != null ? a.y : 0;
  var x0 = a.x0 !== undefined ? a.x0 : x;
  var x1 = a.x1 !== undefined ? a.x1 : x;
  var y0 = a.y0 !== undefined ? a.y0 : y;
  var y1 = a.y1 !== undefined ? a.y1 : y;
  if (!vert){
    if (x1 < x0){ var tx = x0; x0 = x1; x1 = tx; }
    y0 = y; y1 = y;
  } else {
    if (y1 < y0){ var ty = y0; y0 = y1; y1 = ty; }
    x0 = x; x1 = x;
  }
  return {
    id: a.id != null ? a.id : i,
    x: x, y: y,
    w: pick(a, 'w', PLAT_DEF.w),
    h: pick(a, 'h', PLAT_DEF.h),
    x0: x0, x1: x1, y0: y0, y1: y1,
    v: pick(a, 'v', PLAT_DEF.v),
    dir: a.dir != null ? a.dir : PLAT_DEF.dir,
    vert: vert,
    pause0: pick(a, 'pause0', PLAT_DEF.pause0),
    pause1: pick(a, 'pause1', PLAT_DEF.pause1),
    travel: a.travel || PLAT_DEF.travel,
    loop: a.loop || PLAT_DEF.loop,
    trigger: a.trigger || PLAT_DEF.trigger,
    onLeave: a.onLeave || PLAT_DEF.onLeave,
    dx: 0, dy: 0,
    st: a.st || 'move',
    pauseT: a.pauseT || 0,
    done: !!a.done,
    wasRide: false
  };
}

export function mkPlats(){
  var LV = runtime.LV;
  return (LV.plats || []).map(normPlat);
}

export function mkPlatAt(S, x, y, vert){
  vert = !!vert;
  var span = PLAT_DEF.spanTiles * T;
  var cx = Math.round(x - PLAT_DEF.w / 2);
  var cy = Math.round(y);
  var raw = vert
    ? {
        x: cx, y: cy, w: PLAT_DEF.w, h: PLAT_DEF.h,
        x0: cx, x1: cx, y0: cy, y1: cy + span,
        vert: true, v: PLAT_DEF.v, dir: 1
      }
    : {
        x: cx, y: cy, w: PLAT_DEF.w, h: PLAT_DEF.h,
        x0: cx, x1: cx + span, y0: cy, y1: cy,
        vert: false, v: PLAT_DEF.v, dir: 1
      };
  if (!S.plats) S.plats = [];
  raw.id = allocId(S.plats);
  var q = normPlat(raw, raw.id);
  S.plats.push(q);
  return q;
}

export function packPlat(q){
  return {
    id: q.id,
    x: q.vert ? q.x : (q.x0 != null ? q.x0 : q.x),
    y: q.vert ? (q.y0 != null ? q.y0 : q.y) : q.y,
    w: q.w, h: q.h,
    x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1,
    v: q.v, dir: q.dir != null ? q.dir : 1, vert: !!q.vert,
    pause0: q.pause0 != null ? q.pause0 : PLAT_DEF.pause0,
    pause1: q.pause1 != null ? q.pause1 : PLAT_DEF.pause1,
    travel: q.travel || PLAT_DEF.travel,
    loop: q.loop || PLAT_DEF.loop,
    trigger: q.trigger || PLAT_DEF.trigger,
    onLeave: q.onLeave || PLAT_DEF.onLeave
  };
}

function ridingPlat(S, q){
  var p = S && S.p;
  if (!p) return false;
  if (p.ride === q) return true;
  return !!p.onGround && p.x + p.w > q.x + 1 && p.x < q.x + q.w - 1
    && Math.abs((p.y + p.h) - q.y) < 5;
}

function atA(q){
  return q.vert ? Math.abs(q.y - q.y0) <= 0.6 : Math.abs(q.x - q.x0) <= 0.6;
}

function atB(q){
  return q.vert ? Math.abs(q.y - q.y1) <= 0.6 : Math.abs(q.x - q.x1) <= 0.6;
}

function beginPause(q, atBSide){
  var t = atBSide ? (q.pause1 || 0) : (q.pause0 || 0);
  q.st = 'pause';
  q.pauseT = t > 0 ? t : 0;
  if (q.pauseT <= 0) q.st = 'move';
}

function resetToA(q){
  if (q.vert){ q.dy = q.y0 - q.y; q.y = q.y0; }
  else { q.dx = q.x0 - q.x; q.x = q.x0; }
  q.dir = 1;
  beginPause(q, false);
}

function onHitEnd(q, hitB){
  if ((q.travel || 'pingpong') === 'oneway'){
    if (hitB){
      if ((q.loop || 'infinite') === 'once'){ q.done = true; q.dx = 0; q.dy = 0; return; }
      resetToA(q);
    } else {
      q.dir = 1;
      beginPause(q, false);
    }
    return;
  }
  /* pingpong */
  q.dir = hitB ? -1 : 1;
  beginPause(q, hitB);
}

export function stepPlats(S, dt){
  for (var i = 0; i < S.plats.length; i++){
    var q = S.plats[i];
    q.dx = 0; q.dy = 0;
    if (q.done) continue;

    var ride = ridingPlat(S, q);
    var left = q.wasRide && !ride;
    q.wasRide = ride;

    if (ride && q.pauseT >= 1e8){
      /* спрыгнули со stop — снова встали: продолжить */
      q.pauseT = 0; q.st = 'move';
    }

    if (left){
      if (q.onLeave === 'stop'){
        q.st = 'pause'; q.pauseT = 1e9;
        continue;
      }
      if (q.onLeave === 'return'){
        q.dir = q.vert ? (q.y > q.y0 ? -1 : 1) : (q.x > q.x0 ? -1 : 1);
        q.st = 'move'; q.pauseT = 0; q.done = false;
      }
    }

    var needRide = (q.trigger || 'auto') === 'ride';
    if (needRide && !ride){
      if (q.onLeave === 'return' && !atA(q) && q.st === 'move'){
        /* едем домой без райдера */
      } else {
        continue;
      }
    }

    if (q.st === 'pause'){
      if (q.pauseT >= 1e8) continue;
      q.pauseT -= dt;
      if (q.pauseT > 0) continue;
      q.st = 'move';
      if (needRide && !ride && q.onLeave !== 'return') continue;
    }

    if (q.vert){
      var ny = q.y + q.v * q.dir * dt;
      var hit = false, hitB = false;
      if (ny >= q.y1){ ny = q.y1; hit = true; hitB = true; }
      if (ny <= q.y0){ ny = q.y0; hit = true; hitB = false; }
      if (!rectFree(q.x, ny - 1, q.w, q.h + 1)){ ny = q.y; q.dir = -q.dir; hit = false; }
      q.dy = ny - q.y; q.y = ny;
      if (hit) onHitEnd(q, hitB);
    } else {
      var nx = q.x + q.v * q.dir * dt;
      var hitX = false, hitBX = false;
      if (nx >= q.x1){ nx = q.x1; hitX = true; hitBX = true; }
      if (nx <= q.x0){ nx = q.x0; hitX = true; hitBX = false; }
      if (!rectFree(nx, q.y, q.w, q.h)){ nx = q.x; q.dir = -q.dir; hitX = false; }
      q.dx = nx - q.x; q.x = nx;
      if (hitX) onHitEnd(q, hitBX);
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
