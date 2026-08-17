import { C } from '../core/constants.js';
import { rectFree } from '../core/map.js';
import { dropLoot } from './loot.js';
import { allocId } from './ids.js';

/* стрела гарпуна: летит по прямой, без гравитации, застревает в стене/цели */
export function mkHarpoons(){ return []; }

export function stepHarpoons(S, dt){
  var p = S.p;
  for (var i = 0; i < S.harpoons.length; i++){
    var b = S.harpoons[i];
    if (b.stuck) continue;
    b.x += b.vx * dt;
    if (!rectFree(b.x - 2, b.y - 1, 4, 2)){ b.stuck = true; continue; }
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
          dropLoot(S, en.x + en.w/2, en.y + en.h/2, 'e');
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
        dropLoot(S, spg.x, spg.y, 'sp');
        p.events.push('kill:s' + spg.id);
        hit = true;
      }
    }
    for (var fi = 0; fi < S.fliers.length && !hit; fi++){
      var fl = S.fliers[fi];
      if (fl.dead) continue;
      if (b.x > fl.x - 4 && b.x < fl.x + fl.w + 4 && b.y > fl.y - 2 && b.y < fl.y + fl.h + 2){
        fl.dead = true; fl.hitT = 0.6;
        S.hitStop = Math.max(S.hitStop, 0.06);
        dropLoot(S, fl.x + fl.w/2, fl.y + fl.h/2, 'f');
        p.events.push('kill:f' + fl.id);
        hit = true;
      }
    }
    if (hit) b.stuck = true;
  }
}

export function fireHarpoon(S){
  var p = S.p, g = p.gear.harpoon;
  if (!g || g.uses <= 0) return false;
  g.uses--;
  S.harpoons.push({ id: allocId(S.harpoons), x: p.x + p.w/2 + p.facing*8, y: p.y + p.h/2,
                     vx: p.facing * C.HARPOON_V, stuck: false });
  p.events.push('harpoon:shoot');
  return true;
}

export function tryHarpoonPickup(S){
  var p = S.p, g = p.gear.harpoon;
  if (!g) return false;
  var cx = p.x + p.w/2, cy = p.y + p.h/2;
  for (var i = 0; i < S.harpoons.length; i++){
    var b = S.harpoons[i];
    if (!b.stuck) continue;
    if (Math.abs(b.x - cx) < C.ACT_R && Math.abs(b.y - cy) < 22){
      S.harpoons.splice(i, 1);
      if (g.uses < g.max) g.uses++;
      p.events.push('harpoon:pick');
      return true;
    }
  }
  return false;
}
