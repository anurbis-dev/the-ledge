import { GEAR, giveGear } from './gear.js';
import { noteFirstItem } from '../speech/runtime.js';

/* два разных предмета → новый */
export var RECIPES = [
  { a: 'stick', b: 'stone', out: 'spear' }
];

/* куски одного сета: OR битов, пока не наберётся need */
export var PUZZLES = {
  idol: {
    bits: { shard_a: 1, shard_b: 2, shard_c: 4 },
    need: 7,
    kit: 'idol_kit',
    out: 'idol'
  }
};

function bitCount(n){
  var c = 0;
  n = n >>> 0;
  while (n){ n &= n - 1; c++; }
  return c;
}

export function puzzleId(type, extra){
  if (extra && extra.set && PUZZLES[extra.set]) return extra.set;
  var id, spec;
  for (id in PUZZLES){
    spec = PUZZLES[id];
    if (spec.bits[type] || spec.kit === type) return id;
  }
  return extra && extra.bits != null ? (extra.set || null) : null;
}

export function isPuzzleKind(type, extra){
  return !!puzzleId(type, extra);
}

function bitsOf(entry){
  if (!entry) return 0;
  if (entry.bits) return entry.bits;
  if (entry.item && entry.item.bits) return entry.item.bits;
  var id = puzzleId(entry.type, entry);
  if (!id) return 0;
  return PUZZLES[id].bits[entry.type] || 0;
}

function recipeOf(a, b){
  var i, r;
  for (i = 0; i < RECIPES.length; i++){
    r = RECIPES[i];
    if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r;
  }
  return null;
}

export function previewCombine(a, b){
  if (!a || !b) return null;
  if (a.src && b.src && a.src.kind === b.src.kind &&
      ((a.src.kind === 'bag' && a.src.key === b.src.key) ||
       (a.src.kind === 'key' && b.src.kind === 'key') ||
       (a.src.kind === 'gear' && a.src.slot === b.src.slot) ||
       (a.src.kind === 'spare' && a.src.index === b.src.index) ||
       (a.src.kind === 'part' && a.src.index === b.src.index)))
    return null;
  var rec = recipeOf(a.type, b.type);
  if (rec) return { kind: 'recipe', out: rec.out };
  var idA = puzzleId(a.type, a), idB = puzzleId(b.type, b);
  if (!idA || idA !== idB) return null;
  var spec = PUZZLES[idA];
  var merged = bitsOf(a) | bitsOf(b);
  if (!merged || merged === bitsOf(a) || merged === bitsOf(b)) return null;
  if (merged === spec.need)
    return { kind: 'puzzle', set: idA, bits: merged, need: spec.need, complete: true, out: spec.out };
  return { kind: 'puzzle', set: idA, bits: merged, need: spec.need, complete: false, kit: spec.kit, out: spec.kit };
}

export function canCombine(a, b){
  return !!previewCombine(a, b);
}

function syncFlags(p){
  if (!p || !p.gear) return;
  p.stick = !!p.gear.weapon;
  p.helmet = !!p.gear.helmet;
  p.shield = !!p.gear.shield;
  p.scuba = !!p.gear.scuba;
  p.flippers = !!p.gear.flippers;
  p.harpoonGun = !!p.gear.harpoon;
  if (!p.gear.harpoon && p.hand === 'harpoon') p.hand = 'weapon';
}

export function takeItem(S, entry, qty){
  if (!S || !entry || !entry.src) return 0;
  qty = Math.max(1, qty || 1);
  var src = entry.src, p = S.p, n, take;
  if (src.kind === 'bag'){
    n = (S.bag && S.bag[src.key]) || 0;
    if (n < 1) return 0;
    take = Math.min(qty, n);
    S.bag[src.key] = n - take;
    return take;
  }
  if (src.kind === 'key'){
    n = S.keys || 0;
    if (n < 1) return 0;
    take = Math.min(qty, n);
    S.keys = n - take;
    return take;
  }
  if (src.kind === 'gear'){
    if (!p || !p.gear || !p.gear[src.slot]) return 0;
    if (entry.item && p.gear[src.slot] !== entry.item && p.gear[src.slot].type !== entry.type) return 0;
    p.gear[src.slot] = null;
    syncFlags(p);
    return 1;
  }
  if (src.kind === 'spare'){
    if (!p || !p.spare || !p.spare[src.index]) return 0;
    p.spare.splice(src.index, 1);
    return 1;
  }
  if (src.kind === 'part'){
    if (!S.parts || !S.parts[src.index]) return 0;
    S.parts.splice(src.index, 1);
    return 1;
  }
  return 0;
}

function takeTwo(S, a, b){
  var same = a.src && b.src && a.src.kind === b.src.kind &&
    (a.src.kind === 'spare' || a.src.kind === 'part');
  if (same && b.src.index > a.src.index){
    if (!takeItem(S, b, 1)) return false;
    return !!takeItem(S, a, 1);
  }
  if (!takeItem(S, a, 1)) return false;
  return !!takeItem(S, b, 1);
}

export function grantPart(S, type, extra){
  extra = extra || {};
  var id = puzzleId(type, extra);
  var spec = id && PUZZLES[id];
  var rec = {
    type: type,
    set: id || extra.set || null,
    bit: extra.bit != null ? extra.bit : (spec && spec.bits[type]) || 0,
    bits: extra.bits != null ? extra.bits : 0,
    need: extra.need != null ? extra.need : (spec ? spec.need : 0)
  };
  if (!rec.bits && rec.bit) rec.bits = rec.bit;
  if (spec && rec.bits === spec.need){
    grantOne(S, spec.out, null);
    return spec.out;
  }
  if (spec && rec.bits !== rec.bit && rec.bits > 0) rec.type = spec.kit;
  if (!S.parts) S.parts = [];
  S.parts.push(rec);
  noteFirstItem(S, rec.type);
  return rec.type;
}

export function grantOne(S, type, extra){
  extra = extra || {};
  if (type === 'key'){
    S.keys = (S.keys || 0) + 1;
    noteFirstItem(S, 'key');
    return;
  }
  if (isPuzzleKind(type, extra) || extra.bits != null || extra.set){
    grantPart(S, type, extra);
    return;
  }
  if (GEAR[type]){
    giveGear(S, type);
    return;
  }
  if (!S.bag) S.bag = {};
  if (S.bag[type] == null) S.bag[type] = 0;
  if (type === 'shroom' && S.hp < 3) S.hp++;
  S.bag[type]++;
  noteFirstItem(S, type);
}

export function combineItems(S, a, b){
  var prev = previewCombine(a, b);
  if (!prev || !S) return null;
  if (!takeTwo(S, a, b)) return null;
  if (prev.kind === 'recipe'){
    grantOne(S, prev.out, null);
    return { type: prev.out };
  }
  if (prev.complete){
    grantOne(S, prev.out, null);
    return { type: prev.out };
  }
  grantPart(S, prev.kit, { set: prev.set, bits: prev.bits, need: prev.need });
  return { type: prev.kit, bits: prev.bits, need: prev.need };
}

export function pieceLabel(entry){
  if (!entry || !entry.need) return '';
  return bitCount(entry.bits || 0) + '/' + bitCount(entry.need);
}
