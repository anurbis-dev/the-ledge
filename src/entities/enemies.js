import { C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { rectFree, solidAt } from '../core/map.js';
import { damage, isInvuln, slopeUnder } from '../core/player.js';
import {
  getAnimBox, legacyObjectKindFromSprite, resolveEntityObjectKind
} from '../core/object-anchors.js';
import { dropLootFor } from './loot.js';
import { GEAR, wearGear } from './gear.js';

export function enemyBox(kind){
  return getAnimBox('enemy' + (kind | 0), 'idle');
}

export function applyEnemyBox(e){
  var b, feet, restFeet, ok;
  if (!e) return;
  ok = resolveEntityObjectKind(e) || ('enemy' + (e.kind | 0));
  b = getAnimBox(ok, 'idle');
  if (e.w === b.w && e.h === b.h) return;
  feet = e.y + e.h;
  restFeet = e.baseY !== undefined ? e.baseY + e.h : feet;
  e.w = b.w;
  e.h = b.h;
  e.y = feet - e.h;
  if (e.baseY !== undefined) e.baseY = restFeet - e.h;
}

var AI_DEFAULT_SIGHT = 90;
var AI_DEFAULT_HEAR = 50;
var AI_CHASE_MULT = 1.6;

/** Множитель базовой скорости (a[4] в LV.enemies) по kind. persist.js/editor.js
 * делят на него при записи назад — иначе каждый save/bake умножал бы v ещё раз. */
export function enemySpeedMult(kind){
  return kind === 1 ? 1.4 : (kind === 2 ? 0.7 : 1);
}

export function mkEnemies(){
  var LV = runtime.LV;
  return (LV.enemies || []).map(function(a, i){
    var kind = a[5] !== undefined ? a[5] : (i % 3);
    var spriteId = typeof a[8] === 'string' ? a[8] : null;
    var objectKind = typeof a[9] === 'string' ? a[9] : null;
    var ok = objectKind || legacyObjectKindFromSprite(spriteId) || ('enemy' + (kind | 0));
    var box = getAnimBox(ok, 'idle');
    var loot = Array.isArray(a[6])
      ? a[6].map(function(e){ return { kind: e[0], qty: Math.max(1, e[1] | 0 || 1) }; })
      : [];
    var v = a[4] * enemySpeedMult(kind);
    var aiCfg = (a[10] && typeof a[10] === 'object') ? a[10] : null;
    var points = (aiCfg && Array.isArray(aiCfg.pts) && aiCfg.pts.length >= 2)
      ? aiCfg.pts.slice() : [a[2], a[3]];
    var pointPause = (aiCfg && Array.isArray(aiCfg.pause) && aiCfg.pause.length === points.length)
      ? aiCfg.pause.slice() : points.map(function(){ return 0; });
    return { id:i, x:a[0], y:a[1]-box.h, w:box.w, h:box.h,
             x0: Math.min.apply(null, points), x1: Math.max.apply(null, points),
             v: v, kind: kind, tough: kind === 2 ? 2 : 1,
             dir: i%2 ? -1 : 1, dead:false, hitT:0, ph:i*1.3, vy:0,
             loot: loot, random: !!a[7], spriteId: spriteId, objectKind: objectKind,
             points: points, pointPause: pointPause,
             canChase: aiCfg ? !!aiCfg.canChase : false,
             chaseV: (aiCfg && aiCfg.chaseV) || v * AI_CHASE_MULT,
             sightFwd: (aiCfg && aiCfg.sightFwd) || AI_DEFAULT_SIGHT,
             hearBack: (aiCfg && aiCfg.hearBack) || AI_DEFAULT_HEAR,
             aiState: 'patrol', ptIdx: 0, ptDir: 1, pauseT: 0 };
  });
}
/** Пересчитывает x0/x1 (мин/макс points) и сбрасывает runtime AI-состояние —
 * вызывать после любой правки e.points/e.pointPause (редактор, гизмо). */
export function resyncEnemyRuntime(e){
  e.x0 = Math.min.apply(null, e.points);
  e.x1 = Math.max.apply(null, e.points);
  e.aiState = 'patrol'; e.ptIdx = 0; e.ptDir = 1; e.pauseT = 0;
}
function nearestPointIdx(e){
  var best = 0, bd = Infinity, i, d;
  for (i = 0; i < e.points.length; i++){
    d = Math.abs(e.points[i] - e.x);
    if (d < bd){ bd = d; best = i; }
  }
  return best;
}
function advancePoint(e){
  e.ptIdx += e.ptDir;
  if (e.ptIdx >= e.points.length){ e.ptIdx = e.points.length - 2; e.ptDir = -1; }
  else if (e.ptIdx < 0){ e.ptIdx = 1; e.ptDir = 1; }
  e.aiState = 'patrol';
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
    if (e.canChase && e.aiState !== 'chase'){        // проверка обнаружения
      var ddx = (p.x + p.w/2) - (e.x + e.w/2);
      var vgate = Math.abs((p.y + p.h) - (e.y + e.h)) < e.h + 8;
      var forward = ddx * e.dir > 0;
      if (vgate && ((forward && Math.abs(ddx) <= e.sightFwd) ||
                    (!forward && Math.abs(ddx) <= e.hearBack))){
        e.aiState = 'chase';
      }
    }
    if (e.aiState === 'pause'){
      e.pauseT -= dt;
      if (e.pauseT <= 0) advancePoint(e);
    } else {
      var targetX = e.aiState === 'chase' ? (p.x + p.w/2 - e.w/2) : e.points[e.ptIdx];
      var spd = e.aiState === 'chase' ? e.chaseV : e.v;
      var dxToTarget = targetX - e.x;
      e.dir = dxToTarget >= 0 ? 1 : -1;
      var moveAmt = spd * dt;
      if (e.aiState !== 'chase' && Math.abs(dxToTarget) <= moveAmt) e.x = targetX;
      else e.x += e.dir * moveAmt;
      var blocked = !rectFree(e.x, e.y, e.w, e.h);
      var atEdge = !blocked && e.vy === 0 && !solidAt(e.x + e.w/2, e.y + e.h + 3);
      if (blocked || atEdge) e.x = ex0;              // стена/обрыв — стоп
      if (e.aiState === 'chase'){
        var loX = Math.min.apply(null, e.points), hiX = Math.max.apply(null, e.points);
        var stillDx = (p.x + p.w/2) - (e.x + e.w/2);
        if (blocked || atEdge || e.x <= loX || e.x >= hiX || Math.abs(stillDx) > e.sightFwd){
          e.x = Math.max(loX, Math.min(hiX, e.x));
          e.aiState = 'patrol';
          e.ptIdx = nearestPointIdx(e);
        }
      } else if (blocked || atEdge || e.x === targetX){
        e.aiState = 'pause';
        e.pauseT = e.pointPause[e.ptIdx] || 0;
      }
    }
    if (e.vy === 0){                                 // идёт по склону
      var eb = { x:e.x, y:e.y, w:e.w, h:e.h };
      var esl = slopeUnder(eb);
      if (esl !== null){ e.y = esl - e.h; e.baseY = e.y; }
    }
    if (e.baseY !== undefined && e.vy === 0) e.baseY = e.y;
    if (!isInvuln() && p.hurtCd <= 0 && p.state !== 'stun' &&
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
  if (p.state !== 'normal' && p.state !== 'ladder' && p.state !== 'rope' && p.state !== 'snare') return false;
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
