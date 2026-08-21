import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { allocId, findById } from './ids.js';
import { dropTorch } from './torches.js';
import { setStance } from '../core/player.js';

export var ROPE_DEF = {
  segs: 8,
  elasticity: 0.12,
  swingForce: 160,
  damping: 0.98,
  wind: 2.2,
  climbV: 52,
  grabR: 14,
  /* H: множитель к span при создании; абсолютная length хранится в r.length */
  slack: 1.18
};

function defOf(r, key){
  if (r[key] != null && Number.isFinite(r[key])) return r[key];
  if (C['ROPE_' + key.toUpperCase()] != null) return C['ROPE_' + key.toUpperCase()];
  var map = {
    segs: C.ROPE_SEGS, elasticity: C.ROPE_ELAST, swingForce: C.ROPE_SWING,
    damping: C.ROPE_DAMP, wind: C.ROPE_WIND, climbV: C.ROPE_CLIMB, grabR: C.ROPE_GRAB
  };
  return map[key] != null ? map[key] : ROPE_DEF[key];
}

function dist(ax, ay, bx, by){
  var dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy) || 0.0001;
}

function normalizeEnds(r){
  if (r.orient === 'h' && r.ax > r.bx){
    var tx = r.ax, ty = r.ay;
    r.ax = r.bx; r.ay = r.by; r.bx = tx; r.by = ty;
  }
  if (r.orient === 'v' && r.ay > r.by){
    var sx = r.ax, sy = r.ay;
    r.ax = r.bx; r.ay = r.by; r.bx = sx; r.by = sy;
  }
}

/** Span между якорями; для H — нижняя граница length. */
export function ropeSpan(r){
  return dist(r.ax, r.ay, r.bx, r.by);
}

/** Полная длина каната (px). V = span; H = max(span, r.length). */
export function ropeLength(r){
  var span = ropeSpan(r);
  if (r.orient !== 'h') return span;
  var len = r.length != null && Number.isFinite(r.length) ? r.length : span * ROPE_DEF.slack;
  if (len < span) len = span;
  return len;
}

export function rebuildRope(r){
  normalizeEnds(r);
  var segs = Math.max(4, Math.min(24, (r.segs != null ? r.segs : defOf(r, 'segs')) | 0));
  r.segs = segs;
  var n = segs + 1, nodes = [], i, t, x, y;
  var span = ropeSpan(r);
  var minSpan = T * 2;
  if (span < minSpan){
    if (r.orient === 'v'){ r.bx = r.ax; r.by = r.ay + minSpan; }
    else { r.bx = r.ax + minSpan; r.by = r.ay; }
    span = minSpan;
  }
  var len = span;
  if (r.orient === 'h'){
    if (r.length == null || !Number.isFinite(r.length) || r.length < span)
      r.length = Math.max(span, span * ROPE_DEF.slack);
    len = r.length;
    if (len < span){ len = span; r.length = span; }
  } else {
    /* V: длина задаётся нижним хэндлом */
    r.length = span;
  }
  r.rest = len / segs;
  /* начальная форма: H с провисом — парабола; иначе прямая */
  var sag = 0;
  if (r.orient === 'h' && len > span + 0.5){
    var half = span * 0.5;
    var halfL = len * 0.5;
    sag = halfL > half ? Math.sqrt(halfL * halfL - half * half) * 0.92 : (len - span) * 0.35;
  }
  for (i = 0; i < n; i++){
    t = i / segs;
    x = r.ax + (r.bx - r.ax) * t;
    y = r.ay + (r.by - r.ay) * t + 4 * sag * t * (1 - t);
    nodes.push({
      x: x, y: y, ox: x, oy: y,
      pinned: r.orient === 'h' ? (i === 0 || i === n - 1) : (i === 0)
    });
  }
  r.nodes = nodes;
  r.ph = (r.id || 0) * 1.37;
  r._lenKey = segs + ':' + r.ax + ',' + r.ay + ',' + r.bx + ',' + r.by + ':' + (r.length | 0);
  return r;
}

function ensureNodes(r){
  var key = (r.segs | 0) + ':' + r.ax + ',' + r.ay + ',' + r.bx + ',' + r.by + ':' + ((r.length | 0) || 0);
  if (!r.nodes || !r.nodes.length || r._lenKey !== key) rebuildRope(r);
}

