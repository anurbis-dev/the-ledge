import GAME from '../core/game.js';
import { hooks } from '../core/runtime.js';
import { ctx, cam, view, VW, VH, rc, lb, setCtx, getCtx, world } from './ctx.js';
import { P, TINT, palRev } from './palette.js';

var G = GAME, T = G.T;

export function drawLadder(c, r, v, x, y){
  var i;
  if (v === G.LADR || v === G.LADL){
    var d = v === G.LADR ? 1 : -1;
    var a = [x + (d>0?0:16), y+16], b = [x + (d>0?16:0), y];
    lb([a[0]-d*2,a[1]-4],[b[0]-d*2,b[1]-4], 2, P.woodD);
    lb([a[0]+d*3,a[1]+3],[b[0]+d*3,b[1]+3], 2, P.wood);
    for (i = 2; i < 16; i += 5){
      var px = a[0] + d*i, py = a[1] - i;
      lb([px-d*3,py-5],[px+d*4,py+4], 2, P.woodL);
    }
    return;
  }
  if (v === G.LADF){
    rc(x+1, y, 14, 16, '#241c3d');
    rc(x+1, y, 2, 16, P.woodD); rc(x+13, y, 2, 16, P.woodD);
    rc(x+1, y, 1, 16, P.wood);  rc(x+13, y, 1, 16, P.wood);
    for (i = 2; i < 16; i += 5){
      rc(x+3, y+i, 10, 2, P.wood); rc(x+3, y+i, 10, 1, P.woodL);
    }
    rc(x+4, y, 8, 1, '#00000044');
    return;
  }
  // вид в профиль: одна стойка и короткие перекладины
  rc(x+7, y, 2, 16, P.woodD);
  rc(x+7, y, 1, 16, P.woodL);
  for (i = 1; i < 16; i += 5){
    rc(x+4, y+i, 8, 2, P.wood);
    rc(x+4, y+i, 8, 1, P.woodL);
    rc(x+3, y+i, 1, 2, P.woodD); rc(x+12, y+i, 1, 2, P.woodD);
  }
}
export function grabby(c, r){
  return G.solidTile(c,r) && !G.solidTile(c,r-1) && (!G.solidTile(c-1,r) || !G.solidTile(c+1,r));
}
export function hashT(c, r){ var h = (c*73856093) ^ (r*19349663); h = (h ^ (h >> 13)) >>> 0; return h; }
export function drawTile(c, r, x, y, dyn){
  var v = G.tileAt(c, r);
  var time = view.time;
  var S = world();
  if (G.isLadV(v)){ drawLadder(c, r, v, x, y); return; }
  if (v === G.WATER || v === G.FALL){
    var deepW = r > 30;
    var w0 = deepW ? '#1d5a86' : '#2a78a8', w1 = deepW ? '#2f7fae' : '#49a0cf';
    rc(x, y, T, T, w0);
    if (v === G.FALL){                                   // поток: вертикальные струи
      for (var s2 = 0; s2 < 4; s2++){
        var off = Math.round((time*70 + s2*23 + c*11) % T);
        rc(x + 1 + s2*4, y + off - T, 2, T, w1);
        rc(x + 1 + s2*4, y + ((off + 8) % T), 2, 3, '#bfe6ff');
      }
      rc(x, y, T, 1, '#8fd0ef');
    } else {                                             // спокойная вода: бегущая волна
      var top = !G.isWaterV(G.tileAt(c, r - 1));
      for (var wx = 0; wx < T; wx += 2){
        var ph2 = (c*T + wx) * 0.09 - time * 2.2;
        var wv = Math.round(Math.sin(ph2) * 1.6 + Math.sin(ph2*2.3) * 0.7);
        if (top){
          rc(x + wx, y + 1 + wv, 2, 2, w1);
          rc(x + wx, y + wv, 2, 1, '#bfe6ff');
        }
        rc(x + wx, y + 7 + Math.round(Math.sin(ph2*1.4)*1.2), 2, 1, w1);
      }
      ctx.globalAlpha = 0.4;                              // вторая волна: медленнее и прозрачнее
      for (var wx2 = 0; wx2 < T; wx2 += 2){
        var ph3 = (c*T + wx2) * 0.062 - time * 1.25 + 1.9;
        var wv2 = Math.round(Math.sin(ph3) * 2.1);
        if (top) rc(x + wx2, y + 2 + wv2, 2, 2, '#dff2ff');
        rc(x + wx2, y + 10 + Math.round(Math.sin(ph3*1.1)*1.4), 2, 1, '#9fd0ef');
      }
      ctx.globalAlpha = 1;
      if ((c*7 + r*3) % 4 === 0){                          // пузырьки со дна
        var bz = ((time*22 + c*9) % 16) | 0;
        rc(x + 4 + ((c*3)%8), y + 15 - bz, 1, 1, '#bfe6ff');
      }
      rc(x + ((c*7)%9), y + 12, 2, 1, '#6fb8dd');
    }
    return;
  }
  if (G.isSlopeV(v)){                                    // скос
    var up = (v === G.SLR || v === G.LADR);
    var deepS = r > 30;
    var bsS = deepS ? TINT.deepA : TINT.rock, bdS = deepS ? TINT.deepB : TINT.rockD, blS = deepS ? TINT.deepC : TINT.rockL;
    ctx.fillStyle = bsS;
    ctx.beginPath();
    if (up){ ctx.moveTo(x, y + T); ctx.lineTo(x + T, y); ctx.lineTo(x + T, y + T); }
    else   { ctx.moveTo(x, y); ctx.lineTo(x + T, y + T); ctx.lineTo(x, y + T); }
    ctx.closePath(); ctx.fill();
    for (var k2 = 0; k2 < T; k2 += 2){                   // кромка ровно по линии склона
      var yy = up ? (y + T - k2 - 1) : (y + k2);
      rc(x + k2, yy, 2, 2, P.edgeL);
      rc(x + k2, yy + 2, 2, 1, bdS);
    }
    if (hashT(c, r) % 3 === 0) rc(x + 6, y + 10, 3, 1, blS);
    return;
  }
  if (v === G.BAR){                                  // потолочные перекладины
    rc(x, y, T, 3, P.woodD); rc(x, y, T, 1, P.wood);
    rc(x + 2, y + 3, 2, 4, P.woodD); rc(x + T - 4, y + 3, 2, 4, P.woodD);
    rc(x + 6, y + 3, 4, 6, P.wood); rc(x + 6, y + 3, 4, 1, P.woodL);
    return;
  }
  if (v === G.HTOP){                                 // полутайл-потолок
    rc(x, y, T, 8, P.rock);
    rc(x, y + 6, T, 2, P.rockD);
    rc(x + 3, y + 1, 3, 1, P.rockL); rc(x + 10, y + 3, 2, 1, P.rockL);
    rc(x + ((c*5)%12), y + 8, 2, 2, P.rockX);
    return;
  }
  if (!G.isSolidV(v)) return;
  var k = r*G.MAP_W + c, crumb = (v === G.CRUMB), hh = hashT(c, r);
  if (crumb && !G.solidTile(c, r)){
    rc(x+2, y+5, 3, 2, P.crumD); rc(x+9, y+8, 2, 2, P.crumD); return;
  }
  var sx = 0;
  if (crumb && S.crumbT && S.crumbT[k] !== undefined) sx = Math.round(Math.sin(time*46)*1.2);
  var deep = r > 30;
  var biome = deep ? 2 : (c > 112 ? 1 : 0);
  var bs, bd, bl;
  if (crumb){ bs = P.crum; bd = P.crumD; bl = P.crumL; }
  else if (biome === 2){ bs = '#55507e'; bd = '#3b3660'; bl = '#7f78ab'; }
  else if (biome === 1){ bs = '#6b5f74'; bd = '#4a4055'; bl = '#94879c'; }
  else { bs = P.rock; bd = P.rockD; bl = P.rockL; }
  var variant = hh % 8;
  rc(x+sx, y, T, T, bs);
  if (variant === 0){
    rc(x+sx, y+9, T, 1, bd); rc(x+sx+((r%2)?4:12), y, 1, 9, bd); rc(x+sx+((r%2)?12:4), y+10, 1, 6, bd);
  } else if (variant === 1){
    rc(x+sx, y+6, T, 1, bd); rc(x+sx, y+12, T, 1, bd); rc(x+sx+7, y, 1, 6, bd); rc(x+sx+3, y+7, 1, 5, bd);
  } else if (variant === 2){
    rc(x+sx, y+8, T, 1, bd); rc(x+sx+5, y+9, 1, 7, bd); rc(x+sx+11, y, 1, 8, bd); rc(x+sx+2, y+2, 3, 2, bd);
  } else if (variant === 3){
    rc(x+sx, y+10, T, 1, bd); rc(x+sx+9, y, 1, 10, bd);
    rc(x+sx+2, y+12, 2, 2, bd); rc(x+sx+12, y+12, 2, 2, bd);
  } else if (variant === 4){
    rc(x+sx, y+7, T, 1, bd); rc(x+sx+6, y+8, 1, 8, bd);
    rc(x+sx+1, y+1, 2, 1, bl); rc(x+sx+12, y+3, 2, 1, bd);
  } else if (variant === 5){
    rc(x+sx, y+11, T, 1, bd); rc(x+sx+1, y+1, T-2, 1, bl);
    rc(x+sx+1, y+1, 1, 9, bl); rc(x+sx+T-2, y+2, 1, 9, bd);
  } else if (variant === 6){
    rc(x+sx, y+5, T, 1, bd); rc(x+sx, y+11, T, 1, bd);
    rc(x+sx+5, y, 1, 5, bd); rc(x+sx+10, y+6, 1, 5, bd); rc(x+sx+3, y+12, 1, 4, bd);
    rc(x+sx+7, y+2, 2, 1, bl); rc(x+sx+2, y+8, 2, 1, bl);
  } else {
    rc(x+sx, y+9, T, 1, bd);
    rc(x+sx+2, y, 1, 9, bd); rc(x+sx+9, y, 1, 9, bd); rc(x+sx+6, y+10, 1, 6, bd);
    rc(x+sx+12, y+11, 3, 1, bl);
  }
  if (biome === 1){
    if (hh % 5 === 0) rc(x+sx+3, y+2, 9, 1, bl);
    if (hh % 8 === 0){ rc(x+sx+2, y+6, 1, 8, '#3d3448'); rc(x+sx+12, y+4, 1, 9, '#3d3448'); }
  }
  if (hh % 7 === 0){ rc(x+sx+3, y+4, 4, 1, bl); rc(x+sx+4, y+5, 2, 1, bl); }
  if (hh % 11 === 0){ rc(x+sx+10, y+2, 1, 5, bd); rc(x+sx+11, y+5, 1, 3, bd); }
  if (hh % 13 === 0) rc(x+sx+7, y+11, 2, 2, bl);
  if (deep && hh % 9 === 0){ rc(x+sx+4, y+3, 2, 2, '#4d7fa8'); rc(x+sx+5, y+4, 1, 1, '#8fd0ef'); }
  rc(x+sx+2, y+3, 2, 1, bl); rc(x+sx+10, y+12, 2, 1, bl);
  if (crumb){ rc(x+sx+3, y+2, 1, 6, P.crumD); rc(x+sx+8, y+6, 1, 7, P.crumD); rc(x+sx+11, y+3, 1, 4, P.crumD); }
  if (!G.solidTile(c, r-1)){
    if (grabby(c, r)){
      rc(x+sx, y, T, 2, P.edge); rc(x+sx, y, T, 1, P.edgeL); rc(x+sx, y+2, T, 1, P.edgeD);
      var oc = !G.solidTile(c-1, r) ? 0 : T-2;
      rc(x+sx+oc, y+2, 2, 4, P.edgeD); rc(x+sx+oc, y+2, 1, 3, P.edge);
    } else if (deep){
      rc(x+sx, y, T, 2, '#6c65a0'); rc(x+sx, y+2, T, 1, bd);
      if (hh % 5 === 0){ rc(x+sx+3, y-3, 2, 3, '#6f9c72'); rc(x+sx+9, y-2, 2, 2, '#6f9c72'); }
    } else {
      rc(x+sx, y, T, 3, P.moss); rc(x+sx, y+3, T, 1, P.mossD); rc(x+sx, y, T, 1, P.rockL);
      if (hh % 4 === 0){ rc(x+sx+((hh>>3)%12), y-3, 2, 3, P.mossD); rc(x+sx+((hh>>3)%12), y-4, 1, 1, P.moss); }
      if (hh % 6 === 0) rc(x+sx+((hh>>5)%13), y-2, 1, 2, '#7fc47f');
    }
  }
  // автоскругление внешних углов: срезаем пиксели там, где сходятся две открытые стороны
  var openU = !G.solidTile(c, r-1), openD = !G.solidTile(c, r+1);
  var openL = !G.solidTile(c-1, r), openR = !G.solidTile(c+1, r);
  if (openU && openL){ rc(x+sx, y, 2, 1, bd); rc(x+sx, y, 1, 2, bd); rc(x+sx, y, 1, 1, bl); }
  if (openU && openR){ rc(x+sx+T-2, y, 2, 1, bd); rc(x+sx+T-1, y, 1, 2, bd); }
  if (openD && openL){ rc(x+sx, y+T-1, 2, 1, bd); rc(x+sx, y+T-2, 1, 2, bd); }
  if (openD && openR){ rc(x+sx+T-2, y+T-1, 2, 1, bd); rc(x+sx+T-1, y+T-2, 1, 2, bd); }
  if (!G.solidTile(c, r+1)){
    rc(x+sx, y+T-1, T, 1, P.rockX);
    if (hh % 5 === 0){ rc(x+sx+4, y+T, 1, 3, bd); rc(x+sx+10, y+T, 1, 2, bd); }
  }
  if (!G.solidTile(c-1, r)) rc(x+sx, y, 1, T, P.rockX);
  if (!G.solidTile(c+1, r)) rc(x+sx+T-1, y, 1, T, bl);
}

