import GAME from '../core/game.js';
import { ctx, view, VW, VH, rc, world } from './ctx.js';
import { P } from './palette.js';

var G = GAME, C = G.C;

export var DIG = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001',
           '111100111001111','111100111101111','111001001010010','111101111101111','111101111001111'];
export function digit(n, x, y, col){
  var s = DIG[n];
  for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (s[r*3+c] === '1') rc(x+c, y+r, 1, 1, col);
}
export function num(v, x, y, col){
  var s = '' + v;
  for (var i = 0; i < s.length; i++) digit(+s[i], x + i*4, y, col);
}
export function hud(){
  var S = world(), time = view.time;
  var i;
  for (i = 0; i < 3; i++){
    var x = 6 + i*9, y = 6, on = i < S.hp;
    rc(x+1, y, 2, 1, on?P.hp:P.hpD); rc(x+4, y, 2, 1, on?P.hp:P.hpD);
    rc(x, y+1, 7, 2, on?P.hp:P.hpD); rc(x+1, y+3, 5, 1, on?P.hp:P.hpD);
    rc(x+2, y+4, 3, 1, on?P.hp:P.hpD); rc(x+3, y+5, 1, 1, on?P.hp:P.hpD);
    if (on) rc(x+1, y+1, 2, 1, '#ffb9c4');
  }
  var bx = 6, by = 14;
  rc(bx+1,by,2,1,P.gem); rc(bx,by+1,4,2,P.gem); rc(bx+1,by+3,2,2,P.gemD);
  num(S.bag.gem, bx+7, by+1, '#cfeaff');
  rc(bx+22,by+1,4,4,P.coin); rc(bx+23,by,2,6,P.coin);
  num(S.bag.coin, bx+29, by+1, '#ffe9a8');
  rc(bx+45,by+2,2,3,P.stem); rc(bx+43,by,6,2,P.shroom);
  num(S.bag.shroom, bx+51, by+1, '#ffcdb4');
  if (S.keys > 0){
    var kx2 = bx + 66, ky2 = by;
    rc(kx2, ky2, 4, 4, P.key); rc(kx2+1, ky2+1, 2, 2, P.keyD);
    rc(kx2+1, ky2+4, 2, 4, P.key); rc(kx2+3, ky2+6, 2, 1, P.key);
    num(S.keys, kx2+7, ky2+1, '#ffe9a8');
  }
  if (S.p.stance > 0){
    var sx3 = bx + 100, sy3 = by;
    rc(sx3, sy3 + (S.p.stance === 2 ? 4 : 2), 8, 2, S.p.stance === 2 ? '#ff9b6a' : '#9fe0ff');
    rc(sx3 + 2, sy3, 4, 2, '#4a4368');
  }
  // инвентарь: активное снаряжение с прочностью и число запасных
  var slots = [['weapon', 84], ['helmet', 108], ['shield', 130], ['scuba', 152], ['flippers', 174], ['harpoon', 196]];
  for (var si = 0; si < slots.length; si++){
    var sl = slots[si][0], ox2 = bx + slots[si][1], g2 = S.p.gear[sl];
    if (!g2) continue;
    var gc = P.gearCol[g2.type] || ['#cfc6ff', '#7a72a8'];
    if (sl === 'weapon' || sl === 'harpoon'){ rc(ox2, by + 2, 14, 2, gc[0]); rc(ox2, by + 4, 14, 1, gc[1]); }
    else if (sl === 'helmet'){ rc(ox2, by, 8, 4, gc[1]); rc(ox2 - 1, by + 4, 10, 2, gc[0]); }
    else if (sl === 'scuba'){ rc(ox2, by, 6, 8, gc[0]); rc(ox2+6, by+2, 3, 4, gc[1]); }
    else if (sl === 'flippers'){ rc(ox2, by+2, 10, 4, gc[0]); rc(ox2-1, by+5, 4, 3, gc[1]); rc(ox2+7, by+5, 4, 3, gc[1]); }
    else { rc(ox2, by, 7, 9, gc[0]); rc(ox2, by, 7, 1, '#ffe9a8'); }
    var wgt = Math.max(0, Math.round(g2.uses / g2.max * 14));   // полоска прочности (у ласт/акваланга всегда полная)
    rc(ox2, by + 8, 14, 2, '#2a2444');
    rc(ox2, by + 8, wgt, 2, g2.uses <= 2 ? '#ff7a6a' : '#7de08a');
    var sp2 = 0;
    for (var q2 = 0; q2 < S.p.spare.length; q2++) if (S.p.spare[q2].slot === sl) sp2++;
    if (sp2 > 0) num(sp2, ox2 + 16, by + 1, '#cfc6ff');
  }
  var airMax2 = S.p.scuba ? C.SCUBA_AIR : C.AIR_MAX;
  if (S.p.inWater || S.p.air < airMax2 - 0.1){
    var aw = Math.max(0, Math.round(S.p.air / airMax2 * 40));
    rc(6, 24, 42, 5, '#1b2436');
    rc(7, 25, aw, 3, S.p.air < 4 ? '#ff7a6a' : '#7fd0ff');
    for (var ab = 0; ab < 3; ab++) rc(50 + ab*4, 25 + (ab%2), 2, 2, '#7fd0ff');
    if (S.p.scuba){
      rc(70, 24, 3, 5, '#8a94a0'); rc(71, 22, 1, 2, '#8a94a0');
      num(S.bag.tank, 75, 25, '#cfeaff');
    }
  }
  if (S.done){
    var a = 0.5 + Math.sin(time*3)*0.3;
    ctx.globalAlpha = a; rc(VW/2-18, 8, 36, 10, P.relicD);
    rc(VW/2-16, 10, 32, 6, P.relic); ctx.globalAlpha = 1;
  }
}