function mkOne(id, orient, ax, ay, bx, by, opts){
  opts = opts || {};
  var r = {
    id: id,
    orient: orient === 'h' ? 'h' : 'v',
    ax: ax, ay: ay, bx: bx, by: by,
    segs: opts.segs != null ? opts.segs : ROPE_DEF.segs,
    elasticity: opts.elasticity != null ? opts.elasticity : ROPE_DEF.elasticity,
    swingForce: opts.swingForce != null ? opts.swingForce : ROPE_DEF.swingForce,
    damping: opts.damping, wind: opts.wind, climbV: opts.climbV, grabR: opts.grabR,
    length: opts.length,
    rider: false, active: false
  };
  return rebuildRope(r);
}

export function packRope(r){
  var o = {
    id: r.id, orient: r.orient,
    ax: Math.round(r.ax), ay: Math.round(r.ay),
    bx: Math.round(r.bx), by: Math.round(r.by),
    segs: r.segs | 0,
    elasticity: r.elasticity,
    swingForce: r.swingForce
  };
  if (r.orient === 'h' && r.length != null) o.length = Math.round(r.length);
  if (r.damping != null) o.damping = r.damping;
  if (r.wind != null) o.wind = r.wind;
  if (r.climbV != null) o.climbV = r.climbV;
  if (r.grabR != null) o.grabR = r.grabR;
  return o;
}

export function mkRopes(){
  var LV = runtime.LV;
  return (LV.ropes || []).map(function(a, i){
    return mkOne(
      a.id != null ? a.id : i,
      a.orient || 'v',
      a.ax, a.ay, a.bx, a.by,
      a
    );
  });
}

export function mkRopeAt(S, x, y, orient){
  orient = orient === 'h' ? 'h' : 'v';
  var ax = Math.round(x), ay = Math.round(y), bx, by;
  if (orient === 'v'){ bx = ax; by = ay + 5 * T; }
  else { bx = ax + 6 * T; by = ay; }
  if (!S.ropes) S.ropes = [];
  var opts = {};
  if (orient === 'h') opts.length = dist(ax, ay, bx, by) * ROPE_DEF.slack;
  var r = mkOne(allocId(S.ropes), orient, ax, ay, bx, by, opts);
  S.ropes.push(r);
  return r;
}

/** Точка на полилинии, t∈[0..1] по длине сегментов. */
export function sampleRope(r, t){
  ensureNodes(r);
  var nodes = r.nodes, n = nodes.length;
  if (n < 2) return { x: r.ax, y: r.ay, i0: 0, i1: 0, u: 0 };
  if (t < 0) t = 0; if (t > 1) t = 1;
  var total = 0, lens = [], i, d;
  for (i = 0; i < n - 1; i++){
    d = dist(nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y);
    lens.push(d); total += d;
  }
  if (total < 0.001) return { x: nodes[0].x, y: nodes[0].y, i0: 0, i1: 1, u: 0 };
  var target = t * total, acc = 0;
  for (i = 0; i < lens.length; i++){
    if (acc + lens[i] >= target || i === lens.length - 1){
      var u = lens[i] < 0.001 ? 0 : (target - acc) / lens[i];
      if (u < 0) u = 0; if (u > 1) u = 1;
      return {
        x: nodes[i].x + (nodes[i + 1].x - nodes[i].x) * u,
        y: nodes[i].y + (nodes[i + 1].y - nodes[i].y) * u,
        i0: i, i1: i + 1, u: u
      };
    }
    acc += lens[i];
  }
  var last = nodes[n - 1];
  return { x: last.x, y: last.y, i0: n - 2, i1: n - 1, u: 1 };
}

function nearestT(r, px, py){
  ensureNodes(r);
  var nodes = r.nodes, best = 0, bestD = 1e12, total = 0, lens = [], i, d, acc;
  for (i = 0; i < nodes.length - 1; i++){
    d = dist(nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y);
    lens.push(d); total += d;
  }
  if (total < 0.001) return 0;
  acc = 0;
  for (i = 0; i < lens.length; i++){
    var ax = nodes[i].x, ay = nodes[i].y, bx = nodes[i + 1].x, by = nodes[i + 1].y;
    var ldx = bx - ax, ldy = by - ay, llen2 = ldx * ldx + ldy * ldy || 1;
    var u = ((px - ax) * ldx + (py - ay) * ldy) / llen2;
    if (u < 0) u = 0; if (u > 1) u = 1;
    var qx = ax + ldx * u, qy = ay + ldy * u;
    d = (px - qx) * (px - qx) + (py - qy) * (py - qy);
    if (d < bestD){
      bestD = d;
      best = total < 0.001 ? 0 : (acc + lens[i] * u) / total;
    }
    acc += lens[i];
  }
  return best;
}