/* --- кэш статичных тайлов чанками 8x8; осыпающиеся рисуем каждый кадр --- */
export const CH = 8, PAD = 6;
export let chunkCache = {};
var cacheRev = -1;
function syncPal(){
  if (cacheRev !== palRev){ chunkCache = {}; cacheRev = palRev; }
}

export function invalidateChunk(c, r){
  for (var dr = -1; dr <= 1; dr++)
    for (var dc = -1; dc <= 1; dc++){
      var cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= G.MAP_W || rr >= G.MAP_H) continue;
      delete chunkCache[(cc / CH | 0) + ',' + (rr / CH | 0)];
    }
}
hooks.onSetTile = invalidateChunk;
export function invalidateAll(){
  chunkCache = {};
}

export function chunkOf(cx, cy){
  syncPal();
  var key = cx + ',' + cy, ch = chunkCache[key];
  if (ch) return ch;
  var cv2 = document.createElement('canvas');
  cv2.width = CH*T + PAD*2; cv2.height = CH*T + PAD*2;
  var g2 = cv2.getContext('2d');
  g2.imageSmoothingEnabled = false;
  var saved = getCtx();
  setCtx(g2);                       // rc/lb пишут в чанк
  try {
    for (var r = cy*CH; r < (cy+1)*CH; r++){
      for (var c = cx*CH; c < (cx+1)*CH; c++){
        if (c < 0 || r < 0 || c >= G.MAP_W || r >= G.MAP_H) continue;
        var vv0 = G.tileAt(c, r);
        if (vv0 === G.CRUMB || vv0 === G.WATER || vv0 === G.FALL) continue;   // динамика — мимо кэша
        drawTile(c, r, (c - cx*CH)*T + PAD, (r - cy*CH)*T + PAD, false);
      }
    }
  } finally {
    setCtx(saved);
  }
  chunkCache[key] = cv2;
  return cv2;
}
export function tiles(){
  syncPal();
  var c0 = Math.max(0, ((cam.x/T)|0) - 1), c1 = Math.min(G.MAP_W-1, ((cam.x+VW)/T|0) + 1);
  var r0 = Math.max(0, ((cam.y/T)|0) - 1), r1 = Math.min(G.MAP_H-1, ((cam.y+VH)/T|0) + 1);
  var x0 = Math.floor(c0/CH), x1 = Math.floor(c1/CH);
  var y0 = Math.floor(r0/CH), y1 = Math.floor(r1/CH);
  for (var cy = y0; cy <= y1; cy++)
    for (var cx = x0; cx <= x1; cx++)
      ctx.drawImage(chunkOf(cx, cy), Math.round(cx*CH*T - cam.x) - PAD, Math.round(cy*CH*T - cam.y) - PAD);
  for (var r = r0; r <= r1; r++){
    for (var c = c0; c <= c1; c++){
      var vd = G.tileAt(c, r);
      if (vd === G.CRUMB || vd === G.WATER || vd === G.FALL)
        drawTile(c, r, c*T - cam.x, r*T - cam.y, true);
    }
  }
}
