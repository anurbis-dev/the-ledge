import { T, C } from '../core/constants.js';
import { rectFree } from '../core/map.js';
import { giveGear } from './gear.js';
import { grantOne, takeItem } from './craft.js';
import { allocId, findById } from './ids.js';

/* сундук кладёт сразу; с земли сами летят только еда, монеты, самоцветы */
export function autoPick(kind){
  return kind === 'coin' || kind === 'gem' || kind === 'shroom';
}

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

function pushLoot(S, x, y, vx, vy, kind, extra, life, grace){
  extra = extra || {};
  S.loot.push({
    id: allocId(S.loot),
    x: x, y: y, vx: vx, vy: vy,
    kind: kind, qty: 1, t: life == null ? 14 : life, got: false,
    grace: grace || 0,
    bits: extra.bits, need: extra.need, set: extra.set, bit: extra.bit,
    uses: extra.uses, max: extra.max
  });
}

export function spawnDrop(S, kind, qty, extra){
  extra = extra || {};
  var p = S.p;
  var n = Math.max(1, qty || 1);
  var face = p && p.facing ? p.facing : 1;
  var cx = p ? p.x + p.w / 2 : 0;
  var cy = p ? p.y + p.h / 2 - 2 : 0;
  var i, side, spread, lift;
  for (i = 0; i < n; i++){
    side = n === 1 ? face : ((i % 2 === 0) ? face : -face);
    spread = 22 + (i * 11) % 36 + Math.random() * 18;
    lift = 72 + (i * 15) % 40 + Math.random() * 24;
    pushLoot(S,
      cx + side * (5 + (i % 3) * 3),
      cy,
      side * spread,
      -lift,
      kind, extra, 14, 0.7);
  }
  if (p) p.events.push('drop:' + kind);
}

export function dropFromPack(S, entry, qty){
  if (!S || !entry) return 0;
  qty = Math.max(1, qty || 1);
  var extra = {
    bits: entry.bits, need: entry.need, set: entry.set,
    bit: entry.item && entry.item.bit,
    uses: entry.item && entry.item.uses,
    max: entry.item && entry.item.max
  };
  var took = takeItem(S, entry, qty);
  if (!took) return 0;
  spawnDrop(S, entry.type, took, extra);
  return took;
}

export function pickRandomLoot(list){
  if (!list || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export function dropLoot(S, x, y, tag){
  var r = Math.random();
  var kind = r < 0.12 ? 'key' : (r < 0.34 ? 'gem' : (r < 0.5 ? 'shroom' : 'coin'));
  pushLoot(S, x, y, (Math.random()-0.5)*50, -110, kind, null, 12, 0);
  S.p.events.push('loot:' + kind);
}

/* лут, настроенный автором уровня (сундук/враг): либо все записи, либо (random=true) одна случайная */
export function dropConfiguredLoot(S, x, y, loot, random){
  if (!loot || !loot.length) return false;
  var picks = random ? [pickRandomLoot(loot)] : loot;
  for (var i = 0; i < picks.length; i++){
    var e = picks[i];
    var n = Math.max(1, e.qty || 1), k;
    for (k = 0; k < n; k++)
      pushLoot(S, x, y, (Math.random()-0.5)*50, -110, e.kind, null, 12, 0);
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

function collectLoot(S, l, i){
  grantLootKind(S, l.kind, l.qty || 1, i, l);
  S.loot.splice(i, 1);
  S.p.events.push('pickloot:' + l.kind);
}

export function stepLoot(S, dt, noPick){
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
    if (noPick || !autoPick(l.kind)) continue;
    if (Math.abs(l.x - (p.x + p.w/2)) < 12 && Math.abs(l.y - (p.y + p.h/2)) < 14)
      collectLoot(S, l, i);
  }
}

export function tryGroundPickup(S){
  var p = S.p;
  if (!p || p.pickT > 0 || p.state !== 'normal') return false;
  var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  var best = null, bd = C.ACT_R * C.ACT_R, i, dx, dy, d, it, l;
  for (i = 0; i < S.loot.length; i++){
    l = S.loot[i];
    if (l.got || autoPick(l.kind)) continue;
    if (l.grace > 0) continue;
    dx = l.x - cx; dy = l.y - cy;
    if (dx * p.facing < -2) continue;
    d = dx * dx + dy * dy;
    if (d < bd){ bd = d; best = { kind: 'loot', id: l.id }; }
  }
  for (i = 0; i < (S.items || []).length; i++){
    it = S.items[i];
    if (it.got || autoPick(it.kind)) continue;
    dx = it.x - cx; dy = it.y - cy;
    if (dx * p.facing < -2) continue;
    d = dx * dx + dy * dy;
    if (d < bd){ bd = d; best = { kind: 'item', id: it.id }; }
  }
  if (!best) return false;
  p.pickT = C.PICK_T;
  p.pickPend = best;
  p.pickWall = false;
  return true;
}

export function takeGroundPend(S, pend){
  var p = S.p, i, it, l;
  if (!pend) return false;
  if (pend.kind === 'loot'){
    l = findById(S.loot, pend.id);
    if (!l) return true;
    for (i = 0; i < S.loot.length; i++){
      if (S.loot[i] === l){ collectLoot(S, l, i); break; }
    }
    return true;
  }
  if (pend.kind === 'item'){
    for (i = 0; i < S.items.length; i++){
      it = S.items[i];
      if (it.id !== pend.id || it.got) continue;
      it.got = true;
      grantLootKind(S, it.kind, 1, it.id, it);
      S.hitStop = Math.max(S.hitStop, it.kind === 'relic' ? 0.25 : 0.03);
      p.events.push('pick:' + it.kind + ':' + it.id);
      break;
    }
    return true;
  }
  return false;
}
