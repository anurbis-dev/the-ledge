import { ctx, cam, viewW, viewH, viewScale } from './ctx.js';
import { world } from './ctx.js';
import { maskAt, volLocal } from '../entities/volumes.js';

var tmp = null, mask = null;

function ensureCan(old, w, h){
  if (old && old.width === w && old.height === h) return old;
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

function hexRgb(hex){
  var h = String(hex || '#88a0ff').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  if (!isFinite(n)) return [136, 160, 255];
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function filterCss(v){
  var br = 1 + (v.bright || 0);
  var ct = v.contrast != null ? v.contrast : 1;
  var sat = v.sat != null ? v.sat : 1;
  var hue = v.hue || 0;
  return 'brightness(' + br + ') contrast(' + ct + ') saturate(' + sat + ') hue-rotate(' + hue + 'deg)';
}

function paintMask(g, w, h, kind){
  g.clearRect(0, 0, w, h);
  var img = g.createImageData(w, h);
  var d = img.data, x, y, i, a;
  for (y = 0; y < h; y++){
    for (x = 0; x < w; x++){
      a = maskAt(kind, (x + 0.5) / w, (y + 0.5) / h);
      i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = (a * 255 + 0.5) | 0;
    }
  }
  g.putImageData(img, 0, 0);
}

export function applyVolumes(){
  var S = world();
  var list = S && S.volumes;
  if (!list || !list.length) return;
  var z = viewScale || 1;
  var sw = Math.max(1, Math.round(viewW() * z));
  var sh = Math.max(1, Math.round(viewH() * z));
  var i, v, hw, hh, pad, bw, bh, src, sx, sy, rgb, amt;
  var g, mg;
  for (i = 0; i < list.length; i++){
    v = list[i];
    if (v.mode && v.mode !== 'color') continue;
    hw = v.w / 2; hh = v.h / 2;
    pad = Math.ceil(Math.sqrt(hw * hw + hh * hh)) + 2;
    var cx = v.x + hw - cam.x;
    var cy = v.y + hh - cam.y;
    if (cx + pad < 0 || cy + pad < 0 || cx - pad > viewW() || cy - pad > viewH()) continue;
    bw = Math.max(2, Math.round(v.w));
    bh = Math.max(2, Math.round(v.h));
    tmp = ensureCan(tmp, bw, bh);
    mask = ensureCan(mask, bw, bh);
    g = tmp.getContext('2d');
    mg = mask.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    src = ctx.canvas;
    sx = Math.round((cx - hw) * z);
    sy = Math.round((cy - hh) * z);
    g.clearRect(0, 0, bw, bh);
    g.save();
    g.translate(bw / 2, bh / 2);
    g.rotate(-(v.rot || 0));
    g.filter = filterCss(v);
    try {
      g.drawImage(src, sx, sy, Math.round(v.w * z), Math.round(v.h * z), -bw / 2, -bh / 2, bw, bh);
    } catch (_){
      g.filter = 'none';
      g.restore();
      continue;
    }
    g.filter = 'none';
    g.restore();
    paintMask(mg, bw, bh, v.mask || 'circle');
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    amt = v.tintAmt || 0;
    if (amt > 0){
      rgb = hexRgb(v.tint);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = amt;
      g.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      g.fillRect(0, 0, bw, bh);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.setTransform(z, 0, 0, z, 0, 0);
    ctx.translate(cx, cy);
    ctx.rotate(v.rot || 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, -hw, -hh, v.w, v.h);
    ctx.restore();
  }
}
