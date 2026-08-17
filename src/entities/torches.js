import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { rectFree, tileAt, isWaterV } from '../core/map.js';
import { inDark } from './dark.js';
import { dropLoot } from './loot.js';
import { tryChest } from './chests.js';
import { giveGear } from './gear.js';
import { attack } from './enemies.js';
import { findById } from './ids.js';
import { fireHarpoon, tryHarpoonPickup } from './harpoons.js';

export function mkTorches(){
  var LV = runtime.LV;
  return (LV.torches || []).map(function(a, i){
    return { id:i, x:a[0]*T+8, y:(a[1]+1)*T, vx:0, vy:0, held:false, ground:true, ph:i*1.7,
             ang:0, spin:0, wasAir:false, thrown:false, lit:true,
             hx:a[0]*T+8, hy:(a[1]+1)*T };
  });
}
export function stepTorches(S, dt){
  var p = S.p;
  for (var i = 0; i < S.torches.length; i++){
    var t = S.torches[i];
    if (t.held){
      // атач случился на нижней точке приседа — от неё и доводим руку до обычной высоты
      var reachK = p.pickT > 0 ? Math.min(1, p.pickT / (C.PICK_T * (1 - PICK_APEX))) : 0;
      t.x = p.x + p.w/2 + p.facing*7; t.y = p.y + 15 + reachK*7; t.vx = 0; t.vy = 0;
      if (!t.lit){                                        // поджигаем от чужого огня
        for (var oi = 0; oi < S.torches.length; oi++){
          var o = S.torches[oi];
          if (oi === i || !o.lit) continue;
          if (Math.abs(o.x - t.x) < 26 && Math.abs(o.y - t.y) < 26){
            t.lit = true; S.p.events.push('ignite'); break;
          }
        }
      }
      t.ang = -Math.PI/2; t.spin = 0; t.wasAir = false; continue;
    }
    if (t.ground && Math.abs(t.vx) < 1){ t.vx = 0; continue; }
    t.vy += 760*dt; if (t.vy > 320) t.vy = 320;
    t.x += t.vx*dt;
    if (!rectFree(t.x-2, t.y-7, 5, 7)){ t.x -= t.vx*dt; t.vx *= -0.28; }
    t.y += t.vy*dt; t.ground = false;
    if (!rectFree(t.x-2, t.y-7, 5, 7)){
      if (t.vy > 0){ t.y = Math.floor(t.y/T)*T; t.ground = true; t.vx *= 0.45; }
      else t.y = Math.floor((t.y-7)/T)*T + T + 7;
      t.vy = 0;
    }
    if (t.lit && isWaterV(tileAt(Math.floor(t.x/T), Math.floor((t.y - 4)/T)))){
      t.lit = false; S.p.events.push('snuff:' + t.id);    // в воде гаснет — остаётся палка
    }
    if (t.ground){
      t.vx *= 0.86; if (Math.abs(t.vx) < 4) t.vx = 0;
      t.spin = 0;
      t.ang += (0 - t.ang) * Math.min(1, dt*10);       // лёг горизонтально
      if (t.wasAir){
        t.wasAir = false; S.p.events.push('torchland:' + t.id);
        if (t.thrown && inDark(S, t.x, t.y - 6)){ t.lit = false; t.thrown = false; S.p.events.push('snuff:' + t.id); }
      }
    } else {
      t.wasAir = true;
      t.ang += t.spin * dt;
      if (Math.abs(t.vx) > 20 || Math.abs(t.vy) > 20) S.p.events.push('torchtrail:' + t.id);
    }
    if (Math.abs(t.vx) > 45 || Math.abs(t.vy) > 45){        // летящий факел жжёт врагов
      for (var ei = 0; ei < S.enemies.length; ei++){
        var en = S.enemies[ei];
        if (en.dead) continue;
        if (t.x > en.x - 4 && t.x < en.x + en.w + 4 &&
            t.y > en.y - 2 && t.y - 15 < en.y + en.h){
          en.dead = true; en.hitT = 0.6;
          t.vx *= -0.3; t.vy = -60;
          S.hitStop = Math.max(S.hitStop, 0.06); S.shake = Math.max(S.shake, 3);
          p.events.push('burn:' + en.id + ':' + Math.round(t.x) + ':' + Math.round(t.y));
        }
      }
      for (var si2 = 0; si2 < S.spiders.length; si2++){
        var spg = S.spiders[si2];
        if (spg.dead) continue;
        if (t.x > spg.x - 8 && t.x < spg.x + 8 && t.y > spg.y - 10 && t.y - 15 < spg.y + 6){
          spg.dead = true; spg.hitT = 0.5;
          dropLoot(S, spg.x, spg.y, 'sp');
          t.vy = -50;
          p.events.push('burn:s' + spg.id + ':' + Math.round(t.x) + ':' + Math.round(t.y));
        }
      }
      for (var fi2 = 0; fi2 < S.fliers.length; fi2++){
        var fl2 = S.fliers[fi2];
        if (fl2.dead) continue;
        if (t.x > fl2.x - 4 && t.x < fl2.x + fl2.w + 4 &&
            t.y > fl2.y - 2 && t.y - 15 < fl2.y + fl2.h){
          fl2.dead = true; fl2.hitT = 0.6; t.vy = -60;
          S.hitStop = Math.max(S.hitStop, 0.06);
          p.events.push('burn:f' + fl2.id);
        }
      }
    }
  }
}
export function dropTorch(S, hard){
  var p = S.p; if (p.torch < 0) return;
  var t = findById(S.torches, p.torch);
  if (!t){ p.torch = -1; return; }
  t.held = false; t.ground = false;
  t.x = p.x + p.w/2 + p.facing*(hard?7:3); t.y = p.y + 15;
  t.vx = hard ? p.facing*C.THROW_X : p.facing*25;
  t.vy = hard ? C.THROW_Y : -30;
  t.spin = p.facing * (hard ? 15 : 7); t.wasAir = true; t.thrown = hard;
  p.torch = -1; p.events.push(hard ? 'throw' : 'droptorch');
}
var PICK_APEX = 0.45;     // доля анимации до нижней точки приседа — как в render/poses.js:pickPose
var THROW_REL = 0.4;      // доля анимации до броска — как в render/poses.js:throwPose
/* --- довести отложенный подбор/бросок до нужного кадра анимации --- */
export function resolvePickup(S){
  var p = S.p, pend = p.pickPend;
  if (pend && p.pickT <= C.PICK_T * (1 - PICK_APEX)){
    p.pickPend = null;
    if (pend.kind === 'torch'){
      var t = findById(S.torches, pend.id);
      if (t && !t.held){ t.held = true; p.torch = t.id; p.events.push(t.lit ? 'take' : 'takedark'); }
    } else if (pend.kind === 'stick'){
      if (p.torch >= 0) dropTorch(S, false);
      if (!S.pick.stick.taken){ S.pick.stick.taken = true; giveGear(S, 'stick'); p.events.push('getstick'); }
    }
  }
  if (p.throwPend && p.throwT <= C.THROW_T * (1 - THROW_REL)){
    p.throwPend = false;
    dropTorch(S, true);
  }
}
export function tryAction(S){
  var p = S.p;
  if (tryChest(S)) return true;                          // сундук открываем не выпуская факел
  if (p.torch >= 0){
    if (p.throwT <= 0){ p.throwT = C.THROW_T; p.throwPend = true; }
    return true;
  }
  if (p.state === 'snare' && p.stick) return attack(S);
  if (p.harpoonGun && p.gear.harpoon){
    if (tryHarpoonPickup(S)) return true;
    if (p.inWater && fireHarpoon(S)) return true;
  }
  var pk = S.pick;
  if (!pk.stick.taken && p.state === 'normal' && p.pickT <= 0 &&
      Math.abs(pk.stick.x - (p.x + p.w/2)) < C.ACT_R && Math.abs(pk.stick.y - (p.y + p.h/2)) < 22){
    p.pickT = C.PICK_T; p.pickPend = { kind: 'stick' };
    return true;
  }
  if (p.state !== 'normal' && p.state !== 'ladder') return false;
  if (p.stick && p.stance === 0){                         // враг в досягаемости — бьём
    var ax0 = p.x + p.w/2 + p.facing*(C.ATK_R*0.55), ay0 = p.y + p.h/2, hit = false, q;
    for (var qi = 0; qi < S.enemies.length; qi++){
      q = S.enemies[qi]; if (q.dead) continue;
      if (Math.abs(q.x + q.w/2 - ax0) < C.ATK_R*0.9 && Math.abs(q.y + q.h/2 - ay0) < 22) hit = true;
    }
    for (var fi3 = 0; fi3 < S.fliers.length; fi3++){
      q = S.fliers[fi3]; if (q.dead) continue;
      if (Math.abs(q.x + q.w/2 - ax0) < C.ATK_R*0.9 && Math.abs(q.y + q.h/2 - ay0) < 24) hit = true;
    }
    if (hit) return attack(S);
  }
  if (p.pickT > 0) return p.stick ? attack(S) : false;   // уже приседаем за предметом
  var best = -1, bd = C.ACT_R*C.ACT_R, cx = p.x + p.w/2, cy = p.y + p.h/2;
  for (var i = 0; i < S.torches.length; i++){
    var t = S.torches[i]; if (t.held) continue;
    var dx = t.x - cx, dy = (t.y - 6) - cy, d = dx*dx + dy*dy;
    if (d < bd){ bd = d; best = i; }
  }
  if (best < 0) return p.stick ? attack(S) : false;    // рядом нет факела — бьём палкой
  p.pickT = C.PICK_T; p.pickPend = { kind: 'torch', id: S.torches[best].id };
  return true;
}
