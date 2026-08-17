import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { allocId } from './ids.js';

function normLight(raw, i){
  if (Array.isArray(raw)){
    return {
      id: i, x: raw[0] * T + 8, y: raw[1] * T + 8,
      color: raw[2] || '#ffbe74', intensity: raw[3] != null ? raw[3] : 1,
      radius: raw[4] || 82, lantern: true
    };
  }
  return {
    id: raw.id != null ? raw.id : i,
    x: raw.x, y: raw.y,
    color: raw.color || '#ffbe74',
    intensity: raw.intensity != null ? raw.intensity : 1,
    radius: raw.radius || 82,
    lantern: raw.lantern !== false
  };
}

export function mkLights(){
  var src = (runtime.LV && runtime.LV.lights) || [];
  return src.map(normLight);
}

export function mkLightAt(S, x, y){
  var o = {
    id: allocId(S.lights), x: x, y: y,
    color: '#ffbe74', intensity: 1, radius: 82, lantern: false
  };
  S.lights.push(o);
  return o;
}
