import GAME from '../core/game.js';
import { ctx, cv, VW, VH, cam, rc, setCtx, getCtx } from './ctx.js';
import { textPix, textPixC, num } from './hud.js';
import { drawItemIcon } from './icons.js';
import { TABS, listPack, itemInfo, itemStats } from '../entities/catalog.js';
import { canCombine, combineItems, pieceLabel, grantOne } from '../entities/craft.js';
import { dropFromPack } from '../entities/loot.js';
import { blip } from '../audio/sfx.js';

var G = GAME;

var open = false;
var inspect = -1;
var slots = [];
var fold = 0;          // 0 закрыт … 1 вертикаль … 2 полный
var dir = 0;           // +1 раскрытие, −1 сворачивание
var ox = VW / 2, oy = VH / 2;
var lastFold = 0;
var tab = 'all';
var scroll = 0;
var ptr = null;        // { mode, sl, x0, y0, x, y, scroll0 }

var AXIS_T = 0.15;
var PW = Math.round(VW * 0.7);
var PH = Math.round(VH * 0.7);
var PX = ((VW - PW) / 2) | 0;
var PY = ((VH - PH) / 2) | 0;
var GX = 6, GY = 26, CW = 30, CH = 26, COLS = 7;
var CLOSE = { x: PW - 16, y: 3, w: 11, h: 11 };
var GRID = { x: 2, y: GY - 1, w: PW - 4, h: PH - GY - 2 };
var DRAG_T = 5;

var invCv = document.createElement('canvas');
invCv.width = PW; invCv.height = PH;
var invCx = invCv.getContext('2d');
invCx.imageSmoothingEnabled = false;

function fillPanel(x, y, w, h){
  rc(x, y, w, h, '#120c20');
  rc(x, y, w, 1, '#6a5fa8'); rc(x, y + h - 1, w, 1, '#6a5fa8');
  rc(x, y, 1, h, '#6a5fa8'); rc(x + w - 1, y, 1, h, '#6a5fa8');
}

