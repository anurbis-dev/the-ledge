import { T, C, LADR, LADL, LADW } from './constants.js';
import { runtime } from './runtime.js';
import {
  tileAt, rectFree, solidAt, isSlopeV, slopeTop, isLadV, ladderTop,
  isBarV, ladderTile, solidTile
} from './map.js';
import { dropTorch } from '../entities/torches.js';
import { platUnder } from '../entities/plats.js';

/* ---------------- игрок ---------------- */
export function mkPlayer(){
  var sx = runtime.LV.spawn.x, sy = runtime.LV.spawn.y;
  return {
    x: sx, y: sy, w: C.W, h: C.H, vx: 0, vy: 0, facing: 1,
    state: 'normal', onGround: true, jumping: false, sliding: 0,
    coyote: 0, buf: 0, grabCd: 0, lock: 0, landT: 0, rollT: 0, rollCd: 0, stunT: 0,
    apexY: sy, fell: 0, ride: null, hang: null, climb: null, lad: null,
    rollAng: 0, torch: -1, walking: false, warp: null,
    lastWall: 0, stick: false, helmet: false, shield: false, shieldCd: 0,
    gear: { weapon:null, shield:null, helmet:null }, spare: [], bashT: 0,
    atkT: 0, atkCd: 0, hurtCd: 0, snap: null,
    stance: 0, bars: null, ladCd: 0, inWater: false, wading: false,
    atSurface: false, swimSurf: null, swimAng: 0, wasWet: false, bubT: 0,
    air: C.AIR_MAX, swimLaunch: 0, stam: C.STAM_MAX, dashT: 0,
    events: []
  };
}
export function resetPlayer(S){
  var had = S.p ? S.p.stick : false;
  var hadH = S.p ? S.p.helmet : false, hadS = S.p ? S.p.shield : false;
  if (S.torches) for (var i = 0; i < S.torches.length; i++) S.torches[i].held = false;
  var np = mkPlayer();
  np.x = S.respawn.x; np.y = S.respawn.y; np.apexY = np.y; np.onGround = true;
  np.stick = had; np.helmet = hadH; np.shield = hadS;
  if (S.p){ np.gear = S.p.gear; np.spare = S.p.spare; }
  S.p = np;
}

export function moveX(S, p, dx){
  var oy = p.y;
  p.x += dx;
  if (!rectFree(p.x, p.y, p.w, p.h)){
    // ступенька в 1-3px (стыки склонов): подсаживаем, а не блокируем
    for (var k = 1; k <= 3; k++){
      if (rectFree(p.x, p.y - k, p.w, p.h)){ p.y -= k; return; }
    }
    p.y = oy;
    if (dx > 0) p.x = Math.floor((p.x + p.w) / T) * T - p.w;
    else        p.x = Math.floor(p.x / T) * T + T;
    p.vx = 0;
  }
}
export function moveY(S, p, dy){
  var oldB = p.y + p.h;
  p.y += dy;
  if (!rectFree(p.x, p.y, p.w, p.h)){
    if (dy > 0){ p.y = Math.floor((p.y + p.h) / T) * T - p.h; p.onGround = true; }
    else        p.y = Math.floor(p.y / T) * T + T;
    p.vy = 0; p.ride = null;
    return;
  }
  if (dy > 0){                                  // односторонние движущиеся платформы
    for (var i = 0; i < S.plats.length; i++){
      var q = S.plats[i];
      if (p.x + p.w > q.x + 1 && p.x < q.x + q.w - 1 && oldB <= q.y + 1 && p.y + p.h >= q.y){
        p.y = q.y - p.h; p.vy = 0; p.onGround = true; p.ride = q; return;
      }
    }
  }
}
export function groundAhead(S, p, dir){
  var px = dir > 0 ? p.x + p.w + 2 : p.x - 2, py = p.y + p.h + 3;
  if (solidAt(px, py)) return true;
  var probe = { x: dir > 0 ? p.x + 4 : p.x - 4, y: p.y, w: p.w, h: p.h };
  return !!platUnder(S, probe, py);
}
export function ladderTopUnder(p, probeY){
  var c0 = Math.floor((p.x + 1)/T), c1 = Math.floor((p.x + p.w - 2)/T);
  for (var c = c0; c <= c1; c++){
    var r = Math.floor(probeY / T);
    if (ladderTop(c, r) && probeY >= r*T - 1 && probeY <= r*T + 7) return r*T;
  }
  return null;
}
export function slopeUnder(p){
  // поверхность берём под центром — иначе на лесенке из скосов дёргает вверх
  var best = null, px;
  for (var i = 0; i <= 2; i++){
    px = p.x + 1 + (p.w - 2) * (i / 2);
    var c = Math.floor(px / T), r = Math.floor((p.y + p.h + 1) / T);
    for (var k = -1; k <= 1; k++){
      var v = tileAt(c, r + k);
      if (!isSlopeV(v)) continue;
      var sy = (r + k)*T + slopeTop(v, c, px);
      if (p.y + p.h >= sy - 12 && p.y + p.h <= sy + 20)   // допускаем шаг вверх по склону
        if (best === null || sy < best) best = sy;
    }
  }
  return best;
}
export function grounded(S, p, noLadTop){
  if (slopeUnder(p) !== null) return true;
  if (!rectFree(p.x + 1, p.y + p.h, p.w - 2, 1)) return true;
  if (platUnder(S, p, p.y + p.h + 1)) return true;
  if (noLadTop) return false;
  return ladderTopUnder(p, p.y + p.h + 1) !== null;
}

