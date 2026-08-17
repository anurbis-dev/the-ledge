import GAME from '../core/game.js';
import {
  cv, ctx, VW, VH, cam, view, rc, buildWater, clampCam, setViewScale,
  setPondShade, getPondShade, waterExport, shadePresetName, WATER_SHADE_PRESETS
} from '../render/index.js';
import { isMenu } from '../ui/menu.js';
import { hushLift } from '../audio/sfx.js';
import { findById } from '../entities/ids.js';
import { isSlopeBrush, fitSlopeStroke } from './slopes.js';
import { tileThumb, objThumb } from './thumbs.js';
import { renderParams, resetAllParams } from './params.js';

var G = GAME;
var HOLD_MS = 450;
var ZOOM_STEPS = [0.25, 0.5, 1, 2, 4];
var ICON_MIN = 16, ICON_MAX = 56;
var HKEY = 'ledge.ed.h';
var IKEY = 'ledge.ed.icon';

export var ED = {
  on: false, tab: 'tile', tool: 'tile', pal: 0, painting: false, erasing: false,
  panId: -1, panX: 0, panY: 0, camX: 0, camY: 0, last: null,
  stroke: null, strokeOrig: null, waterShade: 0.75,
  zoom: 1, icon: 28, hover: null,
  clickCell: null, clickBrush: -1,
  holdT: null, holdErased: false, holdX: 0, holdY: 0
};

export var ED_TILES = [
  { name: 'Empty',   id: 0,       color: '#241a30', variants: [] },
  { name: 'Stone',   id: 1,       color: '#635c8c', variants: [G.RNDA, G.RNDB] },
  { name: 'Crumb',   id: 2,       color: '#96705a', variants: [] },
  { name: 'Ladder',  id: 3,       color: '#bd8347', variants: [] },
  { name: 'Ladder F',id: 4,       color: '#d09b5c', variants: [] },
  { name: 'Slope R', id: G.SLR,   color: '#8f86b8', variants: [], slope: 'r' },
  { name: 'Slope L', id: G.SLL,   color: '#8f86b8', variants: [], slope: 'l' },
  { name: 'Half R lo', id: G.SLR2, color: '#9a92c4', variants: [], slope: 'r2' },
  { name: 'Half R hi', id: G.SLR3, color: '#9a92c4', variants: [], slope: 'r3' },
  { name: 'Half L hi', id: G.SLL2, color: '#9a92c4', variants: [], slope: 'l2' },
  { name: 'Half L lo', id: G.SLL3, color: '#9a92c4', variants: [], slope: 'l3' },
  { name: 'Arc R',   id: G.SLRCA, color: '#a89ed0', variants: [], slope: 'arcR' },
  { name: 'Arc L',   id: G.SLLCB, color: '#a89ed0', variants: [], slope: 'arcL' },
  { name: 'Half top',id: 7,       color: '#4a4069', variants: [] },
  { name: 'Bar',     id: 8,       color: '#a9743f', variants: [] },
  { name: 'Water',   id: 13,      color: '#49a0cf', variants: [] },
  { name: 'Fall',    id: 14,      color: '#2f7fae', variants: [] },
  { name: 'Diag R',  id: 5,       color: '#c9a06a', variants: [], slope: 'r' },
  { name: 'Diag L',  id: 6,       color: '#c9a06a', variants: [], slope: 'l' }
];
export var ED_OBJS = [
  { name: 'Foe 1',   kind: 'enemy0' },
  { name: 'Foe 2',   kind: 'enemy1' },
  { name: 'Foe 3',   kind: 'enemy2' },
  { name: 'Bird',    kind: 'flier0' },
  { name: 'Diver',   kind: 'flier3' },
  { name: 'Spider',  kind: 'spider0' },
  { name: 'Sting',   kind: 'tendril0' },
  { name: 'Grabber', kind: 'tendril1' },
  { name: 'Torch',   kind: 'torch' },
  { name: 'Chest',   kind: 'chest' },
  { name: 'Locked',  kind: 'chestL' },
  { name: 'Coin',    kind: 'coin' },
  { name: 'Gem',     kind: 'gem' },
  { name: 'Shroom',  kind: 'shroom' }
];

