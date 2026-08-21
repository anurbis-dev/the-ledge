import GAME from '../core/game.js';
import { cam, view, world, ctx, rc, cv, viewScale } from './ctx.js';
import { waterTintAt } from './fx.js';
import {
  K, IDLE_A, IDLE_B, RUN, FALLP, LANDP, SLIDEP, STUNP, SNAREP, ROLLP,
  LADP0, LADP1, LADF0, LADF1, ATK0, ATK1, ATK2, CROUCH, CROUCH_W,
  PRONE0, PRONE1, BARS0, BARS1, LADD0, LADD1, SWIM0, SWIM1,
  HANGL, HANG_A, HANG_B, lerpPose, climbPose, stancePose, pickPose, wallPickPose, throwPose, getupPose,
  BOW_STANCE, bowPose, bowHandOnString, bowReleaseFx,
  WALLPUSH, GRAPPLE_D, GRAPPLE_U
} from './poses.js';
import { figure, drawBow, drawHeldWeapon } from './figure.js';
import { isBowHand, isHarpoonHand } from '../entities/gear.js';
import { spriteFrameImage, getSpriteDef, getFrameAnchor } from '../core/spriteset.js';
import { activeHeroId } from '../core/player.js';
import { defaultFrameAnchors } from './sprite-anchors.js';

var G = GAME, C = G.C;
var ROLL_CX = 5, ROLL_CY = 11;

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
  if (p.rollT > 0) return ['roll', 0];
  if (p.stanceT > 0) return [p.stance === 2 ? 'prone' : (p.stance === 1 ? 'crouch' : 'idle'), 0];
  if (p.pickT > 0 && p.onGround){
    var pickAnim = p.stance === 2 ? 'pickProne' : (p.stance === 1 ? 'pickCrouch' : 'pick');
    return [pickAnim, 0];
  }
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
  if (p.throwT > 0) return ['throw', 0];
  if (p.state === 'ladder'){
    var moving = Math.abs(p.lad.ph - (p.lad.lastPh || 0)) > 0.0001;
    var f = moving ? (Math.sin(p.lad.ph * 3.1) > 0 ? 1 : 0) : 0;
    if (p.lad.v === G.LADF) return ['ladderF', f];
    if (p.lad.v === G.LADR || p.lad.v === G.LADL) return ['ladderD', f];
    return ['ladder', f];
  }
  if (p.state === 'rope'){
    if (p.rope && p.rope.orient === 'h')
      return ['bars', Math.sin((p.rope.ph || 0) * 2.4) > 0 ? 0 : 1];
    var r = p.rope || {};
    var swinging = !!(r.kickDir && ((r.swingCd || 0) > 0 || r.pendingKick));
    if (swinging) return ['ropeSwing', Math.sin(view.time * 4.2) > 0 ? 0 : 1];
    var climbing = Math.abs((r.climbSp || 0)) > 0.01;
    var rf = climbing ? (Math.sin((r.ph || 0) * 3.1) > 0 ? 1 : 0) : 0;
    return ['ropeClimb', rf];
  }
  if (p.state === 'hang' && p.hang.kind === 'lad') return ['hangLad', 0];
  if (p.state === 'climb' && p.climb.kind === 'lad') return ['ladder', 0];
  if (p.state === 'hang' && p.hang.kind === 'ledge') return ['hang', Math.sin(view.time * 2.2) > 0 ? 0 : 1];
  if (p.state === 'climb' && p.climb.kind === 'ledge'){
    var cp = p.climb.p;
    return ['climb', cp < 0.2 ? 0 : (cp < 0.4 ? 1 : (cp < 0.6 ? 2 : (cp < 0.8 ? 3 : 4)))];
  }
  if (!p.onGround){
    if (p.sliding) return ['slide', 0];
    return ['fall', 0];                                 // в воздухе всегда fall
  }
  if (p.landT > 0) return ['land', 0];
  if (p.pushWall) return ['wallPush', 0];
  if (Math.abs(p.vx) > 8) return ['run', (runPh | 0) % 4];
  if (isBow(p) && p.bowReady) return ['bow', 0];
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

