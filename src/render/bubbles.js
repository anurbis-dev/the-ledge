import { cam, VW, rc, world } from './ctx.js';
import { textPix } from './hud.js';
import { bubbleAnchor } from '../speech/runtime.js';

var PAD_X = 3, PAD_Y = 2, ROW = 7, ADV = 4;

function box(x, y, w, h, fill, edge){
  rc(x, y, w, h, fill);
  rc(x, y, w, 1, edge);
  rc(x, y + h - 1, w, 1, edge);
  rc(x, y, 1, h, edge);
  rc(x + w - 1, y, 1, h, edge);
}

export function drawBubbles(){
  var S = world();
  var list = (S && S.bubbles) || [];
  for (var i = 0; i < list.length; i++) drawOne(S, list[i]);
}

function visiblePrefix(b){
  return b.text.slice(0, b.shown);
}

function visibleLines(b){
  var left = visiblePrefix(b);
  var out = [], i, line, take;
  for (i = 0; i < b.lines.length; i++){
    line = b.lines[i];
    if (left.length <= 0){ out.push(''); continue; }
    take = Math.min(line.length, left.length);
    out.push(line.slice(0, take));
    left = left.slice(take);
    if (left.charAt(0) === ' ') left = left.slice(1);
  }
  return out;
}

function drawOne(S, b){
  var lines = visibleLines(b);
  var i, w = 0, lw;
  for (i = 0; i < b.lines.length; i++){
    lw = b.lines[i].length * ADV - 1;
    if (lw > w) w = lw;
  }
  var chW = 0, chH = 0, choices = b.choices;
  if (b.blocking && choices && b.shown >= b.text.length){
    for (i = 0; i < choices.length; i++){
      lw = (2 + String(choices[i].text).length) * ADV - 1;
      if (lw > chW) chW = lw;
    }
    chH = choices.length * ROW + 3;
  }
  var bw = Math.max(20, w + PAD_X * 2);
  var bh = b.lines.length * ROW + PAD_Y * 2;
  if (chH){
    bw = Math.max(bw, chW + PAD_X * 2);
    bh += chH;
  }

  var a = bubbleAnchor(S, b);
  var sx = Math.round(a.x - cam.x);
  var sy = Math.round(a.y - cam.y);
  var bx = sx - (bw / 2 | 0);
  var by = sy - bh - 8;
  if (bx < 2) bx = 2;
  if (bx + bw > VW - 2) bx = VW - 2 - bw;
  if (by < 2) by = sy + 6;

  var fill = b.who === 'hero' ? '#fff4dc' : '#e8e0ff';
  var edge = b.who === 'hero' ? '#5a3a28' : '#3a3260';
  var ink = b.who === 'hero' ? '#2a1c14' : '#221a38';
  box(bx, by, bw, bh, fill, edge);

  var tailX = sx;
  if (tailX < bx + 4) tailX = bx + 4;
  if (tailX > bx + bw - 5) tailX = bx + bw - 5;
  if (by < sy){
    rc(tailX - 2, by + bh - 1, 5, 1, fill);
    rc(tailX - 1, by + bh, 3, 2, fill);
    rc(tailX, by + bh + 2, 1, 2, fill);
    rc(tailX - 2, by + bh, 1, 1, edge);
    rc(tailX + 2, by + bh, 1, 1, edge);
    rc(tailX, by + bh + 3, 1, 1, edge);
  }

  var vis = visibleLines(b);
  for (i = 0; i < vis.length; i++){
    if (vis[i]) textPix(vis[i], bx + PAD_X, by + PAD_Y + i * ROW, ink, 1);
  }
  if (chH){
    var cy0 = by + PAD_Y + b.lines.length * ROW + 2;
    rc(bx + 2, cy0 - 1, bw - 4, 1, edge);
    for (i = 0; i < choices.length; i++){
      var on = i === b.choice;
      var label = (on ? '>' : ' ') + String(choices[i].text).toUpperCase();
      textPix(label, bx + PAD_X, cy0 + 1 + i * ROW, on ? '#8a3a18' : '#6a628f', 1);
    }
  }
}
