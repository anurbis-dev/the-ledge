import GAME from '../core/game.js';
import { hooks } from '../core/runtime.js';
import { COVER_AIR, coverRaw, coverVarRaw, roomCoverA, rebuildRooms } from '../core/rooms.js';
import { getLayers, layerShown, lastCollideIndex, layerTileRaw, layerVarRaw, layerDeco, isTileLayer, wrapSize, layerCssFilter } from '../core/layers.js';
import { getTileDef, tileImage, isCustomId } from '../core/tileset.js';
import { buildWater } from './fx.js';
import { ctx, cam, view, rc, lb, setCtx, getCtx, setFill, world, viewW, viewH, viewScale } from './ctx.js';
import { P, TINT, palRev } from './palette.js';
import { waterDepthK, dust } from './fx.js';

var G = GAME, T = G.T;
var _L = null;
var _paintCover = false;

function tAt(c, r){
  if (_paintCover && _L && _L.cover){
    var cov = coverRaw(_L, c, r);
    if (cov) return cov === COVER_AIR ? 0 : cov;
  }
  if (_L) return layerTileRaw(_L, c, r);
  return G.tileAt(c, r);
}
function vAt(c, r){
  if (_paintCover && _L && _L.cover){
    var cv = coverRaw(_L, c, r);
    if (cv) return cv === COVER_AIR ? 0 : coverVarRaw(_L, c, r);
  }
  if (_L) return layerVarRaw(_L, c, r);
  return G.varAt(c, r);
}
function dAt(c, r){ return _L ? layerDeco(_L, c, r) : (G.decoAt ? G.decoAt(c, r) : 0); }
function cellCoverA(c, r){
  if (!_L || !_L.cover || !_L.collide || _L.wrap) return 0;
  if (!G.inMap(c, r)) return 0;
  var ix = G.mapIx(c, r);
  if (!_L.cover[ix]) return 0;
  if (_L._roomsDirty) rebuildRooms(_L);
  return roomCoverA(_L.id + ':' + _L.roomOf[ix]);
}
function isFrontId(v){
  var d = getTileDef(v);
  return !!(d && d.front);
}
function paintCustom(v, x, y){
  if (!isCustomId(v)) return false;
  var img = tileImage(v);
  if (img) ctx.drawImage(img, 0, 0, 16, 16, Math.round(x), Math.round(y), T, T);
  return true;
}
function sAt(c, r){
  if (!_L) return G.solidTile(c, r);
  var v = tAt(c, r);
  if (!G.isSolidV(v)) return false;
  if (v === G.CRUMB && world() && world().gone && world().gone[G.mapIx(c, r)] > 0) return false;
  if (v === G.PLANK && world() && world().burnt && world().burnt[G.mapIx(c, r)]) return false;
  return true;
}

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
  return sAt(c,r) && !sAt(c,r-1) && (!sAt(c-1,r) || !sAt(c+1,r));
}
export function hashT(c, r){ var h = (c*73856093) ^ (r*19349663); h = (h ^ (h >> 13)) >>> 0; return h; }

function mixHex(a, b, t){
  if (t <= 0) return a;
  if (t >= 1) return b;
  var ar = parseInt(a.slice(1,3),16), ag = parseInt(a.slice(3,5),16), ab = parseInt(a.slice(5,7),16);
  var br = parseInt(b.slice(1,3),16), bg = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
  var rr = (ar + (br - ar) * t + 0.5) | 0;
  var gg = (ag + (bg - ag) * t + 0.5) | 0;
  var bl = (ab + (bb - ab) * t + 0.5) | 0;
  return '#' + (0x1000000 + (rr << 16) + (gg << 8) + bl).toString(16).slice(1);
}
function drawWaterBubbles(c, r, x, y, time, k){
  var h = hashT(c, r);
  if ((h % 5) !== 0 && (c * 7 + r * 3) % 4 !== 0) {
    rc(x + ((c * 7) % 9), y + 12, 2, 1, mixHex('#6fb8dd', '#143044', k));
    return;
  }
  var spd = 8 + (h % 26);
  var span = T + 5 + (h % 10);
  var bz = ((time * spd * 0.32 + (h % 17)) % span) | 0;
  var sz = 1 + ((h >> 3) % 3);
  if (sz === 3 && (h % 5) > 2) sz = 1;
  var bx = x + 1 + (h % Math.max(1, T - sz - 1));
  var by = y + T - sz - bz;
  rc(bx, by, sz, sz, k > 0.45 ? '#9fd0ef' : '#bfe6ff');
  if (sz > 1) rc(bx, by, 1, 1, '#ffffff');
  rc(x + ((c * 7) % 9), y + 12, 2, 1, mixHex('#6fb8dd', '#143044', k));
}

