import GAME from '../core/game.js';
import { viewW, viewH } from './ctx.js';

export function clampCam(x, y){
  var T = GAME.T;
  var vw = viewW(), vh = viewH();
  var tw = GAME.MAP_W * T, th = GAME.MAP_H * T;
  return {
    x: tw <= vw ? (tw - vw) / 2 : Math.max(0, Math.min(tw - vw, x)),
    y: th <= vh ? (th - vh) / 2 : Math.max(0, Math.min(th - vh, y))
  };
}
