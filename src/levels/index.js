import { level as caves } from './caves.js';
import { level as cliff } from './cliff.js';
import { level as waterfall } from './waterfall.js';
import { level as halls } from './halls.js';
import { level as crucible } from './crucible.js';
import { runtime, resetMap } from '../core/runtime.js';
import { fillR } from '../core/map.js';

export const LEVELS = [caves, cliff, waterfall, halls, crucible];

export function loadLevel(i){
  runtime.LVI = Math.max(0, Math.min(LEVELS.length - 1, i));
  runtime.LV = LEVELS[runtime.LVI];
  resetMap(runtime.LV.w, runtime.LV.h);
  runtime.LV.build();
  return runtime.LV;
}

export function addBlankLevel(){
  var n = LEVELS.length + 1;
  var lv = {
    id: n, name: 'LEVEL ' + n, pal: 'stone', w: 80, h: 48, blank: true,
    spawn: { x: 48, y: 20 * 16 - 22 },
    exit: { x: 70 * 16, y: 22 * 16 },
    lights: [],
    items: function(){ return []; },
    enemies: [], fliers: [], spiders: [], tendrils: [],
    torches: [], chests: [], doors: [], lifts: [], plats: [], dark: [],
    stick: { x: 80, y: 22 * 16 - 4 },
    key: { x: 96, y: 22 * 16 - 4 },
    build: function(){
      fillR(0, 0, 2, runtime.MAP_H);
      fillR(runtime.MAP_W - 2, 0, 2, runtime.MAP_H);
      fillR(0, 22, runtime.MAP_W, 2);
    }
  };
  LEVELS.push(lv);
  return LEVELS.length - 1;
}
