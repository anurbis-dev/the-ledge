/* Якоря объекта (origin / grab / weapon / box) — ключ objectKind, не spriteId.
   Единственный источник истины — BAKED.objectAnchors, пишется по кнопке Bake.
   Черновик живёт только в памяти вкладки; старый localStorage-ключ (KEY)
   читается один раз как миграционный мостик, если BAKED.objectAnchors ещё
   пуст (снапшот старее этого фикса). */
import { BAKED } from './defaults.js';
import { C } from './constants.js';
import { notifyDraftChange } from './persist.js';
import {
  getSpriteDef, getSpriteMeta, isHeroSprite, snapshotSprites
} from './spriteset.js';
import {
  resolveObject, listObjects, BUILTIN_OBJS, builtinSpriteId
} from './objectset.js';
import { defaultFrameAnchors } from '../render/sprite-anchors.js';

var KEY = 'ledge.dev.objectAnchors';
var BOX_MIN = 2;

/* saved[objectKind][anim] = { origin, grab, weapon[], box } */
var saved = {};
var onChange = null;

function clonePts(arr){
  if (!arr || !arr.length) return [];
  var out = [], i, p;
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

function cloneAnimRec(rec){
  if (!rec || typeof rec !== 'object') return null;
  var out = {};
  if ('origin' in rec) out.origin = cloneOrigin(rec.origin);
  if ('grab' in rec) out.grab = cloneOrigin(rec.grab);
  if ('weapon' in rec) out.weapon = clonePts(rec.weapon);
  if ('box' in rec) out.box = cloneBox(rec.box);
  return out;
}

function cloneSaved(src){
  var out = {}, kind, anim, rec;
  if (!src) return out;
  for (kind in src){
    if (!Object.prototype.hasOwnProperty.call(src, kind)) continue;
    out[kind] = {};
    for (anim in src[kind]){
      if (!Object.prototype.hasOwnProperty.call(src[kind], anim)) continue;
      rec = cloneAnimRec(src[kind][anim]);
      if (rec) out[kind][anim] = rec;
    }
  }
  return out;
}

function overlay(dst, src){
  var kind, anim, rec, drec;
  if (!src) return;
  for (kind in src){
    if (!Object.prototype.hasOwnProperty.call(src, kind)) continue;
    if (!dst[kind]) dst[kind] = {};
    for (anim in src[kind]){
      if (!Object.prototype.hasOwnProperty.call(src[kind], anim)) continue;
      rec = src[kind][anim];
      if (!rec || typeof rec !== 'object') continue;
      if (!dst[kind][anim]) dst[kind][anim] = {};
      drec = dst[kind][anim];
      if ('origin' in rec) drec.origin = cloneOrigin(rec.origin);
      if ('grab' in rec) drec.grab = cloneOrigin(rec.grab);
      if ('weapon' in rec) drec.weapon = clonePts(rec.weapon);
      if ('box' in rec) drec.box = cloneBox(rec.box);
    }
  }
}

/** Миграционный мостик: старый черновик до появления BAKED.objectAnchors. */
function readLegacyLocal(){
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && o.anchors) return o.anchors;
    if (o && typeof o === 'object') return o;
    return null;
  } catch (_){ return null; }
}

