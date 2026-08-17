import { T } from '../core/constants.js';
import { runtime } from '../core/runtime.js';

export function mkItems(){
  var LV = runtime.LV;
  var raw = LV.items;
  if (typeof raw === 'function') raw = raw();
  if (!raw) raw = [];
  return raw.map(function(a, i){
    return { id:i, x:a[0]*T+8, y:a[1]*T+8+(a[3]||0), kind:a[2], got:false, ph:(i*37%100)/100*6.28 };
  });
}

/* --- сбор --- */
export function pickups(S, p){
  for (var i = 0; i < S.items.length; i++){
    var it = S.items[i];
    if (it.got) continue;
    if (Math.abs(it.x - (p.x + p.w/2)) < 11 && Math.abs(it.y - (p.y + p.h/2)) < 13){
      it.got = true; S.bag[it.kind]++;
      if (it.kind === 'shroom' && S.hp < 3) S.hp++;

      S.hitStop = Math.max(S.hitStop, it.kind === 'relic' ? 0.25 : 0.03);
      p.events.push('pick:' + it.kind + ':' + it.id);
    }
  }
}
