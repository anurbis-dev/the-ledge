import GAME from '../core/game.js';
import { ctx, view, VW, VH, rc, world, setCtx, getCtx } from './ctx.js';
import { P } from './palette.js';
import { pickIntroLine } from '../core/intro.js';
import { listHand, activeHandItem, isHarpoonHand } from '../entities/gear.js';
import { FOLD_AXIS, foldHeroOrigin, foldBlit } from './fold.js';
import { blip } from '../audio/sfx.js';

var G = GAME, C = G.C;

export var DIG = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001',
           '111100111001111','111100111101111','111001001010010','111101111101111','111101111001111'];
/* 3×5 заглавные — для плашек */
var ABC = {
  A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110',
  E:'111100110100111', F:'111100110100100', G:'011100101101011', H:'101101111101101',
  I:'111010010010111', J:'001001001101010', K:'101101110101101', L:'100100100100111',
  M:'101111111101101', N:'110111111101101', O:'010101101101010', P:'110101110100100',
  Q:'010101101111011', R:'110101110101101', S:'011100010001110', T:'111010010010010',
  U:'101101101101011', V:'101101101101010', W:'101101111111101', X:'101101010101101',
  Y:'101101010010010', Z:'111001010100111',
  '.':'000000000000010', ',':'000000000010100', "'":'010010000000000',
  '!':'010010010000010', '?':'110001010000010', '-':'000000111000000', ':':'000010000010000',
  '+':'000010111010000',
  '>':'100110111110100', '<':'001011111011001', '/':'001001010100100'
};
var introLine = '';

var IW = 148, IH = 52;
var IX = ((VW - IW) / 2) | 0, IY = ((VH - IH) / 2) | 0;
var OW = 176, OH = 112;
var OX = ((VW - OW) / 2) | 0, OY = ((VH - OH) / 2) | 0;
var BTN_W = 76, BTN_H = 13, BTN_Y = 90;

var introCv = document.createElement('canvas');
introCv.width = IW; introCv.height = IH;
var introCx = introCv.getContext('2d');
introCx.imageSmoothingEnabled = false;

var outroCv = document.createElement('canvas');
outroCv.width = OW; outroCv.height = OH;
var outroCx = outroCv.getContext('2d');
outroCx.imageSmoothingEnabled = false;

var introFold = { on: false, fold: 0, dir: 0, last: 0, ox: VW / 2, oy: VH / 2 };
var outroFold = { on: false, fold: 0, dir: 0, last: 0, ox: VW / 2, oy: VH / 2, focus: 'continue', pick: null };

function pingOpen(){ blip(480, 0.08, 'triangle', 0.04); }
function pingOpenH(){ blip(640, 0.07, 'triangle', 0.035); }
function pingCloseH(){ blip(360, 0.07, 'triangle', 0.035); }
function pingClose(){ blip(240, 0.1, 'triangle', 0.04); }
function pingPick(){ blip(720, 0.08, 'triangle', 0.04); }

function fillSheet(x, y, w, h){
  rc(x, y, w, h, '#120c20');
  rc(x, y, w, 1, '#6a5fa8'); rc(x, y + h - 1, w, 1, '#6a5fa8');
  rc(x, y, 1, h, '#6a5fa8'); rc(x + w - 1, y, 1, h, '#6a5fa8');
}

function drawChip(r, fill, rim){
  rc(r.x, r.y, r.w, r.h, fill);
  rc(r.x, r.y, r.w, 1, rim);
  rc(r.x, r.y + r.h - 1, r.w, 1, rim);
  rc(r.x, r.y, 1, r.h, rim);
  rc(r.x + r.w - 1, r.y, 1, r.h, rim);
}

function stepFold(st, dt){
  if (st.dir === 0) return null;
  st.last = st.fold;
  if (st.dir > 0){
    st.fold += dt / FOLD_AXIS;
    if (st.last < 1 && st.fold >= 1) pingOpenH();
    if (st.fold >= 2){ st.fold = 2; st.dir = 0; }
  } else {
    st.fold -= dt / FOLD_AXIS;
    if (st.last > 1 && st.fold <= 1) pingClose();
    if (st.fold <= 0){
      st.fold = 0; st.dir = 0; st.on = false;
      return 'closed';
    }
  }
  return null;
}

