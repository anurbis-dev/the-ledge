import GAME from '../core/game.js';

export const VW = 320, VH = 180;
export const BUF_W = VW + 1, BUF_H = VH + 1;
export const cv = document.getElementById('c');
export const hv = document.getElementById('h');
export const viewBox = document.getElementById('view');
if (cv){ cv.width = BUF_W; cv.height = BUF_H; }
export let ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
export const hx = hv ? hv.getContext('2d') : null;
if (hx) hx.imageSmoothingEnabled = false;

export var viewScale = 1;
export function setViewScale(z){ viewScale = z > 0 ? z : 1; }
export function viewW(){ return VW / viewScale; }
export function viewH(){ return VH / viewScale; }

export const lc = document.createElement('canvas');
lc.width = BUF_W; lc.height = BUF_H;
export const lx = lc.getContext('2d');
lx.imageSmoothingEnabled = false;

export const cam = { x: 0, y: 0, lead: 0, look: 0, ax: 0, ay: 0 };
export const view = {
  time: 0, animT: 0, runPh: 0, parts: [], flash: 0,
  tail: { a: 0, v: 0 }, warpJump: false, hearts: [],
  outro: null, camFx: 0, camFy: 0
};

var _fs = null;
export function setFill(col){
  if (col !== _fs){ ctx.fillStyle = col; _fs = col; }
}
export function setCtx(c){ ctx = c; _fs = null; }
export function getCtx(){ return ctx; }

export function paintHud(fn){
  if (!hx){ fn(); return; }
  hx.setTransform(1, 0, 0, 1, 0, 0);
  hx.clearRect(0, 0, VW, VH);
  var prev = ctx;
  setCtx(hx);
  fn();
  setCtx(prev);
}
export function clearHud(){
  if (hx) hx.clearRect(0, 0, VW, VH);
}

export function world(){ return GAME.W; }

export function entA(e){
  if (!e) return 1;
  if (typeof e.roomA === 'number') return e.roomA;
  return e.roomHide ? 0 : 1;
}
var _ra = 1, _rp = false;
export function pushEntA(e){
  popEntA();
  var a = entA(e);
  if (a <= 0.01) return false;
  if (a < 0.995){
    _ra = ctx.globalAlpha;
    ctx.globalAlpha = _ra * a;
    _rp = true;
  }
  return true;
}
export function popEntA(){
  if (_rp){ ctx.globalAlpha = _ra; _rp = false; }
}

export function rc(x, y, w, h, col){
  setFill(col);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function lb(a, b, th, col){
  var x0 = Math.round(a[0]), y0 = Math.round(a[1]), x1 = Math.round(b[0]), y1 = Math.round(b[1]);
  var dx = Math.abs(x1-x0), sx = x0<x1?1:-1, dy = -Math.abs(y1-y0), sy = y0<y1?1:-1, err = dx+dy, o = -((th/2)|0);
  setFill(col);
  for (var g = 0; g < 240; g++){
    ctx.fillRect(x0+o, y0+o, th, th);
    if (x0===x1 && y0===y1) break;
    var e2 = 2*err;
    if (e2 >= dy){ err += dy; x0 += sx; }
    if (e2 <= dx){ err += dx; y0 += sy; }
  }
}
