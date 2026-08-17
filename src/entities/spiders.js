import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { solidTile } from '../core/map.js';
import { damage } from '../core/player.js';
import { dropLoot } from './loot.js';

export function mkSpiders(){
  var LV = runtime.LV;
  return (LV.spiders || []).map(function(a, i){
    return { id:i, hx:a[0]*T + 8, hy:(a[1]+1)*T, x:a[0]*T + 8, y:(a[1]+1)*T,
             kind: a[2] !== undefined ? a[2] : (i % 3),
             len:0, state:'wait', t: 1 + i*0.6, dir: i%2 ? -1 : 1,
             dead:false, hitT:0, ph:i*1.4 };
  });
}
export function stepSpiders(S, dt){
  var p = S.p, MAP_H = runtime.MAP_H;
  for (var i = 0; i < S.spiders.length; i++){
    var sp = S.spiders[i];
    if (sp.dead){ sp.hitT -= dt; continue; }
    var dx = (p.x + p.w/2) - sp.hx;
    if (sp.state === 'wait'){
      sp.t -= dt;
      // изредка переползает по потолку
      if (sp.t < 0.6 && Math.abs(dx) > 40){
        var nhx = sp.hx + sp.dir * 22 * dt;
        if (solidTile(Math.floor(nhx/T), Math.floor((sp.hy - T - 2)/T))) sp.hx = nhx;
        else sp.dir = -sp.dir;
        sp.x = sp.hx;
      }
      if (sp.t <= 0 && Math.abs(dx) < 34 && p.y > sp.hy - 6){
        sp.state = 'drop'; sp.t = 0;
      } else if (sp.t <= -2){ sp.t = 1.4 + Math.random(); }
    } else if (sp.state === 'drop'){
      sp.len += 92 * dt;
      var maxLen = 0;
      for (var r = Math.floor(sp.hy/T); r < MAP_H; r++){
        if (solidTile(Math.floor(sp.hx/T), r)) break;
        maxLen = (r + 1)*T - sp.hy;
      }
      if (sp.len > maxLen - 6) sp.len = maxLen - 6;
      sp.y = sp.hy + sp.len;
      if (p.hurtCd <= 0 && p.state !== 'stun' &&
          Math.abs((p.x + p.w/2) - sp.hx) < 10 &&
          Math.abs((p.y + p.h/2) - sp.y) < 12){
        p.hurtCd = C.HURT_CD; damage(S, 1, 0.25);
        p.events.push('spiderbite');
        sp.state = 'up';
      }
      if (sp.len >= maxLen - 7 || Math.abs(dx) > 52){ sp.state = 'up'; }
    } else {
      sp.len -= 120 * dt;
      if (sp.len <= 0){ sp.len = 0; sp.state = 'wait'; sp.t = 1.6 + Math.random(); }
      sp.y = sp.hy + sp.len;
    }
    sp.x = sp.hx;
    // палкой и прыжком сверху паучка можно сбить
    if (p.atkT > 0 && Math.abs(sp.x - (p.x + p.w/2)) < C.ATK_R &&
        Math.abs(sp.y - (p.y + p.h/2)) < 20){
      sp.dead = true; sp.hitT = 0.5;
      dropLoot(S, sp.x, sp.y, 'sp');
      p.events.push('kill:s' + sp.id);
    }
  }
}
