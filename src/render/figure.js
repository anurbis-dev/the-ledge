import { ctx, rc, lb } from './ctx.js';
import { P } from './palette.js';

export const HEAD_S = ['.hhhh.','hhhhhh','hhssss','hhsses','.hssss','.hsss.','..ss..'];
export const HEAD_F = ['.hhhh.','hhhhhh','hhhhhh','hssssh','hssssh','.ssss.','..ss..'];
export function drawHead(hx, hy, facing, wag, mode, frontal){
  var rows = frontal ? HEAD_F : HEAD_S, r, c, ch, tx, ty;
  var bx = frontal ? hx : hx - facing*3, by = hy - 1;
  var t1 = [bx - (frontal?0:facing*2) + (frontal?wag*0.6:0), by + (frontal?4:2) + (frontal?0:wag)];
  var t2 = [bx - (frontal?0:facing*3) + (frontal?wag:0), by + (frontal?9:6) + (frontal?0:wag*2)];
  if (mode === 2){
    for (r = 0; r < rows.length; r++) for (c = 0; c < 6; c++){
      if (rows[r][c] === '.') continue;
      tx = c-3; ty = r-4; if (!frontal && facing < 0) tx = -tx-1;
      rc(hx+tx, hy+ty, 1, 1, P.rim);
    }
    return;
  }
  if (mode === 0){
    lb([bx,by], t1, 5, P.out); lb(t1, t2, 4, P.out);
    for (r = 0; r < rows.length; r++) for (c = 0; c < 6; c++){
      if (rows[r][c] === '.') continue;
      tx = c-3; ty = r-4; if (!frontal && facing < 0) tx = -tx-1;
      rc(hx+tx-1, hy+ty-1, 3, 3, P.out);
    }
    return;
  }
  lb([bx,by], t1, 3, P.hair); lb(t1, t2, 2, P.hairS);
  for (r = 0; r < rows.length; r++) for (c = 0; c < 6; c++){
    ch = rows[r][c]; if (ch === '.') continue;
    tx = c-3; ty = r-4; if (!frontal && facing < 0) tx = -tx-1;
    rc(hx+tx, hy+ty, 1, 1, ch==='h' ? (r<2?P.hairL:P.hair) : (ch==='e' ? P.out : (ty<0?P.skinL:P.skin)));
  }
}
export function figure(pt, facing, wag, frontal, rim, heldStick, backStick, gear){
  var sh = [pt.neck[0], pt.neck[1]+1];
  var seg = [[pt.hip,pt.kB,4],[pt.kB,pt.fB,3],[sh,pt.eB,3],[pt.eB,pt.hB,2],
             [pt.neck,pt.hip,5],[pt.hip,pt.kF,4],[pt.kF,pt.fF,3],[sh,pt.eF,3],[pt.eF,pt.hF,2]];
  var i;
  if (rim){                     // контровой свет: только корпус и голова, 1px, полупрозрачно
    ctx.globalAlpha = 0.5;
    lb([pt.neck[0]+rim[0], pt.neck[1]+rim[1]], [pt.hip[0]+rim[0], pt.hip[1]+rim[1]], 7, P.rim);
    drawHead(pt.head[0]+rim[0], pt.head[1]+rim[1], facing, wag, 2, frontal);
    ctx.globalAlpha = 1;
  }
  if (backStick){                               // палка за спиной, наискось
    var bs0 = [pt.neck[0] - facing*4, pt.neck[1] - 3];
    var bs1 = [pt.hip[0] + facing*4, pt.hip[1] + 5];
    var bt5 = (gear && gear.weaponType) || 'stick';
    var bc5 = P.gearCol[bt5] || [P.stickC, P.stickD];
    lb(bs0, bs1, 3, P.out);
    lb(bs0, bs1, 1, bc5[0]);
  }
  for (i = 0; i < seg.length; i++) lb(seg[i][0], seg[i][1], seg[i][2]+2, P.out);
  rc(pt.hip[0]-5, pt.hip[1]-2, 10, 6, P.out);
  drawHead(pt.head[0], pt.head[1], facing, wag, 0, frontal);
  lb(pt.hip, pt.kB, 4, P.pantsS); lb(pt.kB, pt.fB, 3, P.pantsS);
  rc(pt.fB[0]-2, pt.fB[1]-2, 4, 3, P.bootS);
  lb(sh, pt.eB, 3, P.shirtS); lb(pt.eB, pt.hB, 2, P.skinS);
  lb(pt.neck, pt.hip, 5, P.shirt);
  rc(pt.hip[0]-4, pt.hip[1]-2, 8, 5, P.skirt);
  rc(pt.hip[0]-4, pt.hip[1]-2, 8, 1, P.shirtS);
  rc(pt.hip[0]-4, pt.hip[1]+3, 8, 1, P.skirtS);
  lb(pt.hip, pt.kF, 4, P.pants); lb(pt.kF, pt.fF, 3, P.pants);
  rc(pt.fF[0]-2, pt.fF[1]-2, 4, 3, P.boot);
  lb(sh, pt.eF, 3, P.shirtL); lb(pt.eF, pt.hF, 2, P.skin);
  drawHead(pt.head[0], pt.head[1], facing, wag, 1, frontal);
  if (gear && gear.helmet){                        // шлем: форма и цвет по типу
    var ht5 = gear.helmType || 'lhelm';
    var hc5 = P.gearCol[ht5] || [P.helm, P.helmD];
    var hx4 = pt.head[0], hy4 = pt.head[1];
    rc(hx4 - 4, hy4 - 5, 8, 4, hc5[1]);
    rc(hx4 - 3, hy4 - 4, 6, 2, hc5[0]);
    rc(hx4 - 5, hy4 - 2, 10, 2, hc5[1]);
    rc(hx4 - 5, hy4 - 2, 10, 1, hc5[0]);
    if (ht5 === 'ihelm') rc(hx4 + facing*4, hy4 - 4, 2, 5, hc5[1]);        // нащёчник
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
  if (heldStick){
    var ang = heldStick.ang, hx2 = pt.hF[0], hy2 = pt.hF[1];
    var ex2 = hx2 + Math.cos(ang)*20, ey2 = hy2 + Math.sin(ang)*20;
    var bx2 = hx2 - Math.cos(ang)*5, by2 = hy2 - Math.sin(ang)*5;
    var wt5 = heldStick.type || 'stick';
    var wc5 = P.gearCol[wt5] || [P.stickC, P.stickD];
    lb([bx2,by2], [ex2,ey2], wt5 === 'stick' ? 2 : 3, wc5[1]);
    lb([bx2,by2], [ex2,ey2], 1, wc5[0]);
    if (wt5 !== 'stick'){                            // гарда и навершие у клинков
      var gx5 = hx2 + Math.cos(ang)*3, gy5 = hy2 + Math.sin(ang)*3;
      lb([gx5 - Math.sin(ang)*4, gy5 + Math.cos(ang)*4],
         [gx5 + Math.sin(ang)*4, gy5 - Math.cos(ang)*4], 2, wc5[1]);
    }
    rc(Math.round(ex2) - 1, Math.round(ey2) - 1, 2, 2, wc5[0]);
  }
}