function blitHeroSprite(img, def, wx, wy, facing, origin, rot){
  var ox = origin ? origin.x : def.ox;
  var oy = origin ? origin.y : def.oy;
  var fx = def.fx != null ? def.fx : 5;
  var x = Math.round(wx - ox - cam.x);
  var y = Math.round(wy - oy - cam.y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (rot){
    ctx.translate(Math.round(wx + ROLL_CX - cam.x), Math.round(wy + ROLL_CY - cam.y));
    ctx.rotate(rot);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -(ox + ROLL_CX), -(oy + ROLL_CY));
  } else if (facing < 0){
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
  var staticIdle = p.onGround && p.state === 'normal' && p.stance === 0 && p.stanceT <= 0 &&
    !p.gettingUp && !p.grapple && p.atkT <= 0 && p.rollT <= 0 && p.pickT <= 0 && p.throwT <= 0 &&
    p.landT <= 0 && !p.pushWall && Math.abs(p.vx) <= 8 && !p.inWater;
  var bowHeld = bow && (p.bowT > 0 || (p.bowReady && staticIdle));
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
  return { hs: hs, onBack: onBack, bowHeld: bowHeld, bow: bow };
}

function overlayHeroWeapon(p, clip, def, wx, wy, facing, origin){
  var st = heroWeaponState(p);
  if (st.onBack || (!st.hs && !st.bowHeld)) return;
  var weap = frameWeapon(activeHeroId(), clip[0], clip[1]);
  var xy = spriteLocalScreen(wx, wy, facing, origin, def, weap.x, weap.y);
  if (st.bowHeld){
    var bt = p.bowT > 0 ? (1 - p.bowT / C.BOW_ANIM_T) : 0;
    var grip = xy, str = [xy[0] + facing * 6, xy[1]];
    drawBow({ hB: grip, hF: str }, facing, 0, bowHandOnString(bt), bowReleaseFx(bt));
  } else if (st.hs){
    drawHeldWeapon(xy[0], xy[1], st.hs.ang, st.hs.type);
  }
}

function tryHeroSprite(p){
  var hid = activeHeroId();
  var clip = heroClip(p);
  var img = spriteFrameImage(hid, clip[0], clip[1]);
  /* Rope-слоты по умолчанию берут кадры лестницы, пока свои не нарисованы */
  if (!img && clip[0] === 'ropeClimb') img = spriteFrameImage(hid, 'ladder', clip[1]);
  if (!img && clip[0] === 'ropeSwing') img = spriteFrameImage(hid, 'ladderD', clip[1]);
  if (!img) return false;
  var def = getSpriteDef(hid);
  if (!def) return false;
  var facing = p.facing, wx = p.x, wy = p.y;
  if (p.state === 'hang' && p.hang.kind === 'ledge'){
    wx = p.hang.cx; wy = p.hang.cy; facing = p.facing;
  } else if (p.state === 'climb' && p.climb.kind === 'ledge'){
    wx = p.climb.cx; wy = p.climb.cy; facing = p.climb.facing;
  }
  var origin = frameOrigin(hid, clip[0], clip[1], def);
  blitHeroSprite(img, def, wx, wy, facing, origin, p.rollT > 0 ? p.rollAng : 0);
  overlayHeroWeapon(p, clip, def, wx, wy, facing, origin);
  return true;
}

export function boxPose(p){
  var animT = view.animT, runPh = view.runPh;
  // стойка стрельбы держится только пока героиня неподвижна после выстрела —
  // любое иное действие сбрасывает готовность до следующего нажатия атаки
  var staticIdle = p.onGround && p.state === 'normal' && p.stance === 0 && p.stanceT <= 0 &&
    !p.gettingUp && !p.grapple && p.atkT <= 0 && p.rollT <= 0 && p.pickT <= 0 && p.throwT <= 0 &&
    p.landT <= 0 && !p.pushWall && Math.abs(p.vx) <= 8 && !p.inWater;
  if (!staticIdle) p.bowReady = false;
  if (p.state === 'snare') return SNAREP;
  if (p.inWater) return (Math.sin(animT*7) > 0) ? SWIM0 : SWIM1;   // одна поза, наклон задаётся поворотом
  if (p.state === 'bars') return (Math.sin(p.bars.ph*2.4) > 0) ? BARS0 : BARS1;
  if (p.gettingUp) return getupPose(1 - p.getupT / C.GETUP_T);  // встаёт после высокого падения
  if (p.rollT > 0) return ROLLP;
  if (p.stanceT > 0)                                  // плавный переход стоя/присед/лёжа
    return lerpPose(stancePose(p.stanceFrom), stancePose(p.stance), 1 - p.stanceT / C.STANCE_T);
  if (p.pickT > 0 && p.onGround)                      // подбор — из текущей стойки: стоя, на корточках или лёжа
    return p.pickWall ? wallPickPose(1 - p.pickT / C.PICK_T, p.stance) : pickPose(1 - p.pickT / C.PICK_T, p.stance);
  if (p.stance === 2) return (Math.abs(p.vx) > 4 && Math.sin(animT*7) > 0) ? PRONE1 : PRONE0;
  if (p.stance === 1) return (Math.abs(p.vx) > 4 && Math.sin(animT*6) > 0) ? CROUCH_W : CROUCH;
  if (p.grapple) return (p.grapple.up || (p.grapple.phase !== 'fly' && Math.abs(p.grapple.vx) < 20)) ? GRAPPLE_U : GRAPPLE_D;
  if (p.atkT > 0){
    var t = 1 - p.atkT / C.ATK_T;
    return t < 0.32 ? lerpPose(ATK0, ATK1, t/0.32) : lerpPose(ATK1, ATK2, (t-0.32)/0.68);
  }
  if (isBow(p) && p.bowT > 0) return bowPose(1 - p.bowT / C.BOW_ANIM_T);  // натяжение/спуск лука
  if (p.state === 'stun') return STUNP;
  if (p.throwT > 0) return throwPose(1 - p.throwT / C.THROW_T);
  if (p.state === 'ladder'){
    var moving = Math.abs(p.lad.ph - (p.lad.lastPh || 0)) > 0.0001;
    p.lad.lastPh = p.lad.ph;
    var f = moving ? (Math.sin(p.lad.ph*3.1) > 0) : true;
    if (p.lad.v === G.LADF) return f ? LADF0 : LADF1;
    if (p.lad.v === G.LADR || p.lad.v === G.LADL) return f ? LADD0 : LADD1;  // диагональ: наклон корпуса
    return f ? LADP0 : LADP1;
  }
  if (p.state === 'rope'){
    if (p.rope && p.rope.orient === 'h')
      return (Math.sin((p.rope.ph || 0) * 2.4) > 0) ? BARS0 : BARS1;
    var rr = p.rope || {};
    var rSwing = !!(rr.kickDir && ((rr.swingCd || 0) > 0 || rr.pendingKick));
    if (rSwing) return (Math.sin(animT * 4.2) > 0) ? LADD0 : LADD1;
    var rClimb = Math.abs((rr.climbSp || 0)) > 0.01;
    var rf2 = rClimb ? (Math.sin((rr.ph || 0) * 3.1) > 0) : true;
    return rf2 ? LADP0 : LADP1;
  }
  if (p.state === 'hang' && p.hang.kind === 'lad') return HANGL;
  if (p.state === 'climb' && p.climb.kind === 'lad')
    return lerpPose(HANGL, (p.lad && p.lad.v === G.LADF) ? LADF0 : LADP0, p.climb.p);
  if (!p.onGround){
    if (p.sliding) return SLIDEP;
    return FALLP;                                       // в воздухе всегда fall
  }
  if (p.landT > 0) return LANDP;
  if (p.pushWall) return WALLPUSH;                   // жмёт в стену — руки на уровне груди по стене
  if (Math.abs(p.vx) > 8) return RUN[(runPh|0) % 4];
  if (isBow(p) && p.bowReady) return BOW_STANCE;      // лук наготове сразу после выстрела, в статике
  return (Math.sin(animT*2.6) > 0) ? IDLE_A : IDLE_B;
}
export function hero(){
  var S = world(), time = view.time, tail = view.tail;
  var p = S.p, i, k, pt = {}, frontal = (p.state === 'ladder' && p.lad.v === G.LADF) ||
      (p.state === 'hang' && p.hang.kind === 'lad' && G.tileAt(p.hang.tc, p.hang.tr) === G.LADF);
  if (tryHeroSprite(p)){ immerseHero(p); tintHeroBand(p); return; }
  var cxw = p.x + p.w/2, cyw = p.y + p.h/2;
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
    figure(pt, facing, wag, false, null, null, p.stick, { helmet: p.helmet, shield: p.shield });
    tintHero(p, pt, cxw, cyw);
    immerseHero(p);
    return;
  }
  var pose2 = boxPose(p), rot = 0, cxs = 0, cys = 0, rollWhole = p.rollT > 0;
  if (rollWhole){ rot = p.rollAng; cxs = ROLL_CX; cys = ROLL_CY; }
  else if (p.state !== 'snare' && p.inWater && Math.abs(p.swimAng) > 0.02){
    rot = p.swimAng * (p.facing > 0 ? 1 : -1);            // наклон корпуса по ходу плавания
    cxs = 5; cys = 6;
  }
  var oy = p.y;
  // getup / подбор: h меняется, поза в своих координатах — ноги к низу хитбокса
  if (p.gettingUp || (p.pickT > 0 && p.onGround))
    oy = p.y + p.h - Math.max(pose2.fF[1], pose2.fB[1]);
  for (i = 0; i < K.length; i++){
    k = K[i];
    var lxp = (frontal || p.facing > 0) ? pose2[k][0] : (p.w - pose2[k][0]);
    var ly = pose2[k][1];
    if (rot && !rollWhole){
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
  var headTilt = (!rollWhole && p.lookUp > 0.02) ? p.lookUp * 0.6 : 0;
  if (rollWhole){
    ctx.save();
    ctx.translate(Math.round(p.x) + cxs - cam.x, Math.round(oy) + cys - cam.y);
    ctx.rotate(rot);
    ctx.translate(-(Math.round(p.x) + cxs - cam.x), -(Math.round(oy) + cys - cam.y));
  }
  figure(pt, p.facing, wag, frontal, null, hs, onBack, {
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
  if (rollWhole) ctx.restore();
  immerseHero(p);
}
var _wetScratch = null;
function wetScratch(w, h){
  if (!_wetScratch || _wetScratch.width < w || _wetScratch.height < h){
    _wetScratch = document.createElement('canvas');
    _wetScratch.width = Math.max(w, 8);
    _wetScratch.height = Math.max(h, 8);
    _wetScratch.getContext('2d').imageSmoothingEnabled = false;
  }
  return _wetScratch;
}
function heroSurfY(p){
  if (p.swimSurf != null) return p.swimSurf;
  var cx = p.x + p.w * 0.5;
  var py = p.inWater ? (p.y + p.h * 0.5) : (p.y + p.h - 1);
  var c = Math.floor(cx / G.T), r = Math.floor(py / G.T);
  if (!G.isWaterV(G.tileAt(c, r))) return null;
  while (r > 0 && G.isWaterV(G.tileAt(c, r - 1))) r--;
  return r * G.T;
}
/* пиксельный wobble подводной полосы + tint (sprite и stick) */
function immerseHero(p){
  if (!p.inWater && !p.wading) return;
  var surfY = heroSurfY(p);
  if (surfY == null) return;
  if (p.y + p.h <= surfY + 1) return;
  var pad = 4;
  var gx0 = Math.round(p.x - cam.x) - pad;
  var gy0 = Math.round(p.y - cam.y) - pad;
  var gw = p.w + pad * 2 + 4;
  var gh = p.h + pad * 2 + 4;
  var z = viewScale || 1;
  var px = Math.round(gx0 * z), py = Math.round(gy0 * z);
  var pw = Math.max(1, Math.round(gw * z)), ph = Math.max(1, Math.round(gh * z));
  if (pw > 96) pw = 96;
  if (ph > 96) ph = 96;
  var sc = wetScratch(pw, ph);
  var sg = sc.getContext('2d');
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.globalAlpha = 1;
  sg.globalCompositeOperation = 'source-over';
  sg.clearRect(0, 0, pw, ph);
  sg.imageSmoothingEnabled = false;
  sg.drawImage(cv, px, py, pw, ph, 0, 0, pw, ph);
  var surfLocal = Math.round((surfY - cam.y - gy0) * z);
  if (surfLocal < 0) surfLocal = 0;
  if (surfLocal >= ph) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(px, py + surfLocal, pw, ph - surfLocal);
  var time = view.time, row, dx;
  for (row = surfLocal; row < ph; row++){
    dx = Math.round(Math.sin(time * 6.2 + row * 0.55) * (p.wading && !p.inWater ? 1 : 1.6));
    ctx.drawImage(sc, 0, row, pw, 1, px + dx, py + row, pw, 1);
  }
  ctx.restore();
}
function tintHeroBand(p){
  if (!p.inWater && !p.wading) return;
  var surfY = heroSurfY(p);
  if (surfY == null || p.y + p.h <= surfY + 1) return;
  var cxw = p.x + p.w / 2;
  var k = waterTintAt(cxw, Math.max(surfY + 2, p.y + p.h * 0.55));
  if (p.wading && !p.inWater) k *= 0.5;
  if (k < 0.04) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.14 + k * 0.55;
  var top = Math.max(surfY, p.y);
  rc(Math.round(p.x - cam.x) - 1, Math.round(top - cam.y), p.w + 2, Math.round(p.y + p.h - top), '#1a3a58');
  ctx.restore();
}
function tintHero(p, pt, cxw, cyw){
  if (!p.inWater && !p.wading) return;
  var surfY = heroSurfY(p);
  var k = waterTintAt(cxw, p.inWater ? cyw : (p.y + p.h - 2));
  if (p.wading && !p.inWater) k *= 0.45;
  if (k < 0.04) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.16 + k * 0.8;
  var col = '#1a3a58';
  var clipY = surfY != null ? Math.round(surfY - cam.y) : null;
  function below(y){ return clipY == null || y + 4 >= clipY; }
  if (pt.head && below(pt.head[1])) rc(pt.head[0] - 4, pt.head[1] - 5, 8, 8, col);
  if (pt.neck && pt.hip){
    var nx = Math.min(pt.neck[0], pt.hip[0]) - 5;
    var ny = Math.min(pt.neck[1], pt.hip[1]);
    var nh = Math.abs(pt.hip[1] - pt.neck[1]) + 6;
    if (clipY != null && ny < clipY){ nh -= clipY - ny; ny = clipY; }
    if (nh > 0) rc(nx, ny, 12, nh, col);
  }
  if (pt.hip && below(pt.hip[1])) rc(pt.hip[0] - 6, pt.hip[1] - 2, 12, 8, col);
  if (pt.kF && below(pt.kF[1])) rc(pt.kF[0] - 3, pt.kF[1] - 2, 6, 8, col);
  if (pt.kB && below(pt.kB[1])) rc(pt.kB[0] - 3, pt.kB[1] - 2, 6, 8, col);
  if (pt.fF && below(pt.fF[1])) rc(pt.fF[0] - 3, pt.fF[1] - 2, 6, 5, col);
  if (pt.fB && below(pt.fB[1])) rc(pt.fB[0] - 3, pt.fB[1] - 2, 6, 5, col);
  ctx.restore();
}
