import { runtime } from '../core/runtime.js';

export function mkPickable(){
  var LV = runtime.LV;
  return { stick: { x: LV.stick.x, y: LV.stick.y, taken:false },
           key:   { x: LV.key.x,   y: LV.key.y,   taken:false } };
}
