import GAME from '../core/game.js';

export let VW = 320, VH = 180;
export let BUF_W = VW + 1, BUF_H = VH + 1;
/* Плотность пикселей канваса, независима от VW/VH (мирового FOV) и viewScale (зум редактора) —
   те же мировые единицы, просто больше реальных пикселей на них. */
export var RENDER_SCALE = 2;
export const cv = document.getElementById('c');
export const hv = document.getElementById('h');
export const viewBox = document.getElementById('view');
export let ctx = cv.getContext('2d');
export const hx = hv ? hv.getContext('2d') : null;

export const lc = document.createElement('canvas');
export const lx = lc.getContext('2d');

/* Ресайз .width/.height сам сбрасывает 2D-контекст (transform/smoothing) — переналагаем каждый раз. */
function applyCanvasSizes(){
  if (cv){
    cv.width = BUF_W * RENDER_SCALE; cv.height = BUF_H * RENDER_SCALE;
    ctx.imageSmoothingEnabled = false;
  }
  if (hv && hx){
    hv.width = VW * RENDER_SCALE; hv.height = VH * RENDER_SCALE;
    hx.imageSmoothingEnabled = false;
    hx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  }
  lc.width = BUF_W * RENDER_SCALE; lc.height = BUF_H * RENDER_SCALE;
  lx.imageSmoothingEnabled = false;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.scale(RENDER_SCALE, RENDER_SCALE);
}
applyCanvasSizes();

var _viewportListeners = [];
/** Подписка на смену VW/VH (адаптивный вьюпорт) — вместо ручной проверки rev-счётчика
    в каждом читателе: кэш, которому нужно протухнуть при ресайзе, регистрирует коллбек один раз. */
export function onViewportChange(fn){ _viewportListeners.push(fn); }

/** Адаптивный вьюпорт (только геймплей — редактор держит фиксированные 320×180, см. loop.js resize()). */
export function setViewport(vw, vh){
  if (vw === VW && vh === VH) return;
  VW = vw; VH = vh; BUF_W = vw + 1; BUF_H = vh + 1;
  applyCanvasSizes();
  for (var i = 0; i < _viewportListeners.length; i++) _viewportListeners[i]();
}

export var viewScale = 1;
export function setViewScale(z){ viewScale = z > 0 ? z : 1; }
export function viewW(){ return VW / viewScale; }
export function viewH(){ return VH / viewScale; }

/** Канвас-пикселей на мировую единицу прямо сейчас — зум редактора × плотность RENDER_SCALE. */
export function deviceScale(){ return viewScale * RENDER_SCALE; }
/** Ставит на главный ctx трансформацию мир→канвас (см. deviceScale) — единая точка,
    которая физически не может забыть про RENDER_SCALE. */
export function applyWorldTransform(){
  var s = deviceScale();
  ctx.setTransform(s, 0, 0, s, 0, 0);
}

/** Очистка всего канваса в мировых координатах — BUF_W/BUF_H это world-юниты при
    viewScale=1, при зуме редактора (viewScale!=1) их надо делить на viewScale,
    иначе при zoom<1 (отдалении) реально видимая область больше BUF_W×BUF_H
    и clearRect не достаёт до краёв — старый кадр остаётся, копится «слоями». */
export function clearFrame(){
  ctx.clearRect(0, 0, BUF_W / viewScale, BUF_H / viewScale);
}

/* Offscreen-кэш «запечь один раз в мировых координатах, переиспользовать» (chunk/stamp/cover/
   wave-strip тайлов, HUD-панели) — размер и transform сразу учитывают RENDER_SCALE, чтобы
   контент не терял детализацию на этапе запекания, до отрисовки на экран. */
export function makeBakeCanvas(w, h){
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * RENDER_SCALE));
  c.height = Math.max(1, Math.round(h * RENDER_SCALE));
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  return c;
}
/** Блит запечённой canvas (сделанной makeBakeCanvas, w×h — мировые пиксели) на текущий ctx. */
export function blitBake(can, w, h, dx, dy){
  ctx.drawImage(can, 0, 0, can.width, can.height, dx, dy, w, h);
}

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
  hx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
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
