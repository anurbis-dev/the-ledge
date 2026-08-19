/* Кастомные тайлы: картинка + флаги. id 64..255 (Uint8).
   Черновик — ledge.dev.tiles; в игру уезжает через Bake → BAKED.tiles. */
import { BAKED } from './defaults.js';

export var CUSTOM_BASE = 64;
export var CUSTOM_MAX = 255;
var KEY = 'ledge.dev.tiles';

var tiles = [];
var byId = {};
var imgs = {};
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
    front: !!t.front
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

function loadImg(t){
  if (!t || !t.src) return;
  if (imgs[t.id] && imgs[t.id]._src === t.src) return;
  var img = new Image();
  img._src = t.src;
  img.onload = function(){ if (onChange) onChange('img'); };
  img.src = t.src;
  imgs[t.id] = img;
}

function loadAllImgs(){
  var i;
  for (i = 0; i < tiles.length; i++) loadImg(tiles[i]);
}

function readLocal(){
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (Array.isArray(o)) return o;
    if (o && Array.isArray(o.tiles)) return o.tiles;
    return null;
  } catch (_){ return null; }
}

function writeLocal(){
  try { localStorage.setItem(KEY, JSON.stringify({ tiles: tiles })); } catch (_){}
}

function boot(){
  var local = readLocal();
  var baked = (BAKED && BAKED.tiles) || [];
  if (local && local.length) tiles = local.map(normalizeTile).filter(Boolean);
  else tiles = baked.map(normalizeTile).filter(Boolean);
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

export function tileImage(id){
  var img = imgs[id];
  return (img && img.complete && img.naturalWidth) ? img : null;
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
    front: partial && partial.front
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

export function sliceSheet(img, name){
  var w = img.naturalWidth || img.width;
  var h = img.naturalHeight || img.height;
  var cols = Math.max(1, Math.floor(w / 16));
  var rows = Math.max(1, Math.floor(h / 16));
  if (w < 16 || h < 16){
    cols = 1; rows = 1;
  }
  var out = [], r, c, can, cx, sx, sy, dw, dh;
  var base = (name || 'tile').replace(/\.[a-z0-9]+$/i, '');
  for (r = 0; r < rows; r++){
    for (c = 0; c < cols; c++){
      can = document.createElement('canvas');
      can.width = 16; can.height = 16;
      cx = can.getContext('2d');
      cx.imageSmoothingEnabled = false;
      if (w < 16 || h < 16){
        dw = w; dh = h;
        cx.drawImage(img, 0, 0, w, h, 0, 0, 16, 16);
      } else {
        sx = c * 16; sy = r * 16;
        cx.drawImage(img, sx, sy, 16, 16, 0, 0, 16, 16);
      }
      out.push({
        name: cols * rows === 1 ? base : (base + ' ' + (r * cols + c + 1)),
        src: canvasToPng(can)
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
