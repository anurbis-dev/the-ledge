import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { tileAt, isWetV, isWaterV, waterSurfaceY, rectFree, solidTile } from '../core/map.js';
import { damage } from '../core/player.js';
import { dropLoot } from './loot.js';
import { allocId } from './ids.js';

/* щупальца водорослей. kind 0 — жало, kind 1 — обвивает и тянет к корню.
   LV.tendrils: [col, row, kind] | [col, row, kind, side]
   row/col — твёрдый тайл корня. side: 0 пол↑, 1 потолок↓, 2 левая стена→, 3 правая стена←.
   Гарпун бьёт здесь (stepHarpoons не импортирует tendrils — цикл player→torches→harpoons). */

function dirs(side){
  if (side === 1) return { gx: 0, gy: 1 };
  if (side === 2) return { gx: 1, gy: 0 };
  if (side === 3) return { gx: -1, gy: 0 };
  return { gx: 0, gy: -1 };
}

function snapFloor(col, row){
  var r = row;
  while (isWetV(tileAt(col, r))) r++;
  return r;
}

export function resolveAnchor(col, row, hint){
  var side = hint;
  if (side === undefined || side === null){
    if (solidTile(col, row)){
      if (isWetV(tileAt(col, row - 1))) side = 0;
      else if (isWetV(tileAt(col, row + 1))) side = 1;
      else if (isWetV(tileAt(col + 1, row))) side = 2;
      else if (isWetV(tileAt(col - 1, row))) side = 3;
      else side = 0;
      return { col: col, row: row, side: side };
    }
    if (solidTile(col, row + 1)) return { col: col, row: row + 1, side: 0 };
    if (solidTile(col, row - 1)) return { col: col, row: row - 1, side: 1 };
    if (solidTile(col - 1, row)) return { col: col - 1, row: row, side: 2 };
    if (solidTile(col + 1, row)) return { col: col + 1, row: row, side: 3 };
    return { col: col, row: snapFloor(col, row), side: 0 };
  }
  if (side === 0) return { col: col, row: snapFloor(col, row), side: 0 };
  return { col: col, row: row, side: side };
}

function rootOf(col, row, side){
  if (side === 1) return { x: col * T + 8, y: (row + 1) * T };
  if (side === 2) return { x: (col + 1) * T, y: row * T + 8 };
  if (side === 3) return { x: col * T, y: row * T + 8 };
  return { x: col * T + 8, y: row * T };
}

function mkOne(id, anc, kind){
  var d = dirs(anc.side);
  var rt = rootOf(anc.col, anc.row, anc.side);
  return {
    id: id, bx: rt.x, by: rt.y, tx: rt.x + d.gx * 14, ty: rt.y + d.gy * 14,
    col: anc.col, row: anc.row, side: anc.side, gx: d.gx, gy: d.gy,
    kind: kind || 0, len: 14, state: 'idle', t: 0.4 + id * 0.3,
    dead: false, hitT: 0, ph: id * 1.7, holding: false, mashX: 0
  };
}

export function mkTendrils(){
  var LV = runtime.LV;
  return (LV.tendrils || []).map(function(a, i){
    var anc = resolveAnchor(a[0], a[1], a[3]);
    return mkOne(i, anc, a[2] !== undefined ? a[2] : (i % 2));
  });
}

export function mkTendrilAt(S, x, y, kind){
  var anc = resolveAnchor(Math.floor(x / T), Math.floor(y / T), undefined);
  S.tendrils.push(mkOne(allocId(S.tendrils), anc, kind));
}

function maxReach(w){
  var sc, sr, dc = w.gx, dr = w.gy;
  if (w.side === 0){ sc = Math.floor(w.bx / T); sr = Math.floor((w.by - 2) / T); }
  else if (w.side === 1){ sc = Math.floor(w.bx / T); sr = Math.floor((w.by + 2) / T); }
  else if (w.side === 2){ sc = Math.floor((w.bx + 2) / T); sr = Math.floor(w.by / T); }
  else { sc = Math.floor((w.bx - 2) / T); sr = Math.floor(w.by / T); }
  var max = 10;
  for (var i = 0; i < 12; i++){
    var cc = sc + dc * i, rr = sr + dr * i;
    if (!isWetV(tileAt(cc, rr))) break;
    if (w.side === 0) max = w.by - rr * T;
    else if (w.side === 1) max = (rr + 1) * T - w.by;
    else if (w.side === 2) max = (cc + 1) * T - w.bx;
    else max = w.bx - cc * T;
  }
  return Math.min(max - 2, C.TEND_REACH);
}

function tipOk(x, y){
  return isWetV(tileAt(Math.floor(x / T), Math.floor(y / T)));
}

function aim(w, ox, oy, len){
  var along = ox * w.gx + oy * w.gy;
  if (along < 6){
    ox = w.gx * 6 + ox * 0.15;
    oy = w.gy * 6 + oy * 0.15;
  }
  var ln = Math.sqrt(ox * ox + oy * oy) || 1;
  var nx = w.bx + ox / ln * len, ny = w.by + oy / ln * len;
  if (!tipOk(nx, ny)){
    nx = w.bx + w.gx * len;
    ny = w.by + w.gy * len;
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
  p.vy = w.gy > 0 ? 28 : -28;
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
  var pad = 4;
  return {
    x: w.bx + w.gx * (p.w / 2 + pad) - p.w / 2,
    y: w.by + w.gy * (p.h / 2 + pad) - p.h / 2
  };
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
  var along = dx * w.gx + dy * w.gy;
  if (along < -8) return false;
  return dx * dx + dy * dy < reach * reach;
}

function probeHarpoons(S, w){
  var list = S.harpoons || [];
  for (var i = 0; i < list.length; i++){
    var b = list[i];
    if (b.stuck || b.dead) continue;
    if (tendrilHits(w, b.x, b.y, 8)){
      hitTendril(S, w);
      b.stuck = true;
      return true;
    }
  }
  return false;
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
        damage(S, 1, 0.2);
        p.events.push('drown');
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
      aim(w, w.gx, w.gy, w.len);
      if (w.holding) release(S, w, p);
      continue;
    }
    if (p.atkT > 0 &&
        (w.holding || tendrilHits(w, p.x + p.w / 2 + p.facing * C.ATK_R * 0.55, p.y + p.h / 2, C.ATK_R * 0.75))){
      hitTendril(S, w);
      continue;
    }
    if (probeHarpoons(S, w)) continue;
    if (w.holding && p.state !== 'snare'){
      w.holding = false;
      w.state = 'up';
    }
    var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    var reach = maxReach(w);
    var idleLen = 13 + Math.sin(S.t * 1.7 + w.ph) * 3;
    var px = -w.gy, py = w.gx;

    if (w.state === 'idle'){
      w.t -= dt;
      var sway = Math.sin(S.t * 1.5 + w.ph) * 12;
      w.len += (idleLen - w.len) * Math.min(1, dt * 6);
      aim(w, w.gx * 22 + px * sway, w.gy * 22 + py * sway, w.len);
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
            p.vx = kb * 70; p.vy = w.gy > 0 ? 40 : -50;
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
      aim(w, w.gx * 22 + px * sx, w.gy * 22 + py * sx, w.len);
    }
  }
}
