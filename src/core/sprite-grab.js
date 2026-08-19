/* Точка рук героини: поиск кромки / перекладины. Смещение от origin. */
import { C } from './constants.js';
import { getSpriteDef, getFrameAnchor } from './spriteset.js';

export function defaultGrabOff(){ return { x: C.W + 2, y: C.HAND }; }

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