export function setH(p, h){ var b = p.y + p.h; p.h = h; p.y = b - h; }
export function stanceH(st){ return st === 2 ? C.PRH : (st === 1 ? C.CRH : C.H); }
export function stanceW(st){ return st === 2 ? C.PRW : C.W; }
export function setStance(S, p, st){
  if (p.stance === st) return true;
  var h = stanceH(st), w = stanceW(st);
  var b = p.y + p.h, cx = p.x + p.w/2;
  var nx = cx - w/2, ny = b - h;
  if (!rectFree(nx, ny, w, h)) return false;           // не разогнуться / не растянуться
  p.x = nx; p.y = ny; p.w = w; p.h = h; p.stance = st;
  p.events.push(st === 0 ? 'stand' : (st === 1 ? 'crouch' : 'prone'));
  return true;
}

export function hangBox(cx, cy, facing, kind){
  if (kind === 'lad') return { x: cx - C.W/2, y: cy - C.HAND };
  return { x: facing > 0 ? cx - C.W : cx, y: cy - C.HAND };
}
export function standBox(cx, cy, facing){ return { x: cx + facing*C.STAND_OFF - C.W/2, y: cy - C.H }; }
export function ladBox(cx, cy){ return { x: cx - C.W/2, y: cy - C.H }; }

export function damage(S, n, stun){
  S.hp -= n; S.p.stunT = stun; S.p.state = 'stun'; S.p.vx = 0;
  S.shake = Math.min(7, 3 + n * 2); S.hitStop = 0.09;
  S.p.events.push('hurt');
  if (S.hp <= 0){ S.hp = 3; resetPlayer(S); S.p.events.push('respawn'); }
}

