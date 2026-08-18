import { GEAR } from './gear.js';

/* имена и описания — только символы пиксельного шрифта (A-Z 0-9 . , ' ! ? - :) */
export var TABS = [
  { id: 'all',  label: 'ALL' },
  { id: 'find', label: 'FIND' },
  { id: 'gear', label: 'GEAR' },
  { id: 'part', label: 'PART' }
];

/* dev-хоткеи: клавиша → набор в пак */
export var DEV_KITS = {
  '1': { name: 'WEAPONS', types: ['stick', 'spear', 'sword', 'blade', 'bow', 'harpoon'], qty: 1 },
  '2': { name: 'ITEMS',   types: ['coin', 'gem', 'relic', 'key', 'tank', 'stone', 'idol'], qty: 5 },
  '3': { name: 'FOOD',    types: ['shroom'], qty: 6 },
  '4': { name: 'ARMOR',   types: ['wshield', 'ishield', 'gshield', 'lhelm', 'ihelm', 'ghelm', 'scuba', 'flippers'], qty: 1 },
  '5': { name: 'PARTS',   types: ['shard_a', 'shard_b', 'shard_c'], qty: 1 }
};

export var ITEMS = {
  coin:    { name:'COIN',         cat:'bag',  tab:'find', desc:'COPPER BIT. HEAVY IN THE POCKET. SPENT NOWHERE YET.' },
  gem:     { name:'CAVE GEM',     cat:'bag',  tab:'find', desc:'COLD LIGHT. THE LEDGE KEEPS THEM IN THE DARK.' },
  shroom:  { name:'CAVE CAP',     cat:'bag',  tab:'find', desc:'BITTER. MENDS A SCRAPE WHEN YOU FIND IT.' },
  relic:   { name:'RELIC',        cat:'bag',  tab:'find', desc:'OLD STONE. IT HUMS IF YOU HOLD IT STILL.' },
  key:     { name:'KEY',          cat:'bag',  tab:'find', desc:'OPENS A LOCKED DOOR OR A LOCKED CHEST.' },
  tank:    { name:'AIR TANK',     cat:'bag',  tab:'find', desc:'SPARE BREATH. THE AQUALUNG DRINKS IT WHEN AIR RUNS OUT.' },
  idol:    { name:'STONE IDOL',   cat:'bag',  tab:'find', desc:'THREE SHARDS, ONE FACE. IT WATCHES BACK.' },
  stone:   { name:'STONE',        cat:'bag',  tab:'part', desc:'A SHARP ROCK. WANTS A STICK TO BECOME A POINT.' },
  shard_a: { name:'IDOL SHARD A', cat:'part', tab:'part', desc:'BROKEN FACE. THE SET WANTS THREE.' },
  shard_b: { name:'IDOL SHARD B', cat:'part', tab:'part', desc:'BROKEN CROWN. FITS A BROKEN FACE.' },
  shard_c: { name:'IDOL SHARD C', cat:'part', tab:'part', desc:'BROKEN BASE. LAST OF THE THREE.' },
  idol_kit:{ name:'IDOL PIECES',  cat:'part', tab:'part', desc:'SHARDS CLICK. STILL NOT A FACE.' },
  stick:   { name:'STICK',        cat:'gear', tab:'gear', desc:'A FALLEN BRANCH. LIGHT, BUT IT SPLINTERS FAST.' },
  spear:   { name:'STONE SPEAR',  cat:'gear', tab:'gear', desc:'STICK AND STONE. REACHES FARTHER THAN A BRANCH.' },
  sword:   { name:'IRON SWORD',   cat:'gear', tab:'gear', desc:'HONEST EDGE. HEAVIER THAN THE STICK, LASTS LONGER.' },
  blade:   { name:'FINE BLADE',   cat:'gear', tab:'gear', desc:'THIN STEEL. REACHES FARTHER THAN IRON.' },
  bow:     { name:'SHORT BOW',    cat:'gear', tab:'gear', desc:'QUIET SHOTS. THE STRING WEARS FAST.' },
  harpoon: { name:'HARPOON',      cat:'gear', tab:'gear', desc:'BOLT IN WATER. HOOK ON LAND. PULLS YOU IN.' },
  wshield: { name:'WOOD SHIELD',  cat:'gear', tab:'gear', desc:'PLANKS AND HOPE. TAKES A HIT, THEN SPLITS.' },
  ishield: { name:'IRON SHIELD',  cat:'gear', tab:'gear', desc:'HOLDS LONGER THAN WOOD. RINGS WHEN STRUCK.' },
  gshield: { name:'GILDED SHIELD',cat:'gear', tab:'gear', desc:'GOLD RIM. HARD TO BREAK, HEAVY ON THE ARM.' },
  lhelm:   { name:'LEATHER HELM', cat:'gear', tab:'gear', desc:'SOFT HAT. SAVES A BONK OR TWO ON STONE.' },
  ihelm:   { name:'IRON HELM',    cat:'gear', tab:'gear', desc:'RINGS WHEN YOU HIT THE CEILING. TAKES MORE BLOWS.' },
  ghelm:   { name:'GILDED HELM',  cat:'gear', tab:'gear', desc:'SHINES IN THE DARK. TAKES THE HARDEST HITS.' },
  scuba:   { name:'AQUALUNG',     cat:'gear', tab:'gear', desc:'MORE AIR DOWN BELOW. SWAPS IN A SPARE TANK.' },
  flippers:{ name:'FLIPPERS',     cat:'gear', tab:'gear', desc:'FASTER STROKES UNDERWATER. THEY DO NOT WEAR OUT.' }
};

