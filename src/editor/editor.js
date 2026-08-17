import GAME from '../core/game.js';
import {
  cv, ctx, VW, VH, cam, rc, buildWater, clampCam
} from '../render/index.js';
import { isMenu } from '../ui/menu.js';
import { hushLift } from '../audio/sfx.js';
import { findById } from '../entities/ids.js';

var G = GAME;

export var ED = {
  on: false, tool: 'tile', pal: 0, painting: false, panId: -1,
  panX: 0, panY: 0, camX: 0, camY: 0, last: null
};
export var ED_TILES = [
  ['пусто',   0,        '#241a30'],
  ['камень',  1,        '#635c8c'],
  ['хрупкий', 2,        '#96705a'],
  ['лест.',   3,        '#bd8347'],
  ['лест.Ф',  4,        '#d09b5c'],
  ['скос →',  9,        '#8f86b8'],
  ['скос ←',  10,       '#8f86b8'],
  ['полпот.', 7,        '#4a4069'],
  ['перекл.', 8,        '#a9743f'],
  ['вода',    13,       '#49a0cf'],
  ['поток',   14,       '#2f7fae'],
  ['косой →', 5,        '#c9a06a'],
  ['косой ←', 6,        '#c9a06a']
];
export var ED_OBJS = [
  ['враг 1', 'enemy0'], ['враг 2', 'enemy1'], ['враг 3', 'enemy2'],
  ['птица',  'flier0'], ['пикир.', 'flier3'], ['паук',   'spider0'],
  ['жало',   'tendril0'], ['хват',  'tendril1'],
  ['факел',  'torch'],  ['сундук', 'chest'],  ['замок',  'chestL'],
  ['монета', 'coin'],   ['самоцв.','gem'],    ['гриб',   'shroom']
];

var edBar = document.getElementById('edbar');
var edTools = document.getElementById('edTools'), edPal = document.getElementById('edPal');
var edOut = document.getElementById('edout'), edText = document.getElementById('edtext');
var onOpen = null;

export function bindEditor(hooks){
  onOpen = hooks && hooks.onOpen;
}

function world(){ return G.W; }

function edButton(parent, label, active, onClick){
  var b = document.createElement('button');
  b.className = 'edb' + (active ? ' on' : '');
  b.textContent = label;
  b.addEventListener('click', function(e){ e.stopPropagation(); onClick(); edRefresh(); });
  parent.appendChild(b);
  return b;
}
function edRefresh(){
  edTools.textContent = '';
  var tools = [['тайлы','tile'],['объекты','obj'],['стереть','erase'],['рука','pan']];
  for (var i = 0; i < tools.length; i++){
    (function(t){
      edButton(edTools, t[0], ED.tool === t[1], function(){ ED.tool = t[1]; ED.pal = 0; });
    })(tools[i]);
  }
  edPal.textContent = '';
  if (ED.tool === 'tile'){
    for (var j = 0; j < ED_TILES.length; j++){
      (function(k){ edButton(edPal, ED_TILES[k][0], ED.pal === k, function(){ ED.pal = k; }); })(j);
    }
  } else if (ED.tool === 'obj'){
    for (var m = 0; m < ED_OBJS.length; m++){
      (function(k){ edButton(edPal, ED_OBJS[k][0], ED.pal === k, function(){ ED.pal = k; }); })(m);
    }
  }
}
export function edOpen(){
  ED.on = true;
  hushLift();
  if (onOpen) onOpen();
  ED.camX = cam.x; ED.camY = cam.y;
  edBar.classList.add('on');
  edRefresh();
}
export function edClose(){ ED.on = false; edBar.classList.remove('on'); }

