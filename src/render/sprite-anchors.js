/* Якоря кадра спрайта: origin (мир), grab (поиск кромки),
   weapon (кисть; .rot — доп. поворот удерживаемого предмета вокруг неё, град.). */
import { getSpriteDef, isHeroSprite, spriteFrameImage } from '../core/spriteset.js';
import { defaultGrabOff } from '../core/sprite-grab.js';
import { HERO_POSES } from './poses.js';

export { HERO_POSES };

function clipPt(x, y, fw, fh){
  if (x < 0) x = 0; if (x > fw - 1) x = fw - 1;
  if (y < 0) y = 0; if (y > fh - 1) y = fh - 1;
  return { x: x | 0, y: y | 0 };
}

/* fw/fh спрайта — общие на ВЕСЬ спрайт (все анимации меряют якоря/бокс в них),
   а не за-кадр (см. object-anchors.js paintCanvas-комментарий); меняются только
   явно, слайдером Size (editor/tile-edit.js:applySpriteSize) — импорт кадра
   без даунскейла их больше не трогает. Но если дефолт для анимации без явного
   override всегда мерить по этому общему числу, у анимации со своим уже
   нарисованным (dirty) кадром 0, чей реальный размер отличается от общего
   footprint, дефолт будет мимо её собственного арта. Как и frameFootprint() в
   object-anchors.js — предпочитаем РЕАЛЬНЫЙ размер этого кадра, когда он есть,
   общий footprint — только фоллбэк без своего арта. */
export function defaultFrameAnchors(id, animId, frameI){
  var def = getSpriteDef(id);
  var ox = def ? def.ox : 0, oy = def ? def.oy : 0;
  var fw = def ? def.fw : 16, fh = def ? def.fh : 16;
  var img = animId ? spriteFrameImage(id, animId, 0) : null;
  if (img && img.naturalWidth){ fw = img.naturalWidth; fh = img.naturalHeight; }
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
