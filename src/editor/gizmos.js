import { ctx, cam, rc } from '../render/ctx.js';
import { volCenter, volWorld, volLocal, pointInVolume } from '../entities/volumes.js';
import { runtime } from '../core/runtime.js';
import { findById } from '../entities/ids.js';
import { rebuildRope, ropeHitDist } from '../entities/ropes.js';
import { T } from '../core/constants.js';

var drag = null;
var PAIR_COLS = ['#7de08a', '#7ad0ff', '#ffcf7a', '#ff7ab0', '#c9a0ff', '#e0c060', '#ff9a6a', '#6ad0c8'];

function pairColor(d){
  var a = d.id | 0, b = d.pair | 0;
  var k = (b >= 0 && b < a) ? b : a;
  return PAIR_COLS[((k % PAIR_COLS.length) + PAIR_COLS.length) % PAIR_COLS.length];
}

function pairIndex(d){
  var a = d.id | 0, b = d.pair | 0;
  return (b >= 0 && b < a) ? b : a;
}

function spawnOf(){
  var lv = runtime.LV;
  if (!lv) return null;
  if (!lv.spawn) lv.spawn = { x: 16, y: 6 * 16 - 22 };
  return lv.spawn;
}

function exitsOf(){
  var lv = runtime.LV;
  if (!lv) return [];
  if (!lv.exits) lv.exits = lv.exit
    ? [{ id: 0, x: lv.exit.x, y: lv.exit.y, toId: lv.exit.toId != null ? lv.exit.toId : null }]
    : [];
  return lv.exits;
}

function near(ax, ay, bx, by, r){
  var dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy <= r * r;
}

export function pickSpecial(S, wx, wy){
  var all = pickAllSpecial(S, wx, wy);
  return all.length ? all[0] : null;
}

export function pickAllSpecial(S, wx, wy){
  var out = [], i, o, list, spawn, exits;
  if (!S) return out;
  spawn = spawnOf();
  if (spawn && near(wx, wy, spawn.x + 5, spawn.y + 11, 12))
    out.push({ type: 'player_start', obj: spawn });
  exits = exitsOf();
  for (i = exits.length - 1; i >= 0; i--){
    o = exits[i];
    if (near(wx, wy, o.x + 8, o.y - 16, 16))
      out.push({ type: 'level_exit', obj: o });
  }
  list = S.doors || [];
  for (i = list.length - 1; i >= 0; i--){
    o = list[i];
    if (near(wx, wy, o.x + 8, o.y - 12, 14))
      out.push({ type: 'door', obj: o });
  }
  list = S.lights || [];
  for (i = list.length - 1; i >= 0; i--){
    o = list[i];
    if (near(wx, wy, o.x, o.y, 10)) out.push({ type: 'light', obj: o });
  }
  list = S.sounds || [];
  for (i = list.length - 1; i >= 0; i--){
    o = list[i];
    if (near(wx, wy, o.x, o.y, 10)) out.push({ type: 'sound', obj: o });
  }
  list = S.volumes || [];
  for (i = list.length - 1; i >= 0; i--){
    if (pointInVolume(list[i], wx, wy)) out.push({ type: 'volume', obj: list[i] });
  }
  list = S.ropes || [];
  for (i = list.length - 1; i >= 0; i--){
    o = list[i];
    if (near(wx, wy, o.ax, o.ay, 10) || near(wx, wy, o.bx, o.by, 10)
        || ropeHitDist(o, wx, wy).dist < 8)
      out.push({ type: 'rope', obj: o });
  }
  return out;
}

