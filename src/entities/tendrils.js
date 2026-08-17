import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { tileAt, isWetV, isWaterV, waterSurfaceY, rectFree } from '../core/map.js';
import { damage, resetPlayer } from '../core/player.js';
import { dropLoot } from './loot.js';
import { allocId } from './ids.js';

/* щупальца водорослей. kind 0 — жало, kind 1 — обвивает и тянет на дно.
   LV.tendrils: [col, floorRow, kind] — корень на верхней кромке пола. */

function attachY(x, y){
  var c = Math.floor(x / T), r = Math.floor((y - 1) / T);
  while (r < runtime.MAP_H && isWetV(tileAt(c, r))) r++;
  return r * T;
}

export function mkTendrils(){
  var LV = runtime.LV;
  return (LV.tendrils || []).map(function(a, i){
    var bx = a[0] * T + 8, by = a[1] * T;
    return mkOne(i, bx, by, a[2] !== undefined ? a[2] : (i % 2));
  });
}

function mkOne(id, bx, by, kind){
  by = attachY(bx, by);
  return {
    id: id, bx: bx, by: by, tx: bx, ty: by - 14,
    kind: kind || 0, len: 14, state: 'idle', t: 0.4 + id * 0.3,
    dead: false, hitT: 0, ph: id * 1.7, holding: false, mashX: 0
  };
}

export function mkTendrilAt(S, x, y, kind){
  S.tendrils.push(mkOne(allocId(S.tendrils), x, y, kind));
}

function maxReach(w){
  var c = Math.floor(w.bx / T), maxUp = 10;
  for (var r = Math.floor((w.by - 2) / T); r >= 0; r--){
    if (!isWetV(tileAt(c, r))) break;
    maxUp = w.by - r * T;
  }
  return Math.min(maxUp - 2, C.TEND_REACH);
}

function tipOk(x, y){
  return isWetV(tileAt(Math.floor(x / T), Math.floor(y / T)));
}

function aim(w, dx, dy, len){
  if (dy > -6) dy = -6;
  var ln = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = w.bx + dx / ln * len, ny = w.by + dy / ln * len;
  if (ny > w.by - 4){ ny = w.by - 4; }
  if (!tipOk(nx, ny)){
    nx = w.bx; ny = w.by - len;
    if (ny > w.by - 4) ny = w.by - 4;
  }
  w.tx = nx; w.ty = ny;
}

export function tendrilHits(w, x, y, r){
  var dx = w.tx - w.bx, dy = w.ty - w.by;
  var len2 = dx * dx + dy * dy || 1;
  var t = ((x - w.bx) * dx + (y - w.by) * dy) / len2;
  if (t < 0) t = 0; if (t > 1) t = 1;
  var px = w.bx + dx * t, py = w.by + dy * t;
  var ddx = x - px, ddy = y - py;
  return ddx * ddx + ddy * ddy < r * r;
}

function release(S, w, p){
  if (p.state === 'snare') p.state = 'normal';
  w.holding = false;
  p.hurtCd = Math.max(p.hurtCd, 0.55);
  p.vx = (p.x + p.w / 2 < w.bx) ? -46 : 46;
  p.vy = -28;
  p.apexY = p.y;
  p.events.push('kelprelease');
}

export function hitTendril(S, w){
  if (!w || w.dead) return false;
  w.dead = true; w.hitT = 0.55;
  if (w.holding) release(S, w, S.p);
  dropLoot(S, w.tx, w.ty, 't');
  S.hitStop = Math.max(S.hitStop, 0.05);
  S.shake = Math.max(S.shake, 2);
  S.p.events.push('kill:t' + w.id);
  return true;
}

function latch(S, w, p){
  p.state = 'snare';
  p.hang = null; p.climb = null; p.lad = null; p.bars = null; p.snap = null;
  p.rollT = 0; p.vx = 0; p.vy = 0; p.swimLaunch = 0;
  p.onGround = false;
  w.holding = true; w.state = 'wrap'; w.t = 0.18;
  p.events.push('kelpwrap');
}