export function ropeHitDist(r, px, py){
  ensureNodes(r);
  var t = nearestT(r, px, py);
  var s = sampleRope(r, t);
  return { t: t, dist: dist(px, py, s.x, s.y), x: s.x, y: s.y };
}

function pinEnds(r){
  var nodes = r.nodes, n = nodes.length;
  nodes[0].x = r.ax; nodes[0].y = r.ay; nodes[0].ox = r.ax; nodes[0].oy = r.ay;
  if (r.orient === 'h'){
    nodes[n - 1].x = r.bx; nodes[n - 1].y = r.by;
    nodes[n - 1].ox = r.bx; nodes[n - 1].oy = r.by;
  }
}

/**
 * elast≈0: equality к rest (нерастяжимо; length=span → струна, length>span → провис).
 * elast>0: slack ниже rest ок; жёсткий потолок rest*(1+elast).
 */
function constrain(r, maxMul){
  var nodes = r.nodes, rest = r.rest, maxRest = rest * maxMul;
  var hard = maxMul <= 1.0001;
  var i, a, b, dx, dy, d, target, diff, nx, ny;
  for (i = 0; i < nodes.length - 1; i++){
    a = nodes[i]; b = nodes[i + 1];
    dx = b.x - a.x; dy = b.y - a.y;
    d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (hard){
      target = rest;
    } else {
      if (d <= rest) continue;
      target = d > maxRest ? maxRest : rest;
    }
    diff = (d - target) / d;
    nx = dx * 0.5 * diff; ny = dy * 0.5 * diff;
    if (!a.pinned){ a.x += nx; a.y += ny; }
    if (!b.pinned){ b.x -= nx; b.y -= ny; }
  }
  pinEnds(r);
}

function applyRiderLoad(r, p, t){
  var s = sampleRope(r, t);
  var w = 0.55;
  var nodes = r.nodes;
  var i0 = s.i0, i1 = s.i1;
  if (!nodes[i0].pinned){ nodes[i0].y += 2.2 * (1 - s.u) * w; }
  if (!nodes[i1].pinned){ nodes[i1].y += 2.2 * s.u * w; }
}

/** Одноразовый kick; сила в px-эквиваленте (не *dt каждый кадр). */
function applySwingImpulse(r, t, dir, force){
  var s = sampleRope(r, t);
  var nodes = r.nodes;
  var kick = force * dir * 0.018;
  var i0 = s.i0, i1 = s.i1;
  if (!nodes[i0].pinned){ nodes[i0].x += kick * (1 - s.u); nodes[i0].ox -= kick * (1 - s.u) * 0.45; }
  if (!nodes[i1].pinned){ nodes[i1].x += kick * s.u; nodes[i1].ox -= kick * s.u * 0.45; }
}

function verlet(r, dt, full){
  ensureNodes(r);
  var damp = defOf(r, 'damping');
  var wind = defOf(r, 'wind');
  var elast = defOf(r, 'elasticity');
  var nodes = r.nodes, i, n, vx, vy, nx, ny, g;
  var time = runtime.W ? runtime.W.t : 0;
  pinEnds(r);
  g = full ? C.GRAV * 0.55 : C.GRAV * 0.12;
  /* натянутая нерастяжимая — почти без idle wind */
  var taut = elast < 0.001 && Math.abs(ropeLength(r) - ropeSpan(r)) < 1;
  for (i = 0; i < nodes.length; i++){
    n = nodes[i];
    if (n.pinned) continue;
    vx = (n.x - n.ox) * damp;
    vy = (n.y - n.oy) * damp;
    if (!full && !taut){
      vx += Math.sin(time * 1.7 + r.ph + i * 0.45) * wind * 0.02;
      vy += Math.cos(time * 1.3 + r.ph + i * 0.3) * wind * 0.008;
    }
    nx = n.x + vx;
    ny = n.y + vy + g * dt * dt;
    n.ox = n.x; n.oy = n.y;
    n.x = nx; n.y = ny;
  }
  var maxMul = 1 + Math.max(0, elast);
  var iters = full ? (C.ROPE_ITERS | 0) || 6 : 2;
  if (elast < 0.001) iters = Math.max(iters, full ? 10 : 4);
  for (i = 0; i < iters; i++) constrain(r, maxMul);
  /* H струна: length≈span + elast0 — жёстко на хорду (Verlet иначе оставляет провис) */
  if (r.orient === 'h' && taut){
    var nn = nodes.length;
    for (i = 0; i < nn; i++){
      n = nodes[i];
      if (n.pinned) continue;
      var u = i / (nn - 1);
      var tx = r.ax + (r.bx - r.ax) * u;
      var ty = r.ay + (r.by - r.ay) * u;
      n.x = tx; n.y = ty;
      n.ox = tx; n.oy = ty;
    }
  }
}

