import GAME from '../core/game.js';
import { cam, view, world, ctx, rc } from './ctx.js';
import { waterTintAt } from './fx.js';
import {
  K, IDLE_A, IDLE_B, RUN, JUMPP, FALLP, LANDP, SLIDEP, STUNP, SNAREP, ROLLP,
  LADP0, LADP1, LADF0, LADF1, ATK0, ATK1, ATK2, CROUCH, CROUCH_W,
  PRONE0, PRONE1, BARS0, BARS1, LADD0, LADD1, SWIM0, SWIM1,
  HANGL, HANG_A, HANG_B, lerpPose, climbPose, vaultPose, pickPose, throwPose, getupPose,
  BOW_STANCE, bowPose, bowHandOnString, bowReleaseFx,
  WALLPUSH
} from './poses.js';
import { figure, drawBow } from './figure.js';
import { torchPts } from './light.js';

var G = GAME, C = G.C;

function stancePose(st){ return st === 2 ? PRONE0 : (st === 1 ? CROUCH : IDLE_A); }
function isBow(p){ return !!(p.gear.weapon && p.gear.weapon.type === 'bow'); }

export function boxPose(p){
  var animT = view.animT, runPh = view.runPh;
  if (p.state === 'snare') return SNAREP;
  if (p.inWater) return (Math.sin(animT*7) > 0) ? SWIM0 : SWIM1;   // одна поза, наклон задаётся поворотом
  if (p.state === 'bars') return (Math.sin(p.bars.ph*2.4) > 0) ? BARS0 : BARS1;
  if (p.gettingUp) return getupPose(1 - p.getupT / C.GETUP_T);  // встаёт после высокого падения
  if (p.stanceT > 0)                                  // плавный переход стоя/присед/лёжа
    return lerpPose(stancePose(p.stanceFrom), stancePose(p.stance), 1 - p.stanceT / C.STANCE_T);
  if (p.stance === 2) return (Math.abs(p.vx) > 4 && Math.sin(animT*7) > 0) ? PRONE1 : PRONE0;
  if (p.stance === 1) return (Math.abs(p.vx) > 4 && Math.sin(animT*6) > 0) ? CROUCH_W : CROUCH;
  if (p.atkT > 0){
    var t = 1 - p.atkT / C.ATK_T;
    return t < 0.32 ? lerpPose(ATK0, ATK1, t/0.32) : lerpPose(ATK1, ATK2, (t-0.32)/0.68);
  }
  if (isBow(p) && p.bowT > 0) return bowPose(1 - p.bowT / C.BOW_ANIM_T);  // натяжение/спуск лука
  if (p.state === 'stun') return STUNP;
  if (p.rollT > 0) return ROLLP;
  if (p.pickT > 0 && p.onGround) return pickPose(1 - p.pickT / C.PICK_T);
  if (p.throwT > 0) return throwPose(1 - p.throwT / C.THROW_T);
  if (p.state === 'ladder'){
    var moving = Math.abs(p.lad.ph - (p.lad.lastPh || 0)) > 0.0001;
    p.lad.lastPh = p.lad.ph;
    var f = moving ? (Math.sin(p.lad.ph*3.1) > 0) : true;
    if (p.lad.v === G.LADF) return f ? LADF0 : LADF1;
    if (p.lad.v === G.LADR || p.lad.v === G.LADL) return f ? LADD0 : LADD1;  // диагональ: наклон корпуса
    return f ? LADP0 : LADP1;
  }
  if (p.state === 'hang' && p.hang.kind === 'lad') return HANGL;
  if (p.state === 'climb' && p.climb.kind === 'lad')
    return lerpPose(HANGL, (p.lad && p.lad.v === G.LADF) ? LADF0 : LADP0, p.climb.p);
  if (p.state === 'climb' && p.climb.kind === 'vault') return vaultPose(p.climb.p);
  if (!p.onGround){
    if (p.sliding) return SLIDEP;
    return p.vy < -40 ? JUMPP : (p.vy > 60 ? FALLP : lerpPose(JUMPP, FALLP, 0.5));
  }
  if (p.landT > 0) return LANDP;
  if (p.pushWall) return WALLPUSH;                   // жмёт в стену — руки на уровне груди по стене
  if (Math.abs(p.vx) > 8) return RUN[(runPh|0) % 4];
  if (isBow(p)) return BOW_STANCE;                    // лук наготове, но не тянет тетиву
  return (Math.sin(animT*2.6) > 0) ? IDLE_A : IDLE_B;
}
export function lightDirAt(wx, wy){
  var bx = 0, by = -1, bd = 1e9, i, L = torchPts();
  for (i = 0; i < L.length; i++){
    var dx = L[i][0] - wx, dy = L[i][1] - wy, d = dx*dx+dy*dy;
    if (d < bd){ bd = d; bx = dx; by = dy; }
  }
  if (bd > 130*130) return [0,-1];
  var m = Math.sqrt(bd) || 1;
  return [bx/m, by/m];
}
export function hero(){
  var S = world(), time = view.time, tail = view.tail;
  var p = S.p, i, k, pt = {}, frontal = (p.state === 'ladder' && p.lad.v === G.LADF) ||
      (p.state === 'hang' && p.hang.kind === 'lad' && G.tileAt(p.hang.tc, p.hang.tr) === G.LADF);
  var cxw = p.x + p.w/2, cyw = p.y + p.h/2;
  var ld = lightDirAt(cxw, cyw), rim = [Math.round(ld[0]), Math.round(ld[1])];
  if (rim[0] === 0 && rim[1] === 0) rim[1] = -1;
  var wag = tail.a;

  if ((p.state === 'hang' && p.hang.kind === 'ledge') ||
      (p.state === 'climb' && p.climb.kind === 'ledge')){
    var cx, cy, facing, pose, ox = 0, oy = 0;
    if (p.state === 'hang'){
      cx = p.hang.cx; cy = p.hang.cy; facing = p.facing;
      pose = (Math.sin(time*2.2) > 0) ? HANG_A : HANG_B;
    } else {
      var cl = p.climb; cx = cl.cx; cy = cl.cy; facing = cl.facing;
      pose = climbPose(cl.dir > 0 ? cl.p : 1 - cl.p);
      var kk = Math.max(0, 1 - cl.p/0.25);
      if (cl.dir < 0){ ox = cl.off.x*kk; oy = cl.off.y*kk; }
    }
    for (i = 0; i < K.length; i++){ k = K[i];
      pt[k] = [cx + facing*pose[k][0] - cam.x + ox, cy + pose[k][1] - cam.y + oy]; }
    figure(pt, facing, wag, false, rim, null, p.stick, { helmet: p.helmet, shield: p.shield });
    tintHero(p, pt, cxw, cyw);
    return;
  }
  var pose2 = boxPose(p), rot = 0, cxs = 0, cys = 0;
  if (p.rollT > 0){ rot = p.rollAng; cxs = 5; cys = 11; }
  else if (p.state === 'climb' && p.climb.kind === 'vault'){
    var vt = p.climb.p, lean = Math.sin(Math.min(1, Math.max(0, vt)) * Math.PI) * 0.5;
    rot = lean * (p.facing > 0 ? 1 : -1); cxs = 6; cys = 12;  // пригибание с наклоном вперёд
  }
  else if (p.state !== 'snare' && p.inWater && Math.abs(p.swimAng) > 0.02){
    rot = p.swimAng * (p.facing > 0 ? 1 : -1);            // наклон корпуса по ходу плавания
    cxs = 5; cys = 6;
  }
  for (i = 0; i < K.length; i++){
    k = K[i];
    var lxp = (frontal || p.facing > 0) ? pose2[k][0] : (p.w - pose2[k][0]);
    var ly = pose2[k][1];
    if (rot){
      var dx = lxp - cxs, dy = ly - cys, cs = Math.cos(rot), sn = Math.sin(rot);
      lxp = cxs + dx*cs - dy*sn; ly = cys + dx*sn + dy*cs;
    }
    pt[k] = [Math.round(p.x) + lxp - cam.x, Math.round(p.y) + ly - cam.y];
  }
  var hs = null, onBack = false, bow = isBow(p);
  if (p.stick && !bow){
    if (p.atkT > 0){
      var tt = 1 - p.atkT / C.ATK_T;
      var a0 = -2.1 + tt*3.5;                   // замах -> удар сверху вниз
      hs = { ang: p.facing > 0 ? a0 : Math.PI - a0,
           type: p.gear.weapon && p.gear.weapon.type };
    } else onBack = true;                       // иначе палка убрана за спину
  }
  var headTilt = p.lookUp > 0.02 ? p.lookUp * 0.6 : 0;   // голова поворачивается, взгляд вверх
  figure(pt, p.facing, wag, frontal, rim, hs, onBack, {
    helmet: p.helmet, shield: p.shield,
    helmType: p.gear.helmet && p.gear.helmet.type,
    shieldType: p.gear.shield && p.gear.shield.type,
    weaponType: p.gear.weapon && p.gear.weapon.type,
    bash: p.bashT,
    eyesClosed: p.knockedOut
  }, headTilt);
  if (bow){
    var bt = p.bowT > 0 ? (1 - p.bowT / C.BOW_ANIM_T) : 0;
    drawBow(pt, p.facing, 0, bowHandOnString(bt), bowReleaseFx(bt));
  }
  tintHero(p, pt, cxw, cyw);
}
function tintHero(p, pt, cxw, cyw){
  if (!p.inWater && !p.wading) return;
  var k = waterTintAt(cxw, p.inWater ? cyw : (p.y + p.h - 2));
  if (p.wading && !p.inWater) k *= 0.45;
  if (k < 0.04) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.16 + k * 0.8;
  var col = '#1a3a58';
  if (pt.head) rc(pt.head[0] - 4, pt.head[1] - 5, 8, 8, col);
  if (pt.neck && pt.hip){
    var nx = Math.min(pt.neck[0], pt.hip[0]) - 5;
    var ny = Math.min(pt.neck[1], pt.hip[1]);
    rc(nx, ny, 12, Math.abs(pt.hip[1] - pt.neck[1]) + 6, col);
  }
  if (pt.hip) rc(pt.hip[0] - 6, pt.hip[1] - 2, 12, 8, col);
  if (pt.kF) rc(pt.kF[0] - 3, pt.kF[1] - 2, 6, 8, col);
  if (pt.kB) rc(pt.kB[0] - 3, pt.kB[1] - 2, 6, 8, col);
  if (pt.fF) rc(pt.fF[0] - 3, pt.fF[1] - 2, 6, 5, col);
  if (pt.fB) rc(pt.fB[0] - 3, pt.fB[1] - 2, 6, 5, col);
  ctx.restore();
}
