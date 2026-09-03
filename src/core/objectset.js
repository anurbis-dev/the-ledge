/* Кастомные объекты редактора: kind + template + role + spriteId.
   Единственный источник истины — BAKED.objects (src/core/defaults.js), пишется
   по кнопке Bake. Черновик живёт только в памяти этой вкладки. Старый ключ
   localStorage (KEY) читается один раз как миграционный мостик, если BAKED
   ещё не содержит objects (снапшот старее этого фикса) — после первого Bake
   с этой версией кода BAKED побеждает навсегда. */
import { BAKED } from './defaults.js';
import { notifyDraftChange } from './persist.js';
import { spriteDefForKind, getSpriteDef, SPRITE_DEFS } from './spriteset.js';

var KEY = 'ledge.dev.objects';
/* Оверрайды display-имён builtin-kind — чисто UI-ярлык редактора, не часть
   BAKED (как TILE_NAMEKEY в editor.js / NAMEKEY в spriteset.js). */
var NAMEKEY = 'ledge.ed.objectNames';
/* Оверрайды tag builtin-kind — тот же принцип, отдельный ключ. */
var TAGKEY = 'ledge.ed.objectTags';
/* Оверрайды role builtin-kind — тот же принцип, отдельный ключ (по умолчанию role
   считается из PICKUP/LOOT/PROP/MARKER_KINDS ниже, но editor даёт переключить Type
   и для builtin-объектов, не только custom). */
var ROLEKEY = 'ledge.ed.objectRoles';
var ROLES = ['actor', 'pickup', 'loot', 'prop', 'marker', 'vehicle'];

var PICKUP_KINDS = { coin:1, gem:1, shroom:1, relic:1, tank:1, pickaxe:1 };
var LOOT_KINDS = { key:1, helmet:1, shield:1, sword:1, scuba:1, flippers:1, harpoon:1, bow:1 };
var PROP_KINDS = { chest:1, chestL:1, torch:1, boulder:1, light:1 };
var MARKER_KINDS = { sound:1, volume:1, fx_sand:1, level_exit:1, door:1, player_start:1, rope_v:1, rope_h:1, plat_h:1, plat_v:1, lift:1 };

/** Builtin placeable list — source of truth for names/order (editor mutates live ED_OBJS copy). */
export var BUILTIN_OBJS = [
  { name: 'Hero',    kind: 'hero' },
  { name: 'Start',   kind: 'player_start' },
  { name: 'Exit',    kind: 'level_exit' },
  { name: 'Door',    kind: 'door' },
  { name: 'Foe 1',   kind: 'enemy0' },
  { name: 'Foe 2',   kind: 'enemy1' },
  { name: 'Foe 3',   kind: 'enemy2' },
  { name: 'Bird',    kind: 'flier0' },
  { name: 'Bird 2',  kind: 'flier1' },
  { name: 'Bird 3',  kind: 'flier2' },
  { name: 'Diver',   kind: 'flier3' },
  { name: 'Spider',  kind: 'spider0' },
  { name: 'Spider 2',kind: 'spider1' },
  { name: 'Spider 3',kind: 'spider2' },
  { name: 'Sting',   kind: 'tendril0' },
  { name: 'Grabber', kind: 'tendril1' },
  { name: 'Torch',   kind: 'torch' },
  { name: 'Chest',   kind: 'chest' },
  { name: 'Locked',  kind: 'chestL' },
  { name: 'Coin',    kind: 'coin' },
  { name: 'Gem',     kind: 'gem' },
  { name: 'Shroom',  kind: 'shroom' },
  { name: 'Relic',   kind: 'relic' },
  { name: 'Air tank',kind: 'tank' },
  { name: 'Key',      kind: 'key' },
  { name: 'Helmet',   kind: 'helmet' },
  { name: 'Shield',   kind: 'shield' },
  { name: 'Sword',    kind: 'sword' },
  { name: 'Scuba',    kind: 'scuba' },
  { name: 'Flippers', kind: 'flippers' },
  { name: 'Harpoon',  kind: 'harpoon' },
  { name: 'Bow',      kind: 'bow' },
  { name: 'Pickaxe',  kind: 'pickaxe' },
  { name: 'Sound',   kind: 'sound' },
  { name: 'Light',   kind: 'light' },
  { name: 'Volume',  kind: 'volume' },
  { name: 'FX Sand', kind: 'fx_sand' },
  { name: 'Boulder', kind: 'boulder' },
  { name: 'Vehicle', kind: 'vehicle' },
  { name: 'Rope V',  kind: 'rope_v' },
  { name: 'Rope H',  kind: 'rope_h' },
  { name: 'Plat H',  kind: 'plat_h' },
  { name: 'Plat V',  kind: 'plat_v' },
  { name: 'Lift',    kind: 'lift' },
  { name: 'Hermit',  kind: 'npc_hermit' },
  { name: 'Wanderer', kind: 'npc_wanderer' }
];

