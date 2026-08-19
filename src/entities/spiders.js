import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { solidTile } from '../core/map.js';
import { damage } from '../core/player.js';
import { dropLootFor } from './loot.js';

export function mkSpiders(){
  var LV = runtime.LV;
  return (LV.spiders || []).map(function(a, i){
    return { id:i, hx:a[0]*T + 8, hy:(a[1]+1)*T, x:a[0]*T + 8, y:(a[1]+1)*T,
             kind: a[2] !== undefined ? a[2] : (i % 3),
             len:0, state:'wait', t: 1 + i*0.6, dir: i%2 ? -1 : 1,
             dead:false, hitT:0, ph:i*1.4, vy:0 };
  });
}

function anchorRow(sp){
  return Math.floor((sp.hy - 1) / T);
}

function ceilingGone(sp){
  return !solidTile(Math.floor(sp.hx / T), anchorRow(sp));
}

function webHitsPt(sp, x, y, r){
  if (sp.len < 4) return false;
  if (sp.state !== 'drop' && sp.state !== 'up') return false;
  var y0 = Math.min(sp.hy, sp.y), y1 = Math.max(sp.hy, sp.y);
  return Math.abs(x - sp.hx) < r && y >= y0 - r && y <= y1 + r;
}

function atkHitsWeb(sp, p){
  if (sp.len < 4) return false;
  if (sp.state !== 'drop' && sp.state !== 'up') return false;
  var ax0 = p.x + p.w / 2, ay = p.y + p.h / 2;
  var ax1 = ax0 + p.facing * C.ATK_R;
  var y0 = Math.min(sp.hy, sp.y), y1 = Math.max(sp.hy, sp.y);
  if (ay < y0 - 8 || ay > y1 + 8) return false;
  var lo = Math.min(ax0, ax1) - 6, hi = Math.max(ax0, ax1) + 6;
  return sp.hx >= lo && sp.hx <= hi;
}

function startFall(S, sp, why){
  if (sp.dead || sp.state === 'fall' || sp.state === 'flee') return;
  sp.state = 'fall';
  sp.vy = 30;
  sp.len = 0;
  S.p.events.push(why === 'web' ? 'webcut' : 'spiderfall');
}

function killSpider(S, sp){
  if (sp.dead) return;
  sp.dead = true; sp.hitT = 0.5;
  dropLootFor(S, sp, sp.x, sp.y, 'sp');
  S.p.events.push('kill:s' + sp.id);
}

function stepFall(S, sp, dt){
  sp.vy += C.GRAV * dt;
  if (sp.vy > C.MAXFALL) sp.vy = C.MAXFALL;
  var ny = sp.y + sp.vy * dt;
  var c = Math.floor(sp.x / T);
  var r = Math.floor((ny + 4) / T);
  if (solidTile(c, r)){
    sp.y = r * T - 3;
    sp.vy = 0;
    sp.state = 'flee';
    sp.dir = ((S.p.x + S.p.w / 2) < sp.x) ? 1 : -1;
    sp.t = 2.8;
    S.p.events.push('spiderflee');
  } else {
    sp.y = ny;
  }
}

function stepFlee(S, sp, dt){
  var nx = sp.x + sp.dir * 90 * dt;
  var fc = Math.floor(nx / T);
  var fr = Math.floor((sp.y + 4) / T);
  var wr = Math.floor(sp.y / T);
  if (!solidTile(fc, fr) || solidTile(fc, wr)){
    if (solidTile(fc, wr)){
      sp.dir = -sp.dir;
    } else {
      sp.x = nx;
      sp.state = 'fall';
      sp.vy = 20;
      return;
    }
  } else {
    sp.x = nx;
  }
  sp.t -= dt;
  if (sp.t <= 0 || sp.x < runtime.originC * T + 8 || sp.x > (runtime.originC + runtime.MAP_W) * T - 8){
    sp.dead = true;
    sp.hitT = 0.2;
  }
}

export function stepSpiders(S, dt){
  var p = S.p, MAP_H = runtime.MAP_H;
  for (var i = 0; i < S.spiders.length; i++){
    var sp = S.spiders[i];
    if (sp.roomHide) continue;
    if (sp.dead){ sp.hitT -= dt; continue; }

    if (sp.state !== 'fall' && sp.state !== 'flee' && ceilingGone(sp))
      startFall(S, sp, 'ceil');

    if (sp.state === 'fall'){
      stepFall(S, sp, dt);
    } else if (sp.state === 'flee'){
      stepFlee(S, sp, dt);
    } else if (sp.state === 'wait'){
      var dx = (p.x + p.w/2) - sp.hx;
      sp.t -= dt;
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
      var dx2 = (p.x + p.w/2) - sp.hx;
      sp.len += 92 * dt;
      var maxLen = 0;
      for (var r = Math.floor(sp.hy/T); r < runtime.originR + runtime.MAP_H; r++){
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
      if (sp.len >= maxLen - 7 || Math.abs(dx2) > 52){ sp.state = 'up'; }
    } else {
      sp.len -= 120 * dt;
      if (sp.len <= 0){ sp.len = 0; sp.state = 'wait'; sp.t = 1.6 + Math.random(); }
      sp.y = sp.hy + sp.len;
    }

    if (sp.state !== 'fall' && sp.state !== 'flee') sp.x = sp.hx;

    if (p.atkT > 0){
      if (Math.abs(sp.x - (p.x + p.w/2)) < C.ATK_R &&
          Math.abs(sp.y - (p.y + p.h/2)) < 20){
        killSpider(S, sp);
        continue;
      }
      if (atkHitsWeb(sp, p)){
        startFall(S, sp, 'web');
        continue;
      }
    }

    var hps = S.harpoons || [];
    for (var hi = 0; hi < hps.length; hi++){
      var b = hps[hi];
      if (b.stuck) continue;
      if (webHitsPt(sp, b.x, b.y, 5)){
        startFall(S, sp, 'web');
        b.stuck = true;
        break;
      }
    }
  }
}
