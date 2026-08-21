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
  grabR: 14
};

function defOf(r, key){
  if (r[key] != null && Number.isFinite(r[key])) return r[key];
  if (C['ROPE_' + key.toUpperCase()] != null) return C['ROPE_' + key.toUpperCase()];
  /* map camel → C keys */
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

export function rebuildRope(r){
  normalizeEnds(r);
  var segs = Math.max(4, Math.min(24, (r.segs != null ? r.segs : defOf(r, 'segs')) | 0));
  r.segs = segs;
  var n = segs + 1, nodes = [], i, t, x, y;
  var len = dist(r.ax, r.ay, r.bx, r.by);
  var minLen = r.orient === 'h' ? T * 2 : T * 2;
  if (len < minLen){
    if (r.orient === 'v'){ r.bx = r.ax; r.by = r.ay + minLen; }
    else { r.bx = r.ax + minLen; r.by = r.ay; }
    len = minLen;
  }
  r.rest = len / segs;
  for (i = 0; i < n; i++){
    t = i / segs;
    x = r.ax + (r.bx - r.ax) * t;
    y = r.ay + (r.by - r.ay) * t;
    nodes.push({
      x: x, y: y, ox: x, oy: y,
      pinned: r.orient === 'h' ? (i === 0 || i === n - 1) : (i === 0)
    });
  }
  r.nodes = nodes;
  r.ph = (r.id || 0) * 1.37;
  r._lenKey = segs + ':' + r.ax + ',' + r.ay + ',' + r.bx + ',' + r.by;
  return r;
}

function ensureNodes(r){
  var key = (r.segs | 0) + ':' + r.ax + ',' + r.ay + ',' + r.bx + ',' + r.by;
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
  var r = mkOne(allocId(S.ropes), orient, ax, ay, bx, by, {});
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
  var nodes = r.nodes, best = 0, bestD = 1e12, total = 0, lens = [], i, d, acc, tAcc;
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

function constrain(r, stretchMul){
  var nodes = r.nodes, rest = r.rest * stretchMul, i, a, b, dx, dy, d, diff, nx, ny;
  for (i = 0; i < nodes.length - 1; i++){
    a = nodes[i]; b = nodes[i + 1];
    dx = b.x - a.x; dy = b.y - a.y;
    d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    diff = (d - rest) / d;
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

function applySwingImpulse(r, t, dir, force, dt){
  var s = sampleRope(r, t);
  var nodes = r.nodes;
  var kick = force * dir * dt * 0.55;
  var i0 = s.i0, i1 = s.i1;
  if (!nodes[i0].pinned){ nodes[i0].x += kick * (1 - s.u); nodes[i0].ox -= kick * (1 - s.u) * 0.35; }
  if (!nodes[i1].pinned){ nodes[i1].x += kick * s.u; nodes[i1].ox -= kick * s.u * 0.35; }
}

function verlet(r, dt, full){
  ensureNodes(r);
  var damp = defOf(r, 'damping');
  var wind = defOf(r, 'wind');
  var nodes = r.nodes, i, n, vx, vy, nx, ny, g;
  var time = runtime.W ? runtime.W.t : 0;
  pinEnds(r);
  g = full ? C.GRAV * 0.55 : C.GRAV * 0.12;
  for (i = 0; i < nodes.length; i++){
    n = nodes[i];
    if (n.pinned) continue;
    vx = (n.x - n.ox) * damp;
    vy = (n.y - n.oy) * damp;
    if (!full){
      vx += Math.sin(time * 1.7 + r.ph + i * 0.45) * wind * 0.02;
      vy += Math.cos(time * 1.3 + r.ph + i * 0.3) * wind * 0.008;
    }
    nx = n.x + vx;
    ny = n.y + vy + g * dt * dt;
    n.ox = n.x; n.oy = n.y;
    n.x = nx; n.y = ny;
  }
  var elast = defOf(r, 'elasticity');
  var stretch = r.rider ? (1 + elast) : 1;
  var iters = full ? (C.ROPE_ITERS | 0) || 6 : 2;
  for (i = 0; i < iters; i++) constrain(r, stretch);
}

function nearPlayer(r, p){
  var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  var pad = T * 2.5;
  var minX = Math.min(r.ax, r.bx) - pad, maxX = Math.max(r.ax, r.bx) + pad;
  var minY = Math.min(r.ay, r.by) - pad, maxY = Math.max(r.ay, r.by) + pad;
  /* include current sag */
  ensureNodes(r);
  for (var i = 0; i < r.nodes.length; i++){
    var n = r.nodes[i];
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
  }
  return cx > minX - pad && cx < maxX + pad && cy > minY - pad && cy < maxY + pad;
}

export function stepRopes(S, dt){
  var list = S.ropes || [];
  var p = S.p, i, r, full;
  for (i = 0; i < list.length; i++){
    r = list[i];
    r.rider = !!(p.state === 'rope' && p.rope && p.rope.id === r.id);
    full = r.rider || nearPlayer(r, p);
    r.active = full;
    if (r.rider && p.rope){
      applyRiderLoad(r, p, p.rope.t);
      if (r.orient === 'v' && p.rope.swingDir){
        applySwingImpulse(r, p.rope.t, p.rope.swingDir, defOf(r, 'swingForce'), dt);
      }
    }
    verlet(r, dt, full);
  }
}

function placeOnRope(p, s){
  /* руки у точки каната */
  p.x = s.x - p.w / 2;
  p.y = s.y - Math.min(10, p.h * 0.35);
  p.vx = 0; p.vy = 0; p.onGround = false;
}

export function attachRope(S, p, r, t){
  if (p.torch >= 0) dropTorch(S, false);
  if (p.stance !== 0) setStance(S, p, 0);
  ensureNodes(r);
  p.rope = { id: r.id, t: t, swingDir: 0 };
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
    /* also probe mid body / feet */
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
  var len = 0, i;
  for (i = 0; i < R.nodes.length - 1; i++)
    len += dist(R.nodes[i].x, R.nodes[i].y, R.nodes[i + 1].x, R.nodes[i + 1].y);
  if (len < 1) len = R.rest * R.segs;

  if (inp.jumpPressed){
    var jvx = inp.x * 92 + (R.orient === 'v' ? (p.rope.swingDir || 0) * 40 : 0);
    detachRope(S, p, { vx: jvx, vy: C.JUMP * 0.84, event: 'jump' });
    p.jumping = true;
    if (inp.x) p.facing = inp.x > 0 ? 1 : -1;
    return;
  }

  if (R.orient === 'v'){
    var up = (inp.upHeld ? 1 : 0) - (inp.downHeld ? 1 : 0);
    if (up !== 0) p.rope.t -= (up * climb * dt) / len;
    if (Math.abs(inp.x) > 0.35){
      p.rope.swingDir = inp.x > 0 ? 1 : -1;
      p.facing = p.rope.swingDir;
    } else {
      p.rope.swingDir = 0;
    }
    if (p.rope.t < 0) p.rope.t = 0;
    if (p.rope.t >= 0.985){
      detachRope(S, p, { vx: p.rope.swingDir * 30, vy: 20, event: 'offrope' });
      return;
    }
  } else {
    var hx = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
    if (hx !== 0){
      p.rope.t += (hx * climb * dt) / len;
      p.facing = hx;
    }
    /* mild side sway on H */
    if (hx !== 0) applySwingImpulse(R, p.rope.t, hx, defOf(R, 'swingForce') * 0.25, dt);
    if (p.rope.t < 0.02 && hx < 0){
      detachRope(S, p, { vx: -60, vy: -20, event: 'offrope' });
      return;
    }
    if (p.rope.t > 0.98 && hx > 0){
      detachRope(S, p, { vx: 60, vy: -20, event: 'offrope' });
      return;
    }
    if (p.rope.t < 0) p.rope.t = 0;
    if (p.rope.t > 1) p.rope.t = 1;
  }

  placeOnRope(p, sampleRope(R, p.rope.t));
}

export function rebuildAllRopes(S){
  var list = S.ropes || [];
  for (var i = 0; i < list.length; i++) rebuildRope(list[i]);
}
