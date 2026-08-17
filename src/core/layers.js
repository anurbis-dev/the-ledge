import { runtime } from './runtime.js';

export function getLayers(){
  return runtime.layers || [];
}

export function getActiveLayer(){
  var ls = getLayers();
  var i = runtime.activeLayer | 0;
  return ls[i] || ls[0] || null;
}

export function setActiveLayer(i){
  var ls = getLayers();
  if (i < 0 || i >= ls.length) return;
  runtime.activeLayer = i;
}

export function layerKind(L){
  return (L && L.kind) || 'tiles';
}

export function isTileLayer(L){
  return layerKind(L) === 'tiles';
}

export function layerShown(L, honorSolo){
  if (!L) return false;
  if (honorSolo && runtime.soloLayer) return L.id === runtime.soloLayer;
  return L.visible !== false;
}

/* герой и объекты живут на collision-слое; соло другого слоя их прячет */
export function entitiesShown(honorSolo){
  if (!honorSolo || !runtime.soloLayer) return true;
  var ls = getLayers(), i;
  for (i = 0; i < ls.length; i++)
    if (ls[i].id === runtime.soloLayer) return !!ls[i].collide;
  return true;
}

export function layerCssFilter(L){
  if (!L) return '';
  var hue = L.hue || 0;
  var sat = L.sat == null ? 1 : L.sat;
  var br = 1 + (L.bright || 0);
  if (!hue && sat === 1 && Math.abs(br - 1) < 0.001) return '';
  return 'hue-rotate(' + hue + 'deg) saturate(' + sat + ') brightness(' + br + ')';
}

export function lastCollideIndex(){
  var ls = getLayers(), last = -1, i;
  for (i = 0; i < ls.length; i++) if (ls[i].collide) last = i;
  return last;
}

export function firstCollide(){
  var ls = getLayers(), i;
  for (i = 0; i < ls.length; i++) if (ls[i].collide) return ls[i];
  return null;
}

export function bindMain(){
  var L = firstCollide();
  if (!L || !L.base) return;
  runtime.base = L.base;
  runtime.vary = L.vary;
}

function nextId(){
  var ls = getLayers(), m = 0, i;
  for (i = 0; i < ls.length; i++) if ((ls[i].id | 0) > m) m = ls[i].id;
  return m + 1;
}
function ensureUniqueIds(){
  var ls = getLayers(), seen = {}, i, id;
  for (i = 0; i < ls.length; i++){
    id = ls[i].id | 0;
    if (!id || seen[id]) ls[i].id = nextId();
    seen[ls[i].id] = 1;
  }
}

function colorDefaults(L){
  if (L.hue == null) L.hue = 0;
  if (L.sat == null) L.sat = 1;
  if (L.bright == null) L.bright = 0;
  return L;
}

function proc(kind, name, extra){
  var L = {
    id: 0, kind: kind, name: name,
    px: 1, py: 1, visible: true, locked: false, collide: false,
    hue: 0, sat: 1, bright: 0
  };
  if (extra) for (var k in extra) L[k] = extra[k];
  return L;
}
function takeIds(arr){
  var m = 0, ls = getLayers(), i;
  for (i = 0; i < ls.length; i++) if ((ls[i].id | 0) > m) m = ls[i].id | 0;
  for (i = 0; i < arr.length; i++){
    m++;
    arr[i].id = m;
  }
  return arr;
}

function defaultBack(){
  return [
    proc('sky', 'Sky', { px: 0.05, py: 0.03 }),
    proc('ridge', 'Hills far', { px: 0.08, py: 0.048, amp: 44, y0: 116, color: '#2b2154' }),
    proc('ridge', 'Hills mid', { px: 0.18, py: 0.108, amp: 34, y0: 142, color: '#3a2266' }),
    proc('ridge', 'Hills near', { px: 0.30, py: 0.18, amp: 24, y0: 162, color: '#4a2f6b' })
  ];
}

