/* Якоря кадра спрайта: origin (мир), grab (поиск кромки),
   weapon (кисть; .rot — доп. поворот удерживаемого предмета вокруг неё, град.). */
import { getSpriteDef, isHeroSprite } from '../core/spriteset.js';
import { defaultGrabOff } from '../core/sprite-grab.js';
import { HERO_POSES } from './poses.js';

export { HERO_POSES };

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
  weapon.rot = 0;
  var poses, pose;
  if (id === 'hero' || isHeroSprite(id)){
    poses = HERO_POSES[animId];
    pose = poses && poses[frameI | 0];
    if (pose && pose.hF){
      weapon = clipPt(pose.hF[0] + ox, pose.hF[1] + oy, fw, fh);
      weapon.rot = 0;
    }
  } else {
    grab = clipPt(origin.x + 6, origin.y + 2, fw, fh);
  }
  return { origin: origin, grab: grab, weapon: weapon };
}
