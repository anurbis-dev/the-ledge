import { C } from '../core/constants.js';
import { rectFree } from '../core/map.js';
import { dropLootFor } from './loot.js';
import { allocId } from './ids.js';
import { wearGear } from './gear.js';

/* стрела лука: первые ARROW_FLAT px летит строго прямо, дальше начинает
   действовать гравитация — затухающая дуга вниз. Втыкается в землю/стену/цель
   под углом полёта — как гарпун. Выстрел тратит стрелу из инвентаря (S.bag.arrow)
   и отдельно изнашивает durability лука (wearGear) — кончились стрелы не значит сломался лук. */
export function mkArrows(){ return []; }

export function stepArrows(S, dt){
  var p = S.p;
  for (var i = 0; i < S.arrows.length; i++){
    var b = S.arrows[i];
    if (b.stuck) continue;
    b.travel = (b.travel || 0) + Math.abs(b.vx) * dt;
    if (b.travel > C.ARROW_FLAT) b.vy += C.ARROW_GRAV * dt;
    var nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    b.ang = Math.atan2(b.vy, b.vx);
    if (!rectFree(nx - 2, ny - 1, 4, 2)){
      b.x = nx; b.y = ny; b.stuck = true;
      p.events.push('arrow:stick:' + Math.round(b.x) + ':' + Math.round(b.y));
      continue;
    }
    b.x = nx; b.y = ny;
    var hit = false;
    for (var ei = 0; ei < S.enemies.length && !hit; ei++){
      var en = S.enemies[ei];
      if (en.dead) continue;
      if (b.x > en.x - 2 && b.x < en.x + en.w + 2 && b.y > en.y - 2 && b.y < en.y + en.h + 2){
        if ((en.tough || 1) > 1 && !en.hurt){
          en.hurt = true; en.hitT = 0.25; en.x += (b.vx > 0 ? 10 : -10);
          S.hitStop = Math.max(S.hitStop, 0.04); p.events.push('clank');
        } else {
          en.dead = true; en.hitT = 0.6; en.vy = -90;
          S.hitStop = Math.max(S.hitStop, 0.06); S.shake = Math.max(S.shake, 3);
          dropLootFor(S, en, en.x + en.w/2, en.y + en.h/2, 'e');
          p.events.push('kill:' + en.id);
        }
        hit = true;
      }
    }
    for (var si = 0; si < S.spiders.length && !hit; si++){
      var spg = S.spiders[si];
      if (spg.dead) continue;
      if (b.x > spg.x - 8 && b.x < spg.x + 8 && b.y > spg.y - 10 && b.y < spg.y + 6){
        spg.dead = true; spg.hitT = 0.5;
        dropLootFor(S, spg, spg.x, spg.y, 'sp');
        p.events.push('kill:s' + spg.id);
        hit = true;
      }
    }
    for (var fi = 0; fi < S.fliers.length && !hit; fi++){
      var fl = S.fliers[fi];
      if (b.x > fl.x - 4 && b.x < fl.x + fl.w + 4 && b.y > fl.y - 2 && b.y < fl.y + fl.h + 2){
        var fcx = fl.x + fl.w/2, fcy = fl.y + fl.h/2;
        S.hitStop = Math.max(S.hitStop, 0.06);
        dropLootFor(S, fl, fcx, fcy, 'f');
        p.events.push('kill:f' + fl.id + ':' + Math.round(fcx) + ':' + Math.round(fcy));
        S.fliers.splice(fi, 1);
        hit = true;
      }
    }
    if (hit) b.stuck = true;
  }
}

export function fireArrow(S){
  var p = S.p, g = p.gear.weapon;
  if (!g || g.type !== 'bow') return false;
  if (!(S.bag && S.bag.arrow > 0)) return false;          // нет стрел в инвентаре — не выстрелить
  if (p.atkCd > 0 || p.bowT > 0) return false;
  if (p.stance > 0) return false;
  if (p.state !== 'normal') return false;
  if (!p.onGround || Math.abs(p.vx) > 8) return false;   // только из статики, не на ходу и не в прыжке
  var spd = C.ARROW_V * (0.92 + Math.random()*0.16);     // у каждой стрелы своя скорость и лёгкий наклон
  var vy0 = (Math.random() - 0.5) * 26;
  S.arrows.push({ id: allocId(S.arrows), x: p.x + p.w/2 + p.facing*10, y: p.y + 9,
                  vx: p.facing * spd, vy: vy0, ang: 0, travel: 0, stuck: false });
  S.bag.arrow--;
  wearGear(S, 'weapon', 1);
  p.atkCd = C.BOW_CD; p.bowT = C.BOW_ANIM_T;
  p.events.push('arrow:shoot');
  return true;
}

/* стрела торчит почти горизонтально — в стене; наклонена вниз — в полу/земле */
function arrowInWall(b){ return Math.abs(Math.sin(b.ang || 0)) < 0.5; }

export function tryArrowPickup(S){
  var p = S.p;
  if (p.pickT > 0) return false;
  var cx = p.x + p.w/2, cy = p.y + p.h/2;
  var best = -1, bd = (C.ACT_R + 6) * (C.ACT_R + 6);
  for (var i = 0; i < S.arrows.length; i++){
    var b = S.arrows[i];
    if (!b.stuck) continue;
    var dx = b.x - cx, dy = b.y - cy;
    if (Math.abs(dx) < C.ACT_R + 6 && Math.abs(dy) < 26){
      // стрела в стене — разворачиваемся к ней (ниже); на полу за спиной так не тянемся
      if (!arrowInWall(b) && dx * p.facing < -2) continue;
      var d = dx*dx + dy*dy;
      if (d < bd){ bd = d; best = i; }
    }
  }
  if (best < 0) return false;
  var arrow = S.arrows[best], wall = arrowInWall(arrow);
  if (wall){
    var side = arrow.x >= cx ? 1 : -1;
    if (side !== p.facing) p.facing = side;    // спиной к стреле в стене — развернуться к ней
  }
  p.pickT = C.PICK_T; p.pickPend = { kind: 'arrow', id: arrow.id }; p.pickWall = wall;
  return true;
}