function defaultFront(){
  return [
    proc('fore', 'Bushes far', { px: 0.9, py: 0, period: 150, hmin: 10, hmax: 17, col: '#2a2048', colD: '#372a5c', seed: 3 }),
    proc('fore', 'Bushes mid', { px: 1.3, py: 0, period: 122, hmin: 13, hmax: 22, col: '#1b1436', colD: '#241a44', seed: 7 }),
    proc('fore', 'Bushes near', { px: 1.8, py: 0, period: 96, hmin: 16, hmax: 28, col: '#0e0a1e', colD: '#150f2a', seed: 11 }),
    proc('pollen', 'Pollen', { px: 1.9, py: 1.3 })
  ];
}

export function initDefaultLayers(){
  runtime.layers = [];
  runtime.soloLayer = 0;
  var back = takeIds(defaultBack());
  var i;
  for (i = 0; i < back.length; i++) runtime.layers.push(back[i]);
  runtime.layers.push({
    id: nextId(), name: 'Main', kind: 'tiles',
    px: 1, py: 1, visible: true, locked: false, collide: true,
    wrap: false, wrapW: 8, wrapH: 8,
    hue: 0, sat: 1, bright: 0,
    base: runtime.base, vary: runtime.vary
  });
  var front = takeIds(defaultFront());
  for (i = 0; i < front.length; i++) runtime.layers.push(front[i]);
  runtime.activeLayer = back.length;
  ensureUniqueIds();
}

/* старые stash без kind — один раз подставляем небо/кусты; вернёт сколько слоёв вставили сзади */
export function ensureDecorLayers(){
  var ls = getLayers();
  if (!ls.length){ initDefaultLayers(); return 0; }
  var i;
  for (i = 0; i < ls.length; i++){
    if (!ls[i].kind) ls[i].kind = 'tiles';
    colorDefaults(ls[i]);
  }
  var back = takeIds(defaultBack());
  for (i = 0; i < back.length; i++) ls.splice(i, 0, back[i]);
  runtime.activeLayer = (runtime.activeLayer | 0) + back.length;
  var front = takeIds(defaultFront());
  for (i = 0; i < front.length; i++) ls.push(front[i]);
  return back.length;
}

export function addLayer(name){
  var L = {
    id: nextId(),
    name: name || ('Layer ' + (getLayers().length + 1)),
    kind: 'tiles',
    px: 1, py: 1, visible: true, locked: false, collide: false,
    wrap: false, wrapW: 8, wrapH: 8,
    hue: 0, sat: 1, bright: 0,
    base: new Uint8Array(runtime.MAP_W * runtime.MAP_H),
    vary: new Uint8Array(runtime.MAP_W * runtime.MAP_H)
  };
  var ix = (runtime.activeLayer | 0) + 1;
  runtime.layers.splice(ix, 0, L);
  runtime.activeLayer = ix;
  return L;
}

export function deleteLayer(ix){
  var ls = getLayers();
  if (ls.length <= 1) return false;
  var L = ls[ix];
  if (!L) return false;
  if (L.collide){
    var others = 0, i;
    for (i = 0; i < ls.length; i++) if (i !== ix && ls[i].collide) others++;
    if (!others) return false;
  }
  ls.splice(ix, 1);
  if (runtime.activeLayer >= ls.length) runtime.activeLayer = ls.length - 1;
  if (runtime.soloLayer === L.id) runtime.soloLayer = 0;
  bindMain();
  return true;
}

export function moveLayer(from, to){
  var ls = getLayers();
  if (from < 0 || to < 0 || from >= ls.length || to >= ls.length || from === to) return;
  var L = ls.splice(from, 1)[0];
  ls.splice(to, 0, L);
  runtime.activeLayer = to;
  bindMain();
}

/* dest — индекс цели; beforeVisual: вставить выше в списке (ближе к переднему плану) */
export function relocateLayer(from, dest, beforeVisual){
  var n = getLayers().length;
  if (from < 0 || dest < 0 || from >= n || dest >= n) return;
  var insert = beforeVisual ? dest + 1 : dest;
  if (from < insert) insert--;
  if (insert < 0) insert = 0;
  if (insert > n - 1) insert = n - 1;
  moveLayer(from, insert);
}

function collideCount(except){
  var ls = getLayers(), n = 0, i;
  for (i = 0; i < ls.length; i++) if (ls[i].collide && ls[i] !== except) n++;
  return n;
}

