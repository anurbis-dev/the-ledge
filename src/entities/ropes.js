import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import {
  solidAt, rectFree, tileAt, isSlopeV, isHalfV, isBarV, slopeSurfaceY, groundYAt
} from '../core/map.js';
import { getTileDef } from '../core/tileset.js';
import { allocId, findById } from './ids.js';
import { dropTorch } from './torches.js';
import { setStance, activeHeroId, grounded, snapFeet } from '../core/player.js';
import { getAnimBox } from '../core/spriteset.js';
import { heroGrabOffset } from '../core/sprite-grab.js';

export var ROPE_DEF = {
  segs: 8,
  elasticity: 0.25,
  swingForce: 200,
  damping: 0.98,
  wind: 2.2,
  climbV: 52,
  grabR: 14,
  /* H: 0 = длина = span; >0 = добавка к span (px) */
  lengthExtra: 0,
  /* лёгкий импульс при хвате V */
  attachWobble: 48
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

/** Добавка к span для H (0 = держать длину = расстояние между точками). */
export function ropeLengthExtra(r){
  if (r.orient !== 'h') return 0;
  if (r.lengthExtra != null && Number.isFinite(r.lengthExtra))
    return Math.max(0, r.lengthExtra);
  /* legacy: абсолютная length → extra */
  var span = ropeSpan(r);
  if (r.length != null && Number.isFinite(r.length))
    return Math.max(0, r.length - span);
  return ROPE_DEF.lengthExtra;
}

/** Полная длина каната (px). V = span; H = span + lengthExtra. */
export function ropeLength(r){
  var span = ropeSpan(r);
  if (r.orient !== 'h') return span;
  return span + ropeLengthExtra(r);
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
    var extra = ropeLengthExtra(r);
    r.lengthExtra = extra;
    r.length = span + extra;
    len = r.length;
  } else {
    /* V: длина задаётся нижним хэндлом */
    r.length = span;
    r.lengthExtra = 0;
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
  r._lenKey = segs + ':' + r.ax + ',' + r.ay + ',' + r.bx + ',' + r.by + ':' + (r.lengthExtra | 0) + ':' + (r.length | 0);
  return r;
}

function ensureNodes(r){
  var key = (r.segs | 0) + ':' + r.ax + ',' + r.ay + ',' + r.bx + ',' + r.by + ':' + ((r.lengthExtra | 0) || 0) + ':' + ((r.length | 0) || 0);
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
    lengthExtra: opts.lengthExtra,
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
  if (r.orient === 'h'){
    var ex = Math.round(ropeLengthExtra(r));
    o.lengthExtra = ex;
    o.length = Math.round(ropeSpan(r) + ex);
  }
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
  if (orient === 'h') opts.lengthExtra = ROPE_DEF.lengthExtra;
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
 * Slider elast 0..1 → eff^ELAST_EXP (низ мягкий).
 * stretch = eff·ELAST_STRETCH; soft = eff/(eff+G_REF) для g/rider.
 */
var ELAST_STRETCH = 0.85;
var ELAST_G_REF = 0.28;
var ELAST_EXP = 2.2;
function elastEff(elast){
  var e = Math.max(0, Math.min(1, elast));
  if (e <= 0) return 0;
  return Math.pow(e, ELAST_EXP);
}
function elastStretch(elast){
  return elastEff(elast) * ELAST_STRETCH;
}
/** 0..1: насколько «мягкая» короткой H (0=струна). */
function elastSoft(elast){
  var e = elastEff(elast);
  return e / (e + ELAST_G_REF);
}

/** Бокс solid в клетке точки (null если free). Скос — {slope,y}. */
function solidHitBox(px, py){
  if (!solidAt(px, py)) return null;
  var c = Math.floor(px / T), r = Math.floor(py / T);
  var v = tileAt(c, r);
  if (isSlopeV(v)){
    var sy = slopeSurfaceY(c, r, px);
    if (sy == null) sy = r * T;
    return { slope: true, y: sy };
  }
  var bx = c * T, by = r * T, bw = T, bh = T;
  var d = getTileDef(v);
  if (d){
    if (d.collide === 'half') bh = 8;
    else if (d.collide === 'bar') bh = 3;
    else if (d.collide === 'custom' && d.box){
      bx = c * T + d.box.x; by = r * T + d.box.y;
      bw = d.box.w; bh = d.box.h;
    }
  } else if (isHalfV(v)) bh = 8;
  else if (isBarV(v)) bh = 3;
  return { bx: bx, by: by, bw: bw, bh: bh };
}

function colEps(){
  var e = C.ROPE_COL_EPS;
  return e != null ? e : 0.75;
}

/** Вытолкнуть одну ноду из solid; pinned не трогаем. */
function resolveRopeNode(n){
  if (n.pinned || !solidAt(n.x, n.y)) return;
  var eps = colEps();
  var hit = solidHitBox(n.x, n.y);
  var moved = false;
  if (hit && hit.slope){
    n.y = hit.y - eps;
    moved = true;
  } else if (hit){
    var pl = n.x - hit.bx;
    var pr = hit.bx + hit.bw - n.x;
    var pt = n.y - hit.by;
    var pb = hit.by + hit.bh - n.y;
    var m = Math.min(pl, pr, pt, pb);
    if (m === pl) n.x = hit.bx - eps;
    else if (m === pr) n.x = hit.bx + hit.bw + eps;
    else if (m === pt) n.y = hit.by - eps;
    else n.y = hit.by + hit.bh + eps;
    moved = true;
  }
  /* fallback: шаг к предыдущей свободной / по осям */
  if (solidAt(n.x, n.y)){
    var x0 = n.x, y0 = n.y, s, done = false;
    if (!solidAt(n.ox, n.oy)){
      for (s = 1; s <= 8; s++){
        var f = s / 8;
        var mx = x0 + (n.ox - x0) * f, my = y0 + (n.oy - y0) * f;
        if (!solidAt(mx, my)){ n.x = mx; n.y = my; done = true; break; }
      }
    }
    if (!done){
      for (s = 1; s <= T && !done; s++){
        if (!solidAt(x0 - s, y0)){ n.x = x0 - s - eps; done = true; }
        else if (!solidAt(x0 + s, y0)){ n.x = x0 + s + eps; done = true; }
        else if (!solidAt(x0, y0 - s)){ n.y = y0 - s - eps; done = true; }
        else if (!solidAt(x0, y0 + s)){ n.y = y0 + s + eps; done = true; }
      }
    }
    moved = moved || done;
  }
  if (moved){
    /* срез скорости внутрь препятствия */
    n.ox += (n.x - n.ox) * 0.45;
    n.oy += (n.y - n.oy) * 0.45;
  }
}

function collideRopeNodes(r){
  var nodes = r.nodes, i;
  for (i = 0; i < nodes.length; i++) resolveRopeNode(nodes[i]);
  pinEnds(r);
}

function riderPoseFree(p){
  return rectFree(p.x, p.y, p.w, p.h);
}

/** Упор боками / головой (потолок). Пол не выталкиваем вверх — для земли есть detach. */
function unstickRopeRiderSidesHead(p){
  if (riderPoseFree(p)) return;
  var tx, ty;
  tx = Math.floor((p.x + p.w) / T) * T - p.w;
  if (rectFree(tx, p.y, p.w, p.h)){ p.x = tx; }
  else {
    tx = Math.floor(p.x / T) * T + T;
    if (rectFree(tx, p.y, p.w, p.h)) p.x = tx;
  }
  if (riderPoseFree(p)) return;
  /* потолок: сдвинуть вниз от верхней грани тайла */
  ty = Math.floor(p.y / T) * T + T;
  if (rectFree(p.x, ty, p.w, p.h)) p.y = ty;
}

/**
 * После сдвига t: если AABB в solid — откатить t (binsearch к prevT),
 * затем упор боками/головой.
 */
function resolveRopeRiderPose(p, R, st, prevT){
  function place(t){
    placeOnRope(p, sampleRope(R, t), R.orient);
    return riderPoseFree(p);
  }
  if (place(st.t)) return;
  var a = prevT, b = st.t, k, m;
  if (Math.abs(b - a) > 1e-6){
    if (place(a)){
      for (k = 0; k < 10; k++){
        m = (a + b) * 0.5;
        if (place(m)) a = m; else b = m;
      }
      st.t = a;
      place(st.t);
    } else {
      st.t = prevT;
      place(st.t);
    }
  }
  if (!riderPoseFree(p)) unstickRopeRiderSidesHead(p);
}

/** Земля / платформа под ступнями (для отцепа при спуске). */
function ropeFeetOnGround(S, p){
  var cx = p.x + p.w * 0.5, fy = p.y + p.h;
  if (solidAt(cx, fy) || solidAt(cx, fy + 1)) return true;
  var gy = groundYAt(cx, fy + 2);
  if (gy != null && fy >= gy - 0.5 && fy <= gy + 2.5) return true;
  return grounded(S, p, true);
}

function constrain(r, stretch){
  var nodes = r.nodes, rest = r.rest, maxRest = rest * (1 + stretch);
  var hard = stretch < 0.00005;
  var i, a, b, dx, dy, d, target, diff, nx, ny, k, over;
  for (i = 0; i < nodes.length - 1; i++){
    a = nodes[i]; b = nodes[i + 1];
    dx = b.x - a.x; dy = b.y - a.y;
    d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (hard){
      target = rest;
      k = 1;
    } else if (d <= rest){
      target = rest;
      k = 1;
    } else if (d <= maxRest){
      /* зона растяга — мягкая пружина к rest, без резкого упора */
      target = rest;
      over = (d - rest) / (maxRest - rest + 0.0001);
      k = 0.22 + 0.38 * over;
    } else {
      /* за потолком — пружина, не кирпич (иначе «обрыв» и ровные крылья) */
      target = maxRest;
      over = Math.min(1.8, (d - maxRest) / (rest * 0.35 + 0.0001));
      k = 0.35 + 0.4 * over;
    }
    diff = ((d - target) / d) * k;
    nx = dx * 0.5 * diff; ny = dy * 0.5 * diff;
    if (!a.pinned){ a.x += nx; a.y += ny; }
    if (!b.pinned){ b.x -= nx; b.y -= ny; }
  }
  pinEnds(r);
}

function applyRiderLoad(r, p, t){
  var soft = elastSoft(defOf(r, 'elasticity'));
  var w = 1.35 * soft;
  if (w < 0.0005) return;
  ensureNodes(r);
  var nodes = r.nodes, n = nodes.length;
  if (n < 2) return;
  /* размазать вес по нескольким узлам — плавная яма, не V */
  var mid = t * (n - 1);
  var i, dist, fall, push;
  for (i = 0; i < n; i++){
    if (nodes[i].pinned) continue;
    dist = Math.abs(i - mid);
    fall = Math.exp(-dist * dist / 2.8);
    push = 2.4 * w * fall;
    if (push > 0.001) nodes[i].y += push;
  }
}

/** Одноразовый kick на нажатии; сила в px-эквиваленте (не *dt каждый кадр). */
function applySwingImpulse(r, t, dir, force){
  var s = sampleRope(r, t);
  var nodes = r.nodes;
  var kick = force * dir * 0.042;
  var i0 = s.i0, i1 = s.i1;
  var w0 = 1 - s.u, w1 = s.u;
  if (!nodes[i0].pinned){ nodes[i0].x += kick * w0; nodes[i0].ox -= kick * w0 * 0.55; }
  if (!nodes[i1].pinned){ nodes[i1].x += kick * w1; nodes[i1].ox -= kick * w1 * 0.55; }
  /* чуть соседям — легче раскачать с места */
  if (i0 > 0 && !nodes[i0 - 1].pinned){
    nodes[i0 - 1].x += kick * w0 * 0.35;
    nodes[i0 - 1].ox -= kick * w0 * 0.2;
  }
  if (i1 < nodes.length - 1 && !nodes[i1 + 1].pinned){
    nodes[i1 + 1].x += kick * w1 * 0.35;
    nodes[i1 + 1].ox -= kick * w1 * 0.2;
  }
}

function verlet(r, dt, full){
  ensureNodes(r);
  var damp = defOf(r, 'damping');
  var wind = defOf(r, 'wind');
  var elast = defOf(r, 'elasticity');
  var nodes = r.nodes, i, n, vx, vy, nx, ny, g;
  var time = runtime.W ? runtime.W.t : 0;
  pinEnds(r);
  var stretch = elastStretch(elast);
  var soft = elastSoft(elast);
  var shortH = r.orient === 'h' && Math.abs(ropeLength(r) - ropeSpan(r)) < 1;
  var hardString = shortH && elastEff(elast) < 0.00008;
  /* короткая H: g ∝ soft — без резкого «вкл/выкл» провиса */
  var gMul = shortH ? Math.max(0.06, 0.15 + 0.85 * soft) : 1;
  g = (full ? C.GRAV * 0.55 : C.GRAV * 0.12) * gMul;
  for (i = 0; i < nodes.length; i++){
    n = nodes[i];
    if (n.pinned) continue;
    vx = (n.x - n.ox) * damp;
    vy = (n.y - n.oy) * damp;
    if (!full && !hardString){
      var wm = 0.2 + 0.8 * soft;
      vx += Math.sin(time * 1.7 + r.ph + i * 0.45) * wind * 0.02 * wm;
      vy += Math.cos(time * 1.3 + r.ph + i * 0.3) * wind * 0.008 * wm;
    }
    nx = n.x + vx;
    ny = n.y + vy + g * dt * dt;
    n.ox = n.x; n.oy = n.y;
    n.x = nx; n.y = ny;
  }
  var iters = full ? (C.ROPE_ITERS | 0) || 6 : 2;
  if (hardString) iters = Math.max(iters, full ? 12 : 5);
  else if (shortH && soft < 0.25) iters = Math.max(iters, full ? 9 : 4);
  for (i = 0; i < iters; i++){
    constrain(r, stretch);
    /* solid только рядом с героем / на rider — idle far пропускаем */
    if (full) collideRopeNodes(r);
  }
  /* хорда только у почти-струны; с rider — слабее, чтобы яма не сплющивалась */
  if (shortH && !r.rider){
    var pull = hardString ? 1 : Math.pow(1 - soft, 1.6) * 0.12;
    if (pull > 0.015){
      var nn = nodes.length;
      for (i = 0; i < nn; i++){
        n = nodes[i];
        if (n.pinned) continue;
        var u = i / (nn - 1);
        var tx = r.ax + (r.bx - r.ax) * u;
        var ty = r.ay + (r.by - r.ay) * u;
        if (hardString){
          n.x = tx; n.y = ty; n.ox = tx; n.oy = ty;
        } else {
          n.x += (tx - n.x) * pull;
          n.y += (ty - n.y) * pull;
          n.ox += (tx - n.ox) * pull;
          n.oy += (ty - n.oy) * pull;
        }
      }
    }
  } else if (hardString){
    var nn2 = nodes.length;
    for (i = 0; i < nn2; i++){
      n = nodes[i];
      if (n.pinned) continue;
      var u2 = i / (nn2 - 1);
      var tx2 = r.ax + (r.bx - r.ax) * u2;
      var ty2 = r.ay + (r.by - r.ay) * u2;
      n.x = tx2; n.y = ty2; n.ox = tx2; n.oy = ty2;
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
  }
}

function placeOnRope(p, s, orient){
  p.x = s.x - p.w / 2;
  if (orient === 'h'){
    var hy = heroGrabOffset(p).y;
    p.y = s.y - (hy > 0 ? hy : C.HAND);
  } else {
    p.y = s.y - Math.min(10, p.h * 0.35);
  }
  p.vx = 0; p.vy = 0; p.onGround = false;
}

export function attachRope(S, p, r, t){
  if (p.torch >= 0) dropTorch(S, false);
  if (p.stance !== 0) setStance(S, p, 0);
  ensureNodes(r);
  p.rope = {
    id: r.id, t: t, orient: r.orient,
    ph: 0, swingCd: 0, kickDir: 0, pendingKick: 0, prevDir: 0,
    /* ↑↓ не двигают, пока не отпустят захватный ввод */
    climbLock: true
  };
  p.state = 'rope';
  p.hang = null; p.lad = null; p.bars = null; p.climb = null; p.ride = null;
  p.vx = 0; p.vy = 0; p.onGround = false; p.jumping = false;
  r.rider = true;
  var box = getAnimBox(activeHeroId(), r.orient === 'h' ? 'bars' : 'ropeClimb');
  if (box){ p.w = box.w; p.h = box.h; }
  placeOnRope(p, sampleRope(r, t), r.orient);
  unstickRopeRiderSidesHead(p);
  /* V: лёгкий боковой импульс — не висеть идеально ровно */
  if (r.orient === 'v'){
    var wob = ROPE_DEF.attachWobble;
    var wdir = p.facing ? p.facing : (Math.random() < 0.5 ? -1 : 1);
    if (Math.abs(p.vx) > 12) wdir = p.vx > 0 ? 1 : -1;
    applySwingImpulse(r, t, wdir, wob);
  }
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
  var prevT = st.t;
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

  var descending = false;
  st.climbSp = 0;
  if (R.orient === 'v'){
    var up = (inp.upHeld ? 1 : 0) - (inp.downHeld ? 1 : 0);
    if (st.climbLock){
      if (up === 0) st.climbLock = false;
    } else if (up !== 0){
      st.t -= (up * climb * dt) / len;
      st.climbSp = up;
      st.ph = (st.ph || 0) + climb * dt * 0.12;
      if (up < 0) descending = true;
    }
    var dir = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
    if (dir) p.facing = dir;
    /* edge press: каждый тап в сторону добавляет импульс; hold не качает */
    if (dir !== 0 && dir !== st.prevDir && st.swingCd <= 0){
      st.pendingKick = dir;
      st.kickDir = dir;
      st.swingCd = C.ROPE_SWING_CD != null ? C.ROPE_SWING_CD : 0.22;
    }
    st.prevDir = dir;
    if (st.t < 0) st.t = 0;
    if (st.t >= 0.985){
      detachRope(S, p, { vx: (st.kickDir || 0) * 30, vy: 20, event: 'offrope' });
      return;
    }
  } else {
    if (inp.downPressed){
      var dx = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
      detachRope(S, p, { vx: dx * 40, vy: 50, event: 'offrope' });
      return;
    }
    var hx = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
    if (hx !== 0){
      st.t += (hx * climb * dt) / len;
      st.ph = (st.ph || 0) + climb * dt * 0.12;
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

  resolveRopeRiderPose(p, R, st, prevT);

  /* земля под ногами: V — при спуске; H — если провисли до пола */
  var onFloor = ropeFeetOnGround(S, p);
  var vLand = R.orient === 'v' && !st.climbLock && (descending || st.t > prevT + 1e-5);
  var hLand = R.orient === 'h';
  if (onFloor && (vLand || hLand)){
    detachRope(S, p, { vx: 0, vy: 0, cd: 0.12, event: 'offrope' });
    p.onGround = true;
    p.coyote = C.COYOTE;
    snapFeet(p);
  }
}

export function rebuildAllRopes(S){
  var list = S.ropes || [];
  for (var i = 0; i < list.length; i++) rebuildRope(list[i]);
}