/* декор скосов по варианту: [dx, dy, w, h, hi] — hi=1 подсветка, 0 тень; рисуется только там, где точка внутри тела скоса */
var SLOPE_DECOR = [
  [[6, 10, 3, 1, 1]],
  [[3, 11, 1, 1, 1], [11, 9, 1, 1, 0]],
  [[5, 9, 2, 1, 0], [9, 12, 1, 2, 1]],
  [[2, 8, 1, 3, 0], [10, 10, 2, 1, 1]],
  [[7, 7, 1, 2, 1], [4, 13, 2, 1, 0], [12, 11, 1, 1, 1]]
];

var WAVE_PAD = 4, WAVE_H = 20;
var wStrip = { t: NaN, c0: 0, c1: -1, lo: null, hi: null };

function reuseCan(old, w, h){
  if (old && old.width === w && old.height === h){
    var g = old.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    return old;
  }
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g2 = c.getContext('2d');
  g2.imageSmoothingEnabled = false;
  return c;
}
function paintWaves(x, y, c, time, w1){
  var wx, wx2;
  for (wx = 0; wx < T; wx += 2){
    var ph2 = (c*T + wx) * 0.09 - time * 2.2;
    var wv = Math.round(Math.sin(ph2) * 1.6 + Math.sin(ph2*2.3) * 0.7);
    rc(x + wx, y + 1 + wv, 2, 2, w1);
    rc(x + wx, y + wv, 2, 1, '#bfe6ff');
    rc(x + wx, y + 7 + Math.round(Math.sin(ph2*1.4)*1.2), 2, 1, w1);
  }
  ctx.globalAlpha = 0.4;
  for (wx2 = 0; wx2 < T; wx2 += 2){
    var ph3 = (c*T + wx2) * 0.062 - time * 1.25 + 1.9;
    var wv2 = Math.round(Math.sin(ph3) * 2.1);
    rc(x + wx2, y + 2 + wv2, 2, 2, '#dff2ff');
    rc(x + wx2, y + 10 + Math.round(Math.sin(ph3*1.1)*1.4), 2, 1, '#9fd0ef');
  }
  ctx.globalAlpha = 1;
}
function fillWaveCan(can, c0, c1, time, w1){
  var saved = getCtx();
  setCtx(can.getContext('2d'));
  try {
    for (var c = c0; c <= c1; c++)
      paintWaves((c - c0) * T, WAVE_PAD, c, time, w1);
  } finally {
    setCtx(saved);
  }
}
function prepWaveStrip(time, c0, c1){
  if (wStrip.lo && wStrip.t === time && wStrip.c0 === c0 && wStrip.c1 === c1) return;
  var w = Math.max(T, (c1 - c0 + 1) * T);
  wStrip.lo = reuseCan(wStrip.lo, w, WAVE_H);
  wStrip.hi = reuseCan(wStrip.hi, w, WAVE_H);
  fillWaveCan(wStrip.lo, c0, c1, time, '#49a0cf');
  fillWaveCan(wStrip.hi, c0, c1, time, '#2f7fae');
  wStrip.t = time; wStrip.c0 = c0; wStrip.c1 = c1;
}
function blitWaves(c, x, y, deep){
  if (!wStrip.lo || c < wStrip.c0 || c > wStrip.c1) return false;
  ctx.drawImage(deep ? wStrip.hi : wStrip.lo,
    (c - wStrip.c0) * T, 0, T, WAVE_H,
    Math.round(x), Math.round(y - WAVE_PAD), T, WAVE_H);
  return true;
}
export function drawTile(c, r, x, y, dyn){
  var v = tAt(c, r);
  if (!isFrontId(v)) paintTileId(v, c, r, x, y, dyn);
  var d = dAt(c, r);
  if (d && !isFrontId(d)) paintTileId(d, c, r, x, y, dyn);
}
function paintTileId(v, c, r, x, y, dyn){
  if (!v) return;
  if (paintCustom(v, x, y)) return;
  var time = view.time;
  var S = world();
  if (G.isLadV(v)){ drawLadder(c, r, v, x, y); return; }
  if (v === G.WATER || v === G.FALL){
    var deepW = r > 30;
    var kW = v === G.WATER ? waterDepthK(c, r) : 0;
    var w0 = v === G.WATER ? mixHex('#2a78a8', '#040910', kW) : (deepW ? '#1d5a86' : '#2a78a8');
    var w1 = v === G.WATER ? mixHex('#49a0cf', '#16344c', kW) : (deepW ? '#2f7fae' : '#49a0cf');
    rc(x, y, T, T, w0);
    if (v === G.FALL){                                   // поток: вертикальные струи
      for (var s2 = 0; s2 < 4; s2++){
        var off = Math.round((time*70 + s2*23 + c*11) % T);
        rc(x + 1 + s2*4, y + off - T, 2, T, w1);
        rc(x + 1 + s2*4, y + ((off + 8) % T), 2, 3, '#bfe6ff');
      }
      rc(x, y, T, 1, '#8fd0ef');
    } else {                                             // спокойная вода: бегущая волна
      var top = !G.isWaterV(tAt(c, r - 1));
      if (top && sAt(c, r - 1)){                 // камень над водой
        var rr = r - 2;
        while (rr >= 0 && sAt(c, rr)) rr--;
        if (rr >= 0 && G.isWaterV(tAt(c, rr))) top = false; // камень внутри воды
      }
      if (!top){                                         // глубина — без волн
        drawWaterBubbles(c, r, x, y, time, kW);
        return;
      }
      if (!blitWaves(c, x, y, false)) paintWaves(x, y, c, time, w1);
      drawWaterBubbles(c, r, x, y, time, kW);
      var shoreL = !G.isWaterV(tAt(c - 1, r));
      var shoreR = !G.isWaterV(tAt(c + 1, r));
      if (shoreL || shoreR){
        var lick = Math.round(Math.sin(time * 2.2 + c * 0.7) * 1.5);
        if (shoreL) rc(x, y + lick, 2, 2, '#e8f6ff');
        if (shoreR) rc(x + T - 2, y + lick, 2, 2, '#e8f6ff');
      }
    }
    return;
  }
  if (G.isSlopeV(v)){                                    // скос (любой угол / дуга)
    var deepS = r > 30;
    var bsS = deepS ? TINT.deepA : TINT.rock, bdS = deepS ? TINT.deepB : TINT.rockD, blS = deepS ? TINT.deepC : TINT.rockL;
    setFill(bsS);
    ctx.beginPath();
    ctx.moveTo(x, y + T);
    for (var k2 = 0; k2 <= T; k2 += 2){
      ctx.lineTo(x + k2, y + G.slopeTop(v, c, c * T + k2));
    }
    ctx.lineTo(x + T, y + T);
    ctx.closePath(); ctx.fill();
    for (k2 = 0; k2 < T; k2 += 2){                       // кромка по поверхности
      var yy = y + G.slopeTop(v, c, c * T + k2);
      rc(x + k2, yy, 2, 2, P.edgeL);
      rc(x + k2, yy + 2, 2, 1, bdS);
    }
    var hhS = hashT(c, r), mvS = vAt(c, r);
    var sPick = mvS > 0 ? (mvS - 1) % SLOPE_DECOR.length : (hhS % 3 === 0 ? hhS % SLOPE_DECOR.length : -1);
    if (sPick >= 0){
      var decoS = SLOPE_DECOR[sPick];
      for (var di = 0; di < decoS.length; di++){
        var dd = decoS[di];
        if (dd[1] >= G.slopeTop(v, c, c * T + dd[0]))
          rc(x + dd[0], y + dd[1], dd[2], dd[3], dd[4] ? blS : bdS);
      }
    }
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
    var mvH = vAt(c, r);
    var hVariant = mvH > 0 ? (mvH - 1) % 5 : hashT(c, r) % 5;
    if (hVariant === 0){
      rc(x + 3, y + 1, 3, 1, P.rockL); rc(x + 10, y + 3, 2, 1, P.rockL);
      rc(x + ((c*5)%12), y + 8, 2, 2, P.rockX);
    } else if (hVariant === 1){
      rc(x + 1, y + 2, 2, 1, P.rockL); rc(x + 8, y + 1, 4, 1, P.rockL);
      rc(x + 12, y, 1, 6, P.rockD); rc(x + 5, y + 8, 3, 2, P.rockX);
    } else if (hVariant === 2){
      rc(x + 2, y, 1, 6, P.rockD); rc(x + 9, y, 1, 6, P.rockD);
      rc(x + 4, y + 2, 2, 1, P.rockL); rc(x, y + 8, 3, 2, P.rockX);
    } else if (hVariant === 3){
      rc(x + 6, y, 1, 6, P.rockD); rc(x + 2, y + 1, 3, 1, P.rockL);
      rc(x + 9, y + 2, 4, 1, P.rockL); rc(x + 9, y + 8, 3, 2, P.rockX);
    } else {
      rc(x + 1, y, 1, 6, P.rockD); rc(x + 14, y, 1, 6, P.rockD);
      rc(x + 5, y + 1, 6, 1, P.rockL); rc(x + 6, y + 8, 2, 2, P.rockX);
    }
    return;
  }
  if (v === G.PLANK){                                // деревянный настил, сгорает от факела навсегда
    var pIx = G.mapIx(c, r), Sw = world();
    var burnt = Sw && Sw.burnt && Sw.burnt[pIx];
    if (burnt){
      rc(x+2, y+8, 3, 2, '#241d3d'); rc(x+9, y+9, 3, 2, '#241d3d'); rc(x+6, y+11, 2, 2, '#3a3157');
      return;
    }
    var burning = Sw && Sw.plankT && Sw.plankT[pIx] !== undefined;
    var pk = burning ? Math.max(0, Math.min(1, 1 - Sw.plankT[pIx] / G.C.PLANK_BURN)) : 0;
    var wc = mixHex(P.wood, '#3a1c14', pk), wd = mixHex(P.woodD, '#1c0d0a', pk), wl = mixHex(P.woodL, '#6a2a1a', pk);
    rc(x, y, T, T, wd);
    rc(x, y+1, T, 4, wc); rc(x, y+7, T, 4, wc);
    rc(x, y+1, T, 1, wl); rc(x, y+7, T, 1, wl);
    rc(x, y+5, T, 2, wd); rc(x, y+11, T, 2, wd);
    if (burning){
      var fl = Math.round(Math.sin(time*20 + c)*1);
      rc(x + 3, y - 2 + fl, 3, 3, '#ff9b3d'); rc(x + 9, y - 1 + fl, 3, 3, '#ff7a3d');
      if (Math.random() < 0.2) dust(x + T/2, y, 1, 10, 14);
    }
    return;
  }
  if (v === G.GIVE){                                 // пружинящий блок: проседает и темнеет под ногами
    var Sg = world(), gk = (Sg && Sg.giveT && Sg.giveT[G.mapIx(c, r)]) || 0;
    var gy = Math.round(gk * 3);
    var gc = mixHex(P.rock, '#1c1730', gk*0.7), gd = mixHex(P.rockD, '#100c1e', gk*0.7), gl = mixHex(P.rockL, '#2a2444', gk*0.7);
    rc(x, y + gy, T, T - gy, gc);
    rc(x, y + gy, T, 2, gl);
    rc(x, y + T - 2, T, 2, gd);
    rc(x + 2, y + gy + 2, T - 4, 1, gd);
    return;
  }
  if (!G.isSolidV(v)) return;
  var k = G.mapIx(c, r), crumb = (v === G.CRUMB), hh = hashT(c, r);
  if (crumb && !sAt(c, r)){
    rc(x+2, y+5, 3, 2, P.crumD); rc(x+9, y+8, 2, 2, P.crumD); return;
  }
  var sx = 0;
  var cracking = crumb && S.crumbT && S.crumbT[k] !== undefined;
  if (cracking) sx = Math.round(Math.sin(time*46)*1.2);
  if (crumb){                                        // с нижней кромки сыплется песок — тайл нестабилен
    if (cracking){ if (Math.random() < 0.4) dust(x + sx + 2 + Math.random()*(T-4), y + T - 1, 2, 4, 4); }
    else if (Math.random() < 0.05) dust(x + 2 + Math.random()*(T-4), y + T - 1, 2, 3, 3);
  }
  var deep = r > 30;
  var biome = deep ? 2 : (c > 112 ? 1 : 0);
  var bs, bd, bl;
  if (crumb){ bs = P.crum; bd = P.crumD; bl = P.crumL; }
  else if (biome === 2){ bs = '#55507e'; bd = '#3b3660'; bl = '#7f78ab'; }
  else if (biome === 1){ bs = '#6b5f74'; bd = '#4a4055'; bl = '#94879c'; }
  else { bs = P.rock; bd = P.rockD; bl = P.rockL; }
  var mv = vAt(c, r);
  var variant = mv > 0 ? (mv - 1) % 8 : hh % 8;   // 1..5 — ручной выбор из редактора, 0 — авто по хэшу
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
  if (!sAt(c, r-1)){
    if (grabby(c, r)){
      rc(x+sx, y, T, 2, P.edge); rc(x+sx, y, T, 1, P.edgeL); rc(x+sx, y+2, T, 1, P.edgeD);
      var oc = !sAt(c-1, r) ? 0 : T-2;
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
  var openU = !sAt(c, r-1), openD = !sAt(c, r+1);
  var openL = !sAt(c-1, r), openR = !sAt(c+1, r);
  if (openU && openL){ rc(x+sx, y, 2, 1, bd); rc(x+sx, y, 1, 2, bd); rc(x+sx, y, 1, 1, bl); }
  if (openU && openR){ rc(x+sx+T-2, y, 2, 1, bd); rc(x+sx+T-1, y, 1, 2, bd); }
  if (openD && openL){ rc(x+sx, y+T-1, 2, 1, bd); rc(x+sx, y+T-2, 1, 2, bd); }
  if (openD && openR){ rc(x+sx+T-2, y+T-1, 2, 1, bd); rc(x+sx+T-1, y+T-2, 1, 2, bd); }
  if (!sAt(c, r+1)){
    rc(x+sx, y+T-1, T, 1, P.rockX);
    if (hh % 5 === 0){ rc(x+sx+4, y+T, 1, 3, bd); rc(x+sx+10, y+T, 1, 2, bd); }
  }
  if (!sAt(c-1, r)) rc(x+sx, y, 1, T, P.rockX);
  if (!sAt(c+1, r)) rc(x+sx+T-1, y, 1, T, bl);
}

/* --- кэш статичных тайлов чанками 8x8; осыпающиеся рисуем каждый кадр --- */
export const CH = 8, PAD = 6;
export let chunkCache = {};
var cacheRev = -1;
function syncPal(){
  if (cacheRev !== palRev){
    chunkCache = {};
    var ls = getLayers(), i;
    for (i = 0; i < ls.length; i++){ ls[i]._chunks = {}; ls[i]._stampCan = null; ls[i]._coverCans = null; }
    cacheRev = palRev;
  }
}

function wipeChunk(cache, c, r){
  if (!cache) return;
  for (var dr = -1; dr <= 1; dr++)
    for (var dc = -1; dc <= 1; dc++)
      delete cache[Math.floor((c + dc) / CH) + ',' + Math.floor((r + dr) / CH)];
}
export function invalidateChunk(c, r){
  wipeChunk(chunkCache, c, r);
  var ls = getLayers(), i;
  for (i = 0; i < ls.length; i++){
    wipeChunk(ls[i]._chunks, c, r);
    if (ls[i].wrap) ls[i]._stampCan = null;
    ls[i]._coverCans = null;
  }
}
hooks.onSetTile = invalidateChunk;
hooks.onRoomsChange = function(){
  buildWater();
};
export function invalidateAll(){
  chunkCache = {};
  var ls = getLayers(), i;
  for (i = 0; i < ls.length; i++){
    ls[i]._chunks = {};
    ls[i]._stampCan = null;
    ls[i]._coverCans = null;
  }
}

function paintAny(c, r, x, y){
  var v = tAt(c, r);
  if (v) paintTileId(v, c, r, x, y, true);
  if (_paintCover) return;
  var d = dAt(c, r);
  if (d) paintTileId(d, c, r, x, y, true);
}
function isDynId(v){
  return v === G.CRUMB || v === G.WATER || v === G.FALL || v === G.PLANK || v === G.GIVE;
}
function nearRoom8(L, c, r, rid){
  var dc, dr, nc, nr;
  for (dr = -1; dr <= 1; dr++)
    for (dc = -1; dc <= 1; dc++){
      if (!dc && !dr) continue;
      nc = c + dc; nr = r + dr;
      if (!G.inMap(nc, nr)) continue;
      if (L.roomOf[G.mapIx(nc, nr)] === rid) return true;
    }
  return false;
}
function paintHalo(c, r, x, y){
  var v = tAt(c, r), d;
  if (isDynId(v)) return;
  if (v && !isFrontId(v)) paintTileId(v, c, r, x, y, true);
  d = dAt(c, r);
  if (d && !isFrontId(d) && !isDynId(d)) paintTileId(d, c, r, x, y, true);
}

function coverCanOf(L, rid){
  if (!L || !L.cover || !L.roomOf) return null;
  var cans = L._coverCans || (L._coverCans = {});
  if (cans[rid]) return cans[rid];
  var w = G.MAP_W, h = G.MAP_H, oc = G.mapMinC(), or_ = G.mapMinR();
  var roomOf = L.roomOf, cov = L.cover, n = w * h;
  var minC = w, minR = h, maxC = -1, maxR = -1, i, lc, lr, hasTile = false;
  for (i = 0; i < n; i++){
    if (roomOf[i] !== rid) continue;
    lc = i % w; lr = (i / w) | 0;
    if (lc < minC) minC = lc;
    if (lr < minR) minR = lr;
    if (lc > maxC) maxC = lc;
    if (lr > maxR) maxR = lr;
    if (cov[i] && cov[i] !== COVER_AIR) hasTile = true;
  }
  if (maxC < 0){ cans[rid] = null; return null; }
  minC += oc; minR += or_; maxC += oc; maxR += or_;
  // +1 тайл: соседи с автокромкой пещеры, иначе рамка вокруг скрытой комнаты
  minC = Math.max(G.mapMinC(), minC - 1);
  minR = Math.max(G.mapMinR(), minR - 1);
  maxC = Math.min(G.mapMaxC() - 1, maxC + 1);
  maxR = Math.min(G.mapMaxR() - 1, maxR + 1);
  var cw = (maxC - minC + 1) * T + PAD * 2;
  var ch = (maxR - minR + 1) * T + PAD * 2;
  var can = document.createElement('canvas');
  can.width = cw; can.height = ch;
  var g = can.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (hasTile){
    var saved = getCtx();
    var prevL = _L, prevP = _paintCover;
    _L = L; _paintCover = true;
    setCtx(g);
    try {
      for (lr = minR; lr <= maxR; lr++){
        for (lc = minC; lc <= maxC; lc++){
          if (!G.inMap(lc, lr)) continue;
          if (L.roomOf[G.mapIx(lc, lr)] === rid){
            if (coverRaw(L, lc, lr) === COVER_AIR) continue;
            paintAny(lc, lr, (lc - minC) * T + PAD, (lr - minR) * T + PAD);
          } else if (nearRoom8(L, lc, lr, rid)){
            paintHalo(lc, lr, (lc - minC) * T + PAD, (lr - minR) * T + PAD);
          }
        }
      }
    } finally {
      setCtx(saved);
      _L = prevL;
      _paintCover = prevP;
    }
  }
  var out = { can: can, x: minC * T - PAD, y: minR * T - PAD };
  cans[rid] = out;
  return out;
}

function blitCover(camx, camy){
  var L = _L;
  if (!L || !L.cover || !L.collide || L.wrap) return;
  if (L._roomsDirty || !L.roomOf) rebuildRooms(L);
  var max = L._roomMax | 0, rid, a, g, dx, dy, z;
  for (rid = 1; rid <= max; rid++){
    a = roomCoverA(L.id + ':' + rid);
    if (a <= 0.02) continue;
    g = coverCanOf(L, rid);
    if (!g) continue;
    dx = g.x - camx; dy = g.y - camy;
    z = viewScale;
    if (z !== 1){ dx = Math.round(dx * z) / z; dy = Math.round(dy * z) / z; }
    ctx.globalAlpha = a;
    ctx.drawImage(g.can, dx, dy);
    ctx.globalAlpha = 1;
  }
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
        if (!G.inMap(c, r)) continue;
        var vv0 = tAt(c, r);
        if (vv0 === G.CRUMB || vv0 === G.WATER || vv0 === G.FALL ||
            vv0 === G.PLANK || vv0 === G.GIVE) continue;                     // динамика — мимо кэша
        drawTile(c, r, (c - cx*CH)*T + PAD, (r - cy*CH)*T + PAD, false);
      }
    }
  } finally {
    setCtx(saved);
  }
  chunkCache[key] = cv2;
  return cv2;
}
function stampOf(L){
  if (L._stampCan) return L._stampCan;
  var s = wrapSize(L);
  var can = document.createElement('canvas');
  can.width = s.w * T + PAD * 2;
  can.height = s.h * T + PAD * 2;
  var g = can.getContext('2d');
  g.imageSmoothingEnabled = false;
  var saved = getCtx();
  setCtx(g);
  try {
    var r, c, v;
    for (r = 0; r < s.h; r++){
      for (c = 0; c < s.w; c++){
        v = tAt(c, r);
        if (!v) continue;
        drawTile(c, r, c * T + PAD, r * T + PAD, true);
      }
    }
  } finally {
    setCtx(saved);
  }
  L._stampCan = can;
  return can;
}
function blitWrapLayer(L, camx, camy){
  var can = stampOf(L);
  var s = wrapSize(L);
  var pw = s.w * T, ph = s.h * T;
  var ox = ((camx % pw) + pw) % pw;
  var oy = ((camy % ph) + ph) % ph;
  var vw = viewW(), vh = viewH(), z = viewScale;
  var x, y, dx, dy;
  for (y = -oy; y < vh + ph; y += ph){
    for (x = -ox; x < vw + pw; x += pw){
      dx = x - PAD; dy = y - PAD;
      if (z !== 1){ dx = Math.round(dx * z) / z; dy = Math.round(dy * z) / z; }
      ctx.drawImage(can, dx, dy);
    }
  }
}

