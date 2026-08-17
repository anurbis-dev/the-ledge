let originC = 0, originR = 0;
let MAP_W = 186, MAP_H = 48;
let base = new Uint8Array(MAP_W * MAP_H);
let LV = null, LVI = 0;
let W = null;                     // активный мир (для solid-запросов)
var GROW = 16;

export const runtime = {
  get originC(){ return originC; },
  set originC(v){ originC = v; },
  get originR(){ return originR; },
  set originR(v){ originR = v; },
  get MAP_W(){ return MAP_W; },
  set MAP_W(v){ MAP_W = v; },
  get MAP_H(){ return MAP_H; },
  set MAP_H(v){ MAP_H = v; },
  get base(){ return base; },
  set base(v){ base = v; },
  get LV(){ return LV; },
  set LV(v){ LV = v; },
  get LVI(){ return LVI; },
  set LVI(v){ LVI = v; },
  get W(){ return W; },
  set W(v){ W = v; }
};

export function getMAP_W(){ return runtime.MAP_W; }
export function getMAP_H(){ return runtime.MAP_H; }

export function mapMinC(){ return originC; }
export function mapMinR(){ return originR; }
export function mapMaxC(){ return originC + MAP_W; }
export function mapMaxR(){ return originR + MAP_H; }

export function inMap(c, r){
  var lc = c - originC, lr = r - originR;
  return lc >= 0 && lr >= 0 && lc < MAP_W && lr < MAP_H;
}

export function mapIx(c, r){
  return (r - originR) * MAP_W + (c - originC);
}

export function resetMap(w, h){
  originC = 0; originR = 0;
  MAP_W = Math.max(1, w); MAP_H = Math.max(1, h);
  base = new Uint8Array(MAP_W * MAP_H);
}

function remapPacked(obj, oc, or, ow, nc0, nr0, nw){
  if (!obj) return obj;
  var next = {}, k, oldIx, lc, lr;
  for (k in obj){
    oldIx = +k;
    if (!isFinite(oldIx)) continue;
    lc = oldIx % ow;
    lr = (oldIx / ow) | 0;
    next[(lr + or - nr0) * nw + (lc + oc - nc0)] = obj[k];
  }
  return next;
}

export function ensureMap(c, r){
  if (inMap(c, r)) return false;
  var oc = originC, or = originR, ow = MAP_W, oh = MAP_H;
  var nc0 = oc, nr0 = or, nc1 = oc + ow, nr1 = or + oh;
  if (c < oc) nc0 = oc - Math.ceil((oc - c) / GROW) * GROW;
  if (r < or) nr0 = or - Math.ceil((or - r) / GROW) * GROW;
  if (c >= oc + ow) nc1 = oc + ow + Math.ceil((c + 1 - oc - ow) / GROW) * GROW;
  if (r >= or + oh) nr1 = or + oh + Math.ceil((r + 1 - or - oh) / GROW) * GROW;
  var nw = nc1 - nc0, nh = nr1 - nr0;
  var next = new Uint8Array(nw * nh);
  for (var y = 0; y < oh; y++)
    next.set(base.subarray(y * ow, y * ow + ow), (y + or - nr0) * nw + (oc - nc0));
  if (W){
    if (W.gone) W.gone = remapPacked(W.gone, oc, or, ow, nc0, nr0, nw);
    if (W.crumbT) W.crumbT = remapPacked(W.crumbT, oc, or, ow, nc0, nr0, nw);
    if (W.gates) W.gates = remapPacked(W.gates, oc, or, ow, nc0, nr0, nw);
  }
  originC = nc0; originR = nr0; MAP_W = nw; MAP_H = nh; base = next;
  if (hooks.onGrowMap) hooks.onGrowMap();
  return true;
}

export function setWorld(S){ W = S; }

export const hooks = { gateClosed: (c, r) => false, onSetTile: null, onGrowMap: null };
