import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';
import { startTalk, speechBlocks } from '../speech/runtime.js';
import { allocId } from './ids.js';

export function mkNpcs(){
  var LV = runtime.LV;
  return (LV.npcs || []).map(function(a, i){
    var tree = a[2] || 'hermit';
    return {
      id: i, x: a[0] * T + 3, y: (a[1] + 1) * T - 18, w: 10, h: 18,
      tree: tree, facing: a[3] != null ? a[3] : -1, ph: i * 1.3
    };
  });
}

export function mkNpcAt(S, x, y, tree, facing){
  S.npcs.push({
    id: allocId(S.npcs),
    x: x - 5, y: y - 18, w: 10, h: 18,
    tree: tree || 'hermit',
    facing: facing != null ? facing : -1,
    ph: Math.random() * 6
  });
  return S.npcs[S.npcs.length - 1];
}

export function tryTalk(S){
  if (speechBlocks(S)) return true;
  var p = S.p, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  var best = null, bd = 22 * 22, i, n, dx, dy, d;
  for (i = 0; i < (S.npcs || []).length; i++){
    n = S.npcs[i];
    dx = (n.x + n.w / 2) - cx;
    dy = (n.y + n.h / 2) - cy;
    d = dx * dx + dy * dy;
    if (d < bd){ bd = d; best = n; }
  }
  if (!best) return false;
  if (best.x + best.w / 2 < cx) best.facing = 1;
  else best.facing = -1;
  return startTalk(S, best);
}
