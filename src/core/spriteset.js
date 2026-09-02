/* Каталог спрайтов: анимации = frames + _meta (fw/fh/ox/oy/fx).
   Якоря объектов (origin/grab/weapon/box) — object-anchors.js / BAKED.objectAnchors.
   Единственный источник истины — BAKED.sprites/BAKED.spriteDefs (src/core/defaults.js).
   Черновик живёт только в памяти этой вкладки; на диск попадает исключительно
   по кнопке Bake (см. core/bake-client.js) — никакого localStorage-оверлея
   для кадров/кастом-дефов. Пустой кадр = скелет / rc. */
import { BAKED } from './defaults.js';
import { notifyDraftChange } from './persist.js';

/* Оверрайды display-имён builtin-спрайтов — чисто UI-ярлык редактора, не
   часть BAKED (как TILE_NAMEKEY в editor.js для тайлов). Единственный
   источник для этого поля, поэтому читается безусловно, без гонки с BAKED. */
var NAMEKEY = 'ledge.ed.spriteNames';
/* Оверрайды tag builtin-дефов — тот же принцип, отдельный ключ. */
var TAGKEY = 'ledge.ed.spriteTags';

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
      { id: 'pickCrouch', name: 'Pick crouch', n: 1 },
      { id: 'pickProne', name: 'Pick prone', n: 1 },
      { id: 'throw', name: 'Throw', n: 1 },
      { id: 'attack', name: 'Attack', n: 3 },
      { id: 'dig', name: 'Dig', n: 3 },
      { id: 'digDown', name: 'Dig down', n: 3 },
      { id: 'roll', name: 'Roll', n: 1 },
      { id: 'stun', name: 'Stun', n: 1 },
      { id: 'snare', name: 'Snare', n: 1 },
      { id: 'ladder', name: 'Ladder', n: 2 },
      { id: 'ladderF', name: 'Ladder front', n: 2 },
      { id: 'ladderD', name: 'Ladder diag', n: 2 },
      { id: 'ropeClimb', name: 'Rope climb', n: 2 },
      { id: 'ropeSwing', name: 'Rope swing', n: 2 },
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
  { id: 'shirley', name: 'Shirley', fw: 40, fh: 48, ox: 16, oy: 22, fx: 5, kind: 'hero', family: 'hero',
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
      { id: 'pickCrouch', name: 'Pick crouch', n: 1 },
      { id: 'pickProne', name: 'Pick prone', n: 1 },
      { id: 'throw', name: 'Throw', n: 1 },
      { id: 'attack', name: 'Attack', n: 3 },
      { id: 'dig', name: 'Dig', n: 3 },
      { id: 'digDown', name: 'Dig down', n: 3 },
      { id: 'roll', name: 'Roll', n: 1 },
      { id: 'stun', name: 'Stun', n: 1 },
      { id: 'snare', name: 'Snare', n: 1 },
      { id: 'ladder', name: 'Ladder', n: 2 },
      { id: 'ladderF', name: 'Ladder front', n: 2 },
      { id: 'ladderD', name: 'Ladder diag', n: 2 },
      { id: 'ropeClimb', name: 'Rope climb', n: 2 },
      { id: 'ropeSwing', name: 'Rope swing', n: 2 },
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
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 1.9 }] },
  { id: 'enemy1', name: 'Foe 2', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'enemy1',
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 2.9 }] },
  { id: 'enemy2', name: 'Foe 3', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'enemy2',
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 1.9 }] },
  { id: 'flier0', name: 'Bird', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier0',
    anims: [{ id: 'flap', name: 'Flap', n: 2, speed: 3.8 }, { id: 'glide', name: 'Glide', n: 1 }] },
  { id: 'flier1', name: 'Bird 2', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier1',
    anims: [{ id: 'flap', name: 'Flap', n: 2, speed: 6.4 }, { id: 'glide', name: 'Glide', n: 1 }] },
  { id: 'flier2', name: 'Bird 3', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier2',
    anims: [{ id: 'flap', name: 'Flap', n: 2, speed: 3.8 }, { id: 'glide', name: 'Glide', n: 1 }] },
  { id: 'flier3', name: 'Diver', fw: 16, fh: 16, ox: 2, oy: 2, kind: 'flier3',
    anims: [{ id: 'flap', name: 'Flap', n: 2, speed: 3.8 }, { id: 'glide', name: 'Glide', n: 1 }] },
  { id: 'spider0', name: 'Spider', fw: 16, fh: 16, ox: 5, oy: 6, kind: 'spider0',
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 2.5 }] },
  { id: 'spider1', name: 'Spider 2', fw: 16, fh: 16, ox: 5, oy: 6, kind: 'spider1',
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 2.5 }] },
  { id: 'spider2', name: 'Spider 3', fw: 16, fh: 16, ox: 5, oy: 6, kind: 'spider2',
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 2.5 }] },
  { id: 'npc_hermit', name: 'Hermit', fw: 16, fh: 16, ox: 3, oy: 0, kind: 'npc_hermit',
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 0.7 }] },
  { id: 'npc_wanderer', name: 'Wanderer', fw: 16, fh: 16, ox: 3, oy: 0, kind: 'npc_wanderer',
    anims: [{ id: 'idle', name: 'Idle', n: 2, speed: 0.7 }] },
  { id: 'lantern', name: 'Lantern', fw: 16, fh: 16, ox: 8, oy: 8, kind: 'light',
    anims: [{ id: 'idle', name: 'Idle', n: 2 }] },
  /* Object icons — bake idle at editor boot; ox/oy 0 (items blit at x-8,y-8). */
  { id: 'player_start', name: 'Start', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'player_start',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'level_exit', name: 'Exit', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'level_exit',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'door', name: 'Door', fw: 16, fh: 16, ox: 0, oy: 16, kind: 'door',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'tendril0', name: 'Sting', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'tendril0',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'tendril1', name: 'Grabber', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'tendril1',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'torch', name: 'Torch', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'torch',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'chest', name: 'Chest', fw: 16, fh: 16, ox: 0, oy: 16, kind: 'chest',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }, { id: 'open', name: 'Open', n: 1 }] },
  { id: 'chestL', name: 'Locked', fw: 16, fh: 16, ox: 0, oy: 16, kind: 'chestL',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'coin', name: 'Coin', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'coin',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'gem', name: 'Gem', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'gem',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'shroom', name: 'Shroom', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'shroom',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'relic', name: 'Relic', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'relic',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'tank', name: 'Air tank', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'tank',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'key', name: 'Key', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'key',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'helmet', name: 'Helmet', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'helmet',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'shield', name: 'Shield', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'shield',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'sword', name: 'Sword', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'sword',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'scuba', name: 'Scuba', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'scuba',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'flippers', name: 'Flippers', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'flippers',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'harpoon', name: 'Harpoon', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'harpoon',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'bow', name: 'Bow', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'bow',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'sound', name: 'Sound', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'sound',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'volume', name: 'Volume', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'volume',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'fx_sand', name: 'FX Sand', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'fx_sand',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'boulder', name: 'Boulder', fw: 13, fh: 13, ox: 0, oy: 0, kind: 'boulder',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'rope_v', name: 'Rope V', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'rope_v',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'rope_h', name: 'Rope H', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'rope_h',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'plat_h', name: 'Plat H', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'plat_h',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'plat_v', name: 'Plat V', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'plat_v',
    anims: [{ id: 'idle', name: 'Idle', n: 1 }] },
  { id: 'lift', name: 'Lift', fw: 16, fh: 16, ox: 0, oy: 0, kind: 'lift',
    anims: [{ id: 'closed', name: 'Closed', n: 1 }, { id: 'open', name: 'Open', n: 1 }] }
];

