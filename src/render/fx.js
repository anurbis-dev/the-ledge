import GAME from '../core/game.js';
import { damage } from '../core/player.js';
import { ctx, cam, view, VW, VH, rc, lb, setFill, setCtx, getCtx, world } from './ctx.js';
import { P, TINT, palRev } from './palette.js';

var G = GAME, T = G.T;
var WEEDS = [], FISH = [];
var SKYG = null, skyRev = -1;
export var VIGG = null;

export function spark(x, y, n, col, spd, up){
  var parts = view.parts;
  for (var i = 0; i < n; i++)
    parts.push({ x:x, y:y, vx:(Math.random()-0.5)*(spd||50), vy:-Math.random()*(up||30),
                 t:0.3+Math.random()*0.3, c:col||'#e9e4ff', g: 140 });
}

export function sky(){
  if (!SKYG || skyRev !== palRev){
    SKYG = ctx.createLinearGradient(0, 0, 0, VH);
    var sk = TINT.sky;
    SKYG.addColorStop(0, sk[0]); SKYG.addColorStop(0.42, sk[1]); SKYG.addColorStop(1, sk[2]);
    skyRev = palRev;
  }
  setFill(SKYG); ctx.fillRect(0, 0, VW, VH);
  for (var i = 0; i < 54; i++){
    var sx = (i*67 - cam.x*0.05) % 340; if (sx < 0) sx += 340;
    var sy = (i*29) % 90 - cam.y*0.03;
    if (sy > -2 && sy < VH) rc(sx, sy, 1, 1, i%4 ? '#ffffff44' : '#ffd9a044');
  }
  function ridge(off, amp, base, col){
    setFill(col); ctx.beginPath(); ctx.moveTo(0, VH);
    for (var x = 0; x <= VW; x += 4){
      var wx = x + cam.x*off;
      ctx.lineTo(x, (base - Math.abs(Math.sin(wx*0.011))*amp - Math.sin(wx*0.031)*amp*0.3 - cam.y*off*0.6)|0);
    }
    ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
  }
  ridge(0.08, 44, 116, '#2b2154');
  ridge(0.18, 34, 142, '#3a2266');
  ridge(0.30, 24, 162, '#4a2f6b');
}
export function bush(x, y, w, h, col, colD){
  setFill(col);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.quadraticCurveTo(x + w*0.10, y + h*0.30, x + w*0.26, y + h*0.42);
  ctx.quadraticCurveTo(x + w*0.34, y - h*0.06, x + w*0.52, y + h*0.20);
  ctx.quadraticCurveTo(x + w*0.70, y - h*0.02, x + w*0.78, y + h*0.40);
  ctx.quadraticCurveTo(x + w*0.92, y + h*0.30, x + w, y + h);
  ctx.closePath(); ctx.fill();
  setFill(colD);
  for (var i = 0; i < 5; i++){
    var lx2 = x + w*(0.16 + i*0.16), ly = y + h*(0.30 + (i%2)*0.22);
    ctx.fillRect(lx2|0, ly|0, 3, 2);
  }
}
export function branch(x, y, len, dir, col){
  lb([x, y], [x + dir*len, y - len*0.30], 3, col);
  for (var i = 1; i <= 4; i++){
    var t = i/5, bx = x + dir*len*t, by = y - len*0.30*t;
    lb([bx, by], [bx + dir*7, by - 9], 2, col);
    rc(bx + dir*6, by - 11, 3, 3, col);
    rc(bx - dir*2, by + 3, 3, 2, col);
  }
}
var FORE_H = 40;
var FORE_SPEC = [
  [0.9, 150, 10, 17, '#2a2048', '#372a5c', 3],
  [1.3, 122, 13, 22, '#1b1436', '#241a44', 7],
  [1.8,  96, 16, 28, '#0e0a1e', '#150f2a', 11]
];
var foreCans = null, foreW = 0, foreMapW = -1;

