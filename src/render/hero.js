import GAME from '../core/game.js';
import { cam, view, world, ctx, rc } from './ctx.js';
import { waterTintAt } from './fx.js';
import {
  K, IDLE_A, IDLE_B, RUN, JUMPP, FALLP, LANDP, SLIDEP, STUNP, SNAREP, ROLLP,
  LADP0, LADP1, LADF0, LADF1, ATK0, ATK1, ATK2, CROUCH, CROUCH_W,
  PRONE0, PRONE1, BARS0, BARS1, LADD0, LADD1, SWIM0, SWIM1,
  HANGL, HANG_A, HANG_B, lerpPose, climbPose, vaultPose, pickPose, throwPose, getupPose,
  BOW_STANCE, bowPose, bowHandOnString, bowReleaseFx,
  WALLPUSH, GRAPPLE_D, GRAPPLE_U
} from './poses.js';
import { figure, drawBow, drawHeldWeapon } from './figure.js';
import { torchPts } from './light.js';
import { isBowHand, isHarpoonHand } from '../entities/gear.js';
import { spriteFrameImage, getSpriteDef, getFrameAnchor } from '../core/spriteset.js';
import { defaultFrameAnchors } from './sprite-anchors.js';

var G = GAME, C = G.C;

function stancePose(st){ return st === 2 ? PRONE0 : (st === 1 ? CROUCH : IDLE_A); }
function isBow(p){ return isBowHand(p); }

export function heroClip(p){
  var animT = view.animT, runPh = view.runPh;
  if (p.state === 'snare') return ['snare', 0];
  if (p.inWater) return ['swim', Math.sin(animT * 7) > 0 ? 0 : 1];
  if (p.state === 'bars') return ['bars', Math.sin(p.bars.ph * 2.4) > 0 ? 0 : 1];
  if (p.gettingUp){
    var gt = 1 - p.getupT / C.GETUP_T;
    return ['getup', gt < 0.33 ? 0 : (gt < 0.66 ? 1 : 2)];
  }
  if (p.stanceT > 0) return [p.stance === 2 ? 'prone' : (p.stance === 1 ? 'crouch' : 'idle'), 0];
  if (p.pickT > 0 && p.onGround) return ['pick', 0];
  if (p.stance === 2) return ['prone', Math.abs(p.vx) > 4 && Math.sin(animT * 7) > 0 ? 1 : 0];
  if (p.stance === 1) return [Math.abs(p.vx) > 4 ? 'crouchWalk' : 'crouch', 0];
  if (p.grapple) return ['grapple', (p.grapple.up || (p.grapple.phase !== 'fly' && Math.abs(p.grapple.vx) < 20)) ? 1 : 0];
  if (p.atkT > 0){
    var t = 1 - p.atkT / C.ATK_T;
    return ['attack', t < 0.32 ? 0 : (t < 0.66 ? 1 : 2)];
  }
  if (isBow(p) && p.bowT > 0){
    var bt = 1 - p.bowT / C.BOW_ANIM_T;
    return ['bow', bt < 0.6 ? 1 : (bt < 0.72 ? 2 : 0)];
  }
  if (p.state === 'stun') return ['stun', 0];
  if (p.rollT > 0) return ['roll', 0];
  if (p.throwT > 0) return ['throw', 0];
  if (p.state === 'ladder'){
    var moving = Math.abs(p.lad.ph - (p.lad.lastPh || 0)) > 0.0001;
    var f = moving ? (Math.sin(p.lad.ph * 3.1) > 0 ? 1 : 0) : 0;
    if (p.lad.v === G.LADF) return ['ladderF', f];
    if (p.lad.v === G.LADR || p.lad.v === G.LADL) return ['ladderD', f];
    return ['ladder', f];
  }
  if (p.state === 'hang' && p.hang.kind === 'lad') return ['hangLad', 0];
  if (p.state === 'climb' && p.climb.kind === 'lad') return ['ladder', 0];
  if (p.state === 'hang' && p.hang.kind === 'ledge') return ['hang', Math.sin(view.time * 2.2) > 0 ? 0 : 1];
  if (p.state === 'climb' && p.climb.kind === 'ledge'){
    var cp = p.climb.p;
    return ['climb', cp < 0.2 ? 0 : (cp < 0.4 ? 1 : (cp < 0.6 ? 2 : (cp < 0.8 ? 3 : 4)))];
  }
  if (p.state === 'climb' && p.climb.kind === 'vault') return ['vault', 0];
  if (!p.onGround){
    if (p.sliding) return ['slide', 0];
    return [p.vy < -40 ? 'jump' : (p.vy > 60 ? 'fall' : 'jump'), 0];
  }
  if (p.landT > 0) return ['land', 0];
  if (p.pushWall) return ['wallPush', 0];
  if (Math.abs(p.vx) > 8) return ['run', (runPh | 0) % 4];
  if (isBow(p)) return ['bow', 0];
  return ['idle', Math.sin(animT * 2.6) > 0 ? 0 : 1];
}

