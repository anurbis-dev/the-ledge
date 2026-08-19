/* Каталог спрайтов персонажей: строки анимаций, кадры — PNG.
   Черновик — ledge.dev.sprites; в игру уезжает через Bake → BAKED.sprites.
   Пустой кадр = рисуем по-старому (скелет / rc). */
import { BAKED } from './defaults.js';
import { C } from './constants.js';

var KEY = 'ledge.dev.sprites';

/* fw/fh — размер кадра; ox/oy — куда кладётся локальная (0,0) позы при блице. */
export var SPRITE_DEFS = [
  {
    id: 'hero', name: 'Hero', fw: 40, fh: 48, ox: 16, oy: 22, fx: 5, kind: 'hero',
    anims: [
      { id: 'idle', name: 'Idle', n: 2 },
      { id: 'run', name: 'Run', n: 4 },
      { id: 'jump', name: 'Jump', n: 1 },
      { id: 'fall', name: 'Fall', n: 1 },
      { id: 'land', name: 'Land', n: 1 },
      { id: 'slide', name: 'Slide', n: 1 },
      { id: 'crouch', name: 'Crouch', n: 1 },
      { id: 'crouchWalk', name: 'Crouch walk', n: 1 },
      { id: 'prone', name: 'Prone', n: 2 },
      { id: 'wallPush', name: 'Wall push', n: 1 },
      { id: 'vault', name: 'Vault', n: 1 },
      { id: 'pick', name: 'Pick', n: 1 },
      { id: 'throw', name: 'Throw', n: 1 },
      { id: 'attack', name: 'Attack', n: 3 },
      { id: 'roll', name: 'Roll', n: 1 },
      { id: 'stun', name: 'Stun', n: 1 },
      { id: 'snare', name: 'Snare', n: 1 },
      { id: 'ladder', name: 'Ladder', n: 2 },
      { id: 'ladderF', name: 'Ladder front', n: 2 },
      { id: 'ladderD', name: 'Ladder diag', n: 2 },
      { id: 'bars', name: 'Bars', n: 2 },
      { id: 'swim', name: 'Swim', n: 2 },
      { id: 'dive', name: 'Dive', n: 2 },
      { id: 'hangLad', name: 'Hang ladder', n: 1 },
      { id: 'hang', name: 'Hang ledge', n: 2 },
      { id: 'climb', name: 'Climb', n: 5 },
      { id: 'bow', name: 'Bow', n: 3 },
      { id: 'grapple', name: 'Grapple', n: 2 },
      { id: 'getup', name: 'Get up', n: 3 }
    ]
  },
  { id: 'enemy0', name: 'Foe 1', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'enemy0',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'enemy1', name: 'Foe 2', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'enemy1',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'enemy2', name: 'Foe 3', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'enemy2',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'flier0', name: 'Bird', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier0',
    anims: [{ id: 'flap', name: 'Flap', n: 2 }] },
  { id: 'flier1', name: 'Bird 2', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier1',
    anims: [{ id: 'flap', name: 'Flap', n: 2 }] },
  { id: 'flier2', name: 'Bird 3', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier2',
    anims: [{ id: 'flap', name: 'Flap', n: 2 }] },
  { id: 'flier3', name: 'Diver', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier3',
    anims: [{ id: 'flap', name: 'Flap', n: 2 }] },
  { id: 'spider0', name: 'Spider', fw: 16, fh: 16, ox: 5, oy: 6, kind: 'spider0',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'spider1', name: 'Spider 2', fw: 16, fh: 16, ox: 5, oy: 6, kind: 'spider1',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'spider2', name: 'Spider 3', fw: 16, fh: 16, ox: 5, oy: 6, kind: 'spider2',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'npc_hermit', name: 'Hermit', fw: 16, fh: 16, ox: 3, oy: 0, kind: 'npc_hermit',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'npc_wanderer', name: 'Wanderer', fw: 16, fh: 16, ox: 3, oy: 0, kind: 'npc_wanderer',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  { id: 'lantern', name: 'Lantern', fw: 16, fh: 16, ox: 8, oy: 8, kind: 'light',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] }
];

var byId = {};
var i0;
for (i0 = 0; i0 < SPRITE_DEFS.length; i0++) byId[SPRITE_DEFS[i0].id] = SPRITE_DEFS[i0];

