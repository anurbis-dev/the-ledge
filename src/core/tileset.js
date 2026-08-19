/* Кастомные тайлы: картинка + флаги. id 64..255 (Uint8).
   Черновик — ledge.dev.tiles; в игру уезжает через Bake → BAKED.tiles. */
import { BAKED } from './defaults.js';

export var CUSTOM_BASE = 64;
export var CUSTOM_MAX = 255;
var KEY = 'ledge.dev.tiles';

var tiles = [];
var byId = {};
var imgs = {};
var gfx = {};
var onChange = null;

function cloneBox(b){
  if (!b) return { x: 0, y: 0, w: 16, h: 16 };
  return {
    x: clampPix(b.x), y: clampPix(b.y),
    w: Math.max(1, Math.min(16, b.w | 0)),
    h: Math.max(1, Math.min(16, b.h | 0))
  };
}
function clampPix(n){ n = n | 0; return n < 0 ? 0 : n > 16 ? 16 : n; }

export function normalizeTile(t){
  if (!t) return null;
  return {
    id: t.id | 0,
    name: String(t.name || ('Tile ' + t.id)),
    overlay: !!t.overlay,
    src: t.src || '',
    collide: t.collide || (t.overlay ? 'none' : 'full'),
    box: cloneBox(t.box),
    oneWay: !!t.oneWay,
    climb: !!t.climb,
    front: !!t.front,
    frames: Array.isArray(t.frames) ? t.frames.filter(Boolean) : []
  };
}

function rebuild(){
  byId = {};
  var i, t;
  for (i = 0; i < tiles.length; i++){
    t = tiles[i];
    if (t && t.id >= CUSTOM_BASE) byId[t.id] = t;
  }
}

function loadSrc(key, src){
  if (!src) return;
  if (imgs[key] && imgs[key]._src === src) return;
  var img = new Image();
  img._src = src;
  img.onload = function(){ if (onChange) onChange('img'); };
  img.src = src;
  imgs[key] = img;
}

function loadImg(t){
  if (!t) return;
  if (t.frames && t.frames.length){
    var i;
    for (i = 0; i < t.frames.length; i++) loadSrc(t.id + ':' + i, t.frames[i]);
    loadSrc(t.id, t.frames[0]);
    return;
  }
  if (t.src) loadSrc(t.id, t.src);
}

function loadGfx(id){
  var g = gfx[id];
  if (!g) return;
  if (g.frames && g.frames.length){
    var i;
    for (i = 0; i < g.frames.length; i++) loadSrc(id + ':' + i, g.frames[i]);
    loadSrc(id, g.frames[0] || g.src);
    return;
  }
  if (g.src) loadSrc(id, g.src);
}

function loadAllImgs(){
  var i, id;
  for (i = 0; i < tiles.length; i++) loadImg(tiles[i]);
  for (id in gfx) if (Object.prototype.hasOwnProperty.call(gfx, id)) loadGfx(id | 0);
}

function readLocal(){
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (Array.isArray(o)) return { tiles: o, gfx: {} };
    if (o && Array.isArray(o.tiles)) return { tiles: o.tiles, gfx: o.gfx || {} };
    return null;
  } catch (_){ return null; }
}

function writeLocal(){
  try { localStorage.setItem(KEY, JSON.stringify({ tiles: tiles, gfx: gfx })); } catch (_){}
}

function cloneGfx(src){
  var out = {}, id, g;
  if (!src) return out;
  for (id in src){
    if (!Object.prototype.hasOwnProperty.call(src, id)) continue;
    g = src[id];
    if (!g) continue;
    out[id] = {
      src: g.src || '',
      frames: Array.isArray(g.frames) ? g.frames.filter(Boolean) : []
    };
  }
  return out;
}

function boot(){
  var local = readLocal();
  var baked = (BAKED && BAKED.tiles) || [];
  if (local && local.tiles && local.tiles.length) tiles = local.tiles.map(normalizeTile).filter(Boolean);
  else tiles = baked.map(normalizeTile).filter(Boolean);
  if (local && local.gfx && Object.keys(local.gfx).length) gfx = cloneGfx(local.gfx);
  else gfx = cloneGfx((BAKED && BAKED.tileGfx) || {});
  rebuild();
  loadAllImgs();
}

boot();

export function bindTileset(hooks){
  onChange = hooks && hooks.onChange;
}

export function listTiles(){ return tiles; }

export function getTileDef(id){ return byId[id] || null; }

export function isCustomId(id){ return (id | 0) >= CUSTOM_BASE; }

function readyImg(key){
  var img = imgs[key];
  return (img && img.complete && img.naturalWidth) ? img : null;
}

export function tileImage(id){
  return readyImg(id);
}

export function tileFrameImage(id, i){
  return readyImg(id + ':' + (i | 0)) || readyImg(id);
}

export function getTileGfx(id){
  return gfx[id] || null;
}

export function tileFrameCount(id){
  var t = byId[id];
  if (t && t.frames && t.frames.length) return t.frames.length;
  var g = gfx[id];
  if (g && g.frames && g.frames.length) return g.frames.length;
  if ((t && t.src) || (g && g.src)) return 1;
  return 0;
}

export function tileFrameSrc(id, i){
  var t = byId[id];
  if (t && t.frames && t.frames.length)
    return t.frames[(i | 0) % t.frames.length];
  var g = gfx[id];
  if (g && g.frames && g.frames.length)
    return g.frames[(i | 0) % g.frames.length];
  if (t && t.src) return t.src;
  if (g && g.src) return g.src;
  return '';
}