export function foreLayer(par, per, hmin, hmax, col, colD, seed, screenH, xOff, xMax){
  if (screenH == null) screenH = VH;
  if (xOff == null) xOff = cam.x * par;
  var i0, i1;
  if (xMax != null){
    i0 = Math.floor(-90 / per) - 1;
    i1 = Math.ceil((xMax + 60) / per) + 1;
  } else {
    var n = Math.ceil(VW/per) + 3, base = Math.floor(xOff/per);
    i0 = base; i1 = base + n - 1;
  }
  for (var idx = i0; idx <= i1; idx++){
    var x = idx*per - xOff;
    if (xMax == null && (x < -90 || x > VW + 60)) continue;
    var hsh = ((idx*2654435761) ^ (seed*40503)) >>> 0;
    var sd = (hsh % 1000)/1000, kind = (hsh >> 11) % 3;
    var h = hmin + sd*(hmax - hmin), w = 34 + sd*30;
    var y = screenH - h + 4;                        // всегда стоят на нижней кромке кадра
    if (kind === 0) bush(x, y, w, h, col, colD);
    else if (kind === 1){
      bush(x, y + h*0.30, w*0.7, h*0.70, col, colD);
      branch(x + w*0.55, y + h*0.55, 18 + sd*10, (hsh % 2) ? 1 : -1, col);
    } else {
      for (var g = 0; g < 9; g++){                 // пучок травы от самого низа
        var gx = x + g*4 + (hsh >> g) % 3;
        var gh = h*0.55 + ((hsh >> (g*2)) % 10);
        lb([gx, screenH + 4], [gx + ((g%2)?3:-3), screenH + 4 - gh], 2, col);
      }
    }
  }
}
function ensureFore(){
  var needW = Math.ceil(G.MAP_W * T * 1.8 + VW + 180);
  if (foreCans && foreW === needW && foreMapW === G.MAP_W) return;
  foreW = needW; foreMapW = G.MAP_W;
  foreCans = [];
  var saved = getCtx();
  for (var i = 0; i < FORE_SPEC.length; i++){
    var s = FORE_SPEC[i];
    var can = document.createElement('canvas');
    can.width = needW; can.height = FORE_H;
    var g = can.getContext('2d');
    g.imageSmoothingEnabled = false;
    setCtx(g);
    foreLayer(s[0], s[1], s[2], s[3], s[4], s[5], s[6], FORE_H, 0, needW);
    foreCans.push({ can: can, par: s[0] });
  }
  setCtx(saved);
}
export function fore(){
  var time = view.time;
  ensureFore();
  for (var i = 0; i < foreCans.length; i++){
    var L = foreCans[i];
    var sx = Math.round(cam.x * L.par);
    if (sx < 0) sx = 0;
    var sw = VW;
    if (sx + sw > L.can.width) sw = Math.max(0, L.can.width - sx);
    if (sw > 0) ctx.drawImage(L.can, sx, 0, sw, FORE_H, 0, VH - FORE_H, sw, FORE_H);
  }
  for (var p = 0; p < 20; p++){                            // пыльца
    var px = ((p*137 - cam.x*1.9) % 380 + 380) % 380 - 20;
    var py = ((p*83 + Math.sin(time*0.6 + p)*14 - cam.y*1.3) % 210 + 210) % 210 - 10;
    if (px < -4 || px > VW+4) continue;
    ctx.globalAlpha = 0.45; rc(px, py, 1, 1, p%3 ? '#c9b6ff' : '#ffd9a0'); ctx.globalAlpha = 1;
  }
}

