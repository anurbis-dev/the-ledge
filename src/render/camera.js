import GAME from '../core/game.js';
import { view, viewW, viewH } from './ctx.js';

export function clampCam(x, y){
  if (view.edit) return { x: x, y: y };
  var T = GAME.T;
  var vw = viewW(), vh = viewH();
  var x0 = GAME.mapMinC() * T, y0 = GAME.mapMinR() * T;
  var tw = GAME.MAP_W * T, th = GAME.MAP_H * T;
  return {
    x: tw <= vw ? x0 + (tw - vw) / 2 : Math.max(x0, Math.min(x0 + tw - vw, x)),
    y: th <= vh ? y0 + (th - vh) / 2 : Math.max(y0, Math.min(y0 + th - vh, y))
  };
}