var edBar = document.getElementById('edbar');
var edPal = document.getElementById('edPal');
var edExtra = document.getElementById('edExtra');
var edOut = document.getElementById('edout'), edText = document.getElementById('edtext');
var edParams = document.getElementById('edParams');
var edParamList = document.getElementById('edParamList');
var edParamQ = document.getElementById('edParamQ');
var paramsBuilt = false;
var onOpen = null, onNewLevel = null;

try {
  var ih = +localStorage.getItem(IKEY);
  if (ih >= ICON_MIN && ih <= ICON_MAX) ED.icon = ih;
} catch (_){}

export function bindEditor(hooks){
  onOpen = hooks && hooks.onOpen;
  onNewLevel = hooks && hooks.onNewLevel;
}

function world(){ return G.W; }

function setTab(tab){
  ED.tab = tab;
  if (tab === 'tile' || tab === 'obj'){
    ED.tool = tab;
    ED.pal = 0;
  }
  edRefresh();
}

function syncTabs(){
  var tabs = edBar.querySelectorAll('.ed-tab');
  for (var i = 0; i < tabs.length; i++){
    tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === ED.tab);
  }
  if (edPal) edPal.hidden = ED.tab === 'params';
  if (edExtra) edExtra.hidden = ED.tab === 'params';
  if (edParams) edParams.hidden = ED.tab !== 'params';
}

function swatch(parent, canvas, label, active, onClick){
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'ed-swatch' + (active ? ' on' : '');
  b.title = label;
  b.style.width = (ED.icon + 6) + 'px';
  b.style.height = (ED.icon + 6) + 'px';
  var img = canvas;
  img.className = 'ed-swatch-img';
  img.style.width = ED.icon + 'px';
  img.style.height = ED.icon + 'px';
  b.appendChild(img);
  b.addEventListener('click', function(e){ e.stopPropagation(); onClick(); edRefresh(); });
  parent.appendChild(b);
  return b;
}

function extraBtn(parent, label, active, onClick){
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'edb' + (active ? ' on' : '');
  b.textContent = label;
  b.addEventListener('click', function(e){ e.stopPropagation(); onClick(); edRefresh(); });
  parent.appendChild(b);
}

function fillPal(){
  if (!edPal) return;
  edPal.textContent = '';
  edPal.style.setProperty('--ed-icon', ED.icon + 'px');
  if (ED.tab === 'tile' || (ED.tab === 'params' && ED.tool === 'tile')){
    if (ED.tab !== 'tile') return;
    for (var j = 0; j < ED_TILES.length; j++){
      (function(k){
        var spec = ED_TILES[k];
        swatch(edPal, tileThumb(spec, ED.icon), spec.name, ED.pal === k, function(){ ED.pal = k; });
      })(j);
    }
  } else if (ED.tab === 'obj'){
    for (var m = 0; m < ED_OBJS.length; m++){
      (function(k){
        var spec = ED_OBJS[k];
        swatch(edPal, objThumb(spec.kind, ED.icon), spec.name, ED.pal === k, function(){ ED.pal = k; });
      })(m);
    }
  }
}

function fillExtra(){
  if (!edExtra) return;
  edExtra.textContent = '';
  if (ED.tab !== 'tile') return;
  var spec = ED_TILES[ED.pal];
  if (spec && spec.id === G.WATER){
    for (var s = 0; s < WATER_SHADE_PRESETS.length; s++){
      (function(k){
        var pr = WATER_SHADE_PRESETS[k];
        extraBtn(edExtra, pr[0], Math.abs(ED.waterShade - pr[1]) < 0.02, function(){ ED.waterShade = pr[1]; });
      })(s);
    }
  }
}

function showParams(){
  if (!edParamList) return;
  renderParams(edParamList, edParamQ ? edParamQ.value : '');
  paramsBuilt = true;
}