function holdPoint(w, p){
  return { x: w.bx - p.w / 2, y: w.by - p.h - 2 };
}

function dragToward(S, p, hx, hy, spd, dt){
  var ddx = hx - p.x, ddy = hy - p.y;
  var dln = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
  var step = Math.min(dln, spd * dt);
  var nx = p.x + ddx / dln * step, ny = p.y + ddy / dln * step;
  if (rectFree(nx, p.y, p.w, p.h)) p.x = nx;
  if (rectFree(p.x, ny, p.w, p.h)) p.y = ny;
  p.vx = 0; p.vy = 0;
  return dln;
}

function playerNear(w, p, reach){
  if (!p.inWater && !p.wading) return false;
  if (p.state === 'stun' || p.state === 'warp') return false;
  var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  var dx = pcx - w.bx, dy = pcy - w.by;
  if (dy > 10) return false;
  return dx * dx + dy * dy < reach * reach;
}

export function tickSnareAir(S, p, dt){
  var cxw = p.x + p.w / 2;
  var wetCenter = isWaterV(tileAt(Math.floor(cxw / T), Math.floor((p.y + p.h / 2) / T)));
  var surf = wetCenter ? waterSurfaceY(cxw, p.y + p.h / 2) : null;
  var atSurf = surf !== null && (p.y + 4) <= surf + 10;
  var airMax = p.scuba ? C.SCUBA_AIR : C.AIR_MAX;
  p.inWater = wetCenter;
  p.wading = false;
  p.atSurface = !!atSurf;
  p.swimSurf = surf;
  p.apexY = p.y;
  if (!wetCenter) return;
  if (atSurf){
    if (p.air < airMax){ p.air = airMax; p.events.push('gasp'); }
  } else {
    p.air -= dt;
    if (p.air <= 0){
      if (p.scuba && S.bag.tank > 0){
        S.bag.tank--; p.air = airMax; p.events.push('tank');
      } else {
        p.air = 1.4;
        S.hp -= 1;
        S.shake = Math.min(7, S.shake + 3);
        p.events.push('drown');
        p.events.push('hurt');
        if (S.hp <= 0){ S.hp = 3; resetPlayer(S); p.events.push('respawn'); }
      }
    } else if (p.air < 4 && Math.floor(p.air * 2) !== Math.floor((p.air + dt) * 2))
      p.events.push('lowair');
  }
  p.bubT = (p.bubT || 0) + dt;
  if (p.bubT > 0.16){ p.bubT = 0; p.events.push('bubble'); }
  p.bubTop = surf !== null ? surf : p.y;
}

