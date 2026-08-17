import { T } from '../core/constants.js';
import { rectFree } from '../core/map.js';

export function dropLoot(S, x, y, tag){
  var r = Math.random();
  var kind = r < 0.12 ? 'key' : (r < 0.34 ? 'gem' : (r < 0.5 ? 'shroom' : 'coin'));
  S.loot.push({ x:x, y:y, vx:(Math.random()-0.5)*50, vy:-110, kind:kind, t:12, got:false });
  S.p.events.push('loot:' + kind);
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
    if (Math.abs(l.x - (p.x + p.w/2)) < 12 && Math.abs(l.y - (p.y + p.h/2)) < 14){
      if (l.kind === 'key') S.keys++;
      else if (l.kind === 'shroom'){ if (S.hp < 3) S.hp++; S.bag.shroom++; }
      else S.bag[l.kind]++;
      S.loot.splice(i, 1);
      p.events.push('pickloot:' + l.kind);
    }
  }
}