export function hitGizmo(S, sel, wx, wy){
  if (!sel || !sel.obj) return null;
  var o = sel.obj, t = sel.type, r;
  if (t === 'volume'){
    var hw = o.w / 2, hh = o.h / 2;
    var corners = [
      volWorld(o, -hw, -hh), volWorld(o, hw, -hh),
      volWorld(o, hw, hh), volWorld(o, -hw, hh)
    ];
    for (var i = 0; i < 4; i++){
      if (near(wx, wy, corners[i].x, corners[i].y, 8))
        return { kind: 'rot', type: t, obj: o };
    }
    var edges = [
      { kind: 'scaleX', p: volWorld(o, hw, 0), sign: 1 },
      { kind: 'scaleX', p: volWorld(o, -hw, 0), sign: -1 },
      { kind: 'scaleY', p: volWorld(o, 0, hh), sign: 1 },
      { kind: 'scaleY', p: volWorld(o, 0, -hh), sign: -1 }
    ];
    for (i = 0; i < 4; i++){
      if (near(wx, wy, edges[i].p.x, edges[i].p.y, 7))
        return { kind: edges[i].kind, type: t, obj: o, sign: edges[i].sign };
    }
    if (pointInVolume(o, wx, wy)) return { kind: 'move', type: t, obj: o };
  }
  if (t === 'light' || t === 'sound'){
    r = o.radius || 80;
    var hx = o.x + r, hy = o.y;
    if ((t === 'light' || o.mode === 'falloff') && near(wx, wy, hx, hy, 8))
      return { kind: 'radius', type: t, obj: o };
    if (near(wx, wy, o.x, o.y, 10)) return { kind: 'move', type: t, obj: o };
  }
  if (t === 'player_start'){
    if (near(wx, wy, o.x + 5, o.y + 11, 12)) return { kind: 'move', type: t, obj: o };
  }
  if (t === 'level_exit'){
    if (near(wx, wy, o.x + 8, o.y - 16, 16)) return { kind: 'move', type: t, obj: o };
  }
  if (t === 'door'){
    if (near(wx, wy, o.x + 8, o.y - 12, 14)) return { kind: 'move', type: t, obj: o };
  }
  if (t === 'rope'){
    if (near(wx, wy, o.ax, o.ay, 9)) return { kind: 'ropeA', type: t, obj: o };
    if (near(wx, wy, o.bx, o.by, 9)) return { kind: 'ropeB', type: t, obj: o };
    if (ropeHitDist(o, wx, wy).dist < 8) return { kind: 'ropeMove', type: t, obj: o };
  }
  return null;
}

export function beginGizmo(hit, wx, wy){
  var o = hit.obj;
  drag = {
    kind: hit.kind, type: hit.type, obj: o, sign: hit.sign || 1,
    x0: wx, y0: wy,
    ox: o.x, oy: o.y, ow: o.w, oh: o.h, or: o.rot || 0, rad: o.radius || 80,
    ax: o.ax, ay: o.ay, bx: o.bx, by: o.by
  };
}

