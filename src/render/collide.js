import GAME from '../core/game.js';
import { ctx, cam, rc, viewW, viewH } from './ctx.js';

var G = GAME;

export function drawCollideOverlay(){
  var T = G.T;
  var c0 = Math.floor(cam.x / T) - 1;
  var c1 = Math.floor((cam.x + viewW()) / T) + 1;
  var r0 = Math.floor(cam.y / T) - 1;
  var r1 = Math.floor((cam.y + viewH()) / T) + 1;
  var c, r, v, x, y, k;
  ctx.save();
  for (r = r0; r <= r1; r++){
    for (c = c0; c <= c1; c++){
      if (!G.inMap(c, r)) continue;
      v = G.tileAt(c, r);
      if (!v) continue;
      x = c * T - cam.x; y = r * T - cam.y;
      if (G.isSolidV(v)){
        ctx.globalAlpha = 0.28;
        if (v === G.HTOP) rc(x, y, T, 8, '#ff7a6a');
        else if (v === G.CRUMB) rc(x, y, T, T, '#e0a060');
        else rc(x, y, T, T, '#ff5a4a');
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#ffd0c4';
        ctx.lineWidth = 1;
        if (v === G.HTOP) ctx.strokeRect(x + 0.5, y + 0.5, T - 1, 7);
        else ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      } else if (G.isSlopeV(v)){
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#7ad0ff';
        ctx.beginPath();
        ctx.moveTo(x, y + T);
        for (k = 0; k <= T; k += 2)
          ctx.lineTo(x + k, y + G.slopeTop(v, c, c * T + k));
        ctx.lineTo(x + T, y + T);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#c8f0ff';
        ctx.beginPath();
        ctx.moveTo(x, y + G.slopeTop(v, c, c * T));
        for (k = 2; k <= T; k += 2)
          ctx.lineTo(x + k, y + G.slopeTop(v, c, c * T + k));
        ctx.stroke();
      } else if (G.isBarV(v)){
        ctx.globalAlpha = 0.4;
        rc(x, y, T, 3, '#e8c878');
      } else if (G.isLadV(v)){
        ctx.globalAlpha = 0.22;
        rc(x + 5, y, 6, T, '#80e0a0');
      } else if (G.isWaterV(v)){
        ctx.globalAlpha = 0.12;
        rc(x, y, T, T, '#40a0ff');
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
