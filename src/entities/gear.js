import { noteFirstItem } from '../speech/runtime.js';
import { runtime } from '../core/runtime.js';

/* слоты, которые крутятся в руке (Q / тап по иконке) */
export var HAND_SLOTS = { weapon: 1, harpoon: 1 };

/* оружие, чью durability можно настраивать по уровням в редакторе */
export var WEAPON_TYPES = ['stick', 'spear', 'sword', 'blade', 'bow', 'harpoon'];

/* стартовый боезапас, выдаётся вместе с оружием (боезапас — отдельно от durability) */
var AMMO_START = { bow: 6, harpoon: 4 };
var AMMO_KIND = { bow: 'arrow', harpoon: 'harpoonBolt' };

/* ---------------- снаряжение ---------------- */
export var GEAR = {
  stick:  { slot:'weapon', uses:12, reach:1.0, name:'stick'  },
  spear:  { slot:'weapon', uses:16, reach:1.3, name:'spear'  },
  sword:  { slot:'weapon', uses:20, reach:1.25, name:'sword'  },
  blade:  { slot:'weapon', uses:30, reach:1.45, name:'blade'  },
  bow:    { slot:'weapon', uses:15, reach:1.0, name:'bow'  },
  wshield:{ slot:'shield', uses:5,  name:'shield' },
  ishield:{ slot:'shield', uses:9,  name:'shield' },
  gshield:{ slot:'shield', uses:14, name:'shield' },
  lhelm:  { slot:'helmet', uses:3,  name:'helm' },
  ihelm:  { slot:'helmet', uses:6,  name:'helm' },
  ghelm:  { slot:'helmet', uses:10, name:'helm' },
  scuba:    { slot:'scuba',    uses:1, name:'scuba' },
  flippers: { slot:'flippers', uses:1, name:'flippers' },
  harpoon:  { slot:'harpoon',  uses:15, name:'harpoon' }
};

/* durability оружия — берём переопределение уровня (редактор), иначе дефолт из GEAR.
   0 в настройках уровня = бесконечная прочность, не ломается. */
export function gearDurability(type){
  var lv = runtime.LV;
  var ov = lv && lv.gearDurability && lv.gearDurability[type];
  return ov != null ? ov : GEAR[type].uses;
}
export function mkItem(type){
  var d = GEAR[type], dur = gearDurability(type), infinite = dur <= 0;
  return { type:type, slot:d.slot, uses: infinite ? 0 : dur, max: infinite ? 0 : dur, infinite: infinite };
}
function giveAmmo(S, kind, n){
  if (!S.bag) S.bag = {};
  S.bag[kind] = (S.bag[kind] || 0) + n;
  noteFirstItem(S, kind);
}
export function giveGear(S, type){
  var p = S.p, it = mkItem(type);
  if (!p.gear[it.slot]) p.gear[it.slot] = it;
  else p.spare.push(it);
  if (it.slot === 'weapon'){
    p.stick = true;
    if (p.hand !== 'harpoon' || !p.gear.harpoon) p.hand = 'weapon';
  }
  if (it.slot === 'helmet') p.helmet = true;
  if (it.slot === 'shield') p.shield = true;
  if (it.slot === 'scuba') p.scuba = true;
  if (it.slot === 'flippers') p.flippers = true;
  if (it.slot === 'harpoon'){
    p.harpoonGun = true;
    if (!p.gear.weapon) p.hand = 'harpoon';
  }
  if (AMMO_START[type]) giveAmmo(S, AMMO_KIND[type], AMMO_START[type]);
  noteFirstItem(S, type);
  p.events.push('gear:' + type);
}
export function wearGear(S, slot, n){
  var p = S.p, it = p.gear[slot];
  if (!it) return false;
  if (it.infinite) return true;                          // durability 0 в настройках — не ломается
  it.uses -= (n || 1);
  if (it.uses > 0) return true;
  p.gear[slot] = null;                                  // сломалось — берём запасное
  for (var i = 0; i < p.spare.length; i++){
    if (p.spare[i].slot === slot){ p.gear[slot] = p.spare.splice(i, 1)[0]; break; }
  }
  if (slot === 'weapon') p.stick = !!p.gear.weapon;
  if (slot === 'helmet') p.helmet = !!p.gear.helmet;
  if (slot === 'shield') p.shield = !!p.gear.shield;
  if (slot === 'harpoon'){
    p.harpoonGun = !!p.gear.harpoon;
    if (!p.gear.harpoon && p.hand === 'harpoon') p.hand = 'weapon';
  }
  p.events.push('broke:' + slot + (p.gear[slot] ? ':next' : ''));
  return !!p.gear[slot];
}

export function isHarpoonHand(p){
  return !!(p && p.hand === 'harpoon' && p.gear && p.gear.harpoon);
}
export function isBowHand(p){
  return !isHarpoonHand(p) && !!(p.gear && p.gear.weapon && p.gear.weapon.type === 'bow');
}
export function isMeleeHand(p){
  return !isHarpoonHand(p) && !!p.stick && !isBowHand(p);
}

var HAND_RANK = { stick: 0, spear: 1, sword: 2, blade: 3, bow: 4, harpoon: 5 };

export function listHand(p){
  var out = [], i;
  if (p.gear.weapon) out.push({ slot: 'weapon', item: p.gear.weapon, equipped: true });
  for (i = 0; i < p.spare.length; i++){
    if (p.spare[i].slot === 'weapon') out.push({ slot: 'weapon', item: p.spare[i], equipped: false });
  }
  if (p.gear.harpoon) out.push({ slot: 'harpoon', item: p.gear.harpoon, equipped: true });
  for (i = 0; i < p.spare.length; i++){
    if (p.spare[i].slot === 'harpoon') out.push({ slot: 'harpoon', item: p.spare[i], equipped: false });
  }
  out.sort(function(a, b){
    var ra = HAND_RANK[a.item.type], rb = HAND_RANK[b.item.type];
    if (ra == null) ra = 9;
    if (rb == null) rb = 9;
    return ra - rb;
  });
  return out;
}

export function handIndex(p){
  var list = listHand(p), i;
  var want = (p.hand === 'harpoon') ? p.gear.harpoon : p.gear.weapon;
  if (want){
    for (i = 0; i < list.length; i++) if (list[i].item === want) return i;
  }
  return 0;
}

export function activeHandItem(p){
  var list = listHand(p), i = handIndex(p);
  return list[i] ? list[i].item : null;
}

export function cycleHand(S){
  var p = S.p, list = listHand(p);
  if (list.length < 2) return false;
  var next = list[(handIndex(p) + 1) % list.length];
  if (next.slot === 'weapon'){
    if (!next.equipped){
      var cur = p.gear.weapon;
      p.gear.weapon = next.item;
      for (var s = 0; s < p.spare.length; s++){
        if (p.spare[s] === next.item){ p.spare[s] = cur; break; }
      }
    }
    p.hand = 'weapon';
    p.stick = !!p.gear.weapon;
  } else {
    if (!next.equipped){
      var curH = p.gear.harpoon;
      p.gear.harpoon = next.item;
      for (var s2 = 0; s2 < p.spare.length; s2++){
        if (p.spare[s2] === next.item){ p.spare[s2] = curH; break; }
      }
    }
    p.hand = 'harpoon';
  }
  p.events.push('swap:' + next.item.type);
  return true;
}
