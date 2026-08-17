import { level as caves } from './caves.js';
import { level as cliff } from './cliff.js';
import { level as waterfall } from './waterfall.js';
import { level as halls } from './halls.js';
import { level as crucible } from './crucible.js';
import { runtime, resetMap } from '../core/runtime.js';

export const LEVELS = [caves, cliff, waterfall, halls, crucible];

export function loadLevel(i){
  runtime.LVI = Math.max(0, Math.min(LEVELS.length - 1, i));
  runtime.LV = LEVELS[runtime.LVI];
  resetMap(runtime.LV.w, runtime.LV.h);
  runtime.LV.build();
  return runtime.LV;
}
