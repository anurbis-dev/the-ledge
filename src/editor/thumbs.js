import { P } from '../render/palette.js';

function px(c, x, y, w, h, col){
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

export function paintTileIcon(c, spec, s){
  c.clearRect(0, 0, s, s);
  var id = spec.id, k = s / 16;
  if (spec.custom && spec.src){
    c.fillStyle = spec.color || '#4a4069';
    c.fillRect(2, 2, s - 4, s - 4);
    return;
  }
  function r(x, y, w, h, col){ px(c, x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), col); }
  if (id === 0){
    r(0, 0, 16, 16, '#1a1228');
    r(1, 1, 14, 14, '#241a30');
    r(3, 3, 10, 1, '#3a2f4e'); r(3, 12, 10, 1, '#3a2f4e');
    r(3, 3, 1, 10, '#3a2f4e'); r(12, 3, 1, 10, '#3a2f4e');
    return;
  }
  if (id === 1 || id === 11 || id === 12){
    r(0, 0, 16, 16, P.rock);
    r(0, 9, 16, 1, P.rockD); r(4, 0, 1, 9, P.rockD); r(12, 10, 1, 6, P.rockD);
    r(2, 3, 2, 1, P.rockL); r(10, 12, 2, 1, P.rockL);
    r(0, 0, 16, 2, P.moss);
    return;
  }
  if (id === 2){
    r(0, 0, 16, 16, P.crum);
    r(3, 2, 1, 6, P.crumD); r(8, 6, 1, 7, P.crumD); r(11, 3, 1, 4, P.crumD);
    r(2, 3, 2, 1, P.crumL);
    return;
  }
  if (id === 3){
    r(7, 0, 2, 16, P.woodD); r(7, 0, 1, 16, P.woodL);
    for (var i = 1; i < 16; i += 5){ r(4, i, 8, 2, P.wood); r(4, i, 8, 1, P.woodL); }
    return;
  }
  if (id === 4){
    r(1, 0, 14, 16, '#241c3d');
    r(1, 0, 2, 16, P.woodD); r(13, 0, 2, 16, P.woodD);
    for (var j = 2; j < 16; j += 5) r(3, j, 10, 2, P.wood);
    return;
  }
  if (id === 7){
    r(0, 0, 16, 8, P.rock); r(0, 6, 16, 2, P.rockD); r(3, 1, 3, 1, P.rockL);
    return;
  }
  if (id === 8){
    r(0, 0, 16, 3, P.woodD); r(0, 0, 16, 1, P.wood);
    r(2, 3, 2, 4, P.woodD); r(12, 3, 2, 4, P.woodD); r(6, 3, 4, 6, P.wood);
    return;
  }
  if (id === 13){
    r(0, 0, 16, 16, '#2a78a8');
    r(0, 3, 16, 2, '#49a0cf'); r(2, 8, 3, 2, '#bfe6ff');
    return;
  }
  if (id === 14){
    r(0, 0, 16, 16, '#1d5a86');
    r(2, 0, 2, 16, '#49a0cf'); r(8, 2, 2, 14, '#2f7fae'); r(12, 0, 2, 16, '#bfe6ff');
    return;
  }
  if (id === 5 || id === 9 || spec.slope === 'r'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#8f86b8';
    c.beginPath(); c.moveTo(0, 16 * k); c.lineTo(16 * k, 0); c.lineTo(16 * k, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (id === 6 || id === 10 || spec.slope === 'l'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#8f86b8';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(16 * k, 16 * k); c.lineTo(0, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (spec.slope === 'r2'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#9a92c4';
    c.beginPath(); c.moveTo(0, 16 * k); c.lineTo(16 * k, 8 * k); c.lineTo(16 * k, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (spec.slope === 'r3'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#9a92c4';
    c.beginPath(); c.moveTo(0, 8 * k); c.lineTo(16 * k, 0); c.lineTo(16 * k, 16 * k); c.lineTo(0, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (spec.slope === 'l2'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#9a92c4';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(16 * k, 8 * k); c.lineTo(16 * k, 16 * k); c.lineTo(0, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (spec.slope === 'l3'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#9a92c4';
    c.beginPath(); c.moveTo(0, 8 * k); c.lineTo(16 * k, 16 * k); c.lineTo(0, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (spec.slope === 'arcR'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#a89ed0';
    c.beginPath(); c.moveTo(0, 16 * k);
    c.quadraticCurveTo(4 * k, 2 * k, 16 * k, 0); c.lineTo(16 * k, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (spec.slope === 'arcL'){
    r(0, 0, 16, 16, '#1a1228');
    c.fillStyle = '#a89ed0';
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(12 * k, 2 * k, 16 * k, 16 * k); c.lineTo(0, 16 * k); c.closePath(); c.fill();
    return;
  }
  if (id === 31){
    r(0, 0, 16, 16, P.woodD);
    r(0, 1, 16, 4, P.wood); r(0, 7, 16, 4, P.wood);
    r(0, 1, 16, 1, P.woodL); r(0, 7, 16, 1, P.woodL);
    return;
  }
  if (id === 32){
    r(0, 2, 16, 14, P.rock);
    r(0, 2, 16, 2, P.rockL); r(0, 14, 16, 2, P.rockD);
    return;
  }
  r(0, 0, 16, 16, spec.color || P.rock);
}

export function paintObjIcon(c, kind, s){
  c.clearRect(0, 0, s, s);
  var k = s / 16;
  function r(x, y, w, h, col){ px(c, x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), col); }
  r(0, 0, 16, 16, '#160f26');
  if (kind === 'enemy0'){
    r(3, 5, 10, 9, P.foeB); r(4, 6, 8, 6, P.foeA); r(10, 7, 2, 2, P.foeEye);
    r(5, 3, 1, 3, P.foeA); r(8, 2, 1, 3, P.foeA); r(11, 3, 1, 3, P.foeA);
  } else if (kind === 'enemy1'){
    r(3, 5, 10, 9, '#7a3d52'); r(4, 6, 8, 6, '#b05f7a'); r(10, 7, 2, 2, P.foeEye);
    r(12, 6, 2, 5, '#ffd9a0');
  } else if (kind === 'enemy2'){
    r(2, 4, 12, 10, '#3d537a'); r(3, 5, 10, 7, '#5f7fb0'); r(2, 2, 12, 3, '#8fa8cc');
    r(5, 1, 2, 3, '#8fa8cc'); r(9, 1, 2, 3, '#8fa8cc'); r(10, 7, 2, 2, P.foeEye);
  } else if (kind === 'flier0'){
    r(4, 6, 8, 5, '#6d5a8f'); r(5, 7, 6, 2, '#9b83c4'); r(10, 7, 2, 2, P.foeEye);
    r(2, 5, 3, 2, '#6d5a8f'); r(11, 5, 3, 2, '#6d5a8f'); r(12, 8, 2, 2, '#ffb060');
  } else if (kind === 'flier1'){
    r(4, 6, 8, 5, '#8f6d4a'); r(5, 7, 6, 2, '#c9a06a'); r(10, 7, 2, 2, P.foeEye);
    r(2, 5, 3, 2, '#8f6d4a'); r(11, 5, 3, 2, '#8f6d4a'); r(12, 8, 2, 2, '#ffb060');
  } else if (kind === 'flier2'){
    r(4, 6, 8, 5, '#4a6d8f'); r(5, 7, 6, 2, '#7fa8cc'); r(10, 7, 2, 2, P.foeEye);
    r(2, 5, 3, 2, '#4a6d8f'); r(11, 5, 3, 2, '#4a6d8f'); r(12, 8, 2, 2, '#ffb060');
  } else if (kind === 'flier3'){
    r(4, 6, 8, 5, '#8f2f3a'); r(5, 7, 6, 2, '#e06a6a'); r(10, 7, 2, 2, P.foeEye);
    r(1, 5, 4, 2, '#8f2f3a'); r(11, 4, 4, 2, '#8f2f3a'); r(12, 8, 2, 2, '#ffb060');
  } else if (kind === 'spider0'){
    r(6, 7, 4, 4, '#3b2f4a'); r(7, 8, 2, 2, '#c9a0ff');
    r(3, 7, 3, 1, '#3b2f4a'); r(10, 7, 3, 1, '#3b2f4a');
    r(4, 10, 2, 2, '#3b2f4a'); r(10, 10, 2, 2, '#3b2f4a');
    r(7, 2, 1, 5, '#d0dce8');
  } else if (kind === 'spider1'){
    r(6, 7, 4, 4, '#6b2f3a'); r(7, 8, 2, 2, '#ff9a7a');
    r(3, 7, 3, 1, '#6b2f3a'); r(10, 7, 3, 1, '#6b2f3a');
    r(4, 10, 2, 2, '#6b2f3a'); r(10, 10, 2, 2, '#6b2f3a');
    r(7, 2, 1, 5, '#d0dce8');
  } else if (kind === 'spider2'){
    r(6, 7, 4, 4, '#2f4a3b'); r(7, 8, 2, 2, '#9fe0a0');
    r(3, 7, 3, 1, '#2f4a3b'); r(10, 7, 3, 1, '#2f4a3b');
    r(4, 10, 2, 2, '#2f4a3b'); r(10, 10, 2, 2, '#2f4a3b');
    r(7, 2, 1, 5, '#d0dce8');
  } else if (kind === 'tendril0'){
    r(7, 12, 2, 3, '#1c5a32'); r(6, 8, 3, 5, '#2f8a4a'); r(7, 3, 2, 6, '#d4de6a'); r(7, 2, 1, 2, '#f2f0a8');
  } else if (kind === 'tendril1'){
    r(6, 12, 4, 3, '#163840'); r(5, 7, 6, 6, '#245a62'); r(6, 4, 4, 4, '#8fc4b0');
  } else if (kind === 'torch'){
    r(7, 6, 2, 8, P.woodD); r(6, 3, 4, 4, '#ff9b3d'); r(7, 1, 2, 3, '#ffd98a');
  } else if (kind === 'chest'){
    r(2, 6, 12, 8, P.chestD); r(3, 7, 10, 6, P.chest); r(2, 4, 12, 3, P.chestD);
    r(3, 4, 10, 2, P.chestL); r(7, 5, 2, 4, P.band);
  } else if (kind === 'chestL'){
    r(2, 6, 12, 8, P.chestD); r(3, 7, 10, 6, P.chest); r(2, 4, 12, 3, P.chestD);
    r(3, 4, 10, 2, P.chestL); r(6, 5, 4, 4, P.lockC);
  } else if (kind === 'coin'){
    r(5, 4, 6, 8, P.coin); r(4, 5, 8, 6, P.coin); r(6, 6, 1, 4, '#fff6c9');
  } else if (kind === 'gem'){
    r(7, 3, 2, 1, P.gem); r(5, 4, 6, 3, P.gem); r(6, 7, 4, 4, P.gemD); r(6, 4, 1, 2, '#fff');
  } else if (kind === 'shroom'){
    r(7, 8, 2, 5, P.stem); r(4, 5, 8, 4, P.shroom); r(5, 3, 6, 3, P.shroom); r(6, 4, 1, 1, '#ffe9c9');
  } else if (kind === 'sound'){
    r(3, 6, 3, 4, '#7ad0ff'); r(6, 5, 2, 6, '#7ad0ff');
    r(9, 4, 1, 8, '#4aa0c8'); r(11, 5, 1, 6, '#4aa0c8'); r(13, 6, 1, 4, '#4aa0c8');
  } else if (kind === 'light'){
    r(7, 8, 2, 6, P.woodD); r(5, 4, 6, 5, '#ffcf7a'); r(6, 2, 4, 3, '#fff3c4'); r(7, 1, 2, 2, '#fff');
  } else if (kind === 'volume'){
    r(2, 3, 12, 10, '#241a40'); r(3, 4, 10, 8, '#3a5080aa');
    r(2, 3, 12, 1, '#88a0ff'); r(2, 12, 12, 1, '#88a0ff');
    r(2, 3, 1, 10, '#88a0ff'); r(13, 3, 1, 10, '#88a0ff');
  } else if (kind === 'boulder'){
    r(2, 4, 12, 11, '#4a4460'); r(2, 4, 12, 2, '#6e6892'); r(3, 6, 3, 2, '#847dab');
    r(3, 13, 10, 2, '#302c46');
  } else if (kind === 'npc_hermit' || kind === 'npc_wanderer'){
    var cloak = kind === 'npc_wanderer' ? '#3a5a4a' : '#4a3a68';
    var cloakD = kind === 'npc_wanderer' ? '#243830' : '#2e2446';
    r(4, 8, 8, 8, cloakD); r(5, 8, 6, 7, cloak);
    r(5, 3, 6, 5, cloakD); r(6, 4, 4, 3, P.skin);
    r(5, 3, 6, 2, cloak); r(9, 6, 2, 1, '#1a1220');
    r(5, 15, 2, 1, '#2a2030'); r(9, 15, 2, 1, '#2a2030');
  } else if (kind === 'key'){
    r(6, 3, 5, 5, '#160f26'); r(7, 4, 3, 3, P.key);
    r(8, 8, 2, 6, P.key); r(9, 10, 3, 1, P.keyD); r(9, 12, 2, 1, P.keyD);
  } else if (kind === 'relic'){
    r(4, 2, 8, 12, P.relicD); r(5, 3, 6, 10, P.relic); r(6, 6, 4, 4, '#fff');
  } else if (kind === 'tank'){
    r(6, 3, 4, 10, '#8a94a0'); r(7, 2, 2, 2, '#8a94a0');
    r(7, 1, 2, 1, '#cfeaff'); r(7, 5, 2, 6, '#5a6874');
  } else if (kind === 'helmet' || kind === 'shield' || kind === 'sword' ||
             kind === 'scuba' || kind === 'flippers' || kind === 'harpoon' || kind === 'bow'){
    var gk = kind === 'helmet' ? 'ihelm' : kind === 'shield' ? 'ishield' : kind;
    var gc = P.gearCol[gk] || ['#cfc6ff', '#8f88bb'];
    if (kind === 'helmet'){
      r(4, 3, 8, 5, gc[1]); r(3, 8, 10, 3, gc[0]); r(5, 4, 2, 2, '#1a1220'); r(9, 4, 2, 2, '#1a1220');
    } else if (kind === 'shield'){
      r(4, 2, 8, 12, gc[0]); r(5, 3, 6, 10, gc[1]); r(4, 2, 8, 2, '#ffe9a8'); r(7, 6, 2, 4, gc[0]);
    } else if (kind === 'sword'){
      r(7, 1, 2, 10, gc[0]); r(7, 11, 2, 1, gc[1]); r(5, 12, 6, 2, gc[1]); r(7, 14, 2, 1, gc[1]);
      r(8, 2, 1, 8, '#ffffff');
    } else if (kind === 'scuba'){
      r(5, 2, 6, 11, gc[0]); r(11, 5, 3, 5, gc[1]); r(7, 1, 2, 2, gc[1]);
    } else if (kind === 'flippers'){
      r(3, 6, 10, 4, gc[0]); r(2, 9, 4, 4, gc[1]); r(10, 9, 4, 4, gc[1]);
    } else if (kind === 'harpoon'){
      r(1, 7, 12, 2, gc[0]); r(1, 9, 12, 1, gc[1]); r(12, 5, 3, 3, gc[0]); r(13, 4, 2, 2, '#c9d4dc');
    } else {
      r(8, 2, 2, 12, gc[1]); r(5, 3, 3, 1, gc[0]); r(10, 3, 3, 1, gc[0]);
      r(4, 12, 4, 1, gc[0]); r(10, 12, 4, 1, gc[0]); r(7, 7, 2, 2, P.string);
    }
  } else {
    r(4, 4, 8, 8, '#cfc6ff');
  }
}

var tileCache = {}, objCache = {};

export function tileThumb(spec, size){
  var key = spec.id + ':' + (spec.slope || '') + ':' + size + ':' + (spec.src ? spec.src.length : 0) + ':' + (spec.name || '');
  if (tileCache[key]) return tileCache[key];
  var cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  var ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paintTileIcon(ctx, spec, size);
  if (spec.custom && spec.src){
    var img = new Image();
    img.onload = function(){
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 16, 16, 0, 0, size, size);
    };
    img.src = spec.src;
    if (img.complete && img.naturalWidth) img.onload();
  }
  tileCache[key] = cv;
  return cv;
}

export function objThumb(kind, size){
  var key = kind + ':' + size;
  if (objCache[key]) return objCache[key];
  var cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  var ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paintObjIcon(ctx, kind, size);
  objCache[key] = cv;
  return cv;
}

export function clearThumbCache(){ tileCache = {}; objCache = {}; }
