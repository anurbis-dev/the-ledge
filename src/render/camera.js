import GAME from '../core/game.js';
import { VW, VH } from './ctx.js';

export function clampCam(x, y){
  var T = GAME.T;
  return {
    x: Math.max(0, Math.min(GAME.MAP_W * T - VW, x)),
    y: Math.max(0, Math.min(GAME.MAP_H * T - VH, y))
  };
}
