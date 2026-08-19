import GAME from '../core/game.js';
import { damage } from '../core/player.js';
import { getLayers, layerShown, layerCssFilter } from '../core/layers.js';
import { roomHides } from '../core/rooms.js';
import { ctx, cam, view, VW, VH, rc, lb, setFill, world } from './ctx.js';
import { P, TINT, palRev } from './palette.js';

var G = GAME, T = G.T;
var WEEDS = [], FISH = [];
var PONDS = [], SHORES = [], pondIx = null;
var SKYG = null, skyRev = -1;
export var WATER_SHADE_PRESETS = [
  ['clear', 0],
  ['light', 0.35],
  ['mid', 0.75],
  ['dark', 1.15],
  ['abyss', 1.7]
];
var DEFAULT_SHADE = 0.75;
export var VIGG = null;

export function spark(x, y, n, col, spd, up){
  var parts = view.parts;
  for (var i = 0; i < n; i++)
    parts.push({ x:x, y:y, vx:(Math.random()-0.5)*(spd||50), vy:-Math.random()*(up||30),
                 t:0.3+Math.random()*0.3, c:col||'#e9e4ff', g: 140 });
}

function puff(x, y, vx, vy, life, col, sz, g, drag){
  view.parts.push({
    x: x, y: y, vx: vx, vy: vy, t: life, life: life, c: col,
    g: g == null ? 32 : g, sz: sz || 1, drag: drag == null ? 3.4 : drag, kind: 'dust'
  });
}
function dustCols(){
  return ['#e8d8b4', '#cbb892', TINT.rockL, P.crumL];
}
/* мягкая пыль: n пылинок, spread — разлёт в стороны, lift — подброс */
export function dust(x, y, n, spread, lift){
  var cols = dustCols();
  spread = spread || 36; lift = lift || 16;
  for (var i = 0; i < n; i++){
    var dir = (i % 2 ? 1 : -1);
    var sp = (0.28 + Math.random()) * spread;
    puff(x + (Math.random() - 0.5) * 10, y - Math.random() * 2,
         dir * sp, -(5 + Math.random() * lift),
         0.4 + Math.random() * 0.5, cols[i % cols.length],
         Math.random() < 0.55 ? 2 : 1, 18 + Math.random() * 34, 3.8);
  }
}
export function landDust(p, fall){
  var x = p.x + p.w / 2, y = p.y + p.h;
  var f = Math.max(0, fall);
  var n = Math.min(22, 3 + (f / 7) | 0);
  var spread = Math.min(118, 22 + f * 0.72);
  var lift = Math.min(40, 10 + f * 0.2);
  dust(x, y, n, spread, lift);
  var haze = Math.min(6, 1 + (f / 22) | 0);
  for (var i = 0; i < haze; i++)
    puff(x + (Math.random() - 0.5) * 14, y - 1,
         (Math.random() - 0.5) * (16 + f * 0.12), -(2 + Math.random() * 8),
         0.5 + Math.random() * 0.35, TINT.rockL, 2, 12, 5.4);
}
export function bonkDust(p, spd){
  var x = p.x + p.w / 2, y = p.y + 1;
  var n = Math.min(16, 4 + (spd / 28) | 0);
  var cols = dustCols();
  for (var i = 0; i < n; i++)
    puff(x + (Math.random() - 0.5) * p.w, y + Math.random() * 2,
         (Math.random() - 0.5) * 52, 10 + Math.random() * 34,
         0.32 + Math.random() * 0.4, cols[i % cols.length],
         Math.random() < 0.4 ? 2 : 1, 76 + Math.random() * 40, 1.5);
  for (var j = 0; j < 3; j++)
    puff(x + (j - 1) * 5 + (Math.random() - 0.5) * 3, y,
         (j - 1) * 20 + (Math.random() - 0.5) * 10, 3 + Math.random() * 10,
         0.2 + Math.random() * 0.18, TINT.rockL, 2, 18, 4);
}