function emit(why){
  notifyDraftChange();
  if (onChange) onChange(why || 'change');
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

function recOf(kind, anim){
  return saved[kind] && saved[kind][anim] ? saved[kind][anim] : null;
}

function ensureRec(kind, anim){
  if (!kind || !anim) return null;
  if (!saved[kind]) saved[kind] = {};
  if (!saved[kind][anim]) saved[kind][anim] = {};
  return saved[kind][anim];
}

/** Sprite used for canvas size / pose defaults for this object. */
export function spriteIdForObject(objectKind){
  var meta = resolveObject(objectKind);
  if (meta && meta.spriteId) return meta.spriteId;
  if (meta && (meta.template === 'player_start' || meta.kind === 'player_start'))
    return 'hero';
  if (meta && meta.template){
    var sid = builtinSpriteId(meta.template);
    if (sid) return sid;
  }
  if (objectKind === 'light') return 'lantern';
  if (getSpriteDef(objectKind)) return objectKind;
  return null;
}

export function isHeroObject(objectKind){
  if (!objectKind) return false;
  if (objectKind === 'hero') return true;
  var meta = resolveObject(objectKind);
  if (meta && (meta.template === 'hero' || meta.kind === 'hero')) return true;
  var sid = spriteIdForObject(objectKind);
  return !!(sid && isHeroSprite(sid));
}

function metaSize(objectKind){
  var sid = spriteIdForObject(objectKind);
  var m = sid ? getSpriteMeta(sid) : null;
  if (m) return m;
  return { fw: 16, fh: 16, ox: 0, oy: 0 };
}

/** Старые уровни без objectKind: spriteId → object kind. */
export function legacyObjectKindFromSprite(spriteId){
  var i, o, def, b;
  if (!spriteId) return null;
  if (spriteId === 'lantern') return 'light';
  for (i = 0; i < (listObjects() || []).length; i++){
    o = listObjects()[i];
    if (o && o.spriteId === spriteId) return o.id;
  }
  for (i = 0; i < BUILTIN_OBJS.length; i++){
    b = BUILTIN_OBJS[i];
    if (builtinSpriteId(b.kind) === spriteId || b.kind === spriteId) return b.kind;
  }
  def = getSpriteDef(spriteId);
  if (def && def.kind && def.kind !== spriteId){
    for (i = 0; i < BUILTIN_OBJS.length; i++)
      if (BUILTIN_OBJS[i].kind === def.kind) return def.kind;
  }
  if (isHeroSprite(spriteId)) return 'hero';
  return spriteId;
}

export function resolveEntityObjectKind(ent, fallbackSpriteId){
  if (!ent) return legacyObjectKindFromSprite(fallbackSpriteId);
  if (ent.objectKind) return ent.objectKind;
  return legacyObjectKindFromSprite(ent.spriteId || fallbackSpriteId);
}

function animRecHasData(rec){
  if (!rec) return false;
  if (rec.origin) return true;
  if (rec.grab) return true;
  if (rec.box && rec.box.w != null) return true;
  if (rec.weapon && rec.weapon.some(Boolean)) return true;
  return false;
}

function packKind(srcKind){
  var out = {}, anim, rec, a;
  if (!srcKind) return out;
  for (anim in srcKind){
    if (!Object.prototype.hasOwnProperty.call(srcKind, anim) || anim === '_meta') continue;
    rec = srcKind[anim];
    if (!rec) continue;
    a = {};
    if (rec.origin) a.origin = cloneOrigin(rec.origin);
    if (rec.grab) a.grab = cloneOrigin(rec.grab);
    if (rec.weapon && rec.weapon.length) a.weapon = clonePts(rec.weapon);
    if (rec.box) a.box = cloneBox(rec.box);
    if (animRecHasData(a)) out[anim] = a;
  }
  return out;
}

function assignKind(objectKind, packed){
  var anim;
  if (!objectKind || !packed) return;
  if (!saved[objectKind]) saved[objectKind] = {};
  for (anim in packed){
    if (!Object.prototype.hasOwnProperty.call(packed, anim)) continue;
    saved[objectKind][anim] = cloneAnimRec(packed[anim]) || {};
  }
}

function spriteTargets(spriteId){
  var targets = [], i, b, o, def, list;
  if (!spriteId) return targets;
  if (spriteId === 'lantern') targets.push('light');
  else if (spriteId === 'hero') targets.push('hero');
  for (i = 0; i < BUILTIN_OBJS.length; i++){
    b = BUILTIN_OBJS[i];
    if (builtinSpriteId(b.kind) === spriteId || b.kind === spriteId){
      if (targets.indexOf(b.kind) < 0) targets.push(b.kind);
    }
  }
  list = listObjects();
  for (i = 0; i < list.length; i++){
    o = list[i];
    if (o && o.spriteId === spriteId && targets.indexOf(o.id) < 0) targets.push(o.id);
  }
  def = getSpriteDef(spriteId);
  if (def && def.kind && targets.indexOf(def.kind) < 0){
    for (i = 0; i < BUILTIN_OBJS.length; i++)
      if (BUILTIN_OBJS[i].kind === def.kind){ targets.push(def.kind); break; }
  }
  if (!targets.length) targets.push(spriteId);
  return targets;
}

/** Перенос origin/grab/weapon/box из спрайтов → objectKind. */
export function migrateAnchorsFromSprites(spritesMap){
  var id, packed, targets, t, i, moved = 0;
  if (!spritesMap) return 0;
  for (id in spritesMap){
    if (!Object.prototype.hasOwnProperty.call(spritesMap, id)) continue;
    packed = packKind(spritesMap[id]);
    if (!Object.keys(packed).length) continue;
    targets = spriteTargets(id);
    for (i = 0; i < targets.length; i++){
      t = targets[i];
      /* Не затирать уже заданные object anchors. */
      if (saved[t] && Object.keys(saved[t]).length) continue;
      assignKind(t, packed);
      moved++;
    }
  }
  return moved;
}

function boot(){
  saved = {};
  var baked = (BAKED && BAKED.objectAnchors) || null;
  if (baked && Object.keys(baked).length) overlay(saved, baked);
  else overlay(saved, readLegacyLocal());
  /* Миграция: если якорей объектов мало — забрать из спрайтов (BAKED + live). */
  var need = !saved || !Object.keys(saved).length;
  if (!need){
    /* Частичная: hero/enemy якоря ещё только на спрайтах. */
    need = !(saved.hero && Object.keys(saved.hero).length);
  }
  if (need){
    migrateAnchorsFromSprites((BAKED && BAKED.sprites) || {});
    migrateAnchorsFromSprites(snapshotSprites());
  }
}

boot();

export function bindObjectAnchors(hooks){
  onChange = hooks && hooks.onChange;
}

export function defaultAnimBox(objectKind, anim){
  var tpl, meta;
  if (isHeroObject(objectKind)){
    if (anim === 'crouch' || anim === 'crouchWalk' || anim === 'pickCrouch') return { w: C.W, h: C.CRH };
    if (anim === 'prone' || anim === 'pickProne') return { w: C.PRW, h: C.PRH };
    if (anim === 'roll') return { w: C.W, h: C.RH };
    return { w: C.W, h: C.H };
  }
  meta = resolveObject(objectKind);
  tpl = (meta && (meta.template || meta.kind)) || objectKind;
  if (tpl === 'enemy2') return { w: 14, h: 18 };
  if (tpl === 'enemy0' || tpl === 'enemy1') return { w: 11, h: 14 };
  return { w: 10, h: 14 };
}

export function getAnimBox(objectKind, anim){
  var rec = recOf(objectKind, anim), d = defaultAnimBox(objectKind, anim), b;
  b = rec && rec.box;
  if (!b || b.w == null || b.h == null) return { w: d.w | 0, h: d.h | 0 };
  return { w: b.w | 0, h: b.h | 0 };
}

export function setAnimBox(objectKind, anim, w, h){
  var rec, meta, d, maxW, maxH, o;
  rec = ensureRec(objectKind, anim);
  if (!rec) return null;
  meta = metaSize(objectKind);
  o = originFromRec(rec);
  maxW = meta ? meta.fw : 16;
  maxH = meta ? meta.fh : 16;
  if (o){
    maxW = Math.max(BOX_MIN, maxW - (o.x | 0));
    maxH = Math.max(BOX_MIN, maxH - (o.y | 0));
  }
  w = clampS(w, BOX_MIN, maxW);
  h = clampS(h, BOX_MIN, maxH);
  d = defaultAnimBox(objectKind, anim);
  if (w === d.w && h === d.h) rec.box = null;
  else rec.box = { w: w, h: h };
  emit('anchor');
  return getAnimBox(objectKind, anim);
}

export function getFrameAnchor(objectKind, anim, i, kind){
  var rec = recOf(objectKind, anim), arr, p;
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

export function setFrameAnchor(objectKind, anim, i, kind, x, y){
  var rec, meta, pt;
  if (kind !== 'origin' && kind !== 'weapon' && kind !== 'grab') return null;
  rec = ensureRec(objectKind, anim);
  if (!rec) return null;
  meta = metaSize(objectKind);
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

export function clearFrameAnchor(objectKind, anim, i, kind){
  var rec = recOf(objectKind, anim);
  if (!rec) return;
  if (kind === 'origin') rec.origin = null;
  else if (kind === 'grab') rec.grab = null;
  else if (kind === 'weapon' && rec.weapon) rec.weapon[i | 0] = null;
  else return;
  emit('anchor');
}

export function clearAnimAnchors(objectKind, anim){
  var rec = recOf(objectKind, anim);
  if (!rec) return;
  rec.origin = null;
  rec.grab = null;
  rec.weapon = [];
  rec.box = null;
  emit('anchor');
}

export function cloneObjectAnchors(fromKind, toKind){
  var src;
  if (!fromKind || !toKind || fromKind === toKind) return false;
  src = saved[fromKind];
  if (!src) return false;
  saved[toKind] = {};
  overlay(saved[toKind] ? saved : saved, null);
  saved[toKind] = cloneSaved({ x: src }).x || cloneSaved({ t: src }).t;
  /* cloneSaved expects map of kinds — simpler: */
  saved[toKind] = {};
  overlay({ tmp: saved[toKind] }, null);
  var anim, rec;
  for (anim in src){
    if (!Object.prototype.hasOwnProperty.call(src, anim)) continue;
    rec = cloneAnimRec(src[anim]);
    if (rec) saved[toKind][anim] = rec;
  }
  emit('clone');
  return true;
}

export function snapshotObjectAnchors(){
  var out = {}, kind, anim, rec, a;
  for (kind in saved){
    if (!Object.prototype.hasOwnProperty.call(saved, kind)) continue;
    a = {};
    for (anim in saved[kind]){
      if (!Object.prototype.hasOwnProperty.call(saved[kind], anim)) continue;
      rec = cloneAnimRec(saved[kind][anim]);
      if (rec && animRecHasData(rec)) a[anim] = rec;
    }
    if (Object.keys(a).length) out[kind] = a;
  }
  return out;
}

export function applyObjectAnchorsSnap(snap){
  saved = cloneSaved(snap || {});
  emit('replace');
}

/** Defaults for editor when no override — uses linked sprite poses. */
export function defaultObjectAnchors(objectKind, anim, frameI){
  var sid = spriteIdForObject(objectKind) || objectKind;
  return defaultFrameAnchors(sid, anim, frameI);
}

void defaultFrameAnchors;