function beginFold(st){
  var o = foldHeroOrigin(G.W);
  st.ox = o.x; st.oy = o.y;
  if (!(st.on && st.dir > 0)) pingOpen();
  st.on = true;
  st.dir = 1;
  if (st.fold <= 0){ st.fold = 0.001; st.last = 0; }
}

function snapFold(st){
  st.on = false; st.fold = 0; st.dir = 0; st.last = 0;
}

function startClose(st){
  if (!st.on || st.dir < 0) return;
  if (st.dir >= 0) pingCloseH();
  st.dir = -1;
  st.on = true;
}

function dimFold(fold){
  var dim = Math.min(1, fold / 2) * 0.42;
  ctx.globalAlpha = dim;
  rc(0, 0, VW, VH, '#07060f');
  ctx.globalAlpha = 1;
}

function outroBtns(){
  return {
    replay: { id: 'replay', x: 8, y: BTN_Y, w: BTN_W, h: BTN_H, label: 'REPLAY' },
    continue: { id: 'continue', x: OW - 8 - BTN_W, y: BTN_Y, w: BTN_W, h: BTN_H,
      label: (view.outro && view.outro.next < 0) ? 'MENU' : 'CONTINUE' }
  };
}

export function beginIntro(){ beginFold(introFold); }
export function skipIntro(){ snapFold(introFold); }
export function dismissIntro(){ startClose(introFold); }
export function isIntroReady(){ return introFold.on && introFold.fold >= 2 && introFold.dir === 0; }
export function isIntroFolding(){ return introFold.on || introFold.fold > 0; }
export function stepIntro(dt){ return stepFold(introFold, dt); }

