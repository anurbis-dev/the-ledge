import { T, C, CRUMB } from '../core/constants.js';
import { runtime, mapIx, inMap } from '../core/runtime.js';
import { tileAt, solidTile } from '../core/map.js';
import { releaseHang } from '../core/player.js';

/* --- осыпающиеся карнизы --- */
export function touchCrumb(S, c, r){
  if (!inMap(c, r)) return;
  var k = mapIx(c, r);
  if (tileAt(c, r) !== CRUMB) return;
  if (S.gone[k] > 0) return;
  if (S.crumbT === undefined) S.crumbT = {};
  if (S.crumbT[k] === undefined){ S.crumbT[k] = C.CRUMB_T; S.p.events.push('crack'); }
}
export function stepCrumbs(S, dt){
  if (S.crumbT === undefined) S.crumbT = {};
  var k;
  for (k in S.crumbT){
    S.crumbT[k] -= dt;
    if (S.crumbT[k] <= 0){
      S.gone[k] = C.CRUMB_BACK; delete S.crumbT[k];
      S.shake = Math.max(S.shake, 3); S.p.events.push('crumble:' + k);
    }
  }
  for (k in S.gone){
    S.gone[k] -= dt;
    if (S.gone[k] <= 0) delete S.gone[k];
  }
}
export function crumbCheck(S, p){
  var c, r;
  if (p.state === 'hang' && p.hang && tileAt(p.hang.tc, p.hang.tr) === CRUMB){
    touchCrumb(S, p.hang.tc, p.hang.tr);
    if (!solidTile(p.hang.tc, p.hang.tr)) releaseHang(p, 0);
  }
  if (p.onGround){
    r = Math.floor((p.y + p.h + 2) / T);
    for (c = Math.floor(p.x / T); c <= Math.floor((p.x + p.w - 1) / T); c++) touchCrumb(S, c, r);
  }
}