export function panel(x, y, w, h){
  ctx.globalAlpha = 0.86; rc(x, y, w, h, '#150f26'); ctx.globalAlpha = 1;
  rc(x, y, w, 1, '#6a5fa8'); rc(x, y + h - 1, w, 1, '#6a5fa8');
  rc(x, y, 1, h, '#6a5fa8'); rc(x + w - 1, y, 1, h, '#6a5fa8');
}
export function textPix(str, x, y, col, scale){
  scale = scale || 1;
  for (var i = 0; i < str.length; i++){
    var ch = str.charCodeAt(i) - 48;
    if (ch >= 0 && ch <= 9) digitS(ch, x + i*4*scale, y, col, scale);
  }
}
export function digitS(n, x, y, col, sc){
  var s2 = DIG[n];
  for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++)
    if (s2[r*3+c] === '1') rc(x + c*sc, y + r*sc, sc, sc, col);
}
export function drawIntro(){
  var time = view.time;
  var lv = G.levelSpec();
  panel(VW/2 - 74, VH/2 - 26, 148, 52);
  var t2 = lv.name;
  rc(VW/2 - 60, VH/2 - 12, 120, 1, '#3b3268');
  ctx.globalAlpha = 1;
  // название рисуем крупными «кирпичами» по буквам-заглушкам
  var step = Math.min(14, 110 / Math.max(1, t2.length));
  for (var i = 0; i < t2.length; i++){
    var bx = VW/2 - (t2.length*step)/2 + i*step;
    rc(bx, VH/2 - 8, step - 2, 10, '#ffd9a0');
    rc(bx, VH/2 - 8, step - 2, 2, '#fff3c4');
  }
  var bl = Math.sin(time*4) > 0;
  if (bl){ rc(VW/2 - 26, VH/2 + 12, 52, 2, '#8f88bb'); rc(VW/2 - 30, VH/2 + 12, 3, 2, '#8f88bb');
           rc(VW/2 + 27, VH/2 + 12, 3, 2, '#8f88bb'); }
}
export function drawPaused(){
  panel(VW/2 - 46, VH/2 - 20, 92, 40);
  rc(VW/2 - 10, VH/2 - 9, 6, 18, '#ffd9a0');
  rc(VW/2 + 4, VH/2 - 9, 6, 18, '#ffd9a0');
}
export function drawOutro(){
  var o = view.outro, tt = o.totals;
  var time = view.time;
  panel(VW/2 - 84, VH/2 - 44, 168, 88);
  var rows = [
    ['coin',   o.bag.coin, tt.coin],
    ['gem',    o.bag.gem,  tt.gem],
    ['shroom', o.bag.shroom, tt.shroom || 0],
    ['chest',  tt.chestsOpen, tt.chests],
    ['secret', tt.secretsFound, tt.secrets]
  ];
  for (var i = 0; i < rows.length; i++){
    var y = VH/2 - 32 + i*14, k = rows[i][0];
    if (k === 'coin'){ rc(VW/2 - 74, y, 5, 7, P.coin); rc(VW/2 - 75, y+1, 7, 5, P.coin); }
    else if (k === 'gem'){ rc(VW/2 - 76, y+1, 8, 3, P.gem); rc(VW/2 - 75, y+4, 6, 3, P.gemD); }
    else if (k === 'shroom'){ rc(VW/2 - 73, y+3, 2, 4, P.stem); rc(VW/2 - 76, y, 8, 3, P.shroom); }
    else if (k === 'chest'){ rc(VW/2 - 77, y+1, 10, 6, P.chest); rc(VW/2 - 77, y, 10, 2, P.chestL); }
    else { rc(VW/2 - 76, y, 8, 7, '#241a30'); rc(VW/2 - 74, y+2, 4, 3, P.lockC); }
    textPix('' + rows[i][1], VW/2 - 30, y, '#ffe9a8', 1);
    rc(VW/2 - 12, y + 3, 5, 1, '#6a628f');
    textPix('' + rows[i][2], VW/2 - 2, y, '#cfc6ff', 1);
  }
  if (Math.sin(time*4) > 0) rc(VW/2 - 26, VH/2 + 34, 52, 2, '#8f88bb');
}
