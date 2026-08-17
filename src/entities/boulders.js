import { T, C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { rectFree, isSlopeV, slopeGrade, slopeRiseRight, slopeTop, tileAt } from '../core/map.js';
import { damage } from '../core/player.js';
import { allocId } from './ids.js';

export var BW = 12, BH = 11;

function initialResting(x, y){ return !rectFree(x + 1, y + BH, BW - 2, 1); }

/* --- камни: круглые, падают без опоры, катятся со склонов, героиня медленно толкает их --- */
export function mkBoulders(){
  var LV = runtime.LV;
  return (LV.boulders || []).map(function(a, i){
    var floorY = (a[1] + 1) * T, cx = a[0]*T + 8;
    var x = cx - BW/2, y = floorY - BH;
    return { id: i, x: x, y: y, vx: 0, vy: 0, resting: initialResting(x, y) };
  });
}
export function mkBoulderAt(S, cx, floorY){
  var x = cx - BW/2, y = floorY - BH;
  S.boulders.push({ id: allocId(S.boulders), x: x, y: y, vx: 0, vy: 0, resting: initialResting(x, y) });
}
function boulderFree(S, skip, x, y){
  if (!rectFree(x, y, BW, BH)) return false;
  for (var i = 0; i < S.boulders.length; i++){
    var o = S.boulders[i];
    if (o === skip) continue;
    if (x + BW > o.x + 1 && x < o.x + BW - 1 && y + BH > o.y + 1 && y < o.y + BH - 1) return false;
  }
  return true;
}
function overlapsPlayer(b, p){
  return b.x + BW > p.x && b.x < p.x + p.w && b.y + BH > p.y && b.y < p.y + p.h;
}
/* rectFree не блокирует скосы (это поверхность, не стена) — ищем её отдельно, как для игрока */
function slopeSurfaceUnder(bx, by){
  var px = bx + BW/2;
  var c = Math.floor(px / T), r = Math.floor((by + BH + 1) / T);
  for (var k = -1; k <= 1; k++){
    var v = tileAt(c, r + k);
    if (!isSlopeV(v)) continue;
    var sy = (r + k)*T + slopeTop(v, c, px);
    if (by + BH >= sy - 6 && by + BH <= sy + 10) return { y: sy, v: v, c: c };
  }
  return null;
}
export function stepBoulders(S, dt){
  var p = S.p;
  for (var i = 0; i < S.boulders.length; i++){
    var b = S.boulders[i];
    var slope = slopeSurfaceUnder(b.x, b.y);
    var supported = slope !== null || !rectFree(b.x + 1, b.y + BH, BW - 2, 1);
    if (supported){
      if (!b.resting){ b.resting = true; S.shake = Math.max(S.shake, 2); S.p.events.push('bouldland:' + Math.round(b.x)); }
      b.vy = 0;
      if (slope){
        b.y = slope.y - BH;                       // держимся ровно на поверхности склона
        var dir = slopeRiseRight(slope.v) ? -1 : 1;
        var grade = slopeGrade(slope.v, slope.c, b.x + BW/2);
        b.vx += dir * (50 + grade * 80) * dt;
        if (b.vx > 70) b.vx = 70; if (b.vx < -70) b.vx = -70;
      } else {                                    // на ровном — трение гасит накат
        var fr = 90 * dt;
        b.vx = Math.abs(b.vx) <= fr ? 0 : b.vx - (b.vx > 0 ? fr : -fr);
      }
      if (b.vx){
        var nx = b.x + b.vx * dt;
        if (boulderFree(S, b, nx, b.y) || slopeSurfaceUnder(nx, b.y)) b.x = nx; else b.vx = 0;
      }
      continue;
    }
    b.resting = false;
    b.vy += C.GRAV * dt; if (b.vy > C.MAXFALL) b.vy = C.MAXFALL;
    var ny = b.y + b.vy * dt;
    if (!rectFree(b.x, ny, BW, BH)){ b.y = Math.floor((ny + BH) / T) * T - BH; b.vy = 0; }
    else b.y = ny;
    if (b.vx){
      var nx2 = b.x + b.vx * dt;
      if (rectFree(nx2, b.y, BW, BH)) b.x = nx2; else b.vx = 0;
    }
    if (p.hurtCd <= 0 && p.state !== 'stun' && b.vy > 40 && overlapsPlayer(b, p)){
      p.hurtCd = C.HURT_CD;
      damage(S, 99, 0.3);                         // насмерть — каска не спасает
      p.events.push('hitdrop');
    }
  }
}
/* прижавшийся к камню бок игрока — резерв в 3px, чтобы ловить контакт до взаимопроникновения */
function boulderAhead(S, p, dir){
  var px = dir > 0 ? p.x + p.w : p.x - BW;
  for (var i = 0; i < S.boulders.length; i++){
    var b = S.boulders[i];
    if (!b.resting) continue;
    if (Math.abs(b.x - px) > 3) continue;
    if (p.y + p.h <= b.y + 2 || p.y >= b.y + BH - 2) continue;
    return b;
  }
  return null;
}
/* героиня упирается в камень стоя на земле — очень медленно катит его перед собой */
export function pushBoulders(S, p, dt, inp){
  if (!p.onGround || p.rollT > 0){ p.pushWall = false; return; }
  var dir = p.vx !== 0 ? (p.vx > 0 ? 1 : -1) : (Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0);
  if (!dir){ p.pushWall = false; return; }
  var b = boulderAhead(S, p, dir);
  if (!b){ p.pushWall = false; return; }
  var pressing = p.stance === 0 && Math.abs(inp.x) > 0.35 && (inp.x > 0) === (dir > 0);
  if (pressing){
    var nx = b.x + dir * C.PUSH_V * dt;
    if (boulderFree(S, b, nx, b.y)){ b.x = nx; p.vx = dir * C.PUSH_V; }
    else p.vx = 0;
  } else {
    p.vx = 0;
  }
  p.pushWall = true;
}