var SLOT_NAME = {
  weapon: 'HAND', harpoon: 'HAND', helmet: 'HEAD',
  shield: 'ARM', scuba: 'LUNG', flippers: 'FEET'
};

var BAG_ORDER = ['coin', 'gem', 'shroom', 'relic', 'idol', 'tank', 'key', 'stone'];
var GEAR_SLOTS = ['weapon', 'harpoon', 'helmet', 'shield', 'scuba', 'flippers'];

export function itemInfo(type){
  return ITEMS[type] || { name: String(type || '?').toUpperCase(), cat: 'bag', tab: 'find', desc: 'UNKNOWN FIND.' };
}

export function itemTab(type, entry){
  if (entry && entry.tab) return entry.tab;
  var info = itemInfo(type);
  if (info.tab) return info.tab;
  if (info.cat === 'gear') return 'gear';
  if (info.cat === 'part') return 'part';
  return 'find';
}

export function slotLabel(slot){
  return SLOT_NAME[slot] || String(slot || '').toUpperCase();
}

function bitCount(n){
  var c = 0;
  n = n >>> 0;
  while (n){ n &= n - 1; c++; }
  return c;
}

export function itemStats(entry){
  var lines = [], info = itemInfo(entry.type);
  if (entry.need){
    lines.push('PIECES ' + bitCount(entry.bits || 0) + '/' + bitCount(entry.need));
  }
  if (entry.cat === 'bag'){
    lines.push('COUNT ' + (entry.qty || 0));
    return lines;
  }
  if (entry.cat === 'part') return lines;
  var g = GEAR[entry.type];
  var it = entry.item;
  if (g && g.reach) lines.push('REACH ' + g.reach);
  if (it && it.max) lines.push('USES ' + Math.max(0, it.uses) + '/' + it.max);
  else if (g && g.uses) lines.push('USES ' + g.uses + '/' + g.uses);
  if (entry.slot) lines.push('SLOT ' + slotLabel(entry.slot));
  if (entry.equipped) lines.push('WORN');
  else if (info.cat === 'gear') lines.push('SPARE');
  return lines;
}

function pushBag(out, type, qty, src){
  if (qty <= 0) return;
  out.push({
    type: type, cat: 'bag', tab: itemTab(type), qty: qty,
    equipped: false, slot: null, item: null, src: src
  });
}

export function listPack(S, tab){
  var out = [], i, k, it, p, seen = {};
  if (!S) return out;
  for (i = 0; i < BAG_ORDER.length; i++){
    k = BAG_ORDER[i];
    seen[k] = true;
    var n = k === 'key' ? (S.keys || 0) : (S.bag && S.bag[k]) || 0;
    if (k === 'key') pushBag(out, k, n, { kind: 'key' });
    else pushBag(out, k, n, { kind: 'bag', key: k });
  }
  if (S.bag){
    for (k in S.bag){
      if (seen[k] || !(S.bag[k] > 0)) continue;
      if (itemInfo(k).cat === 'part') continue;
      pushBag(out, k, S.bag[k], { kind: 'bag', key: k });
    }
  }
  for (i = 0; i < (S.parts || []).length; i++){
    var pr = S.parts[i];
    if (!pr) continue;
    out.push({
      type: pr.type, cat: 'part', tab: 'part', qty: 1,
      equipped: false, slot: null, item: pr,
      bits: pr.bits, need: pr.need, set: pr.set,
      src: { kind: 'part', index: i }
    });
  }
  p = S.p;
  if (p){
    for (i = 0; i < GEAR_SLOTS.length; i++){
      k = GEAR_SLOTS[i];
      it = p.gear && p.gear[k];
      if (it) out.push({
        type: it.type, cat: 'gear', tab: 'gear', qty: 1,
        equipped: true, slot: k, item: it,
        src: { kind: 'gear', slot: k }
      });
    }
    for (i = 0; i < (p.spare || []).length; i++){
      it = p.spare[i];
      if (!it) continue;
      out.push({
        type: it.type, cat: 'gear', tab: 'gear', qty: 1,
        equipped: false, slot: it.slot, item: it,
        src: { kind: 'spare', index: i }
      });
    }
  }
  if (tab && tab !== 'all'){
    var filtered = [];
    for (i = 0; i < out.length; i++){
      if (itemTab(out[i].type, out[i]) === tab) filtered.push(out[i]);
    }
    return filtered;
  }
  return out;
}