function fillSky(){
  if (!SKYG || skyRev !== palRev){
    SKYG = ctx.createLinearGradient(0, 0, 0, VH);
    var sk = TINT.sky;
    SKYG.addColorStop(0, sk[0]); SKYG.addColorStop(0.42, sk[1]); SKYG.addColorStop(1, sk[2]);
    skyRev = palRev;
  }
  setFill(SKYG); ctx.fillRect(0, 0, VW, VH);
}
function drawStars(px, py){
  for (var i = 0; i < 54; i++){
    var sx = (i*67 - cam.x * px) % 340; if (sx < 0) sx += 340;
    var sy = (i*29) % 90 - cam.y * py;
    if (sy > -2 && sy < VH) rc(sx, sy, 1, 1, i%4 ? '#ffffff44' : '#ffd9a044');
  }
}
function ridge(px, py, amp, y0, col){
  setFill(col); ctx.beginPath(); ctx.moveTo(0, VH);
  for (var x = 0; x <= VW; x += 4){
    var wx = x + cam.x * px;
    ctx.lineTo(x, (y0 - Math.abs(Math.sin(wx*0.011))*amp - Math.sin(wx*0.031)*amp*0.3 - cam.y * py)|0);
  }
  ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
}
export function sky(){
  var ls = getLayers(), i, L;
  if (!ls.length){
    fillSky();
    drawStars(0.05, 0.03);
    ridge(0.08, 0.048, 44, 116, '#2b2154');
    ridge(0.18, 0.108, 34, 142, '#3a2266');
    ridge(0.30, 0.18, 24, 162, '#4a2f6b');
    return;
  }
  for (i = 0; i < ls.length; i++){
    L = ls[i];
    if (L.kind !== 'sky' || !layerShown(L, view.edit)) continue;
    withFilter(L, function(){
      fillSky();
      drawStars(L.px == null ? 0.05 : L.px, L.py == null ? 0.03 : L.py);
    });
  }
  for (i = 0; i < ls.length; i++){
    L = ls[i];
    if (L.kind !== 'ridge' || !layerShown(L, view.edit)) continue;
    withFilter(L, function(){
      ridge(
        L.px == null ? 0.2 : L.px,
        L.py == null ? 0.12 : L.py,
        L.amp == null ? 30 : L.amp,
        L.y0 == null ? 140 : L.y0,
        L.color || '#2b2154'
      );
    });
  }
}

