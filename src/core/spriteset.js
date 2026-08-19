/* Каталог спрайтов персонажей: строки анимаций, кадры — PNG.
   Черновик — ledge.dev.sprites; в игру уезжает через Bake → BAKED.sprites.
   Пустой кадр = рисуем по-старому (скелет / rc). */
import { BAKED } from './defaults.js';

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
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] }
];

var byId = {};
var i0;
for (i0 = 0; i0 < SPRITE_DEFS.length; i0++) byId[SPRITE_DEFS[i0].id] = SPRITE_DEFS[i0];

/* saved[spriteId][animId] = { frames: [src|null], dirty: [bool] } */
var saved = {};
var imgs = {};
var onChange = null;

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

function cloneSaved(src){
  var out = {}, id, anim, rec;
  if (!src) return out;
  for (id in src){
    if (!Object.prototype.hasOwnProperty.call(src, id)) continue;
    out[id] = {};
    for (anim in src[id]){
      if (!Object.prototype.hasOwnProperty.call(src[id], anim)) continue;
      rec = src[id][anim];
      if (!rec) continue;
      out[id][anim] = {
        frames: (rec.frames || []).slice(),
        dirty: (rec.dirty || []).slice()
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

export function listSpriteDefs(){ return SPRITE_DEFS; }

export function getSpriteDef(id){ return byId[id] || null; }

export function spriteDefForKind(kind){
  var i;
  for (i = 0; i < SPRITE_DEFS.length; i++)
    if (SPRITE_DEFS[i].kind === kind) return SPRITE_DEFS[i];
  return null;
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
  if (!saved[id]) saved[id] = {};
  if (!saved[id][anim]) saved[id][anim] = { frames: [], dirty: [] };
  var rec = saved[id][anim];
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