/* --- потолочные перекладины: движение на руках --- */
export function barAt(px, py){ return isBarV(tileAt(Math.floor(px/T), Math.floor(py/T))); }
export function tryBars(S, p){
  if (p.state !== 'normal' || p.onGround || p.vy < -40 || p.grabCd > 0) return false;
  var cx = p.x + p.w/2, handY = p.y + C.HAND;
  for (var dy = -8; dy <= 10; dy++){
    var py = handY + dy, r = Math.floor(py / T), c = Math.floor(cx / T);
    var vv = tileAt(c, r);
    if (vv === LADR || vv === LADL){                 // диагональ снизу — как перекладины
      var dgY = (r + 1) * T;
      if (Math.abs(dgY - handY) > 10) continue;
      var dny = dgY - C.HAND;
      if (!rectFree(p.x, dny, p.w, p.h)) continue;
      p.y = dny; p.vx = 0; p.vy = 0; p.onGround = false;
      p.state = 'bars';
      p.bars = { row: r, ph: 0, diag: (vv === LADR ? 1 : -1), col: c,
                 ax: p.x, ay: dny };                  // якорь для непрерывного наклона
      if (p.torch >= 0) dropTorch(S, false);
      p.events.push('grabbar');
      return true;
    }
    if (!isBarV(vv)) continue;
    var barY = (r + 1) * T;                       // низ перекладины — где висят руки
    if (Math.abs(barY - handY) > 9) continue;
    var ny = barY - C.HAND;
    if (!rectFree(p.x, ny, p.w, p.h)) continue;
    p.y = ny; p.vx = 0; p.vy = 0; p.onGround = false;
    p.state = 'bars'; p.bars = { row: r, ph: 0 };
    if (p.torch >= 0) dropTorch(S, false);
    p.events.push('grabbar');
    return true;
  }
  return false;
}
export function updateBars(S, p, dt, inp){
  var B = p.bars;
  if (inp.jumpPressed || inp.downPressed){
    p.state = 'normal'; p.bars = null; p.vy = inp.jumpPressed ? C.JUMP*0.72 : 10;
    p.vx = inp.x * 70; p.apexY = p.y; p.grabCd = C.GRAB_CD;
    p.events.push(inp.jumpPressed ? 'jump' : 'release');
    return;
  }
  p.vy = 0;
  var dir = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
  if (dir && B.diag){                                 // вдоль наклонной лестницы
    p.facing = dir;
    var sp = C.BAR_V * 0.78 * dt;
    var nx2 = p.x + dir * sp;
    var ny2 = p.y - dir * B.diag * sp;                // вверх, если идём «в гору»
    // строго по прямой наклона: y считается от якоря, без привязки к сетке
    ny2 = B.ay - B.diag * (nx2 - B.ax);
    var cc2 = Math.floor((nx2 + p.w/2) / T);
    var rr2 = Math.floor((ny2 + C.HAND - 4) / T);
    var okTile = false;
    for (var rq = rr2 - 1; rq <= rr2 + 1; rq++){
      var vq = tileAt(cc2, rq);
      if (vq === LADR || vq === LADL){ okTile = true; break; }
    }
    if (okTile && rectFree(nx2, ny2, p.w, p.h)){
      p.x = nx2; p.y = ny2; B.row = rr2; B.col = cc2; B.ph += sp * 0.14;
    } else {
      p.state = 'normal'; p.bars = null; p.vy = 12; p.apexY = p.y;
      p.grabCd = C.GRAB_CD; p.events.push('release');
    }
    return;
  }
  if (dir){
    p.facing = dir;
    var nx = p.x + dir * C.BAR_V * dt;
    var ncx = nx + p.w/2;
    if (rectFree(nx, p.y, p.w, p.h) && barAt(ncx, B.row*T + 4)){
      p.x = nx; B.ph += C.BAR_V * dt * 0.12;
    } else if (!barAt(ncx, B.row*T + 4)){
      // конец перекладин — срываемся
      p.state = 'normal'; p.bars = null; p.vy = 12; p.apexY = p.y;
      p.grabCd = C.GRAB_CD; p.events.push('release');
    }
  }
}