function wrapPix(str, maxChars){
  var words = String(str || '').toUpperCase().split(/\s+/);
  var lines = [], cur = '';
  for (var i = 0; i < words.length; i++){
    var w = words[i];
    if (!w) continue;
    var next = cur ? cur + ' ' + w : w;
    if (next.length > maxChars && cur){ lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function ease(t){
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function axisScales(f){
  var e = 2 / PW;
  if (f <= 0) return { sx: 0, sy: 0 };
  if (f < 1) return { sx: e, sy: ease(f) };
  if (f < 2) return { sx: e + (1 - e) * ease(f - 1), sy: 1 };
  return { sx: 1, sy: 1 };
}

function heroOrigin(S){
  if (!S || !S.p) return { x: VW / 2, y: VH / 2 };
  return { x: S.p.x + S.p.w / 2 - cam.x, y: S.p.y + S.p.h / 2 - cam.y };
}

function pingOpen(){ blip(480, 0.08, 'triangle', 0.04); }
function pingOpenH(){ blip(640, 0.07, 'triangle', 0.035); }
function pingCloseH(){ blip(360, 0.07, 'triangle', 0.035); }
function pingClose(){ blip(240, 0.1, 'triangle', 0.04); }
function pingItem(){ blip(720, 0.08, 'triangle', 0.04); }
function pingItemOff(){ blip(400, 0.06, 'sine', 0.035); }
function pingTab(){ blip(520, 0.05, 'square', 0.03); }
function pingDrop(){ blip(200, 0.1, 'triangle', 0.045); }
function pingCraft(){ blip(660, 0.08, 'square', 0.04); blip(880, 0.09, 'triangle', 0.035); }
function pingFail(){ blip(140, 0.08, 'sawtooth', 0.03); }

function isReady(){ return open && fold >= 2 && dir === 0; }

function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

function contentH(n){
  var rows = Math.ceil(Math.max(1, n) / COLS);
  return rows * CH;
}

function maxScrollOf(n){
  return Math.max(0, contentH(n) - GRID.h);
}

function tabRects(){
  var out = [], tw = ((PW - 8) / TABS.length) | 0, i;
  for (i = 0; i < TABS.length; i++){
    out.push({
      id: TABS[i].id, label: TABS[i].label,
      x: 4 + i * tw, y: 13, w: tw - 1, h: 10
    });
  }
  return out;
}

export function isInvOpen(){ return open || fold > 0; }
export function invInspecting(){ return isReady() && inspect >= 0; }

export function closeInv(instant){
  inspect = -1;
  ptr = null;
  if (instant || fold <= 0){
    open = false; fold = 0; dir = 0; lastFold = 0;
    return;
  }
  if (dir >= 0) pingCloseH();
  dir = -1;
  open = true;
}

export function openInv(){
  var o = heroOrigin(G.W);
  ox = o.x; oy = o.y;
  if (!(open && dir > 0)) pingOpen();
  open = true;
  dir = 1;
  inspect = -1;
  ptr = null;
  if (fold <= 0){ fold = 0.001; lastFold = 0; }
}

export function toggleInv(){
  if (open && dir >= 0 && fold > 0) closeInv();
  else openInv();
  return isInvOpen();
}

export function stepInv(dt){
  if (dir === 0) return;
  lastFold = fold;
  if (dir > 0){
    fold += dt / AXIS_T;
    if (lastFold < 1 && fold >= 1) pingOpenH();
    if (fold >= 2){ fold = 2; dir = 0; }
  } else {
    fold -= dt / AXIS_T;
    if (lastFold > 1 && fold <= 1) pingClose();
    if (fold <= 0){ fold = 0; dir = 0; open = false; inspect = -1; ptr = null; }
  }
}

export function clientToGame(cx, cy){
  var r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: (cx - r.left) / r.width * VW, y: (cy - r.top) / r.height * VH };
}

export function hitsHero(sx, sy, S){
  if (!S || !S.p) return false;
  var p = S.p, pad = 7;
  var x = p.x - cam.x - pad, y = p.y - cam.y - pad;
  var w = p.w + pad * 2, h = p.h + pad * 2;
  return sx >= x && sx <= x + w && sy >= y && sy <= y + h;
}

function inRect(sx, sy, r){
  return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
}

function inspectBox(){
  return { x: 5, y: 12, w: PW - 10, h: PH - 18 };
}

function dropRect(){
  var box = inspectBox();
  var sl = slots[inspect];
  var qty = sl && sl.entry ? (sl.entry.qty || 1) : 1;
  var label = qty > 1 ? 'DROP ' + qty : 'DROP';
  var w = label.length * 4 + 8;
  return { x: box.x + 6, y: box.y + box.h - 16, w: w, h: 11, label: label };
}

function rebuildSlots(S){
  var list = listPack(S, tab);
  slots = [];
  for (var i = 0; i < list.length; i++){
    var col = i % COLS, row = (i / COLS) | 0;
    slots.push({
      i: i,
      entry: list[i],
      x: GX + col * CW,
      y: GY + row * CH - scroll,
      w: CW - 2,
      h: CH - 2
    });
  }
  var max = maxScrollOf(slots.length);
  if (scroll > max){
    scroll = max;
    for (i = 0; i < slots.length; i++){
      col = i % COLS; row = (i / COLS) | 0;
      slots[i].y = GY + row * CH - scroll;
    }
  }
}

function slotAt(lx, ly){
  if (ly < GRID.y || ly > GRID.y + GRID.h) return null;
  for (var i = 0; i < slots.length; i++){
    if (inRect(lx, ly, slots[i])) return slots[i];
  }
  return null;
}

function drawSlot(sl, hi, dim){
  var e = sl.entry;
  var rim = hi === 'ok' ? '#7de08a' : (hi === 'no' ? '#ff7a6a' : (e.equipped ? '#ffd9a0' : '#3a3460'));
  rc(sl.x, sl.y, sl.w, sl.h, dim ? '#100c1c' : '#1a1430');
  rc(sl.x, sl.y, sl.w, 1, rim);
  rc(sl.x, sl.y + sl.h - 1, sl.w, 1, rim);
  rc(sl.x, sl.y, 1, sl.h, rim);
  rc(sl.x + sl.w - 1, sl.y, 1, sl.h, rim);
  if (dim){
    ctx.globalAlpha = 0.35;
    drawItemIcon(e.type, sl.x + 6, sl.y + 4, 1);
    ctx.globalAlpha = 1;
  } else {
    drawItemIcon(e.type, sl.x + 6, sl.y + 4, 1);
  }
  var mark = pieceLabel(e);
  if (mark){
    var mw = mark.length * 4 + 2;
    rc(sl.x + sl.w - mw - 2, sl.y + sl.h - 9, mw, 7, '#120c20');
    textPix(mark, sl.x + sl.w - mw, sl.y + sl.h - 8, '#cfeaff', 1);
  } else if (e.cat === 'bag' && e.qty > 1){
    var q = '' + e.qty, qw = q.length * 4 + 2;
    rc(sl.x + sl.w - qw - 2, sl.y + sl.h - 9, qw, 7, '#120c20');
    num(e.qty, sl.x + sl.w - qw, sl.y + sl.h - 8, '#cfeaff');
  } else if (e.item && e.item.max > 1){
    var wgt = Math.max(0, Math.round(e.item.uses / e.item.max * (sl.w - 4)));
    rc(sl.x + 2, sl.y + sl.h - 4, sl.w - 4, 2, '#2a2444');
    rc(sl.x + 2, sl.y + sl.h - 4, wgt, 2, e.item.uses <= 2 ? '#ff7a6a' : '#7de08a');
  }
}

function drawInspect(entry){
  var box = inspectBox();
  fillPanel(box.x, box.y, box.w, box.h);
  rc(box.x + 6, box.y + 8, 48, 48, '#1a1430');
  rc(box.x + 6, box.y + 8, 48, 1, '#6a5fa8');
  rc(box.x + 6, box.y + 55, 48, 1, '#6a5fa8');
  rc(box.x + 6, box.y + 8, 1, 48, '#6a5fa8');
  rc(box.x + 53, box.y + 8, 1, 48, '#6a5fa8');
  drawItemIcon(entry.type, box.x + 6, box.y + 8, 3);
  var info = itemInfo(entry.type);
  textPix(info.name, box.x + 60, box.y + 8, '#ffd9a0', 1);
  var stats = itemStats(entry);
  var i, y;
  for (i = 0; i < stats.length; i++)
    textPix(stats[i], box.x + 60, box.y + 18 + i * 8, '#cfc6ff', 1);
  var lines = wrapPix(info.desc, 24);
  y = box.y + 62;
  rc(box.x + 6, y - 3, box.w - 12, 1, '#3b3268');
  for (i = 0; i < lines.length && i < 3; i++)
    textPix(lines[i], box.x + 8, y + i * 8, '#8f88bb', 1);
  textPix('X', box.x + box.w - 12, box.y + 3, '#8f88bb', 1);
  var db = dropRect();
  rc(db.x, db.y, db.w, db.h, '#3a2444');
  rc(db.x, db.y, db.w, 1, '#c07080');
  rc(db.x, db.y + db.h - 1, db.w, 1, '#c07080');
  rc(db.x, db.y, 1, db.h, '#c07080');
  rc(db.x + db.w - 1, db.y, 1, db.h, '#c07080');
  textPix(db.label, db.x + 4, db.y + 3, '#ffcdb4', 1);
}

function drawTabs(){
  var rects = tabRects(), i, t, on;
  for (i = 0; i < rects.length; i++){
    t = rects[i];
    on = t.id === tab;
    rc(t.x, t.y, t.w, t.h, on ? '#241d3d' : '#120c20');
    textPixC(t.label, t.x + (t.w / 2) | 0, t.y + 2, on ? '#ffd9a0' : '#6a628f', 1);
    if (on) rc(t.x + 2, t.y + t.h - 1, t.w - 4, 1, '#ffd9a0');
  }
}

function paintSheet(S){
  var main = getCtx();
  setCtx(invCx);
  invCx.clearRect(0, 0, PW, PH);
  fillPanel(0, 0, PW, PH);
  textPix('INVENTORY', 6, 4, '#ffd9a0', 1);
  rc(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, '#241d3d');
  textPix('X', CLOSE.x + 2, CLOSE.y + 3, '#cfc6ff', 1);
  drawTabs();
  rebuildSlots(S);
  invCx.save();
  invCx.beginPath();
  invCx.rect(GRID.x, GRID.y, GRID.w, GRID.h);
  invCx.clip();
  if (!slots.length) textPixC('NOTHING HERE', PW / 2, GY + 28, '#6a628f', 1);
  else {
    var dragI = ptr && ptr.mode === 'drag' && ptr.sl ? ptr.sl.i : -1;
    var over = ptr && ptr.mode === 'drag' ? slotAt(ptr.x, ptr.y) : null;
    for (var i = 0; i < slots.length; i++){
      var sl = slots[i];
      if (sl.y + sl.h < GRID.y || sl.y > GRID.y + GRID.h) continue;
      var hi = null;
      if (over && over.i === sl.i && dragI !== sl.i)
        hi = canCombine(ptr.sl.entry, sl.entry) ? 'ok' : 'no';
      drawSlot(sl, hi, dragI === sl.i);
    }
  }
  invCx.restore();
  if (ptr && ptr.mode === 'drag' && ptr.sl){
    var gx = Math.round(ptr.x - 8), gy = Math.round(ptr.y - 8);
    ctx.globalAlpha = 0.92;
    drawItemIcon(ptr.sl.entry.type, gx, gy, 1);
    ctx.globalAlpha = 1;
  }
  if (inspect >= 0 && slots[inspect]) drawInspect(slots[inspect].entry);
  setCtx(main);
}

export function drawInventory(){
  var S = G.W;
  if ((!open && fold <= 0) || !S) return;
  var dim = Math.min(1, fold / 2) * 0.42;
  ctx.globalAlpha = dim;
  rc(0, 0, VW, VH, '#07060f');
  ctx.globalAlpha = 1;
  paintSheet(S);
  var sc = axisScales(fold);
  if (sc.sx <= 0 || sc.sy <= 0) return;
  var dw = Math.max(1, Math.round(PW * sc.sx));
  var dh = Math.max(1, Math.round(PH * sc.sy));
  var dx = Math.round(ox + (PX - ox) * sc.sx);
  var dy = Math.round(oy + (PY - oy) * sc.sy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(invCv, 0, 0, PW, PH, dx, dy, dw, dh);
}

function setTab(id){
  if (tab === id) return;
  tab = id;
  scroll = 0;
  inspect = -1;
  pingTab();
}

function doDrop(){
  var sl = slots[inspect];
  if (!sl) return;
  if (!dropFromPack(G.W, sl.entry)){ pingFail(); return; }
  pingDrop();
  inspect = -1;
  rebuildSlots(G.W);
}

function doCombine(a, b){
  var got = combineItems(G.W, a, b);
  if (!got){ pingFail(); return; }
  pingCraft();
  inspect = -1;
  rebuildSlots(G.W);
  for (var i = 0; i < slots.length; i++){
    if (slots[i].entry.type === got.type){ inspect = i; break; }
  }
  if (inspect < 0 && tab !== 'all'){
    tab = 'all';
    rebuildSlots(G.W);
    for (i = 0; i < slots.length; i++){
      if (slots[i].entry.type === got.type){ inspect = i; break; }
    }
  }
}

function onDown(lx, ly){
  rebuildSlots(G.W);
  if (inspect >= 0){
    var box = inspectBox();
    if (inRect(lx, ly, box)){
      if (lx >= box.x + box.w - 16 && ly <= box.y + 14){
        inspect = -1; pingItemOff();
        return true;
      }
      if (inRect(lx, ly, dropRect())){ doDrop(); return true; }
      return true;
    }
    inspect = -1; pingItemOff();
    return true;
  }
  if (inRect(lx, ly, CLOSE)){ closeInv(); return true; }
  var tabs = tabRects(), i;
  for (i = 0; i < tabs.length; i++){
    if (inRect(lx, ly, tabs[i])){ setTab(tabs[i].id); return true; }
  }
  var sl = slotAt(lx, ly);
  ptr = {
    mode: null,
    sl: sl,
    x0: lx, y0: ly, x: lx, y: ly,
    scroll0: scroll
  };
  if (!sl && !inRect(lx, ly, { x: 0, y: 0, w: PW, h: PH })){
    ptr = null;
    closeInv();
  }
  return true;
}

function onMove(lx, ly){
  if (!ptr) return true;
  ptr.x = lx; ptr.y = ly;
  var dx = lx - ptr.x0, dy = ly - ptr.y0;
  if (!ptr.mode){
    if (Math.abs(dx) < DRAG_T && Math.abs(dy) < DRAG_T) return true;
    var overflow = maxScrollOf(slots.length) > 0;
    if (ptr.sl) ptr.mode = 'drag';
    else if (overflow) ptr.mode = 'scroll';
    else ptr = null;
  }
  if (ptr && ptr.mode === 'scroll'){
    var max = maxScrollOf(slots.length);
    scroll = clamp(ptr.scroll0 - (ly - ptr.y0), 0, max);
  }
  return true;
}

function onUp(lx, ly){
  if (!ptr) return true;
  var mode = ptr.mode, sl = ptr.sl;
  ptr.x = lx; ptr.y = ly;
  if (mode === 'drag' && sl){
    var over = slotAt(lx, ly);
    if (over && over.i !== sl.i){
      if (canCombine(sl.entry, over.entry)) doCombine(sl.entry, over.entry);
      else pingFail();
    }
    ptr = null;
    return true;
  }
  if (!mode && sl && inRect(lx, ly, sl)){
    inspect = sl.i;
    pingItem();
  }
  ptr = null;
  return true;
}

/* phase: down / move / up; без phase — клик */
export function handleInvPointer(sx, sy, phase){
  if (!isInvOpen()) return false;
  var lx = sx - PX, ly = sy - PY;
  if (!isReady()){
    if (!phase || phase === 'down' || phase === 'tap'){
      if (dir > 0 || fold > 0) closeInv();
    }
    return true;
  }
  if (!phase || phase === 'tap'){
    onDown(lx, ly);
    onUp(lx, ly);
    return true;
  }
  if (phase === 'down') return onDown(lx, ly);
  if (phase === 'move') return onMove(lx, ly);
  if (phase === 'up') return onUp(lx, ly);
  return true;
}

export function handleInvWheel(sx, sy, dy){
  if (!isInvOpen() || !isReady() || inspect >= 0) return false;
  var lx = sx - PX, ly = sy - PY;
  if (!inRect(lx, ly, { x: 0, y: 0, w: PW, h: PH })) return false;
  rebuildSlots(G.W);
  var max = maxScrollOf(slots.length);
  if (max <= 0) return true;
  scroll = clamp(scroll + (dy > 0 ? 14 : -14), 0, max);
  return true;
}

export function handleInvKey(key){
  if (!isInvOpen()) return false;
  if (key === 'Escape'){
    if (ptr){ ptr = null; return true; }
    if (inspect >= 0){ inspect = -1; pingItemOff(); }
    else closeInv();
    return true;
  }
  if (key === 'i' || key === 'I'){ toggleInv(); return true; }
  return true;
}

export function giveInv(type, qty){
  var S = G.W, i, n = Math.max(1, qty || 1);
  if (!S) return;
  for (i = 0; i < n; i++) grantOne(S, type, null);
}
