import GAME from '../core/game.js';
import {
  getTileDef, updateTile, getTileGfx, setTileGfx, clearTileGfx, getTileSpeed,
  getTileShift, getTileWaveX, getTileSplash, getTileLength, getTileWave, getTileRandom, getTileOffset, getTileFade,
  getTileSpeed2, getTileLength2, getTileDensity2, getTileWave2, getTileFoam, getTileSpray,
  getTileFoamSize, getTileFoamRandom, getTileFoamSpeed, getTileSpraySpeed,
  getTileTaper, getTileTaperLen,
  getTileSpriteId, setTileSpriteId, tileBaseId, syncTileLegacyFromSprite,
  tileFrameCount, tileFrameSrc, canvasToPng, loadImageFile, addTile
} from '../core/tileset.js';
import { initSliders } from './slider.js';
import {
  getSpriteDef, getSpriteFrameSrc, setSpriteFrame, clearSpriteFrame,
  isSpriteFrameDirty, setSpriteSize,
  getAnimFrameCount, setAnimFrameCount, reorderAnimFrames, removeAnimFrame,
  getAnimSpeed, setAnimSpeed,
  addSpriteDef, spriteFrameImage, addAnimDef, renameSpriteDef, setSpriteTag,
  isHeroSprite
} from '../core/spriteset.js';
import {
  getFrameAnchor, setFrameAnchor, getAnimBox, setAnimBox,
  clearAnimAnchors, defaultObjectAnchors, spriteIdForObject
} from '../core/object-anchors.js';
import { updateObject, getObjectDef } from '../core/objectset.js';
import { runtime } from '../core/runtime.js';
import { bakeSpriteFrameSrc, bakeBuiltinTileSrc, clearBakeCache } from '../render/sprite-bake.js';
import { raiseFloat, placeFloat, hasFloatPos } from './float.js';
import { invalidateAll } from '../render/tiles.js';
import { clearThumbCache, paintTileIcon } from './thumbs.js';
import { touchOp } from './history.js';

var root = document.getElementById('edTileEdit');
var titleEl = document.getElementById('edTileEditTitle');
var body = document.getElementById('edTileEditBody');
var current = null;
var mode = 'tile';
var objCurrent = null;
var spriteSlotEl = null;
var fw = 16, fh = 16;
/* Разрешение арта текущего кадра (holst буфера рисования) — независимо от fw/fh
   (footprint: хитбокс/якоря/мировой размер). Кадр может быть нарисован крупнее
   footprint (напр. земляные тайлы — 32×32 на 16×16 клетку, под RENDER_SCALE) —
   рендер (`blitEntSprite`/`blitHeroSprite`/`paintCustom`) уже всегда скейлит
   natural-размер картинки в footprint, так что здесь достаточно просто хранить
   и редактировать кадр в его собственном разрешении. */
var bufW = 16, bufH = 16;
var animId = '';
var frameI = 0;
var onChange = null;
var onDeleteCustom = null;
var onObjectChange = null;
var onRenameBuiltinTile = null;
var onRetagBuiltinTile = null;

var TOOLS = [
  { id: 'pencil', name: 'Paint', title: 'Paint pixels (LMB). RMB erases. Alt+click picks a color.' },
  { id: 'hitbox', name: 'Collision', title: 'Drag the collision box (origin = top-left). Box and anchors only show while this is active.' }
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
  pencil: 'LMB paint · RMB erase · Ctrl+LMB drag zoom · Ctrl+MMB drag pan · Alt pick. Pixels are only a picture.',
  hitbox: 'Drag the red frame. That box is collision — the picture does not change it.',
  sprite: 'Collision tool: red box = hitbox for this action (origin is its top-left), gold = hands, magenta = weapon. Drag an edge/corner to resize, drag inside to redraw.'
};

var STRIP_KEY = 'ledge.ed.tileStripH';
var CHECK_A = '#76767c';
var CHECK_B = '#6e6e74';
var ORIGIN_COL = '#6ec8ff';
var WEAPON_COL = '#ff7eb6';
var GRAB_COL = '#ffcc66';
var SIZE_MIN = 8, SIZE_MAX = 128;
var HOLD_DELETE_MS = 550;
var ZOOM_MIN = 0.5, ZOOM_MAX = 8;

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
var splitEl = null;
var painting = null;
var boxDrag = null;
var pendingBox = null;
var loadGen = 0;
var stripH = 0;
var altPick = false;
var pendingAnchor = null;
var originXEl = null, originYEl = null, weaponXEl = null, weaponYEl = null;
var grabXEl = null, grabYEl = null, rotEl = null;
var boxWEl = null, boxHEl = null;
var playTimer = 0;
var playBtn = null;
var frameDrag = null;
var animFilter = '';
var animFilterEl = null;
var previewZoom = 1;
var previewPanX = 0, previewPanY = 0;
var zoomDrag = null;
var panDrag = null;

try {
  var savedStrip = parseInt(localStorage.getItem(STRIP_KEY), 10);
  if (savedStrip > 0) stripH = savedStrip;
} catch (e){}

export function bindTileEdit(hooks){
  onChange = hooks && hooks.onChange;
  onDeleteCustom = hooks && hooks.onDeleteCustom;
  onObjectChange = hooks && hooks.onObjectChange;
  onRenameBuiltinTile = hooks && hooks.onRenameBuiltinTile;
  onRetagBuiltinTile = hooks && hooks.onRetagBuiltinTile;
}

export function isDetailsOpen(){
  return !!(root && !root.hidden);
}

export function getDetailsObject(){ return objCurrent; }

export function hitSpriteSlot(clientX, clientY){
  var h = hitDetailsDrop(clientX, clientY);
  return !!(h && h.kind === 'spriteSlot');
}

/** Hit-test palette drop targets inside Details: sprite slot or a frame thumb. */
export function hitDetailsDrop(clientX, clientY){
  if (!isDetailsOpen()) return null;
  var r, list, i, el, anim, fi;
  if (spriteSlotEl){
    r = spriteSlotEl.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom)
      return { kind: 'spriteSlot' };
  }
  if (stripsEl && !stripsEl.hidden){
    list = stripsEl.querySelectorAll('.ed-tile-frame');
    for (i = 0; i < list.length; i++){
      el = list[i];
      r = el.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
      anim = el.getAttribute('data-anim') || '';
      fi = parseInt(el.getAttribute('data-i'), 10);
      if (isNaN(fi)) fi = 0;
      return { kind: 'frame', anim: anim, i: fi };
    }
  }
  return null;
}

