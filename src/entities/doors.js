import { C } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { inDark } from './dark.js';
import { findById } from './ids.js';
import { mutterHero } from '../speech/runtime.js';

export function normalizeDoor(d){
  if (!d) return d;
  if (d.need == null && d.locked) d.need = 'key';
  if (d.need === '') d.need = null;
  if (d.consume == null) d.consume = true;
  d.locked = !!d.need;
  return d;
}

export function mkDoors(){
  var LV = runtime.LV;
  return (LV.doors || []).map(function(d){
    return normalizeDoor({
      id: d.id, x: d.x, y: d.y, pair: d.pair, tag: d.tag || '',
      need: d.need != null ? d.need : null,
      consume: d.consume !== false,
      locked: !!d.locked
    });
  });
}

export function levelExits(lv){
  if (!lv) return [];
  if (lv.exits) return lv.exits;
  if (lv.exit){
    lv.exits = [{ id: 0, x: lv.exit.x, y: lv.exit.y, toId: lv.exit.toId != null ? lv.exit.toId : null }];
  } else {
    lv.exits = [];
  }
  return lv.exits;
}

/** После hydrate: одиночный exit → exits[]; toId = id следующего уровня в списке. */
export function ensureLevelExits(levels){
  if (!levels) return;
  var i, lv, next, fallback;
  for (i = 0; i < levels.length; i++){
    lv = levels[i];
    next = levels[i + 1];
    fallback = next ? next.id : null;
    if (!lv.exits){
      if (lv.exit){
        lv.exits = [{
          id: 0,
          x: lv.exit.x,
          y: lv.exit.y,
          toId: lv.exit.toId !== undefined ? lv.exit.toId : fallback
        }];
      } else {
        lv.exits = [];
      }
    } else if (!lv.blank && lv.exits.length && lv.exits[0].toId == null){
      /* старый bake/store без toId — первый exit = кампания i→i+1 */
      lv.exits[0].toId = fallback;
    }
    if (lv.exits[0]) lv.exit = lv.exits[0];
    else lv.exit = null;
  }
}

export function hasBagKind(S, kind){
  if (!kind) return true;
  if (kind === 'key') return (S.keys || 0) > 0;
  return !!(S.bag && S.bag[kind] > 0);
}

export function takeBagKind(S, kind){
  if (!kind) return;
  if (kind === 'key'){
    if ((S.keys || 0) > 0) S.keys--;
    return;
  }
  if (!S.bag || !(S.bag[kind] > 0)) return;
  S.bag[kind]--;
}

export function tryExit(S){
  var LV = runtime.LV;
  var p = S.p, list = levelExits(LV), i, e;
  if (!list.length || S.done) return false;
  for (i = 0; i < list.length; i++){
    e = list[i];
    if (Math.abs((p.x + p.w / 2) - (e.x + 8)) > 20) continue;
    if (Math.abs((p.y + p.h) - e.y) > 26) continue;
    S.done = true;
    p.state = 'warp'; p.vx = 0; p.vy = 0;
    p.hang = p.lad = p.climb = p.snap = null;
    p.warp = { to: -1, t: 0, moved: false, exit: true, toId: e.toId != null ? e.toId : null };
    p.events.push('caveexit');
    return true;
  }
  return false;
}

export function tryDoor(S){
  var p = S.p, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  for (var i = 0; i < S.doors.length; i++){
    var d = S.doors[i];
    if (Math.abs(d.x + 8 - cx) > 17 || Math.abs(d.y - 12 - cy) > 22) continue;
    if (d.need){
      if (!hasBagKind(S, d.need)){
        mutterHero(S, 'locked');
        p.events.push('locked');
        return true;
      }
      if (d.consume !== false) takeBagKind(S, d.need);
      var pr0 = findById(S.doors, d.pair);
      d.need = null; d.locked = false;
      if (pr0){ pr0.need = null; pr0.locked = false; }
      p.events.push('unlock');
    }
    p.state = 'warp'; p.vx = 0; p.vy = 0;
    p.hang = null; p.lad = null; p.climb = null; p.snap = null;
    p.warp = { to: d.pair, t: 0, moved: false };
    p.events.push('doorin:' + (d.tag || ''));
    return true;
  }
  return false;
}

export function updateWarp(S, p, dt){
  var w = p.warp; w.t += dt;
  var half = C.WARP_T * 0.5;
  S.fade = w.t < half ? (w.t / half) : Math.max(0, 1 - (w.t - half) / half);
  if (w.exit){
    S.fade = Math.min(1, w.t / (C.WARP_T * 0.5));
    if (w.t >= C.WARP_T * 0.5){ w.moved = true; }
    return;
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
      p.x = d.x + 8 - p.w / 2; p.y = d.y - p.h;
      p.onGround = true; p.apexY = p.y; p.ride = null;
      S.respawn.x = p.x; S.respawn.y = p.y;
      p.events.push('doorout:' + (d.tag || ''));
    }
    w.moved = true;
  }
  if (w.t >= C.WARP_T){
    S.fade = 0; p.warp = null; p.state = 'normal';
    p.onGround = true; p.coyote = C.COYOTE;
  }
}
