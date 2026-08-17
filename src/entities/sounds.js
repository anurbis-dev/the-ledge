import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { allocId } from './ids.js';

function normSound(raw, i){
  if (Array.isArray(raw)){
    return {
      id: i, x: raw[0] * T + 8, y: raw[1] * T + 8,
      mode: raw[2] || 'falloff',
      vol: raw[3] != null ? raw[3] : 0.4,
      radius: raw[4] || 96,
      freq: raw[5] || 220,
      type: raw[6] || 'sine'
    };
  }
  return {
    id: raw.id != null ? raw.id : i,
    x: raw.x, y: raw.y,
    mode: raw.mode || 'falloff',
    vol: raw.vol != null ? raw.vol : 0.4,
    radius: raw.radius || 96,
    freq: raw.freq || 220,
    type: raw.type || 'sine'
  };
}

export function mkSounds(){
  var src = (runtime.LV && runtime.LV.sounds) || [];
  return src.map(normSound);
}

export function mkSoundAt(S, x, y){
  var o = {
    id: allocId(S.sounds), x: x, y: y,
    mode: 'falloff', vol: 0.4, radius: 96, freq: 220, type: 'sine'
  };
  S.sounds.push(o);
  return o;
}