export function setTileGfx(id, patch){
  id = id | 0;
  if (id <= 0) return null;
  var cur = gfx[id] || { src: '', frames: [] };
  var next = {
    src: patch && patch.src != null ? patch.src : cur.src,
    frames: patch && patch.frames ? patch.frames.filter(Boolean) : cur.frames
  };
  if (next.frames && next.frames.length && !next.src) next.src = next.frames[0];
  if (!next.src && !(next.frames && next.frames.length)){
    delete gfx[id];
    delete imgs[id];
    emit('gfx');
    return null;
  }
  gfx[id] = next;
  loadGfx(id);
  emit('gfx');
  return next;
}

export function clearTileGfx(id){
  id = id | 0;
  if (!gfx[id]) return false;
  delete gfx[id];
  delete imgs[id];
  emit('gfx');
  return true;
}

export function snapshotGfx(){
  return cloneGfx(gfx);
}

export function customSpecs(){
  var out = [], i, t;
  for (i = 0; i < tiles.length; i++){
    t = tiles[i];
    out.push({
      name: t.name,
      id: t.id,
      color: '#6a628f',
      overlay: !!t.overlay,
      custom: true,
      src: t.src
    });
  }
  return out;
}

export function snapshotTiles(){
  return tiles.map(normalizeTile);
}

function nextId(){
  var used = {}, i, id;
  for (i = 0; i < tiles.length; i++) used[tiles[i].id] = 1;
  for (id = CUSTOM_BASE; id <= CUSTOM_MAX; id++)
    if (!used[id]) return id;
  return 0;
}

function emit(why){
  writeLocal();
  if (onChange) onChange(why || 'change');
}

export function addTile(partial){
  var id = partial && partial.id && !byId[partial.id] ? (partial.id | 0) : nextId();
  if (!id) return null;
  var t = normalizeTile({
    id: id,
    name: (partial && partial.name) || ('Tile ' + id),
    overlay: partial && partial.overlay != null ? !!partial.overlay : true,
    src: (partial && partial.src) || '',
    collide: (partial && partial.collide) || 'none',
    box: partial && partial.box,
    oneWay: partial && partial.oneWay,
    climb: partial && partial.climb,
    front: partial && partial.front,
    frames: partial && partial.frames
  });
  tiles.push(t);
  rebuild();
  loadImg(t);
  emit('add');
  pushTileFile(t);
  return t;
}

export function updateTile(id, patch){
  var t = byId[id];
  if (!t) return null;
  var k;
  for (k in patch) if (k !== 'id') t[k] = patch[k];
  t = normalizeTile(t);
  var i;
  for (i = 0; i < tiles.length; i++)
    if (tiles[i].id === id){ tiles[i] = t; break; }
  rebuild();
  loadImg(t);
  emit('update');
  pushTileFile(t);
  return t;
}

export function removeTile(id){
  tiles = tiles.filter(function(t){ return t.id !== id; });
  delete imgs[id];
  rebuild();
  emit('remove');
  return true;
}

export function replaceTiles(list){
  tiles = (list || []).map(normalizeTile).filter(Boolean);
  rebuild();
  loadAllImgs();
  emit('replace');
}

/* PNG → dataURL 16×16 (nearest, без сглаживания) */
export function canvasToPng(can){
  return can.toDataURL('image/png');
}

export function sliceSheet(img, name, cellW, cellH){
  cellW = cellW || 16;
  cellH = cellH || 16;
  var w = img.naturalWidth || img.width;
  var h = img.naturalHeight || img.height;
  var cols = Math.max(1, Math.floor(w / cellW));
  var rows = Math.max(1, Math.floor(h / cellH));
  if (w < cellW || h < cellH){
    cols = 1; rows = 1;
  }
  var out = [], r, c, can, cx, sx, sy;
  var base = (name || 'tile').replace(/\.[a-z0-9]+$/i, '');
  for (r = 0; r < rows; r++){
    for (c = 0; c < cols; c++){
      can = document.createElement('canvas');
      can.width = cellW; can.height = cellH;
      cx = can.getContext('2d');
      cx.imageSmoothingEnabled = false;
      if (w < cellW || h < cellH){
        cx.drawImage(img, 0, 0, w, h, 0, 0, cellW, cellH);
      } else {
        sx = c * cellW; sy = r * cellH;
        cx.drawImage(img, sx, sy, cellW, cellH, 0, 0, cellW, cellH);
      }
      out.push({
        name: cols * rows === 1 ? base : (base + ' ' + (r * cols + c + 1)),
        src: canvasToPng(can),
        col: c,
        row: r
      });
    }
  }
  return out;
}

export function loadImageFile(file){
  return new Promise(function(resolve, reject){
    var fr = new FileReader();
    fr.onerror = function(){ reject(new Error('read')); };
    fr.onload = function(){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = function(){ reject(new Error('img')); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function hasAlpha(src){
  try {
    var img = new Image();
    img.src = src;
    return true;
  } catch (_){ return true; }
}

export function guessOverlay(src){
  return new Promise(function(resolve){
    var img = new Image();
    img.onload = function(){
      var can = document.createElement('canvas');
      can.width = 16; can.height = 16;
      var cx = can.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, 0, 0, 16, 16);
      var data = cx.getImageData(0, 0, 16, 16).data;
      var i, a, seen = false;
      for (i = 3; i < data.length; i += 4){
        a = data[i];
        if (a < 250){ seen = true; break; }
      }
      resolve(seen);
    };
    img.onerror = function(){ resolve(true); };
    img.src = src;
  });
}

function pushTileFile(t){
  if (!t || !t.src) return;
  try {
    if (location.protocol === 'file:') return;
    fetch('/__tile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tile: t })
    }).catch(function(){});
  } catch (_){}
}

export function pushAllTileFiles(){
  var i;
  for (i = 0; i < tiles.length; i++) pushTileFile(tiles[i]);
}

void hasAlpha;