function nearPlayer(r, p){
  var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  var pad = T * 2.5;
  var minX = Math.min(r.ax, r.bx) - pad, maxX = Math.max(r.ax, r.bx) + pad;
  var minY = Math.min(r.ay, r.by) - pad, maxY = Math.max(r.ay, r.by) + pad;
  ensureNodes(r);
  for (var i = 0; i < r.nodes.length; i++){
    var n = r.nodes[i];
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
  }
  return cx > minX - pad && cx < maxX + pad && cy > minY - pad && cy < maxY + pad;
}

/** Апекс: набор |off| после kick, затем откат — тогда re-arm (физика важнее hold). */
function updateSwingApex(r, p){
  var st = p.rope;
  if (!st || st.swingArmed || !st.kickDir) return;
  var s = sampleRope(r, st.t);
  var nodes = r.nodes;
  var i0 = s.i0, i1 = s.i1;
  var vx = (nodes[i0].x - nodes[i0].ox) * (1 - s.u) + (nodes[i1].x - nodes[i1].ox) * s.u;
  var off = (s.x - r.ax) * st.kickDir;
  if (st._peakOff == null) st._peakOff = 0;
  if (off > st._peakOff) st._peakOff = off;
  if (off > 5) st._sawOut = true;
  if (st._sawOut && st._peakOff > 6 && off < st._peakOff * 0.88 && vx * st.kickDir <= 0){
    st.swingArmed = true;
    st.kickDir = 0;
    st._sawOut = false;
    st._peakOff = 0;
    st.pendingKick = 0;
  }
}

export function stepRopes(S, dt){
  var list = S.ropes || [];
  var p = S.p, i, r, full, st;
  for (i = 0; i < list.length; i++){
    r = list[i];
    r.rider = !!(p.state === 'rope' && p.rope && p.rope.id === r.id);
    full = r.rider || nearPlayer(r, p);
    r.active = full;
    if (r.rider && p.rope){
      st = p.rope;
      applyRiderLoad(r, p, st.t);
      if (r.orient === 'v' && st.pendingKick){
        applySwingImpulse(r, st.t, st.pendingKick, defOf(r, 'swingForce'));
        st.pendingKick = 0;
      }
    }
    verlet(r, dt, full);
    if (r.rider && p.rope && r.orient === 'v') updateSwingApex(r, p);
  }
}

function placeOnRope(p, s){
  p.x = s.x - p.w / 2;
  p.y = s.y - Math.min(10, p.h * 0.35);
  p.vx = 0; p.vy = 0; p.onGround = false;
}

export function attachRope(S, p, r, t){
  if (p.torch >= 0) dropTorch(S, false);
  if (p.stance !== 0) setStance(S, p, 0);
  ensureNodes(r);
  p.rope = {
    id: r.id, t: t,
    swingArmed: true, swingCd: 0, kickDir: 0, pendingKick: 0,
    prevDir: 0, _sawOut: false, _peakOff: 0
  };
  p.state = 'rope';
  p.hang = null; p.lad = null; p.bars = null; p.climb = null; p.ride = null;
  p.vx = 0; p.vy = 0; p.onGround = false; p.jumping = false;
  r.rider = true;
  placeOnRope(p, sampleRope(r, t));
  p.events.push('onrope');
}

