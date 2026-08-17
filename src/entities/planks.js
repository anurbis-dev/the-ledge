import { C, PLANK } from '../core/constants.js';
import { mapIx, inMap } from '../core/runtime.js';
import { tileAt } from '../core/map.js';

/* --- деревянные настилы: горящий факел поджигает, через PLANK_BURN сек. настил сгорает угольками навсегда --- */
export function ignitePlank(S, c, r){
  if (!inMap(c, r)) return;
  if (tileAt(c, r) !== PLANK) return;
  var k = mapIx(c, r);
  if (S.burnt === undefined) S.burnt = {};
  if (S.burnt[k]) return;
  if (S.plankT === undefined) S.plankT = {};
  if (S.plankT[k] === undefined){ S.plankT[k] = C.PLANK_BURN; S.p.events.push('plankburn:' + k); }
}
export function stepPlanks(S, dt){
  if (S.plankT === undefined) S.plankT = {};
  for (var k in S.plankT){
    S.plankT[k] -= dt;
    if (S.plankT[k] <= 0){
      if (S.burnt === undefined) S.burnt = {};
      S.burnt[k] = true; delete S.plankT[k];
      S.shake = Math.max(S.shake, 2); S.p.events.push('plankgone:' + k);
    }
  }
}