function edRefresh(){
  syncTabs();
  if (ED.tab === 'params'){
    showParams();
  } else {
    fillPal();
    fillExtra();
  }
}

export function edOpen(){
  ED.on = true;
  hushLift();
  if (onOpen) onOpen();
  ED.camX = cam.x; ED.camY = cam.y;
  setViewScale(ED.zoom);
  view.edit = true;
  document.body.classList.add('edit-mode');
  edBar.classList.add('on');
  restoreHeight();
  edRefresh();
  dispatchEvent(new Event('resize'));
}
export function edClose(){
  ED.on = false;
  view.edit = false;
  setViewScale(1);
  document.body.classList.remove('edit-mode');
  edBar.classList.remove('on');
  clearHold();
  ED.painting = false; ED.erasing = false; ED.panId = -1;
  dispatchEvent(new Event('resize'));
}
export function edToggle(){
  if (ED.on) edClose(); else edOpen();
}

function edCell(clientX, clientY){
  var T = G.T, z = ED.zoom || 1;
  var r = cv.getBoundingClientRect();
  var sx = (clientX - r.left) / r.width * VW;
  var sy = (clientY - r.top) / r.height * VH;
  var wx = cam.x + sx / z, wy = cam.y + sy / z;
  return { c: Math.floor(wx / T), r: Math.floor(wy / T), x: wx, y: wy, sx: sx, sy: sy };
}

function pickVariant(spec, cur){
  var pool = [spec.id].concat(spec.variants || []);
  if (pool.length < 2) return spec.id;
  var opts = [];
  for (var i = 0; i < pool.length; i++) if (pool[i] !== cur) opts.push(pool[i]);
  if (!opts.length) opts = pool;
  return opts[(Math.random() * opts.length) | 0];
}

