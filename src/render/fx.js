import GAME from '../core/game.js';
import { damage } from '../core/player.js';
import { ctx, cam, view, VW, VH, rc, lb, world } from './ctx.js';
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
  ctx.fillStyle = SKYG; ctx.fillRect(0, 0, VW, VH);
  for (var i = 0; i < 54; i++){
    var sx = (i*67 - cam.x*0.05) % 340; if (sx < 0) sx += 340;
    var sy = (i*29) % 90 - cam.y*0.03;
    if (sy > -2 && sy < VH) rc(sx, sy, 1, 1, i%4 ? '#ffffff44' : '#ffd9a044');
  }
  function ridge(off, amp, base, col){
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, VH);
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
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.quadraticCurveTo(x + w*0.10, y + h*0.30, x + w*0.26, y + h*0.42);
  ctx.quadraticCurveTo(x + w*0.34, y - h*0.06, x + w*0.52, y + h*0.20);
  ctx.quadraticCurveTo(x + w*0.70, y - h*0.02, x + w*0.78, y + h*0.40);
  ctx.quadraticCurveTo(x + w*0.92, y + h*0.30, x + w, y + h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = colD;
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
export function foreLayer(par, per, hmin, hmax, col, colD, seed){
  var n = Math.ceil(VW/per) + 3, base = Math.floor(cam.x*par/per);
  for (var j = 0; j < n; j++){
    var idx = base + j, x = idx*per - cam.x*par;
    if (x < -90 || x > VW + 60) continue;
    var hsh = ((idx*2654435761) ^ (seed*40503)) >>> 0;
    var sd = (hsh % 1000)/1000, kind = (hsh >> 11) % 3;
    var h = hmin + sd*(hmax - hmin), w = 34 + sd*30;
    var y = VH - h + 4;                        // всегда стоят на нижней кромке кадра
    if (kind === 0) bush(x, y, w, h, col, colD);
    else if (kind === 1){
      bush(x, y + h*0.30, w*0.7, h*0.70, col, colD);
      branch(x + w*0.55, y + h*0.55, 18 + sd*10, (hsh % 2) ? 1 : -1, col);
    } else {
      for (var g = 0; g < 9; g++){                 // пучок травы от самого низа
        var gx = x + g*4 + (hsh >> g) % 3;
        var gh = h*0.55 + ((hsh >> (g*2)) % 10);
        lb([gx, VH + 4], [gx + ((g%2)?3:-3), VH + 4 - gh], 2, col);
      }
    }
  }
}
export function fore(){
  var time = view.time;
  foreLayer(0.9, 150, 10, 17, '#2a2048', '#372a5c', 3);   // дальние кусты
  foreLayer(1.3, 122, 13, 22, '#1b1436', '#241a44', 7);   // средние
  foreLayer(1.8,  96, 16, 28, '#0e0a1e', '#150f2a', 11);  // ближние, у самой камеры
  for (var i = 0; i < 20; i++){                            // пыльца
    var px = ((i*137 - cam.x*1.9) % 380 + 380) % 380 - 20;
    var py = ((i*83 + Math.sin(time*0.6 + i)*14 - cam.y*1.3) % 210 + 210) % 210 - 10;
    if (px < -4 || px > VW+4) continue;
    ctx.globalAlpha = 0.45; rc(px, py, 1, 1, i%3 ? '#c9b6ff' : '#ffd9a0'); ctx.globalAlpha = 1;
  }
}

export function buildWater(){
  WEEDS = []; FISH = [];
  var pools = {};                                     // группируем воду в водоёмы по колонкам
  for (var c = 0; c < G.MAP_W; c++){
    var top = -1, bot = -1;
    for (var r = 0; r < G.MAP_H; r++){
      if (G.tileAt(c, r) === G.WATER){ if (top < 0) top = r; bot = r; }
      else if (top >= 0 && r > bot + 1){ break; }
    }
    if (top >= 0){
      pools[c] = { top: top, bot: bot };
      var depth = (bot - top + 1);
      var n = depth > 3 ? 3 : (depth > 1 ? 2 : 1);
      for (var k = 0; k < n; k++){
        var h1 = ((c*7 + k*13) % 100) / 100;
        if (h1 < 0.32) continue;                      // не сплошным забором
        var len = 5 + h1 * depth * 10;                // глубже — длиннее
        WEEDS.push({ x: c*T + 2 + ((c*5 + k*7) % 12),
                     y: (bot + 1) * T,
                     len: len, w: 1 + ((c + k) % 3),
                     hue: (c + k) % 3, ph: ((c*17 + k*31) % 100) / 100 * 6.28,
                     sway: 0.5 + h1 });
      }
    }
  }
  // рыбы: разные размеры и глубины
  var cols = Object.keys(pools).map(Number);
  if (cols.length > 4){
    var c0 = cols[0], c1 = cols[cols.length - 1];
    var count = Math.min(9, Math.max(3, Math.floor(cols.length / 8)));
    for (var f = 0; f < count; f++){
      var pc = cols[(f * 7 + 3) % cols.length];
      var pool = pools[pc];
      var big = f % 3 === 2;
      FISH.push({
        x: pc*T, y: (pool.top + 1 + ((f*3) % Math.max(1, pool.bot - pool.top))) * T,
        x0: c0*T + 8, x1: (c1 + 1)*T - 8,
        big: big, w: big ? 13 : 7, h: big ? 7 : 4,
        v: (big ? 26 : 44) + (f % 3) * 7,
        dir: f % 2 ? -1 : 1, kind: f % 3,
        ph: f * 1.7, scare: 0, bite: 0
      });
    }
  }
}
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
    if (x < -8 || x > VW + 8) continue;
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
    if (x < -20 || x > VW + 20) continue;
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
  ctx.fillStyle = VIGG; ctx.fillRect(0, 0, VW, VH);
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