var customs = [];
var byId = {};
var onChange = null;
var seq = 1;
/** Display-name overrides for builtin (non-custom) kinds — dev draft, same store as customs. */
var builtinNames = {};
/** Tag overrides for builtin (non-custom) kinds — same pattern as builtinNames. */
var builtinTags = {};
/** Role (Type) overrides for builtin (non-custom) kinds — same pattern as builtinNames/Tags. */
var builtinRoles = {};

function emit(why){
  notifyDraftChange();
  if (onChange) onChange(why || 'change');
}

/** Миграционный мостик: старый комбинированный ключ (objects+names до BAKED.objects). */
function readLegacyLocal(){
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && Array.isArray(o.objects)) return o;
    if (Array.isArray(o)) return { objects: o, names: {} };
    return null;
  } catch (_){ return null; }
}

function readBuiltinNames(){
  try {
    var raw = localStorage.getItem(NAMEKEY);
    if (raw){
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') return o;
    }
  } catch (_){}
  var legacy = readLegacyLocal();
  return (legacy && legacy.names && typeof legacy.names === 'object') ? legacy.names : null;
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

function readBuiltinRoles(){
  try {
    var raw = localStorage.getItem(ROLEKEY);
    if (raw){
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') return o;
    }
  } catch (_){}
  return null;
}

function writeBuiltinRoles(){
  try { localStorage.setItem(ROLEKEY, JSON.stringify(builtinRoles)); } catch (_){}
}

function rebuild(){
  byId = {};
  var i, o;
  for (i = 0; i < customs.length; i++){
    o = customs[i];
    if (o && o.id) byId[o.id] = o;
  }
}

function baseBuiltinRole(kind){
  if (!kind) return 'prop';
  if (kind === 'hero' || kind === 'player_start') return 'actor';
  if (kind === 'vehicle') return 'vehicle';
  if (PICKUP_KINDS[kind]) return 'pickup';
  if (LOOT_KINDS[kind]) return 'loot';
  if (PROP_KINDS[kind]) return 'prop';
  if (MARKER_KINDS[kind]) return 'marker';
  if (/^(enemy|flier|spider|tendril)\d+$/.test(kind) || kind.indexOf('npc_') === 0) return 'actor';
  return 'prop';
}

/** builtin role — учитывает оверрайд из Type-селектора Object Details, если он был. */
export function builtinRole(kind){
  if (kind && builtinRoles[kind]) return builtinRoles[kind];
  return baseBuiltinRole(kind);
}

export function builtinSpriteId(kind){
  if (kind === 'hero') return 'hero';
  if (kind === 'player_start') return null; /* спавн — маркер; спрайт уровня в LV.spawn.spriteId */
  if (kind === 'light') return 'lantern';
  /* Только каталог SPRITE_DEFS — custom с kind:'coin' не подменять builtin. */
  var i, d;
  for (i = 0; i < SPRITE_DEFS.length; i++){
    d = SPRITE_DEFS[i];
    if (d.kind === kind || d.id === kind) return d.id;
  }
  return null;
}

export function normalizeObject(o){
  if (!o || !o.id) return null;
  var role = o.role && ROLES.indexOf(o.role) >= 0 ? o.role : builtinRole(o.template || o.kind);
  var template = o.template || o.kind || 'coin';
  return {
    id: String(o.id),
    name: String(o.name || 'Object'),
    tag: String(o.tag || ''),
    template: String(template),
    role: role,
    spriteId: o.spriteId ? String(o.spriteId) : null,
    itemKind: o.itemKind ? String(o.itemKind) : null,
    custom: true
  };
}

function nextId(){
  var id, n = seq;
  do {
    id = 'o_' + n;
    n++;
  } while (byId[id]);
  seq = n;
  return id;
}

function boot(){
  customs = [];
  builtinNames = {};
  var baked = (BAKED && BAKED.objects) || null;
  var list = (baked && baked.length) ? baked : (readLegacyLocal() || {}).objects;
  if (list && list.length){
    customs = list.map(normalizeObject).filter(Boolean);
    var i, m;
    for (i = 0; i < customs.length; i++){
      m = /^o_(\d+)$/.exec(customs[i].id);
      if (m) seq = Math.max(seq, (+m[1]) + 1);
    }
  }
  var names = readBuiltinNames();
  if (names) builtinNames = names;
  builtinTags = {};
  var tags = readBuiltinTags();
  if (tags) builtinTags = tags;
  builtinRoles = {};
  var roles = readBuiltinRoles();
  if (roles) builtinRoles = roles;
  rebuild();
}

boot();

export function bindObjectset(hooks){
  onChange = hooks && hooks.onChange;
}

export function listObjects(){ return customs.slice(); }

export function getObjectDef(id){
  if (!id) return null;
  if (byId[id]) return byId[id];
  return null;
}

/** Resolve palette kind → full meta (builtin or custom). */
export function resolveObject(kind){
  var c = getObjectDef(kind);
  if (c) return {
    name: c.name,
    kind: c.id,
    template: c.template,
    role: c.role,
    spriteId: c.spriteId,
    itemKind: c.itemKind,
    custom: true
  };
  var i, b;
  for (i = 0; i < BUILTIN_OBJS.length; i++){
    b = BUILTIN_OBJS[i];
    if (b.kind === kind){
      return {
        name: builtinNames[b.kind] || b.name,
        tag: builtinTags[b.kind] || '',
        kind: b.kind,
        template: b.kind,
        role: builtinRole(b.kind),
        spriteId: builtinSpriteId(b.kind),
        itemKind: (PICKUP_KINDS[b.kind] || LOOT_KINDS[b.kind]) ? b.kind : null,
        custom: false
      };
    }
  }
  return null;
}

export function allPaletteObjects(){
  var out = [], i, b, c;
  for (i = 0; i < BUILTIN_OBJS.length; i++){
    b = BUILTIN_OBJS[i];
    out.push({
      name: builtinNames[b.kind] || b.name,
      tag: builtinTags[b.kind] || '',
      kind: b.kind,
      template: b.kind,
      role: builtinRole(b.kind),
      spriteId: builtinSpriteId(b.kind),
      custom: false
    });
  }
  for (i = 0; i < customs.length; i++){
    c = customs[i];
    out.push({
      name: c.name,
      tag: c.tag || '',
      kind: c.id,
      template: c.template,
      role: c.role,
      spriteId: c.spriteId,
      itemKind: c.itemKind,
      custom: true
    });
  }
  return out;
}

export function addObject(partial){
  var id = partial && partial.id && !byId[partial.id] ? String(partial.id) : nextId();
  var o = normalizeObject({
    id: id,
    name: (partial && partial.name) || 'Object',
    tag: partial && partial.tag,
    template: (partial && partial.template) || 'coin',
    role: partial && partial.role,
    spriteId: partial && partial.spriteId,
    itemKind: partial && partial.itemKind
  });
  if (!o) return null;
  customs.push(o);
  rebuild();
  emit('add');
  return o;
}

export function updateObject(id, patch){
  var o = byId[id], k, next;
  if (!o){
    if (patch && (patch.name || patch.tag != null || (patch.role && ROLES.indexOf(patch.role) >= 0))){
      for (k = 0; k < BUILTIN_OBJS.length; k++){
        if (BUILTIN_OBJS[k].kind === id){
          if (patch.name) builtinNames[id] = String(patch.name);
          if (patch.tag != null){
            builtinTags[id] = String(patch.tag);
            writeBuiltinTags();
          }
          if (patch.role && ROLES.indexOf(patch.role) >= 0){
            builtinRoles[id] = patch.role;
            writeBuiltinRoles();
          }
          if (patch.name) writeBuiltinNames();
          emit('update');
          return resolveObject(id);
        }
      }
    }
    return null;
  }
  next = {};
  for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) next[k] = o[k];
  for (k in patch) if (k !== 'id' && Object.prototype.hasOwnProperty.call(patch, k)) next[k] = patch[k];
  next = normalizeObject(next);
  for (k = 0; k < customs.length; k++)
    if (customs[k].id === id){ customs[k] = next; break; }
  rebuild();
  emit('update');
  return next;
}