export function edApply(cell, isClick){
  var S = world();
  if (cell.c !== cell.c || cell.r !== cell.r) return;
  var key = cell.c + ':' + cell.r;
  if (ED.last === key && !isClick) return;
  ED.last = key;
  if (ED.tool === 'tile'){
    var spec = ED_TILES[ED.pal];
    var nv = spec.id;
    if (isClick && ED.clickCell === key && ED.clickBrush === ED.pal && spec.variants && spec.variants.length)
      nv = pickVariant(spec, G.tileAt(cell.c, cell.r));
    if (isSlopeBrush(nv)){ edPaintSlope(cell, nv); return; }
    var old = G.tileAt(cell.c, cell.r);
    if (nv === G.WATER && old === G.WATER){
      setPondShade(cell.c, cell.r, ED.waterShade);
      return;
    }
    G.setTile(cell.c, cell.r, nv);
    G.buildGates(S);
    if (old === G.WATER || old === G.FALL || nv === G.WATER || nv === G.FALL){
      buildWater();
      if (nv === G.WATER) setPondShade(cell.c, cell.r, ED.waterShade);
    }
  } else if (ED.tool === 'obj'){
    edPlaceObject(cell);
  }
}
function edErase(cell){
  var S = world();
  if (cell.c !== cell.c || cell.r !== cell.r) return;
  var key = cell.c + ':' + cell.r;
  if (ED.last === key) return;
  ED.last = key;
  var oldE = G.tileAt(cell.c, cell.r);
  G.setTile(cell.c, cell.r, 0);
  edEraseObjects(cell);
  G.buildGates(S);
  if (oldE === G.WATER || oldE === G.FALL) buildWater();
}
function edEraseObjects(cell){
  var S = world();
  var T = G.T;
  var near = function(ox, oy){ return Math.abs(ox - (cell.c*T + 8)) < 14 && Math.abs(oy - (cell.r*T + 8)) < 18; };
  S.enemies = S.enemies.filter(function(e){ return !near(e.x + e.w/2, e.y + e.h/2); });
  S.fliers  = S.fliers.filter(function(f){ return !near(f.x + f.w/2, f.y + f.h/2); });
  S.spiders = S.spiders.filter(function(s2){ return !near(s2.hx, s2.hy - 8); });
  S.tendrils = (S.tendrils || []).filter(function(td){ return !near(td.bx, td.by); });
  S.torches = S.torches.filter(function(t){ return !near(t.x, t.y - 8); });
  S.chests  = S.chests.filter(function(c2){ return !near(c2.x + 10, c2.y - 6); });
  S.items   = S.items.filter(function(i2){ return !near(i2.x, i2.y); });
  if (S.p.torch >= 0 && !findById(S.torches, S.p.torch)) S.p.torch = -1;
}
function edPlaceObject(cell){
  var S = world();
  var T = G.T;
  var kind = ED_OBJS[ED.pal].kind;
  var cx = cell.c*T + 8, cy = cell.r*T + 8, floorY = (cell.r + 1)*T;
  if (kind.indexOf('enemy') === 0) G.mkEnemyAt(S, cx - 5, floorY, +kind.slice(5));
  else if (kind.indexOf('flier') === 0) G.mkFlierAt(S, cx - 6, cy - 4, +kind.slice(5));
  else if (kind.indexOf('spider') === 0) G.mkSpiderAt(S, cx, floorY, 0);
  else if (kind.indexOf('tendril') === 0) G.mkTendrilAt(S, cx, cy, +kind.slice(7));
  else if (kind === 'torch') G.mkTorchAt(S, cx, floorY);
  else if (kind === 'chest') G.mkChestAt(S, cell.c*T, floorY, 'coin', false);
  else if (kind === 'chestL') G.mkChestAt(S, cell.c*T, floorY, 'gem', true);
  else G.mkItemAt(S, cx, cy, kind);
}
function edPaintSlope(cell, brush){
  var S = world();
  if (!ED.stroke){ ED.stroke = []; ED.strokeOrig = {}; }
  ED.stroke.push({ c: cell.c, r: cell.r });
  applySlopePlan(fitSlopeStroke(ED.stroke, brush));
  G.buildGates(S);
}
function applySlopePlan(plan){
  var keep = {}, i, p, k, cr;
  for (i = 0; i < plan.length; i++){
    p = plan[i];
    k = p.c + ':' + p.r;
    keep[k] = true;
    if (ED.strokeOrig[k] === undefined) ED.strokeOrig[k] = G.tileAt(p.c, p.r);
  }
  for (k in ED.strokeOrig){
    if (keep[k]) continue;
    cr = k.split(':');
    G.setTile(+cr[0], +cr[1], ED.strokeOrig[k]);
    delete ED.strokeOrig[k];
  }
  for (i = 0; i < plan.length; i++){
    p = plan[i];
    G.setTile(p.c, p.r, p.v);
  }
}
export function edExportText(){
  var S = world();
  var T = G.T;
  var lv = G.levelSpec(), out = [];
  out.push('// ' + lv.name + ': geometry (paste into build())');
  var runs = [];
  var r0 = G.mapMinR(), r1 = G.mapMaxR(), c0e = G.mapMinC(), c1e = G.mapMaxC();
  for (var r = r0; r < r1; r++){
    var c = c0e;
    while (c < c1e){
      var v = G.tileAt(c, r);
      if (v === 0){ c++; continue; }
      var n = 1;
      while (c + n < c1e && G.tileAt(c + n, r) === v) n++;
      runs.push('fillR(' + c + ', ' + r + ', ' + n + ', 1, ' + v + ');');
      c += n;
    }
  }
  out.push(runs.join('\n'));
  out.push('');
  out.push('// objects');
  out.push('enemies: [' + S.enemies.map(function(e){
    return '[' + Math.round(e.x) + ',' + Math.round(e.y + e.h) + ',' +
           Math.round(e.x0) + ',' + Math.round(e.x1) + ',' + Math.round(e.v) + ',' + e.kind + ']';
  }).join(',') + '],');
  out.push('fliers: [' + S.fliers.map(function(f){
    return '[' + Math.round(f.x) + ',' + Math.round(f.y) + ',' +
           Math.round(f.x0) + ',' + Math.round(f.x1) + ',' + Math.round(f.v) + ',' + f.kind + ']';
  }).join(',') + '],');
  out.push('spiders: [' + S.spiders.map(function(s2){
    return '[' + Math.floor(s2.hx / T) + ',' + (Math.floor(s2.hy / T) - 1) + ',' + s2.kind + ']';
  }).join(',') + '],');
  out.push('tendrils: [' + (S.tendrils || []).map(function(td){
    var side = td.side || 0;
    var col = td.col, row = td.row;
    if (col === undefined){
      if (side === 1){ col = Math.floor(td.bx / T); row = Math.floor((td.by - 1) / T); }
      else if (side === 2){ col = Math.floor((td.bx - 1) / T); row = Math.floor(td.by / T); }
      else { col = Math.floor(td.bx / T); row = Math.floor(td.by / T); }
    }
    return side
      ? '[' + col + ',' + row + ',' + td.kind + ',' + side + ']'
      : '[' + col + ',' + row + ',' + td.kind + ']';
  }).join(',') + '],');
  out.push('torches: [' + S.torches.map(function(t){
    return '[' + Math.floor(t.x / T) + ',' + (Math.floor(t.y / T) - 1) + ']';
  }).join(',') + '],');
  out.push('chests: [' + S.chests.map(function(c2){
    return '[' + Math.floor(c2.x / T) + ',' + (Math.floor(c2.y / T) - 1) + ",'" + c2.kind + "'," + !!c2.locked + ']';
  }).join(',') + '],');
  out.push('items: [' + S.items.map(function(i2){
    return '[' + Math.floor(i2.x / T) + ',' + Math.floor(i2.y / T) + ",'" + i2.kind + "']";
  }).join(',') + '],');
  out.push('water: [' + waterExport().map(function(e){
    return '[' + e[0] + ',' + e[1] + ',' + e[2] + ']';
  }).join(',') + ']');
  return out.join('\n');
}
export function edDrawOverlay(){
  var T = G.T, z = ED.zoom || 1;
  var visW = VW / z, visH = VH / z;
  ctx.setTransform(z, 0, 0, z, 0, 0);
  var c0 = Math.floor(cam.x/T) - 1, c1 = Math.floor((cam.x+visW)/T) + 1;
  var r0 = Math.floor(cam.y/T) - 1, r1 = Math.floor((cam.y+visH)/T) + 1;
  ctx.globalAlpha = 0.22;
  for (var c = c0; c <= c1 + 1; c++) rc(c*T - cam.x, 0, 1, visH, '#8f88bb');
  for (var r = r0; r <= r1 + 1; r++) rc(0, r*T - cam.y, visW, 1, '#8f88bb');
  ctx.globalAlpha = 1;
  if (ED.hover){
    var hx = ED.hover.c*T - cam.x, hy = ED.hover.r*T - cam.y;
    rc(hx, hy, T, 2, '#ffd9a0'); rc(hx, hy + T - 2, T, 2, '#ffd9a0');
    rc(hx, hy, 2, T, '#ffd9a0'); rc(hx + T - 2, hy, 2, T, '#ffd9a0');
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  rc(0, 0, VW, 9, '#0d0a18cc');
  var spec = ED.tool === 'tile' ? ED_TILES[ED.pal] : ED_OBJS[ED.pal];
  var label = spec ? spec.name : ED.tool;
  if (ED.erasing) label = 'Erase';
  if (ED.hover && G.isWaterV(G.tileAt(ED.hover.c, ED.hover.r)))
    label += ' · ' + shadePresetName(getPondShade(ED.hover.c, ED.hover.r));
  var col = ED.erasing ? '#ff7a6a' : '#ffd9a0';
  for (var i = 0; i < label.length && i < 18; i++)
    rc(3 + i*5, 3, 4, 4, col);
}

function clearHold(){
  if (ED.holdT){ clearTimeout(ED.holdT); ED.holdT = null; }
  ED.holdErased = false;
}

function startHold(cell){
  clearHold();
  ED.holdT = setTimeout(function(){
    ED.holdT = null;
    ED.holdErased = true;
    ED.painting = false;
    ED.last = null;
    edErase(cell);
  }, HOLD_MS);
}

export function snapEditCam(){
  var z = ED.zoom || 1;
  cam.x = Math.round(cam.x * z) / z;
  cam.y = Math.round(cam.y * z) / z;
}
function nearestZoomIx(z){
  var best = 0, bd = 1e9, i;
  for (i = 0; i < ZOOM_STEPS.length; i++){
    var d = Math.abs(ZOOM_STEPS[i] - z);
    if (d < bd){ bd = d; best = i; }
  }
  return best;
}
function setZoom(next, sx, sy){
  var old = ED.zoom || 1;
  if (sx == null) sx = VW / 2;
  if (sy == null) sy = VH / 2;
  var wx = cam.x + sx / old, wy = cam.y + sy / old;
  ED.zoom = next;
  setViewScale(next);
  var cl = clampCam(wx - sx / next, wy - sy / next);
  cam.x = cl.x; cam.y = cl.y;
  snapEditCam();
}
function applyZoom(dir, sx, sy){
  var i = nearestZoomIx(ED.zoom);
  var j = Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir));
  if (ZOOM_STEPS[j] === ED.zoom){ snapEditCam(); return; }
  setZoom(ZOOM_STEPS[j], sx, sy);
}
function resetZoom(){
  var sx = VW / 2, sy = VH / 2;
  if (ED.hover && ED.hover.sx != null){ sx = ED.hover.sx; sy = ED.hover.sy; }
  setZoom(1, sx, sy);
}

