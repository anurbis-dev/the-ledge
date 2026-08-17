import GAME from '../core/game.js';
import { ctx, cam, view, VW, rc, lb, world, setFill } from './ctx.js';
import { P } from './palette.js';

var G = GAME, T = G.T;

export function drawTorches(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.torches.length; i++){
    var t = S.torches[i], x = Math.round(t.x - cam.x), y = Math.round(t.y - cam.y);
    if (x < -14 || x > VW+14) continue;
    var a = t.held ? -Math.PI/2 : t.ang;
    var hx3 = x, hy3 = y;                                  // рукоять
    var tx3 = x + Math.cos(a)*11, ty3 = y + Math.sin(a)*11; // навершие
    lb([hx3, hy3], [tx3, ty3], 3, P.woodD);
    lb([hx3, hy3], [tx3, ty3], 1, P.wood);
    if (t.lit){
      var fl = Math.round(Math.sin(time*11 + t.ph)*1);
      rc(tx3-2, ty3-2+fl, 4, 4, '#ff9b3d');
      rc(tx3-1, ty3-4+fl, 2, 3, '#ffd98a');
      rc(tx3-1, ty3-5+fl, 1, 1, '#fff6d0');
    } else {
      rc(tx3-1, ty3-1, 3, 3, '#4a4054');
      if (Math.sin(time*3 + t.ph) > 0.7) rc(tx3, ty3-3, 1, 2, '#6b6270');
    }
  }
}