/* saved[spriteId][animId] = { frames, dirty, origin, grab, weapon, box:{w,h} }
   saved[spriteId]._meta = { fw, fh, ox, oy, fx } — оверрайд каталога. */
var BOX_MIN = 2;
var saved = {};
var imgs = {};
var onChange = null;
var MIN_S = 8, MAX_S = 128;

function animOf(def, animId){
  var i;
  if (!def) return null;
  for (i = 0; i < def.anims.length; i++)
    if (def.anims[i].id === animId) return def.anims[i];
  return null;
}

function imgKey(id, anim, i){ return id + ':' + anim + ':' + i; }

function loadSrc(key, src){
  if (!src) return;
  if (imgs[key] && imgs[key]._src === src) return;
  var img = new Image();
  img._src = src;
  img.onload = function(){ if (onChange) onChange('img'); };
  img.src = src;
  imgs[key] = img;
}

function loadAll(){
  var id, anim, rec, i;
  for (id in saved){
    if (!Object.prototype.hasOwnProperty.call(saved, id)) continue;
    for (anim in saved[id]){
      if (!Object.prototype.hasOwnProperty.call(saved[id], anim)) continue;
      rec = saved[id][anim];
      if (!rec || !rec.frames) continue;
      for (i = 0; i < rec.frames.length; i++)
        if (rec.frames[i]) loadSrc(imgKey(id, anim, i), rec.frames[i]);
    }
  }
}

function clonePts(arr){
  var out = [], i, p;
  if (!arr) return out;
  for (i = 0; i < arr.length; i++){
    p = arr[i];
    out[i] = p && typeof p === 'object' ? { x: p.x | 0, y: p.y | 0 } : null;
  }
  return out;
}

function cloneOrigin(o){
  if (!o) return null;
  if (Array.isArray(o)) return clonePts(o);
  if (typeof o === 'object' && o.x != null) return { x: o.x | 0, y: o.y | 0 };
  return null;
}

function cloneBox(b){
  if (!b || b.w == null || b.h == null) return null;
  return { w: b.w | 0, h: b.h | 0 };
}

export function defaultAnimBox(id, anim){
  if (id !== 'hero') return { w: 10, h: 14 };
  if (anim === 'crouch' || anim === 'crouchWalk') return { w: C.W, h: C.CRH };
  if (anim === 'prone') return { w: C.PRW, h: C.PRH };
  if (anim === 'roll') return { w: C.W, h: C.RH };
  return { w: C.W, h: C.H };
}

export function getAnimBox(id, anim){
  var rec = recOf(id, anim), d = defaultAnimBox(id, anim), b;
  b = rec && rec.box;
  if (!b || b.w == null || b.h == null) return { w: d.w | 0, h: d.h | 0 };
  return { w: b.w | 0, h: b.h | 0 };
}

export function setAnimBox(id, anim, w, h){
  var rec = ensureRec(id, anim), meta, d, maxW, maxH, o;
  if (!rec) return null;
  meta = getSpriteMeta(id);
  o = originFromRec(rec);
  maxW = meta ? meta.fw : 16;
  maxH = meta ? meta.fh : 16;
  if (o){
    maxW = Math.max(BOX_MIN, maxW - (o.x | 0));
    maxH = Math.max(BOX_MIN, maxH - (o.y | 0));
  }
  w = clampS(w, BOX_MIN, maxW);
  h = clampS(h, BOX_MIN, maxH);
  d = defaultAnimBox(id, anim);
  if (w === d.w && h === d.h) rec.box = null;
  else rec.box = { w: w, h: h };
  emit('anchor');
  return getAnimBox(id, anim);
}

function cloneSaved(src){
  var out = {}, id, anim, rec, m;
  if (!src) return out;
  for (id in src){
    if (!Object.prototype.hasOwnProperty.call(src, id)) continue;
    out[id] = {};
    m = src[id] && src[id]._meta;
    if (m && typeof m === 'object') out[id]._meta = {
      fw: m.fw, fh: m.fh, ox: m.ox, oy: m.oy, fx: m.fx
    };
    for (anim in src[id]){
      if (!Object.prototype.hasOwnProperty.call(src[id], anim)) continue;
      if (anim === '_meta') continue;
      rec = src[id][anim];
      if (!rec) continue;
      out[id][anim] = {
        frames: (rec.frames || []).slice(),
        dirty: (rec.dirty || []).slice(),
        origin: cloneOrigin(rec.origin),
        grab: cloneOrigin(rec.grab),
        weapon: clonePts(rec.weapon),
        box: cloneBox(rec.box)
      };
    }
  }
  return out;
}

