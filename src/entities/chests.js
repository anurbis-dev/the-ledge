import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { grantLootKind, pickRandomLoot } from './loot.js';
import { mutterHero } from '../speech/runtime.js';

var LEGACY_QTY = { coin: 5, gem: 3 };

function normalizeLoot(a){
  if (Array.isArray(a[4]))
    return a[4].map(function(e){ return { kind: e[0], qty: Math.max(1, e[1] | 0 || 1) }; });
  if (!a[2] || a[2] === 'empty') return [];
  var kind = a[2];
  return [{ kind: kind, qty: LEGACY_QTY[kind] || 1 }];
}

export function mkChests(){
  var LV = runtime.LV;
  return (LV.chests || []).map(function(a, i){
    return { id:i, x:a[0]*T, y:(a[1]+1)*T, locked:!!a[3], opened:false, t:0,
             loot: normalizeLoot(a), random: !!a[5] };
  });
}

export function tryChest(S){
  var p = S.p, cx = p.x + p.w/2, cy = p.y + p.h/2;
  for (var i = 0; i < S.chests.length; i++){
    var ch = S.chests[i];
    if (ch.roomHide) continue;
    if (Math.abs((ch.x + 10) - cx) > 20 || Math.abs((ch.y - 6) - cy) > 22) continue;
    if (ch.opened){ mutterHero(S, 'empty'); p.events.push('chestempty'); return true; }
    if (ch.locked && !S.keys){ p.events.push('chestlocked'); return true; }
    if (ch.locked){ ch.locked = false; S.keys--; }
    ch.opened = true; ch.t = 1.6;
    var loot = ch.loot || [];
    if (!loot.length){ mutterHero(S, 'empty'); p.events.push('chestempty'); return true; }
    var picks = ch.random ? [pickRandomLoot(loot)] : loot;
    if (!picks[0]){ mutterHero(S, 'empty'); p.events.push('chestempty'); return true; }
    for (var j = 0; j < picks.length; j++) grantLootKind(S, picks[j].kind, picks[j].qty, ch.id + j);
    ch.kind = picks[0].kind;
    p.events.push('chest:' + picks[0].kind);
    return true;
  }
  return false;
}
