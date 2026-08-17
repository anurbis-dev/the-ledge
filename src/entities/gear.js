/* ---------------- снаряжение ---------------- */
export var GEAR = {
  stick:  { slot:'weapon', uses:12, reach:1.0, name:'палка'  },
  sword:  { slot:'weapon', uses:20, reach:1.25, name:'меч'   },
  blade:  { slot:'weapon', uses:30, reach:1.45, name:'клинок'},
  wshield:{ slot:'shield', uses:5,  name:'щит'  },
  ishield:{ slot:'shield', uses:9,  name:'щит'  },
  gshield:{ slot:'shield', uses:14, name:'щит'  },
  lhelm:  { slot:'helmet', uses:3,  name:'шлем' },
  ihelm:  { slot:'helmet', uses:6,  name:'шлем' },
  ghelm:  { slot:'helmet', uses:10, name:'шлем' },
  scuba:    { slot:'scuba',    uses:1, name:'акваланг' },
  flippers: { slot:'flippers', uses:1, name:'ласты'    },
  harpoon:  { slot:'harpoon',  uses:4, name:'гарпун'    }
};
export function mkItem(type){
  var d = GEAR[type];
  return { type:type, slot:d.slot, uses:d.uses, max:d.uses };
}
export function giveGear(S, type){
  var p = S.p, it = mkItem(type);
  if (!p.gear[it.slot]) p.gear[it.slot] = it;
  else p.spare.push(it);
  if (it.slot === 'weapon') p.stick = true;
  if (it.slot === 'helmet') p.helmet = true;
  if (it.slot === 'shield') p.shield = true;
  if (it.slot === 'scuba') p.scuba = true;
  if (it.slot === 'flippers') p.flippers = true;
  if (it.slot === 'harpoon') p.harpoonGun = true;
  p.events.push('gear:' + type);
}
export function wearGear(S, slot, n){
  var p = S.p, it = p.gear[slot];
  if (!it) return false;
  it.uses -= (n || 1);
  if (it.uses > 0) return true;
  p.gear[slot] = null;                                  // сломалось — берём запасное
  for (var i = 0; i < p.spare.length; i++){
    if (p.spare[i].slot === slot){ p.gear[slot] = p.spare.splice(i, 1)[0]; break; }
  }
  if (slot === 'weapon') p.stick = !!p.gear.weapon;
  if (slot === 'helmet') p.helmet = !!p.gear.helmet;
  if (slot === 'shield') p.shield = !!p.gear.shield;
  p.events.push('broke:' + slot + (p.gear[slot] ? ':next' : ''));
  return !!p.gear[slot];
}