var byId = {};
var customDefs = [];
var i0;
for (i0 = 0; i0 < SPRITE_DEFS.length; i0++) byId[SPRITE_DEFS[i0].id] = SPRITE_DEFS[i0];

/* saved[spriteId][animId] = { frames, dirty, n?, speed? }
   saved[spriteId]._meta = { fw, fh, ox, oy, fx } — оверрайд каталога. */
var saved = {};
var imgs = {};
var onChange = null;
var MIN_S = 8, MAX_S = 128;
var defSeq = 1;
export var DEFAULT_ANIM_FPS = 8;
/** Display-name overrides for builtin (non-custom) sprite defs — dev draft, same store as customDefs. */
var builtinNames = {};
/** Tag overrides for builtin (non-custom) sprite defs — same pattern as builtinNames. */
var builtinTags = {};

function rebuildById(){
  var i, d;
  byId = {};
  for (i = 0; i < SPRITE_DEFS.length; i++) byId[SPRITE_DEFS[i].id] = SPRITE_DEFS[i];
  for (i = 0; i < customDefs.length; i++){
    d = customDefs[i];
    if (d && d.id) byId[d.id] = d;
  }
}

function isHeroFamily(id){
  var d = byId[id];
  if (!d) return id === 'hero';
  if (d.id === 'hero' || d.kind === 'hero' || d.family === 'hero') return true;
  return false;
}