export function moveGizmo(wx, wy){
  if (!drag) return;
  var o = drag.obj, dx = wx - drag.x0, dy = wy - drag.y0, S;
  if (drag.kind === 'move'){
    o.x = drag.ox + dx; o.y = drag.oy + dy;
    if (drag.type === 'player_start' || drag.type === 'level_exit' || drag.type === 'door'){
      o.x = Math.round(o.x); o.y = Math.round(o.y);
    }
    if (drag.type === 'player_start'){
      S = runtime.W;
      if (S && S.respawn){ S.respawn.x = o.x; S.respawn.y = o.y; }
    }
    return;
  }
  if (drag.kind === 'radius'){
    o.radius = Math.max(8, Math.round(Math.sqrt((wx - o.x) * (wx - o.x) + (wy - o.y) * (wy - o.y))));
    return;
  }
  if (drag.kind === 'rot'){
    var c = volCenter(o);
    o.rot = Math.atan2(wy - c.y, wx - c.x) - Math.atan2(drag.y0 - c.y, drag.x0 - c.x) + drag.or;
    return;
  }
  if (drag.kind === 'ropeA' || drag.kind === 'ropeB' || drag.kind === 'ropeMove'){
    if (drag.kind === 'ropeMove'){
      o.ax = drag.ax + dx; o.ay = drag.ay + dy;
      o.bx = drag.bx + dx; o.by = drag.by + dy;
    } else if (drag.kind === 'ropeA'){
      o.ax = Math.round(wx); o.ay = Math.round(wy);
      if (o.orient === 'v') o.bx = o.ax;
    } else {
      o.bx = Math.round(wx); o.by = Math.round(wy);
      if (o.orient === 'v'){
        o.bx = o.ax;
        if (o.by < o.ay + T * 2) o.by = o.ay + T * 2;
      } else if (o.orient === 'h'){
        if (Math.abs(o.bx - o.ax) < T * 2) o.bx = o.ax + (o.bx < o.ax ? -T * 2 : T * 2);
      }
    }
    if (o.orient === 'h'){
      var sp = Math.sqrt((o.bx - o.ax) * (o.bx - o.ax) + (o.by - o.ay) * (o.by - o.ay));
      if (o.length == null || o.length < sp) o.length = sp;
    }
    rebuildRope(o);
    return;
  }
  if (drag.type !== 'volume') return;
  var loc = volLocal({ x: drag.ox, y: drag.oy, w: drag.ow, h: drag.oh, rot: drag.or }, wx, wy);
  if (drag.kind === 'scaleX'){
    var nw = Math.max(16, Math.abs(loc.x) * 2);
    var c0 = volCenter({ x: drag.ox, y: drag.oy, w: drag.ow, h: drag.oh, rot: drag.or });
    o.w = nw;
    o.x = c0.x - nw / 2; o.y = c0.y - o.h / 2;
  } else if (drag.kind === 'scaleY'){
    var nh = Math.max(16, Math.abs(loc.y) * 2);
    var c1 = volCenter({ x: drag.ox, y: drag.oy, w: drag.ow, h: drag.oh, rot: drag.or });
    o.h = nh;
    o.x = c1.x - o.w / 2; o.y = c1.y - nh / 2;
  }
}

export function endGizmo(){ drag = null; }
export function gizmoActive(){ return !!drag; }

function handle(x, y, col){
  rc(x - 2, y - 2, 5, 5, col);
}

export function drawGizmos(S, sel){
  var i, o, list = S.volumes || [], spawn, onStart, exits;
  for (i = 0; i < list.length; i++){
    o = list[i];
    drawVolumeFrame(o, sel && sel.type === 'volume' && sel.obj === o);
  }
  list = S.ropes || [];
  for (i = 0; i < list.length; i++){
    o = list[i];
    drawRopeGizmo(o, sel && sel.type === 'rope' && sel.obj === o);
  }
  list = S.lights || [];
  for (i = 0; i < list.length; i++){
    o = list[i];
    var lon = sel && sel.type === 'light' && sel.obj === o;
    drawPoint(o, '#ffcf7a', lon, lon);
  }
  list = S.sounds || [];
  for (i = 0; i < list.length; i++){
    o = list[i];
    var son = sel && sel.type === 'sound' && sel.obj === o;
    drawPoint(o, '#7ad0ff', son, son && o.mode === 'falloff');
  }
  list = S.doors || [];
  /* линии пар — под маркерами, только для валидных пар (раз рисуем оба конца) */
  for (i = 0; i < list.length; i++){
    o = list[i];
    if (o.pair == null || o.pair < 0 || o.id > o.pair) continue;
    drawDoorLink(o, findById(list, o.pair), sel && sel.type === 'door' && (sel.obj === o || (sel.obj && sel.obj.id === o.pair)));
  }
  for (i = 0; i < list.length; i++){
    o = list[i];
    drawDoor(o, sel && sel.type === 'door' && sel.obj === o);
  }
  exits = exitsOf();
  for (i = 0; i < exits.length; i++){
    o = exits[i];
    drawExit(o, sel && sel.type === 'level_exit' && sel.obj === o);
  }
  spawn = spawnOf();
  if (spawn){
    onStart = sel && sel.type === 'player_start' && sel.obj === spawn;
    drawStart(spawn, onStart);
  }
}

function drawStart(o, on){
  var x = o.x - cam.x, y = o.y - cam.y;
  ctx.save();
  ctx.globalAlpha = on ? 1 : 0.85;
  rc(x + 2, y + 2, 6, 18, on ? '#7dffb0' : '#3a8f5c');
  rc(x + 8, y + 2, 10, 7, on ? '#b6ffd4' : '#5bbf7a');
  rc(x + 1, y + 19, 8, 2, '#1a1220');
  ctx.restore();
}