/* --- автоцепляние за лестницу в падении --- */
export function autoLadder(S, p, prevBottom){
  if (p.state !== 'normal' || p.vy <= 0 || p.lock > 0) return false;
  var cx = p.x + p.w/2;
  var c = Math.floor(cx / T);
  var r0 = Math.floor(prevBottom / T), r1 = Math.floor((p.y + p.h) / T);
  for (var r = r0; r <= r1; r++){
    for (var dc = 0; dc <= 1; dc++){
      var col = dc === 0 ? c : (cx - c*T > T/2 ? c + 1 : c - 1);
      var v = tileAt(col, r);
      if (!isLadV(v)) continue;
      var diag = (v === LADR || v === LADL);
      if (p.rollT > 0 && !diag) continue;              // в перекате ловит только диагональ
      // диагональ ловит всегда (она как настил), вертикальную — только на сходе с края
      if (!diag && p.vy > 190) continue;
      if (Math.abs(col*T + T/2 - cx) > 12) continue;
      var nx = diag ? p.x : col*T + T/2 - p.w/2;
      var ny = diag ? (r*T + T/2 - p.h/2) : p.y;
      if (!rectFree(nx, ny, p.w, p.h)) continue;
      if (p.rollT > 0){ p.rollT = 0; setStance(S, p, 0); }   // подкат прерывается
      p.x = nx; p.y = ny;
      attach(p, v, col, diag ? (col*T + T/2) - (nx + p.w/2) : 0,
                          diag ? (r*T + T/2) - (ny + p.h/2) : 0);
      p.lad.tc = col; p.lad.tr = r;
      return true;
    }
  }
  return false;
}

/* --- захват края / нижней перекладины --- */
export function tryGrab(S, p){
  if (p.grabCd > 0 || p.onGround || p.state !== 'normal' || p.rollT > 0) return false;
  if (p.vy < C.GRAB_VY) return false;
  var handY = p.y + C.HAND, dir = p.facing, dy, py;

  var hx = dir > 0 ? p.x + p.w + 2 : p.x - 2;               // кромка уступа
  for (dy = -C.TOL_DN; dy <= C.TOL_UP; dy++){
    py = handY + dy;
    if (solidAt(hx, py) || !solidAt(hx, py + 2)) continue;
    var top = Math.floor((py + 2) / T) * T, wc = Math.floor(hx / T);
    var cx = dir > 0 ? wc * T : (wc + 1) * T;
    var hb = hangBox(cx, top, dir, 'ledge');
    if (!rectFree(hb.x, hb.y, p.w, p.h)) continue;
    var sb = standBox(cx, top, dir);
    if (!rectFree(sb.x, sb.y, p.w, p.h)) continue;
    grabTo(p, cx, top, dir, 'ledge', wc, Math.floor((py + 2) / T));
    return true;
  }
  for (var pi = 0; pi < runtime.W.plats.length; pi++){              // кромка движущейся платформы
    var q = runtime.W.plats[pi];
    var side = (p.x + p.w/2 < q.x + q.w/2) ? -1 : 1;
    if (side !== dir) continue;
    var cxq = side > 0 ? q.x + q.w : q.x;
    if (Math.abs((dir > 0 ? p.x + p.w : p.x) - cxq) > 12) continue;
    if (Math.abs(handY - q.y) > 9) continue;
    var hbq = hangBox(cxq, q.y, dir, 'ledge');
    if (!rectFree(hbq.x, hbq.y, p.w, p.h)) continue;
    grabTo(p, cxq, q.y, dir, 'ledge', -1, -1);
    p.hang.plat = q;
    return true;
  }
  var pcx = p.x + p.w/2, c0 = Math.floor(pcx / T);          // низ висячей лестницы
  for (var c = c0 - 1; c <= c0 + 1; c++){
    if (Math.abs(c * T + T/2 - pcx) > C.LAD_XTOL) continue;
    for (dy = -C.LAD_TOL; dy <= C.LAD_TOL; dy++){
      var r = Math.floor((handY + dy) / T);
      if (!ladderTile(c, r) || ladderTile(c, r + 1)) continue;
      var bot = (r + 1) * T;
      if (Math.abs(bot - handY) > C.LAD_TOL) continue;
      var lx = c * T + T/2;
      var lb = hangBox(lx, bot, dir, 'lad');
      if (!rectFree(lb.x, lb.y, p.w, p.h)) continue;
      var f = solidTile(c + 1, r) ? 1 : (solidTile(c - 1, r) ? -1 : p.facing);
      grabTo(p, lx, bot, f, 'lad', c, r);
      return true;
    }
  }
  return false;
}
export function grabTo(p, cx, cy, facing, kind, tc, tr){
  if (p.torch >= 0 && runtime.W) dropTorch(runtime.W, false);
  if (p.stance !== 0 && runtime.W) setStance(runtime.W, p, 0);
  p.lastWall = 0;
  var b = hangBox(cx, cy, facing, kind === 'lad' ? 'lad' : 'ledge');
  p.x = b.x; p.y = b.y; p.vx = 0; p.vy = 0; p.facing = facing;
  p.state = 'hang'; p.onGround = false;
  p.hang = { cx: cx, cy: cy, kind: kind, tc: tc, tr: tr, lt: tileAt(tc, tr) };
  p.events.push('grab');
}

