/* Per-level оверрайд движения героини поверх глобальных C.* (params.js).
   Хранится в LV.spawn.moveParams — как diff от глобального дефолта, тем же
   принципом что и saveParams() в editor/params.js. Одна героиня на уровень,
   поэтому оверрайд один активный набор, не per-instance. */
import { C } from './constants.js';
import { runtime } from './runtime.js';

/* STEP_UP намеренно не входит: это допуск снаппинга к тайловой сетке (геометрия
   коллизии), а не ощущение движения — используется и в паре мест без p в scope. */
export var HERO_MOVE_KEYS = [
  'RUN', 'ACC', 'FRIC', 'WALK_V', 'CROUCH_V', 'PRONE_V', 'DASH_V', 'SLOPE_ALONG',
  'GRAV', 'MAXFALL', 'JUMP', 'CUT', 'COYOTE', 'BUF',
  'SLIDE_V', 'WJ_X', 'WJ_Y', 'WJ_LOCK', 'WJ_SAME_X', 'WJ_SAME_Y'
];

export function buildMoveOverrides(){
  var spawn = runtime.LV && runtime.LV.spawn, mp = (spawn && spawn.moveParams) || null;
  var out = {}, i, k;
  for (i = 0; i < HERO_MOVE_KEYS.length; i++){
    k = HERO_MOVE_KEYS[i];
    out[k] = (mp && typeof mp[k] === 'number' && Number.isFinite(mp[k])) ? mp[k] : C[k];
  }
  return out;
}
