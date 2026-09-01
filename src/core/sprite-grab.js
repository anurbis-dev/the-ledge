/* Точка рук героини: поиск кромки / перекладины. Смещение от origin. */
import { C, LADF, LADR, LADL } from './constants.js';
import { getSpriteDef } from './spriteset.js';
import { getFrameAnchor, legacyObjectKindFromSprite } from './object-anchors.js';
import { runtime } from './runtime.js';
import { HERO_POSES } from '../render/poses.js';

function heroId(){
  var sp = runtime.LV && runtime.LV.spawn;
  return (sp && sp.spriteId) || 'hero';
}

/* Не импортировать activeObjectKind из player — цикл player ↔ sprite-grab. */
function objectKind(){
  var sp = runtime.LV && runtime.LV.spawn;
  return (sp && sp.objectKind) || legacyObjectKindFromSprite(sp && sp.spriteId) || 'hero';
}

export function defaultGrabOff(){ return { x: C.W + 2, y: C.HAND }; }

/* Доля анимации до низа приседа — как pickPose / torches.PICK_APEX. */
var PICK_APEX = 0.45;

/* Хитбокс по действию. Подбор стоя: crouch только около апекса, иначе idle —
   сразу pick/crouch на всём pickT давал провал в пол (PICK_B под низкий box). */
export function heroBoxAnim(p){
  if (!p) return 'idle';
  if (p.gettingUp) return 'prone';
  if (p.rollT > 0) return 'roll';
  if (p.state === 'snare') return 'snare';
  if (p.inWater) return 'swim';
  if (p.state === 'bars') return 'bars';
  if (p.pickT > 0 && p.onGround){
    if (p.stance === 2) return 'prone';
    if (p.stance === 1) return 'crouch';
    var t = 1 - p.pickT / C.PICK_T;
    if (t >= PICK_APEX * 0.5 && t <= PICK_APEX + (1 - PICK_APEX) * 0.55) return 'crouch';
    return 'idle';
  }
  if (p.stance === 2) return 'prone';
  if (p.stance === 1) return Math.abs(p.vx) > 4 ? 'crouchWalk' : 'crouch';
  if (p.grapple) return 'grapple';
  if (p.atkT > 0) return 'attack';
  if (p.digT > 0) return p.digMode || 'dig';
  if (p.bowT > 0 || p.bowReady) return 'bow';
  if (p.state === 'stun') return 'stun';
  if (p.throwT > 0) return 'throw';
  if (p.state === 'ladder'){
    if (p.lad && p.lad.v === LADF) return 'ladderF';
    if (p.lad && (p.lad.v === LADR || p.lad.v === LADL)) return 'ladderD';
    return 'ladder';
  }
  if (p.state === 'rope') return (p.rope && p.rope.orient === 'h') ? 'bars' : 'hang';
  if (p.state === 'hang' && p.hang && p.hang.kind === 'lad') return 'hangLad';
  if (p.state === 'climb' && p.climb && p.climb.kind === 'lad') return 'ladder';
  if (p.state === 'hang') return 'hang';
  if (p.state === 'climb') return 'climb';
  if (!p.onGround){
    if (p.sliding) return 'slide';
    return p.vy > 60 ? 'fall' : 'jump';
  }
  if (p.landT > 0) return 'land';
  if (p.pushWall) return 'wallPush';
  if (Math.abs(p.vx) > 8) return 'run';
  return 'idle';
}

function clipForGrab(p){
  if (!p) return 'idle';
  if (p.state === 'hang') return p.hang && p.hang.kind === 'lad' ? 'hangLad' : 'hang';
  if (p.state === 'climb') return p.climb && p.climb.kind === 'lad' ? 'ladder' : 'climb';
  if (p.state === 'bars') return 'bars';
  if (p.state === 'rope') return (p.rope && p.rope.orient === 'h') ? 'bars' : 'hang';
  if (p.inWater) return 'swim';
  if (!p.onGround){
    if (p.sliding) return 'slide';
    return p.vy > 60 ? 'fall' : 'jump';
  }
  if (p.stance === 2) return 'prone';
  if (p.stance === 1) return 'crouch';
  return 'idle';
}

export function heroGrabLocal(p){
  var hid = heroId();
  var ok = objectKind();
  var def = getSpriteDef(hid);
  var ox = def ? def.ox : 16, oy = def ? def.oy : 22;
  var anim = clipForGrab(p);
  var o = getFrameAnchor(ok, anim, 0, 'origin');
  if (o){ ox = o.x; oy = o.y; }
  var g = getFrameAnchor(ok, anim, 0, 'grab');
  if (g) return { x: g.x, y: g.y, ox: ox, oy: oy };
  var d = defaultGrabOff();
  return { x: ox + d.x, y: oy + d.y, ox: ox, oy: oy };
}

export function heroGrabOffset(p){
  var loc = heroGrabLocal(p);
  return { x: loc.x - loc.ox, y: loc.y - loc.oy };
}

export function heroGrabWorld(p){
  var loc = heroGrabLocal(p);
  var def = getSpriteDef(heroId());
  var fx = def && def.fx != null ? def.fx : 5;
  var y = p.y - loc.oy + loc.y;
  var x = p.facing < 0
    ? p.x + loc.ox + 2 * fx - loc.x
    : p.x - loc.ox + loc.x;
  return { x: x, y: y };
}