function drawExit(o, on){
  var x = o.x - cam.x, y = o.y - cam.y;
  ctx.save();
  ctx.globalAlpha = on ? 1 : 0.75;
  rc(x - 2, y - 28, 20, 28, on ? '#6a4a9a' : '#3a2a5a');
  rc(x, y - 26, 16, 24, on ? '#2a1840' : '#120d1e');
  rc(x + 6, y - 32, 4, 6, on ? '#ffd9a0' : '#9a8ab8');
  ctx.restore();
}

function drawDoorLink(a, b, strong){
  if (!a || !b) return;
  var col = pairColor(a);
  var x0 = a.x + 8 - cam.x, y0 = a.y - 14 - cam.y;
  var x1 = b.x + 8 - cam.x, y1 = b.y - 14 - cam.y;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = strong ? 0.95 : 0.45;
  ctx.lineWidth = strong ? 2 : 1;
  ctx.setLineDash(strong ? [] : [3, 3]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawDoor(o, on){
  var x = o.x - cam.x, y = o.y - cam.y;
  var col = pairColor(o);
  var idx = pairIndex(o);
  ctx.save();
  ctx.globalAlpha = on ? 1 : 0.75;
  rc(x - 1, y - 27, 18, 27, on ? col : '#5e3f22');
  rc(x + 1, y - 24, 14, 23, on ? '#9a6a3c' : '#7a5230');
  if (o.need || o.locked) rc(x + 6, y - 14, 4, 5, '#e0c060');
  /* бейдж пары — общий номер + цвет */
  rc(x + 4, y - 34, 8, 7, '#1a1220');
  rc(x + 5, y - 33, 6, 5, col);
  ctx.fillStyle = '#1a1220';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;
  ctx.fillText(String(idx), x + 8, y - 30.5);
  ctx.restore();
}

function drawVolumeFrame(o, on){
  var hw = o.w / 2, hh = o.h / 2;
  var pts = [
    volWorld(o, -hw, -hh), volWorld(o, hw, -hh),
    volWorld(o, hw, hh), volWorld(o, -hw, hh)
  ];
  ctx.save();
  ctx.globalAlpha = on ? 0.95 : 0.45;
  ctx.strokeStyle = on ? '#ffd9a0' : '#8f88bb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pts[0].x - cam.x, pts[0].y - cam.y);
  for (var i = 1; i < 4; i++) ctx.lineTo(pts[i].x - cam.x, pts[i].y - cam.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  if (!on) return;
  var mids = [
    volWorld(o, hw, 0), volWorld(o, -hw, 0),
    volWorld(o, 0, hh), volWorld(o, 0, -hh)
  ];
  for (i = 0; i < 4; i++) handle(mids[i].x - cam.x, mids[i].y - cam.y, '#7ad0ff');
  for (i = 0; i < 4; i++) handle(pts[i].x - cam.x, pts[i].y - cam.y, '#ffd9a0');
}

function drawRopeGizmo(o, on){
  var ax = o.ax - cam.x, ay = o.ay - cam.y, bx = o.bx - cam.x, by = o.by - cam.y;
  ctx.save();
  ctx.globalAlpha = on ? 0.95 : 0.4;
  ctx.strokeStyle = on ? '#e8c57a' : '#8a7a55';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  handle(ax, ay, on ? '#7dffb0' : '#3a8f5c');
  handle(bx, by, on ? '#ffd9a0' : '#9a8ab8');
}

function drawPoint(o, col, on, ring){
  var x = o.x - cam.x, y = o.y - cam.y;
  rc(x - 2, y - 2, 5, 5, col);
  if (ring && o.radius){
    ctx.save();
    ctx.globalAlpha = on ? 0.55 : 0.22;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, o.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (on) handle(x + o.radius, y, col);
  }
  if (on){
    rc(x - 4, y - 1, 9, 3, col);
    rc(x - 1, y - 4, 3, 9, col);
  }
}