function frameOrigin(id, anim, i, def){
  var o = getFrameAnchor(id, anim, i, 'origin');
  if (o) return o;
  return { x: def.ox, y: def.oy };
}

function frameWeapon(id, anim, i){
  var w = getFrameAnchor(id, anim, i, 'weapon');
  if (w) return w;
  return defaultFrameAnchors(id, anim, i).weapon;
}

function blitHeroSprite(img, def, wx, wy, facing, origin){
  var ox = origin ? origin.x : def.ox;
  var oy = origin ? origin.y : def.oy;
  var fx = def.fx != null ? def.fx : 5;
  var x = Math.round(wx - ox - cam.x);
  var y = Math.round(wy - oy - cam.y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (facing < 0){
    ctx.translate(x + ox + fx, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -(ox + fx), 0);
  } else {
    ctx.drawImage(img, x, y);
  }
  ctx.restore();
}

function spriteLocalScreen(wx, wy, facing, origin, def, lx, ly){
  var ox = origin.x, oy = origin.y, fx = def.fx != null ? def.fx : 5;
  var sy = Math.round(wy - oy + ly - cam.y);
  var sx;
  if (facing < 0) sx = Math.round(wx + ox + 2 * fx - lx - cam.x);
  else sx = Math.round(wx - ox + lx - cam.x);
  return [sx, sy];
}

function heroWeaponState(p){
  var bow = isBow(p), harp = isHarpoonHand(p);
  var bowIdle = p.onGround && p.state === 'normal' && p.stance === 0 &&
    p.atkT <= 0 && p.rollT <= 0 && p.pickT <= 0 && p.throwT <= 0 &&
    p.landT <= 0 && !p.pushWall && Math.abs(p.vx) <= 8 && !p.inWater;
  var bowHeld = bow && (p.bowT > 0 || bowIdle);
  var hs = null, onBack = false;
  if (harp){
    if (p.grapple){
      var ga = Math.atan2(p.grapple.y - (p.y + 8), p.grapple.x - (p.x + p.w / 2));
      hs = { ang: ga, type: 'harpoon' };
    } else onBack = true;
  } else if (p.stick && !bow){
    if (p.atkT > 0){
      var tt = 1 - p.atkT / C.ATK_T;
      var a0 = -2.1 + tt*3.5;
      hs = { ang: p.facing > 0 ? a0 : Math.PI - a0,
           type: p.gear.weapon && p.gear.weapon.type };
    } else onBack = true;
  } else if (bow && !bowHeld){
    onBack = true;
  }
  return { hs: hs, onBack: onBack, bowHeld: bowHeld };
}

function overlayHeroWeapon(p, clip, def, wx, wy, facing, origin){
  var st = heroWeaponState(p);
  if (st.onBack || (!st.hs && !st.bowHeld)) return;
  var weap = frameWeapon('hero', clip[0], clip[1]);
  var xy = spriteLocalScreen(wx, wy, facing, origin, def, weap.x, weap.y);
  if (st.bowHeld){
    var bt = p.bowT > 0 ? (1 - p.bowT / C.BOW_ANIM_T) : 0;
    drawBow({ hB: xy, hF: [xy[0] + facing * 6, xy[1]] }, facing, 0, bowHandOnString(bt), bowReleaseFx(bt));
  } else if (st.hs){
    drawHeldWeapon(xy[0], xy[1], st.hs.ang, st.hs.type);
  }
}

function tryHeroSprite(p){
  var clip = heroClip(p);
  var img = spriteFrameImage('hero', clip[0], clip[1]);
  if (!img) return false;
  var def = getSpriteDef('hero');
  if (!def) return false;
  var facing = p.facing, wx = p.x, wy = p.y;
  if (p.state === 'hang' && p.hang.kind === 'ledge'){
    wx = p.hang.cx; wy = p.hang.cy; facing = p.facing;
  } else if (p.state === 'climb' && p.climb.kind === 'ledge'){
    wx = p.climb.cx; wy = p.climb.cy; facing = p.climb.facing;
  }
  var origin = frameOrigin('hero', clip[0], clip[1], def);
  blitHeroSprite(img, def, wx, wy, facing, origin);
  overlayHeroWeapon(p, clip, def, wx, wy, facing, origin);
  return true;
}

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
  if (p.grapple) return (p.grapple.up || (p.grapple.phase !== 'fly' && Math.abs(p.grapple.vx) < 20)) ? GRAPPLE_U : GRAPPLE_D;
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
  if (tryHeroSprite(p)) return;
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
  var oy = p.y;
  if (p.gettingUp)                              // поза растёт вверх, ноги остаются на земле
    oy = p.y + p.h - Math.max(pose2.fF[1], pose2.fB[1]);
  for (i = 0; i < K.length; i++){
    k = K[i];
    var lxp = (frontal || p.facing > 0) ? pose2[k][0] : (p.w - pose2[k][0]);
    var ly = pose2[k][1];
    if (rot){
      var dx = lxp - cxs, dy = ly - cys, cs = Math.cos(rot), sn = Math.sin(rot);
      lxp = cxs + dx*cs - dy*sn; ly = cys + dx*sn + dy*cs;
    }
    pt[k] = [Math.round(p.x) + lxp - cam.x, Math.round(oy) + ly - cam.y];
  }
  var hs = null, onBack = false, bow = isBow(p), harp = isHarpoonHand(p);
  var bowHeld = bow && (p.bowT > 0 || pose2 === BOW_STANCE);  // держит в руках только стоя на месте / в цикле выстрела
  if (harp){
    if (p.grapple){
      var ga = Math.atan2(p.grapple.y - (p.y + 8), p.grapple.x - (p.x + p.w / 2));
      hs = { ang: ga, type: 'harpoon' };
    } else onBack = true;
  } else if (p.stick && !bow){
    if (p.atkT > 0){
      var tt = 1 - p.atkT / C.ATK_T;
      var a0 = -2.1 + tt*3.5;                   // замах -> удар сверху вниз
      hs = { ang: p.facing > 0 ? a0 : Math.PI - a0,
           type: p.gear.weapon && p.gear.weapon.type };
    } else onBack = true;                       // иначе палка убрана за спину
  } else if (bow && !bowHeld){
    onBack = true;                              // на бегу/в прыжке лук за спиной, руки свободны
  }
  var headTilt = p.lookUp > 0.02 ? p.lookUp * 0.6 : 0;   // голова поворачивается, взгляд вверх
  figure(pt, p.facing, wag, frontal, rim, hs, onBack, {
    helmet: p.helmet, shield: p.shield,
    helmType: p.gear.helmet && p.gear.helmet.type,
    shieldType: p.gear.shield && p.gear.shield.type,
    weaponType: harp ? 'harpoon' : (p.gear.weapon && p.gear.weapon.type),
    bash: p.bashT,
    eyesClosed: p.knockedOut
  }, headTilt);
  if (bowHeld){
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
