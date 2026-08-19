import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { allocId } from './ids.js';

function lightSpriteOf(raw){
  if (raw && raw.sprite) return raw.sprite;
  if (raw && raw.lantern === false) return 'none';
  return 'lantern';
}

function normLight(raw, i){
  var sprite;
  if (Array.isArray(raw)){
    sprite = raw[5] || 'lantern';
    return {
      id: i, x: raw[0] * T + 8, y: raw[1] * T + 8,
      color: raw[2] || '#ffbe74', intensity: raw[3] != null ? raw[3] : 1,
      radius: raw[4] || 82, lantern: sprite !== 'none', sprite: sprite
    };
  }
  sprite = lightSpriteOf(raw);
  return {
    id: raw.id != null ? raw.id : i,
    x: raw.x, y: raw.y,
    color: raw.color || '#ffbe74',
    intensity: raw.intensity != null ? raw.intensity : 1,
    radius: raw.radius || 82,
    lantern: sprite !== 'none',
    sprite: sprite
  };
}

export function mkLights(){
  var src = (runtime.LV && runtime.LV.lights) || [];
  return src.map(normLight);
}

export function mkLightAt(S, x, y){
  var o = {
    id: allocId(S.lights), x: x, y: y,
    color: '#ffbe74', intensity: 1, radius: 82, lantern: true, sprite: 'lantern'
  };
  S.lights.push(o);
  return o;
}