export function liftButtons(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i];
    var c0 = Math.floor(L.x / T) - 1, c1 = Math.floor((L.x + L.w - 1) / T) + 1;
    for (var f = 0; f < L.floors.length; f++){
      var R = Math.floor(L.floors[f] / T);
      for (var si = 0; si < 2; si++){
        var c = si === 0 ? c0 : c1;
        if (G.isSolidV(G.tileAt(c, R - 1))) continue;      // тут нет проёма
        var side = si === 0 ? -1 : 1;
        var bx = c*T + (side > 0 ? T + 1 : -4) - cam.x;
        var by = (R - 1)*T + 2 - cam.y;
        if (bx < -8 || bx > VW + 8) continue;
        var here = Math.abs(L.y - L.floors[f]) <= 3;
        var blink = here ? true : (Math.sin(time*5) > -0.2);
        rc(bx - 1, by - 1, 5, 9, '#241d3d');
        rc(bx, by, 3, 3, here ? '#7de08a' : (blink ? '#ffd06a' : '#6b5a2a'));
        rc(bx, by + 4, 3, 3, here ? '#3f7a4a' : (blink ? '#a8762a' : '#4a3a1c'));
      }
    }
  }
}
export function shaftGates(){
  var S = world();
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i];
    var c0 = Math.floor(L.x / T) - 1, c1 = Math.floor((L.x + L.w - 1) / T) + 1;
    for (var f = 0; f < L.floors.length; f++){
      var closed = Math.abs(L.y - L.floors[f]) > 3;
      if (!closed) continue;
      var R = Math.floor(L.floors[f] / T);
      for (var si = 0; si < 2; si++){
        var c = si === 0 ? c0 : c1;
        if (G.isSolidV(G.tileAt(c, R - 1))) continue;
        var x = c*T - cam.x, y = (R - 2)*T - cam.y;
        rc(x, y, T, T*2, '#3a3157');                       // створка
        rc(x + 1, y, 1, T*2, '#5c5183');
        rc(x + T - 2, y, 1, T*2, '#241d3d');
        for (var g = 0; g < 4; g++) rc(x + 2, y + 4 + g*7, T - 4, 2, '#241d3d');
        rc(x + 2, y + T - 1, T - 4, 2, '#7a6aa8');         // риска середины
      }
    }
  }
}
export function lifts(){
  var S = world(), time = view.time;
  shaftGates();
  liftButtons();
  for (var i = 0; i < S.lifts.length; i++){
    var L = S.lifts[i];
    var x = Math.round(L.x - cam.x), y = Math.round(L.y - cam.y), hh2 = L.hh;
    if (x < -70 || x > VW + 70) continue;
    // трос до верха шахты
    rc(x + L.w/2 - 1, y - hh2 - 240, 2, 240, '#2a2444');
    // кабина: пол, стены, крыша
    rc(x - 2, y - hh2 - 4, L.w + 4, 4, P.liftB);
    rc(x - 2, y - hh2 - 4, L.w + 4, 1, P.liftC);
    rc(x - 2, y, L.w + 4, 6, P.liftB);
    rc(x - 2, y, L.w + 4, 1, P.liftC);
    rc(x - 2, y - hh2, 3, hh2, P.liftB);
    rc(x + L.w - 1, y - hh2, 3, hh2, P.liftB);
    rc(x + 1, y - hh2, L.w - 2, hh2, '#241d3d');       // тёмное нутро
    // решётчатые двери: раскрыты на стоянке
    var open = (L.st === 'dwell' && L.t <= 0);
    var dw = open ? 3 : (L.w/2 - 2);
    rc(x + 1, y - hh2 + 2, dw, hh2 - 3, P.liftA);
    rc(x + L.w - 1 - dw, y - hh2 + 2, dw, hh2 - 3, P.liftA);
    for (var g = 0; g < hh2 - 4; g += 5){
      rc(x + 1, y - hh2 + 3 + g, dw, 1, P.liftB);
      rc(x + L.w - 1 - dw, y - hh2 + 3 + g, dw, 1, P.liftB);
    }
    // индикатор движения
    var lampOn = (L.st === 'move') ? (Math.sin(time*9) > 0) : open;
    rc(x + L.w/2 - 2, y - hh2 - 3, 4, 2, lampOn ? '#ffd06a' : '#4b4368');
  }
}
export function plats(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.plats.length; i++){
    var q = S.plats[i], x = q.x - cam.x, y = q.y - cam.y;
    if (q.vert){
      rc(x + q.w/2 - 1, y - (q.y - q.y0) - 200, 2, 200 + (q.y - q.y0), '#2a2444');  // трос
      rc(x, y, q.w, q.h, P.liftB);
      rc(x, y, q.w, 2, P.liftA); rc(x, y, q.w, 1, P.liftC);
      rc(x+1, y+3, 3, 2, P.liftA); rc(x+q.w-4, y+3, 3, 2, P.liftA);
      rc(x + q.w/2 - 3, y - 3, 6, 3, P.liftB); rc(x + q.w/2 - 2, y - 3, 4, 1, P.liftC);
      var st = Math.sin(time*3 + i) > 0 ? P.liftC : P.liftA;
      rc(x + 2, y + q.h - 2, 2, 2, st); rc(x + q.w - 4, y + q.h - 2, 2, 2, st);
    } else {
      rc(x, y, q.w, q.h, P.woodD);
      rc(x, y, q.w, 2, P.wood); rc(x, y, q.w, 1, P.woodL);
      rc(x+2, y+q.h, 2, 2, P.rockX); rc(x+q.w-4, y+q.h, 2, 2, P.rockX);
    }
  }
}
export function caveExit(){
  var S = world(), time = view.time;
  var e = G.levelSpec().exit; if (!e) return;
  var x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y);
  if (x < -60 || x > VW + 60) return;
  // скальная арка
  setFill('#1b1430');
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.quadraticCurveTo(x - 14, y - 34, x + 8, y - 36);
  ctx.quadraticCurveTo(x + 30, y - 34, x + 30, y);
  ctx.closePath(); ctx.fill();
  setFill('#08060f');
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.quadraticCurveTo(x - 9, y - 28, x + 8, y - 30);
  ctx.quadraticCurveTo(x + 25, y - 28, x + 25, y);
  ctx.closePath(); ctx.fill();
  rc(x - 14, y - 2, 44, 3, '#3a3157');
  for (var i = 0; i < 5; i++) rc(x - 12 + i*11, y - 6 - (i%2)*3, 3, 3, '#2a2444');
  // манящее свечение и подсказка
  var gl = 0.4 + Math.sin(time*2)*0.18;
  ctx.globalAlpha = gl;
  rc(x - 6, y - 24, 26, 22, '#3d2a5e');
  ctx.globalAlpha = 1;
  var near = Math.abs((S.p.x + S.p.w/2) - (e.x + 8)) < 60 && Math.abs((S.p.y + S.p.h) - e.y) < 40;
  if (near && Math.sin(time*4) > -0.3){
    var ay = y - 46 + Math.round(Math.sin(time*2)*2);
    rc(x + 4, ay + 4, 8, 8, '#241a30');
    rc(x + 7, ay, 2, 8, '#ffd9a0');
    rc(x + 5, ay + 2, 2, 2, '#ffd9a0'); rc(x + 9, ay + 2, 2, 2, '#ffd9a0');
  }
}
export function doors(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.doors.length; i++){
    var d = S.doors[i], x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y);
    if (x < -30 || x > VW+30) continue;
    rc(x-1, y-27, 18, 27, '#241a30');
    rc(x, y-25, 16, 25, P.doorD);
    rc(x+1, y-24, 14, 23, P.door);
    rc(x+1, y-24, 14, 1, P.doorL);
    rc(x+7, y-24, 2, 23, P.doorD);
    rc(x+2, y-20, 5, 7, P.doorD); rc(x+9, y-20, 5, 7, P.doorD);
    rc(x+12, y-12, 2, 2, P.lockD);
    if (d.locked){
      rc(x+6, y-14, 4, 5, P.lockC); rc(x+7, y-16, 2, 3, P.lockD);
      rc(x+7, y-12, 2, 2, P.lockD);
      // подсказка: нужен ключ (мигает, когда героиня рядом)
      var near = Math.abs((S.p.x + S.p.w/2) - (d.x + 8)) < 60 &&
                 Math.abs((S.p.y + S.p.h/2) - (d.y - 12)) < 46;
      if (near && Math.sin(time*4) > -0.3){
        var by2 = y - 40 + Math.round(Math.sin(time*2)*1.5);
        rc(x+2, by2, 12, 12, '#241a30');
        rc(x+5, by2+2, 5, 5, S.keys > 0 ? '#7de08a' : P.lockC);
        rc(x+6, by2+3, 3, 3, '#241a30');
        rc(x+6, by2+7, 2, 4, S.keys > 0 ? '#7de08a' : P.lockC);
        rc(x+8, by2+9, 2, 1, S.keys > 0 ? '#7de08a' : P.lockC);
      }
    } else {
      rc(x+1, y-24, 14, 4, '#120d1e');    // приоткрытая тьма проёма
    }
  }
}
export function enemies(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.enemies.length; i++){
    var e = S.enemies[i];
    var x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y);
    if (x < -20 || x > VW+20) continue;
    if (e.dead){
      if (e.hitT <= 0) continue;
      var f = Math.max(0, e.hitT/0.6);
      rc(x+1, y + e.h - 3 + (1-f)*3, e.w-2, 3, P.foeB);
      continue;
    }
    var hop = Math.round(Math.sin(time*(e.kind === 1 ? 9 : 6) + e.ph)*1.5);
    var bodyA = e.kind === 1 ? '#b05f7a' : (e.kind === 2 ? '#5f7fb0' : P.foeA);
    var bodyB = e.kind === 1 ? '#7a3d52' : (e.kind === 2 ? '#3d537a' : P.foeB);
    if (e.hurt) bodyA = '#d0a0a0';
    rc(x, y+hop, e.w, e.h, bodyB);
    rc(x+1, y+1+hop, e.w-2, e.h-3, bodyA);
    rc(x+1, y+1+hop, e.w-2, 1, '#ffffff33');
    var ex = e.dir > 0 ? x + e.w - 4 : x + 2;
    rc(ex, y+4+hop, 2, 2, P.foeEye);
    rc(x+1, y+e.h-2+hop, 3, 2, bodyB); rc(x+e.w-4, y+e.h-2+hop, 3, 2, bodyB);
    if (e.kind === 0)
      for (var t = 0; t < 3; t++) rc(x+2+t*3, y-2+hop+Math.round(Math.sin(time*7+t)*1), 1, 3, bodyA);
    if (e.kind === 1){ rc(ex + (e.dir>0?2:-2), y+3+hop, 2, 5, '#ffd9a0'); }   // жало
    if (e.kind === 2){ rc(x, y-2+hop, e.w, 3, '#8fa8cc'); rc(x+3, y-4+hop, 2, 3, '#8fa8cc');
      rc(x+e.w-5, y-4+hop, 2, 3, '#8fa8cc'); }                                // панцирь и рожки
  }
}
export function fliers(){
  var S = world();
  for (var i = 0; i < S.fliers.length; i++){
    var f = S.fliers[i];
    var x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
    if (x < -22 || x > VW + 22) continue;
    if (f.dead){
      if (f.hitT <= 0) continue;
      rc(x + 2, y, f.w - 4, 4, P.foeB); continue;
    }
    var wing = Math.sin(f.flap * (f.kind === 1 ? 20 : 12) + f.ph) * (f.kind === 2 ? 6 : 4);
    var fa = f.kind === 1 ? '#8f6d4a' : (f.kind === 2 ? '#4a6d8f' : (f.kind === 3 ? '#8f2f3a' : '#6d5a8f'));
    var fb = f.kind === 1 ? '#c9a06a' : (f.kind === 2 ? '#7fa8cc' : (f.kind === 3 ? '#e06a6a' : '#9b83c4'));
    rc(x + 2, y + 2, f.w - 4, f.h - 3, fa);
    rc(x + 3, y + 3, f.w - 6, 2, fb);
    if (f.kind === 2){ rc(x + 1, y + 1, f.w - 2, 2, fb); rc(x + f.w/2 - 1, y - 3, 2, 3, fb); }
    var ex = f.dir > 0 ? x + f.w - 4 : x + 2;
    rc(ex, y + 3, 2, 2, P.foeEye);
    rc(f.dir > 0 ? x + f.w - 2 : x, y + 5, 2, 2, '#ffb060');   // клюв
    lb([x + 3, y + 3], [x - 3, y + 3 - wing], 2, fa);
    lb([x + f.w - 3, y + 3], [x + f.w + 3, y + 3 - wing], 2, fa);
  }
  for (var d = 0; d < S.drops.length; d++){
    var q = S.drops[d];
    var dx2 = Math.round(q.x - cam.x), dy2 = Math.round(q.y - cam.y);
    rc(dx2 - 1, dy2 - 2, 3, 4, '#d9d3b0'); rc(dx2 - 1, dy2 - 2, 2, 2, '#f2eed2');
  }
}
export function chests(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.chests.length; i++){
    var ch = S.chests[i];
    var x = Math.round(ch.x - cam.x), y = Math.round(ch.y - cam.y);
    if (x < -30 || x > VW + 30) continue;
    if (ch.t > 0) ch.t -= 1/60;
    rc(x + 1, y - 11, 18, 11, P.chestD);            // корпус
    rc(x + 2, y - 10, 16, 9, P.chest);
    rc(x + 2, y - 10, 16, 1, P.chestL);
    rc(x + 9, y - 10, 2, 9, P.chestD);
    if (ch.opened){
      rc(x + 1, y - 18, 18, 5, P.chestD);           // откинутая крышка
      rc(x + 2, y - 17, 16, 3, P.chest);
      rc(x + 4, y - 9, 12, 6, '#191228');
      if (ch.t > 0){
        var g = Math.min(1, ch.t / 1.6);
        var iy = y - 18 - (1 - g) * 16;                      // предмет всплывает над сундуком
        ctx.globalAlpha = Math.min(1, g * 1.6);
        if (ch.kind === 'helmet'){ rc(x+5, iy, 10, 4, P.helmD); rc(x+4, iy+4, 12, 2, P.helm); }
        else if (ch.kind === 'shield'){ rc(x+6, iy-1, 8, 10, P.shld); rc(x+6, iy-1, 8, 1, '#e0b06a'); }
        else if (ch.kind === 'key'){ rc(x+8, iy, 5, 5, P.key); rc(x+9, iy+5, 3, 6, P.key); }
        else if (ch.kind === 'gem'){ rc(x+6, iy+1, 8, 3, P.gem); rc(x+7, iy+4, 6, 4, P.gemD); }
        else if (ch.kind === 'shroom'){ rc(x+9, iy+4, 2, 4, P.stem); rc(x+6, iy, 8, 4, P.shroom); }
        else { rc(x+7, iy, 6, 8, P.coin); rc(x+6, iy+2, 8, 4, P.coin); }
        ctx.globalAlpha = 1;
      }
    } else {
      rc(x + 1, y - 15, 18, 5, P.chestD);           // закрытая крышка
      rc(x + 2, y - 14, 16, 3, P.chest);
      rc(x + 2, y - 14, 16, 1, P.chestL);
      rc(x + 8, y - 13, 4, 5, ch.locked ? P.lockC : P.band);
      rc(x + 9, y - 12, 2, 3, P.chestD);
      if (ch.locked && Math.sin(time*4) > 0.2 &&
          Math.abs((S.p.x + S.p.w/2) - (ch.x + 10)) < 46){
        rc(x + 6, y - 30, 8, 8, '#241a30');
        rc(x + 8, y - 28, 4, 4, S.keys > 0 ? '#7de08a' : P.lockC);
      }
    }
  }
}
export function lootDrops(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.loot.length; i++){
    var l = S.loot[i];
    var x = Math.round(l.x - cam.x), y = Math.round(l.y - cam.y);
    if (x < -10 || x > VW + 10) continue;
    var bl = l.t < 3 && Math.sin(time*12) < 0;               // мигает перед исчезновением
    if (bl) continue;
    if (l.kind === 'coin'){ rc(x-2, y-3, 4, 6, P.coin); rc(x-3, y-2, 6, 4, P.coin); }
    else if (l.kind === 'gem'){ rc(x-3, y-2, 6, 2, P.gem); rc(x-2, y, 4, 3, P.gemD); }
    else if (l.kind === 'key'){ rc(x-1, y-4, 4, 4, P.key); rc(x, y, 2, 5, P.key); }
    else { rc(x-1, y, 2, 3, P.stem); rc(x-3, y-3, 6, 3, P.shroom); }
  }
}
export function spiders(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.spiders.length; i++){
    var sp = S.spiders[i];
    if (sp.dead && sp.hitT <= 0) continue;
    var x = Math.round(sp.x - cam.x), y = Math.round(sp.y - cam.y);
    var hy = Math.round(sp.hy - cam.y);
    if (x < -16 || x > VW + 16) continue;
    var body = sp.kind === 0 ? '#3b2f4a' : (sp.kind === 1 ? '#6b2f3a' : '#2f4a3b');
    var mark = sp.kind === 0 ? '#c9a0ff' : (sp.kind === 1 ? '#ff9a7a' : '#9fe0a0');
    if (sp.dead){ rc(x - 3, y, 6, 2, body); continue; }
    if (sp.len > 0.5){                                  // паутина
      ctx.globalAlpha = 0.55;
      rc(x, hy, 1, Math.max(1, y - hy), '#d8e4f0');
      ctx.globalAlpha = 1;
    }
    var wig = Math.sin(time*8 + sp.ph);
    for (var l = 0; l < 4; l++){                         // лапки
      var sgn = l < 2 ? -1 : 1, k2 = (l % 2);
      lb([x, y], [x + sgn*(4 + k2*2), y + 3 + Math.round(wig*(1 + k2))], 1, body);
    }
    rc(x - 3, y - 2, 6, 5, body);
    rc(x - 1, y - 1, 2, 2, mark);
    rc(x - 3 + (sp.dir > 0 ? 4 : 0), y - 2, 2, 1, mark);
  }
}
export function pickables(){
  var S = world(), time = view.time;
  var pk = S.pick;
  if (!pk.stick.taken){
    var sx2 = Math.round(pk.stick.x - cam.x), sy = Math.round(pk.stick.y - cam.y + Math.sin(time*2)*2);
    rc(sx2-10, sy, 20, 2, P.stickC); rc(sx2-10, sy+2, 20, 1, P.stickD);
    rc(sx2+8, sy-1, 3, 4, P.stickD);
  }
  if (!pk.key.taken){
    var kx = Math.round(pk.key.x - cam.x), ky = Math.round(pk.key.y - cam.y + Math.sin(time*2.6)*2);
    rc(kx-1, ky-4, 4, 4, P.key); rc(kx, ky-3, 2, 2, P.keyD);
    rc(kx, ky, 2, 6, P.key); rc(kx+2, ky+3, 2, 1, P.key); rc(kx+2, ky+5, 2, 1, P.key);
  }
}
export function items(){
  var S = world(), time = view.time;
  for (var i = 0; i < S.items.length; i++){
    var it = S.items[i]; if (it.got) continue;
    var bob = Math.sin(time*2.4 + it.ph)*2;
    var x = Math.round(it.x - cam.x), y = Math.round(it.y - cam.y + bob);
    if (x < -12 || x > VW+12) continue;
    if (it.kind === 'gem'){
      rc(x-1,y-4,2,1,P.gem); rc(x-3,y-3,6,2,P.gem); rc(x-2,y-1,4,3,P.gemD);
      rc(x-1,y+2,2,2,P.gemD); rc(x-2,y-3,1,2,'#ffffff');
    } else if (it.kind === 'coin'){
      rc(x-2,y-3,4,6,P.coin); rc(x-3,y-2,6,4,P.coin); rc(x+1,y-2,1,4,P.coinD); rc(x-2,y-2,1,2,'#fff6c9');
    } else if (it.kind === 'shroom'){
      rc(x-1,y,2,4,P.stem); rc(x-4,y-3,8,3,P.shroom); rc(x-3,y-5,6,2,P.shroom);
      rc(x-2,y-4,1,1,'#ffe9c9'); rc(x+1,y-3,1,1,'#ffe9c9'); rc(x-4,y,8,1,P.shroomD);
    } else {
      rc(x-3,y-5,6,10,P.relicD); rc(x-2,y-4,4,8,P.relic); rc(x-1,y-2,2,4,'#fff');
      rc(x-4,y-6,8,1,P.relicD); rc(x-4,y+5,8,1,P.relicD);
    }
  }
}
