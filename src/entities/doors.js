import { C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { inDark } from './dark.js';
import { findById } from './ids.js';

export function mkDoors(){
  var LV = runtime.LV;
  return LV.doors.map(function(d){
    return { id:d.id, x:d.x, y:d.y, locked:d.locked, pair:d.pair, tag:d.tag };
  });
}
export function tryExit(S){
  var LV = runtime.LV;
  var p = S.p, e = LV.exit;
  if (!e || S.done) return false;
  if (Math.abs((p.x + p.w/2) - (e.x + 8)) > 20) return false;
  if (Math.abs((p.y + p.h) - e.y) > 26) return false;
  S.done = true;
  p.state = 'warp'; p.vx = 0; p.vy = 0;
  p.hang = p.lad = p.climb = p.snap = null;
  p.warp = { to: -1, t: 0, moved: false, exit: true };
  p.events.push('caveexit');
  return true;
}
export function tryDoor(S){
  var p = S.p, cx = p.x + p.w/2, cy = p.y + p.h/2;
  for (var i = 0; i < S.doors.length; i++){
    var d = S.doors[i];
    if (Math.abs(d.x + 8 - cx) > 17 || Math.abs(d.y - 12 - cy) > 22) continue;
    if (d.locked && !S.keys){ p.events.push('locked'); return true; }
    if (d.locked){
      var pr0 = findById(S.doors, d.pair); d.locked = false; if (pr0) pr0.locked = false;
      S.keys--; p.events.push('unlock');
    }
    p.state = 'warp'; p.vx = 0; p.vy = 0;
    p.hang = null; p.lad = null; p.climb = null; p.snap = null;
    p.warp = { to: d.pair, t: 0, moved: false };
    p.events.push('doorin:' + d.tag);
    return true;
  }
  return false;
}
export function updateWarp(S, p, dt){
  var w = p.warp; w.t += dt;
  var half = C.WARP_T * 0.5;
  S.fade = w.t < half ? (w.t / half) : Math.max(0, 1 - (w.t - half)/half);
  if (w.exit){
    S.fade = Math.min(1, w.t / (C.WARP_T * 0.5));
    if (w.t >= C.WARP_T * 0.5){ w.moved = true; }
    return;                                    // ждём смены уровня снаружи
  }
  if (!w.moved && w.t >= half){
    if (w.restoreDark){
      for (var ti = 0; ti < S.torches.length; ti++){
        var tt = S.torches[ti];
        if (inDark(S, tt.hx, tt.hy - 6)){
          tt.x = tt.hx; tt.y = tt.hy; tt.vx = 0; tt.vy = 0;
          tt.lit = true; tt.held = false; tt.ground = true; tt.ang = 0; tt.thrown = false;
        }
      }
    }
    var d = findById(S.doors, w.to);
    if (d){
      p.x = d.x + 8 - p.w/2; p.y = d.y - p.h;      // выходим ИЗ парной двери
      p.onGround = true; p.apexY = p.y; p.ride = null;
      S.respawn.x = p.x; S.respawn.y = p.y;
      p.events.push('doorout:' + d.tag);
    }
    w.moved = true;
  }
  if (w.t >= C.WARP_T){
    S.fade = 0; p.warp = null; p.state = 'normal';
    p.onGround = true; p.coyote = C.COYOTE;
  }
}
