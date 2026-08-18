import { T } from '../core/constants.js';
import { rectFree } from '../core/map.js';
import { giveGear } from './gear.js';
import { grantOne, takeItem } from './craft.js';

var GEAR_TIERS = {
  helmet: ['lhelm', 'ihelm', 'ghelm'],
  shield: ['wshield', 'ishield', 'gshield'],
  sword: ['sword', 'blade']
};

/* выдаёт игроку одну запись лута (общая логика для сундуков и добычи с врагов) */
export function grantLootKind(S, kind, qty, seed, extra){
  qty = Math.max(1, qty || 1);
  extra = extra || {};
  var i;
  if (GEAR_TIERS[kind]){
    var tiers = GEAR_TIERS[kind];
    for (i = 0; i < qty; i++) giveGear(S, tiers[(seed + i) % tiers.length]);
    return;
  }
  for (i = 0; i < qty; i++) grantOne(S, kind, extra);
}

export function spawnDrop(S, kind, qty, extra){
  extra = extra || {};
  var p = S.p;
  var face = p && p.facing ? p.facing : 1;
  var x = p ? p.x + p.w / 2 + face * 10 : 0;
  var y = p ? p.y + p.h / 2 : 0;
  S.loot.push({
    x: x, y: y, vx: face * 36 + (Math.random() - 0.5) * 16, vy: -90,
    kind: kind, qty: qty || 1, t: 14, got: false, grace: 0.55,
    bits: extra.bits, need: extra.need, set: extra.set, bit: extra.bit
  });
  if (p) p.events.push('drop:' + kind);
}

export function dropFromPack(S, entry){
  if (!S || !entry) return false;
  var qty = entry.qty || 1;
  var extra = {
    bits: entry.bits, need: entry.need, set: entry.set,
    bit: entry.item && entry.item.bit
  };
  if (!takeItem(S, entry, qty)) return false;
  spawnDrop(S, entry.type, qty, extra);
  return true;
}

export function pickRandomLoot(list){
  if (!list || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export function dropLoot(S, x, y, tag){
  var r = Math.random();
  var kind = r < 0.12 ? 'key' : (r < 0.34 ? 'gem' : (r < 0.5 ? 'shroom' : 'coin'));
  S.loot.push({ x:x, y:y, vx:(Math.random()-0.5)*50, vy:-110, kind:kind, qty:1, t:12, got:false });
  S.p.events.push('loot:' + kind);
}

/* лут, настроенный автором уровня (сундук/враг): либо все записи, либо (random=true) одна случайная */
export function dropConfiguredLoot(S, x, y, loot, random){
  if (!loot || !loot.length) return false;
  var picks = random ? [pickRandomLoot(loot)] : loot;
  for (var i = 0; i < picks.length; i++){
    var e = picks[i];
    S.loot.push({ x:x, y:y, vx:(Math.random()-0.5)*50, vy:-110, kind:e.kind, qty:e.qty, t:12, got:false });
  }
  S.p.events.push('loot:' + picks[0].kind);
  return true;
}

/* единая точка выпадения лута при удалении любого убиваемого объекта
   (враг, птица, паук, щупальце, ...): свой loot/random, если задан автором
   уровня, иначе случайный дроп с меткой tag */
export function dropLootFor(S, obj, x, y, tag){
  if (obj.loot && obj.loot.length) dropConfiguredLoot(S, x, y, obj.loot, obj.random);
  else dropLoot(S, x, y, tag);
}

export function stepLoot(S, dt){
  var p = S.p;
  for (var i = S.loot.length - 1; i >= 0; i--){
    var l = S.loot[i];
    l.t -= dt;
    if (l.t <= 0){ S.loot.splice(i, 1); continue; }
    if (!l.rest){
      l.vy += 620*dt; if (l.vy > 260) l.vy = 260;
      var nx2 = l.x + l.vx*dt;
      if (rectFree(nx2-3, l.y-3, 6, 6)) l.x = nx2; else l.vx *= -0.4;
      var ny2 = l.y + l.vy*dt;
      if (rectFree(l.x-3, ny2-3, 6, 6)) l.y = ny2;
      else {
        if (l.vy > 0){                                  // приземлилось — фиксируем
          l.y = Math.floor((ny2 + 3) / T) * T - 3;
          l.rest = true; l.vy = 0; l.vx = 0;
        } else { l.vy = 0; }
      }
      if (Math.abs(l.vx) < 3) l.vx = 0;
    }
    l.bob = (l.bob || 0) + dt;
    if (l.grace){ l.grace -= dt; if (l.grace > 0) continue; }
    if (Math.abs(l.x - (p.x + p.w/2)) < 12 && Math.abs(l.y - (p.y + p.h/2)) < 14){
      grantLootKind(S, l.kind, l.qty || 1, i, l);
      S.loot.splice(i, 1);
      p.events.push('pickloot:' + l.kind);
    }
  }
}