function readLocal(){
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && o.sprites) return o.sprites;
    return o;
  } catch (_){ return null; }
}

function writeLocal(){
  try { localStorage.setItem(KEY, JSON.stringify({ sprites: saved })); } catch (_){}
}

function boot(){
  var local = readLocal();
  if (local && typeof local === 'object' && Object.keys(local).length)
    saved = cloneSaved(local);
  else saved = cloneSaved((BAKED && BAKED.sprites) || {});
  loadAll();
}

boot();

function emit(why){
  writeLocal();
  if (onChange) onChange(why || 'change');
}

export function bindSpriteset(hooks){
  onChange = hooks && hooks.onChange;
}

export function getSpriteMeta(id){
  var b = byId[id], m;
  if (!b) return null;
  m = saved[id] && saved[id]._meta;
  return {
    fw: m && m.fw != null ? m.fw | 0 : b.fw,
    fh: m && m.fh != null ? m.fh | 0 : b.fh,
    ox: m && m.ox != null ? m.ox | 0 : b.ox,
    oy: m && m.oy != null ? m.oy | 0 : b.oy,
    fx: m && m.fx != null ? m.fx | 0 : (b.fx != null ? b.fx : 0)
  };
}

export function getSpriteDef(id){
  var b = byId[id], m;
  if (!b) return null;
  m = getSpriteMeta(id);
  if (!saved[id] || !saved[id]._meta) return b;
  return {
    id: b.id, name: b.name, kind: b.kind, anims: b.anims,
    fw: m.fw, fh: m.fh, ox: m.ox, oy: m.oy, fx: m.fx
  };
}

export function listSpriteDefs(){
  return SPRITE_DEFS.map(function(d){ return getSpriteDef(d.id); });
}

export function spriteDefForKind(kind){
  var i;
  for (i = 0; i < SPRITE_DEFS.length; i++)
    if (SPRITE_DEFS[i].kind === kind) return getSpriteDef(SPRITE_DEFS[i].id);
  return null;
}

