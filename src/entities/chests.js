import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { giveGear } from './gear.js';

export function mkChests(){
  var LV = runtime.LV;
  return (LV.chests || []).map(function(a, i){
    return { id:i, x:a[0]*T, y:(a[1]+1)*T, kind:a[2], locked:!!a[3], opened:false, t:0 };
  });
}
export function tryChest(S){
  var p = S.p, cx = p.x + p.w/2, cy = p.y + p.h/2;
  for (var i = 0; i < S.chests.length; i++){
    var ch = S.chests[i];
    if (ch.opened) continue;
    if (Math.abs((ch.x + 10) - cx) > 20 || Math.abs((ch.y - 6) - cy) > 22) continue;
    if (ch.locked && !S.keys){ p.events.push('chestlocked'); return true; }
    if (ch.locked){ ch.locked = false; S.keys--; }
    ch.opened = true; ch.t = 1.6;
    if (ch.kind === 'key'){ S.keys++; }
    else if (ch.kind === 'helmet'){ giveGear(S, ['lhelm','ihelm','ghelm'][ch.id % 3]); }
    else if (ch.kind === 'shield'){ giveGear(S, ['wshield','ishield','gshield'][ch.id % 3]); }
    else if (ch.kind === 'sword'){ giveGear(S, ch.id % 2 ? 'blade' : 'sword'); }
    else if (ch.kind === 'scuba'){ giveGear(S, 'scuba'); }
    else if (ch.kind === 'flippers'){ giveGear(S, 'flippers'); }
    else if (ch.kind === 'harpoon'){ giveGear(S, 'harpoon'); }
    else if (ch.kind === 'shroom'){ if (S.hp < 3) S.hp++; S.bag.shroom++; }
    else if (ch.kind === 'gem'){ S.bag.gem += 3; }
    else { S.bag.coin += 5; }
    p.events.push('chest:' + ch.kind);
    return true;
  }
  return false;
}
