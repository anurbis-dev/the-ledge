import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { rectFree } from '../core/map.js';
import { slopeUnder } from '../core/player.js';
import { startTalk, speechBlocks, breakTalk, mutter } from '../speech/runtime.js';
import { pickLine } from '../speech/lines.js';
import { allocId } from './ids.js';

var SCARE_R = 88;
var SAFE_R = 148;
var FLEE_V = 72;
var DOOR_R = 180;

function cloneDialog(d){
  return d ? JSON.parse(JSON.stringify(d)) : null;
}

function mkNpc(id, x, y, tree, facing, dialog, ph){
  return {
    id: id, x: x, y: y, w: 10, h: 18,
    tree: tree || 'hermit',
    facing: facing != null ? facing : -1,
    ph: ph != null ? ph : Math.random() * 6,
    hx: x, hy: y,
    st: 'idle',
    inside: false,
    crouch: false,
    hideWait: 0,
    fleeTo: null,
    dialog: cloneDialog(dialog)
  };
}

export function mkNpcs(){
  var LV = runtime.LV;
  return (LV.npcs || []).map(function(a, i){
    var x = a[0] * T + 3, y = (a[1] + 1) * T - 18;
    return mkNpc(i, x, y, a[2] || 'hermit', a[3], a[4], i * 1.3);
  });
}

export function mkNpcAt(S, x, y, tree, facing, dialog){
  var n = mkNpc(allocId(S.npcs), x - 5, y - 18, tree, facing, dialog);
  S.npcs.push(n);
  return n;
}

function dist2(ax, ay, bx, by){
  var dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function threatNear(S, n, r){
  var nx = n.x + n.w / 2, ny = n.y + n.h / 2;
  var rr = r * r, i, e;
  for (i = 0; i < (S.enemies || []).length; i++){
    e = S.enemies[i];
    if (e.dead) continue;
    if (dist2(nx, ny, e.x + e.w / 2, e.y + e.h / 2) < rr) return true;
  }
  for (i = 0; i < (S.fliers || []).length; i++){
    e = S.fliers[i];
    if (dist2(nx, ny, e.x + e.w / 2, e.y + e.h / 2) < rr) return true;
  }
  for (i = 0; i < (S.spiders || []).length; i++){
    e = S.spiders[i];
    if (e.dead) continue;
    if (dist2(nx, ny, e.x + e.w / 2, e.y + e.h / 2) < rr) return true;
  }
  return false;
}

function pickFleeTarget(S, n){
  var nx = n.x + n.w / 2, ny = n.y + n.h / 2;
  var best = null, bd = DOOR_R * DOOR_R, i, d, dd;
  for (i = 0; i < (S.doors || []).length; i++){
    d = S.doors[i];
    dd = dist2(nx, ny, d.x + 8, d.y - 8);
    if (dd < bd){ bd = dd; best = d; }
  }
  if (best) return { x: best.x + 8, y: n.y, door: true };
  return { x: n.hx + n.w / 2, y: n.hy, door: false };
}

function startFlee(S, n){
  if (n.st === 'flee' || n.st === 'hide') return;
  if (S.talk && S.talk.speakerId === n.id) breakTalk(S, 'flee');
  n.st = 'flee';
  n.crouch = false;
  n.inside = false;
  n.fleeTo = pickFleeTarget(S, n);
  n.hideWait = 0;
}

function arriveHide(n){
  n.st = 'hide';
  n.fleeTo = n.fleeTo || { door: false };
  n.inside = !!n.fleeTo.door;
  n.crouch = !n.inside;
  n.hideWait = 0.55;
}

function emerge(S, n){
  n.st = 'idle';
  n.crouch = false;
  n.hideWait = 0;
  n.fleeTo = null;
  if (n.inside){
    n.x = n.hx;
    n.y = n.hy;
    n.inside = false;
  }
  mutter(S, pickLine('safe'), 'npc', n.id, n.tree || 'npc');
}

export function stepNpcs(S, dt){
  var list = S.npcs || [], i, n, scare, safe, tx, dx, step, ox, sl;
  for (i = 0; i < list.length; i++){
    n = list[i];
    if (n.roomHide) continue;
    if (n.hx == null){ n.hx = n.x; n.hy = n.y; }
    scare = threatNear(S, n, SCARE_R);
    safe = !threatNear(S, n, SAFE_R);
    if (scare && n.st === 'idle') startFlee(S, n);
    if (n.st === 'flee'){
      tx = n.fleeTo ? n.fleeTo.x : (n.hx + n.w / 2);
      dx = tx - (n.x + n.w / 2);
      n.facing = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) <= 5){ arriveHide(n); continue; }
      step = (dx > 0 ? 1 : -1) * FLEE_V * dt;
      ox = n.x;
      n.x += step;
      if (!rectFree(n.x, n.y, n.w, n.h)){
        n.x = ox;
        arriveHide(n);
        continue;
      }
      sl = slopeUnder(n);
      if (sl !== null) n.y = sl - n.h;
    } else if (n.st === 'hide'){
      if (n.hideWait > 0) n.hideWait -= dt;
      if (n.hideWait <= 0 && safe) emerge(S, n);
    }
  }
}

export function tryTalk(S){
  if (speechBlocks(S)) return true;
  var p = S.p, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  var best = null, bd = 22 * 22, i, n, dx, dy, d;
  for (i = 0; i < (S.npcs || []).length; i++){
    n = S.npcs[i];
    if (n.inside || n.roomHide || n.st === 'flee' || n.st === 'hide') continue;
    dx = (n.x + n.w / 2) - cx;
    dy = (n.y + n.h / 2) - cy;
    d = dx * dx + dy * dy;
    if (d < bd){ bd = d; best = n; }
  }
  if (!best) return false;
  if (best.x + best.w / 2 < cx) best.facing = 1;
  else best.facing = -1;
  return startTalk(S, best);
}
