/* Якоря кадра спрайта: origin (мир), grab (поиск кромки), weapon (кисть). */
import { getSpriteDef } from '../core/spriteset.js';
import { defaultGrabOff } from '../core/sprite-grab.js';
import {
  IDLE_A, IDLE_B, RUN, JUMPP, FALLP, LANDP, SLIDEP, STUNP, SNAREP, ROLLP,
  LADP0, LADP1, LADF0, LADF1, ATK0, ATK1, ATK2, CROUCH, CROUCH_W,
  PRONE0, PRONE1, BARS0, BARS1, LADD0, LADD1, SWIM0, SWIM1,
  HANGL, HANG_A, HANG_B, CL_K, VAULT_B, PICK_B, CROUCH_PICK, PRONE_PICK, THROW_B, WALLPUSH,
  BOW_STANCE, BOW_DRAW, BOW_RELEASE, GRAPPLE_D, GRAPPLE_U, DIVE0, DIVE1
} from './poses.js';

export var HERO_POSES = {
  idle: [IDLE_A, IDLE_B],
  run: RUN,
  jump: [JUMPP],
  fall: [FALLP],
  land: [LANDP],
  slide: [SLIDEP],
  crouch: [CROUCH],
  crouchWalk: [CROUCH_W],
  prone: [PRONE0, PRONE1],
  wallPush: [WALLPUSH],
  vault: [VAULT_B],
  pick: [PICK_B],
  pickCrouch: [CROUCH_PICK],
  pickProne: [PRONE_PICK],
  throw: [THROW_B],
  attack: [ATK0, ATK1, ATK2],
  roll: [ROLLP],
  stun: [STUNP],
  snare: [SNAREP],
  ladder: [LADP0, LADP1],
  ladderF: [LADF0, LADF1],
  ladderD: [LADD0, LADD1],
  bars: [BARS0, BARS1],
  swim: [SWIM0, SWIM1],
  dive: [DIVE0, DIVE1],
  hangLad: [HANGL],
  hang: [HANG_A, HANG_B],
  climb: CL_K,
  bow: [BOW_STANCE, BOW_DRAW, BOW_RELEASE],
  grapple: [GRAPPLE_D, GRAPPLE_U],
  getup: [PRONE0, CROUCH, IDLE_A]
};

function clipPt(x, y, fw, fh){
  if (x < 0) x = 0; if (x > fw - 1) x = fw - 1;
  if (y < 0) y = 0; if (y > fh - 1) y = fh - 1;
  return { x: x | 0, y: y | 0 };
}

export function defaultFrameAnchors(id, animId, frameI){
  var def = getSpriteDef(id);
  var ox = def ? def.ox : 0, oy = def ? def.oy : 0;
  var fw = def ? def.fw : 16, fh = def ? def.fh : 16;
  var origin = clipPt(ox, oy, fw, fh);
  var off = defaultGrabOff();
  var grab = clipPt(origin.x + off.x, origin.y + off.y, fw, fh);
  var weapon = clipPt(ox + 6, oy + 8, fw, fh);
  var poses, pose;
  if (id === 'hero'){
    poses = HERO_POSES[animId];
    pose = poses && poses[frameI | 0];
    if (pose && pose.hF)
      weapon = clipPt(pose.hF[0] + ox, pose.hF[1] + oy, fw, fh);
  } else {
    grab = clipPt(origin.x + 6, origin.y + 2, fw, fh);
  }
  return { origin: origin, grab: grab, weapon: weapon };
}
