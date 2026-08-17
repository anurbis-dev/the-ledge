import { ctx, cam, rc } from '../render/ctx.js';
import { volCenter, volWorld, volLocal, pointInVolume } from '../entities/volumes.js';

var drag = null;

function near(ax, ay, bx, by, r){
  var dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy <= r * r;
}

export function pickSpecial(S, wx, wy){
  var all = pickAllSpecial(S, wx, wy);
  return all.length ? all[0] : null;
}

export function pickAllSpecial(S, wx, wy){
  var out = [], i, o, list;
  if (!S) return out;
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
  return null;
}

export function beginGizmo(hit, wx, wy){
  var o = hit.obj;
  drag = {
    kind: hit.kind, type: hit.type, obj: o, sign: hit.sign || 1,
    x0: wx, y0: wy,
    ox: o.x, oy: o.y, ow: o.w, oh: o.h, or: o.rot || 0, rad: o.radius || 80
  };
}

export function moveGizmo(wx, wy){
  if (!drag) return;
  var o = drag.obj, dx = wx - drag.x0, dy = wy - drag.y0;
  if (drag.kind === 'move'){
    o.x = drag.ox + dx; o.y = drag.oy + dy;
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
  var i, o, list = S.volumes || [];
  for (i = 0; i < list.length; i++){
    o = list[i];
    drawVolumeFrame(o, sel && sel.type === 'volume' && sel.obj === o);
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