function bumpIcon(dir){
  var n = Math.round(ED.icon + dir * 4);
  n = Math.max(ICON_MIN, Math.min(ICON_MAX, n));
  if (n === ED.icon) return;
  ED.icon = n;
  try { localStorage.setItem(IKEY, String(n)); } catch (_){}
  if (ED.tab === 'tile' || ED.tab === 'obj') fillPal();
}

cv.addEventListener('pointerdown', function(e){
  if (!ED.on) return;
  e.preventDefault();
  var cell = edCell(e.clientX, e.clientY);
  ED.hover = cell;
  if (e.button === 1){
    ED.panId = e.pointerId; ED.panX = e.clientX; ED.panY = e.clientY;
    ED.camX = cam.x; ED.camY = cam.y;
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (e.button === 2){
    ED.erasing = true; ED.painting = true; ED.last = null; ED.stroke = null; ED.strokeOrig = null;
    edErase(cell);
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (e.button !== 0) return;
  ED.painting = true; ED.erasing = false; ED.last = null; ED.stroke = null; ED.strokeOrig = null;
  ED.holdX = e.clientX; ED.holdY = e.clientY;
  startHold(cell);
  edApply(cell, true);
  ED.clickCell = cell.c + ':' + cell.r;
  ED.clickBrush = ED.pal;
  try { cv.setPointerCapture(e.pointerId); } catch(_){}
});
cv.addEventListener('pointermove', function(e){
  if (!ED.on) return;
  var cell = edCell(e.clientX, e.clientY);
  ED.hover = cell;
  if (ED.panId === e.pointerId){
    var r = cv.getBoundingClientRect();
    var z = ED.zoom || 1;
    var cl = clampCam(ED.camX - (e.clientX - ED.panX) / r.width * VW / z,
                      ED.camY - (e.clientY - ED.panY) / r.height * VH / z);
    cam.x = cl.x; cam.y = cl.y;
    snapEditCam();
    return;
  }
  if (ED.holdT && (Math.abs(e.clientX - ED.holdX) > 5 || Math.abs(e.clientY - ED.holdY) > 5))
    clearHold();
  if (ED.holdErased) return;
  if (ED.erasing && ED.painting) edErase(cell);
  else if (ED.painting) edApply(cell, false);
});
function edUp(e){
  if (e && e.pointerId === ED.panId) ED.panId = -1;
  ED.painting = false; ED.erasing = false;
  ED.last = null; ED.stroke = null; ED.strokeOrig = null;
  clearHold();
}
cv.addEventListener('pointerup', edUp);
cv.addEventListener('pointercancel', edUp);
cv.addEventListener('contextmenu', function(e){ if (ED.on) e.preventDefault(); });
cv.addEventListener('auxclick', function(e){ if (ED.on) e.preventDefault(); });
cv.addEventListener('wheel', function(e){
  if (!ED.on) return;
  e.preventDefault();
  if (e.ctrlKey && ED.tab === 'obj'){
    bumpIcon(e.deltaY < 0 ? 1 : -1);
    return;
  }
  var cell = edCell(e.clientX, e.clientY);
  applyZoom(e.deltaY < 0 ? 1 : -1, cell.sx, cell.sy);
}, { passive: false });

if (edBar){
  edBar.addEventListener('wheel', function(e){
    if (!ED.on) return;
    if (e.ctrlKey && (ED.tab === 'obj' || ED.tab === 'tile')){
      e.preventDefault();
      bumpIcon(e.deltaY < 0 ? 1 : -1);
    }
  }, { passive: false });
  var tabRow = edBar.querySelector('.ed-tabs');
  if (tabRow){
    tabRow.addEventListener('click', function(e){
      var t = e.target.closest('.ed-tab');
      if (!t) return;
      setTab(t.getAttribute('data-tab'));
    });
  }
}

if (edParamQ){
  edParamQ.addEventListener('input', function(){ showParams(); });
  edParamQ.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ e.stopPropagation(); edClose(); }
  });
}
var edReset = document.getElementById('edParamReset');
if (edReset) edReset.addEventListener('click', function(){ resetAllParams(); showParams(); });