function blitLayer(camx, camy){
  var c0 = Math.max(G.mapMinC(), Math.floor(camx/T) - 1);
  var c1 = Math.min(G.mapMaxC() - 1, Math.floor((camx+viewW())/T) + 1);
  var r0 = Math.max(G.mapMinR(), Math.floor(camy/T) - 1);
  var r1 = Math.min(G.mapMaxR() - 1, Math.floor((camy+viewH())/T) + 1);
  var x0 = Math.floor(c0/CH), x1 = Math.floor(c1/CH);
  var y0 = Math.floor(r0/CH), y1 = Math.floor(r1/CH);
  var cy, cx, dx, dy, z, r, c, vd;
  for (cy = y0; cy <= y1; cy++){
    for (cx = x0; cx <= x1; cx++){
      dx = cx*CH*T - camx - PAD; dy = cy*CH*T - camy - PAD;
      z = viewScale;
      if (z !== 1){ dx = Math.round(dx * z) / z; dy = Math.round(dy * z) / z; }
      ctx.drawImage(chunkOf(cx, cy), dx, dy);
    }
  }
  prepWaveStrip(view.time, c0, c1);
  for (r = r0; r <= r1; r++){
    for (c = c0; c <= c1; c++){
      vd = tAt(c, r);
      if (vd === G.CRUMB || vd === G.WATER || vd === G.FALL || vd === G.PLANK || vd === G.GIVE)
        drawTile(c, r, c*T - camx, r*T - camy, true);
    }
  }
  blitCover(camx, camy);
}