export function heroHandY(p){
  var off = heroGrabOffset(p);
  return p.y + (off.y > 0 ? off.y : C.HAND);
}

/* Якорь кисти (переносимый в руке предмет: факел и т.п.) — физическая копия heroClip
   (render/hero.js) без завязки на view.animT/runPh: те дают только косметическое
   чередование кадров (моргание, чередование ног), для позиции руки берём кадр 0. */
function clipForWeapon(p){
  if (!p) return ['idle', 0];
  if (p.state === 'snare') return ['snare', 0];
  if (p.inWater) return ['swim', 0];
  if (p.state === 'bars') return ['bars', 0];
  if (p.gettingUp){
    var gt = 1 - p.getupT / C.GETUP_T;
    return ['getup', gt < 0.33 ? 0 : (gt < 0.66 ? 1 : 2)];
  }
  if (p.rollT > 0) return ['roll', 0];
  if (p.stanceT > 0) return [p.stance === 2 ? 'prone' : (p.stance === 1 ? 'crouch' : 'idle'), 0];
  if (p.pickT > 0 && p.onGround)
    return [p.stance === 2 ? 'pickProne' : (p.stance === 1 ? 'pickCrouch' : 'pick'), 0];
  if (p.stance === 2) return ['prone', 0];
  if (p.stance === 1) return [Math.abs(p.vx) > 4 ? 'crouchWalk' : 'crouch', 0];
  if (p.grapple) return ['grapple', (p.grapple.up || (p.grapple.phase !== 'fly' && Math.abs(p.grapple.vx) < 20)) ? 1 : 0];
  if (p.atkT > 0){
    var t = 1 - p.atkT / C.ATK_T;
    return ['attack', t < 0.32 ? 0 : (t < 0.66 ? 1 : 2)];
  }
  if (p.digT > 0){
    var dtp = 1 - p.digT / C.DIG_T;
    return [p.digMode || 'dig', dtp < 0.32 ? 0 : (dtp < 0.66 ? 1 : 2)];
  }
  if (p.state === 'stun') return ['stun', 0];
  if (p.throwT > 0) return ['throw', 0];
  if (p.state === 'ladder'){
    if (p.lad && p.lad.v === LADF) return ['ladderF', 0];
    if (p.lad && (p.lad.v === LADR || p.lad.v === LADL)) return ['ladderD', 0];
    return ['ladder', 0];
  }
  if (p.state === 'rope') return [(p.rope && p.rope.orient === 'h') ? 'bars' : 'ropeClimb', 0];
  if (p.state === 'hang' && p.hang && p.hang.kind === 'lad') return ['hangLad', 0];
  if (p.state === 'climb' && p.climb && p.climb.kind === 'lad') return ['ladder', 0];
  if (p.state === 'hang' && p.hang && p.hang.kind === 'ledge') return ['hang', 0];
  if (p.state === 'climb' && p.climb && p.climb.kind === 'ledge'){
    var cp = p.climb.p;
    return ['climb', cp < 0.2 ? 0 : (cp < 0.4 ? 1 : (cp < 0.6 ? 2 : (cp < 0.8 ? 3 : 4)))];
  }
  if (p.state === 'climb' && p.climb && p.climb.kind === 'vault') return ['vault', 0];
  if (!p.onGround) return [p.sliding ? 'slide' : 'fall', 0];
  if (p.landT > 0) return ['land', 0];
  if (p.pushWall) return ['wallPush', 0];
  if (Math.abs(p.vx) > 8) return ['run', 0];
  return ['idle', 0];
}

function clipPt(x, y, fw, fh){
  if (x < 0) x = 0; if (x > fw - 1) x = fw - 1;
  if (y < 0) y = 0; if (y > fh - 1) y = fh - 1;
  return { x: x | 0, y: y | 0 };
}

export function heroWeaponLocal(p){
  var hid = heroId();
  var ok = objectKind();
  var def = getSpriteDef(hid);
  var fw = def ? def.fw : 16, fh = def ? def.fh : 16;
  var ox = def ? def.ox : 16, oy = def ? def.oy : 22;
  var clip = clipForWeapon(p);
  var o = getFrameAnchor(ok, clip[0], clip[1], 'origin');
  if (o){ ox = o.x; oy = o.y; }
  var w = getFrameAnchor(ok, clip[0], clip[1], 'weapon');
  if (w) return { x: w.x, y: w.y, ox: ox, oy: oy };
  var poses = HERO_POSES[clip[0]], pose = poses && poses[clip[1] | 0];
  var pt = pose && pose.hF ? clipPt(pose.hF[0] + ox, pose.hF[1] + oy, fw, fh)
                            : clipPt(ox + 6, oy + 8, fw, fh);
  return { x: pt.x, y: pt.y, ox: ox, oy: oy };
}

/* Мировая точка кисти — для предметов, переносимых в руке (факел). Аналог heroGrabWorld. */
export function heroWeaponWorld(p){
  var loc = heroWeaponLocal(p);
  var def = getSpriteDef(heroId());
  var fx = def && def.fx != null ? def.fx : 5;
  var y = p.y - loc.oy + loc.y;
  var x = p.facing < 0
    ? p.x + loc.ox + 2 * fx - loc.x
    : p.x - loc.ox + loc.x;
  return { x: x, y: y };
}
