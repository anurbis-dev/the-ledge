import GAME from '../core/game.js';
import {
  getTileDef, updateTile, removeTile, getTileGfx, setTileGfx, clearTileGfx,
  tileFrameCount, tileFrameSrc, canvasToPng, loadImageFile, sliceSheet
} from '../core/tileset.js';
import {
  getSpriteDef, getSpriteFrameSrc, setSpriteFrame, clearSpriteFrame,
  isSpriteFrameDirty
} from '../core/spriteset.js';
import { bakeSpriteFrameSrc, bakeBuiltinTileSrc } from '../render/sprite-bake.js';
import { wipeTileId } from '../core/layers.js';
import { raiseFloat, placeFloat, hasFloatPos } from './float.js';
import { invalidateAll } from '../render/tiles.js';
import { clearThumbCache, paintTileIcon } from './thumbs.js';

var root = document.getElementById('edTileEdit');
var titleEl = document.getElementById('edTileEditTitle');
var body = document.getElementById('edTileEditBody');
var current = null;
var mode = 'tile';
var fw = 16, fh = 16;
var animId = '';
var frameI = 0;
var onChange = null;

var TOOLS = [
  { id: 'pencil', name: 'Paint', title: 'Paint pixels (LMB). RMB erases.' },
  { id: 'eraser', name: 'Erase', title: 'Erase pixels to transparent.' },
  { id: 'pick', name: 'Pick', title: 'Pick color from a pixel.' },
  { id: 'hitbox', name: 'Hit', title: 'Drag the collision box the hero hits — not the picture.' }
];

var COLLIDE = [
  { id: 'none', name: 'None — walk through' },
  { id: 'full', name: 'Full cell 16×16' },
  { id: 'half', name: 'Top half (stand)' },
  { id: 'bar', name: 'Bar (hang lip)' },
  { id: 'slope-r', name: 'Slope ↗' },
  { id: 'slope-l', name: 'Slope ↖' },
  { id: 'custom', name: 'Custom box' }
];

var HINT = {
  pencil: 'LMB paint · RMB erase · Alt pick. Pixels are only a picture.',
  eraser: 'LMB erase to transparent. The hero still hits the red box, not empty pixels.',
  pick: 'LMB take color from a pixel.',
  hitbox: 'Drag the red frame. That box is collision — the picture does not change it.'
};

var tool = 'pencil';
var color = '#e8dcc8';
var buf = null;
var preview = null;
var hintEl = null;
var hitLab = null;
var toolsEl = null;
var swatchEl = null;
var colorInp = null;
var stripsEl = null;
var painting = null;
var boxDrag = null;
var pendingBox = null;
var loadGen = 0;

export function bindTileEdit(hooks){
  onChange = hooks && hooks.onChange;
}

export function closeTileEdit(){
  current = null;
  painting = null;
  boxDrag = null;
  mode = 'tile';
  if (root){
    root.hidden = true;
    root.classList.remove('ed-sprite');
  }
}

function isSprite(){ return mode === 'sprite'; }
function isCustomTile(){ return mode === 'tile' && current && current.custom; }
function canPaint(){ return isSprite() || isCustomTile() || (mode === 'tile' && current && current.id); }

export function openTileEdit(spec, clientX, clientY){
  if (!root || !spec) return;
  mode = 'tile';
  fw = 16; fh = 16;
  animId = '';
  frameI = 0;
  current = spec;
  root.classList.remove('ed-sprite');
  root.hidden = false;
  if (titleEl) titleEl.textContent = spec.custom ? 'Tile' : 'Tile (sprite)';
  fillBody();
  if (!hasFloatPos(root))
    placeFloat(root, innerWidth - 320, 48);
  raiseFloat(root);
  void clientX; void clientY;
}