export function pointerOverDetails(clientX, clientY){
  if (!isDetailsOpen() || !root) return false;
  var r = root.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

function stopPlay(){
  if (playTimer){ clearInterval(playTimer); playTimer = 0; }
  if (playBtn){
    playBtn.textContent = 'Play';
    playBtn.classList.remove('on');
  }
}

export function closeTileEdit(){
  stopPlay();
  current = null;
  objCurrent = null;
  spriteSlotEl = null;
  painting = null;
  boxDrag = null;
  frameDrag = null;
  animFilterEl = null;
  mode = 'tile';
  if (root){
    root.hidden = true;
    root.classList.remove('ed-sprite');
    root.classList.remove('ed-object');
  }
  altPick = false;
  pendingAnchor = null;
}

function isSprite(){ return mode === 'sprite'; }
function isObjectOnly(){ return mode === 'object'; }
function isCustomTile(){ return mode === 'tile' && current && current.custom; }
function tileHasLinkedSprite(){
  if (mode !== 'tile' || !current || current.id == null) return false;
  return !!(getTileSpriteId(current.id) || current.spriteId);
}
function canPaint(){
  /* Пиксели только в режиме спрайта — у тайла/объекта слот + параметры. */
  return isSprite();
}
/** Ключ якорей = objectKind; Start → spawn.objectKind || hero. Sprite-only → null. */
function anchorKind(){
  if (!objCurrent) return null;
  if (objCurrent.kind === 'player_start' || objCurrent.template === 'player_start')
    return (runtime.LV && runtime.LV.spawn && runtime.LV.spawn.objectKind) || 'hero';
  return objCurrent.kind;
}
function canEditAnchors(){
  return mode === 'object' && !!anchorKind() && !!current && !!current.anims;
}
function hasSpriteFrames(){
  return !!(current && current.anims && (isSprite() || isObjectOnly()));
}
function resolveObjSpriteId(meta){
  var sid;
  if (!meta) return null;
  sid = meta.spriteId;
  if (!sid && (meta.template === 'player_start' || meta.kind === 'player_start'))
    sid = (runtime.LV && runtime.LV.spawn && runtime.LV.spawn.spriteId) || 'hero';
  if (!sid && meta.kind){
    if (meta.kind === 'player_start' || meta.template === 'player_start')
      sid = spriteIdForObject((runtime.LV && runtime.LV.spawn && runtime.LV.spawn.objectKind) || 'hero');
    else sid = spriteIdForObject(meta.kind);
  }
  return sid || null;
}

export function openTileEdit(spec, clientX, clientY){
  if (!root || !spec) return;
  stopPlay();
  mode = 'tile';
  objCurrent = null;
  fw = 16; fh = 16;
  animId = '';
  frameI = 0;
  animFilter = '';
  current = Object.assign({}, spec, {
    spriteId: (spec.id != null ? getTileSpriteId(spec.id) : null) || spec.spriteId || null
  });
  root.classList.remove('ed-sprite');
  root.classList.remove('ed-object');
  root.hidden = false;
  if (titleEl) titleEl.textContent = 'Tile';
  fillBody();
  if (!hasFloatPos(root))
    placeFloat(root, innerWidth - 320, 48);
  raiseFloat(root);
  void clientX; void clientY;
}

function isFoeSprite(id){
  var def = getSpriteDef(id);
  var k = (def && def.kind) || id || '';
  return /^(enemy|flier|spider)\d+$/.test(k);
}

/** Раскладка процедурного бейка в стартовые растровые кадры — враги уже так
    делают при открытии Sprite Edit; героине это даёт силуэт по текущей позе
    вместо рисования ~30 анимаций с нуля (см. bakeHeroFrame). */
function isBakeableOnOpen(id){
  return isFoeSprite(id) || isHeroSprite(id);
}

function materializeBakes(id){
  var def = getSpriteDef(id), r, a, i, n;
  if (!def || !def.anims) return;
  for (r = 0; r < def.anims.length; r++){
    a = def.anims[r];
    n = getAnimFrameCount(id, a.id);
    for (i = 0; i < n; i++){
      if (isSpriteFrameDirty(id, a.id, i)) continue;
      setSpriteFrame(id, a.id, i, bakeSpriteFrameSrc(id, a.id, i), true);
    }
  }
}

export function openSpriteEdit(def, clientX, clientY, keepObject){
  if (!root || !def) return;
  stopPlay();
  mode = 'sprite';
  if (!keepObject) objCurrent = null;
  if (objCurrent) root.classList.add('ed-object');
  else root.classList.remove('ed-object');
  if (isBakeableOnOpen(def.id)) materializeBakes(def.id);
  current = getSpriteDef(def.id) || def;
  fw = current.fw || 16;
  fh = current.fh || 16;
  animId = def.anims && def.anims[0] ? def.anims[0].id : '';
  frameI = 0;
  animFilter = '';
  tool = 'pencil';
  root.classList.add('ed-sprite');
  root.hidden = false;
  if (titleEl) titleEl.textContent = (objCurrent && objCurrent.name) || def.name || 'Sprite';
  fillBody();
  if (!hasFloatPos(root))
    placeFloat(root, innerWidth - 400, 40);
  raiseFloat(root);
  void clientX; void clientY;
}

/** Details for an Objects palette entry — params + якоря (если есть спрайт). */
export function openObjectEdit(meta, clientX, clientY){
  var sid, sd;
  if (!root || !meta) return;
  stopPlay();
  objCurrent = meta;
  mode = 'object';
  sid = resolveObjSpriteId(meta);
  sd = sid ? getSpriteDef(sid) : null;
  if (sd){
    current = sd;
    fw = current.fw || 16;
    fh = current.fh || 16;
    animId = current.anims && current.anims[0] ? current.anims[0].id : '';
    frameI = 0;
  } else {
    current = meta;
    fw = 16; fh = 16;
    animId = '';
    frameI = 0;
  }
  animFilter = '';
  tool = sd ? 'hitbox' : 'pencil';
  root.classList.remove('ed-sprite');
  root.classList.add('ed-object');
  root.hidden = false;
  if (titleEl) titleEl.textContent = meta.name || 'Object';
  fillBody();
  if (!hasFloatPos(root))
    placeFloat(root, innerWidth - 320, 48);
  raiseFloat(root);
  void clientX; void clientY;
}

function setObjectSpriteId(spriteId){
  if (!objCurrent) return false;
  markOp();
  if (objCurrent.custom){
    var next = updateObject(objCurrent.kind, { spriteId: spriteId || null });
    if (!next) return false;
    objCurrent = {
      name: next.name, tag: next.tag, kind: next.id, template: next.template,
      role: next.role, spriteId: next.spriteId, itemKind: next.itemKind, custom: true
    };
  } else if (objCurrent.template === 'player_start' || objCurrent.kind === 'player_start'){
    if (runtime.LV && runtime.LV.spawn){
      runtime.LV.spawn.spriteId = spriteId || 'hero';
      objCurrent = Object.assign({}, objCurrent, { spriteId: spriteId || 'hero' });
    }
  } else {
    return false;
  }
  if (onObjectChange) onObjectChange(objCurrent);
  if (onChange) onChange();
  openObjectEdit(objCurrent);
  return true;
}

/** Assign sprite from Sprites tab onto Tile or Object sprite slot. Only { spriteId }. */
export function applySpriteSlotPayload(payload){
  if (!payload || !payload.spriteId) return false;
  if (mode === 'tile' && current && current.id != null){
    markOp();
    setTileSpriteId(current.id, payload.spriteId);
    syncTileLegacyFromSprite(current.id);           // без этого paintCustom не находит картинку и рисует процедурно
    current.spriteId = payload.spriteId;
    notify();
    fillBody();
    return true;
  }
  if (!objCurrent) return false;
  return setObjectSpriteId(payload.spriteId);
}

function resolveDropSrc(payload){
  if (!payload) return '';
  if (payload.tileSrc) return payload.tileSrc;
  if (payload.spriteId){
    var pd = getSpriteDef(payload.spriteId);
    var pAnim = (pd && pd.anims && pd.anims[0]) ? pd.anims[0].id : 'idle';
    return getSpriteFrameSrc(payload.spriteId, pAnim, 0) ||
      bakeSpriteFrameSrc(payload.spriteId, pAnim, 0) || '';
  }
  return '';
}

/** Replace one Details frame from a palette drop. */
export function applyFrameSlotPayload(anim, i, payload){
  if (!current || !payload || !canPaint()) return false;
  var src = resolveDropSrc(payload);
  if (!src) return false;
  i = i | 0;
  if (isSprite()){
    var n = getAnimFrameCount(current.id, anim);
    if (i < 0 || i >= n) return false;
    markOp();
    setSpriteFrame(current.id, anim, i, src, true);
    notify();
    selectFrame(anim, i);
    fillBody();
    return true;
  }
  var frames = tileFramesList();
  if (i < 0 || i >= frames.length) return false;
  frames[i] = src;
  writeTileFrames(frames);
  selectFrame('', i);
  fillBody();
  return true;
}

export function applyDetailsDrop(hit, payload){
  if (!hit || !payload) return false;
  if (hit.kind === 'spriteSlot') return applySpriteSlotPayload(payload);
  if (hit.kind === 'frame') return applyFrameSlotPayload(hit.anim, hit.i, payload);
  return false;
}

function fillObjectHeader(parent){
  if (!objCurrent) return;
  var box = document.createElement('div');
  box.className = 'ed-obj-header';

  var nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.value = objCurrent.name || '';
  nameInp.maxLength = 32;
  nameInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  nameInp.addEventListener('change', function(){
    if (objCurrent.custom) markOp();
    var next = updateObject(objCurrent.kind, { name: nameInp.value.trim() || objCurrent.name });
    if (!next) return;
    objCurrent.name = next.name;
    if (titleEl) titleEl.textContent = next.name;
    if (onObjectChange) onObjectChange(objCurrent);
  });
  field('Name', nameInp);
  /* field appends to body — move into box */
  var last = body.lastChild;
  if (last) box.appendChild(last);

  var tagInp = document.createElement('input');
  tagInp.type = 'text';
  tagInp.value = objCurrent.tag || '';
  tagInp.maxLength = 24;
  tagInp.placeholder = '—';
  tagInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  tagInp.addEventListener('change', function(){
    if (objCurrent.custom) markOp();
    var next = updateObject(objCurrent.kind, { tag: tagInp.value.trim() });
    if (!next) return;
    objCurrent.tag = next.tag;
    if (onObjectChange) onObjectChange(objCurrent);
  });
  field('Tag', tagInp);
  last = body.lastChild;
  if (last) box.appendChild(last);

  var roleSel = document.createElement('select');
  ['actor', 'pickup', 'loot', 'prop', 'marker'].forEach(function(r){
    var opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    if (objCurrent.role === r) opt.selected = true;
    roleSel.appendChild(opt);
  });
  roleSel.disabled = !objCurrent.custom;
  roleSel.addEventListener('change', function(){
    if (!objCurrent.custom) return;
    markOp();
    var next = updateObject(objCurrent.kind, { role: roleSel.value });
    if (!next) return;
    objCurrent.role = next.role;
    if (onObjectChange) onObjectChange(objCurrent);
  });
  field('Type', roleSel);
  last = body.lastChild;
  if (last) box.appendChild(last);

  var slot = document.createElement('div');
  slot.className = 'ed-sprite-slot';
  slot.title = objCurrent.custom || objCurrent.kind === 'player_start'
    ? 'Drop a Sprites swatch here · double-click to edit frames'
    : 'Built-in sprite — Edit frames, or Ctrl+D to clone then replace';
  spriteSlotEl = slot;
  var sid = objCurrent.spriteId;
  if (!sid && (objCurrent.template === 'player_start' || objCurrent.kind === 'player_start'))
    sid = (runtime.LV && runtime.LV.spawn && runtime.LV.spawn.spriteId) || 'hero';
  var thumb = document.createElement('canvas');
  thumb.width = 32; thumb.height = 32;
  thumb.className = 'ed-sprite-slot-img';
  paintSlotThumb(thumb.getContext('2d'), sid);
  slot.appendChild(thumb);
  slot.addEventListener('dblclick', function(e){
    e.preventDefault();
    if (!sid) return;
    var sd0 = getSpriteDef(sid);
    if (sd0) openSpriteEdit(sd0, e.clientX, e.clientY, true);
  });
  var slotLab = document.createElement('div');
  slotLab.className = 'ed-field';
  var sp = document.createElement('span');
  sp.textContent = 'Sprite';
  slotLab.appendChild(sp);
  slotLab.appendChild(slot);
  if (sid){
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edb';
    editBtn.textContent = 'Edit';
    editBtn.title = 'Open sprite frames';
    editBtn.addEventListener('click', function(){
      var sd1 = getSpriteDef(sid);
      if (sd1) openSpriteEdit(sd1, undefined, undefined, true);
    });
    slotLab.appendChild(editBtn);
  }
  if (objCurrent.custom && objCurrent.spriteId){
    var clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'edb';
    clr.textContent = 'Clear';
    clr.addEventListener('click', function(){ setObjectSpriteId(null); });
    slotLab.appendChild(clr);
  }
  box.appendChild(slotLab);

  if (objCurrent.custom){
    var note = document.createElement('div');
    note.className = 'ed-tile-note';
    note.textContent = 'Template: ' + (objCurrent.template || '?') + ' · custom kind ' + objCurrent.kind;
    box.appendChild(note);
  }

  parent.insertBefore(box, parent.firstChild);
}

/** Sprite Details opened directly from the Sprites tab (no owning object): Name + Tag. */
function fillSpriteHeader(){
  if (!current) return;
  var nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.value = current.name || '';
  nameInp.maxLength = 32;
  nameInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  nameInp.addEventListener('change', function(){
    if (current.custom) markOp();
    var next = renameSpriteDef(current.id, nameInp.value.trim() || current.name);
    if (!next) return;
    current.name = next.name;
    if (titleEl) titleEl.textContent = next.name;
    notify();
  });
  field('Name', nameInp);

  var tagInp = document.createElement('input');
  tagInp.type = 'text';
  tagInp.value = current.tag || '';
  tagInp.maxLength = 24;
  tagInp.placeholder = '—';
  tagInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  tagInp.addEventListener('change', function(){
    if (current.custom) markOp();
    var next = setSpriteTag(current.id, tagInp.value.trim());
    if (!next) return;
    current.tag = next.tag;
    notify();
  });
  field('Tag', tagInp);
}

/** Object Details без спрайта — только Name/Type/Sprite slot. */
function fillObjectBodyNoSprite(){
  if (!body) return;
  fillObjectHeader(body);
  var hint = document.createElement('div');
  hint.className = 'ed-tile-note';
  hint.textContent = 'No sprite yet — drop a Sprites swatch onto the Sprite slot, then Edit frames.';
  body.appendChild(hint);
}

function paintSlotThumb(ctx, sid){
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2a2640';
  ctx.fillRect(0, 0, 32, 32);
  if (!sid){
    ctx.strokeStyle = '#6a628f';
    ctx.strokeRect(4.5, 4.5, 23, 23);
    ctx.fillStyle = '#8a8399';
    ctx.font = '9px sans-serif';
    ctx.fillText('drop', 6, 20);
    return;
  }
  var sd = getSpriteDef(sid);
  var anim0 = sd && sd.anims && sd.anims[0] ? sd.anims[0].id : 'idle';
  var img = spriteFrameImage(sid, anim0, 0);
  if (img){ ctx.drawImage(img, 0, 0, 32, 32); return; }
  var src = getSpriteFrameSrc(sid, anim0, 0) || bakeSpriteFrameSrc(sid, anim0, 0);
  if (!src){
    ctx.fillStyle = '#6a628f';
    ctx.fillRect(8, 8, 16, 16);
    return;
  }
  var im = new Image();
  im.onload = function(){
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = '#2a2640';
    ctx.fillRect(0, 0, 32, 32);
    ctx.drawImage(im, 0, 0, 32, 32);
  };
  im.src = src;
}

/** Sprite slot for tile Details — graphics only, from Sprites tab. */
function fillTileSpriteSlot(parent){
  if (!current || current.id == null) return;
  var sid = getTileSpriteId(current.id) || current.spriteId || null;
  var slot = document.createElement('div');
  slot.className = 'ed-sprite-slot';
  slot.title = 'Drop a Sprites swatch here · double-click to edit frames';
  spriteSlotEl = slot;
  var thumb = document.createElement('canvas');
  thumb.width = 32; thumb.height = 32;
  thumb.className = 'ed-sprite-slot-img';
  paintSlotThumb(thumb.getContext('2d'), sid);
  slot.appendChild(thumb);
  slot.addEventListener('dblclick', function(e){
    e.preventDefault();
    var id = getTileSpriteId(current.id);
    if (!id) return;
    var sd = getSpriteDef(id);
    if (sd) openSpriteEdit(sd, e.clientX, e.clientY);
  });
  var slotLab = document.createElement('div');
  slotLab.className = 'ed-field';
  var sp = document.createElement('span');
  sp.textContent = 'Sprite';
  slotLab.appendChild(sp);
  slotLab.appendChild(slot);
  if (sid){
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edb';
    editBtn.textContent = 'Edit';
    editBtn.title = 'Open sprite frames';
    editBtn.addEventListener('click', function(){
      var sd = getSpriteDef(sid);
      if (sd) openSpriteEdit(sd);
    });
    slotLab.appendChild(editBtn);
    var clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'edb';
    clr.textContent = 'Clear';
    clr.addEventListener('click', function(){
      markOp();
      setTileSpriteId(current.id, null);
      current.spriteId = null;
      notify();
      fillBody();
    });
    slotLab.appendChild(clr);
  }
  parent.appendChild(slotLab);
  if (sid){
    var note = document.createElement('div');
    note.className = 'ed-tile-note';
    note.textContent = 'Picture comes from the linked sprite. Edit frames on Sprites tab (or Edit). Collision flags stay on the tile.';
    parent.appendChild(note);
  }
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

function markOp(){ touchOp(); }

function notify(){
  clearThumbCache();
  invalidateAll();
  if (onChange) onChange();
}

/** После undo/redo — пересобрать открытую Details. */
export function refreshTileEdit(){
  if (!isDetailsOpen()) return;
  if (objCurrent && objCurrent.custom){
    var od = getObjectDef(objCurrent.kind);
    if (!od){ closeTileEdit(); return; }
    objCurrent = {
      name: od.name, tag: od.tag, kind: od.id, template: od.template,
      role: od.role, spriteId: od.spriteId, itemKind: od.itemKind, custom: true
    };
    if (titleEl) titleEl.textContent = objCurrent.name || 'Object';
  }
  if (isObjectOnly()){
    var sidR = resolveObjSpriteId(objCurrent);
    if (sidR){
      current = getSpriteDef(sidR) || current;
      if (current && current.fw){ fw = current.fw; fh = current.fh || fh; }
    }
    fillBody();
    return;
  }
  if (isSprite() && current){
    current = getSpriteDef(current.id) || current;
    if (!current){ closeTileEdit(); return; }
    fw = current.fw || fw;
    fh = current.fh || fh;
    fillBody();
    return;
  }
  if (current && current.id != null){
    var td = getTileDef(current.id);
    if (td){
      current = {
        name: td.name, tag: td.tag || '', id: td.id, color: '#6a628f',
        overlay: !!td.overlay, custom: true, src: td.src,
        spriteId: td.spriteId || getTileSpriteId(td.id) || null
      };
    } else {
      current.spriteId = getTileSpriteId(current.id) || current.spriteId || null;
    }
    fillBody();
  }
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
  c.width = bufW; c.height = bufH;
  var cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = false;
  return c;
}

function currentSrc(){
  if (hasSpriteFrames()){
    var saved = getSpriteFrameSrc(current.id, animId, frameI);
    if (saved) return saved;
    return bakeSpriteFrameSrc(current.id, animId, frameI);
  }
  if (mode === 'tile' && current && current.id != null && getTileSpriteId(current.id))
    return tileFrameSrc(current.id, frameI) || '';
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
  if (!src){
    bufW = fw; bufH = fh;
    buf = makeBuf();
    if (done) done();
    return;
  }
  var img = new Image();
  img.onload = function(){
    if (gen !== loadGen) return;
    bufW = img.naturalWidth || fw;
    bufH = img.naturalHeight || fh;
    buf = makeBuf();
    var cx = buf.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(img, 0, 0);
    if (done) done();
  };
  img.onerror = function(){
    if (gen !== loadGen) return;
    bufW = fw; bufH = fh;
    buf = makeBuf();
    if (done) done();
  };
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

/* Как fitFrame (render/sprites.js), но БЕЗ округления dw/dh до целых канвас-пикселей:
   редактору нужно, чтобы масштаб по X и Y был математически идентичен, иначе на большом
   зуме независимое округление каждой оси даёт разный эффективный масштаб — курсор
   расходится с красящимся пикселем, а кисть красит то квадратный, то прямоугольный блок. */
function fitExact(natW, natH, fw, fh){
  var s = Math.min(fw / natW, fh / natH);
  var dw = natW * s, dh = natH * s;
  return { dw: dw, dh: dh, padX: (fw - dw) / 2, padY: (fh - dh) / 2 };
}

/* Клик по холсту рисования — в разрешении арта (bufW×bufH), может отличаться
   от footprint (fw×fh), см. bufW/bufH. Арт рисуется в canvas не на всю его
   площадь, а через тот же fitExact (единый масштаб + леттербокс), что и
   paintCanvas — так что попадание в пиксель обязано идти через тот же fit,
   иначе курсор расходится с тем, что реально красится. */
function cellOf(e, can){
  var r = can.getBoundingClientRect();
  var px = (e.clientX - r.left) / r.width * can.width;
  var py = (e.clientY - r.top) / r.height * can.height;
  var fit = fitExact(bufW, bufH, can.width, can.height);
  var x = Math.floor((px - fit.padX) / fit.dw * bufW);
  var y = Math.floor((py - fit.padY) / fit.dh * bufH);
  if (x < 0) x = 0; if (x > bufW - 1) x = bufW - 1;
  if (y < 0) y = 0; if (y > bufH - 1) y = bufH - 1;
  return { x: x, y: y };
}

/* box/anchors хранятся в footprint fw×fh (мировые пиксели, см. object-anchors.js),
   но снаппим клик к сетке арта (bufW×bufH) — иначе точность ограничена шагом
   footprint-клетки, который может быть в разы крупнее одного пикселя арта.
   Шаг ОДИН на обе оси (см. fitExact/fitFrame) — если снаппить X и Y порознь
   (fw/bufW vs fh/bufH), при леттербоксе (арт не того же аспекта, что footprint)
   клики в паддинге вокруг арта съезжают на неверную границу. artStep()/artPadX/Y
   — тот же uniform-scale леттербокс, что и в paintCanvas, только в footprint-
   единицах, а не в канвас-пикселях. */
function artStep(){ return (bufW > 0 && bufH > 0) ? Math.min(fw / bufW, fh / bufH) : 1; }
function artPadX(){ return (fw - bufW * artStep()) / 2; }
function artPadY(){ return (fh - bufH * artStep()) / 2; }

function cellOfLogical(e, can){
  var r = can.getBoundingClientRect();
  var rawX = (e.clientX - r.left) / r.width * fw;
  var rawY = (e.clientY - r.top) / r.height * fh;
  var s = artStep(), px0 = artPadX(), py0 = artPadY();
  var ix = Math.floor((rawX - px0) / s);
  var iy = Math.floor((rawY - py0) / s);
  var x = ix * s + px0, y = iy * s + py0;
  if (x < 0) x = 0; if (x > fw - s) x = fw - s;
  if (y < 0) y = 0; if (y > fh - s) y = fh - s;
  return { x: x, y: y };
}

function edgeOf(e, can){
  var r = can.getBoundingClientRect();
  var rawX = (e.clientX - r.left) / r.width * fw;
  var rawY = (e.clientY - r.top) / r.height * fh;
  var s = artStep(), px0 = artPadX(), py0 = artPadY();
  var ix = Math.round((rawX - px0) / s);
  var iy = Math.round((rawY - py0) / s);
  var x = ix * s + px0, y = iy * s + py0;
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
  if (d[3] < 8) return;
  color = rgbToHex(d[0], d[1], d[2]);
  if (colorInp) colorInp.value = color;
  fillSwatches();
}

function commitSrc(){
  if (!buf || !current) return;
  markOp();
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
  var data = buf.getContext('2d').getImageData(0, 0, bufW, bufH).data;
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

function fillChecker(cx, cols, rows, tw, th){
  var i, j;
  for (j = 0; j < rows; j++){
    for (i = 0; i < cols; i++){
      cx.fillStyle = ((i + j) & 1) ? CHECK_A : CHECK_B;
      cx.fillRect(i * tw, j * th, tw, th);
    }
  }
}

function liveAnchors(){
  var ak, d, o, w, g;
  ak = anchorKind();
  if (!canEditAnchors() || !ak) return null;
  d = defaultObjectAnchors(ak, animId, frameI);
  o = getFrameAnchor(ak, animId, frameI, 'origin') || d.origin;
  w = getFrameAnchor(ak, animId, frameI, 'weapon') || d.weapon;
  g = getFrameAnchor(ak, animId, frameI, 'grab') || d.grab;
  if (pendingAnchor){
    if (pendingAnchor.kind === 'origin') o = { x: pendingAnchor.x, y: pendingAnchor.y };
    else if (pendingAnchor.kind === 'weapon') w = { x: pendingAnchor.x, y: pendingAnchor.y, rot: w.rot || 0 };
    else if (pendingAnchor.kind === 'grab') g = { x: pendingAnchor.x, y: pendingAnchor.y };
  }
  if (pendingBox) o = { x: pendingBox.x, y: pendingBox.y };
  return { origin: o, weapon: w, grab: g };
}

function drawMark(cx, pt, k, col, kind){
  var x = (pt.x + artStep() / 2) * k, y = (pt.y + artStep() / 2) * k;
  cx.save();
  cx.strokeStyle = col;
  cx.fillStyle = col;
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.moveTo(x - 7, y); cx.lineTo(x + 7, y);
  cx.moveTo(x, y - 7); cx.lineTo(x, y + 7);
  cx.stroke();
  if (kind === 'weapon'){
    cx.strokeRect(x - 4, y - 4, 8, 8);
  } else if (kind === 'grab'){
    cx.beginPath();
    cx.moveTo(x, y - 5); cx.lineTo(x + 5, y);
    cx.lineTo(x, y + 5); cx.lineTo(x - 5, y);
    cx.closePath();
    cx.stroke();
  } else {
    cx.beginPath();
    cx.arc(x, y, 4, 0, Math.PI * 2);
    cx.stroke();
  }
  cx.restore();
}

function liveBoxRect(){
  var a = liveAnchors(), b, ak;
  if (!a || !current) return null;
  if (pendingBox) return pendingBox;
  ak = anchorKind();
  b = getAnimBox(ak, animId);
  return { x: a.origin.x, y: a.origin.y, w: b.w, h: b.h };
}

function drawSpriteBox(cx, k, filled){
  var b = liveBoxRect(), x, y, w, h;
  if (!b) return;
  x = b.x * k; y = b.y * k; w = b.w * k; h = b.h * k;
  cx.save();
  cx.fillStyle = filled ? '#ff5a4a55' : 'rgba(255,90,74,0.18)';
  cx.strokeStyle = '#ffd0c4';
  cx.lineWidth = 2;
  cx.fillRect(x, y, w, h);
  cx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  cx.strokeStyle = '#ffe8e0';
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.moveTo(x, y + h); cx.lineTo(x + w, y + h);
  cx.stroke();
  cx.restore();
}

function drawAnchors(cx, k){
  var a = liveAnchors(), ox, oy;
  if (!a) return;
  ox = (a.origin.x + artStep() / 2) * k;
  oy = (a.origin.y + artStep() / 2) * k;
  cx.save();
  cx.strokeStyle = ORIGIN_COL;
  cx.globalAlpha = 0.4;
  cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(0, oy); cx.lineTo(cx.canvas.width, oy);
  cx.moveTo(ox, 0); cx.lineTo(ox, cx.canvas.height);
  cx.stroke();
  cx.restore();
  drawMark(cx, a.origin, k, ORIGIN_COL, 'origin');
  drawMark(cx, a.grab, k, GRAB_COL, 'grab');
  drawMark(cx, a.weapon, k, WEAPON_COL, 'weapon');
}

function drawThumbAnchors(cx, aId, ii){
  var ak, d, o, w, g, b;
  ak = anchorKind();
  if (!canEditAnchors() || !ak) return;
  d = defaultObjectAnchors(ak, aId, ii);
  o = getFrameAnchor(ak, aId, ii, 'origin') || d.origin;
  w = getFrameAnchor(ak, aId, ii, 'weapon') || d.weapon;
  g = getFrameAnchor(ak, aId, ii, 'grab') || d.grab;
  b = getAnimBox(ak, aId);
  cx.strokeStyle = '#ffd0c4';
  cx.strokeRect(o.x + 0.5, o.y + 0.5, Math.max(1, b.w - 1), Math.max(1, b.h - 1));
  cx.fillStyle = ORIGIN_COL;
  cx.fillRect(o.x, o.y, 1, 1);
  cx.fillStyle = GRAB_COL;
  cx.fillRect(g.x, g.y, 1, 1);
  cx.fillStyle = WEAPON_COL;
  cx.fillRect(w.x, w.y, 1, 1);
}

function hitAnchor(e, can){
  var a = liveAnchors(), r, k, rad, best, bestD, kinds, i, d;
  if (!a || !can) return null;
  r = can.getBoundingClientRect();
  k = r.width / fw;
  function dist(pt){
    var dx = e.clientX - r.left - (pt.x + artStep() / 2) * k;
    var dy = e.clientY - r.top - (pt.y + artStep() / 2) * k;
    return dx * dx + dy * dy;
  }
  rad = 14 * 14;
  best = null; bestD = rad;
  kinds = ['weapon', 'grab', 'origin'];
  for (i = 0; i < kinds.length; i++){
    d = dist(a[kinds[i]]);
    if (d <= bestD){ bestD = d; best = kinds[i]; }
  }
  return best;
}

var HANDLE_TOL = 8; // px по каждой оси экрана — совпадает с CSS-курсором ниже
var HANDLE_CURSOR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

/** Хватание за сторону/угол текущего hitbox для ресайза (n/s/e/w и их комбинации). */
function hitBoxHandle(e, can){
  var b = liveBoxRect(), r, k, px, py, x0, y0, x1, y1, nearX0, nearX1, nearY0, nearY1, inX, inY, h;
  if (!b || !can) return null;
  r = can.getBoundingClientRect();
  k = r.width / fw;
  px = e.clientX - r.left; py = e.clientY - r.top;
  x0 = b.x * k; y0 = b.y * k; x1 = (b.x + b.w) * k; y1 = (b.y + b.h) * k;
  nearX0 = Math.abs(px - x0) <= HANDLE_TOL; nearX1 = Math.abs(px - x1) <= HANDLE_TOL;
  nearY0 = Math.abs(py - y0) <= HANDLE_TOL; nearY1 = Math.abs(py - y1) <= HANDLE_TOL;
  inX = px >= x0 - HANDLE_TOL && px <= x1 + HANDLE_TOL;
  inY = py >= y0 - HANDLE_TOL && py <= y1 + HANDLE_TOL;
  h = '';
  if (nearY0 && inX) h += 'n'; else if (nearY1 && inX) h += 's';
  if (nearX0 && inY) h += 'w'; else if (nearX1 && inY) h += 'e';
  return h || null;
}

/* Округление только для отображения в текстовых полях (3 знака хватает, чтобы не
   терять точность привязки к арт-пикселю) — хранится и передаётся полное число. */
function fmtN(n){ return String(Math.round(n * 1000) / 1000); }

function syncAnchorFields(){
  var a = liveAnchors(), b, sx, sy;
  if (!a) return;
  /* step/max создаются в fillBody() до того, как асинхронный loadBuf успевает
     обновить bufW/bufH под конкретный кадр — держим их актуальными здесь,
     paintCanvas() зовёт syncAnchorFields() при каждой перерисовке. */
  sx = artStep(); sy = artStep();
  if (originXEl){ originXEl.value = fmtN(a.origin.x); originXEl.step = String(sx); originXEl.max = String(fw); }
  if (originYEl){ originYEl.value = fmtN(a.origin.y); originYEl.step = String(sy); originYEl.max = String(fh); }
  if (grabXEl){ grabXEl.value = fmtN(a.grab.x); grabXEl.step = String(sx); grabXEl.max = String(fw); }
  if (grabYEl){ grabYEl.value = fmtN(a.grab.y); grabYEl.step = String(sy); grabYEl.max = String(fh); }
  if (weaponXEl){ weaponXEl.value = fmtN(a.weapon.x); weaponXEl.step = String(sx); weaponXEl.max = String(fw); }
  if (weaponYEl){ weaponYEl.value = fmtN(a.weapon.y); weaponYEl.step = String(sy); weaponYEl.max = String(fh); }
  if (rotEl) rotEl.value = String(a.weapon.rot || 0);
  b = liveBoxRect();
  if (boxWEl && b){ boxWEl.value = fmtN(b.w); boxWEl.step = String(sx); }
  if (boxHEl && b){ boxHEl.value = fmtN(b.h); boxHEl.step = String(sy); }
}

function clampCell(n, max){
  n = n | 0;
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}

function commitAnchor(kind, x, y){
  var ak = anchorKind();
  if (!canEditAnchors() || !ak) return;
  markOp();
  setFrameAnchor(ak, animId, frameI, kind, x, y);
  notify();
  syncAnchorFields();
  paintCanvas();
  paintStrips();
}

function numInp(val, min, max, step){
  var el = document.createElement('input');
  el.type = 'number';
  el.value = String(val);
  el.min = String(min);
  el.max = String(max);
  el.step = step != null ? String(step) : '1';
  el.addEventListener('keydown', function(e){ e.stopPropagation(); });
  return el;
}

function xyRow(label, cls, a, b, sep, parent){
  var row = document.createElement('label');
  row.className = 'ed-field' + (cls ? ' ' + cls : '');
  var sp = document.createElement('span');
  sp.textContent = label;
  row.appendChild(sp);
  var wrap = document.createElement('span');
  wrap.className = 'ed-tile-xy';
  wrap.appendChild(a);
  var mid = document.createElement('span');
  mid.className = 'sep';
  mid.textContent = sep || '×';
  wrap.appendChild(mid);
  wrap.appendChild(b);
  row.appendChild(wrap);
  (parent || body).appendChild(row);
  return row;
}

function bindAnchorInp(el, kind, axis){
  el.addEventListener('change', function(){
    var a = liveAnchors(), n, x, y, max;
    if (!a || !current) return;
    n = parseFloat(el.value);
    if (isNaN(n)) { syncAnchorFields(); return; }
    max = axis === 'x' ? fw : fh;
    if (n < 0) n = 0; else if (n > max) n = max;
    x = a[kind].x; y = a[kind].y;
    if (axis === 'x') x = n; else y = n;
    commitAnchor(kind, x, y);
  });
}

/** Footprint (fw/fh) — мировой хитбокс/якоря, независим от разрешения арта
    (bufW/bufH) — рендер сам скейлит natural-размер кадра в footprint, так что
    смена Size не трогает уже нарисованные пиксели. */
function applySpriteSize(nw, nh){
  if (!isSprite() || !current) return;
  nw = clampCell(nw, SIZE_MAX); if (nw < SIZE_MIN) nw = SIZE_MIN;
  nh = clampCell(nh, SIZE_MAX); if (nh < SIZE_MIN) nh = SIZE_MIN;
  if (nw === fw && nh === fh) return;
  markOp();
  setSpriteSize(current.id, nw, nh);
  clearBakeCache();
  current = getSpriteDef(current.id) || current;
  fw = current.fw; fh = current.fh;
  notify();
  fillBody();
}

function syncCursor(){
  if (!preview) return;
  var pick = altPick;
  var onMark = canEditAnchors() && !!pendingAnchor;
  preview.style.cursor = '';
  preview.classList.toggle('tool-pick', pick && !onMark);
  preview.classList.toggle('tool-hit', tool === 'hitbox' && !pick);
  preview.classList.toggle('tool-anchor', onMark);
  preview.title = tool === 'hitbox'
    ? (canEditAnchors()
      ? 'Drag an edge/corner of the red box to resize it, or drag inside to redraw. Origin is its top-left. Ctrl+LMB drag zooms, Ctrl+MMB drag pans.'
      : 'Drag to set the collision box (what the hero hits)')
    : (pick ? 'Pick color' : 'Paint pixel · RMB erase · Ctrl+LMB drag zooms · Ctrl+MMB drag pans · Alt+click picks');
}

function paintCanvas(){
  if (!preview) return;
  /* footprint (fw×fh) больше не отдельное число, которое может разъехаться
     с артом: рендер рисует спрайт 1:1 нативным размером (см. render/sprites.js
     fitFrame), так что якоря/бокс обязаны мерить границы по факту загруженного
     буфера, а не по старому значению — иначе после импорта кадра большего
     размера бокс остаётся зажат в границах прежнего (виртуального) footprint. */
  if ((isSprite() || isObjectOnly()) && current && current.id != null &&
      bufW && bufH && (bufW !== fw || bufH !== fh)){
    fw = bufW; fh = bufH;
    setSpriteSize(current.id, fw, fh);
  }
  var can = preview;
  var cx = can.getContext('2d');
  var k = can.width / fw; // логика (fw×fh: якоря/бокс) → экран, канвас всегда fw:fh
  var a, b, animName;
  cx.imageSmoothingEnabled = false;
  fillChecker(cx, fw, fh, k, k);
  if (buf){
    /* Буфер арта (bufW×bufH) может не совпадать по аспекту с footprint (fw×fh) —
       масштаб в канвас всегда единый по X/Y (см. fitExact), иначе арт-пиксели
       теряют квадратность; то же самое (с округлением до целых) делает рендер
       (blitEntSprite и т.п.) — здесь округлять нельзя, иначе на большом зуме
       разойдётся с cellOf(). */
    var fit = fitExact(bufW, bufH, can.width, can.height);
    cx.drawImage(buf, 0, 0, bufW, bufH, fit.padX, fit.padY, fit.dw, fit.dh);
  }
  else if (current && mode === 'tile' && !current.custom) paintTileIcon(cx, current, can.width);
  if (canEditAnchors()){
    if (tool === 'hitbox'){ drawSpriteBox(cx, k, true); drawAnchors(cx, k); }
  } else if (!hasSpriteFrames()){
    drawHitShape(cx, can.width, k, tool === 'hitbox');
  }
  if (hitLab){
    if (canEditAnchors()){
      animName = (current.anims.filter(function(an){ return an.id === animId; })[0] || { name: animId }).name;
      a = liveAnchors();
      b = liveBoxRect();
      hitLab.textContent = 'Frame ' + (frameI + 1) + ' · ' + animName +
        (a ? ' · origin ' + fmtN(a.origin.x) + ',' + fmtN(a.origin.y) +
          (b ? ' · box ' + fmtN(b.w) + '×' + fmtN(b.h) : '') +
          ' · hands ' + fmtN(a.grab.x) + ',' + fmtN(a.grab.y) +
          ' · weapon ' + fmtN(a.weapon.x) + ',' + fmtN(a.weapon.y) : '');
    } else if (hasSpriteFrames()){
      animName = (current.anims.filter(function(an){ return an.id === animId; })[0] || { name: animId }).name;
      hitLab.textContent = 'Frame ' + (frameI + 1) + ' · ' + animName;
    } else hitLab.textContent = hitText();
  }
  syncAnchorFields();
  syncCursor();
}

function syncTools(){
  if (toolsEl){
    var btns = toolsEl.querySelectorAll('[data-tool]'), i;
    for (i = 0; i < btns.length; i++)
      btns[i].classList.toggle('on', btns[i].getAttribute('data-tool') === tool);
  }
  if (hintEl) hintEl.textContent = canEditAnchors()
    ? HINT.sprite
    : (HINT[tool] || HINT.pencil);
  paintCanvas();
}

function applySpriteHitbox(x0, y0, x1, y1){
  var minW = artStep(), minH = artStep();
  var x = Math.min(x0, x1), y = Math.min(y0, y1);
  var w = Math.max(minW, Math.abs(x1 - x0)), h = Math.max(minH, Math.abs(y1 - y0));
  if (x + w > fw) w = fw - x;
  if (y + h > fh) h = fh - y;
  if (w < minW) w = minW;
  if (h < minH) h = minH;
  pendingBox = { x: x, y: y, w: w, h: h };
  paintCanvas();
}

function commitSpriteHitbox(){
  var ak = anchorKind(), box;
  if (!canEditAnchors() || !ak || !pendingBox) return;
  box = pendingBox;
  pendingBox = null;
  markOp();
  setFrameAnchor(ak, animId, frameI, 'origin', box.x, box.y);
  setAnimBox(ak, animId, box.w, box.h);
  notify();
  syncAnchorFields();
  paintCanvas();
  paintStrips();
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
  markOp();
  updateTile(current.id, { collide: 'custom', box: pendingBox });
  pendingBox = null;
  notify();
}

/* Зум — transform:scale (не width/height), окно превью (.ed-tilegeo-vp, overflow:hidden)
   держит фиксированный размер — зум происходит "внутри" него, а не раздувает панель. */
function applyPreviewTransform(can){
  can.style.transform = (previewZoom === 1 && !previewPanX && !previewPanY)
    ? ''
    : 'translate(' + previewPanX + 'px,' + previewPanY + 'px) scale(' + previewZoom + ')';
}

/** Зум колесом мыши поверх окна превью — независим от paint/hitbox биндингов
    (работает и на view-only канвасе Tile Details). Не даёт скроллить панель под курсором;
    скролл содержимого панели вне окна превью не тронут. */
function bindPreviewZoom(can){
  previewZoom = 1;
  previewPanX = 0; previewPanY = 0;
  applyPreviewTransform(can);
  can.addEventListener('wheel', function(e){
    e.preventDefault();
    e.stopPropagation();
    var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    previewZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, previewZoom * factor));
    applyPreviewTransform(can);
  }, { passive: false });
}

function bindPreview(can){
  can.addEventListener('contextmenu', function(e){ e.preventDefault(); e.stopPropagation(); });
  can.addEventListener('pointerdown', function(e){
    if (!canPaint() && !canEditAnchors()) return;
    if (e.button === 1 && e.ctrlKey){
      e.preventDefault();
      e.stopPropagation();
      try { can.setPointerCapture(e.pointerId); } catch (_){}
      panDrag = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x0: previewPanX, y0: previewPanY };
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    try { can.setPointerCapture(e.pointerId); } catch (_){}
    if (e.button === 0 && e.ctrlKey){
      zoomDrag = { pointerId: e.pointerId, startY: e.clientY, startZoom: previewZoom };
      return;
    }
    altPick = e.altKey;
    if (e.button === 0 && canEditAnchors() && tool === 'hitbox' && !e.altKey){
      var hit = hitAnchor(e, can);
      if (hit){
        var a0 = liveAnchors();
        pendingAnchor = { kind: hit, x: a0[hit].x, y: a0[hit].y };
        syncCursor();
        paintCanvas();
        return;
      }
    }
    syncCursor();
    if (tool === 'hitbox'){
      if (e.button !== 0) return;
      if (canEditAnchors()){
        var rh = hitBoxHandle(e, can);
        if (rh){
          var b0 = liveBoxRect();
          boxDrag = { sprite: true, resize: rh, x0: b0.x, y0: b0.y, x1: b0.x + b0.w, y1: b0.y + b0.h };
          return;
        }
        var hs = edgeOf(e, can);
        boxDrag = { x0: hs.x, y0: hs.y, sprite: true };
        applySpriteHitbox(hs.x, hs.y, hs.x, hs.y);
        return;
      }
      if (!isCustomTile()) return;
      var a = edgeOf(e, can);
      boxDrag = { x0: a.x, y0: a.y };
      applyBox(a.x, a.y, a.x, a.y);
      return;
    }
    if (!canPaint()) return;
    if (e.button === 0 && e.altKey){
      pickAt(e);
      return;
    }
    var erase = e.button === 2;
    var p = cellOf(e, can);
    painting = { erase: erase, x: p.x, y: p.y };
    stamp(p.x, p.y, erase);
    paintCanvas();
  });
  can.addEventListener('pointermove', function(e){
    if (panDrag){
      if (e.pointerId !== panDrag.pointerId) return;
      previewPanX = panDrag.x0 + (e.clientX - panDrag.startX);
      previewPanY = panDrag.y0 + (e.clientY - panDrag.startY);
      applyPreviewTransform(can);
      return;
    }
    if (zoomDrag){
      if (e.pointerId !== zoomDrag.pointerId) return;
      var dyz = e.clientY - zoomDrag.startY;
      previewZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomDrag.startZoom * Math.exp(-dyz / 150)));
      applyPreviewTransform(can);
      return;
    }
    if (e.altKey !== altPick){
      altPick = e.altKey;
      syncCursor();
    }
    if (pendingAnchor){
      var c = cellOfLogical(e, can);
      pendingAnchor.x = c.x;
      pendingAnchor.y = c.y;
      paintCanvas();
      return;
    }
    if (!painting && !boxDrag && canEditAnchors() && preview){
      var over = tool === 'hitbox' ? hitAnchor(e, can) : null;
      preview.classList.toggle('tool-anchor', !!over);
      preview.classList.toggle('tool-pick', altPick && !over);
      var overHandle = (tool === 'hitbox' && !over) ? hitBoxHandle(e, can) : null;
      can.style.cursor = overHandle ? HANDLE_CURSOR[overHandle] : '';
    }
    if (boxDrag){
      if (boxDrag.resize){
        var rp = edgeOf(e, can);
        var nx0 = boxDrag.x0, ny0 = boxDrag.y0, nx1 = boxDrag.x1, ny1 = boxDrag.y1;
        if (boxDrag.resize.indexOf('n') >= 0) ny0 = rp.y;
        if (boxDrag.resize.indexOf('s') >= 0) ny1 = rp.y;
        if (boxDrag.resize.indexOf('w') >= 0) nx0 = rp.x;
        if (boxDrag.resize.indexOf('e') >= 0) nx1 = rp.x;
        applySpriteHitbox(nx0, ny0, nx1, ny1);
        return;
      }
      var b = edgeOf(e, can);
      if (boxDrag.sprite) applySpriteHitbox(boxDrag.x0, boxDrag.y0, b.x, b.y);
      else applyBox(boxDrag.x0, boxDrag.y0, b.x, b.y);
      return;
    }
    if (!painting) return;
    var p = cellOf(e, can);
    stampLine(painting.x, painting.y, p.x, p.y, painting.erase);
    painting.x = p.x; painting.y = p.y;
    paintCanvas();
  });
  function end(e){
    if (panDrag){
      if (e && e.pointerId !== panDrag.pointerId) return;
      panDrag = null;
      return;
    }
    if (zoomDrag){
      if (e && e.pointerId !== zoomDrag.pointerId) return;
      zoomDrag = null;
      return;
    }
    if (pendingAnchor){
      var pa = pendingAnchor;
      pendingAnchor = null;
      commitAnchor(pa.kind, pa.x, pa.y);
      return;
    }
    if (boxDrag){
      var spr = boxDrag.sprite;
      boxDrag = null;
      if (spr) commitSpriteHitbox();
      else commitBox();
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
  can.addEventListener('pointerleave', function(){
    if (!altPick) return;
    altPick = false;
    syncCursor();
  });
}

/** Step the current animation's frame by ±1 (wraps). Returns false if nothing to step. */
export function stepDetailsFrame(dir){
  if (!isDetailsOpen() || !hasSpriteFrames() || !current) return false;
  var n = getAnimFrameCount(current.id, animId);
  if (n < 2) return false;
  selectFrame(animId, ((frameI + dir) % n + n) % n);
  return true;
}

function selectFrame(nextAnim, nextI, keepPlay){
  if (!keepPlay) stopPlay();
  if (nextAnim === animId && nextI === frameI){
    if (keepPlay){
      loadBuf(currentSrc(), function(){ paintCanvas(); syncStripOn(); });
    }
    return;
  }
  animId = nextAnim;
  frameI = nextI;
  loadBuf(currentSrc(), function(){
    fillSwatches();
    syncTools();
    if (keepPlay) syncStripOn();
    else paintStrips();
  });
  paintCanvas();
}

function syncStripOn(){
  if (!stripsEl) return;
  var list = stripsEl.querySelectorAll('.ed-tile-frame'), i, th, ai, fi;
  for (i = 0; i < list.length; i++){
    th = list[i];
    ai = th.getAttribute('data-anim') || '';
    fi = +(th.getAttribute('data-i') || 0);
    th.classList.toggle('on', ai === animId && fi === frameI);
  }
}

function tileFramesList(){
  if (!current) return [];
  if (isCustomTile()){
    var def = getTileDef(current.id);
    if (def && def.frames && def.frames.length) return def.frames.slice();
    if (def && def.src) return [def.src];
    return [];
  }
  var g = getTileGfx(current.id);
  if (g && g.frames && g.frames.length) return g.frames.slice();
  if (g && g.src) return [g.src];
  return [];
}

function writeTileFrames(frames){
  if (!current || !frames || !frames.length) return;
  markOp();
  if (isCustomTile()){
    updateTile(current.id, { frames: frames, src: frames[0] });
    current.src = frames[0];
  } else {
    setTileGfx(current.id, { frames: frames, src: frames[0] });
  }
  notify();
}

function addAnimFrame(rowId){
  var n, src, frames, last;
  markOp();
  if (isSprite()){
    n = getAnimFrameCount(current.id, rowId);
    last = getSpriteFrameSrc(current.id, rowId, n - 1) || bakeSpriteFrameSrc(current.id, rowId, n - 1);
    setAnimFrameCount(current.id, rowId, n + 1);
    if (last) setSpriteFrame(current.id, rowId, n, last, true);
    current = getSpriteDef(current.id) || current;
    notify();
    selectFrame(rowId, n);
    fillBody();
    return;
  }
  frames = tileFramesList();
  if (!frames.length){
    src = currentSrc();
    if (!src) return;
    frames = [src];
  }
  frames.push(frames[frames.length - 1]);
  writeTileFrames(frames);
  selectFrame('', frames.length - 1);
  fillBody();
}

function addNewAnim(){
  if (!isSprite() || !current || !current.custom) return;
  var n = 1, id;
  do { id = 'anim' + n; n++; } while (animOf(current, id));
  markOp();
  var res = addAnimDef(current.id, id, 'New', 1);
  if (!res) return;
  current = res;
  notify();
  selectFrame(id, 0);
  fillBody();
}

function animOf(def, animId){
  var i;
  if (!def || !def.anims) return null;
  for (i = 0; i < def.anims.length; i++)
    if (def.anims[i].id === animId) return def.anims[i];
  return null;
}

function reorderTileFrames(fromI, toI){
  var frames = tileFramesList(), item;
  if (fromI === toI || fromI < 0 || toI < 0 || fromI >= frames.length || toI >= frames.length) return;
  item = frames.splice(fromI, 1)[0];
  frames.splice(toI, 0, item);
  if (frameI === fromI) frameI = toI;
  else if (fromI < frameI && toI >= frameI) frameI--;
  else if (fromI > frameI && toI <= frameI) frameI++;
  writeTileFrames(frames);
  paintStrips();
  loadBuf(currentSrc(), function(){ fillSwatches(); syncTools(); paintCanvas(); });
}

/** Удалить кадр анимации: markOp/remove/notify + починить выделение и стрипы. */
function deleteAnimFrameAt(rowId, ii){
  if (!isSprite() || !current) return;
  var n = getAnimFrameCount(current.id, rowId);
  if (n <= 1) return;
  markOp();
  removeAnimFrame(current.id, rowId, ii);
  current = getSpriteDef(current.id) || current;
  notify();
  var newN = getAnimFrameCount(current.id, rowId);
  var nextI = frameI;
  if (rowId === animId && ii <= frameI) nextI = frameI - 1;
  nextI = Math.max(0, Math.min(nextI, newN - 1));
  selectFrame(rowId, nextI);
  fillBody();
}

function bindFrameDrag(th, rowId, ii, n){
  var holdTimer = null;
  function clearHold(){
    if (holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
    th.classList.remove('holding');
  }
  th.addEventListener('pointerdown', function(e){
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return;
    frameDrag = {
      anim: rowId, from: ii, startX: e.clientX, startY: e.clientY,
      moved: false, el: th, pointerId: e.pointerId, canReorder: n >= 2 && canPaint()
    };
    try { th.setPointerCapture(e.pointerId); } catch (_){}
    if (isSprite() && canPaint() && n > 1){
      th.classList.add('holding');
      holdTimer = setTimeout(function(){
        holdTimer = null;
        if (!frameDrag || frameDrag.el !== th || frameDrag.moved) return;
        frameDrag = null;
        th.classList.remove('holding');
        deleteAnimFrameAt(rowId, ii);
      }, HOLD_DELETE_MS);
    }
  });
  th.addEventListener('pointermove', function(e){
    if (!frameDrag || frameDrag.el !== th || e.pointerId !== frameDrag.pointerId) return;
    var dx = e.clientX - frameDrag.startX, dy = e.clientY - frameDrag.startY;
    if (holdTimer && dx * dx + dy * dy >= 25) clearHold();
    if (!frameDrag.canReorder) return;
    if (!frameDrag.moved && dx * dx + dy * dy < 25) return;
    frameDrag.moved = true;
    th.classList.add('dragging');
    var bar = th.parentNode, kids, i, target = frameDrag.from, rect;
    if (!bar) return;
    kids = bar.querySelectorAll('.ed-tile-frame');
    for (i = 0; i < kids.length; i++){
      rect = kids[i].getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2){ target = i; break; }
      target = i;
    }
    frameDrag.to = target;
  });
  function endDrag(e){
    clearHold();
    if (!frameDrag || frameDrag.el !== th || e.pointerId !== frameDrag.pointerId) return;
    var from = frameDrag.from, to = frameDrag.to != null ? frameDrag.to : from, moved = frameDrag.moved;
    th.classList.remove('dragging');
    frameDrag = null;
    if (!moved){
      selectFrame(rowId, ii);
      return;
    }
    if (from === to){ paintStrips(); return; }
    if (isSprite()){
      markOp();
      reorderAnimFrames(current.id, rowId, from, to);
      if (frameI === from && animId === rowId) frameI = to;
      else if (animId === rowId){
        if (from < frameI && to >= frameI) frameI--;
        else if (from > frameI && to <= frameI) frameI++;
      }
      current = getSpriteDef(current.id) || current;
      notify();
      paintStrips();
      loadBuf(currentSrc(), function(){ fillSwatches(); syncTools(); paintCanvas(); });
    } else {
      reorderTileFrames(from, to);
    }
  }
  th.addEventListener('pointerup', endDrag);
  th.addEventListener('pointercancel', endDrag);
}

function togglePlay(){
  var rows, row, n, fps;
  if (playTimer){ stopPlay(); return; }
  if (hasSpriteFrames()){
    n = getAnimFrameCount(current.id, animId);
    fps = getAnimSpeed(current.id, animId);
  } else {
    n = tileFrameCount(current.id);
    fps = 8;
  }
  if (n < 2) return;
  if (playBtn){
    playBtn.textContent = 'Stop';
    playBtn.classList.add('on');
  }
  playTimer = setInterval(function(){
    if (!current){ stopPlay(); return; }
    if (hasSpriteFrames()) n = getAnimFrameCount(current.id, animId);
    else n = tileFrameCount(current.id);
    if (n < 2){ stopPlay(); return; }
    selectFrame(animId, (frameI + 1) % n, true);
  }, 1000 / fps);
  void rows; void row;
}

function frameSrcAt(aId, i){
  if (hasSpriteFrames()){
    var s = getSpriteFrameSrc(current.id, aId, i);
    return s || bakeSpriteFrameSrc(current.id, aId, i);
  }
  return tileFrameSrc(current.id, i) || currentSrc();
}

function rowH(){
  var row = stripsEl && stripsEl.querySelector('.ed-tile-anim');
  return row ? Math.max(36, row.offsetHeight) : 48;
}

function applyStripH(){
  if (!stripsEl) return;
  if (stripsEl.hidden){
    if (splitEl) splitEl.hidden = true;
    return;
  }
  if (splitEl) splitEl.hidden = false;
  var one = rowH();
  var h = stripH > 0 ? stripH : one;
  if (h < one) h = one;
  stripsEl.style.height = h + 'px';
}

function bindSplit(el){
  el.addEventListener('pointerdown', function(e){
    if (e.button !== 0 || !stripsEl || stripsEl.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    var startY = e.clientY;
    var startH = stripsEl.offsetHeight;
    var max = Math.max(rowH(), (root.clientHeight || 400) - 180);
    try { el.setPointerCapture(e.pointerId); } catch (_){}
    function move(ev){
      if (ev.pointerId !== e.pointerId) return;
      var one = rowH();
      stripH = Math.max(one, Math.min(max, startH + (ev.clientY - startY)));
      stripsEl.style.height = stripH + 'px';
    }
    function up(ev){
      if (ev.pointerId !== e.pointerId) return;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      try { localStorage.setItem(STRIP_KEY, String(stripH)); } catch (_){}
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

function paintStrips(){
  if (!stripsEl) return;
  var rows = [];
  if (hasSpriteFrames()){
    current = getSpriteDef(current.id) || current;
    rows = (current.anims || []).map(function(a){
      return { id: a.id, name: a.name, n: getAnimFrameCount(current.id, a.id), speed: getAnimSpeed(current.id, a.id) };
    });
  } else {
    var n0 = tileFrameCount(current.id);
    if (n0 >= 1 && canPaint()) rows = [{ id: '', name: 'Frames', n: Math.max(1, n0) }];
  }
  if (!rows.length){
    stripsEl.hidden = true;
    stripsEl.textContent = '';
    applyStripH();
    return;
  }
  var hadFilterFocus = animFilterEl && document.activeElement === animFilterEl;
  var filterSelStart = hadFilterFocus ? animFilterEl.selectionStart : null;
  stripsEl.hidden = false;
  stripsEl.textContent = '';
  var visRows = rows;
  if (hasSpriteFrames()){
    var head = document.createElement('div');
    head.className = 'ed-tile-anim-toolbar';
    if (rows.length > 1){
      var searchInp = document.createElement('input');
      searchInp.type = 'text';
      searchInp.className = 'ed-tile-anim-search';
      searchInp.placeholder = 'Find animation…';
      searchInp.value = animFilter;
      searchInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
      searchInp.addEventListener('input', function(){
        animFilter = searchInp.value;
        paintStrips();
      });
      head.appendChild(searchInp);
      animFilterEl = searchInp;
    } else {
      animFilterEl = null;
    }
    if (canPaint()){
      var addAnimBtn = document.createElement('button');
      addAnimBtn.type = 'button';
      addAnimBtn.className = 'edb ed-tile-frame-add';
      addAnimBtn.textContent = '+';
      addAnimBtn.title = current.custom ? 'Add a new animation' : 'Custom sprites only — clone first (Ctrl+D)';
      addAnimBtn.disabled = !current.custom;
      addAnimBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        addNewAnim();
      });
      head.appendChild(addAnimBtn);
    }
    stripsEl.appendChild(head);
    if (hadFilterFocus && animFilterEl){
      animFilterEl.focus();
      if (filterSelStart != null) animFilterEl.setSelectionRange(filterSelStart, filterSelStart);
    }
    if (animFilter){
      var q = animFilter.toLowerCase();
      visRows = rows.filter(function(rw){ return (rw.name || '').toLowerCase().indexOf(q) !== -1; });
      if (!visRows.length){
        var none = document.createElement('div');
        none.className = 'ed-tile-note';
        none.textContent = 'No animations match "' + animFilter + '"';
        stripsEl.appendChild(none);
      }
    }
  }
  var r;
  for (r = 0; r < visRows.length; r++){
    (function(row){
      var wrap = document.createElement('div');
      wrap.className = 'ed-tile-anim';
      var head = document.createElement('div');
      head.className = 'ed-tile-anim-head';
      var lab = document.createElement('div');
      lab.className = 'ed-tile-anim-name';
      lab.textContent = row.name;
      head.appendChild(lab);
      if (row.id && canPaint()){
        var spdWrap = document.createElement('label');
        spdWrap.className = 'ed-tile-anim-speed';
        spdWrap.title = 'Playback speed, frames/sec — same value drives editor Play and the game';
        var spdLab = document.createElement('span');
        spdLab.textContent = 'fps';
        var spdInp = numInp(row.speed, 0.1, 60);
        spdInp.step = '0.1';
        spdInp.addEventListener('change', function(){
          var v = parseFloat(spdInp.value);
          if (isNaN(v) || v <= 0){ spdInp.value = String(row.speed); return; }
          markOp();
          setAnimSpeed(current.id, row.id, v);
          notify();
          if (playTimer && animId === row.id) { stopPlay(); togglePlay(); }
        });
        spdWrap.appendChild(spdInp);
        spdWrap.appendChild(spdLab);
        head.appendChild(spdWrap);
      }
      wrap.appendChild(head);
      var bar = document.createElement('div');
      bar.className = 'ed-tile-anim-frames';
      var i;
      for (i = 0; i < row.n; i++){
        (function(ii){
          var th = document.createElement('canvas');
          th.width = fw;
          th.height = fh;
          th.className = 'ed-tile-frame' + (row.id === animId && ii === frameI ? ' on' : '');
          th.setAttribute('data-anim', row.id);
          th.setAttribute('data-i', String(ii));
          if (isSprite() && isSpriteFrameDirty(current.id, row.id, ii))
            th.classList.add('dirty');
          th.title = canPaint()
            ? (row.name + ' ' + (ii + 1) + ' — drag to reorder · hold to delete · drop tile swatch to replace')
            : (row.name + ' ' + (ii + 1));
          var cx = th.getContext('2d');
          cx.imageSmoothingEnabled = false;
          fillChecker(cx, fw, fh, 1, 1);
          var img = new Image();
          img.onload = function(){
            cx.imageSmoothingEnabled = false;
            fillChecker(cx, fw, fh, 1, 1);
            var natW = img.naturalWidth || fw, natH = img.naturalHeight || fh;
            var fit = fitExact(natW, natH, fw, fh);
            cx.drawImage(img, 0, 0, natW, natH, fit.padX, fit.padY, fit.dw, fit.dh);
            drawThumbAnchors(cx, row.id, ii);
          };
          img.src = frameSrcAt(row.id, ii);
          if (canEditAnchors()) drawThumbAnchors(cx, row.id, ii);
          bindFrameDrag(th, row.id, ii, row.n);
          bar.appendChild(th);
        })(i);
      }
      if (canPaint()){
        var add = document.createElement('button');
        add.type = 'button';
        add.className = 'edb ed-tile-frame-add';
        add.textContent = '+';
        add.title = 'Add frame';
        add.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          addAnimFrame(row.id);
        });
        bar.appendChild(add);
      }
      wrap.appendChild(bar);
      stripsEl.appendChild(wrap);
    })(visRows[r]);
  }
  applyStripH();
}

/* Импорт картинки в кадр спрайта: без нарезки на лист, без подгонки/масштабирования
   под Size — картинка сохраняется как есть, в своём нативном разрешении (может
   быть крупнее или мельче footprint, рендер сам скейлит под fw×fh). Size (хитбокс)
   этим импортом не трогается. */
function applySpriteImport(img){
  var w = img.naturalWidth || img.width;
  var h = img.naturalHeight || img.height;
  markOp();
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  cx.drawImage(img, 0, 0);
  setSpriteFrame(current.id, animId, frameI, canvasToPng(c), true);
  /* footprint следует за реальным размером арта сразу, до fillBody() — иначе
     слайдеры origin/box успеют построиться со старым (виртуальным) max. */
  if (w !== fw || h !== fh){ fw = w; fh = h; setSpriteSize(current.id, fw, fh); }
  notify();
  fillBody();
}

/* Картинка на голый тайл (legacy src/frames, без привязанного спрайта) —
   тот же принцип, что и applySpriteImport: как есть, без ресайза. paintCustom
   (render/tiles.js) и так скейлит нативный размер в T×T при отрисовке. */
function applyImportFile(file){
  if (!current || !file || !canPaint()) return;
  loadImageFile(file).then(function(img){
    if (isSprite()){ applySpriteImport(img); return; }
    var c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    var cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(img, 0, 0);
    var src = canvasToPng(c);
    markOp();
    if (isCustomTile()){
      updateTile(current.id, { src: src });
      current.src = src;
    } else {
      setTileGfx(current.id, { src: src });
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

/** Tile Details: Sprite slot + collision/flags only (no pixel paint). */
function fillTileParamsOnly(){
  var custom = isCustomTile();
  var def = custom ? getTileDef(current.id) : null;
  spriteSlotEl = null;
  fillTileSpriteSlot(body);

  var sc = scaleOf();
  var can = document.createElement('canvas');
  can.width = fw * sc;
  can.height = fh * sc;
  can.className = 'ed-tilegeo';
  var vpWrap = document.createElement('div');
  vpWrap.className = 'ed-tilegeo-vp';
  vpWrap.style.aspectRatio = fw + ' / ' + fh;
  vpWrap.appendChild(can);
  body.appendChild(vpWrap);
  preview = can;
  bindPreviewZoom(can);

  hitLab = document.createElement('div');
  hitLab.className = 'ed-tile-hitlab';
  body.appendChild(hitLab);

  var nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.value = current.name || '';
  nameInp.maxLength = 24;
  nameInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  nameInp.addEventListener('change', function(){
    var val = nameInp.value.trim() || current.name;
    if (def){
      markOp();
      updateTile(def.id, { name: val });
    } else if (onRenameBuiltinTile){
      onRenameBuiltinTile(current.id, val);
    }
    current.name = val;
    notify();
  });
  field('Name', nameInp);

  var tagInp = document.createElement('input');
  tagInp.type = 'text';
  tagInp.value = current.tag || '';
  tagInp.maxLength = 24;
  tagInp.placeholder = '—';
  tagInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  tagInp.addEventListener('change', function(){
    var val = tagInp.value.trim();
    if (def){
      markOp();
      updateTile(def.id, { tag: val });
    } else if (onRetagBuiltinTile){
      onRetagBuiltinTile(current.id, val);
    }
    current.tag = val;
    notify();
  });
  field('Tag', tagInp);

  var over = document.createElement('input');
  over.type = 'checkbox';
  over.checked = !!(def ? def.overlay : false);
  over.disabled = !custom;
  over.addEventListener('change', function(){
    if (!def) return;
    markOp();
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
    markOp();
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
    markOp();
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
    markOp();
    updateTile(def.id, { oneWay: oneWay.checked });
    notify();
  });
  var owRow = document.createElement('label');
  owRow.className = 'ed-check';
  owRow.appendChild(oneWay);
  owRow.appendChild(document.createTextNode(' One-way — stand from above, pass from below'));
  body.appendChild(owRow);

  var dur = document.createElement('input');
  dur.type = 'number';
  dur.min = '0';
  dur.step = '1';
  dur.value = String((def && def.durability) || 0);
  dur.disabled = !custom;
  dur.addEventListener('change', function(){
    if (!def) return;
    markOp();
    updateTile(def.id, { durability: Math.max(0, dur.value | 0) });
    notify();
  });
  var durRow = document.createElement('label');
  durRow.className = 'ed-check';
  durRow.appendChild(document.createTextNode('Durability (pickaxe hits, 0 = unbreakable) '));
  durRow.appendChild(dur);
  body.appendChild(durRow);

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
    if (sel.value === 'none') box = def.box;
    markOp();
    updateTile(def.id, { collide: sel.value, box: box });
    notify();
    fillBody();
  });
  field('Collision', sel);

  var behId = tileBaseId(current.id);
  if (behId === GAME.FALL){
    var fallId = current.id;
    function addFallSlider(label, title, key, def, min, max, getter){
      var wrap = document.createElement('label');
      wrap.className = 'slider-wrap';
      wrap.title = title;
      wrap.innerHTML = '<div class="slider-label-overlay"><span>' + label + '</span><span></span></div>';
      var inp = document.createElement('input');
      inp.type = 'range';
      inp.min = min; inp.max = max; inp.step = 1;
      inp.value = getter(fallId, def);
      inp.dataset.default = String(def);
      inp.addEventListener('input', function(){
        markOp();
        var patch = {};
        patch[key] = +inp.value;
        setTileGfx(fallId, patch);
        notify();
      });
      wrap.appendChild(inp);
      body.appendChild(wrap);
      initSliders(wrap);
    }
    addFallSlider('Speed', 'Procedural waterfall scroll speed (0 = frozen)', 'speed', 70, 0, 200, getTileSpeed);
    addFallSlider('Length', 'Light strand length along the fall (world-continuous)', 'length', 25, 0, 100, getTileLength);
    addFallSlider('Wave', 'How much each strand bends (0 = straight)', 'wave', 15, 0, 100, getTileWave);
    addFallSlider('Random', 'Per-strand variation of phase/speed/x/length', 'random', 35, 0, 100, getTileRandom);
    addFallSlider('Offset', 'Phase desync between strands (0 = lockstep)', 'offset', 55, 0, 100, getTileOffset);
    addFallSlider('Fade', 'Transparency: more holes + lower alpha (0 = solid)', 'fade', 0, 0, 100, getTileFade);
    addFallSlider('L2 Speed', 'Layer-2 speed offset vs Speed (−100 = stop, 0 = same, +100 = 2×)', 'speed2', -8, -100, 100, getTileSpeed2);
    addFallSlider('L2 Length', 'Layer-2 light strand length', 'length2', 20, 0, 100, getTileLength2);
    addFallSlider('L2 Density', 'Layer-2 strand count (1…8)', 'density2', 50, 0, 100, getTileDensity2);
    addFallSlider('L2 Wave', 'Layer-2 bend amount (0 = straight)', 'wave2', 20, 0, 100, getTileWave2);
    addFallSlider('Foam', 'Foam wave amplitude on top FALL and above WATER (0 = none)', 'foam', 45, 0, 100, getTileFoam);
    addFallSlider('Foam Size', 'Foam pixel block size (1…4)', 'foamSize', 40, 0, 100, getTileFoamSize);
    addFallSlider('Foam Random', 'Foam crest jitter / bubble scatter', 'foamRandom', 40, 0, 100, getTileFoamRandom);
    addFallSlider('Foam Speed', 'Foam wave scroll speed (0 = frozen)', 'foamSpeed', 100, 0, 200, getTileFoamSpeed);
    addFallSlider('Spray', 'Spray droplet strength at foam ends (0 = none)', 'spray', 55, 0, 100, getTileSpray);
    addFallSlider('Spray Speed', 'Spray flight / respawn speed (0 = frozen)', 'spraySpeed', 100, 0, 200, getTileSpraySpeed);
    addFallSlider('Taper', 'Hanging fall thin amount (edges→center; 0 = none)', 'taper', 60, 0, 100, getTileTaper);
    addFallSlider('Taper Len', 'Tiles of vertical run until max thinness', 'taperLen', 6, 1, 12, getTileTaperLen);
  }

  if (behId === GAME.WATER){
    var waterId = current.id;
    var shDef = 100, wxDef = 50, spDef = 80;
    var shVal = getTileShift(waterId, shDef);
    var wxVal = getTileWaveX(waterId, wxDef);
    var spVal = getTileSplash(waterId, spDef);

    var shWrap = document.createElement('label');
    shWrap.className = 'slider-wrap';
    shWrap.title = 'River drift: − left, + right (0 = still unless FALL nearby)';
    shWrap.innerHTML = '<div class="slider-label-overlay"><span>Shift</span><span></span></div>';
    var shInp = document.createElement('input');
    shInp.type = 'range';
    shInp.min = -100; shInp.max = 100; shInp.step = 1;
    shInp.value = shVal;
    shInp.dataset.default = String(shDef);
    shInp.addEventListener('input', function(){
      markOp();
      setTileGfx(waterId, { shift: +shInp.value });
      notify();
    });
    shWrap.appendChild(shInp);
    body.appendChild(shWrap);
    initSliders(shWrap);

    var wxWrap = document.createElement('label');
    wxWrap.className = 'slider-wrap';
    wxWrap.title = 'Wave crest / bob amplitude (0 = flat)';
    wxWrap.innerHTML = '<div class="slider-label-overlay"><span>Wave X</span><span></span></div>';
    var wxInp = document.createElement('input');
    wxInp.type = 'range';
    wxInp.min = 0; wxInp.max = 100; wxInp.step = 1;
    wxInp.value = wxVal;
    wxInp.dataset.default = String(wxDef);
    wxInp.addEventListener('input', function(){
      markOp();
      setTileGfx(waterId, { waveX: +wxInp.value });
      notify();
    });
    wxWrap.appendChild(wxInp);
    body.appendChild(wxWrap);
    initSliders(wxWrap);

    var spWrap = document.createElement('label');
    spWrap.className = 'slider-wrap';
    spWrap.title = 'Player enter/exit splash strength on surface (0 = none)';
    spWrap.innerHTML = '<div class="slider-label-overlay"><span>Splash</span><span></span></div>';
    var spInp = document.createElement('input');
    spInp.type = 'range';
    spInp.min = 0; spInp.max = 100; spInp.step = 1;
    spInp.value = spVal;
    spInp.dataset.default = String(spDef);
    spInp.addEventListener('input', function(){
      markOp();
      setTileGfx(waterId, { splash: +spInp.value });
      notify();
    });
    spWrap.appendChild(spInp);
    body.appendChild(spWrap);
    initSliders(spWrap);
  }

  if (!tileHasLinkedSprite()){
    var need = document.createElement('div');
    need.className = 'ed-tile-note';
    need.textContent = 'No sprite — drop a Sprites swatch onto the Sprite slot. Paint lives on the Sprites tab.';
    body.appendChild(need);
  }

  var actions = document.createElement('div');
  actions.className = 'ed-tile-actions';
  if (custom){
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'edb';
    del.textContent = 'Delete';
    del.title = 'Delete this custom tile. Warns if it is used on any level.';
    del.addEventListener('click', function(){
      if (!def || !onDeleteCustom) return;
      if (!onDeleteCustom(def.id)) return;
      notify();
      closeTileEdit();
    });
    actions.appendChild(del);
  }
  body.appendChild(actions);

  loadBuf(currentSrc(), function(){ paintCanvas(); });
}

function fillBody(){
  if (!body || !current) return;
  body.scrollTop = 0;
  body.scrollLeft = 0;
  body.textContent = '';
  preview = null;
  hintEl = null;
  hitLab = null;
  toolsEl = null;
  swatchEl = null;
  colorInp = null;
  stripsEl = null;
  splitEl = null;
  painting = null;
  boxDrag = null;
  pendingBox = null;
  pendingAnchor = null;
  zoomDrag = null;
  panDrag = null;
  originXEl = originYEl = weaponXEl = weaponYEl = grabXEl = grabYEl = rotEl = null;
  boxWEl = boxHEl = null;
  spriteSlotEl = null;
  playBtn = null;

  if (mode === 'tile'){
    fillTileParamsOnly();
    return;
  }

  var sprite = isSprite();
  var anchors = canEditAnchors();

  if (isObjectOnly()){
    if (!anchors){
      fillObjectBodyNoSprite();
      return;
    }
    fillObjectHeader(body);
  } else if (objCurrent && sprite) fillObjectHeader(body);
  else if (sprite) fillSpriteHeader();

  stripsEl = document.createElement('div');
  stripsEl.className = 'ed-tile-strips';
  body.appendChild(stripsEl);

  splitEl = document.createElement('div');
  splitEl.className = 'ed-tile-split';
  splitEl.title = 'Drag to show more animation rows';
  splitEl.hidden = true;
  body.appendChild(splitEl);
  bindSplit(splitEl);

  var sc = scaleOf();
  var can = document.createElement('canvas');
  can.width = fw * sc;
  can.height = fh * sc;
  can.className = 'ed-tilegeo';
  var vpWrap = document.createElement('div');
  vpWrap.className = 'ed-tilegeo-vp';
  vpWrap.style.aspectRatio = fw + ' / ' + fh;
  vpWrap.appendChild(can);
  body.appendChild(vpWrap);
  preview = can;
  bindPreviewZoom(can);

  hitLab = document.createElement('div');
  hitLab.className = 'ed-tile-hitlab';
  body.appendChild(hitLab);

  if (sprite || anchors){
    var rollWrap = document.createElement('div');
    rollWrap.className = 'ed-rollout';
    var rollHead = document.createElement('button');
    rollHead.type = 'button';
    rollHead.className = 'ed-rollout-head';
    var rollTitle = anchors ? '▸ Box / Anchors' : '▸ Size';
    rollHead.textContent = rollTitle;
    var rollBody = document.createElement('div');
    rollBody.className = 'ed-rollout-body';
    rollBody.hidden = true;
    rollHead.addEventListener('click', function(){
      rollBody.hidden = !rollBody.hidden;
      rollHead.textContent = (rollBody.hidden ? '▸' : '▾') + (anchors ? ' Box / Anchors' : ' Size');
    });
    rollWrap.appendChild(rollHead);
    rollWrap.appendChild(rollBody);
    body.appendChild(rollWrap);

    if (sprite && canPaint()){
      var sizeW = numInp(fw, SIZE_MIN, SIZE_MAX);
      var sizeH = numInp(fh, SIZE_MIN, SIZE_MAX);
      function onSize(){
        applySpriteSize(parseInt(sizeW.value, 10) || fw, parseInt(sizeH.value, 10) || fh);
      }
      sizeW.addEventListener('change', onSize);
      sizeH.addEventListener('change', onSize);
      xyRow('Size', '', sizeW, sizeH, '×', rollBody);
    }

    if (anchors){
      originXEl = numInp(0, 0, fw, artStep());
      originYEl = numInp(0, 0, fh, artStep());
      bindAnchorInp(originXEl, 'origin', 'x');
      bindAnchorInp(originYEl, 'origin', 'y');
      originXEl.title = 'World attach for this action (every frame in the row)';
      originYEl.title = originXEl.title;
      xyRow('Origin', 'ed-anchor-o', originXEl, originYEl, ',', rollBody);

      boxWEl = numInp(10, 2, fw, artStep());
      boxHEl = numInp(22, 2, fh, artStep());
      boxWEl.title = 'Collision width for this action (from origin)';
      boxHEl.title = 'Collision height for this action (from origin). Ground is the bottom edge.';
      boxWEl.addEventListener('change', function(){
        var n = parseFloat(boxWEl.value), cur, ak = anchorKind();
        if (!ak || isNaN(n)) { syncAnchorFields(); return; }
        cur = getAnimBox(ak, animId);
        markOp();
        setAnimBox(ak, animId, n, cur.h);
        notify();
        syncAnchorFields();
        paintCanvas();
      });
      boxHEl.addEventListener('change', function(){
        var n = parseFloat(boxHEl.value), cur, ak = anchorKind();
        if (!ak || isNaN(n)) { syncAnchorFields(); return; }
        cur = getAnimBox(ak, animId);
        markOp();
        setAnimBox(ak, animId, cur.w, n);
        notify();
        syncAnchorFields();
        paintCanvas();
      });
      xyRow('Box', 'ed-anchor-b', boxWEl, boxHEl, '×', rollBody);

      grabXEl = numInp(0, 0, fw, artStep());
      grabYEl = numInp(0, 0, fh, artStep());
      grabXEl.title = 'Hands that search for a ledge (this action)';
      grabYEl.title = grabXEl.title;
      bindAnchorInp(grabXEl, 'grab', 'x');
      bindAnchorInp(grabYEl, 'grab', 'y');
      xyRow('Hands', 'ed-anchor-g', grabXEl, grabYEl, ',', rollBody);

      weaponXEl = numInp(0, 0, fw, artStep());
      weaponYEl = numInp(0, 0, fh, artStep());
      weaponXEl.title = 'Weapon hand on this frame (hero) / grip point on this object (held item, e.g. torch, axe handle)';
      weaponYEl.title = weaponXEl.title;
      bindAnchorInp(weaponXEl, 'weapon', 'x');
      bindAnchorInp(weaponYEl, 'weapon', 'y');
      xyRow('Weapon', 'ed-anchor-w', weaponXEl, weaponYEl, ',', rollBody);

      rotEl = numInp(0, 0, 359);
      rotEl.title = 'Extra rotation of the held sprite on this frame (deg), added on top of any swing angle from game logic';
      rotEl.addEventListener('change', function(){
        var ak = anchorKind(), a = liveAnchors(), n;
        if (!canEditAnchors() || !ak || !a) return;
        n = parseInt(rotEl.value, 10);
        if (isNaN(n)){ syncAnchorFields(); return; }
        markOp();
        setFrameAnchor(ak, animId, frameI, 'weapon', a.weapon.x, a.weapon.y, n);
        notify();
        syncAnchorFields();
        paintCanvas();
        paintStrips();
      });
      var rotRow = document.createElement('label');
      rotRow.className = 'ed-field ed-anchor-rot';
      var rotLab = document.createElement('span');
      rotLab.textContent = 'Rot';
      rotRow.appendChild(rotLab);
      rotRow.appendChild(rotEl);
      rollBody.appendChild(rotRow);
    }
  }

  toolsEl = document.createElement('div');
  toolsEl.className = 'ed-tile-tools';
  var t, list = TOOLS.filter(function(specT){
    if (anchors) return specT.id === 'hitbox';
    if (sprite) return specT.id === 'pencil';
    return true;
  });
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
  playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'edb' + (playTimer ? ' on' : '');
  playBtn.textContent = playTimer ? 'Stop' : 'Play';
  playBtn.title = 'Play all frames of the current animation';
  playBtn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    togglePlay();
  });
  toolsEl.appendChild(playBtn);
  body.appendChild(toolsEl);

  hintEl = document.createElement('div');
  hintEl.className = 'ed-tile-note';
  body.appendChild(hintEl);

  if (canPaint()){
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

  var sNote = document.createElement('div');
  sNote.className = 'ed-tile-note';
  sNote.textContent = anchors
    ? 'Red box = hitbox for this action; origin is its top-left, ground is the bottom edge. Gold hands = ledge search. Magenta weapon = this frame. Hit-tool drags a new box. Pixels — Sprites tab or Edit on the slot.'
    : 'Paint pixels here. Collision / origin / hands / weapon live on Object Details for the linked object.';
  body.appendChild(sNote);

  var actions = document.createElement('div');
  actions.className = 'ed-tile-actions';

  if (canPaint()){
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
    reimp.title = 'Replace this frame, or a whole row if the sheet is a strip of frames.';
    reimp.addEventListener('click', function(){ fileInp.click(); });
    actions.appendChild(reimp);

    var rst = document.createElement('button');
    rst.type = 'button';
    rst.className = 'edb';
    rst.textContent = 'Reset frame';
    rst.title = 'Forget the painted frame; the game uses the old drawing again.';
    rst.addEventListener('click', function(){
      markOp();
      clearSpriteFrame(current.id, animId, frameI);
      notify();
      loadBuf(currentSrc(), function(){
        fillSwatches();
        syncTools();
        paintStrips();
      });
    });
    actions.appendChild(rst);
  }

  if (anchors){
    var rstA = document.createElement('button');
    rstA.type = 'button';
    rstA.className = 'edb';
    rstA.textContent = 'Reset anchors';
    rstA.title = 'Forget origin, box, hands and weapon points for this action.';
    rstA.addEventListener('click', function(){
      var ak = anchorKind();
      if (!ak) return;
      markOp();
      clearAnimAnchors(ak, animId);
      notify();
      paintCanvas();
      paintStrips();
    });
    actions.appendChild(rstA);
  }
  body.appendChild(actions);

  paintStrips();
  loadBuf(currentSrc(), function(){
    if (canPaint()) fillSwatches();
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

function onAltKey(e){
  if (e.key !== 'Alt') return;
  var on = e.type === 'keydown';
  if (on === altPick) return;
  altPick = on;
  syncCursor();
}
addEventListener('keydown', onAltKey);
addEventListener('keyup', onAltKey);
addEventListener('blur', function(){
  if (!altPick) return;
  altPick = false;
  syncCursor();
});