function withFilter(L, fn){
  var f = layerCssFilter(L);
  if (f) ctx.filter = f;
  try { fn(); }
  finally { if (f) ctx.filter = 'none'; }
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
export function foreLayer(par, per, hmin, hmax, col, colD, seed, screenH, xOff, yShift){
  if (screenH == null) screenH = VH;
  if (xOff == null) xOff = cam.x * par;
  if (yShift == null) yShift = 0;
  var n = Math.ceil(VW / per) + 3, base = Math.floor(xOff / per);
  var i0 = base, i1 = base + n - 1;
  for (var idx = i0; idx <= i1; idx++){
    var x = idx*per - xOff;
    if (x < -90 || x > VW + 60) continue;
    var hsh = ((idx*2654435761) ^ (seed*40503)) >>> 0;
    var sd = (hsh % 1000)/1000, kind = (hsh >> 11) % 3;
    var h = hmin + sd*(hmax - hmin), w = 34 + sd*30;
    var y = screenH - h + 4 + yShift;
    if (kind === 0) bush(x, y, w, h, col, colD);
    else if (kind === 1){
      bush(x, y + h*0.30, w*0.7, h*0.70, col, colD);
      branch(x + w*0.55, y + h*0.55, 18 + sd*10, (hsh % 2) ? 1 : -1, col);
    } else {
      for (var g = 0; g < 9; g++){
        var gx = x + g*4 + (hsh >> g) % 3;
        var gh = h*0.55 + ((hsh >> (g*2)) % 10);
        lb([gx, screenH + 4 + yShift], [gx + ((g%2)?3:-3), screenH + 4 + yShift - gh], 2, col);
      }
    }
  }
}
function drawPollen(px, py){
  var time = view.time, p, x, y;
  for (p = 0; p < 20; p++){
    x = ((p*137 - cam.x * px) % 380 + 380) % 380 - 20;
    y = ((p*83 + Math.sin(time*0.6 + p)*14 - cam.y * py) % 210 + 210) % 210 - 10;
    if (x < -4 || x > VW+4) continue;
    ctx.globalAlpha = 0.45; rc(x, y, 1, 1, p%3 ? '#c9b6ff' : '#ffd9a0'); ctx.globalAlpha = 1;
  }
}
export function fore(){
  var ls = getLayers(), i, L;
  if (!ls.length){
    foreLayer(0.9, 150, 10, 17, '#2a2048', '#372a5c', 3);
    foreLayer(1.3, 122, 13, 22, '#1b1436', '#241a44', 7);
    foreLayer(1.8, 96, 16, 28, '#0e0a1e', '#150f2a', 11);
    drawPollen(1.9, 1.3);
    return;
  }
  for (i = 0; i < ls.length; i++){
    L = ls[i];
    if (!layerShown(L, view.edit)) continue;
    if (L.kind === 'fore'){
      withFilter(L, function(){
        foreLayer(
          L.px == null ? 1 : L.px,
          L.period || 120,
          L.hmin == null ? 10 : L.hmin,
          L.hmax == null ? 20 : L.hmax,
          L.col || '#1b1436',
          L.colD || '#241a44',
          L.seed == null ? 7 : L.seed,
          VH,
          cam.x * (L.px == null ? 1 : L.px),
          -(cam.y * (L.py || 0))
        );
      });
    } else if (L.kind === 'pollen'){
      withFilter(L, function(){
        drawPollen(L.px == null ? 1.9 : L.px, L.py == null ? 1.3 : L.py);
      });
    }
  }
}

function depthK(depthTiles, shade){
  if (shade <= 0 || depthTiles < 0) return 0;
  var k = 1 - Math.exp(-depthTiles * shade * 0.5);
  return k > 0.94 ? 0.94 : k;
}
function pondAt(c, r){
  if (!pondIx || !G.inMap(c, r)) return null;
  var n = pondIx[G.mapIx(c, r)];
  return n ? PONDS[n - 1] : null;
}
function matchShade(pond){
  var list = (G.levelSpec() && G.levelSpec().water) || [];
  for (var i = 0; i < list.length; i++){
    var e = list[i], c = e[0], r = e[1];
    var rec = pond.cols[c];
    if (rec && r >= rec.top && r <= rec.bot) return e[2];
  }
  return DEFAULT_SHADE;
}
export function waterTintAt(px, py){
  var c = Math.floor(px / T), r = Math.floor(py / T);
  if (!G.isWaterV(G.tileAt(c, r))) return 0;
  var pond = pondAt(c, r);
  var shade = pond ? pond.shade : DEFAULT_SHADE;
  if (shade <= 0) return 0;
  var rec = pond && pond.cols[c];
  var topR = rec ? rec.top : r;
  if (!rec){
    while (G.isWaterV(G.tileAt(c, topR - 1))) topR--;
  }
  return depthK((py - topR * T) / T, shade);
}
export function waterDepthK(c, r){
  if (!G.isWaterV(G.tileAt(c, r))) return 0;
  var pond = pondAt(c, r);
  var shade = pond ? pond.shade : DEFAULT_SHADE;
  if (shade <= 0) return 0;
  var rec = pond && pond.cols[c];
  var topR = rec ? rec.top : r;
  if (!rec){
    while (G.isWaterV(G.tileAt(c, topR - 1))) topR--;
  }
  return depthK(r - topR, shade);
}
export function getPondShade(c, r){
  var pond = pondAt(c, r);
  return pond ? pond.shade : DEFAULT_SHADE;
}
export function setPondShade(c, r, shade){
  var pond = pondAt(c, r);
  if (!pond) return false;
  pond.shade = shade;
  var lv = G.levelSpec();
  if (!lv.water) lv.water = [];
  var next = [];
  for (var i = 0; i < lv.water.length; i++){
    var e = lv.water[i], rec = pond.cols[e[0]];
    if (rec && e[1] >= rec.top && e[1] <= rec.bot) continue;
    next.push(e);
  }
  next.push([pond.c0, pond.top, shade]);
  lv.water = next;
  return true;
}
export function waterExport(){
  return PONDS.map(function(p){ return [p.c0, p.top, +p.shade.toFixed(2)]; });
}
export function shadePresetName(shade){
  var best = WATER_SHADE_PRESETS[0][0], bd = 99, i;
  for (i = 0; i < WATER_SHADE_PRESETS.length; i++){
    var d = Math.abs(WATER_SHADE_PRESETS[i][1] - shade);
    if (d < bd){ bd = d; best = WATER_SHADE_PRESETS[i][0]; }
  }
  return best;
}

export function buildWater(){
  WEEDS = []; FISH = []; SHORES = []; PONDS = [];
  var MW = G.MAP_W, MH = G.MAP_H, WATER = G.WATER;
  var cBase = G.mapMinC(), rBase = G.mapMinR();
  var seen = new Uint8Array(MW * MH);
  pondIx = new Uint16Array(MW * MH);
  function ix(c, r){ return G.mapIx(c, r); }
  var ponds = [];
  for (var lr = 0; lr < MH; lr++){
    for (var lc = 0; lc < MW; lc++){
      var r = rBase + lr, c = cBase + lc;
      if (G.tileAt(c, r) !== WATER || seen[ix(c, r)]) continue;
      var stack = [[c, r]], cols = {}, c0 = c, c1 = c, top = r, bot = r;
      var cells = [[c, r]];
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
          if (!G.inMap(nc, nr)) continue;
          if (seen[ix(nc, nr)] || G.tileAt(nc, nr) !== WATER) continue;
          seen[ix(nc, nr)] = 1;
          cells.push([nc, nr]);
          stack.push([nc, nr]);
        }
      }
      ponds.push({ c0: c0, c1: c1, top: top, bot: bot, cols: cols, cells: cells });
    }
  }
  var fi = 0;
  for (var p = 0; p < ponds.length; p++){
    var pond = ponds[p];
    pond.shade = matchShade(pond);
    for (var ci = 0; ci < pond.cells.length; ci++)
      pondIx[ix(pond.cells[ci][0], pond.cells[ci][1])] = p + 1;
    delete pond.cells;
    for (var ck0 in pond.cols){
      var col0 = +ck0, rec0 = pond.cols[ck0];
      var topR = rec0.top;
      if (G.isWaterV(G.tileAt(col0, topR - 1))) continue;
      if (!G.isWaterV(G.tileAt(col0 - 1, topR)))
        SHORES.push({ x: col0 * T + 2, y: topR * T, side: -1, fired: false });
      if (!G.isWaterV(G.tileAt(col0 + 1, topR)))
        SHORES.push({ x: (col0 + 1) * T - 2, y: topR * T, side: 1, fired: false });
    }
    PONDS.push(pond);
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

function spawnShoreSpray(e){
  var parts = view.parts;
  var n = 2 + (Math.random() * 4) | 0;
  for (var s = 0; s < n; s++){
    parts.push({
      x: e.x + (Math.random() - 0.5) * 5,
      y: e.y + 1,
      vx: e.side * (4 + Math.random() * 18) + (Math.random() - 0.5) * 8,
      vy: -16 - Math.random() * 38,
      t: 0.2 + Math.random() * 0.28,
      c: Math.random() < 0.4 ? '#e8f6ff' : '#bfe6ff',
      g: 200 + Math.random() * 90,
      sz: Math.random() < 0.6 ? 1 : 2,
      kind: 'spray'
    });
  }
}
function stepShores(){
  var time = view.time, parts = view.parts;
  if (parts.length > 220) return;
  for (var i = 0; i < SHORES.length; i++){
    var e = SHORES[i];
    if (e.x < cam.x - 10 || e.x > cam.x + VW + 10) continue;
    if (e.y < cam.y - 18 || e.y > cam.y + VH + 10) continue;
    var ph = e.x * 0.09 - time * 2.2;
    var wv = Math.sin(ph) * 1.6 + Math.sin(ph * 2.3) * 0.7;
    if (wv > 1.55 && !e.fired){
      e.fired = true;
      if (Math.random() < 0.52) spawnShoreSpray(e);
    }
    if (wv < 0.15) e.fired = false;
  }
}
export function stepWater(dt){
  var S = world(), time = view.time, C = G.C;
  stepShores();
  if (view.edit) return;
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
    var dim = waterTintAt(w.x, w.y - 6);
    if (dim > 0.04) ctx.globalAlpha = 1 - dim * 0.72;
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
    if (dim > 0.04) ctx.globalAlpha = 1;
  }
}
export function drawFish(){
  var time = view.time;
  for (var i = 0; i < FISH.length; i++){
    var f = FISH[i];
    var x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
    if (x < -20 || x > VW + 20 || y < -16 || y > VH + 16) continue;
    if (roomHides(f.x, f.y)) continue;
    var dim = waterTintAt(f.x, f.y);
    if (dim > 0.04) ctx.globalAlpha = 1 - dim * 0.7;
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
    if (dim > 0.04) ctx.globalAlpha = 1;
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
    if (q.drag) q.vx *= Math.max(0, 1 - q.drag * dt);
    if (q.wob) q.vx += Math.sin(view.time * 7 + q.y * 0.2) * q.wob * dt;
    q.x += q.vx*dt; q.y += q.vy*dt; q.vy += q.g*dt;
    if (q.top !== undefined && q.top !== null && q.y < q.top){   // пузырь лопнул у поверхности
      parts.splice(i, 1); continue;
    }
    var sz = q.sz || 1;
    if (q.kind === 'dust'){
      var a = q.life ? q.t / q.life : Math.min(1, q.t * 2.4);
      ctx.globalAlpha = a * 0.88;
      rc(q.x - cam.x, q.y - cam.y, sz, sz, q.c);
      ctx.globalAlpha = 1;
    } else if (q.kind === 'bubble'){
      ctx.globalAlpha = Math.min(1, q.t * 1.8);
      rc(q.x - cam.x, q.y - cam.y, sz, sz, q.c);
      if (sz > 1) rc(q.x - cam.x, q.y - cam.y, 1, 1, '#ffffff');
      ctx.globalAlpha = 1;
    } else {
      rc(q.x - cam.x, q.y - cam.y, sz, sz, q.t > 0.18 ? q.c : '#7a72a8');
    }
  }
}
