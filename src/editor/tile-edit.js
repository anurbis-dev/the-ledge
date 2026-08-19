import GAME from '../core/game.js';
import {
  getTileDef, updateTile, removeTile,
  canvasToPng, loadImageFile, sliceSheet
} from '../core/tileset.js';
import { wipeTileId } from '../core/layers.js';
import { raiseFloat, placeFloat, hasFloatPos } from './float.js';
import { invalidateAll } from '../render/tiles.js';
import { clearThumbCache, paintTileIcon } from './thumbs.js';

var root = document.getElementById('edTileEdit');
var titleEl = document.getElementById('edTileEditTitle');
var body = document.getElementById('edTileEditBody');
var current = null;
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
  if (root) root.hidden = true;
}

export function openTileEdit(spec, clientX, clientY){
  if (!root || !spec) return;
  current = spec;
  root.hidden = false;
  if (titleEl) titleEl.textContent = spec.custom ? 'Tile' : 'Tile (built-in)';
  fillBody(spec);
  if (!hasFloatPos(root))
    placeFloat(root, innerWidth - 320, 48);
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
  c.width = 16; c.height = 16;
  var cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  return c;
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
    cx.clearRect(0, 0, 16, 16);
    cx.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16);
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
  var x = Math.floor((e.clientX - r.left) / r.width * 16);
  var y = Math.floor((e.clientY - r.top) / r.height * 16);
  if (x < 0) x = 0; if (x > 15) x = 15;
  if (y < 0) y = 0; if (y > 15) y = 15;
  return { x: x, y: y };
}

function edgeOf(e, can){
  var r = can.getBoundingClientRect();
  var x = Math.round((e.clientX - r.left) / r.width * 16);
  var y = Math.round((e.clientY - r.top) / r.height * 16);
  if (x < 0) x = 0; if (x > 16) x = 16;
  if (y < 0) y = 0; if (y > 16) y = 16;
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
  if (!current || !current.custom || !buf) return;
  var src = canvasToPng(buf);
  updateTile(current.id, { src: src });
  current.src = src;
  notify();
  fillSwatches();
}

function uniqueColors(){
  if (!buf) return [];
  var data = buf.getContext('2d').getImageData(0, 0, 16, 16).data;
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
  if (!current) return '';
  var def = current.custom ? getTileDef(current.id) : null;
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
  if (!current) return;
  var def = current.custom ? getTileDef(current.id) : null;
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
  var s = can.width, k = s / 16, i, j;
  cx.imageSmoothingEnabled = false;
  for (j = 0; j < 16; j++){
    for (i = 0; i < 16; i++){
      cx.fillStyle = ((i + j) & 1) ? '#2a2040' : '#1a1228';
      cx.fillRect(i * k, j * k, k, k);
    }
  }
  if (buf) cx.drawImage(buf, 0, 0, 16, 16, 0, 0, s, s);
  else if (current && !current.custom) paintTileIcon(cx, current, s);
  cx.strokeStyle = '#3a346055';
  cx.lineWidth = 1;
  for (i = 0; i <= 16; i++){
    cx.beginPath(); cx.moveTo(i * k + 0.5, 0); cx.lineTo(i * k + 0.5, s); cx.stroke();
    cx.beginPath(); cx.moveTo(0, i * k + 0.5); cx.lineTo(s, i * k + 0.5); cx.stroke();
  }
  drawHitShape(cx, s, k, tool === 'hitbox');
  if (hitLab) hitLab.textContent = hitText();
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
  if (hintEl) hintEl.textContent = HINT[tool] || HINT.pencil;
  paintCanvas();
}

function applyBox(x0, y0, x1, y1){
  if (!current || !current.custom) return;
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
  if (!current || !current.custom || !pendingBox) return;
  updateTile(current.id, { collide: 'custom', box: pendingBox });
  pendingBox = null;
  notify();
}

function bindPreview(can, spec){
  can.addEventListener('contextmenu', function(e){ e.preventDefault(); e.stopPropagation(); });
  can.addEventListener('pointerdown', function(e){
    if (!spec.custom) return;
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    try { can.setPointerCapture(e.pointerId); } catch (_){}
    if (tool === 'hitbox'){
      if (e.button !== 0) return;
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

function applyImportFile(file){
  if (!current || !current.custom || !file) return;
  loadImageFile(file).then(function(img){
    var slices = sliceSheet(img, file.name);
    if (!slices.length) return;
    updateTile(current.id, { src: slices[0].src });
    current.src = slices[0].src;
    notify();
    fillBody(current);
  }).catch(function(){});
}

function fillBody(spec){
  if (!body) return;
  body.textContent = '';
  preview = null;
  hintEl = null;
  hitLab = null;
  toolsEl = null;
  swatchEl = null;
  colorInp = null;
  painting = null;
  boxDrag = null;
  pendingBox = null;
  var custom = !!spec.custom;
  var def = custom ? getTileDef(spec.id) : null;

  var can = document.createElement('canvas');
  can.width = 128;
  can.height = 128;
  can.className = 'ed-tilegeo';
  body.appendChild(can);
  preview = can;

  hitLab = document.createElement('div');
  hitLab.className = 'ed-tile-hitlab';
  body.appendChild(hitLab);

  if (custom){
    toolsEl = document.createElement('div');
    toolsEl.className = 'ed-tile-tools';
    var t;
    for (t = 0; t < TOOLS.length; t++){
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
      })(TOOLS[t]);
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
  }

  var nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.value = spec.name || '';
  nameInp.maxLength = 24;
  nameInp.disabled = !custom;
  nameInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  nameInp.addEventListener('change', function(){
    if (!def) return;
    updateTile(def.id, { name: nameInp.value.trim() || def.name });
    spec.name = nameInp.value.trim() || spec.name;
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
    spec.overlay = over.checked;
    current = spec;
    notify();
    fillBody(spec);
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
  var curCol = def ? def.collide : builtinCollide(spec);
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
    fillBody(spec);
  });
  field('Collision', sel);

  if (!custom){
    var note = document.createElement('div');
    note.className = 'ed-tile-note';
    note.textContent = 'Built-in tiles keep their game collision. Drop a PNG to make an editable tile.';
    body.appendChild(note);
    paintCanvas();
    return;
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
  reimp.title = 'Replace this tile’s picture. A sheet uses the first 16×16 cell. Flags stay.';
  reimp.addEventListener('click', function(){ fileInp.click(); });
  actions.appendChild(reimp);

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
  body.appendChild(actions);

  loadBuf(def && def.src || spec.src, function(){
    fillSwatches();
    syncTools();
  });
  bindPreview(can, spec);
  syncTools();
}

if (root){
  root.addEventListener('dragover', function(e){
    if (!current || !current.custom) return;
    var dt = e.dataTransfer;
    if (!dt) return;
    e.preventDefault();
    e.stopPropagation();
    dt.dropEffect = 'copy';
  });
  root.addEventListener('drop', function(e){
    if (!current || !current.custom) return;
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    e.stopPropagation();
    applyImportFile(files[0]);
  });
}

var closeBtn = document.getElementById('edTileEditX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeTileEdit(); });