/* --- спуск спиной с края --- */
export function tryDescend(S, p, want){
  var gy = Math.floor((p.y + p.h + 2) / T) * T;
  // если у края вплотную стоит лестница — кромка не работает, уходим на лестницу
  var lc0 = Math.floor((p.x + p.w/2) / T), lr0 = Math.floor((gy + 2) / T);
  if (ladderTile(lc0, lr0) || ladderTile(lc0 - 1, lr0) || ladderTile(lc0 + 1, lr0)) return false;
  var order = want ? [want, -want] : [p.facing, -p.facing];
  for (var i = 0; i < order.length; i++){
    var dir = order[i], col = -1;
    for (var d = 2; d <= 16; d += 2){
      var px = dir > 0 ? p.x + p.w - 1 + d : p.x - d;
      if (!solidAt(px, gy + 2)){ col = Math.floor(px / T) - dir; break; }
    }
    if (col < 0 || !solidTile(col, Math.floor((gy + 2) / T))) continue;
    var cx = dir > 0 ? (col + 1) * T : col * T, f = -dir;
    var hb = hangBox(cx, gy, f, 'ledge');
    if (!rectFree(hb.x, hb.y, p.w, p.h)) continue;
    startClimb(p, -1, cx, gy, f, 'ledge');
    return true;
  }
  return false;
}
export function startClimb(p, dir, cx, cy, facing, kind){
  var from = { x: p.x, y: p.y }, to, ideal;
  if (dir > 0 && kind === 'lad'){ to = ladBox(cx, cy); ideal = hangBox(cx, cy, facing, 'lad'); }
  else if (dir > 0){ to = standBox(cx, cy, facing); ideal = hangBox(cx, cy, facing, 'ledge'); }
  else { to = hangBox(cx, cy, facing, 'ledge'); ideal = standBox(cx, cy, facing); }
  p.facing = facing; p.state = 'climb'; p.vx = 0; p.vy = 0; p.onGround = false;
  p.climb = { dir: dir, kind: kind, p: 0, dur: dir > 0 ? (kind === 'lad' ? C.TO_LAD : C.CLIMB_UP) : C.CLIMB_DN,
              cx: cx, cy: cy, facing: facing, from: from, to: to,
              off: { x: from.x - ideal.x, y: from.y - ideal.y } };
  p.events.push(dir > 0 ? 'climbup' : 'climbdown');
}
export function releaseHang(p, push){
  p.state = 'normal'; p.hang = null; p.grabCd = C.GRAB_CD;
  p.vy = 12; p.onGround = false; p.apexY = p.y;
  if (push){ p.vx = push * 48; p.facing = push; }
  p.events.push('release');
}
export function updateHang(S, p, dt, inp){
  p.vx = 0; p.vy = 0;
  if (p.hang.plat){                       // едем вместе с платформой
    var q = p.hang.plat;
    p.hang.cx += q.dx; p.hang.cy = q.y;
    p.x += q.dx; p.y = q.y - C.HAND;
  }
  var away = (inp.x !== 0 && inp.x !== p.facing) ? inp.x : 0;
  if (p.hang.kind === 'lad') away = 0;
  if (inp.jumpPressed){
    if (away){                                       // прыжок спиной от стены
      p.state = 'normal'; p.hang = null; p.grabCd = C.GRAB_CD;
      p.vx = away * C.WJ_X * 0.9; p.vy = C.WJ_Y; p.facing = away;
      p.lock = C.WJ_LOCK; p.apexY = p.y; p.events.push('backjump');
      return;
    }
    if (p.hang.kind === 'lad'){ startClimb(p, 1, p.hang.cx, p.hang.cy, p.facing, 'lad'); return; }
    if (rectFree(standBox(p.hang.cx, p.hang.cy, p.facing).x, standBox(p.hang.cx, p.hang.cy, p.facing).y, p.w, p.h)){
      startClimb(p, 1, p.hang.cx, p.hang.cy, p.facing, 'ledge'); return;
    }
  }
  if (inp.upPressed || inp.upHeld){
    if (p.hang.kind === 'lad'){ startClimb(p, 1, p.hang.cx, p.hang.cy, p.facing, 'lad'); return; }
    var sb = standBox(p.hang.cx, p.hang.cy, p.facing);
    if (rectFree(sb.x, sb.y, p.w, p.h)){ startClimb(p, 1, p.hang.cx, p.hang.cy, p.facing, 'ledge'); return; }
  }
  if (inp.downPressed){ releaseHang(p, 0); return; }
  if (away) releaseHang(p, away);
}
export function ease(t){ return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; }
export function updateClimb(S, p, dt){
  var cl = p.climb;
  cl.p += dt / cl.dur;
  if (cl.p >= 1){
    p.x = cl.to.x; p.y = cl.to.y; p.vx = 0; p.vy = 0; p.apexY = p.y;
    if (cl.dir > 0 && cl.kind === 'lad'){
      var lc = Math.floor((p.x + p.w/2) / T);
      p.hang = null; p.climb = null;
      var lr = Math.floor((p.y + p.h/2) / T);
      attach(p, tileAt(lc, lr) || LADW, lc, 0, 0);
      p.lad.tc = lc; p.lad.tr = lr;
    } else if (cl.dir > 0){
      p.state = 'normal'; p.onGround = true; p.coyote = C.COYOTE; p.landT = 0.08;
      p.hang = null; p.climb = null; p.events.push('mantled');
    } else {
      p.state = 'hang'; p.hang = { cx: cl.cx, cy: cl.cy, kind: 'ledge',
        tc: Math.floor((cl.facing > 0 ? cl.cx : cl.cx - 1) / T), tr: Math.floor(cl.cy / T) };
      p.hang.lt = tileAt(p.hang.tc, p.hang.tr);
      p.climb = null; p.grabCd = 0; p.events.push('hanged');
    }
    return;
  }
  var t = ease(cl.p);
  p.x = cl.from.x + (cl.to.x - cl.from.x) * t;
  p.y = cl.from.y + (cl.to.y - cl.from.y) * t;
}

