import { T } from './constants.js';
import { runtime, hooks, inMap, mapIx } from './runtime.js';

export const COVER_AIR = 255;

export function ensureCover(L){
  if (!L) return;
  var n = runtime.MAP_W * runtime.MAP_H;
  if (!L.cover || L.cover.length !== n){
    var old = L.cover;
    L.cover = new Uint8Array(n);
    if (old && old.length) L.cover.set(old.subarray(0, Math.min(old.length, n)));
    L._roomsDirty = true;
  }
  if (!L.coverVary || L.coverVary.length !== n){
    var ov = L.coverVary;
    L.coverVary = new Uint8Array(n);
    if (ov && ov.length) L.coverVary.set(ov.subarray(0, Math.min(ov.length, n)));
  }
  if (!L.roomOf || L.roomOf.length !== n){
    L.roomOf = new Uint16Array(n);
    L._roomsDirty = true;
  }
}

export function coverRaw(L, c, r){
  if (!L || !L.cover || !inMap(c, r)) return 0;
  return L.cover[mapIx(c, r)];
}
export function coverVarRaw(L, c, r){
  if (!L || !L.coverVary || !inMap(c, r)) return 0;
  return L.coverVary[mapIx(c, r)];
}

export function rebuildRooms(L){
  if (!L || !L.cover) return;
  var w = runtime.MAP_W, h = runtime.MAP_H, n = w * h;
  if (!L.roomOf || L.roomOf.length !== n) L.roomOf = new Uint16Array(n);
  else L.roomOf.fill(0);
  var cov = L.cover, roomOf = L.roomOf;
  var id = 0, stack = [], i, ix, lc, lr;
  for (i = 0; i < n; i++){
    if (!cov[i] || roomOf[i]) continue;
    id++;
    stack.push(i);
    while (stack.length){
      ix = stack.pop();
      if (roomOf[ix] || !cov[ix]) continue;
      roomOf[ix] = id;
      lc = ix % w;
      lr = (ix / w) | 0;
      if (lc > 0) stack.push(ix - 1);
      if (lc + 1 < w) stack.push(ix + 1);
      if (lr > 0) stack.push(ix - w);
      if (lr + 1 < h) stack.push(ix + w);
    }
  }
  L._roomsDirty = false;
}

function coverLive(L){
  return !!(L && L.cover && L.collide && !L.wrap && runtime.roomsOn != null);
}

function roomKey(L, ix){
  return L.id + ':' + L.roomOf[ix];
}

export function liveTileOf(L, c, r, raw){
  if (!coverLive(L) || !inMap(c, r)) return raw;
  var ix = mapIx(c, r);
  var cov = L.cover[ix];
  if (!cov) return raw;
  if (L._roomsDirty) rebuildRooms(L);
  if (runtime.roomsOn[roomKey(L, ix)]) return raw;
  return cov === COVER_AIR ? 0 : cov;
}

export function liveVarOf(L, c, r, rawVar){
  if (!coverLive(L) || !inMap(c, r)) return rawVar;
  var ix = mapIx(c, r);
  var cov = L.cover[ix];
  if (!cov) return rawVar;
  if (L._roomsDirty) rebuildRooms(L);
  if (runtime.roomsOn[roomKey(L, ix)]) return rawVar;
  if (cov === COVER_AIR) return 0;
  return L.coverVary ? L.coverVary[ix] : 0;
}

function sameOn(a, b){
  if (a == null || b == null) return a == b;
  var ka = Object.keys(a), kb = Object.keys(b), i;
  if (ka.length !== kb.length) return false;
  for (i = 0; i < ka.length; i++) if (!b[ka[i]]) return false;
  return true;
}

export function stepRooms(S){
  var p = S && S.p;
  var next = {};
  var ls = runtime.layers || [];
  var i, L, c, r, ix;
  if (p){
    c = Math.floor((p.x + p.w * 0.5) / T);
    r = Math.floor((p.y + p.h - 1) / T);
    for (i = 0; i < ls.length; i++){
      L = ls[i];
      if (!L.collide || !L.cover || L.wrap) continue;
      if (L._roomsDirty) rebuildRooms(L);
      if (!inMap(c, r)) continue;
      ix = mapIx(c, r);
      if (!L.cover[ix]) continue;
      next[roomKey(L, ix)] = 1;
    }
  }
  var changed = !sameOn(runtime.roomsOn, next);
  runtime.roomsOn = next;
  if (S) S.roomsOn = next;
  if (changed && hooks.onRoomsChange) hooks.onRoomsChange();
}

export function roomHides(x, y){
  if (runtime.roomsOn == null) return false;
  var c = Math.floor(x / T), r = Math.floor(y / T);
  if (!inMap(c, r)) return false;
  var ls = runtime.layers || [];
  var i, L, ix;
  for (i = 0; i < ls.length; i++){
    L = ls[i];
    if (!L.collide || !L.cover || L.wrap) continue;
    if (L._roomsDirty) rebuildRooms(L);
    ix = mapIx(c, r);
    if (!L.cover[ix]) continue;
    if (!runtime.roomsOn[roomKey(L, ix)]) return true;
  }
  return false;
}

function markList(arr, xy){
  if (!arr) return;
  var i, e, p;
  for (i = 0; i < arr.length; i++){
    e = arr[i];
    p = xy ? xy(e) : e;
    e.roomHide = !!(p && roomHides(p.x, p.y));
  }
}

export function markRoomHidden(S){
  if (!S) return;
  markList(S.enemies);
  markList(S.fliers);
  markList(S.spiders);
  markList(S.tendrils, function(w){ return { x: w.bx != null ? w.bx : w.x, y: w.by != null ? w.by : w.y }; });
  markList(S.torches, function(t){ return t.held ? null : t; });
  markList(S.chests, function(ch){ return { x: ch.x + 8, y: ch.y - 6 }; });
  markList(S.loot);
  markList(S.items);
  markList(S.npcs);
  markList(S.boulders);
  markList(S.lights);
  markList(S.sounds);
  markList(S.doors);
  markList(S.plats);
  markList(S.lifts);
  markList(S.harpoons);
  markList(S.arrows);
  markList(S.drops);
  if (S.pick){
    if (S.pick.stick) S.pick.stick.roomHide = roomHides(S.pick.stick.x, S.pick.stick.y);
    if (S.pick.key) S.pick.key.roomHide = roomHides(S.pick.key.x, S.pick.key.y);
  }
}

export function setEditorRooms(coverOn){
  runtime.roomsOn = coverOn ? {} : null;
  if (hooks.onRoomsChange) hooks.onRoomsChange();
}