export function detachRope(S, p, opts){
  opts = opts || {};
  var r = p.rope ? findById(S.ropes || [], p.rope.id) : null;
  var t = p.rope ? p.rope.t : 0;
  var s = r ? sampleRope(r, t) : null;
  var nx = 0, ny = 0;
  if (r && s){
    var n0 = r.nodes[s.i0], n1 = r.nodes[s.i1];
    nx = (n0.x - n0.ox + n1.x - n1.ox) * 30;
    ny = (n0.y - n0.oy + n1.y - n1.oy) * 30;
  }
  if (r) r.rider = false;
  p.rope = null;
  p.state = 'normal';
  p.ropeCd = opts.cd != null ? opts.cd : C.ROPE_CD;
  p.grabCd = Math.max(p.grabCd || 0, 0.15);
  if (opts.vx != null) p.vx = opts.vx;
  else p.vx = nx;
  if (opts.vy != null) p.vy = opts.vy;
  else p.vy = ny;
  p.onGround = false;
  p.apexY = p.y;
  if (opts.event !== false) p.events.push(opts.event || 'offrope');
}

export function tryRope(S, p, inp){
  if (!inp || !(inp.upHeld || inp.upPressed)) return false;
  if (p.rollT > 0 || (p.ropeCd || 0) > 0) return false;
  if (p.state !== 'normal') return false;
  if (p.inWater) return false;
  var list = S.ropes || [];
  var cx = p.x + p.w / 2, cy = p.y + p.h * 0.35;
  var best = null, bestD = 1e9, i, r, hit, grab;
  for (i = 0; i < list.length; i++){
    r = list[i];
    grab = defOf(r, 'grabR');
    hit = ropeHitDist(r, cx, cy);
    if (hit.dist <= grab && hit.dist < bestD){
      bestD = hit.dist; best = { r: r, t: hit.t };
    }
    hit = ropeHitDist(r, cx, p.y + p.h * 0.55);
    if (hit.dist <= grab && hit.dist < bestD){
      bestD = hit.dist; best = { r: r, t: hit.t };
    }
  }
  if (!best) return false;
  attachRope(S, p, best.r, best.t);
  return true;
}

export function updateRope(S, p, dt, inp){
  var R = p.rope ? findById(S.ropes || [], p.rope.id) : null;
  if (!R){ detachRope(S, p, { event: 'offrope' }); return; }
  ensureNodes(R);
  var climb = defOf(R, 'climbV');
  var st = p.rope;
  var len = 0, i;
  for (i = 0; i < R.nodes.length - 1; i++)
    len += dist(R.nodes[i].x, R.nodes[i].y, R.nodes[i + 1].x, R.nodes[i + 1].y);
  if (len < 1) len = R.rest * R.segs;

  if (st.swingCd > 0) st.swingCd -= dt;

  if (inp.jumpPressed){
    var jvx = inp.x * 92;
    if (R.orient === 'v' && st.kickDir) jvx += st.kickDir * 40;
    detachRope(S, p, { vx: jvx, vy: C.JUMP * 0.84, event: 'jump' });
    p.jumping = true;
    if (inp.x) p.facing = inp.x > 0 ? 1 : -1;
    return;
  }

  if (R.orient === 'v'){
    var up = (inp.upHeld ? 1 : 0) - (inp.downHeld ? 1 : 0);
    if (up !== 0) st.t -= (up * climb * dt) / len;
    var dir = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
    if (dir) p.facing = dir;
    /* edge: новое направление — один импульс; hold не качает */
    if (dir !== 0 && dir !== st.prevDir && st.swingArmed && st.swingCd <= 0){
      st.pendingKick = dir;
      st.kickDir = dir;
      st.swingArmed = false;
      st._sawOut = false;
      st._peakOff = 0;
      st.swingCd = C.ROPE_SWING_CD != null ? C.ROPE_SWING_CD : 0.32;
    }
    st.prevDir = dir;
    if (st.t < 0) st.t = 0;
    if (st.t >= 0.985){
      detachRope(S, p, { vx: (st.kickDir || 0) * 30, vy: 20, event: 'offrope' });
      return;
    }
  } else {
    var hx = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
    if (hx !== 0){
      st.t += (hx * climb * dt) / len;
      p.facing = hx;
    }
    if (st.t < 0.02 && hx < 0){
      detachRope(S, p, { vx: -60, vy: -20, event: 'offrope' });
      return;
    }
    if (st.t > 0.98 && hx > 0){
      detachRope(S, p, { vx: 60, vy: -20, event: 'offrope' });
      return;
    }
    if (st.t < 0) st.t = 0;
    if (st.t > 1) st.t = 1;
  }

  placeOnRope(p, sampleRope(R, st.t));
}

export function rebuildAllRopes(S){
  var list = S.ropes || [];
  for (var i = 0; i < list.length; i++) rebuildRope(list[i]);
}