export function tilesLayer(L){
  if (L && !layerShown(L, view.edit)) return;
  if (L && !isTileLayer(L)) return;
  var prev = chunkCache;
  _L = L || null;
  var px = L && L.px != null ? L.px : 1;
  var py = L && L.py != null ? L.py : 1;
  var filt = layerCssFilter(L);
  if (filt) ctx.filter = filt;
  try {
    syncPal();
    if (L && L.wrap) blitWrapLayer(L, cam.x * px, cam.y * py);
    else {
      if (L) chunkCache = L._chunks || (L._chunks = {});
      blitLayer(cam.x * px, cam.y * py);
    }
  } finally {
    if (filt) ctx.filter = 'none';
    chunkCache = prev;
    _L = null;
  }
}

export function tiles(){
  var ls = getLayers();
  if (!ls.length){ tilesLayer(null); return; }
  var last = lastCollideIndex();
  var end = last < 0 ? ls.length - 1 : last;
  for (var i = 0; i <= end; i++) tilesLayer(ls[i]);
}

function drawFrontDecos(){
  var ls = getLayers();
  if (!ls.length){ drawFrontOn(null); return; }
  var i;
  for (i = 0; i < ls.length; i++){
    if (!layerShown(ls[i], view.edit) || !isTileLayer(ls[i])) continue;
    drawFrontOn(ls[i]);
  }
}
function drawFrontOn(L){
  var prev = _L;
  _L = L || null;
  var px = L && L.px != null ? L.px : 1;
  var py = L && L.py != null ? L.py : 1;
  var camx = cam.x * px, camy = cam.y * py;
  var c0 = Math.max(G.mapMinC(), Math.floor(camx / T) - 1);
  var c1 = Math.min(G.mapMaxC() - 1, Math.floor((camx + viewW()) / T) + 1);
  var r0 = Math.max(G.mapMinR(), Math.floor(camy / T) - 1);
  var r1 = Math.min(G.mapMaxR() - 1, Math.floor((camy + viewH()) / T) + 1);
  var c, r, v, d;
  var filt = layerCssFilter(L);
  if (filt) ctx.filter = filt;
  try {
    for (r = r0; r <= r1; r++){
      for (c = c0; c <= c1; c++){
        var ca = cellCoverA(c, r);
        if (ca > 0.98) continue;
        if (ca > 0.02) ctx.globalAlpha = 1 - ca;
        v = tAt(c, r);
        if (v && isFrontId(v)) paintTileId(v, c, r, c * T - camx, r * T - camy, true);
        d = dAt(c, r);
        if (d && isFrontId(d)) paintTileId(d, c, r, c * T - camx, r * T - camy, true);
        if (ca > 0.02) ctx.globalAlpha = 1;
      }
    }
  } finally {
    if (filt) ctx.filter = 'none';
    _L = prev;
  }
}

export function tilesFront(){
  drawFrontDecos();
  var ls = getLayers();
  var last = lastCollideIndex();
  if (last < 0) return;
  for (var i = last + 1; i < ls.length; i++) tilesLayer(ls[i]);
}