export function stepTendrils(S, dt, inp){
  var p = S.p;
  for (var i = 0; i < S.tendrils.length; i++){
    var w = S.tendrils[i];
    if (w.dead){
      w.hitT -= dt;
      w.len = Math.max(4, w.len - 80 * dt);
      aim(w, 0, -1, w.len);
      if (w.holding) release(S, w, p);
      continue;
    }
    if (!w.dead && p.atkT > 0 &&
        (w.holding || tendrilHits(w, p.x + p.w / 2 + p.facing * C.ATK_R * 0.55, p.y + p.h / 2, C.ATK_R * 0.75))){
      hitTendril(S, w);
      continue;
    }
    if (!w.dead){
      var cut = false;
      for (var hi = 0; hi < (S.harpoons || []).length && !cut; hi++){
        var b = S.harpoons[hi];
        if (b.stuck) continue;
        if (tendrilHits(w, b.x, b.y, 7)){ hitTendril(S, w); b.stuck = true; cut = true; }
      }
      if (cut) continue;
    }
    if (w.holding && p.state !== 'snare'){
      w.holding = false;
      w.state = 'up';
    }
    var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    var reach = maxReach(w);
    var idleLen = 13 + Math.sin(S.t * 1.7 + w.ph) * 3;

    if (w.state === 'idle'){
      w.t -= dt;
      var sway = Math.sin(S.t * 1.5 + w.ph) * 12;
      w.len += (idleLen - w.len) * Math.min(1, dt * 6);
      aim(w, sway, -22, w.len);
      var sense = w.kind === 1 ? 76 : 70;
      if (w.t <= 0 && playerNear(w, p, Math.min(reach + 8, sense)) && p.state !== 'snare'){
        w.state = 'reach';
        p.events.push(w.kind === 1 ? 'kelpreach' : 'kelpstir');
      } else if (w.t <= -1.4) w.t = 0.5 + Math.random() * 0.6;
    } else if (w.state === 'reach'){
      var grow = w.kind === 1 ? 78 : 96;
      var dx = pcx - w.bx, dy = pcy - w.by;
      var want = Math.min(reach, Math.sqrt(dx * dx + dy * dy) || 1);
      w.len += grow * dt;
      if (w.len > want) w.len = want;
      aim(w, dx, dy, w.len);
      var tipR = w.kind === 1 ? 11 : 9;
      var hit = Math.abs(w.tx - pcx) < tipR && Math.abs(w.ty - pcy) < tipR + 2;
      if (hit && p.state !== 'snare' && p.state !== 'stun'){
        if (w.kind === 0){
          if (p.hurtCd <= 0){
            p.hurtCd = C.HURT_CD;
            var kb = pcx < w.bx ? -1 : 1;
            damage(S, 1, 0.22);
            p.vx = kb * 70; p.vy = -50;
            p.events.push('kelpsting');
          }
          w.state = 'up';
        } else {
          latch(S, w, p);
        }
      } else if (w.len >= reach - 1 || !playerNear(w, p, reach + 18) || p.state === 'snare'){
        w.state = 'up';
      }
    } else if (w.state === 'wrap'){
      w.t -= dt;
      w.len = Math.sqrt((pcx - w.bx) * (pcx - w.bx) + (pcy - w.by) * (pcy - w.by)) || w.len;
      aim(w, pcx - w.bx, pcy - w.by, w.len);
      p.vx = 0; p.vy = 0;
      if (w.t <= 0) w.state = 'drag';
    } else if (w.state === 'drag'){
      var hp = holdPoint(w, p);
      var dist = dragToward(S, p, hp.x, hp.y, 86, dt);
      pcx = p.x + p.w / 2; pcy = p.y + p.h / 2;
      w.len = Math.sqrt((pcx - w.bx) * (pcx - w.bx) + (pcy - w.by) * (pcy - w.by)) || w.len;
      aim(w, pcx - w.bx, pcy - w.by, w.len);
      if (dist < 7){ w.state = 'hold'; w.t = C.TEND_HOLD; w.mashX = 0; p.events.push('kelphold'); }
    } else if (w.state === 'hold'){
      var hp2 = holdPoint(w, p);
      dragToward(S, p, hp2.x, hp2.y, 40, dt);
      pcx = p.x + p.w / 2; pcy = p.y + p.h / 2;
      w.len = Math.sqrt((pcx - w.bx) * (pcx - w.bx) + (pcy - w.by) * (pcy - w.by)) || 8;
      aim(w, pcx - w.bx, pcy - w.by, w.len);
      w.t -= dt;
      if (inp){
        if (inp.x !== 0 && inp.x !== w.mashX){ w.t -= 0.18; w.mashX = inp.x; }
        if (inp.x === 0) w.mashX = 0;
        if (inp.jumpPressed) w.t -= 0.14;
      }
      if (w.t <= 0){
        release(S, w, p);
        w.state = 'up';
        w.t = 2.1;
      }
    } else {
      w.len -= 118 * dt;
      if (w.len <= idleLen){
        w.len = idleLen;
        w.state = 'idle';
        if (w.t < 0.4) w.t = (w.kind === 1 ? 1.8 : 1.1) + Math.random() * 0.5;
      }
      var sx = Math.sin(S.t * 1.5 + w.ph) * 10;
      aim(w, sx, -22, w.len);
    }
  }
}
