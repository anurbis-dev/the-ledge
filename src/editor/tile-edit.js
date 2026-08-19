import GAME from '../core/game.js';
import { getTileDef, updateTile, removeTile, isCustomId } from '../core/tileset.js';
import { wipeTileId } from '../core/layers.js';
import { raiseFloat, placeFloat, hasFloatPos } from './float.js';
import { bindResetHover } from './slider.js';
import { invalidateAll } from '../render/tiles.js';
import { clearThumbCache } from './thumbs.js';

var root = document.getElementById('edTileEdit');
var titleEl = document.getElementById('edTileEditTitle');
var body = document.getElementById('edTileEditBody');
var current = null;
var onChange = null;

var COLLIDE = [
  { id: 'none', name: 'None' },
  { id: 'full', name: 'Full box' },
  { id: 'half', name: 'Top half' },
  { id: 'bar', name: 'Bar (hang)' },
  { id: 'slope-r', name: 'Slope ↗' },
  { id: 'slope-l', name: 'Slope ↖' },
  { id: 'custom', name: 'Custom box' }
];

export function bindTileEdit(hooks){
  onChange = hooks && hooks.onChange;
}

export function closeTileEdit(){
  current = null;
  if (root) root.hidden = true;
}

export function openTileEdit(spec, clientX, clientY){
  if (!root || !spec) return;
  current = spec;
  root.hidden = false;
  if (titleEl) titleEl.textContent = spec.custom ? 'Tile' : 'Tile (built-in)';
  fillBody(spec);
  if (!hasFloatPos(root))
    placeFloat(root, innerWidth - 300, 48);
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

function fillBody(spec){
  if (!body) return;
  body.textContent = '';
  var custom = !!spec.custom;
  var def = custom ? getTileDef(spec.id) : null;

  var preview = document.createElement('canvas');
  preview.width = 128;
  preview.height = 128;
  preview.className = 'ed-tilegeo';
  preview.title = custom ? 'Drag to set collision box' : 'Collision (read-only)';
  body.appendChild(preview);

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
    notify();
    fillBody({ name: spec.name, id: spec.id, custom: true, overlay: over.checked, src: spec.src });
  });
  var overRow = document.createElement('label');
  overRow.className = 'ed-check';
  overRow.appendChild(over);
  overRow.appendChild(document.createTextNode(' Overlay — paint on top of the main tile (does not replace it, no collision)'));
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
    paintGeo(preview, spec);
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
    updateTile(def.id, { collide: sel.value, box: box });
    notify();
    fillBody({ name: spec.name, id: spec.id, custom: true, overlay: def.overlay, src: spec.src });
  });
  field('Collision', sel);

  if (!custom){
    var note = document.createElement('div');
    note.className = 'ed-tile-note';
    note.textContent = 'Built-in tiles keep their game collision. Drop a PNG to make an editable tile.';
    body.appendChild(note);
  } else {
    var hint = document.createElement('div');
    hint.className = 'ed-tile-note';
    hint.textContent = 'Suggested: overlay + no collision for moss/cracks/vines. Full / custom box for solid art. Front for things that should hide the hero.';
    body.appendChild(hint);
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'edb';
    del.textContent = 'Delete tile';
    del.addEventListener('click', function(){
      if (!def) return;
      wipeTileId(def.id);
      removeTile(def.id);
      notify();
      closeTileEdit();
    });
    body.appendChild(del);
  }

  paintGeo(preview, spec);
  if (custom) bindGeoDrag(preview, spec);
}