export function setLayerCollide(L, on){
  if (!L || !isTileLayer(L)) return;
  if (!on && !collideCount(L)) return;
  if (on && L.wrap){
    L.wrap = false;
    if (!L.base){
      L.base = new Uint8Array(runtime.MAP_W * runtime.MAP_H);
      L.vary = new Uint8Array(runtime.MAP_W * runtime.MAP_H);
    }
  }
  L.collide = !!on;
  if (L.collide){ L.px = 1; L.py = 1; }
  bindMain();
}

var WRAP_MAX = 256;

export function wrapSize(L){
  return {
    w: Math.max(1, Math.min(WRAP_MAX, (L && L.wrapW) || 8)),
    h: Math.max(1, Math.min(WRAP_MAX, (L && L.wrapH) || 8))
  };
}

export function wrapIndex(L, c, r){
  var s = wrapSize(L);
  var lc = ((c % s.w) + s.w) % s.w;
  var lr = ((r % s.h) + s.h) % s.h;
  return lr * s.w + lc;
}

export function ensureStamp(L){
  if (!L || !isTileLayer(L)) return;
  var s = wrapSize(L);
  var n = s.w * s.h;
  if (L.stamp && L.stamp.length === n){
    L._stampW = s.w; L._stampH = s.h;
    if (!L.stampVar || L.stampVar.length !== n) L.stampVar = new Uint8Array(n);
    return;
  }
  var ow = L._stampW || 0;
  var oh = L._stampH || 0;
  if ((!ow || !oh) && L.stamp && L.stamp.length){
    ow = L.wrapW || s.w;
    oh = (L.stamp.length / ow) | 0;
  }
  var ns = new Uint8Array(n), nv = new Uint8Array(n);
  var c, r, ix;
  if (L.stamp && ow && oh){
    for (r = 0; r < Math.min(oh, s.h); r++)
      for (c = 0; c < Math.min(ow, s.w); c++){
        ix = r * ow + c;
        ns[r * s.w + c] = L.stamp[ix] || 0;
        if (L.stampVar) nv[r * s.w + c] = L.stampVar[ix] || 0;
      }
  } else if (L.base){
    for (r = 0; r < s.h; r++)
      for (c = 0; c < s.w; c++){
        if (!inRange(runtime.originC + c, runtime.originR + r)) continue;
        ix = r * runtime.MAP_W + c;
        ns[r * s.w + c] = L.base[ix] || 0;
        if (L.vary) nv[r * s.w + c] = L.vary[ix] || 0;
      }
  }
  L.stamp = ns;
  L.stampVar = nv;
  L._stampW = s.w;
  L._stampH = s.h;
  L._stampCan = null;
}

export function setLayerWrap(L, on){
  if (!L || !isTileLayer(L)) return false;
  if (on){
    if (L.collide && !collideCount(L)) return false;
    L.collide = false;
    L.wrap = true;
    if (!L.wrapW) L.wrapW = 8;
    if (!L.wrapH) L.wrapH = 8;
    ensureStamp(L);
    bindMain();
    return true;
  }
  L.wrap = false;
  if (!L.base){
    L.base = new Uint8Array(runtime.MAP_W * runtime.MAP_H);
    L.vary = new Uint8Array(runtime.MAP_W * runtime.MAP_H);
  }
  return true;
}

export function setWrapSize(L, w, h){
  if (!L) return;
  L.wrapW = Math.max(1, Math.min(WRAP_MAX, w | 0));
  L.wrapH = Math.max(1, Math.min(WRAP_MAX, h | 0));
  if (L.wrap) ensureStamp(L);
}

export function toggleSolo(id){
  runtime.soloLayer = runtime.soloLayer === id ? 0 : id;
}

function inRange(c, r){
  var lc = c - runtime.originC, lr = r - runtime.originR;
  return lc >= 0 && lr >= 0 && lc < runtime.MAP_W && lr < runtime.MAP_H;
}

export function layerTile(L, c, r){
  if (!L) return 0;
  if (L.wrap && L.stamp) return L.stamp[wrapIndex(L, c, r)] || 0;
  if (!L.base || !inRange(c, r)) return 0;
  return L.base[(r - runtime.originR) * runtime.MAP_W + (c - runtime.originC)];
}