export function buildWater(){
  WEEDS = []; FISH = [];
  var MW = G.MAP_W, MH = G.MAP_H, WATER = G.WATER;
  var seen = new Uint8Array(MW * MH);
  function ix(c, r){ return r * MW + c; }
  var ponds = [];
  for (var r = 0; r < MH; r++){
    for (var c = 0; c < MW; c++){
      if (G.tileAt(c, r) !== WATER || seen[ix(c, r)]) continue;
      var stack = [[c, r]], cols = {}, c0 = c, c1 = c, top = r, bot = r;
      seen[ix(c, r)] = 1;
      while (stack.length){
        var cr = stack.pop(), cc = cr[0], rr = cr[1];
        if (cc < c0) c0 = cc; if (cc > c1) c1 = cc;
        if (rr < top) top = rr; if (rr > bot) bot = rr;
        if (!cols[cc]) cols[cc] = { top: rr, bot: rr };
        else {
          if (rr < cols[cc].top) cols[cc].top = rr;
          if (rr > cols[cc].bot) cols[cc].bot = rr;
        }
        var nbs = [[cc + 1, rr], [cc - 1, rr], [cc, rr + 1], [cc, rr - 1]];
        for (var n = 0; n < 4; n++){
          var nc = nbs[n][0], nr = nbs[n][1];
          if (nc < 0 || nr < 0 || nc >= MW || nr >= MH) continue;
          if (seen[ix(nc, nr)] || G.tileAt(nc, nr) !== WATER) continue;
          seen[ix(nc, nr)] = 1;
          stack.push([nc, nr]);
        }
      }
      ponds.push({ c0: c0, c1: c1, top: top, bot: bot, cols: cols });
    }
  }
  var fi = 0;
  for (var p = 0; p < ponds.length; p++){
    var pond = ponds[p];
    for (var ck in pond.cols){
      var col = +ck, rec = pond.cols[ck];
      var depth = rec.bot - rec.top + 1;
      var nw = depth > 3 ? 3 : (depth > 1 ? 2 : 1);
      for (var k = 0; k < nw; k++){
        var h1 = ((col*7 + k*13) % 100) / 100;
        if (h1 < 0.32) continue;
        WEEDS.push({ x: col*T + 2 + ((col*5 + k*7) % 12),
                     y: (rec.bot + 1) * T,
                     len: 5 + h1 * depth * 10, w: 1 + ((col + k) % 3),
                     hue: (col + k) % 3, ph: ((col*17 + k*31) % 100) / 100 * 6.28,
                     sway: 0.5 + h1 });
      }
    }
    var width = pond.c1 - pond.c0 + 1;
    if (width <= 4) continue;                         // лужа — без рыб
    var count = Math.min(9, Math.max(3, Math.floor(width / 8)));
    var colKeys = Object.keys(pond.cols);
    for (var f = 0; f < count; f++){
      var pc = +colKeys[(f * 7 + 3) % colKeys.length];
      var pool = pond.cols[pc];
      var big = f % 3 === 2;
      var fy0 = pond.top*T + 4, fy1 = (pond.bot + 1)*T - 4;
      if (fy1 < fy0) fy1 = fy0;
      var fy = (pool.top + 1 + ((f*3) % Math.max(1, pool.bot - pool.top))) * T;
      if (fy < fy0) fy = fy0; if (fy > fy1) fy = fy1;
      FISH.push({
        x: pc*T, y: fy,
        x0: pond.c0*T + 8, x1: (pond.c1 + 1)*T - 8,
        y0: fy0, y1: fy1,
        big: big, w: big ? 13 : 7, h: big ? 7 : 4,
        v: (big ? 26 : 44) + (f % 3) * 7,
        dir: f % 2 ? -1 : 1, kind: f % 3,
        ph: fi * 1.7, scare: 0, bite: 0
      });
      fi++;
    }
  }
}
export function getFish(){ return FISH; }