function edCell(clientX, clientY){
  var T = G.T;
  var r = cv.getBoundingClientRect();
  var sx = (clientX - r.left) / r.width * VW;
  var sy = (clientY - r.top) / r.height * VH;
  return { c: Math.floor((sx + cam.x) / T), r: Math.floor((sy + cam.y) / T),
           x: sx + cam.x, y: sy + cam.y };
}
export function edApply(cell){
  var S = world();
  if (cell.c < 0 || cell.r < 0 || cell.c >= G.MAP_W || cell.r >= G.MAP_H) return;
  var key = cell.c + ':' + cell.r;
  if (ED.last === key && ED.tool !== 'pan') return;
  ED.last = key;
  if (ED.tool === 'tile'){
    var nv = ED_TILES[ED.pal][1];
    var old = G.tileAt(cell.c, cell.r);
    G.setTile(cell.c, cell.r, nv);
    G.buildGates(S);
    if (old === G.WATER || old === G.FALL || nv === G.WATER || nv === G.FALL) buildWater();
  } else if (ED.tool === 'erase'){
    var oldE = G.tileAt(cell.c, cell.r);
    G.setTile(cell.c, cell.r, 0);
    edEraseObjects(cell);
    G.buildGates(S);
    if (oldE === G.WATER || oldE === G.FALL) buildWater();
  } else if (ED.tool === 'obj'){
    edPlaceObject(cell);
  }
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
  var kind = ED_OBJS[ED.pal][1];
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
export function edExportText(){
  var S = world();
  var T = G.T;
  var lv = G.levelSpec(), out = [];
  out.push('// ' + lv.name + ': геометрия (вставить в build())');
  var runs = [];
  for (var r = 0; r < G.MAP_H; r++){
    var c = 0;
    while (c < G.MAP_W){
      var v = G.tileAt(c, r);
      if (v === 0){ c++; continue; }
      var n = 1;
      while (c + n < G.MAP_W && G.tileAt(c + n, r) === v) n++;
      runs.push('fillR(' + c + ', ' + r + ', ' + n + ', 1, ' + v + ');');
      c += n;
    }
  }
  out.push(runs.join('\n'));
  out.push('');
  out.push('// объекты');
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
  }).join(',') + ']');
  return out.join('\n');
}
export function edDrawOverlay(){
  var T = G.T;
  var c0 = Math.max(0, (cam.x/T|0)), c1 = Math.min(G.MAP_W-1, ((cam.x+VW)/T|0));
  var r0 = Math.max(0, (cam.y/T|0)), r1 = Math.min(G.MAP_H-1, ((cam.y+VH)/T|0));
  ctx.globalAlpha = 0.22;
  for (var c = c0; c <= c1 + 1; c++) rc(c*T - cam.x, 0, 1, VH, '#8f88bb');
  for (var r = r0; r <= r1 + 1; r++) rc(0, r*T - cam.y, VW, 1, '#8f88bb');
  ctx.globalAlpha = 1;
  if (ED.hover){
    var hx = ED.hover.c*T - cam.x, hy = ED.hover.r*T - cam.y;
    rc(hx, hy, T, 2, '#ffd9a0'); rc(hx, hy + T - 2, T, 2, '#ffd9a0');
    rc(hx, hy, 2, T, '#ffd9a0'); rc(hx + T - 2, hy, 2, T, '#ffd9a0');
  }
  rc(0, 0, VW, 9, '#0d0a18cc');
  var label = ED.tool === 'tile' ? ED_TILES[ED.pal][0] :
              (ED.tool === 'obj' ? ED_OBJS[ED.pal][0] : ED.tool);
  for (var i = 0; i < label.length && i < 14; i++)
    rc(3 + i*5, 3, 4, 4, ED.tool === 'erase' ? '#ff7a6a' : '#ffd9a0');
}

cv.addEventListener('pointerdown', function(e){
  if (!ED.on) return;
  e.preventDefault();
  var cell = edCell(e.clientX, e.clientY);
  if (ED.tool === 'pan'){
    ED.panId = e.pointerId; ED.panX = e.clientX; ED.panY = e.clientY;
    ED.camX = cam.x; ED.camY = cam.y;
  } else { ED.painting = true; ED.last = null; edApply(cell); }
  ED.hover = cell;
  try { cv.setPointerCapture(e.pointerId); } catch(_){}
});
cv.addEventListener('pointermove', function(e){
  if (!ED.on) return;
  var cell = edCell(e.clientX, e.clientY);
  ED.hover = cell;
  if (ED.tool === 'pan' && e.pointerId === ED.panId){
    var r = cv.getBoundingClientRect();
    var cl = clampCam(ED.camX - (e.clientX - ED.panX) / r.width * VW,
                      ED.camY - (e.clientY - ED.panY) / r.height * VH);
    cam.x = cl.x; cam.y = cl.y;
  } else if (ED.painting) edApply(cell);
});
function edUp(e){ ED.painting = false; ED.panId = -1; ED.last = null; }
cv.addEventListener('pointerup', edUp);
cv.addEventListener('pointercancel', edUp);

document.getElementById('bEdit').addEventListener('click', function(){
  if (isMenu()) return;
  if (ED.on) edClose(); else edOpen();
});
document.getElementById('edClose').addEventListener('click', function(){ edClose(); });
document.getElementById('edExport').addEventListener('click', function(){
  edText.value = edExportText();
  edOut.classList.add('on');
  try { edText.select(); } catch(_){}
});
document.getElementById('edOk').addEventListener('click', function(){ edOut.classList.remove('on'); });
