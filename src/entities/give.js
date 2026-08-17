import { T, GIVE } from '../core/constants.js';
import { mapIx } from '../core/runtime.js';
import { tileAt } from '../core/map.js';

/* --- пружинящие блоки: чуть проседают и темнеют под ногами, потом сами выходят обратно --- */
export function stepGive(S, dt){
  if (S.giveT === undefined) S.giveT = {};
  var pressed = {}, p = S.p;
  if (p.onGround){
    var r = Math.floor((p.y + p.h + 2) / T);
    for (var c = Math.floor(p.x / T); c <= Math.floor((p.x + p.w - 1) / T); c++)
      if (tileAt(c, r) === GIVE) pressed[mapIx(c, r)] = true;
  }
  var k;
  for (k in pressed) if (S.giveT[k] === undefined) S.giveT[k] = 0;
  for (k in S.giveT){
    var tgt = pressed[k] ? 1 : 0;
    S.giveT[k] += (tgt - S.giveT[k]) * Math.min(1, dt * (tgt ? 14 : 6));
    if (!pressed[k] && S.giveT[k] < 0.01) delete S.giveT[k];
  }
}
