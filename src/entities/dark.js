import { runtime } from '../core/runtime.js';

export function mkDark(){
  var LV = runtime.LV;
  return LV.dark.map(function(d){
    return { x0:d.x0, y0:d.y0, x1:d.x1, y1:d.y1, doorId:d.doorId, lit:d.lit };
  });
}
export function inDark(S, px, py){
  for (var i = 0; i < S.dark.length; i++){
    var d = S.dark[i];
    if (px > d.x0 && px < d.x1 && py > d.y0 && py < d.y1) return d;
  }
  return null;
}
export function lightAt(S, px, py){
  var best = 0, i, dx, dy, r;
  var p = S.p;
  if (p.torch >= 0) return 0;                         // факел в руке — светло всегда
  for (i = 0; i < S.torches.length; i++){
    var t = S.torches[i];
    if (t.held) return 0;
    if (!t.lit) continue;
    dx = t.x - px; dy = (t.y - 8) - py; r = Math.sqrt(dx*dx + dy*dy);
    if (r < 1) r = 1;
    if (1/r > best) best = 1/r;
  }
  return best > 0 ? 1/best : 9999;                    // расстояние до ближайшего огня
}
export function stepDark(S, dt, oldX, oldY){
  var p = S.p;
  var d = inDark(S, p.x + p.w/2, p.y + p.h/2);
  S.darkNow = !!d;
  if (!d) { S.darkT = 0; return; }
  var dist = lightAt(S, p.x + p.w/2, p.y + p.h/2);
  S.darkDist = dist;
  if (dist > d.lit){
    // в кромешной тьме двигаться нельзя — откатываем шаг
    p.x = oldX; p.y = oldY; p.vx = 0;
    S.darkT = (S.darkT || 0) + dt;
    if (dist > d.lit * 2.2 && S.darkT > 0.8 && p.torch < 0){   // застряла в кромешной тьме
      p.state = 'warp'; p.vx = 0; p.vy = 0;
      p.hang = p.lad = p.climb = p.snap = null;
      p.warp = { to: d.doorId, t: 0, moved: false };
      S.darkT = 0;
      p.warp.restoreDark = true;
      p.events.push('lostdark');
    }
  } else S.darkT = 0;
}