export function beginOutro(){
  outroFold.focus = 'continue';
  outroFold.pick = null;
  beginFold(outroFold);
}
export function skipOutro(){
  snapFold(outroFold);
  outroFold.pick = null;
  outroFold.focus = 'continue';
}
export function isOutroReady(){ return outroFold.on && outroFold.fold >= 2 && outroFold.dir === 0; }
export function outroFocus(){ return outroFold.focus; }
export function setOutroFocus(id){
  if (id !== 'replay' && id !== 'continue') return;
  if (outroFold.focus === id) return;
  outroFold.focus = id;
  pingPick();
}
export function pickOutro(kind){
  if (!outroFold.on || outroFold.dir < 0) return;
  if (kind !== 'replay' && kind !== 'continue') return;
  outroFold.pick = kind;
  outroFold.focus = kind;
  startClose(outroFold);
}
export function hitOutro(sx, sy){
  if (!isOutroReady()) return null;
  var btns = outroBtns();
  var ids = ['replay', 'continue'], i, b;
  for (i = 0; i < ids.length; i++){
    b = btns[ids[i]];
    if (sx >= OX + b.x && sx <= OX + b.x + b.w && sy >= OY + b.y && sy <= OY + b.y + b.h)
      return b.id;
  }
  return null;
}
export function stepOutro(dt){
  var done = stepFold(outroFold, dt);
  if (done === 'closed') return outroFold.pick || 'continue';
  return null;
}

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
  // инвентарь: активная рука (оружие/гарпун) + шлем/щит/ласты
  var handIt = activeHandItem(S.p);
  var handList = listHand(S.p);
  var slots = [['hand', 84], ['helmet', 108], ['shield', 130], ['scuba', 152], ['flippers', 174]];
  for (var si = 0; si < slots.length; si++){
    var sl = slots[si][0], ox2 = bx + slots[si][1];
    var g2 = sl === 'hand' ? handIt : S.p.gear[sl];
    if (!g2) continue;
    var gc = P.gearCol[g2.type] || ['#cfc6ff', '#7a72a8'];
    if (sl === 'hand'){
      if (handList.length > 1){                              // рамка — можно переключить (Q / тап)
        rc(ox2 - 2, by - 2, 18, 13, '#3a3460');
        rc(ox2 - 1, by - 1, 16, 11, '#150f26');
      }
      if (g2.type === 'harpoon' || isHarpoonHand(S.p)){
        rc(ox2, by + 3, 11, 2, gc[0]); rc(ox2, by + 5, 11, 1, gc[1]);
        rc(ox2 + 10, by + 1, 3, 2, gc[0]); rc(ox2 + 11, by, 2, 2, '#c9d4dc');
      } else if (g2.type === 'bow'){
        rc(ox2 + 6, by, 2, 8, gc[1]); rc(ox2 + 3, by + 1, 3, 1, gc[0]);
        rc(ox2 + 8, by + 1, 3, 1, gc[0]); rc(ox2 + 2, by + 6, 4, 1, gc[0]);
        rc(ox2 + 8, by + 6, 4, 1, gc[0]);
      } else {
        rc(ox2, by + 2, 14, 2, gc[0]); rc(ox2, by + 4, 14, 1, gc[1]);
      }
    }
    else if (sl === 'helmet'){ rc(ox2, by, 8, 4, gc[1]); rc(ox2 - 1, by + 4, 10, 2, gc[0]); }
    else if (sl === 'scuba'){ rc(ox2, by, 6, 8, gc[0]); rc(ox2+6, by+2, 3, 4, gc[1]); }
    else if (sl === 'flippers'){ rc(ox2, by+2, 10, 4, gc[0]); rc(ox2-1, by+5, 4, 3, gc[1]); rc(ox2+7, by+5, 4, 3, gc[1]); }
    else { rc(ox2, by, 7, 9, gc[0]); rc(ox2, by, 7, 1, '#ffe9a8'); }
    var wgt = Math.max(0, Math.round(g2.uses / g2.max * 14));   // полоска прочности (у ласт/акваланга всегда полная)
    rc(ox2, by + 8, 14, 2, '#2a2444');
    rc(ox2, by + 8, wgt, 2, g2.uses <= 2 ? '#ff7a6a' : '#7de08a');
    var sp2 = sl === 'hand' ? Math.max(0, handList.length - 1) : 0;
    if (sl !== 'hand'){
      for (var q2 = 0; q2 < S.p.spare.length; q2++) if (S.p.spare[q2].slot === sl) sp2++;
    }
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

export function hudWeaponRect(){ return { x: 88, y: 12, w: 20, h: 14 }; }
export function hudHitsWeapon(sx, sy){
  var r = hudWeaponRect();
  return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
}

export function panel(x, y, w, h){
  ctx.globalAlpha = 0.86; rc(x, y, w, h, '#150f26'); ctx.globalAlpha = 1;
  rc(x, y, w, 1, '#6a5fa8'); rc(x, y + h - 1, w, 1, '#6a5fa8');
  rc(x, y, 1, h, '#6a5fa8'); rc(x + w - 1, y, 1, h, '#6a5fa8');
}
export function textPix(str, x, y, col, scale){
  scale = scale || 1;
  var adv = 4 * scale;
  for (var i = 0; i < str.length; i++){
    var ch = str.charAt(i), up = ch.toUpperCase();
    if (ch === ' ') continue;
    var bits = ABC[up];
    if (bits) glyphBits(bits, x + i * adv, y, col, scale);
    else {
      var d = str.charCodeAt(i) - 48;
      if (d >= 0 && d <= 9) digitS(d, x + i * adv, y, col, scale);
    }
  }
}
export function textPixC(str, cx, y, col, scale){
  scale = scale || 1;
  var w = str.length * 4 * scale - scale;
  textPix(str, cx - (w / 2 | 0), y, col, scale);
}
function glyphBits(bits, x, y, col, sc){
  for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++)
    if (bits[r * 3 + c] === '1') rc(x + c * sc, y + r * sc, sc, sc, col);
}
export function digitS(n, x, y, col, sc){
  var s2 = DIG[n];
  for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++)
    if (s2[r*3+c] === '1') rc(x + c*sc, y + r*sc, sc, sc, col);
}
export function drawIntro(){
  if (!introFold.on && introFold.fold <= 0) return;
  var time = view.time;
  var lv = G.levelSpec();
  var name = ((lv && lv.name) || 'LEVEL').toUpperCase();
  if (view.warpJump || !introLine){
    introLine = pickIntroLine(lv);
    view.warpJump = false;
  }
  var main = getCtx();
  setCtx(introCx);
  introCx.clearRect(0, 0, IW, IH);
  fillSheet(0, 0, IW, IH);
  rc(14, 10, 120, 1, '#3b3268');
  var sc = name.length <= 6 ? 3 : 2;
  textPixC(name, IW / 2, 16, '#ffd9a0', sc);
  if (Math.sin(time * 4) > 0) textPixC(introLine, IW / 2, 38, '#8f88bb', 1);
  setCtx(main);
  dimFold(introFold.fold);
  foldBlit(introCv, IW, IH, introFold.ox, introFold.oy, IX, IY, introFold.fold);
}
export function drawPaused(){
  panel(VW/2 - 46, VH/2 - 20, 92, 40);
  rc(VW/2 - 10, VH/2 - 9, 6, 18, '#ffd9a0');
  rc(VW/2 + 4, VH/2 - 9, 6, 18, '#ffd9a0');
}
export function drawOutro(){
  var o = view.outro;
  if ((!outroFold.on && outroFold.fold <= 0) || !o) return;
  var tt = o.totals;
  var main = getCtx();
  setCtx(outroCx);
  outroCx.clearRect(0, 0, OW, OH);
  fillSheet(0, 0, OW, OH);
  var rows = [
    ['coin',   o.bag.coin, tt.coin],
    ['gem',    o.bag.gem,  tt.gem],
    ['shroom', o.bag.shroom, tt.shroom || 0],
    ['chest',  tt.chestsOpen, tt.chests],
    ['secret', tt.secretsFound, tt.secrets]
  ];
  for (var i = 0; i < rows.length; i++){
    var y = 8 + i * 14, k = rows[i][0];
    if (k === 'coin'){ rc(10, y, 5, 7, P.coin); rc(9, y+1, 7, 5, P.coin); }
    else if (k === 'gem'){ rc(8, y+1, 8, 3, P.gem); rc(9, y+4, 6, 3, P.gemD); }
    else if (k === 'shroom'){ rc(11, y+3, 2, 4, P.stem); rc(8, y, 8, 3, P.shroom); }
    else if (k === 'chest'){ rc(7, y+1, 10, 6, P.chest); rc(7, y, 10, 2, P.chestL); }
    else { rc(8, y, 8, 7, '#241a30'); rc(10, y+2, 4, 3, P.lockC); }
    textPix('' + rows[i][1], 54, y + 1, '#ffe9a8', 1);
    rc(72, y + 4, 5, 1, '#6a628f');
    textPix('' + rows[i][2], 82, y + 1, '#cfc6ff', 1);
  }
  rc(8, 80, OW - 16, 1, '#3b3268');
  var btns = outroBtns();
  var ids = ['replay', 'continue'], bi, b, on;
  for (bi = 0; bi < ids.length; bi++){
    b = btns[ids[bi]];
    on = outroFold.focus === b.id;
    drawChip(b, on ? '#2a2448' : '#1a1430', on ? '#ffd9a0' : '#6a5fa8');
    textPixC(b.label, b.x + (b.w / 2) | 0, b.y + 4, on ? '#ffd9a0' : '#cfc6ff', 1);
  }
  setCtx(main);
  dimFold(outroFold.fold);
  foldBlit(outroCv, OW, OH, outroFold.ox, outroFold.oy, OX, OY, outroFold.fold);
}
export function drawDead(over){
  var fade = Math.min(0.58, over.t / 0.85 * 0.58);
  ctx.globalAlpha = fade;
  rc(0, 0, VW, VH, '#07060f');
  ctx.globalAlpha = 1;
  if (over.t < 0.4) return;
  var a = Math.min(1, (over.t - 0.4) / 0.28);
  ctx.globalAlpha = a;
  panel(VW / 2 - 70, VH / 2 - 24, 140, 48);
  textPixC('LIFE CAPACITY', VW / 2, VH / 2 - 12, '#ffd9a0', 2);
  textPixC('REACHED', VW / 2, VH / 2 + 4, '#ffe9c0', 2);
  if (over.t > 0.75 && Math.sin(view.time * 4) > 0)
    rc(VW / 2 - 26, VH / 2 + 16, 52, 2, '#8f88bb');
  ctx.globalAlpha = 1;
}