export function layerVar(L, c, r){
  if (!L) return 0;
  if (L.wrap && L.stampVar) return L.stampVar[wrapIndex(L, c, r)] || 0;
  if (!L.vary || !inRange(c, r)) return 0;
  return L.vary[(r - runtime.originR) * runtime.MAP_W + (c - runtime.originC)];
}

function copyBuf(src){
  return src ? new Uint8Array(src) : null;
}

function dumpLayer(L){
  return {
    id: L.id, name: L.name, kind: layerKind(L),
    px: L.px, py: L.py,
    hue: L.hue || 0, sat: L.sat == null ? 1 : L.sat, bright: L.bright || 0,
    visible: L.visible !== false, locked: !!L.locked, collide: !!L.collide,
    wrap: !!L.wrap, wrapW: L.wrapW || 8, wrapH: L.wrapH || 8,
    amp: L.amp, y0: L.y0, color: L.color,
    period: L.period, hmin: L.hmin, hmax: L.hmax, col: L.col, colD: L.colD, seed: L.seed,
    base: copyBuf(L.base), vary: copyBuf(L.vary),
    stamp: copyBuf(L.stamp), stampVar: copyBuf(L.stampVar),
    _stampW: L._stampW || 0, _stampH: L._stampH || 0
  };
}

function loadLayer(L){
  var o = {
    id: L.id, name: L.name, kind: L.kind || 'tiles',
    px: L.px, py: L.py,
    hue: L.hue || 0, sat: L.sat == null ? 1 : L.sat, bright: L.bright || 0,
    visible: L.visible !== false, locked: !!L.locked, collide: !!L.collide,
    wrap: !!L.wrap, wrapW: L.wrapW || 8, wrapH: L.wrapH || 8,
    amp: L.amp, y0: L.y0, color: L.color,
    period: L.period, hmin: L.hmin, hmax: L.hmax, col: L.col, colD: L.colD, seed: L.seed,
    base: copyBuf(L.base), vary: copyBuf(L.vary),
    stamp: copyBuf(L.stamp), stampVar: copyBuf(L.stampVar),
    _stampW: L._stampW || 0, _stampH: L._stampH || 0
  };
  if (o.wrap) ensureStamp(o);
  return o;
}

export function snapshotLayers(){
  return {
    originC: runtime.originC,
    originR: runtime.originR,
    w: runtime.MAP_W,
    h: runtime.MAP_H,
    active: runtime.activeLayer,
    solo: runtime.soloLayer,
    layers: getLayers().map(dumpLayer)
  };
}

export function applyLayerSnap(s){
  if (!s) return;
  runtime.originC = s.originC;
  runtime.originR = s.originR;
  runtime.MAP_W = s.w;
  runtime.MAP_H = s.h;
  runtime.layers = (s.layers || []).map(loadLayer);
  bindMain();
  runtime.activeLayer = Math.max(0, Math.min(runtime.layers.length - 1, s.active | 0));
  runtime.soloLayer = s.solo || 0;
}

export function stashLayers(lv){
  if (!lv || !runtime.layers || !runtime.layers.length) return;
  lv._stash = {
    originC: runtime.originC, originR: runtime.originR,
    w: runtime.MAP_W, h: runtime.MAP_H,
    active: runtime.activeLayer, solo: runtime.soloLayer,
    decor: 1,
    layers: runtime.layers.map(dumpLayer)
  };
}

export function restoreLayers(lv){
  if (!lv || !lv._stash){ initDefaultLayers(); return false; }
  var s = lv._stash;
  runtime.originC = s.originC; runtime.originR = s.originR;
  runtime.MAP_W = s.w; runtime.MAP_H = s.h;
  runtime.layers = s.layers.map(loadLayer);
  var injected = s.decor ? 0 : ensureDecorLayers();
  ensureUniqueIds();
  bindMain();
  runtime.activeLayer = Math.max(0, Math.min(runtime.layers.length - 1, (s.active | 0) + injected));
  runtime.soloLayer = s.solo || 0;
  return true;
}