export function removeObject(id){
  if (!byId[id]) return false;
  customs = customs.filter(function(o){ return o.id !== id; });
  rebuild();
  emit('remove');
  return true;
}

/** Clone builtin or custom into a new custom object. spriteId passed in (already cloned if needed). */
export function cloneObjectFrom(kind, spriteId){
  var src = resolveObject(kind);
  if (!src) return null;
  var template = src.template || src.kind;
  var role = src.role || builtinRole(template);
  var itemKind = src.itemKind || ((PICKUP_KINDS[template] || LOOT_KINDS[template]) ? template : null);
  var name = (src.name || 'Object') + ' copy';
  return addObject({
    name: name,
    tag: src.tag || '',
    template: template,
    role: role,
    spriteId: spriteId != null ? spriteId : (src.spriteId || null),
    itemKind: itemKind
  });
}

export function objectSpriteDef(kind){
  var meta = resolveObject(kind);
  if (!meta) return null;
  if (meta.spriteId) return getSpriteDef(meta.spriteId);
  return spriteDefForKind(meta.template || kind);
}

export function isLootRole(role){ return role === 'loot' || role === 'pickup'; }
export function isLootOnlyRole(role){ return role === 'loot'; }

export function snapshotObjects(){
  return customs.map(function(o){ return normalizeObject(o); });
}

/** Полный restore custom objects (для undo). */
export function applyObjectsSnap(list){
  customs = (list || []).map(normalizeObject).filter(Boolean);
  seq = 1;
  var i, m;
  for (i = 0; i < customs.length; i++){
    m = /_(\d+)$/.exec(customs[i].id);
    if (m) seq = Math.max(seq, (+m[1]) + 1);
  }
  rebuild();
  emit('replace');
}
