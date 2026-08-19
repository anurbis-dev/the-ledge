/* Растр кадра из текущей процедурной картинки — стартовая точка для спрайт-редактора. */
import { getCtx, setCtx } from './ctx.js';
import { figure } from './figure.js';
import { K } from './poses.js';
import { HERO_POSES } from './sprite-anchors.js';
import { paintTileIcon, paintObjIcon } from '../editor/thumbs.js';
import { canvasToPng } from '../core/tileset.js';
import { getSpriteDef, getSpriteFrameSrc, isSpriteFrameDirty } from '../core/spriteset.js';

var FRONTAL = { ladderF: 1 };

function makeCan(w, h){
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  return c;
}

export function bakeHeroFrame(animId, frameI){
  var def = getSpriteDef('hero');
  var poses = HERO_POSES[animId];
  var pose = poses && poses[frameI | 0];
  if (!def || !pose) return makeCan(def ? def.fw : 40, def ? def.fh : 48);
  var can = makeCan(def.fw, def.fh);
  var cx = can.getContext('2d');
  var saved = getCtx();
  setCtx(cx);
  try {
    var pt = {}, i, k;
    for (i = 0; i < K.length; i++){
      k = K[i];
      if (!pose[k]) continue;
      pt[k] = [pose[k][0] + def.ox, pose[k][1] + def.oy];
    }
    figure(pt, 1, 0, !!FRONTAL[animId], null, null, false, null, 0);
  } finally {
    setCtx(saved);
  }
  return can;
}

export function bakeKindFrame(kind, animId, frameI){
  var def = getSpriteDef(kind);
  var w = def ? def.fw : 16, h = def ? def.fh : 16;
  var can = makeCan(w, h);
  var cx = can.getContext('2d');
  var hop = (frameI | 0) % 2;
  if (hop){
    cx.save();
    cx.translate(0, -1);
  }
  paintObjIcon(cx, kind, w);
  if (hop) cx.restore();
  void animId;
  return can;
}

export function bakeSpriteFrame(id, animId, frameI){
  if (id === 'hero') return bakeHeroFrame(animId, frameI);
  return bakeKindFrame(id, animId, frameI);
}

var bakeCache = {};

export function clearBakeCache(){ bakeCache = {}; }

export function bakeSpriteFrameSrc(id, animId, frameI){
  var k = id + ':' + animId + ':' + (frameI | 0);
  if (bakeCache[k]) return bakeCache[k];
  bakeCache[k] = canvasToPng(bakeSpriteFrame(id, animId, frameI));
  return bakeCache[k];
}

export function bakeBuiltinTile(spec){
  var can = makeCan(16, 16);
  var cx = can.getContext('2d');
  paintTileIcon(cx, spec, 16);
  return can;
}

export function bakeBuiltinTileSrc(spec){
  return canvasToPng(bakeBuiltinTile(spec));
}

export function spriteThumb(def, size){
  var can = makeCan(size, size);
  var cx = can.getContext('2d');
  var anim = def.anims && def.anims[0];
  var src = anim && isSpriteFrameDirty(def.id, anim.id, 0) ? getSpriteFrameSrc(def.id, anim.id, 0) : '';
  if (src){
    var img = new Image();
    img.onload = function(){
      cx.imageSmoothingEnabled = false;
      cx.clearRect(0, 0, size, size);
      cx.drawImage(img, 0, 0, img.naturalWidth || def.fw, img.naturalHeight || def.fh, 0, 0, size, size);
    };
    img.src = src;
    if (img.complete && img.naturalWidth) img.onload();
    return can;
  }
  if (def.id === 'hero'){
    var fr = bakeHeroFrame('idle', 0);
    cx.drawImage(fr, 0, 0, def.fw, def.fh, 0, 0, size, size);
    return can;
  }
  paintObjIcon(cx, def.kind, size);
  return can;
}