export function openSpriteEdit(def, clientX, clientY){
  if (!root || !def) return;
  mode = 'sprite';
  current = def;
  fw = def.fw || 16;
  fh = def.fh || 16;
  animId = def.anims && def.anims[0] ? def.anims[0].id : '';
  frameI = 0;
  root.classList.add('ed-sprite');
  root.hidden = false;
  if (titleEl) titleEl.textContent = def.name || 'Sprite';
  fillBody();
  if (!hasFloatPos(root))
    placeFloat(root, innerWidth - 400, 40);
  raiseFloat(root);
  void clientX; void clientY;
}

function builtinCollide(spec){
  var id = spec.id;
  if (!id) return 'none';
  if (GAME.isLadV(id)) return 'climb';
  if (GAME.isBarV(id)) return 'bar';
  if (GAME.isHalfV(id)) return 'half';
  if (GAME.isSlopeV(id)) return GAME.slopeRiseRight(id) ? 'slope-r' : 'slope-l';
  if (GAME.isSolidV(id)) return 'full';
  return 'none';
}

function notify(){
  clearThumbCache();
  invalidateAll();
  if (onChange) onChange();
}

function field(label, el){
  var row = document.createElement('label');
  row.className = 'ed-field';
  var sp = document.createElement('span');
  sp.textContent = label;
  row.appendChild(sp);
  row.appendChild(el);
  body.appendChild(row);
  return row;
}

function makeBuf(){
  var c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  var cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = false;
  return c;
}

function currentSrc(){
  if (isSprite()){
    var saved = getSpriteFrameSrc(current.id, animId, frameI);
    if (saved) return saved;
    return bakeSpriteFrameSrc(current.id, animId, frameI);
  }
  if (isCustomTile()){
    var def = getTileDef(current.id);
    if (def && def.frames && def.frames.length) return def.frames[frameI] || def.src;
    return (def && def.src) || current.src || '';
  }
  var g = getTileGfx(current.id);
  if (g && g.frames && g.frames.length) return g.frames[frameI] || g.src;
  if (g && g.src) return g.src;
  return bakeBuiltinTileSrc(current);
}

function loadBuf(src, done){
  var gen = ++loadGen;
  buf = makeBuf();
  if (!src){ if (done) done(); return; }
  var img = new Image();
  img.onload = function(){
    if (gen !== loadGen) return;
    var cx = buf.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.clearRect(0, 0, fw, fh);
    cx.drawImage(img, 0, 0, img.naturalWidth || fw, img.naturalHeight || fh, 0, 0, fw, fh);
    if (done) done();
  };
  img.onerror = function(){ if (gen !== loadGen) return; if (done) done(); };
  img.src = src;
}

