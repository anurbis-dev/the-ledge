import { T, C } from '../core/constants.js';
import { mapIx, inMap, hooks } from '../core/runtime.js';
import { tileAt, solidTile, isWaterV } from '../core/map.js';
import { tileDurability } from '../core/tileset.js';

/* кирка: копает тайл под ногами следующий по направлению; если впереди стена — копает её */
export function tryDig(S){
  var p = S.p;
  if (p.state !== 'normal' || !p.onGround || p.digT > 0 || p.digCd > 0) return false;
  var col = Math.floor((p.x + p.w / 2) / T) + p.facing;
  var bodyR = Math.floor((p.y + p.h / 2) / T);
  var footR = Math.floor((p.y + p.h + 2) / T);
  var wallHit = inMap(col, bodyR) && solidTile(col, bodyR);
  var r = wallHit ? bodyR : footR;
  if (!inMap(col, r)) return false;
  var tid = tileAt(col, r);
  if (isWaterV(tid)) return false;
  if (!solidTile(col, r)) return false;
  var k = mapIx(col, r);
  var dur = tileDurability(tid);
  p.digT = C.DIG_T; p.digCd = C.DIG_T + C.DIG_CD; p.digMode = wallHit ? 'dig' : 'digDown';
  if (dur <= 0){ p.events.push('digclank:' + k); return true; }
  if (!S.digHp) S.digHp = {};
  if (S.digHp[k] == null) S.digHp[k] = dur;
  S.digHp[k]--;
  if (S.digHp[k] <= 0){
    delete S.digHp[k];
    S.gone[k] = 1;
    if (hooks.onSetTile) hooks.onSetTile(col, r);
    p.events.push('digbreak:' + k);
  } else {
    p.events.push('dighit:' + k);
  }
  return true;
}