function cloneAnimList(anims){
  var out = [], i, a;
  if (!anims) return out;
  for (i = 0; i < anims.length; i++){
    a = anims[i];
    out.push({ id: a.id, name: a.name, n: a.n | 0, speed: a.speed > 0 ? +a.speed : undefined });
  }
  return out;
}

function nextSpriteId(prefix){
  var id, n = defSeq;
  prefix = prefix || 's';
  do {
    id = prefix + '_' + n;
    n++;
  } while (byId[id]);
  defSeq = n;
  return id;
}

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

function overlaySprites(dst, src){
  var id, anim, rec, drec, m;
  if (!src) return;
  for (id in src){
    if (!Object.prototype.hasOwnProperty.call(src, id)) continue;
    if (!dst[id]) dst[id] = {};
    m = src[id] && src[id]._meta;
    if (m && typeof m === 'object') dst[id]._meta = {
      fw: m.fw, fh: m.fh, ox: m.ox, oy: m.oy, fx: m.fx
    };
    for (anim in src[id]){
      if (!Object.prototype.hasOwnProperty.call(src[id], anim) || anim === '_meta') continue;
      rec = src[id][anim];
      if (!rec || typeof rec !== 'object') continue;
      if (!dst[id][anim]) dst[id][anim] = { frames: [], dirty: [] };
      drec = dst[id][anim];
      if (rec.frames && rec.frames.length){
        drec.frames = rec.frames.slice();
        drec.dirty = (rec.dirty || []).slice();
      }
      if (rec.n != null) drec.n = rec.n | 0;
      if (rec.speed != null) drec.speed = +rec.speed;
    }
  }
}

/** Убрать gameplay-якоря из live saved (после миграции в object-anchors). */
export function stripAnchorsFromSaved(){
  var id, anim, rec;
  for (id in saved){
    if (!Object.prototype.hasOwnProperty.call(saved, id)) continue;
    for (anim in saved[id]){
      if (!Object.prototype.hasOwnProperty.call(saved[id], anim) || anim === '_meta') continue;
      rec = saved[id][anim];
      if (!rec || typeof rec !== 'object') continue;
      delete rec.origin;
      delete rec.grab;
      delete rec.weapon;
      delete rec.box;
    }
  }
}

function cloneSaved(src){
  var out = {};
  overlaySprites(out, src);
  return out;
}

function readBuiltinNames(){
  try {
    var raw = localStorage.getItem(NAMEKEY);
    if (raw){
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') return o;
    }
  } catch (_){}
  /* Миграционный мостик: до NAMEKEY имена жили в старом комбинированном
     ключе 'ledge.dev.sprites' вместе с кадрами/дефами. */
  try {
    var raw2 = localStorage.getItem('ledge.dev.sprites');
    if (!raw2) return null;
    var o2 = JSON.parse(raw2);
    if (o2 && o2.names && typeof o2.names === 'object') return o2.names;
  } catch (_){}
  return null;
}

function writeBuiltinNames(){
  try { localStorage.setItem(NAMEKEY, JSON.stringify(builtinNames)); } catch (_){}
}