function hexToRgb(hex){
  var h = String(hex || '#ffffff').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  if (isNaN(n)) return { r: 232, g: 220, b: 200 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b){
  function p(n){ n = n | 0; return (n < 16 ? '0' : '') + n.toString(16); }
  return '#' + p(r) + p(g) + p(b);
}

function cellOf(e, can){
  var r = can.getBoundingClientRect();
  var x = Math.floor((e.clientX - r.left) / r.width * fw);
  var y = Math.floor((e.clientY - r.top) / r.height * fh);
  if (x < 0) x = 0; if (x > fw - 1) x = fw - 1;
  if (y < 0) y = 0; if (y > fh - 1) y = fh - 1;
  return { x: x, y: y };
}

function edgeOf(e, can){
  var r = can.getBoundingClientRect();
  var x = Math.round((e.clientX - r.left) / r.width * fw);
  var y = Math.round((e.clientY - r.top) / r.height * fh);
  if (x < 0) x = 0; if (x > fw) x = fw;
  if (y < 0) y = 0; if (y > fh) y = fh;
  return { x: x, y: y };
}

function stamp(x, y, erase){
  if (!buf) return;
  var cx = buf.getContext('2d');
  if (erase) cx.clearRect(x, y, 1, 1);
  else {
    var rgb = hexToRgb(color);
    cx.fillStyle = 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
    cx.clearRect(x, y, 1, 1);
    cx.fillRect(x, y, 1, 1);
  }
}

function stampLine(x0, y0, x1, y1, erase){
  var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  var err = dx - dy;
  while (true){
    stamp(x0, y0, erase);
    if (x0 === x1 && y0 === y1) break;
    var e2 = 2 * err;
    if (e2 > -dy){ err -= dy; x0 += sx; }
    if (e2 < dx){ err += dx; y0 += sy; }
  }
}

function pickAt(e){
  if (!buf) return;
  var p = cellOf(e, preview);
  var d = buf.getContext('2d').getImageData(p.x, p.y, 1, 1).data;
  if (d[3] < 8){
    tool = 'eraser';
    syncTools();
    return;
  }
  color = rgbToHex(d[0], d[1], d[2]);
  if (colorInp) colorInp.value = color;
  fillSwatches();
}

function commitSrc(){
  if (!buf || !current) return;
  var src = canvasToPng(buf);
  if (isSprite()){
    setSpriteFrame(current.id, animId, frameI, src, true);
    notify();
    paintStrips();
    return;
  }
  if (isCustomTile()){
    var def = getTileDef(current.id);
    if (def && def.frames && def.frames.length){
      var fr = def.frames.slice();
      fr[frameI] = src;
      updateTile(current.id, { frames: fr, src: frameI === 0 ? src : def.src });
    } else {
      updateTile(current.id, { src: src });
      current.src = src;
    }
    notify();
    paintStrips();
    fillSwatches();
    return;
  }
  if (current.id){
    var g = getTileGfx(current.id) || { src: '', frames: [] };
    if (g.frames && g.frames.length){
      var gf = g.frames.slice();
      gf[frameI] = src;
      setTileGfx(current.id, { frames: gf, src: frameI === 0 ? src : g.src });
    } else {
      setTileGfx(current.id, { src: src });
    }
    notify();
    paintStrips();
    fillSwatches();
  }
}

function uniqueColors(){
  if (!buf) return [];
  var data = buf.getContext('2d').getImageData(0, 0, fw, fh).data;
  var seen = {}, out = [], i, key;
  for (i = 0; i < data.length; i += 4){
    if (data[i + 3] < 8) continue;
    key = data[i] + ',' + data[i + 1] + ',' + data[i + 2];
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(rgbToHex(data[i], data[i + 1], data[i + 2]));
    if (out.length >= 16) break;
  }
  return out;
}

function fillSwatches(){
  if (!swatchEl) return;
  swatchEl.textContent = '';
  var cols = uniqueColors(), i;
  if (color && cols.indexOf(color) < 0) cols.unshift(color);
  for (i = 0; i < cols.length; i++){
    (function(hex){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-tile-chip' + (hex === color ? ' on' : '');
      b.style.background = hex;
      b.title = hex;
      b.addEventListener('click', function(){
        color = hex;
        tool = 'pencil';
        if (colorInp) colorInp.value = hex;
        syncTools();
        fillSwatches();
      });
      swatchEl.appendChild(b);
    })(cols[i]);
  }
}

function hitText(){
  if (!current || isSprite()) return '';
  var def = isCustomTile() ? getTileDef(current.id) : null;
  var col = pendingBox ? 'custom' : (def ? def.collide : builtinCollide(current));
  var box = pendingBox || (def && def.box);
  if (col === 'none') return 'No collision — hero walks through. Pixels are decoration.';
  if (col === 'full') return 'Hero hits the whole 16×16 cell. Red outline = collision, not the picture.';
  if (col === 'half') return 'Hero stands on the top 8 px. Red outline = collision.';
  if (col === 'bar') return 'Hang bar: 3 px lip at the top. Red outline = collision.';
  if (col === 'slope-r') return 'Slope ↗ — hero walks the diagonal, not the pixels.';
  if (col === 'slope-l') return 'Slope ↖ — hero walks the diagonal, not the pixels.';
  if (col === 'custom' && box)
    return 'Hero hits ' + box.x + ',' + box.y + '  ' + box.w + '×' + box.h + ' px (red). Pixels do not collide.';
  return 'Collision: ' + col;
}

function drawHitShape(cx, s, k, filled){
  if (!current || isSprite() || fw !== 16 || fh !== 16) return;
  var def = isCustomTile() ? getTileDef(current.id) : null;
  var col = pendingBox ? 'custom' : (def ? def.collide : builtinCollide(current));
  var box = pendingBox || (def && def.box);
  if (col === 'none') return;
  cx.save();
  cx.fillStyle = filled ? '#ff5a4a55' : 'rgba(0,0,0,0)';
  cx.strokeStyle = '#ffd0c4';
  cx.lineWidth = 2;
  if (col === 'full'){
    if (filled) cx.fillRect(0, 0, s, s);
    cx.strokeRect(1, 1, s - 2, s - 2);
  } else if (col === 'half'){
    if (filled) cx.fillRect(0, 0, s, 8 * k);
    cx.strokeRect(1, 1, s - 2, 8 * k - 2);
  } else if (col === 'bar'){
    if (filled) cx.fillRect(0, 0, s, 3 * k);
    cx.strokeRect(1, 1, s - 2, 3 * k - 2);
  } else if (col === 'custom' && box){
    if (filled) cx.fillRect(box.x * k, box.y * k, box.w * k, box.h * k);
    cx.strokeRect(box.x * k + 1, box.y * k + 1, Math.max(0, box.w * k - 2), Math.max(0, box.h * k - 2));
  } else if (col === 'slope-r'){
    cx.beginPath(); cx.moveTo(0, s); cx.lineTo(s, 0); cx.lineTo(s, s); cx.closePath();
    if (filled) cx.fill();
    cx.stroke();
  } else if (col === 'slope-l'){
    cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(s, s); cx.lineTo(0, s); cx.closePath();
    if (filled) cx.fill();
    cx.stroke();
  }
  cx.restore();
}

function paintCanvas(){
  if (!preview) return;
  var can = preview;
  var cx = can.getContext('2d');
  var sx = can.width / fw, sy = can.height / fh, i, j;
  cx.imageSmoothingEnabled = false;
  for (j = 0; j < fh; j++){
    for (i = 0; i < fw; i++){
      cx.fillStyle = ((i + j) & 1) ? '#2a2040' : '#1a1228';
      cx.fillRect(i * sx, j * sy, sx, sy);
    }
  }
  if (buf) cx.drawImage(buf, 0, 0, fw, fh, 0, 0, can.width, can.height);
  else if (current && mode === 'tile' && !current.custom) paintTileIcon(cx, current, can.width);
  cx.strokeStyle = '#3a346055';
  cx.lineWidth = 1;
  for (i = 0; i <= fw; i++){
    cx.beginPath(); cx.moveTo(i * sx + 0.5, 0); cx.lineTo(i * sx + 0.5, can.height); cx.stroke();
  }
  for (j = 0; j <= fh; j++){
    cx.beginPath(); cx.moveTo(0, j * sy + 0.5); cx.lineTo(can.width, j * sy + 0.5); cx.stroke();
  }
  drawHitShape(cx, can.width, sx, tool === 'hitbox');
  if (hitLab) hitLab.textContent = isSprite()
    ? 'Frame ' + (frameI + 1) + ' · ' + (current.anims.filter(function(a){ return a.id === animId; })[0] || { name: animId }).name
    : hitText();
  if (preview){
    preview.classList.toggle('tool-erase', tool === 'eraser');
    preview.classList.toggle('tool-pick', tool === 'pick');
    preview.classList.toggle('tool-hit', tool === 'hitbox');
    preview.title = tool === 'hitbox'
      ? 'Drag to set the collision box (what the hero hits)'
      : (tool === 'eraser' ? 'Erase pixel' : (tool === 'pick' ? 'Pick color' : 'Paint pixel · RMB erase'));
  }
}

function syncTools(){
  if (toolsEl){
    var btns = toolsEl.querySelectorAll('[data-tool]'), i;
    for (i = 0; i < btns.length; i++)
      btns[i].classList.toggle('on', btns[i].getAttribute('data-tool') === tool);
  }
  if (hintEl) hintEl.textContent = isSprite()
    ? (HINT[tool] === HINT.hitbox ? 'LMB paint · RMB erase. This frame is the picture the game can blit.' : (HINT[tool] || HINT.pencil))
    : (HINT[tool] || HINT.pencil);
  paintCanvas();
}

function applyBox(x0, y0, x1, y1){
  if (!isCustomTile()) return;
  var x = Math.min(x0, x1), y = Math.min(y0, y1);
  var w = Math.max(1, Math.abs(x1 - x0)), h = Math.max(1, Math.abs(y1 - y0));
  if (x + w > 16) w = 16 - x;
  if (y + h > 16) h = 16 - y;
  pendingBox = { x: x, y: y, w: w, h: h };
  var sel = body && body.querySelector('select');
  if (sel) sel.value = 'custom';
  paintCanvas();
}

function commitBox(){
  if (!isCustomTile() || !pendingBox) return;
  updateTile(current.id, { collide: 'custom', box: pendingBox });
  pendingBox = null;
  notify();
}

function bindPreview(can){
  can.addEventListener('contextmenu', function(e){ e.preventDefault(); e.stopPropagation(); });
  can.addEventListener('pointerdown', function(e){
    if (!canPaint()) return;
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    try { can.setPointerCapture(e.pointerId); } catch (_){}
    if (tool === 'hitbox'){
      if (e.button !== 0 || !isCustomTile()) return;
      var a = edgeOf(e, can);
      boxDrag = { x0: a.x, y0: a.y };
      applyBox(a.x, a.y, a.x, a.y);
      return;
    }
    if (e.button === 0 && (tool === 'pick' || e.altKey)){
      pickAt(e);
      return;
    }
    var erase = tool === 'eraser' || e.button === 2;
    var p = cellOf(e, can);
    painting = { erase: erase, x: p.x, y: p.y };
    stamp(p.x, p.y, erase);
    paintCanvas();
  });
  can.addEventListener('pointermove', function(e){
    if (boxDrag){
      var b = edgeOf(e, can);
      applyBox(boxDrag.x0, boxDrag.y0, b.x, b.y);
      return;
    }
    if (!painting) return;
    var p = cellOf(e, can);
    stampLine(painting.x, painting.y, p.x, p.y, painting.erase);
    painting.x = p.x; painting.y = p.y;
    paintCanvas();
  });
  function end(e){
    if (boxDrag){
      boxDrag = null;
      commitBox();
      return;
    }
    if (painting){
      painting = null;
      commitSrc();
    }
    void e;
  }
  can.addEventListener('pointerup', end);
  can.addEventListener('pointercancel', end);
}

function selectFrame(nextAnim, nextI){
  if (nextAnim === animId && nextI === frameI) return;
  animId = nextAnim;
  frameI = nextI;
  loadBuf(currentSrc(), function(){
    fillSwatches();
    syncTools();
    paintStrips();
  });
  paintCanvas();
}

function frameSrcAt(aId, i){
  if (isSprite()){
    var s = getSpriteFrameSrc(current.id, aId, i);
    return s || bakeSpriteFrameSrc(current.id, aId, i);
  }
  return tileFrameSrc(current.id, i) || currentSrc();
}

function paintStrips(){
  if (!stripsEl) return;
  var rows = [];
  if (isSprite()){
    rows = current.anims.map(function(a){ return { id: a.id, name: a.name, n: a.n }; });
  } else {
    var n = tileFrameCount(current.id);
    if (n > 1) rows = [{ id: '', name: 'Frames', n: n }];
  }
  if (!rows.length){
    stripsEl.hidden = true;
    stripsEl.textContent = '';
    return;
  }
  stripsEl.hidden = false;
  stripsEl.textContent = '';
  var r;
  for (r = 0; r < rows.length; r++){
    (function(row){
      var wrap = document.createElement('div');
      wrap.className = 'ed-tile-anim';
      var lab = document.createElement('div');
      lab.className = 'ed-tile-anim-name';
      lab.textContent = row.name;
      wrap.appendChild(lab);
      var bar = document.createElement('div');
      bar.className = 'ed-tile-anim-frames';
      var i;
      for (i = 0; i < row.n; i++){
        (function(ii){
          var th = document.createElement('canvas');
          th.width = fw;
          th.height = fh;
          th.className = 'ed-tile-frame' + (row.id === animId && ii === frameI ? ' on' : '');
          if (isSprite() && isSpriteFrameDirty(current.id, row.id, ii))
            th.classList.add('dirty');
          th.title = row.name + ' ' + (ii + 1);
          var cx = th.getContext('2d');
          cx.imageSmoothingEnabled = false;
          cx.fillStyle = '#1a1228';
          cx.fillRect(0, 0, fw, fh);
          var img = new Image();
          img.onload = function(){
            cx.imageSmoothingEnabled = false;
            cx.clearRect(0, 0, fw, fh);
            cx.drawImage(img, 0, 0, img.naturalWidth || fw, img.naturalHeight || fh, 0, 0, fw, fh);
          };
          img.src = frameSrcAt(row.id, ii);
          th.addEventListener('click', function(){
            selectFrame(row.id, ii);
          });
          bar.appendChild(th);
        })(i);
      }
      wrap.appendChild(bar);
      stripsEl.appendChild(wrap);
    })(rows[r]);
  }
}

function applyImportFile(file){
  if (!current || !file || !canPaint()) return;
  loadImageFile(file).then(function(img){
    var slices = sliceSheet(img, file.name, fw, fh);
    if (!slices.length) return;
    if (isSprite()){
      var a = current.anims.filter(function(x){ return x.id === animId; })[0];
      if (slices.length === 1){
        setSpriteFrame(current.id, animId, frameI, slices[0].src, true);
      } else if (a){
        var i, n = Math.min(a.n, slices.length);
        for (i = 0; i < n; i++) setSpriteFrame(current.id, animId, i, slices[i].src, true);
      }
      notify();
      fillBody();
      return;
    }
    if (slices.length > 1){
      var srcs = slices.map(function(s){ return s.src; });
      if (isCustomTile()){
        updateTile(current.id, { src: srcs[0], frames: srcs });
        current.src = srcs[0];
      } else {
        setTileGfx(current.id, { src: srcs[0], frames: srcs });
      }
    } else if (isCustomTile()){
      updateTile(current.id, { src: slices[0].src });
      current.src = slices[0].src;
    } else {
      setTileGfx(current.id, { src: slices[0].src });
    }
    notify();
    fillBody();
  }).catch(function(){});
}

function scaleOf(){
  var m = Math.max(fw, fh);
  var s = Math.floor(192 / m);
  if (s < 4) s = 4;
  if (s > 10) s = 10;
  return s;
}

function fillBody(){
  if (!body || !current) return;
  body.textContent = '';
  preview = null;
  hintEl = null;
  hitLab = null;
  toolsEl = null;
  swatchEl = null;
  colorInp = null;
  stripsEl = null;
  painting = null;
  boxDrag = null;
  pendingBox = null;
  var custom = isCustomTile();
  var def = custom ? getTileDef(current.id) : null;
  var sprite = isSprite();

  stripsEl = document.createElement('div');
  stripsEl.className = 'ed-tile-strips';
  body.appendChild(stripsEl);

  var sc = scaleOf();
  var can = document.createElement('canvas');
  can.width = fw * sc;
  can.height = fh * sc;
  can.className = 'ed-tilegeo';
  can.style.aspectRatio = fw + ' / ' + fh;
  body.appendChild(can);
  preview = can;

  hitLab = document.createElement('div');
  hitLab.className = 'ed-tile-hitlab';
  body.appendChild(hitLab);

  toolsEl = document.createElement('div');
  toolsEl.className = 'ed-tile-tools';
  var t, list = sprite ? TOOLS.filter(function(x){ return x.id !== 'hitbox'; }) : TOOLS;
  if (tool === 'hitbox' && sprite) tool = 'pencil';
  for (t = 0; t < list.length; t++){
    (function(specT){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'edb';
      b.setAttribute('data-tool', specT.id);
      b.textContent = specT.name;
      b.title = specT.title;
      b.addEventListener('click', function(){
        tool = specT.id;
        syncTools();
      });
      toolsEl.appendChild(b);
    })(list[t]);
  }
  body.appendChild(toolsEl);

  hintEl = document.createElement('div');
  hintEl.className = 'ed-tile-note';
  body.appendChild(hintEl);

  colorInp = document.createElement('input');
  colorInp.type = 'color';
  colorInp.value = color;
  colorInp.title = 'Paint color';
  colorInp.addEventListener('input', function(){
    color = colorInp.value;
    tool = 'pencil';
    syncTools();
    fillSwatches();
  });
  field('Color', colorInp);

  swatchEl = document.createElement('div');
  swatchEl.className = 'ed-tile-swatches';
  body.appendChild(swatchEl);

  if (sprite){
    var sNote = document.createElement('div');
    sNote.className = 'ed-tile-note';
    sNote.textContent = 'Each row is one animation. Click a frame to paint it. Unedited frames still use the old drawing in the game.';
    body.appendChild(sNote);
  } else {
    var nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.value = current.name || '';
    nameInp.maxLength = 24;
    nameInp.disabled = !custom;
    nameInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
    nameInp.addEventListener('change', function(){
      if (!def) return;
      updateTile(def.id, { name: nameInp.value.trim() || def.name });
      current.name = nameInp.value.trim() || current.name;
      notify();
    });
    field('Name', nameInp);

    var over = document.createElement('input');
    over.type = 'checkbox';
    over.checked = !!(def ? def.overlay : false);
    over.disabled = !custom;
    over.addEventListener('change', function(){
      if (!def) return;
      updateTile(def.id, { overlay: over.checked, collide: over.checked ? 'none' : (def.collide === 'none' ? 'full' : def.collide) });
      current.overlay = over.checked;
      notify();
      fillBody();
    });
    var overRow = document.createElement('label');
    overRow.className = 'ed-check';
    overRow.appendChild(over);
    overRow.appendChild(document.createTextNode(' Overlay — decoration on top of the main tile (no collision)'));
    body.appendChild(overRow);

    var front = document.createElement('input');
    front.type = 'checkbox';
    front.checked = !!(def && def.front);
    front.disabled = !custom;
    front.addEventListener('change', function(){
      if (!def) return;
      updateTile(def.id, { front: front.checked });
      notify();
    });
    var frontRow = document.createElement('label');
    frontRow.className = 'ed-check';
    frontRow.appendChild(front);
    frontRow.appendChild(document.createTextNode(' Draw in front of the hero'));
    body.appendChild(frontRow);

    var climb = document.createElement('input');
    climb.type = 'checkbox';
    climb.checked = !!(def && def.climb);
    climb.disabled = !custom;
    climb.addEventListener('change', function(){
      if (!def) return;
      updateTile(def.id, { climb: climb.checked });
      notify();
      paintCanvas();
    });
    var climbRow = document.createElement('label');
    climbRow.className = 'ed-check';
    climbRow.appendChild(climb);
    climbRow.appendChild(document.createTextNode(' Climbable (ladder)'));
    body.appendChild(climbRow);

    var oneWay = document.createElement('input');
    oneWay.type = 'checkbox';
    oneWay.checked = !!(def && def.oneWay);
    oneWay.disabled = !custom;
    oneWay.addEventListener('change', function(){
      if (!def) return;
      updateTile(def.id, { oneWay: oneWay.checked });
      notify();
    });
    var owRow = document.createElement('label');
    owRow.className = 'ed-check';
    owRow.appendChild(oneWay);
    owRow.appendChild(document.createTextNode(' One-way — stand from above, pass from below'));
    body.appendChild(owRow);

    var sel = document.createElement('select');
    var curCol = def ? def.collide : builtinCollide(current);
    var i;
    for (i = 0; i < COLLIDE.length; i++){
      var o = document.createElement('option');
      o.value = COLLIDE[i].id;
      o.textContent = COLLIDE[i].name;
      if (COLLIDE[i].id === curCol) o.selected = true;
      sel.appendChild(o);
    }
    sel.disabled = !custom;
    sel.addEventListener('change', function(){
      if (!def) return;
      var box = def.box;
      if (sel.value === 'half') box = { x: 0, y: 0, w: 16, h: 8 };
      if (sel.value === 'bar') box = { x: 0, y: 0, w: 16, h: 3 };
      if (sel.value === 'full') box = { x: 0, y: 0, w: 16, h: 16 };
      if (sel.value === 'none') tool = tool === 'hitbox' ? 'pencil' : tool;
      if (sel.value === 'custom') tool = 'hitbox';
      updateTile(def.id, { collide: sel.value, box: box });
      notify();
      fillBody();
    });
    field('Collision', sel);

    if (!custom){
      var bNote = document.createElement('div');
      bNote.className = 'ed-tile-note';
      bNote.textContent = 'Paint replaces the picture with a sprite. Built-in collision stays. Reset picture goes back to the old drawing.';
      body.appendChild(bNote);
    }
  }

  var actions = document.createElement('div');
  actions.className = 'ed-tile-actions';

  var fileInp = document.createElement('input');
  fileInp.type = 'file';
  fileInp.accept = 'image/png,image/gif,image/webp,image/jpeg';
  fileInp.hidden = true;
  fileInp.addEventListener('change', function(){
    var f = fileInp.files && fileInp.files[0];
    fileInp.value = '';
    if (f) applyImportFile(f);
  });
  actions.appendChild(fileInp);

  var reimp = document.createElement('button');
  reimp.type = 'button';
  reimp.className = 'edb wide';
  reimp.textContent = 'Re-import PNG';
  reimp.title = sprite
    ? 'Replace this frame, or a whole row if the sheet is a strip of frames.'
    : 'Replace this tile’s picture. A sheet becomes animation frames. Flags stay.';
  reimp.addEventListener('click', function(){ fileInp.click(); });
  actions.appendChild(reimp);

  if (sprite){
    var rst = document.createElement('button');
    rst.type = 'button';
    rst.className = 'edb';
    rst.textContent = 'Reset frame';
    rst.title = 'Forget the painted frame; the game uses the old drawing again.';
    rst.addEventListener('click', function(){
      clearSpriteFrame(current.id, animId, frameI);
      notify();
      loadBuf(currentSrc(), function(){
        fillSwatches();
        syncTools();
        paintStrips();
      });
    });
    actions.appendChild(rst);
  } else if (custom){
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'edb';
    del.textContent = 'Delete';
    del.addEventListener('click', function(){
      if (!def) return;
      wipeTileId(def.id);
      removeTile(def.id);
      notify();
      closeTileEdit();
    });
    actions.appendChild(del);
  } else {
    var rstT = document.createElement('button');
    rstT.type = 'button';
    rstT.className = 'edb';
    rstT.textContent = 'Reset picture';
    rstT.addEventListener('click', function(){
      clearTileGfx(current.id);
      notify();
      fillBody();
    });
    actions.appendChild(rstT);
  }
  body.appendChild(actions);

  paintStrips();
  loadBuf(currentSrc(), function(){
    fillSwatches();
    syncTools();
  });
  bindPreview(can);
  syncTools();
}

if (root){
  root.addEventListener('dragover', function(e){
    if (!current || !canPaint()) return;
    var dt = e.dataTransfer;
    if (!dt) return;
    e.preventDefault();
    e.stopPropagation();
    dt.dropEffect = 'copy';
  });
  root.addEventListener('drop', function(e){
    if (!current || !canPaint()) return;
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    e.stopPropagation();
    applyImportFile(files[0]);
  });
}

var closeBtn = document.getElementById('edTileEditX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeTileEdit(); });
