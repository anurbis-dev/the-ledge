import { GEAR } from './gear.js';

/* имена и описания — только символы пиксельного шрифта (A-Z 0-9 . , ' ! ? - :) */
export var ITEMS = {
  coin:    { name:'COIN',         cat:'bag',  desc:'COPPER BIT. HEAVY IN THE POCKET. SPENT NOWHERE YET.' },
  gem:     { name:'CAVE GEM',     cat:'bag',  desc:'COLD LIGHT. THE LEDGE KEEPS THEM IN THE DARK.' },
  shroom:  { name:'CAVE CAP',     cat:'bag',  desc:'BITTER. MENDS A SCRAPE WHEN YOU FIND IT.' },
  relic:   { name:'RELIC',        cat:'bag',  desc:'OLD STONE. IT HUMS IF YOU HOLD IT STILL.' },
  key:     { name:'KEY',          cat:'bag',  desc:'OPENS A LOCKED DOOR OR A LOCKED CHEST.' },
  tank:    { name:'AIR TANK',     cat:'bag',  desc:'SPARE BREATH. THE AQUALUNG DRINKS IT WHEN AIR RUNS OUT.' },
  stick:   { name:'STICK',        cat:'gear', desc:'A FALLEN BRANCH. LIGHT, BUT IT SPLINTERS FAST.' },
  sword:   { name:'IRON SWORD',   cat:'gear', desc:'HONEST EDGE. HEAVIER THAN THE STICK, LASTS LONGER.' },
  blade:   { name:'FINE BLADE',   cat:'gear', desc:'THIN STEEL. REACHES FARTHER THAN IRON.' },
  bow:     { name:'SHORT BOW',    cat:'gear', desc:'QUIET SHOTS. THE STRING WEARS FAST.' },
  harpoon: { name:'HARPOON',      cat:'gear', desc:'BOLT IN WATER. HOOK ON LAND. PULLS YOU IN.' },
  wshield: { name:'WOOD SHIELD',  cat:'gear', desc:'PLANKS AND HOPE. TAKES A HIT, THEN SPLITS.' },
  ishield: { name:'IRON SHIELD',  cat:'gear', desc:'HOLDS LONGER THAN WOOD. RINGS WHEN STRUCK.' },
  gshield: { name:'GILDED SHIELD',cat:'gear', desc:'GOLD RIM. HARD TO BREAK, HEAVY ON THE ARM.' },
  lhelm:   { name:'LEATHER HELM', cat:'gear', desc:'SOFT HAT. SAVES A BONK OR TWO ON STONE.' },
  ihelm:   { name:'IRON HELM',    cat:'gear', desc:'RINGS WHEN YOU HIT THE CEILING. TAKES MORE BLOWS.' },
  ghelm:   { name:'GILDED HELM',  cat:'gear', desc:'SHINES IN THE DARK. TAKES THE HARDEST HITS.' },
  scuba:   { name:'AQUALUNG',     cat:'gear', desc:'MORE AIR DOWN BELOW. SWAPS IN A SPARE TANK.' },
  flippers:{ name:'FLIPPERS',     cat:'gear', desc:'FASTER STROKES UNDERWATER. THEY DO NOT WEAR OUT.' }
};

var SLOT_NAME = {
  weapon: 'HAND', harpoon: 'HAND', helmet: 'HEAD',
  shield: 'ARM', scuba: 'LUNG', flippers: 'FEET'
};

var BAG_ORDER = ['coin', 'gem', 'shroom', 'relic', 'tank', 'key'];
var GEAR_SLOTS = ['weapon', 'harpoon', 'helmet', 'shield', 'scuba', 'flippers'];

export function itemInfo(type){
  return ITEMS[type] || { name: String(type || '?').toUpperCase(), cat: 'bag', desc: 'UNKNOWN FIND.' };
}

export function slotLabel(slot){
  return SLOT_NAME[slot] || String(slot || '').toUpperCase();
}

export function itemStats(entry){
  var lines = [], info = itemInfo(entry.type);
  if (entry.cat === 'bag'){
    lines.push('COUNT ' + (entry.qty || 0));
    return lines;
  }
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

export function listPack(S){
  var out = [], i, k, it, p;
  if (!S) return out;
  for (i = 0; i < BAG_ORDER.length; i++){
    k = BAG_ORDER[i];
    var n = k === 'key' ? (S.keys || 0) : (S.bag && S.bag[k]) || 0;
    if (n > 0) out.push({ type: k, cat: 'bag', qty: n, equipped: false, slot: null, item: null });
  }
  p = S.p;
  if (!p) return out;
  for (i = 0; i < GEAR_SLOTS.length; i++){
    k = GEAR_SLOTS[i];
    it = p.gear && p.gear[k];
    if (it) out.push({ type: it.type, cat: 'gear', qty: 1, equipped: true, slot: k, item: it });
  }
  for (i = 0; i < (p.spare || []).length; i++){
    it = p.spare[i];
    if (!it) continue;
    out.push({ type: it.type, cat: 'gear', qty: 1, equipped: false, slot: it.slot, item: it });
  }
  return out;
}