function readBuiltinTags(){
  try {
    var raw = localStorage.getItem(TAGKEY);
    if (raw){
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') return o;
    }
  } catch (_){}
  return null;
}

function writeBuiltinTags(){
  try { localStorage.setItem(TAGKEY, JSON.stringify(builtinTags)); } catch (_){}
}

function normalizeCustomDef(d){
  if (!d || !d.id) return null;
  return {
    id: String(d.id),
    name: String(d.name || d.id),
    tag: String(d.tag || ''),
    fw: d.fw | 0 || 16,
    fh: d.fh | 0 || 16,
    ox: d.ox | 0,
    oy: d.oy | 0,
    fx: d.fx != null ? (d.fx | 0) : 0,
    kind: d.kind || d.id,
    family: d.family || null,
    anims: cloneAnimList(d.anims && d.anims.length ? d.anims : [{ id: 'idle', name: 'Idle', n: 1 }]),
    custom: true
  };
}

function applyCustomDefs(list){
  if (!list || !list.length) return;
  customDefs = list.map(normalizeCustomDef).filter(Boolean);
  var i, m;
  for (i = 0; i < customDefs.length; i++){
    m = /_(\d+)$/.exec(customDefs[i].id);
    if (m) defSeq = Math.max(defSeq, (+m[1]) + 1);
  }
}

function applyBuiltinNames(names){
  var i, id;
  for (i = 0; i < SPRITE_DEFS.length; i++){
    id = SPRITE_DEFS[i].id;
    if (names[id] != null) SPRITE_DEFS[i].name = names[id];
  }
}

function applyBuiltinTags(tags){
  var i, id;
  for (i = 0; i < SPRITE_DEFS.length; i++){
    id = SPRITE_DEFS[i].id;
    if (tags[id] != null) SPRITE_DEFS[i].tag = tags[id];
  }
}

function boot(){
  saved = {};
  customDefs = [];
  builtinNames = {};
  overlaySprites(saved, (BAKED && BAKED.sprites) || {});
  if (BAKED && BAKED.spriteDefs && BAKED.spriteDefs.length)
    applyCustomDefs(BAKED.spriteDefs);
  var names = readBuiltinNames();
  if (names){
    builtinNames = names;
    applyBuiltinNames(builtinNames);
  }
  builtinTags = {};
  var tags = readBuiltinTags();
  if (tags){
    builtinTags = tags;
    applyBuiltinTags(builtinTags);
  }
  rebuildById();
  loadAll();
}

boot();

