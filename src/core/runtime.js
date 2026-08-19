let originC = 0, originR = 0;
let MAP_W = 186, MAP_H = 48;
let base = new Uint8Array(MAP_W * MAP_H);
let vary = new Uint8Array(MAP_W * MAP_H);   // ручной выбор узора тайла: 0 — авто (по хэшу), 1..N — конкретный вариант
let layers = [];
let activeLayer = 0;
let soloLayer = 0;
let LV = null, LVI = 0;
let W = null;                     // активный мир (для solid-запросов)
let roomsOn = null;               // null = не подменять cover (редактор); {}/map = активные комнаты
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
  get vary(){ return vary; },
  set vary(v){ vary = v; },
  get layers(){ return layers; },
  set layers(v){ layers = v || []; },
  get activeLayer(){ return activeLayer; },
  set activeLayer(v){ activeLayer = v; },
  get soloLayer(){ return soloLayer; },
  set soloLayer(v){ soloLayer = v; },
  get LV(){ return LV; },
  set LV(v){ LV = v; },
  get LVI(){ return LVI; },
  set LVI(v){ LVI = v; },
  get W(){ return W; },
  set W(v){ W = v; },
  get roomsOn(){ return roomsOn; },
  set roomsOn(v){ roomsOn = v; }
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
  vary = new Uint8Array(MAP_W * MAP_H);
  layers = [];
  activeLayer = 0;
  soloLayer = 0;
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
  function growBuf(src){
    var out = new Uint8Array(nw * nh);
    for (var y = 0; y < oh; y++)
      out.set(src.subarray(y * ow, y * ow + ow), (y + or - nr0) * nw + (oc - nc0));
    return out;
  }
  if (layers && layers.length){
    for (var i = 0; i < layers.length; i++){
      if (!layers[i].base) continue;
      layers[i].base = growBuf(layers[i].base);
      layers[i].vary = growBuf(layers[i].vary || new Uint8Array(ow * oh));
      if (layers[i].cover) layers[i].cover = growBuf(layers[i].cover);
      if (layers[i].coverVary) layers[i].coverVary = growBuf(layers[i].coverVary);
      layers[i].roomOf = null;
      layers[i]._roomsDirty = true;
      layers[i]._chunks = {};
    }
    var main = null;
    for (i = 0; i < layers.length; i++) if (layers[i].collide && layers[i].base){ main = layers[i]; break; }
    if (!main){
      for (i = 0; i < layers.length; i++) if (layers[i].base){ main = layers[i]; break; }
    }
    if (main){ base = main.base; vary = main.vary; }
  } else {
    base = growBuf(base);
    vary = growBuf(vary);
  }
  if (W){
    if (W.gone) W.gone = remapPacked(W.gone, oc, or, ow, nc0, nr0, nw);
    if (W.crumbT) W.crumbT = remapPacked(W.crumbT, oc, or, ow, nc0, nr0, nw);
    if (W.gates) W.gates = remapPacked(W.gates, oc, or, ow, nc0, nr0, nw);
  }
  originC = nc0; originR = nr0; MAP_W = nw; MAP_H = nh;
  if (hooks.onGrowMap) hooks.onGrowMap();
  return true;
}

export function setWorld(S){ W = S; }

export const hooks = { gateClosed: (c, r) => false, onSetTile: null, onGrowMap: null, onRoomsChange: null };
