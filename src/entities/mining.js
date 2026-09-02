import { T, C } from '../core/constants.js';
import { mapIx, inMap, hooks, runtime, mapMinC, mapMinR } from '../core/runtime.js';
import { tileAt, solidTile, isWaterV, rectFree } from '../core/map.js';
import { tileDurability } from '../core/tileset.js';

/* общий разрыв тайла — переиспользуется кнопочным копанием (tryDig) и контактным уроном
 * (stepContactDamage): списывает digHp, помечает тайл ушедшим, инвалидирует чанк-кэш. */
export function breakTile(S, col, row){
  var k = mapIx(col, row);
  delete S.digHp[k];
  S.gone[k] = 1;
  if (hooks.onSetTile) hooks.onSetTile(col, row);
  S.p.events.push('digbreak:' + k);
}

function shakeTile(S, col, row){
  var k = mapIx(col, row);
  if (!S.digShakeT) S.digShakeT = {};
  S.digShakeT[k] = C.DIG_SHAKE_T;
  if (hooks.onSetTile) hooks.onSetTile(col, row);
}

/* короткая тряска тайла от удара киркой — сама по себе гаснет, не связана с длительностью digHp.
 * Пока идёт (isDamaged() в render/tiles.js), тайл исключён из чанк-кэша — invalidateChunk на входе
 * и на выходе, иначе останется дублирующийся статичный слой под анимацией или дыра после её конца. */
export function stepDigShake(S, dt){
  if (!S.digShakeT) return;
  var k, w = runtime.MAP_W;
  for (k in S.digShakeT){
    S.digShakeT[k] -= dt;
    if (S.digShakeT[k] <= 0){
      delete S.digShakeT[k];
      if (hooks.onSetTile){
        var ik = +k;
        hooks.onSetTile((ik % w) + mapMinC(), ((ik / w) | 0) + mapMinR());
      }
    }
  }
}

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
  if (S.digHp[k] <= 0) breakTile(S, col, r);
  else { shakeTile(S, col, r); p.events.push('dighit:' + k); }
  return true;
}

/* урон-от-движения: ломает стену впереди по ходу движения без инструмента, пока
 * эффективный dmg (базовый игрока или транспорта, за рулём которого он сидит) > 0.
 * Переиспользует тот же S.digHp/S.gone, что и tryDig — оба источника урона по одному
 * тайлу консистентны (общий счётчик, кто первый доломает). */
export function stepContactDamage(S, dt){
  var p = S.p;
  if (p.state !== 'normal' || !p.onGround || !p.facing) return;
  var dmg = Math.max(C.PLAYER_DMG, (p.mount && p.mount.dmg) || 0);
  if (dmg <= 0) return;
  if (rectFree(p.x + p.facing * 2, p.y, p.w, p.h)) return;
  var col = Math.floor((p.x + p.w / 2) / T) + p.facing;
  var row = Math.floor((p.y + p.h / 2) / T);
  if (!inMap(col, row) || !solidTile(col, row)) return;
  var tid = tileAt(col, row);
  if (isWaterV(tid)) return;
  var dur = tileDurability(tid);
  if (dur <= 0) return;
  var k = mapIx(col, row);
  if (!S.digHp) S.digHp = {};
  if (S.digHp[k] == null) S.digHp[k] = dur;
  S.digHp[k] -= dmg * C.CONTACT_DMG_RATE * dt;
  if (S.digHp[k] <= 0) breakTile(S, col, row);
  else shakeTile(S, col, row);
}