function emit(why){
  notifyDraftChange();
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

function liveAnims(b, id){
  var i, a, out = [];
  if (!b || !b.anims) return out;
  for (i = 0; i < b.anims.length; i++){
    a = b.anims[i];
    out.push({ id: a.id, name: a.name, n: getAnimFrameCount(id, a.id), speed: getAnimSpeed(id, a.id) });
  }
  return out;
}

export function getAnimFrameCount(id, anim){
  var def = byId[id], a = animOf(def, anim), rec;
  if (!def || !a) return 0;
  rec = recOf(id, anim);
  if (rec && rec.n != null && (rec.n | 0) >= 1) return rec.n | 0;
  return a.n | 0;
}

/** Кадров/сек для проигрывания анимации — редактор Play и геймплей читают одно и то же. */
export function getAnimSpeed(id, anim){
  var def = byId[id], a = animOf(def, anim), rec;
  if (!def || !a) return DEFAULT_ANIM_FPS;
  rec = recOf(id, anim);
  if (rec && rec.speed > 0) return rec.speed;
  return a.speed > 0 ? a.speed : DEFAULT_ANIM_FPS;
}

export function setAnimSpeed(id, anim, speed){
  var def = byId[id], a = animOf(def, anim), rec, d;
  if (!def || !a) return null;
  speed = +speed;
  d = a.speed > 0 ? a.speed : DEFAULT_ANIM_FPS;
  if (!(speed > 0)) speed = d;
  if (speed > 60) speed = 60;
  rec = ensureRec(id, anim);
  if (!rec) return null;
  rec.speed = (speed === d) ? null : speed;
  emit('anim');
  return getAnimSpeed(id, anim);
}

/** Индекс кадра в момент t (сек, любой накопитель времени) — общий для editor Play и рендера. */
export function getAnimFrame(id, anim, t){
  var n = getAnimFrameCount(id, anim);
  if (n <= 1) return 0;
  var speed = getAnimSpeed(id, anim);
  var f = Math.floor((t || 0) * speed) % n;
  return f < 0 ? f + n : f;
}

export function setAnimFrameCount(id, anim, n){
  var def = byId[id], a = animOf(def, anim), rec, i, cur;
  if (!def || !a) return null;
  n = n | 0;
  if (n < 1) n = 1;
  if (n > 64) n = 64;
  rec = ensureRec(id, anim);
  if (!rec) return null;
  cur = getAnimFrameCount(id, anim);
  rec.n = n;
  if (!rec.frames) rec.frames = [];
  if (!rec.dirty) rec.dirty = [];
  if (n > cur){
    for (i = cur; i < n; i++){
      if (rec.frames[i] == null) rec.frames[i] = '';
      if (rec.dirty[i] == null) rec.dirty[i] = false;
    }
  } else if (n < cur){
    rec.frames.length = n;
    rec.dirty.length = n;
    for (i = n; i < cur; i++) delete imgs[imgKey(id, anim, i)];
  }
  emit('frame');
  return n;
}

export function reorderAnimFrames(id, anim, fromI, toI){
  var n = getAnimFrameCount(id, anim), rec, f, d;
  fromI = fromI | 0; toI = toI | 0;
  if (fromI === toI || fromI < 0 || toI < 0 || fromI >= n || toI >= n) return null;
  rec = ensureRec(id, anim);
  if (!rec) return null;
  if (!rec.frames) rec.frames = [];
  if (!rec.dirty) rec.dirty = [];
  f = rec.frames.splice(fromI, 1)[0] || '';
  d = rec.dirty.splice(fromI, 1)[0];
  rec.frames.splice(toI, 0, f);
  rec.dirty.splice(toI, 0, !!d);
  loadAll();
  emit('frame');
  return { from: fromI, to: toI };
}

/** Удалить один кадр анимации по индексу (не даёт стереть последний). */
export function removeAnimFrame(id, anim, i){
  var n = getAnimFrameCount(id, anim), rec, k;
  i = i | 0;
  if (n <= 1 || i < 0 || i >= n) return null;
  rec = ensureRec(id, anim);
  if (!rec) return null;
  if (!rec.frames) rec.frames = [];
  if (!rec.dirty) rec.dirty = [];
  rec.frames.splice(i, 1);
  rec.dirty.splice(i, 1);
  rec.n = n - 1;
  for (k = rec.n; k < n; k++) delete imgs[imgKey(id, anim, k)];
  loadAll();
  emit('frame');
  return rec.n;
}

/** Добавить новую строку анимации кастомному спрайту (id уникален внутри def.anims). */
export function addAnimDef(id, animId, name, n){
  var def = byId[id];
  if (!def || !def.custom) return null;
  animId = String(animId || '').trim();
  if (!animId || animOf(def, animId)) return null;
  n = n | 0; if (n < 1) n = 1; if (n > 64) n = 64;
  def.anims.push({ id: animId, name: name || animId, n: n });
  notifyDraftChange();
  if (onChange) onChange('anim');
  return getSpriteDef(id);
}

export function getSpriteDef(id){
  var b = byId[id], m;
  if (!b) return null;
  m = getSpriteMeta(id);
  return {
    id: b.id, name: b.name, tag: b.tag || '', kind: b.kind, family: b.family || null,
    custom: !!b.custom, anims: liveAnims(b, id),
    fw: m.fw, fh: m.fh, ox: m.ox, oy: m.oy, fx: m.fx
  };
}

export function listSpriteDefs(){
  var out = SPRITE_DEFS.map(function(d){ return getSpriteDef(d.id); });
  var i, g;
  for (i = 0; i < customDefs.length; i++){
    g = getSpriteDef(customDefs[i].id);
    if (g) out.push(g);
  }
  return out;
}

export function spriteDefForKind(kind){
  var i, d;
  for (i = 0; i < SPRITE_DEFS.length; i++)
    if (SPRITE_DEFS[i].kind === kind) return getSpriteDef(SPRITE_DEFS[i].id);
  for (i = 0; i < customDefs.length; i++){
    d = customDefs[i];
    if (d.kind === kind || d.id === kind) return getSpriteDef(d.id);
  }
  return null;
}

/** Deep-clone catalog entry + saved frames into a new custom sprite. */
export function cloneSpriteDef(srcId, name){
  var src = byId[srcId], id, def, prefix;
  if (!src) return null;
  prefix = isHeroFamily(srcId) ? 'hero' : 's';
  id = nextSpriteId(prefix);
  def = normalizeCustomDef({
    id: id,
    name: name || ((src.name || srcId) + ' copy'),
    tag: src.tag || '',
    fw: src.fw, fh: src.fh, ox: src.ox, oy: src.oy, fx: src.fx,
    kind: isHeroFamily(srcId) ? 'hero' : (src.kind || id),
    family: isHeroFamily(srcId) ? 'hero' : (src.family || null),
    anims: src.anims
  });
  if (!def) return null;
  customDefs.push(def);
  rebuildById();
  if (saved[srcId]) saved[id] = cloneSavedOne(saved[srcId]);
  loadAll();
  emit('add');
  return getSpriteDef(id);
}

function cloneSavedOne(srcRec){
  var out = {}, anim, rec, m;
  if (!srcRec) return out;
  m = srcRec._meta;
  if (m && typeof m === 'object') out._meta = {
    fw: m.fw, fh: m.fh, ox: m.ox, oy: m.oy, fx: m.fx
  };
  for (anim in srcRec){
    if (!Object.prototype.hasOwnProperty.call(srcRec, anim) || anim === '_meta') continue;
    rec = srcRec[anim];
    if (!rec || typeof rec !== 'object') continue;
    out[anim] = {
      frames: rec.frames ? rec.frames.slice() : [],
      dirty: rec.dirty ? rec.dirty.slice() : [],
      n: rec.n,
      speed: rec.speed
    };
  }
  return out;
}

export function addSpriteDef(partial){
  var id = partial && partial.id && !byId[partial.id] ? String(partial.id) : nextSpriteId('s');
  var def = normalizeCustomDef({
    id: id,
    name: (partial && partial.name) || id,
    tag: partial && partial.tag,
    fw: (partial && partial.fw) || 16,
    fh: (partial && partial.fh) || 16,
    ox: partial && partial.ox,
    oy: partial && partial.oy,
    fx: partial && partial.fx,
    kind: (partial && partial.kind) || id,
    family: partial && partial.family,
    anims: (partial && partial.anims) || [{ id: 'idle', name: 'Idle', n: 1 }]
  });
  if (!def) return null;
  customDefs.push(def);
  rebuildById();
  if (partial && partial.src){
    setSpriteFrame(id, 'idle', 0, partial.src, true);
  } else {
    emit('add');
  }
  return getSpriteDef(id);
}

export function renameSpriteDef(id, name){
  var i, next = String(name || '').trim();
  if (!next) return getSpriteDef(id);
  for (i = 0; i < customDefs.length; i++){
    if (customDefs[i].id === id){
      customDefs[i] = normalizeCustomDef({
        id: customDefs[i].id, name: next, tag: customDefs[i].tag, fw: customDefs[i].fw, fh: customDefs[i].fh,
        ox: customDefs[i].ox, oy: customDefs[i].oy, fx: customDefs[i].fx,
        kind: customDefs[i].kind, family: customDefs[i].family, anims: customDefs[i].anims
      });
      rebuildById();
      emit('update');
      return getSpriteDef(id);
    }
  }
  for (i = 0; i < SPRITE_DEFS.length; i++){
    if (SPRITE_DEFS[i].id === id){
      SPRITE_DEFS[i].name = next;
      builtinNames[id] = next;
      writeBuiltinNames();
      emit('update');
      return getSpriteDef(id);
    }
  }
  return null;
}

export function setSpriteTag(id, tag){
  var i, next = String(tag || '').trim();
  for (i = 0; i < customDefs.length; i++){
    if (customDefs[i].id === id){
      customDefs[i] = normalizeCustomDef({
        id: customDefs[i].id, name: customDefs[i].name, tag: next, fw: customDefs[i].fw, fh: customDefs[i].fh,
        ox: customDefs[i].ox, oy: customDefs[i].oy, fx: customDefs[i].fx,
        kind: customDefs[i].kind, family: customDefs[i].family, anims: customDefs[i].anims
      });
      rebuildById();
      emit('update');
      return getSpriteDef(id);
    }
  }
  for (i = 0; i < SPRITE_DEFS.length; i++){
    if (SPRITE_DEFS[i].id === id){
      SPRITE_DEFS[i].tag = next;
      builtinTags[id] = next;
      writeBuiltinTags();
      emit('update');
      return getSpriteDef(id);
    }
  }
  return null;
}

export function removeSpriteDef(id){
  var i, found = false;
  for (i = 0; i < customDefs.length; i++){
    if (customDefs[i].id === id){ customDefs.splice(i, 1); found = true; break; }
  }
  if (!found) return false;
  delete saved[id];
  rebuildById();
  emit('remove');
  return true;
}

export function isHeroSprite(id){ return isHeroFamily(id); }

function clampS(n, lo, hi){
  n = n | 0;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function ensureRec(id, anim){
  var def = byId[id], a = animOf(def, anim);
  if (!def || !a) return null;
  if (!saved[id]) saved[id] = {};
  if (!saved[id][anim]) saved[id][anim] = { frames: [], dirty: [] };
  return saved[id][anim];
}

export function setSpriteSize(id, fw, fh){
  var def = byId[id], meta;
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
  emit('size');
  return getSpriteMeta(id);
}

/** Точка привязки на холсте кадра (см. blitEntSprite/blitHeroSprite ox/oy/fx) —
    отдельно от setSpriteSize, т.к. смена Size не пересчитывает её сама. */
export function setSpriteOrigin(id, ox, oy, fx){
  var def = byId[id];
  if (!def) return null;
  if (!saved[id]) saved[id] = {};
  if (!saved[id]._meta) saved[id]._meta = {};
  saved[id]._meta.ox = ox | 0;
  saved[id]._meta.oy = oy | 0;
  if (fx != null) saved[id]._meta.fx = fx | 0;
  emit('origin');
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
  var def = byId[id], a = animOf(def, anim), n;
  if (!def || !a) return null;
  i = i | 0;
  n = getAnimFrameCount(id, anim);
  if (i < 0 || i >= n) return null;
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
  var def = byId[id], a = animOf(def, anim), n, i;
  if (!def || !a) return null;
  n = getAnimFrameCount(id, anim);
  for (i = 0; i < n; i++)
    setSpriteFrame(id, anim, i, (srcs && srcs[i]) || '', true);
  return recOf(id, anim);
}

export function clearSpriteFrame(id, anim, i){
  return setSpriteFrame(id, anim, i, '', false);
}

export function snapshotSprites(){
  return cloneSaved(saved);
}

export function snapshotSpriteDefs(){
  return customDefs.map(normalizeCustomDef).filter(Boolean);
}

/** Полный restore черновика спрайтов (saved + custom defs) — для undo. */
export function applySpritesSnap(snap){
  var defs, i, m;
  saved = cloneSaved((snap && snap.sprites) || {});
  stripAnchorsFromSaved();
  defs = (snap && snap.defs) || [];
  customDefs = defs.map(normalizeCustomDef).filter(Boolean);
  defSeq = 1;
  for (i = 0; i < customDefs.length; i++){
    m = /_(\d+)$/.exec(customDefs[i].id);
    if (m) defSeq = Math.max(defSeq, (+m[1]) + 1);
  }
  rebuildById();
  imgs = {};
  loadAll();
  emit('replace');
}