function clampS(n, lo, hi){
  n = n | 0;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function clampPt(p, fw, fh){
  if (!p) return null;
  return { x: clampS(p.x, 0, fw - 1), y: clampS(p.y, 0, fh - 1) };
}

function ensureRec(id, anim){
  var def = byId[id], a = animOf(def, anim);
  if (!def || !a) return null;
  if (!saved[id]) saved[id] = {};
  if (!saved[id][anim]) saved[id][anim] = { frames: [], dirty: [] };
  return saved[id][anim];
}

function originFromRec(rec){
  var o, j, p;
  if (!rec || rec.origin == null) return null;
  o = rec.origin;
  if (!Array.isArray(o))
    return (o && o.x != null) ? { x: o.x | 0, y: o.y | 0 } : null;
  for (j = 0; j < o.length; j++){
    p = o[j];
    if (p) return { x: p.x | 0, y: p.y | 0 };
  }
  return null;
}

export function getFrameAnchor(id, anim, i, kind){
  var rec = recOf(id, anim), arr, p;
  if (kind === 'origin') return originFromRec(rec);
  if (kind === 'grab'){
    if (rec && rec.grab && rec.grab.x != null) return { x: rec.grab.x | 0, y: rec.grab.y | 0 };
    return null;
  }
  if (kind !== 'weapon') return null;
  arr = rec && rec.weapon;
  p = arr && arr[i | 0];
  return p ? { x: p.x | 0, y: p.y | 0 } : null;
}

export function setFrameAnchor(id, anim, i, kind, x, y){
  var rec, meta, pt;
  if (kind !== 'origin' && kind !== 'weapon' && kind !== 'grab') return null;
  rec = ensureRec(id, anim);
  if (!rec) return null;
  meta = getSpriteMeta(id);
  pt = clampPt({ x: x, y: y }, meta.fw, meta.fh);
  if (kind === 'origin'){
    rec.origin = pt;
    if (rec.box){
      rec.box.w = clampS(rec.box.w, BOX_MIN, Math.max(BOX_MIN, meta.fw - pt.x));
      rec.box.h = clampS(rec.box.h, BOX_MIN, Math.max(BOX_MIN, meta.fh - pt.y));
    }
    emit('anchor');
    return pt;
  }
  if (kind === 'grab'){
    rec.grab = pt;
    emit('anchor');
    return pt;
  }
  i = i | 0;
  if (!rec.weapon) rec.weapon = [];
  rec.weapon[i] = pt;
  emit('anchor');
  return pt;
}

export function clearFrameAnchor(id, anim, i, kind){
  var rec = recOf(id, anim);
  if (!rec) return;
  if (kind === 'origin') rec.origin = null;
  else if (kind === 'grab') rec.grab = null;
  else if (kind === 'weapon' && rec.weapon) rec.weapon[i | 0] = null;
  else return;
  emit('anchor');
}

export function clearAnimAnchors(id, anim){
  var rec = recOf(id, anim);
  if (!rec) return;
  rec.origin = null;
  rec.grab = null;
  rec.weapon = [];
  rec.box = null;
  emit('anchor');
}

export function setSpriteSize(id, fw, fh){
  var def = byId[id], meta, rec, anim, i, p;
  if (!def) return null;
  fw = clampS(fw, MIN_S, MAX_S);
  fh = clampS(fh, MIN_S, MAX_S);
  if (!saved[id]) saved[id] = {};
  if (!saved[id]._meta) saved[id]._meta = {};
  saved[id]._meta.fw = fw;
  saved[id]._meta.fh = fh;
  meta = getSpriteMeta(id);
  if (meta.ox > fw - 1) saved[id]._meta.ox = fw - 1;
  if (meta.oy > fh - 1) saved[id]._meta.oy = fh - 1;
  for (anim in saved[id]){
    if (!Object.prototype.hasOwnProperty.call(saved[id], anim) || anim === '_meta') continue;
    rec = saved[id][anim];
    if (!rec) continue;
    if (rec.origin){
      if (Array.isArray(rec.origin)){
        for (i = 0; i < rec.origin.length; i++)
          if (rec.origin[i]) rec.origin[i] = clampPt(rec.origin[i], fw, fh);
      } else rec.origin = clampPt(rec.origin, fw, fh);
    }
    if (rec.grab) rec.grab = clampPt(rec.grab, fw, fh);
    if (rec.weapon){
      for (i = 0; i < rec.weapon.length; i++)
        if (rec.weapon[i]) rec.weapon[i] = clampPt(rec.weapon[i], fw, fh);
    }
    if (rec.box){
      rec.box.w = clampS(rec.box.w, BOX_MIN, fw);
      rec.box.h = clampS(rec.box.h, BOX_MIN, fh);
    }
    void p;
  }
  emit('size');
  return getSpriteMeta(id);
}

function recOf(id, anim){
  return saved[id] && saved[id][anim] ? saved[id][anim] : null;
}

export function getSpriteFrameSrc(id, anim, i){
  var rec = recOf(id, anim);
  if (!rec || !rec.frames) return '';
  return rec.frames[i | 0] || '';
}

export function isSpriteFrameDirty(id, anim, i){
  var rec = recOf(id, anim);
  return !!(rec && rec.dirty && rec.dirty[i | 0] && rec.frames && rec.frames[i | 0]);
}

export function spriteFrameImage(id, anim, i){
  if (!isSpriteFrameDirty(id, anim, i)) return null;
  var img = imgs[imgKey(id, anim, i)];
  return (img && img.complete && img.naturalWidth) ? img : null;
}

export function setSpriteFrame(id, anim, i, src, dirty){
  var def = byId[id], a = animOf(def, anim);
  if (!def || !a) return null;
  i = i | 0;
  if (i < 0 || i >= a.n) return null;
  var rec = ensureRec(id, anim);
  if (!rec) return null;
  rec.frames[i] = src || '';
  rec.dirty[i] = dirty !== false && !!src;
  if (src) loadSrc(imgKey(id, anim, i), src);
  else delete imgs[imgKey(id, anim, i)];
  emit('frame');
  return rec;
}

export function setSpriteAnimFrames(id, anim, srcs){
  var def = byId[id], a = animOf(def, anim);
  if (!def || !a) return null;
  var i;
  for (i = 0; i < a.n; i++)
    setSpriteFrame(id, anim, i, (srcs && srcs[i]) || '', true);
  return recOf(id, anim);
}

export function clearSpriteFrame(id, anim, i){
  return setSpriteFrame(id, anim, i, '', false);
}

export function snapshotSprites(){
  return cloneSaved(saved);
}
