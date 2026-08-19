import GAME from '../core/game.js';
import { ctx, cam, view, VW, VH, lc, lx, rc, world } from './ctx.js';
import { P } from './palette.js';

var G = GAME, T = G.T;

function hexRgba(hex, a){
  var h = String(hex || '#ffbe74').replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n = parseInt(h, 16);
  if (!isFinite(n)) return 'rgba(255,190,116,' + a + ')';
  return 'rgba(' + (n>>16) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
}

export function getLights(){
  var S = world();
  if (S && S.lights) return S.lights;
  var lv = G.levelSpec();
  return (lv && lv.lights) || [];
}

function lightXY(L){
  if (L && L.x != null) return [L.x, L.y];
  if (Array.isArray(L)) return [L[0]*T+8, L[1]*T+8];
  return [0, 0];
}

var _tp = null, _tpT = NaN;
export function torchPts(){
  if (_tp && _tpT === view.time) return _tp;
  var S = world(), LIGHTS = getLights();
  var a = [], i, xy;
  for (i = 0; i < LIGHTS.length; i++){
    if (LIGHTS[i].roomHide) continue;
    xy = lightXY(LIGHTS[i]);
    a.push([xy[0], xy[1], LIGHTS[i]]);
  }
  for (i = 0; i < S.torches.length; i++)
    if (S.torches[i].lit && !S.torches[i].roomHide)
      a.push([S.torches[i].x, S.torches[i].y - 9, null]);
  _tp = a; _tpT = view.time;
  return a;
}

export const SPR = {};
export function lightSprite(col){
  if (SPR[col]) return SPR[col];
  var s = document.createElement('canvas'); s.width = 64; s.height = 64;
  var g2 = s.getContext('2d');
  var g = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, col); g.addColorStop(0.42, col.replace(/[\d.]+\)$/, '0.42)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = g; g2.fillRect(0, 0, 64, 64);
  SPR[col] = s; return s;
}
export function lightPass(){
  var S = world(), time = view.time, flash = view.flash;
  var LIGHTS = getLights();
  lx.globalCompositeOperation = 'source-over';
  var dk = G.inDark(S, S.p.x + S.p.w/2, S.p.y + S.p.h/2);
  lx.fillStyle = dk ? '#0d0b16' : P.amb;              // в тёмной комнате почти нет фонового света
  lx.fillRect(0, 0, VW, VH);
  lx.globalCompositeOperation = 'lighter';
  function add(x, y, r, col, a){
    if (x < -r || x > VW+r || y < -r || y > VH+r) return;
    lx.globalAlpha = a;
    lx.drawImage(lightSprite(col), x-r, y-r, r*2, r*2);
    lx.globalAlpha = 1;
  }
  var i, L, xy, rad, inten, col;
  var LP = torchPts();
  for (i = 0; i < LP.length; i++){
    var fx = LP[i][0] - cam.x, fy = LP[i][1] - cam.y;
    L = LP[i][2];
    var fl = 0.84 + Math.sin(time*7 + i)*0.09 + Math.sin(time*17 + i*3)*0.05;
    rad = L && L.radius != null ? L.radius : 82;
    inten = L && L.intensity != null ? L.intensity : 1;
    col = L && L.color ? hexRgba(L.color, 0.95) : 'rgba(255,190,116,0.95)';
    add(fx, fy, rad, col, 0.95 * fl * inten);
  }
  for (i = 0; i < LIGHTS.length; i++){
    L = LIGHTS[i];
    if (L && (L.lantern === false || L.roomHide)) continue;
    xy = lightXY(L);
    var wx2 = xy[0] - cam.x, wy2 = xy[1] - cam.y;
    rc(wx2-1, wy2-6, 2, 8, P.woodD);
    rc(wx2-2, wy2-9, 4, 4, L && L.color ? L.color : '#ffcf7a');
    rc(wx2-1, wy2-11+Math.round(Math.sin(time*9+i)*1), 2, 3, '#fff3c4');
  }
  for (i = 0; i < S.items.length; i++){
    var it = S.items[i]; if (it.got || it.roomHide) continue;
    var ix = it.x - cam.x, iy = it.y - cam.y;
    if (it.kind === 'gem') add(ix, iy, 26, 'rgba(120,230,255,0.85)', 0.8);
    else if (it.kind === 'shroom') add(ix, iy, 22, 'rgba(255,150,90,0.8)', 0.7);
    else if (it.kind === 'relic') add(ix, iy, 44, 'rgba(220,190,255,0.95)', 0.95);
    else add(ix, iy, 15, 'rgba(255,215,110,0.7)', 0.6);
  }
  var inDk = G.inDark(S, S.p.x + S.p.w/2, S.p.y + S.p.h/2);
  if (!inDk) add(S.p.x + 5 - cam.x, S.p.y + 10 - cam.y, 46, 'rgba(190,190,255,0.55)', 0.55);
  else add(S.p.x + 5 - cam.x, S.p.y + 10 - cam.y, 16, 'rgba(140,140,190,0.4)', 0.4);
  if (flash > 0) add(S.p.x + 5 - cam.x, S.p.y + 10 - cam.y, 120*flash, 'rgba(255,255,255,0.9)', flash);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lc, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
