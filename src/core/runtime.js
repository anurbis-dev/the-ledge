let MAP_W = 186, MAP_H = 48;
let base = new Uint8Array(MAP_W * MAP_H);
let LV = null, LVI = 0;
let W = null;                     // активный мир (для solid-запросов)

export const runtime = {
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

export function resetMap(w, h){
  MAP_W = w; MAP_H = h; base = new Uint8Array(w * h);
}

export function setWorld(S){ W = S; }

export const hooks = { gateClosed: (c, r) => false, onSetTile: null };
