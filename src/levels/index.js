import { level as caves } from './caves.js';
import { level as cliff } from './cliff.js';
import { level as waterfall } from './waterfall.js';
import { level as halls } from './halls.js';
import { level as crucible } from './crucible.js';
import { runtime, resetMap } from '../core/runtime.js';
import { fillR } from '../core/map.js';
import { stashLayers, restoreLayers, initDefaultLayers } from '../core/layers.js';
import { flushLevel, forgetLevel } from '../core/persist.js';

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

function nextLevelId(){
  var max = 0, i, id;
  for (i = 0; i < LEVELS.length; i++){
    id = +LEVELS[i].id || 0;
    if (id > max) max = id;
  }
  return max + 1;
}

export function addBlankLevel(){
  var n = nextLevelId();
  var lv = {
    id: n, name: 'LEVEL ' + n, pal: 'stone', w: 16, h: 16, blank: true, intro: '',
    spawn: { x: 16, y: 6 * 16 - 22 },
    exit: { x: 12 * 16, y: 8 * 16 },
    lights: [], sounds: [], volumes: [],
    items: function(){ return []; },
    enemies: [], fliers: [], spiders: [], tendrils: [],
    torches: [], boulders: [], chests: [], npcs: [], doors: [], lifts: [], plats: [], dark: [],
    stick: { x: 40, y: 8 * 16 - 6 },
    key: { x: 56, y: 8 * 16 - 6 },
    build: function(){
      fillR(0, 8, 16, 1);
    }
  };
  LEVELS.push(lv);
  return LEVELS.length - 1;
}

export function removeLevel(i){
  if (LEVELS.length <= 1) return -1;
  var idx = Math.max(0, Math.min(LEVELS.length - 1, i | 0));
  var lv = LEVELS[idx];
  var deletingCurrent = runtime.LV === lv || runtime.LVI === idx;
  if (!deletingCurrent) flushLevel(runtime.W);
  LEVELS.splice(idx, 1);
  forgetLevel(lv);
  var next = Math.min(idx, LEVELS.length - 1);
  if (deletingCurrent){
    runtime.LV = null;
    runtime.LVI = next;
  } else if (runtime.LVI > idx){
    runtime.LVI--;
  }
  return deletingCurrent ? next : runtime.LVI;
}
