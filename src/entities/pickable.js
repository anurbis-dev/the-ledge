import { runtime } from '../core/runtime.js';

export function mkPickable(){
  var LV = runtime.LV;
  var st = LV.stick || { x: 40, y: 8 * 16 - 6 };
  var ky = LV.key || { x: 56, y: 8 * 16 - 6 };
  return { stick: { x: st.x, y: st.y, taken:false },
           key:   { x: ky.x, y: ky.y, taken:false } };
}