/* --- лестницы --- */
export function ladKindAt(px, py){
  var v = tileAt(Math.floor(px/T), Math.floor(py/T));
  return isLadV(v) ? v : 0;
}
export function railOf(p){ return { x: p.x + p.w/2 + p.lad.ox, y: p.y + p.h/2 + p.lad.oy }; }
export function attach(p, kind, col, ox, oy){
  if (p.torch >= 0 && runtime.W) dropTorch(runtime.W, false);
  if (p.stance !== 0 && runtime.W) setStance(runtime.W, p, 0);   // на лестнице стоим в полный рост
  p.lastWall = 0;
  p.lad = { v: kind, col: col, dirx: kind === LADL ? -1 : 1, ph: 0, ox: ox, oy: oy,
            tc: col, tr: 0 };
  p.state = 'ladder'; p.vx = 0; p.vy = 0; p.onGround = false; p.ride = null;
  p.events.push('onladder');
}
export function tryLadder(S, p, inp){
  if (p.rollT > 0 || (p.ladCd || 0) > 0) return false;
  var up = inp.upPressed || inp.upHeld, dn = inp.downPressed || inp.downHeld;
  if (!up && !dn) return false;
  var cx = p.x + p.w/2, probes = [];
  if (p.onGround){
    if (up) probes.push([cx, p.y + 8], [cx, p.y + p.h - 4], [cx, p.y + 3]);
    if (dn){
      probes.push([cx, p.y + p.h + 3]);
      probes.push([cx + p.facing*11, p.y + p.h + 2], [cx + p.facing*11, p.y + p.h - 2]);
      if (inp.x){ var sd = inp.x > 0 ? 1 : -1;
        probes.push([cx + sd*11, p.y + p.h + 2], [cx + sd*11, p.y + p.h - 2]); }
    }
  } else {
    probes.push([cx, p.y + 8], [cx, p.y + p.h - 4], [cx, p.y + 3]);
  }
  for (var i = 0; i < probes.length; i++){
    var px = probes[i][0], py = probes[i][1], k = ladKindAt(px, py);
    if (!k) continue;
    var col = Math.floor(px / T), diag = (k === LADR || k === LADL);
    var nx = diag ? p.x : col*T + T/2 - p.w/2;
    if (!rectFree(nx, p.y, p.w, p.h)) continue;
    var row = Math.floor(py / T), ox, oy;
    if (diag){ ox = (col*T + T/2) - (nx + p.w/2); oy = (row*T + T/2) - (p.y + p.h/2); }
    else { ox = 0; oy = py - (p.y + p.h/2); if (oy > 11) oy = 11; if (oy < -11) oy = -11; }
    if (!ladKindAt(nx + p.w/2 + ox, p.y + p.h/2 + oy)) continue;
    p.x = nx;
    attach(p, k, col, ox, oy);
    p.lad.tc = col; p.lad.tr = row;
    return true;
  }
  return false;
}
export function exitTop(S, p, col, row, prefer){
  // встаём прямо на верхнюю перекладину — она держит как земля
  var ty = row*T - p.h, tx = p.x;
  if (ladderTop(col, row) && rectFree(tx, ty, p.w, p.h)){
    p.x = tx; p.y = ty; p.vx = 0; p.vy = 0;
    p.state = 'normal'; p.onGround = true; p.lad = null; p.snap = null;
    p.apexY = p.y; p.coyote = C.COYOTE; p.events.push('offladder');
    return true;
  }
  var sides = [prefer, -prefer], i, s;            // запасной вариант — на соседнюю площадку
  for (i = 0; i < 2; i++){
    s = sides[i];
    if (!solidTile(col + s, row)) continue;
    tx = (col + s)*T + T/2 - p.w/2; ty = row*T - p.h;
    if (!rectFree(tx, ty, p.w, p.h)) continue;
    p.snap = { fx: p.x, fy: p.y, tx: tx, ty: ty, p: 0, dur: C.LAD_SNAP };
    p.facing = s; p.state = 'snap'; p.lad = null; p.vx = 0; p.vy = 0;
    p.events.push('offladder');
    return true;
  }
  return false;
}
export function updateLadder(S, p, dt, inp){
  var L = p.lad, diag = (L.v === LADR || L.v === LADL);
  if (inp.jumpPressed){
    p.state = 'normal'; p.lad = null; p.vy = C.JUMP * 0.84;
    p.vx = inp.x * 92; p.jumping = true; p.apexY = p.y;
    if (inp.x) p.facing = inp.x > 0 ? 1 : -1;
    p.events.push('jump'); return;
  }
  if (!diag && Math.abs(inp.x) > 0.6 && !inp.upHeld && !inp.downHeld){
    var sx = inp.x > 0 ? 1 : -1, tx = p.x + sx*3;
    if (rectFree(tx, p.y, p.w, p.h)){
      p.x = tx; p.state = 'normal'; p.lad = null; p.facing = sx;
      p.vx = sx*95; p.vy = -70; p.apexY = p.y; p.events.push('offladder');
      return;
    }
  }
  var up;
  if (diag){
    // по диагонали ходим влево-вправо: вправо-вверх для LADR, и наоборот
    var hx = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
    up = hx !== 0 ? hx * L.dirx : ((inp.upHeld ? 1 : 0) - (inp.downHeld ? 1 : 0));
  } else {
    up = (inp.upHeld ? 1 : 0) - (inp.downHeld ? 1 : 0);
  }
  if (up !== 0){
    var sp = C.LAD_V * dt, nx = p.x, ny = p.y;
    if (diag){ nx += L.dirx * up * sp * 0.72; ny -= up * sp * 0.72; }
    else ny -= up * sp;
    if (!rectFree(nx, ny, p.w, p.h)){
      if (up > 0) exitTop(S, p, L.tc, L.tr, diag ? L.dirx : (inp.x ? (inp.x > 0 ? 1 : -1) : p.facing));
    } else {
      var rx = nx + p.w/2 + L.ox, ry = ny + p.h/2 + L.oy;
      var move = false, drop = false;
      if (diag){
        var proj = ((rx - (L.tc*T + T/2)) * L.dirx + ((L.tr*T + T/2) - ry)) * 0.7071;
        move = true;
        if (proj > 11.3){
          if (ladderTile(L.tc + L.dirx, L.tr - 1)){ L.tc += L.dirx; L.tr -= 1; }
          else { move = false; exitTop(S, p, L.tc, L.tr, L.dirx); }
        } else if (proj < -11.3){
          if (ladderTile(L.tc - L.dirx, L.tr + 1)){ L.tc -= L.dirx; L.tr += 1; }
          else { move = false; drop = true; }
        }
      } else {
        L.tr = Math.floor(ry / T);
        if (ladKindAt(rx, ry)) move = true;
        else if (up > 0) exitTop(S, p, L.tc, Math.floor((p.y + p.h/2 + L.oy) / T),
                                 inp.x ? (inp.x > 0 ? 1 : -1) : p.facing);
        else drop = true;
      }
      if (move){ p.x = nx; p.y = ny; L.ph += sp * 0.17; }
      else if (drop){
        if (rectFree(nx, ny, p.w, p.h)){ p.x = nx; p.y = ny; }
        for (var sn = 1; sn <= 10; sn++){          // земля почти под ногами — просто встаём
          if (!rectFree(p.x + 1, p.y + p.h + sn, p.w - 2, 1)){ p.y += sn - 1; break; }
        }
        if (grounded(S, p) || !rectFree(p.x, p.y + 2, p.w, p.h)){
          p.y = Math.floor((p.y + p.h + 2)/T)*T - p.h;
          p.state = 'normal'; p.onGround = true; p.lad = null; p.apexY = p.y;
          p.coyote = C.COYOTE; p.events.push('offladder');
        } else {
          var bc = L.tc, br = L.tr;
          while (br > 0 && !ladderTile(bc, br)) br--;
          var f = solidTile(bc + 1, br) ? 1 : (solidTile(bc - 1, br) ? -1 : p.facing);
          p.lad = null; grabTo(p, bc*T + T/2, (br + 1)*T, f, 'lad', bc, br);
        }
      }
    }
  }
  if (p.state === 'ladder' && grounded(S, p, true) && up < 0){
    p.state = 'normal'; p.onGround = true; p.lad = null; p.apexY = p.y;
    p.coyote = C.COYOTE; p.events.push('offladder');
  }
}