function paintGeo(can, spec){
  var cx = can.getContext('2d');
  var s = 128, k = s / 16;
  cx.imageSmoothingEnabled = false;
  cx.fillStyle = '#1a1228';
  cx.fillRect(0, 0, s, s);
  var imgSrc = spec.src;
  var def = spec.custom ? getTileDef(spec.id) : null;
  if (def && def.src) imgSrc = def.src;
  function grid(){
    var i;
    cx.strokeStyle = '#3a346088';
    cx.lineWidth = 1;
    for (i = 0; i <= 16; i++){
      cx.beginPath(); cx.moveTo(i * k + 0.5, 0); cx.lineTo(i * k + 0.5, s); cx.stroke();
      cx.beginPath(); cx.moveTo(0, i * k + 0.5); cx.lineTo(s, i * k + 0.5); cx.stroke();
    }
  }
  function shape(){
    var col = def ? def.collide : builtinCollide(spec);
    var box = def && def.box;
    cx.fillStyle = '#ff5a4a55';
    cx.strokeStyle = '#ffd0c4';
    cx.lineWidth = 2;
    if (col === 'full'){ cx.fillRect(0, 0, s, s); cx.strokeRect(1, 1, s - 2, s - 2); }
    else if (col === 'half'){ cx.fillRect(0, 0, s, 8 * k); cx.strokeRect(1, 1, s - 2, 8 * k - 2); }
    else if (col === 'bar'){ cx.fillRect(0, 0, s, 3 * k); cx.strokeRect(1, 1, s - 2, 3 * k - 2); }
    else if (col === 'custom' && box){
      cx.fillRect(box.x * k, box.y * k, box.w * k, box.h * k);
      cx.strokeRect(box.x * k + 1, box.y * k + 1, box.w * k - 2, box.h * k - 2);
    } else if (col === 'slope-r'){
      cx.beginPath(); cx.moveTo(0, s); cx.lineTo(s, 0); cx.lineTo(s, s); cx.closePath(); cx.fill();
    } else if (col === 'slope-l'){
      cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(s, s); cx.lineTo(0, s); cx.closePath(); cx.fill();
    }
  }
  if (imgSrc){
    var img = new Image();
    img.onload = function(){
      cx.drawImage(img, 0, 0, 16, 16, 0, 0, s, s);
      grid();
      shape();
    };
    img.src = imgSrc;
    if (img.complete && img.naturalWidth){
      cx.drawImage(img, 0, 0, 16, 16, 0, 0, s, s);
    }
  }
  grid();
  shape();
}

function bindGeoDrag(can, spec){
  var drag = null;
  can.addEventListener('pointerdown', function(e){
    if (e.button !== 0) return;
    var def = getTileDef(spec.id);
    if (!def) return;
    var r = can.getBoundingClientRect();
    var px = Math.max(0, Math.min(16, Math.round((e.clientX - r.left) / r.width * 16)));
    var py = Math.max(0, Math.min(16, Math.round((e.clientY - r.top) / r.height * 16)));
    drag = { x0: px, y0: py };
    updateTile(def.id, { collide: 'custom', box: { x: px, y: py, w: 1, h: 1 } });
    paintGeo(can, spec);
    try { can.setPointerCapture(e.pointerId); } catch (_){}
    e.preventDefault();
  });
  can.addEventListener('pointermove', function(e){
    if (!drag) return;
    var r = can.getBoundingClientRect();
    var px = Math.max(0, Math.min(16, Math.round((e.clientX - r.left) / r.width * 16)));
    var py = Math.max(0, Math.min(16, Math.round((e.clientY - r.top) / r.height * 16)));
    var x = Math.min(drag.x0, px), y = Math.min(drag.y0, py);
    var w = Math.max(1, Math.abs(px - drag.x0)), h = Math.max(1, Math.abs(py - drag.y0));
    updateTile(spec.id, { collide: 'custom', box: { x: x, y: y, w: w, h: h } });
    paintGeo(can, spec);
  });
  function end(){
    if (!drag) return;
    drag = null;
    notify();
  }
  can.addEventListener('pointerup', end);
  can.addEventListener('pointercancel', end);
}

var closeBtn = document.getElementById('edTileEditX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeTileEdit(); });

void bindResetHover;
void isCustomId;
