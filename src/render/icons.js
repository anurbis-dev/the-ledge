import { rc } from './ctx.js';
import { P } from './palette.js';

function px(ox, oy, sc, x, y, w, h, col){
  rc(ox + x * sc, oy + y * sc, Math.max(sc, w * sc), Math.max(sc, h * sc), col);
}

/* иконка 16×16, sc — масштаб пикселя */
export function drawItemIcon(type, ox, oy, sc){
  sc = sc || 1;
  var gc = P.gearCol[type] || null;
  var a = gc ? gc[0] : '#cfc6ff';
  var b = gc ? gc[1] : '#7a72a8';
  var p = px.bind(null, ox, oy, sc);

  if (type === 'coin'){
    p(5, 2, 6, 12, P.coin); p(3, 4, 10, 8, P.coin);
    p(4, 3, 8, 10, P.coin); p(10, 5, 1, 6, P.coinD); p(5, 5, 1, 3, '#fff6c9');
    return;
  }
  if (type === 'gem'){
    p(7, 2, 2, 1, P.gem); p(5, 3, 6, 2, P.gem); p(4, 5, 8, 3, P.gem);
    p(5, 8, 6, 3, P.gemD); p(7, 11, 2, 3, P.gemD); p(6, 4, 1, 2, '#ffffff');
    return;
  }
  if (type === 'shroom'){
    p(7, 8, 2, 6, P.stem); p(4, 5, 8, 4, P.shroom); p(5, 3, 6, 2, P.shroom);
    p(6, 4, 1, 1, '#ffe9c9'); p(9, 5, 1, 1, '#ffe9c9'); p(4, 8, 8, 1, P.shroomD);
    return;
  }
  if (type === 'relic'){
    p(4, 2, 8, 12, P.relicD); p(5, 3, 6, 10, P.relic); p(6, 6, 4, 4, '#fff');
    p(3, 2, 10, 1, P.relicD); p(3, 13, 10, 1, P.relicD);
    return;
  }
  if (type === 'key'){
    p(5, 3, 6, 6, P.key); p(7, 5, 2, 2, P.keyD);
    p(7, 9, 2, 5, P.key); p(9, 11, 2, 1, P.key); p(9, 13, 2, 1, P.key);
    return;
  }
  if (type === 'tank'){
    p(6, 3, 4, 10, '#8a94a0'); p(7, 2, 2, 2, '#8a94a0');
    p(7, 1, 2, 1, '#cfeaff'); p(7, 5, 2, 6, '#5a6874');
    return;
  }
  if (type === 'stick'){
    p(1, 7, 14, 2, a); p(1, 9, 14, 1, b); p(13, 6, 2, 4, b);
    return;
  }
  if (type === 'sword'){
    p(7, 1, 2, 10, a); p(7, 11, 2, 1, b); p(5, 12, 6, 2, b); p(7, 14, 2, 1, b);
    p(8, 2, 1, 8, '#ffffff');
    return;
  }
  if (type === 'blade'){
    p(8, 1, 1, 11, a); p(7, 2, 1, 9, a); p(5, 12, 6, 2, b); p(7, 14, 2, 1, b);
    p(8, 2, 1, 8, '#e8f4ff');
    return;
  }
  if (type === 'bow'){
    p(8, 2, 2, 12, b); p(5, 3, 3, 1, a); p(10, 3, 3, 1, a);
    p(4, 12, 4, 1, a); p(10, 12, 4, 1, a); p(7, 7, 2, 2, P.string);
    return;
  }
  if (type === 'harpoon'){
    p(1, 7, 12, 2, a); p(1, 9, 12, 1, b);
    p(12, 5, 3, 3, a); p(13, 4, 2, 2, '#c9d4dc');
    return;
  }
  if (type === 'wshield' || type === 'ishield' || type === 'gshield'){
    p(4, 2, 8, 12, a); p(5, 3, 6, 10, b); p(4, 2, 8, 2, '#ffe9a8');
    p(7, 6, 2, 4, a);
    return;
  }
  if (type === 'lhelm' || type === 'ihelm' || type === 'ghelm'){
    p(4, 3, 8, 5, b); p(3, 8, 10, 3, a); p(5, 4, 2, 2, '#1a1220'); p(9, 4, 2, 2, '#1a1220');
    return;
  }
  if (type === 'scuba'){
    p(5, 2, 6, 11, a); p(11, 5, 3, 5, b); p(7, 1, 2, 2, b);
    return;
  }
  if (type === 'flippers'){
    p(3, 6, 10, 4, a); p(2, 9, 4, 4, b); p(10, 9, 4, 4, b);
    return;
  }
  p(4, 4, 8, 8, a); p(6, 6, 4, 4, b);
}
