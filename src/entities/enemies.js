import { C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { rectFree, solidAt } from '../core/map.js';
import { damage, slopeUnder } from '../core/player.js';
import { getAnimBox } from '../core/spriteset.js';
import { dropLootFor } from './loot.js';
import { GEAR, wearGear } from './gear.js';

export function enemyBox(kind){
  return getAnimBox('enemy' + (kind | 0), 'idle');
}

export function applyEnemyBox(e){
  var b, feet, restFeet;
  if (!e) return;
  b = enemyBox(e.kind);
  if (e.w === b.w && e.h === b.h) return;
  feet = e.y + e.h;
  restFeet = e.baseY !== undefined ? e.baseY + e.h : feet;
  e.w = b.w;
  e.h = b.h;
  e.y = feet - e.h;
  if (e.baseY !== undefined) e.baseY = restFeet - e.h;
}

export function mkEnemies(){
  var LV = runtime.LV;
  return (LV.enemies || []).map(function(a, i){
    var kind = a[5] !== undefined ? a[5] : (i % 3);
    var box = enemyBox(kind);
    var loot = Array.isArray(a[6])
      ? a[6].map(function(e){ return { kind: e[0], qty: Math.max(1, e[1] | 0 || 1) }; })
      : [];
    return { id:i, x:a[0], y:a[1]-box.h, w:box.w, h:box.h, x0:a[2], x1:a[3],
             v: a[4] * (kind === 1 ? 1.4 : (kind === 2 ? 0.7 : 1)),
             kind: kind, tough: kind === 2 ? 2 : 1,
             dir: i%2 ? -1 : 1, dead:false, hitT:0, ph:i*1.3, vy:0,
             loot: loot, random: !!a[7] };
  });
}
export function stepEnemies(S, dt){
  var p = S.p;
  for (var i = 0; i < S.enemies.length; i++){
    var e = S.enemies[i];
    applyEnemyBox(e);
    if (e.roomHide) continue;
    if (e.dead){ e.hitT -= dt; continue; }
    if (e.hitT > 0){ e.hitT -= dt; }
    if (e.hopCd === undefined){ e.hopCd = 0.5 + Math.random(); e.baseY = e.y; e.vy = 0; }
    // подпрыгивает, когда героиня рядом и пытается перепрыгнуть
    e.hopCd -= dt;
    var near = Math.abs((p.x + p.w/2) - (e.x + e.w/2)) < 42 && p.y + p.h < e.y + e.h + 4;
    if (near && e.hopCd <= 0 && e.vy === 0){
      e.vy = -175; e.hopCd = 0.9 + Math.random()*0.5;
      p.events.push('snap:' + e.id);
    }
    if (e.vy !== 0){
      e.vy += 620*dt; e.y += e.vy*dt;
      if (e.y >= e.baseY){ e.y = e.baseY; e.vy = 0; }
    }
    // прыжок героини сверху убивает
    if (!e.dead && p.vy > 60 && p.state === 'normal' &&
        p.x + p.w > e.x + 1 && p.x < e.x + e.w - 1 &&
        p.y + p.h > e.y - 2 && p.y + p.h < e.y + e.h * 0.7){
      e.dead = true; e.hitT = 0.6;
      dropLootFor(S, e, e.x + e.w/2, e.y + e.h/2, 's');
      p.vy = -190; p.onGround = false; p.apexY = p.y;
      S.hitStop = Math.max(S.hitStop, 0.05); S.shake = Math.max(S.shake, 3);
      p.events.push('stomp:' + e.id);
      continue;
    }
    var ex0 = e.x;
    e.x += e.v * e.dir * dt;
    if (e.x < e.x0){ e.x = e.x0; e.dir = 1; }
    if (e.x > e.x1){ e.x = e.x1; e.dir = -1; }
    if (!rectFree(e.x, e.y, e.w, e.h)){              // упёрся в стену — разворот
      e.x = ex0; e.dir = -e.dir;
    } else if (e.vy === 0){                          // идёт по склону
      var eb = { x:e.x, y:e.y, w:e.w, h:e.h };
      var esl = slopeUnder(eb);
      if (esl !== null){ e.y = esl - e.h; e.baseY = e.y; }
    }
    if (e.vy === 0 && !solidAt(e.x + e.w/2, e.y + e.h + 3)){   // не сходит с края
      e.dir = -e.dir; e.x += e.v * e.dir * dt;
    }
    if (e.baseY !== undefined && e.vy === 0) e.baseY = e.y;
    if (p.hurtCd <= 0 && p.state !== 'stun' &&
        p.x + p.w > e.x + 1 && p.x < e.x + e.w - 1 &&
        p.y + p.h > e.y + 1 && p.y < e.y + e.h - 1){
      var kb = (p.x + p.w/2 < e.x + e.w/2) ? -1 : 1;
      if (p.shield && p.shieldCd <= 0){                    // щит отбрасывает врага
        e.x -= kb * 16; e.dir = -kb; e.vy = -90;
        p.shieldCd = 0.4; p.hurtCd = 0.35; p.bashT = 0.26;
        S.shake = Math.max(S.shake, 2);
        p.events.push('bash:' + e.id);
        wearGear(S, 'shield');
        continue;
      }
      p.hurtCd = C.HURT_CD;
      damage(S, 1, 0.3);
      p.vx = kb * 110; p.vy = -140; p.onGround = false;
    }
  }
}
export function attack(S){
  var p = S.p;
  if (!p.stick || p.atkCd > 0 || p.atkT > 0) return false;
  if (p.stance > 0) return false;                        // бьём только стоя
  if (p.state !== 'normal' && p.state !== 'ladder' && p.state !== 'snare') return false;
  p.atkT = C.ATK_T; p.atkCd = C.ATK_T + C.ATK_CD;
  p.events.push('swing');
  var reach = p.gear.weapon ? (GEAR[p.gear.weapon.type].reach || 1) : 1;
  var ax = p.x + p.w/2 + p.facing*(C.ATK_R*0.55*reach), ay = p.y + p.h/2;
  for (var i = 0; i < S.enemies.length; i++){
    var e = S.enemies[i]; if (e.dead || e.roomHide) continue;
    var ex = e.x + e.w/2, ey = e.y + e.h/2;
    if (Math.abs(ex - ax) < C.ATK_R*0.75*reach && Math.abs(ey - ay) < 18 &&
        (ex - (p.x + p.w/2)) * p.facing > -4){
      if ((e.tough || 1) > 1 && !e.hurt){ e.hurt = true; e.hitT = 0.25; e.x -= p.facing * -10;
        S.hitStop = Math.max(S.hitStop, 0.04); p.events.push('clank'); continue; }
      e.dead = true; e.hitT = 0.6; e.vy = -90;
      S.hitStop = Math.max(S.hitStop, 0.06); S.shake = Math.max(S.shake, 3);
      dropLootFor(S, e, e.x + e.w/2, e.y + e.h/2, 'e');
      wearGear(S, 'weapon');
      p.events.push('kill:' + e.id);
    }
  }
  for (var fj = 0; fj < S.fliers.length; fj++){
    var fl = S.fliers[fj]; if (fl.roomHide) continue;
    var fx = fl.x + fl.w/2, fy = fl.y + fl.h/2;
    if (Math.abs(fx - ax) < C.ATK_R*0.8 && Math.abs(fy - ay) < 20 &&
        (fx - (p.x + p.w/2)) * p.facing > -4){
      S.hitStop = Math.max(S.hitStop, 0.06);
      dropLootFor(S, fl, fx, fy, 'f');
      p.events.push('kill:f' + fl.id + ':' + Math.round(fx) + ':' + Math.round(fy));
      S.fliers.splice(fj, 1); fj--;
    }
  }
  return true;
}