export function stepWater(dt){
  var S = world(), time = view.time, C = G.C;
  var p = S.p, pcx = p.x + p.w/2, pcy = p.y + p.h/2;
  for (var i = 0; i < FISH.length; i++){
    var f = FISH[i];
    var dx = pcx - f.x, dy = pcy - f.y;
    var near = Math.abs(dx) < 60 && Math.abs(dy) < 34 && S.p.inWater;
    if (near && (!f.big || f.scare > 0)){
      f.dir = dx > 0 ? -1 : 1;                        // мелочь и напуганные уплывают
      f.scare = Math.max(f.scare - dt, 0);
      f.x += f.dir * f.v * 1.8 * dt;
    } else if (near && f.big){
      f.dir = dx > 0 ? 1 : -1;                        // крупные подплывают и кусают
      f.x += f.dir * f.v * 1.3 * dt;
      f.bite -= dt;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && f.bite <= 0 && S.p.hurtCd <= 0){
        f.bite = 1.6; S.p.hurtCd = C.HURT_CD;
        damage(S, 1, 0.25);
        S.p.events.push('bite');
        f.scare = 1.2;
      }
    } else {
      f.x += f.dir * f.v * dt;
    }
    f.y += Math.sin(time * 1.6 + f.ph) * 6 * dt;
    if (f.y0 != null && f.y < f.y0) f.y = f.y0;
    if (f.y1 != null && f.y > f.y1) f.y = f.y1;
    if (f.x < f.x0){ f.x = f.x0; f.dir = 1; }
    if (f.x > f.x1){ f.x = f.x1; f.dir = -1; }
    if (!G.isWaterV(G.tileAt(Math.floor(f.x/T), Math.floor(f.y/T)))){
      f.dir = -f.dir; f.x += f.dir * 4;                // не выплывает из воды
    }
  }
}
export function drawWeeds(){
  var time = view.time;
  for (var i = 0; i < WEEDS.length; i++){
    var w = WEEDS[i];
    var x = Math.round(w.x - cam.x), y = Math.round(w.y - cam.y);
    if (x < -8 || x > VW + 8 || y < -4 || y - w.len > VH + 8) continue;
    var col = w.hue === 0 ? '#2f7a52' : (w.hue === 1 ? '#3f8f5f' : '#6aa83f');
    var px = x, py = y;
    for (var k = 0; k < 4; k++){
      var t2 = (k + 1) / 4;
      var bend = Math.sin(time * 1.4 + w.ph + k * 0.8) * w.sway * (2 + k * 2);
      var nx3 = x + bend, ny3 = y - w.len * t2;
      lb([px, py], [nx3, ny3], w.w + (k < 2 ? 1 : 0), col);
      px = nx3; py = ny3;
    }
    rc(px - 1, py - 2, 2, 2, '#8fd08f');
  }
}
export function drawFish(){
  var time = view.time;
  for (var i = 0; i < FISH.length; i++){
    var f = FISH[i];
    var x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
    if (x < -20 || x > VW + 20 || y < -16 || y > VH + 16) continue;
    var body = f.kind === 0 ? '#e0a04a' : (f.kind === 1 ? '#5fb0d0' : '#b05f7a');
    var fin  = f.kind === 0 ? '#ffd08a' : (f.kind === 1 ? '#9fd8ef' : '#e09fb0');
    var d = f.dir;
    rc(x - f.w/2, y - f.h/2, f.w, f.h, body);
    rc(x - f.w/2 + 1, y - f.h/2 + 1, f.w - 2, 1, fin);
    var tx = x + (d > 0 ? -f.w/2 - 3 : f.w/2);
    var tw = Math.round(2 + Math.sin(time*9 + f.ph) * 1.5);
    rc(tx, y - f.h/2, 3, f.h, body);
    rc(tx, y - f.h/2 - tw + 2, 3, 2, fin);
    rc(x + (d > 0 ? f.w/2 - 3 : -f.w/2 + 1), y - 1, 2, 2, '#101018');
    if (f.big) rc(x + (d > 0 ? f.w/2 - 1 : -f.w/2 - 1), y, 2, 1, '#fff');
  }
}

export function vignette(){
  if (!VIGG){
    VIGG = ctx.createRadialGradient(VW/2, VH/2, VH*0.45, VW/2, VH/2, VH*1.05);
    VIGG.addColorStop(0, 'rgba(0,0,0,0)'); VIGG.addColorStop(1, 'rgba(6,3,14,0.40)');
  }
  setFill(VIGG); ctx.fillRect(0, 0, VW, VH);
}

export function drawHearts(dt){
  var hearts = view.hearts;
  for (var i = hearts.length - 1; i >= 0; i--){
    var h = hearts[i];
    h.t -= dt; if (h.t <= 0){ hearts.splice(i,1); continue; }
    h.x += h.vx*dt; h.y += h.vy*dt; h.vy += 190*dt;
    var x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y);
    ctx.globalAlpha = Math.min(1, h.t * 1.6);
    rc(x+1, y, 2, 1, P.hp); rc(x+4, y, 2, 1, P.hp);
    rc(x, y+1, 7, 2, P.hp); rc(x+1, y+3, 5, 1, P.hp);
    rc(x+2, y+4, 3, 1, P.hp); rc(x+3, y+5, 1, 1, P.hp);
    ctx.globalAlpha = 1;
  }
}
export function drawParts(dt){
  var parts = view.parts;
  for (var i = parts.length-1; i >= 0; i--){
    var q = parts[i];
    q.t -= dt; if (q.t <= 0){ parts.splice(i,1); continue; }
    q.x += q.vx*dt; q.y += q.vy*dt; q.vy += q.g*dt;
    if (q.top !== undefined && q.top !== null && q.y < q.top){   // пузырь лопнул у поверхности
      parts.splice(i, 1); continue;
    }
    rc(q.x - cam.x, q.y - cam.y, 1, 1, q.t > 0.18 ? q.c : '#7a72a8');
  }
}