function restoreHeight(){
  try {
    var h = +localStorage.getItem(HKEY);
    if (h >= 120 && h <= innerHeight * 0.8) edBar.style.height = h + 'px';
  } catch (_){}
}
function bindResize(){
  var bar = document.getElementById('edResize');
  if (!bar) return;
  var drag = null;
  bar.addEventListener('pointerdown', function(e){
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { y: e.clientY, h: edBar.getBoundingClientRect().height };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', function(e){
    if (!drag) return;
    var nh = Math.max(120, Math.min(innerHeight * 0.8, drag.h - (e.clientY - drag.y)));
    edBar.style.height = nh + 'px';
  });
  function end(){
    if (!drag) return;
    drag = null;
    try { localStorage.setItem(HKEY, String(Math.round(edBar.getBoundingClientRect().height))); } catch (_){}
  }
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}
bindResize();
restoreHeight();

addEventListener('keydown', function(e){
  var tag = (e.target && e.target.tagName) || '';
  if (e.key === 'Tab'){
    if (tag === 'INPUT' && e.target.id === 'edParamQ' && ED.on){
      e.preventDefault();
      edClose();
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (isMenu() && !ED.on) return;
    e.preventDefault();
    edToggle();
    return;
  }
  if (e.key === 'Escape' && ED.on){
    e.preventDefault();
    edClose();
    return;
  }
  if (ED.on && (e.key === '0' || e.code === 'Numpad0')){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    resetZoom();
  }
}, true);

var bEdit = document.getElementById('bEdit');
if (bEdit) bEdit.addEventListener('click', function(){
  if (isMenu()) return;
  edToggle();
});
document.getElementById('edClose').addEventListener('click', function(){ edClose(); });
document.getElementById('edExport').addEventListener('click', function(){
  edText.value = edExportText();
  edOut.classList.add('on');
  try { edText.select(); } catch(_){}
});
document.getElementById('edOk').addEventListener('click', function(){ edOut.classList.remove('on'); });
var bNew = document.getElementById('edNew');
if (bNew) bNew.addEventListener('click', function(){
  if (onNewLevel) onNewLevel();
});
