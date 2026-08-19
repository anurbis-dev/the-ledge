import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { rectFree, solidTile } from '../core/map.js';
import { damage } from '../core/player.js';
import { wearGear } from './gear.js';

export function mkFliers(){
  var LV = runtime.LV;
  return (LV.fliers || []).map(function(a, i){
    var kind = a[5] !== undefined ? a[5] : (i % 4 === 3 ? 3 : (i % 3));
    var loot = Array.isArray(a[6])
      ? a[6].map(function(e){ return { kind: e[0], qty: Math.max(1, e[1] | 0 || 1) }; })
      : [];
    return { id:i, x:a[0], y:a[1], w: kind === 2 ? 16 : 13, h: kind === 2 ? 11 : 9,
             x0:a[2], x1:a[3], v: a[4] * (kind === 1 ? 1.35 : (kind === 2 ? 0.8 : 1)),
             kind: kind, dir: i%2 ? -1 : 1, ph:i*1.9,
             cd: (kind === 1 ? 0.9 : 1.4) + i*0.3, flap:0,
             loot: loot, random: !!a[7] };
  });
}
export function stepFliers(S, dt){
  var p = S.p, MAP_H = runtime.MAP_H;
  for (var i = 0; i < S.fliers.length; i++){
    var f = S.fliers[i]; if (f.roomHide) continue;
    f.flap += dt;
    f.x += f.v * f.dir * dt;
    if (f.x < f.x0){ f.x = f.x0; f.dir = 1; }
    if (f.x > f.x1){ f.x = f.x1; f.dir = -1; }
    if (f.yLow === undefined){ f.yLow = f.y - 34; f.yHigh = f.y + 26; f.tgt = f.y; f.hCd = 0; }
    f.hCd -= dt;
    if (f.hCd <= 0){                                  // время от времени меняет эшелон
      f.tgt = f.yLow + Math.random()*(f.yHigh - f.yLow);
      f.hCd = 1.8 + Math.random()*2.2;
    }
    // не снижаться к самой земле: держим просвет
    var minGap = 34;
    var gy = null;
    for (var gr = Math.floor((f.y + f.h)/T); gr < runtime.originR + runtime.MAP_H; gr++)
      if (solidTile(Math.floor((f.x + f.w/2)/T), gr)){ gy = gr*T; break; }
    if (gy !== null && f.tgt > gy - minGap) f.tgt = gy - minGap;
    if (f.tgt < 2*T) f.tgt = 2*T;
    var wantY = f.tgt + Math.sin(f.flap*2.2 + f.ph) * 5;
    var stepY = (wantY - f.y);
    stepY = Math.max(-26*dt, Math.min(26*dt, stepY));
    if (rectFree(f.x, f.y + stepY, f.w, f.h)) f.y += stepY;
    else { f.tgt = f.y; f.hCd = 0.6; }
    if (gy !== null && gy - (f.y + f.h) < 26){          // держим минимальный просвет над землёй
      var lift = 26 - (gy - (f.y + f.h));
      while (lift > 0 && !rectFree(f.x, f.y - lift, f.w, f.h)) lift -= 2;
      if (lift > 0){ f.y -= lift; f.tgt = Math.min(f.tgt, f.y); }
    }
    if (f.kind === 3){                                // пикировщик: бросается на героиню
      f.cd -= dt;
      f.div = f.div || 0;
      if (f.div > 0){
        f.div -= dt;
        var dxp = (p.x + p.w/2) - (f.x + f.w/2), dyp = (p.y + 8) - (f.y + f.h/2);
        var ln = Math.sqrt(dxp*dxp + dyp*dyp) || 1;
        f.x += dxp/ln * 150 * dt; f.y += dyp/ln * 150 * dt;
        if (p.hurtCd <= 0 && p.state !== 'stun' &&
            Math.abs(dxp) < 12 && Math.abs(dyp) < 12){
          p.hurtCd = C.HURT_CD;
          if (p.helmet){ p.events.push('clank'); wearGear(S, 'helmet'); }
          else { damage(S, 1, 0.28); p.events.push('peck'); }
          f.div = 0; f.cd = 2.4; f.tgt = f.y - 50;
        }
        if (f.div <= 0){ f.cd = 2.2; f.tgt = f.y - 40; }
        continue;
      }
      if (f.cd <= 0 && Math.abs((p.x + p.w/2) - (f.x + f.w/2)) < 90 && p.y > f.y){
        f.div = 1.1; p.events.push('dive');
      }
    }
    // бомбит, когда героиня примерно под ним
    f.cd -= dt;
    if (f.cd <= 0){
      var over = Math.abs((p.x + p.w/2) - (f.x + f.w/2)) < 26 && p.y > f.y;
      if (over){
        S.drops.push({ x: f.x + f.w/2, y: f.y + f.h, vy: 40, live: true });
        f.cd = 1.6 + Math.random()*0.8;
        p.events.push('bomb');
      } else f.cd = 0.3;
    }
    if (p.hurtCd <= 0 && p.state !== 'stun' &&
        p.x + p.w > f.x && p.x < f.x + f.w && p.y + p.h > f.y && p.y < f.y + f.h){
      p.hurtCd = C.HURT_CD; damage(S, 1, 0.3);
      p.vy = -120; p.onGround = false;
    }
  }
}
export function stepDrops(S, dt){
  var p = S.p, MAP_H = runtime.MAP_H;
  for (var i = S.drops.length - 1; i >= 0; i--){
    var d = S.drops[i];
    d.vy += 520*dt; if (d.vy > 300) d.vy = 300;
    d.y += d.vy * dt;
    if (!rectFree(d.x - 1, d.y - 2, 3, 3)){ S.drops.splice(i, 1); p.events.push('splat'); continue; }
    if (d.y > (runtime.originR + runtime.MAP_H)*T){ S.drops.splice(i, 1); continue; }
    if (p.hurtCd <= 0 && p.state !== 'stun' &&
        d.x > p.x && d.x < p.x + p.w && d.y > p.y && d.y < p.y + p.h){
      S.drops.splice(i, 1);
      if (p.helmet){ p.events.push('clank'); wearGear(S, 'helmet'); continue; }
      p.hurtCd = C.HURT_CD; damage(S, 1, 0.28);
      p.events.push('hitdrop');
    }
  }
}
