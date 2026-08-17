import { level as caves } from './caves.js';
import { level as cliff } from './cliff.js';
import { level as waterfall } from './waterfall.js';
import { level as halls } from './halls.js';
import { level as crucible } from './crucible.js';
import { runtime, resetMap } from '../core/runtime.js';
import { fillR } from '../core/map.js';
import { stashLayers, restoreLayers, initDefaultLayers } from '../core/layers.js';
import { flushLevel } from '../core/persist.js';

export const LEVELS = [caves, cliff, waterfall, halls, crucible];

export function loadLevel(i){
  flushLevel(runtime.W);
  stashLayers(runtime.LV);
  runtime.LVI = Math.max(0, Math.min(LEVELS.length - 1, i));
  runtime.LV = LEVELS[runtime.LVI];
  if (runtime.LV._stash){
    restoreLayers(runtime.LV);
  } else {
    resetMap(runtime.LV.w, runtime.LV.h);
    runtime.LV.build();
    initDefaultLayers();
  }
  return runtime.LV;
}

export function addBlankLevel(){
  var n = LEVELS.length + 1;
  var lv = {
    id: n, name: 'LEVEL ' + n, pal: 'stone', w: 16, h: 16, blank: true,
    spawn: { x: 16, y: 6 * 16 - 22 },
    exit: { x: 12 * 16, y: 8 * 16 },
    lights: [], sounds: [], volumes: [],
    items: function(){ return []; },
    enemies: [], fliers: [], spiders: [], tendrils: [],
    torches: [], chests: [], doors: [], lifts: [], plats: [], dark: [],
    stick: { x: 40, y: 8 * 16 - 6 },
    key: { x: 56, y: 8 * 16 - 6 },
    build: function(){
      fillR(0, 8, 16, 1);
    }
  };
  LEVELS.push(lv);
  return LEVELS.length - 1;
}
