import { ctx } from './ctx.js';
import { P } from './palette.js';
import { K } from './poses.js';
import { getCharacter } from './characters.js';

/* Локальные rc/lb — не переиспользуют ctx.js: octagon-stamp для lb (мягче углы на
   сгибах конечностей), нужен только здесь. Общие rc/lb из ctx.js используются
   остальными рендерами (тайлы/fx/враги) и намеренно не трогаются. */
function rc(x, y, w, h, col){
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function lb(a, b, th, col){
  var x0 = Math.round(a[0]), y0 = Math.round(a[1]), x1 = Math.round(b[0]), y1 = Math.round(b[1]);
  var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy, o = -((th / 2) | 0);
  ctx.fillStyle = col;
  for (var i = 0; i < 240; i++){
    if (th <= 2) ctx.fillRect(x0 + o, y0 + o, th, th);
    else { ctx.fillRect(x0 + o + 1, y0 + o, th - 2, th); ctx.fillRect(x0 + o, y0 + o + 1, th, th - 2); }
    if (x0 === x1 && y0 === y1) break;
    var e2 = 2 * err;
    if (e2 >= dy){ err += dy; x0 += sx; }
    if (e2 <= dx){ err += dx; y0 += sy; }
  }
}

export const HEAD_F = ['.hhhh.', 'hhhhhh', 'hhhhhh', 'hssssh', 'hssssh', '.ssss.', '..ss..'];
var DEFAULT_HEAD_PIVOT = { c: 3, r: 4 };
function tiltXY(tx, ty, cs, sn){
  var dx = tx, dy = ty - 2;                    // пивот — основание черепа у шеи (ty=2 локально)
  return [Math.round(dx * cs - dy * sn), Math.round(dx * sn + dy * cs + 2)];
}
/* Коса как отдельная фигура у затылка (со своей wag-физикой, независимо от
   основного пиксельного грида головы) тут больше не рисуется — такого элемента
   нет в Shirley.html, реальный "хвост" персонажа это tail0/tail1/tail2
   (см. upgradePose/figure ниже), который через них и качается. */
export function drawHead(pal, rows, rowsClosed, hx, hy, facing, mode, frontal, tilt, closed, pivot){
  var useRows = frontal ? HEAD_F : (closed ? rowsClosed : rows), r, c, ch, tx, ty, txy;
  // frontal-профиль — фиксированный встроенный грид (HEAD_F), его пивот не переопределяется персонажем
  var pv = frontal ? DEFAULT_HEAD_PIVOT : (pivot || DEFAULT_HEAD_PIVOT);
  var cols = (useRows[0] && useRows[0].length) || 6;
  var ang = (tilt && !frontal) ? -facing * tilt : 0;              // поворот черепа "взгляд вверх"
  var cs = ang ? Math.cos(ang) : 1, sn = ang ? Math.sin(ang) : 0;
  if (mode === 2){
    for (r = 0; r < useRows.length; r++) for (c = 0; c < cols; c++){
      if (useRows[r][c] === '.') continue;
      tx = c - pv.c; ty = r - pv.r; if (!frontal && facing < 0) tx = -tx - 1;
      if (ang){ txy = tiltXY(tx, ty, cs, sn); tx = txy[0]; ty = txy[1]; }
      rc(hx + tx, hy + ty, 1, 1, P.rim);
    }
    return;
  }
  if (mode === 0){
    for (r = 0; r < useRows.length; r++) for (c = 0; c < cols; c++){
      if (useRows[r][c] === '.') continue;
      tx = c - pv.c; ty = r - pv.r; if (!frontal && facing < 0) tx = -tx - 1;
      if (ang){ txy = tiltXY(tx, ty, cs, sn); tx = txy[0]; ty = txy[1]; }
      rc(hx + tx - 1, hy + ty - 1, 3, 3, pal.out);
    }
    return;
  }
  for (r = 0; r < useRows.length; r++) for (c = 0; c < cols; c++){
    ch = useRows[r][c]; if (ch === '.') continue;
    tx = c - pv.c; ty = r - pv.r; if (!frontal && facing < 0) tx = -tx - 1;
    if (ang){ txy = tiltXY(tx, ty, cs, sn); tx = txy[0]; ty = txy[1]; }
    rc(hx + tx, hy + ty, 1, 1, ch === 'h' ? (r < 2 ? pal.hairL : pal.hair) : (ch === 'e' ? pal.out : (ty < 0 ? pal.skinL : pal.skin)));
  }
}

/* PART_STRUCT — форма/цветовые ключи структурные (общие для всех персонажей);
   сами пиксельные гриды (rows) и пивоты приходят per-character из characters.js
   (см. ch.partPivots — экспортировано из Shirley.html, дефолт на случай отсутствия
   в DEFAULT_PART_PIVOTS там же). */
var PART_STRUCT = {
  hand: { map: { g: 'glove', s: 'skin' }, mapB: { g: 'gloveS', s: 'skinS' } },
  boot: { map: { b: 'boot', p: 'pants' }, mapB: { b: 'bootS', p: 'pantsS' } },
  hip: { map: { w: 'waist', t: 'topS', s: 'sash' } },
  pack: { map: { d: 'packD', p: 'pack' } }
};
function withRot(anchor, rot, fn){
  if (!rot){ fn(); return; }
  ctx.save(); ctx.translate(anchor[0], anchor[1]); ctx.rotate(rot); ctx.translate(-anchor[0], -anchor[1]);
  fn(); ctx.restore();
}
function drawPartOutline(pal, parts, defKey, anchor, rot, pivot){
  var rows = parts[defKey], pv = pivot || {};
  withRot(anchor, rot, function(){
    var r, c;
    for (r = 0; r < rows.length; r++) for (c = 0; c < rows[r].length; c++){
      if (rows[r][c] === '.') continue;
      rc(anchor[0] + (c - pv.c) - 1, anchor[1] + (r - pv.r) - 1, 3, 3, pal.out);
    }
  });
}
function drawPartFill(pal, parts, defKey, variant, anchor, rot, pivot){
  var def = PART_STRUCT[defKey], rows = parts[defKey], pv = pivot || {};
  var m = (variant === 'B' && def.mapB) ? def.mapB : def.map;
  withRot(anchor, rot, function(){
    var r, c;
    for (r = 0; r < rows.length; r++) for (c = 0; c < rows[r].length; c++){
      var ch = rows[r][c]; if (ch === '.') continue;
      var key = m[ch]; if (!key) continue;
      rc(anchor[0] + (c - pv.c), anchor[1] + (r - pv.r), 1, 1, pal[key]);
    }
  });
}

/* Расширяет плоскую 11-точечную позу (poses.js:K) точками нового рига —
   рюкзак, 3-сегментный хвост, независимые плечи/бёдра. poses.js не трогаем:
   расширение считается здесь, на входе в отрисовку. Смещения асимметричны
   (хвост/рюкзак — назад, плечи/бёдра — перёд/зад), поэтому все зависят от
   facing: pt уже отзеркален по экрану (см. hero.js), а сами смещения — нет,
   без умножения на facing рюкзак/руки/хвост оказывались на неверной стороне
   при взгляде влево. */
function upgradePose(pt, facing){
  var o = {}, i, k;
  for (i = 0; i < K.length; i++){ k = K[i]; o[k] = pt[k]; }
  var hx = pt.head[0], hy = pt.head[1], nx = pt.neck[0], ny = pt.neck[1], hipx = pt.hip[0], hipy = pt.hip[1];
  o.pack = [nx - facing * 3, Math.round(ny + (hipy - ny) * 0.5)];
  o.tail0 = [hx - facing * 3, hy + 1];
  o.tail1 = [hx - facing * 5, hy + 3];
  o.tail2 = [hx - facing * 6, hy + 7];
  o.shF = [nx + facing * 1, ny + 1];
  o.shB = [nx - facing * 1, ny + 1];
  o.hpF = [hipx + facing * 1, hipy];
  o.hpB = [hipx - facing * 1, hipy];
  return o;
}

/* Дефолтный порядок заливки — историческая раскладка, захардкоженная тут до
   появления Shirley.html-редактора; используется, когда у персонажа/анимации
   нет своего DRAW_ORDER (в т.ч. всегда для базового 'hero'). */
var DEFAULT_DRAW_ORDER = ['pack', 'legB', 'bootB', 'armB', 'handB', 'torso', 'hip', 'legF', 'bootF', 'armF', 'handF', 'tail', 'head'];

export function figure(pt0, facing, wag, frontal, rim, heldStick, backStick, gear, tilt, charId, animId){
  var ch = getCharacter(charId || 'hero');
  var pal = ch.palette, style = ch.style, parts = ch.parts, pv = ch.partPivots;
  var closed = gear && gear.eyesClosed;
  var pt = upgradePose(pt0, facing);
  // хвост качается (wag) относительно СВОЕЙ текущей позиции для этой анимации/кадра,
  // а не абсолютно — poза (и сам хвост) уже разные в каждой анимации, wag только доп. качание
  if (frontal){ pt.tail1[0] += wag * 0.6; pt.tail2[0] += wag; }
  else { pt.tail1[1] += wag; pt.tail2[1] += wag * 2; }
  var seg = [[pt.hpB, pt.kB, style.thigh], [pt.kB, pt.fB, style.shin],
             [pt.shB, pt.eB, style.upperArm], [pt.eB, pt.hB, style.forearm],
             [pt.neck, pt.hip, style.torso],
             [pt.hpF, pt.kF, style.thigh], [pt.kF, pt.fF, style.shin],
             [pt.shF, pt.eF, style.upperArm], [pt.eF, pt.hF, style.forearm]];
  var i;
  if (rim){                     // контровой свет: только корпус и голова, 1px, полупрозрачно
    ctx.globalAlpha = 0.5;
    lb([pt.neck[0] + rim[0], pt.neck[1] + rim[1]], [pt.hip[0] + rim[0], pt.hip[1] + rim[1]], 7, P.rim);
    drawHead(pal, ch.headRows, ch.headRowsClosed, pt.head[0] + rim[0], pt.head[1] + rim[1], facing, 2, frontal, tilt, closed, ch.headPivot);
    ctx.globalAlpha = 1;
  }
  if (backStick){                               // палка за спиной, наискось
    var bs0 = [pt.neck[0] - facing * 4, pt.neck[1] - 3];
    var bs1 = [pt.hip[0] + facing * 4, pt.hip[1] + 5];
    var bt5 = (gear && gear.weaponType) || 'stick';
    var bc5 = P.gearCol[bt5] || [P.stickC, P.stickD];
    lb(bs0, bs1, 3, P.out);
    lb(bs0, bs1, 1, bc5[0]);
  }

  // ---- единый контур всей фигуры, всегда первым (не зависит от порядка заливки) ----
  lb(pt.tail0, pt.tail1, style.tail1 + 2, pal.out); lb(pt.tail1, pt.tail2, style.tail2 + 2, pal.out);
  for (i = 0; i < seg.length; i++) lb(seg[i][0], seg[i][1], seg[i][2] + 2, pal.out);
  drawPartOutline(pal, parts, 'pack', [pt.pack[0], pt.pack[1]], pt.pack[2] || 0, pv.pack);
  drawPartOutline(pal, parts, 'boot', [pt.fB[0], pt.fB[1]], pt.fB[2] || 0, pv.boot);
  drawPartOutline(pal, parts, 'hand', [pt.hB[0], pt.hB[1]], pt.hB[2] || 0, pv.hand);
  drawPartOutline(pal, parts, 'hip', [pt.hip[0], pt.hip[1]], 0, pv.hip);
  drawPartOutline(pal, parts, 'boot', [pt.fF[0], pt.fF[1]], pt.fF[2] || 0, pv.boot);
  drawPartOutline(pal, parts, 'hand', [pt.hF[0], pt.hF[1]], pt.hF[2] || 0, pv.hand);
  withRot([pt.head[0], pt.head[1]], pt.head[2] || 0, function(){
    drawHead(pal, ch.headRows, ch.headRowsClosed, pt.head[0], pt.head[1], facing, 0, frontal, tilt, closed, ch.headPivot);
  });

  // ---- заливка по слоям, порядок — per-character/per-анимация (DRAW_ORDER из Shirley.html) ----
  var LAYER_FILL = {
    pack: function(){
      drawPartFill(pal, parts, 'pack', null, [pt.pack[0], pt.pack[1]], pt.pack[2] || 0, pv.pack);
      lb([pt.neck[0] - facing, pt.neck[1]], [pt.hip[0] - facing, pt.hip[1]], 1, pal.packStrap);
    },
    legB: function(){ lb(pt.hpB, pt.kB, style.thigh, pal.pantsS); lb(pt.kB, pt.fB, style.shin, pal.pantsS); },
    bootB: function(){ drawPartFill(pal, parts, 'boot', 'B', [pt.fB[0], pt.fB[1]], pt.fB[2] || 0, pv.boot); },
    armB: function(){ lb(pt.shB, pt.eB, style.upperArm, pal.topS); lb(pt.eB, pt.hB, style.forearm, pal.skinS); },
    handB: function(){ drawPartFill(pal, parts, 'hand', 'B', [pt.hB[0], pt.hB[1]], pt.hB[2] || 0, pv.hand); },
    torso: function(){ lb(pt.neck, pt.hip, style.torso, pal.top); },
    hip: function(){ drawPartFill(pal, parts, 'hip', null, [pt.hip[0], pt.hip[1]], 0, pv.hip); },
    legF: function(){ lb(pt.hpF, pt.kF, style.thigh, pal.pants); lb(pt.kF, pt.fF, style.shin, pal.pants); },
    bootF: function(){ drawPartFill(pal, parts, 'boot', 'F', [pt.fF[0], pt.fF[1]], pt.fF[2] || 0, pv.boot); },
    armF: function(){ lb(pt.shF, pt.eF, style.upperArm, pal.topL); lb(pt.eF, pt.hF, style.forearm, pal.skin); },
    handF: function(){ drawPartFill(pal, parts, 'hand', 'F', [pt.hF[0], pt.hF[1]], pt.hF[2] || 0, pv.hand); },
    tail: function(){ lb(pt.tail0, pt.tail1, style.tail1, pal.hair); lb(pt.tail1, pt.tail2, style.tail2, pal.hairS); },
    head: function(){
      withRot([pt.head[0], pt.head[1]], pt.head[2] || 0, function(){
        drawHead(pal, ch.headRows, ch.headRowsClosed, pt.head[0], pt.head[1], facing, 1, frontal, tilt, closed, ch.headPivot);
      });
    }
  };
  var order = (ch.drawOrder && animId && ch.drawOrder[animId]) || DEFAULT_DRAW_ORDER;
  for (i = 0; i < order.length; i++){
    var layerFn = LAYER_FILL[order[i]];
    if (layerFn) layerFn();
  }

  if (gear && gear.helmet){                        // шлем: форма и цвет по типу
    var ht5 = gear.helmType || 'lhelm';
    var hc5 = P.gearCol[ht5] || [P.helm, P.helmD];
    var hx4 = pt.head[0], hy4 = pt.head[1];
    rc(hx4 - 4, hy4 - 5, 8, 4, hc5[1]);
    rc(hx4 - 3, hy4 - 4, 6, 2, hc5[0]);
    rc(hx4 - 5, hy4 - 2, 10, 2, hc5[1]);
    rc(hx4 - 5, hy4 - 2, 10, 1, hc5[0]);
    if (ht5 === 'ihelm') rc(hx4 + facing * 4, hy4 - 4, 2, 5, hc5[1]);        // нащёчник
    if (ht5 === 'ghelm'){ rc(hx4 - 1, hy4 - 8, 2, 3, hc5[0]); rc(hx4 - 2, hy4 - 9, 4, 2, '#fff0b0'); }
  }
  if (gear && gear.shield){                        // щит: форма и цвет зависят от типа
    var st5 = gear.shieldType || 'wshield';
    var cc5 = P.gearCol[st5] || [P.shld, P.shldD];
    var push = gear.bash ? Math.round(gear.bash * 6) : 0;
    var sx4 = pt.hF[0] + facing * push, sy4 = pt.hF[1];
    if (st5 === 'wshield'){                        // деревянный — круглый
      rc(sx4 - 5, sy4 - 6, 10, 12, P.out);
      rc(sx4 - 4, sy4 - 5, 8, 10, cc5[0]);
      rc(sx4 - 4, sy4 - 2, 8, 1, cc5[1]); rc(sx4 - 1, sy4 - 5, 2, 10, cc5[1]);
    } else if (st5 === 'ishield'){                 // железный — прямоугольный
      rc(sx4 - 5, sy4 - 8, 10, 15, P.out);
      rc(sx4 - 4, sy4 - 7, 8, 13, cc5[0]);
      rc(sx4 - 4, sy4 - 7, 8, 1, '#dfe6f0'); rc(sx4 - 2, sy4 - 4, 4, 6, cc5[1]);
    } else {                                       // золотой — каплевидный
      rc(sx4 - 5, sy4 - 8, 10, 11, P.out);
      rc(sx4 - 4, sy4 - 7, 8, 9, cc5[0]);
      rc(sx4 - 3, sy4 + 2, 6, 3, cc5[0]); rc(sx4 - 1, sy4 + 5, 2, 2, cc5[0]);
      rc(sx4 - 4, sy4 - 7, 8, 1, '#fff0b0'); rc(sx4 - 1, sy4 - 5, 2, 8, cc5[1]);
    }
  }
  if (heldStick) drawHeldWeapon(pt.hF[0], pt.hF[1], heldStick.ang, heldStick.type);
}

export function drawHeldWeapon(hx2, hy2, ang, type){
  var ex2 = hx2 + Math.cos(ang) * 20, ey2 = hy2 + Math.sin(ang) * 20;
  var bx2 = hx2 - Math.cos(ang) * 5, by2 = hy2 - Math.sin(ang) * 5;
  var wt5 = type || 'stick';
  var wc5 = P.gearCol[wt5] || [P.stickC, P.stickD];
  var thin = wt5 === 'stick' || wt5 === 'spear';
  lb([bx2, by2], [ex2, ey2], thin ? 2 : 3, wc5[1]);
  lb([bx2, by2], [ex2, ey2], 1, wc5[0]);
  if (!thin){                                      // гарда и навершие у клинков
    var gx5 = hx2 + Math.cos(ang) * 3, gy5 = hy2 + Math.sin(ang) * 3;
    lb([gx5 - Math.sin(ang) * 4, gy5 + Math.cos(ang) * 4],
       [gx5 + Math.sin(ang) * 4, gy5 - Math.cos(ang) * 4], 2, wc5[1]);
  }
  rc(Math.round(ex2) - 1, Math.round(ey2) - 1, wt5 === 'spear' ? 3 : 2, 2, wc5[0]);
}

function rotV(vx, vy, cs, sn){ return [vx * cs - vy * sn, vx * sn + vy * cs]; }

/* лук — держится в дальней руке (pt.hB), изогнут вперёд по ходу выстрела.
   handOnString: ближняя рука (pt.hF) сейчас держит тетиву и тянет её (натяжение);
   вне этого окна тетива рисуется прямой, независимо от кисти (see poses.js:bowHandOnString).
   releaseFx: стрела уже сошла с тетивы — рисуем её улетающей по прямой. */
export function drawBow(pt, facing, tilt, handOnString, releaseFx){
  var grip = pt.hB, cs = Math.cos(tilt), sn = Math.sin(tilt);
  var up = rotV(0, -9, cs, sn), dn = rotV(0, 9, cs, sn);
  var tip1 = [grip[0] + up[0], grip[1] + up[1]];
  var tip2 = [grip[0] + dn[0], grip[1] + dn[1]];
  var bulge = facing * 2.2;
  var midUp = [grip[0] + up[0] * 0.5 + bulge, grip[1] + up[1] * 0.5];
  var midDn = [grip[0] + dn[0] * 0.5 + bulge, grip[1] + dn[1] * 0.5];
  lb(grip, midUp, 2, P.wood); lb(midUp, tip1, 2, P.woodD);
  lb(grip, midDn, 2, P.wood); lb(midDn, tip2, 2, P.woodD);
  rc(grip[0] - 1, grip[1] - 2, 2, 4, P.out);
  if (handOnString){                   // тетива идёт через кисть — натяжение
    lb(tip1, pt.hF, 1, P.string);
    lb(pt.hF, tip2, 1, P.string);
    var y = grip[1], tip = [grip[0] + facing * 4, y], tail = [pt.hF[0], y];
    lb(tail, tip, 1, P.wood);
    rc(Math.round(tip[0]) - 1, y - 1, 2, 2, P.out);
    rc(Math.round(tail[0]) - 1, y - 1, 2, 2, P.out);
  } else {                             // тетива прямая — в покое или сразу после спуска
    lb(tip1, tip2, 1, P.string);
    if (releaseFx){                    // стрела уже ушла — летит по прямой
      var ry = grip[1];
      var rtail = [grip[0] + facing * 3, ry], rtip = [grip[0] + facing * 22, ry];
      lb(rtail, rtip, 1, P.wood);
      rc(Math.round(rtip[0]) - 1, ry - 1, 2, 2, P.out);
      rc(Math.round(rtail[0]) - 1, ry - 1, 2, 2, P.out);
    }
  }
}
