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

export function layerShown(L, honorSolo){
  if (!L) return false;
  if (honorSolo && runtime.soloLayer) return L.id === runtime.soloLayer;
  return L.visible !== false;
}

export function lastCollideIndex(){
  var ls = getLayers(), last = -1, i;
  for (i = 0; i < ls.length; i++) if (ls[i].collide) last = i;
  return last;
}

export function firstCollide(){
  var ls = getLayers(), i;
  for (i = 0; i < ls.length; i++) if (ls[i].collide) return ls[i];
  return ls[0] || null;
}

export function bindMain(){
  var L = firstCollide();
  if (!L) return;
  runtime.base = L.base;
  runtime.vary = L.vary;
}

function nextId(){
  var ls = getLayers(), m = 0, i;
  for (i = 0; i < ls.length; i++) if ((ls[i].id | 0) > m) m = ls[i].id;
  return m + 1;
}

export function initDefaultLayers(){
  runtime.layers = [{
    id: 1, name: 'Main', px: 1, py: 1,
    visible: true, locked: false, collide: true,
    base: runtime.base, vary: runtime.vary
  }];
  runtime.activeLayer = 0;
  runtime.soloLayer = 0;
}

export function addLayer(name){
  var L = {
    id: nextId(),
    name: name || ('Layer ' + (getLayers().length + 1)),
    px: 1, py: 1, visible: true, locked: false, collide: false,
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

export function setLayerCollide(L, on){
  if (!L) return;
  if (!on){
    var ls = getLayers(), n = 0, i;
    for (i = 0; i < ls.length; i++) if (ls[i].collide && ls[i] !== L) n++;
    if (!n) return;
  }
  L.collide = !!on;
  if (L.collide){ L.px = 1; L.py = 1; }
  bindMain();
}

export function toggleSolo(id){
  runtime.soloLayer = runtime.soloLayer === id ? 0 : id;
}

function inRange(c, r){
  var lc = c - runtime.originC, lr = r - runtime.originR;
  return lc >= 0 && lr >= 0 && lc < runtime.MAP_W && lr < runtime.MAP_H;
}

export function layerTile(L, c, r){
  if (!L || !L.base || !inRange(c, r)) return 0;
  return L.base[(r - runtime.originR) * runtime.MAP_W + (c - runtime.originC)];
}

export function layerVar(L, c, r){
  if (!L || !L.vary || !inRange(c, r)) return 0;
  return L.vary[(r - runtime.originR) * runtime.MAP_W + (c - runtime.originC)];
}

export function stashLayers(lv){
  if (!lv || !runtime.layers || !runtime.layers.length) return;
  lv._stash = {
    originC: runtime.originC, originR: runtime.originR,
    w: runtime.MAP_W, h: runtime.MAP_H,
    active: runtime.activeLayer, solo: runtime.soloLayer,
    layers: runtime.layers.map(function(L){
      return {
        id: L.id, name: L.name, px: L.px, py: L.py,
        visible: L.visible !== false, locked: !!L.locked, collide: !!L.collide,
        base: new Uint8Array(L.base), vary: new Uint8Array(L.vary)
      };
    })
  };
}

export function restoreLayers(lv){
  if (!lv || !lv._stash){ initDefaultLayers(); return false; }
  var s = lv._stash;
  runtime.originC = s.originC; runtime.originR = s.originR;
  runtime.MAP_W = s.w; runtime.MAP_H = s.h;
  runtime.layers = s.layers.map(function(L){
    return {
      id: L.id, name: L.name, px: L.px, py: L.py,
      visible: L.visible !== false, locked: !!L.locked, collide: !!L.collide,
      base: new Uint8Array(L.base), vary: new Uint8Array(L.vary)
    };
  });
  bindMain();
  runtime.activeLayer = Math.max(0, Math.min(runtime.layers.length - 1, s.active | 0));
  runtime.soloLayer = s.solo || 0;
  return true;
}
