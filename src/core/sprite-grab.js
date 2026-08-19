/* Точка рук героини: поиск кромки / перекладины. Смещение от origin. */
import { C, LADF, LADR, LADL } from './constants.js';
import { getSpriteDef, getFrameAnchor } from './spriteset.js';

export function defaultGrabOff(){ return { x: C.W + 2, y: C.HAND }; }

/* Действие для хитбокса / Hands. Совпадает с heroClip, без номера кадра. */
export function heroBoxAnim(p){
  if (!p) return 'idle';
  if (p.gettingUp) return 'prone';
  if (p.rollT > 0) return 'roll';
  if (p.state === 'snare') return 'snare';
  if (p.inWater) return 'swim';
  if (p.state === 'bars') return 'bars';
  if (p.pickT > 0 && p.onGround) return p.stance === 2 ? 'pickProne' : (p.stance === 1 ? 'pickCrouch' : 'pick');
  if (p.stance === 2) return 'prone';
  if (p.stance === 1) return Math.abs(p.vx) > 4 ? 'crouchWalk' : 'crouch';
  if (p.grapple) return 'grapple';
  if (p.atkT > 0) return 'attack';
  if (p.bowT > 0 || p.bowReady) return 'bow';
  if (p.state === 'stun') return 'stun';
  if (p.throwT > 0) return 'throw';
  if (p.state === 'ladder'){
    if (p.lad && p.lad.v === LADF) return 'ladderF';
    if (p.lad && (p.lad.v === LADR || p.lad.v === LADL)) return 'ladderD';
    return 'ladder';
  }
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
  var def = getSpriteDef('hero');
  var ox = def ? def.ox : 16, oy = def ? def.oy : 22;
  var anim = clipForGrab(p);
  var o = getFrameAnchor('hero', anim, 0, 'origin');
  if (o){ ox = o.x; oy = o.y; }
  var g = getFrameAnchor('hero', anim, 0, 'grab');
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
  var def = getSpriteDef('hero');
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
