import { T, C, LADR, LADL, LADW } from './constants.js';
import { runtime } from './runtime.js';
import {
  tileAt, rectFree, solidAt, isSlopeV, slopeTop, slopeGrade, isLadV, ladderTop,
  isBarV, ladderTile, solidTile, tileBlocks, isWaterV, groundYAt
} from './map.js';
import { dropTorch } from '../entities/torches.js';
import { platUnder } from '../entities/plats.js';
import { breakTalk } from '../speech/runtime.js';
import { heroGrabOffset, heroGrabWorld, heroHandY, heroBoxAnim } from './sprite-grab.js';
import { getAnimBox } from './spriteset.js';

/* ---------------- игрок ---------------- */
export function mkPlayer(){
  var sx = runtime.LV.spawn.x, sy = runtime.LV.spawn.y;
  var box = getAnimBox('hero', 'idle');
  return {
    x: sx, y: sy, w: box.w, h: box.h, vx: 0, vy: 0, facing: 1,
    state: 'normal', onGround: true, jumping: false, sliding: 0,
    coyote: 0, buf: 0, grabCd: 0, lock: 0, landT: 0, rollT: 0, rollCd: 0, stunT: 0,
    apexY: sy, fell: 0, ride: null, hang: null, climb: null, lad: null,
    rollAng: 0, torch: -1, walking: false, warp: null,
    lastWall: 0, stick: false, helmet: false, shield: false, shieldCd: 0,
    scuba: false, flippers: false, harpoonGun: false, hand: 'weapon',
    gear: { weapon:null, shield:null, helmet:null }, spare: [], bashT: 0,
    atkT: 0, atkCd: 0, hurtCd: 0, snap: null, pickT: 0, pickPend: null, pickWall: false, throwT: 0, throwPend: false, bowT: 0, bowReady: false,
    grapple: null, harpoonCd: 0,
    stance: 0, bars: null, ladCd: 0, inWater: false, wading: false,
    atSurface: false, swimSurf: null, swimAng: 0, wasWet: false, bubT: 0,
    air: C.AIR_MAX, swimLaunch: 0, stam: C.STAM_MAX, dashT: 0,
    stanceT: 0, stanceFrom: 0, lookUp: 0, pushWall: false,
    gapCrawl: false, edgeHoldT: 0,
    recoverSt: 0, knockedOut: false, gettingUp: false, getupT: 0,
    events: []
  };
}
export function resetPlayer(S){
  var had = S.p ? S.p.stick : false;
  var hadH = S.p ? S.p.helmet : false, hadS = S.p ? S.p.shield : false;
  var hadSc = S.p ? S.p.scuba : false, hadF = S.p ? S.p.flippers : false, hadHp = S.p ? S.p.harpoonGun : false;
  var hadHand = S.p ? S.p.hand : 'weapon';
  if (S.torches) for (var i = 0; i < S.torches.length; i++) S.torches[i].held = false;
  var np = mkPlayer();
  np.x = S.respawn.x; np.y = S.respawn.y; np.apexY = np.y; np.onGround = true;
  np.stick = had; np.helmet = hadH; np.shield = hadS;
  np.scuba = hadSc; np.flippers = hadF; np.harpoonGun = hadHp;
  np.hand = hadHand;
  if (S.p){ np.gear = S.p.gear; np.spare = S.p.spare; }
  S.p = np;
}

export function footCenterX(p){ return p.x + p.w * 0.5; }

/* опора = центр текущей коробки (поза / ящик из редактора), не край AABB */
function footSupported(p){
  var cx = footCenterX(p);
  return solidAt(cx, p.y + p.h) || solidAt(cx, p.y + p.h + 1);
}

/* свес: центр уже в воздухе — плитки ряда ступней не держат и не толкают назад */
function rectFreeExceptFootLip(x, y, w, h, cx){
  var c0 = Math.floor(x / T), c1 = Math.floor((x + w - 1) / T);
  var r0 = Math.floor(y / T), r1 = Math.floor((y + h - 1) / T);
  var footRow = Math.floor((y + h - 1) / T);
  var centerOn = solidAt(cx, y + h - 1) || solidAt(cx, y + h);
  var r, c;
  for (r = r0; r <= r1; r++){
    for (c = c0; c <= c1; c++){
      if (!tileBlocks(c, r, y, h, x, w)) continue;
      if (!centerOn && r === footRow) continue;
      return false;
    }
  }
  return true;
}

/* стена для слайда: 2px сбоку или нахлёст после свеса (центр уже в воздухе) */
export function wallSlideDir(p){
  if (rectFree(p.x, p.y, p.w, p.h)){
    if (!rectFree(p.x + 2, p.y, p.w, p.h)) return 1;
    if (!rectFree(p.x - 2, p.y, p.w, p.h)) return -1;
    return 0;
  }
  var right = !rectFree(p.x + p.w - 2, p.y, 2, p.h);
  var left = !rectFree(p.x, p.y, 2, p.h);
  if (right && !left) return 1;
  if (left && !right) return -1;
  return 0;
}
export function unstickFromWall(p, sd){
  if (!sd || rectFree(p.x, p.y, p.w, p.h)) return;
  if (sd > 0) p.x = Math.floor((p.x + p.w) / T) * T - p.w;
  else p.x = Math.floor(p.x / T) * T + T;
}

export function snapFeet(p){
  var cx = footCenterX(p), feet = p.y + p.h, gy;
  gy = groundYAt(cx, feet);
  if (gy == null) gy = groundYAt(cx, feet + 4);
  if (gy != null) p.y = gy - p.h;
}

export function moveX(S, p, dx){
  var oy = p.y, cx, k;
  p.x += dx;
  if (!rectFree(p.x, p.y, p.w, p.h)){
    cx = footCenterX(p);
    if (p.vy < 48 && (footSupported(p) || slopeUnderAt(p, cx) !== null)){
      for (k = 1; k <= 3; k++){
        if (rectFree(p.x, p.y - k, p.w, p.h)){ p.y -= k; return; }
      }
    }
    if (rectFreeExceptFootLip(p.x, p.y, p.w, p.h, cx)) return;
    p.y = oy;
    if (dx > 0) p.x = Math.floor((p.x + p.w) / T) * T - p.w;
    else        p.x = Math.floor(p.x / T) * T + T;
    p.vx = 0;
  }
}
export function moveY(S, p, dy){
  var oldB = p.y + p.h;
  var prevVy = p.vy;
  var cx, gy, i, q;
  p.y += dy;
  if (!rectFree(p.x, p.y, p.w, p.h)){
    if (dy > 0){
      cx = footCenterX(p);
      gy = groundYAt(cx, oldB + 1);
      if (gy == null) gy = groundYAt(cx, p.y + p.h);
      if (gy != null && oldB <= gy + 2 && p.y + p.h >= gy){
        p.y = gy - p.h; p.onGround = true; p.vy = 0; p.ride = null;
        return;
      }
      return;
    }
    p.y = Math.floor(p.y / T) * T + T;
    if (prevVy < -36) p.events.push('bonk:' + Math.round(-prevVy));
    p.vy = 0; p.ride = null;
    return;
  }
  if (dy > 0){                                  // односторонние движущиеся платформы
    cx = footCenterX(p);
    for (i = 0; i < S.plats.length; i++){
      q = S.plats[i];
      if (cx > q.x && cx < q.x + q.w && oldB <= q.y + 1 && p.y + p.h >= q.y){
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
  var c = Math.floor(footCenterX(p) / T);
  var r = Math.floor(probeY / T);
  if (ladderTop(c, r) && probeY >= r*T - 1 && probeY <= r*T + 7) return r*T;
  return null;
}
export function slopeUnderAt(p, px){
  var c = Math.floor(px / T), r = Math.floor((p.y + p.h + 1) / T);
  var k, v, sy, best = null;
  for (k = -1; k <= 1; k++){
    v = tileAt(c, r + k);
    if (!isSlopeV(v)) continue;
    sy = (r + k)*T + slopeTop(v, c, px);
    if (p.y + p.h >= sy - 12 && p.y + p.h <= sy + 20)
      if (best === null || sy < best) best = sy;
  }
  return best;
}
export function slopeUnder(p){
  // 3 пробы — шаг по лесенке скосов; падение с края смотрит только центр коробки
  var best = null, i, sy, px;
  for (i = 0; i <= 2; i++){
    px = p.x + 1 + (p.w - 2) * (i / 2);
    sy = slopeUnderAt(p, px);
    if (sy !== null && (best === null || sy < best)) best = sy;
  }
  return best;
}
export function slopeGradeUnder(p){
  var px = footCenterX(p);
  var c = Math.floor(px / T), r = Math.floor((p.y + p.h + 1) / T);
  for (var k = -1; k <= 1; k++){
    var v = tileAt(c, r + k);
    if (!isSlopeV(v)) continue;
    var sy = (r + k)*T + slopeTop(v, c, px);
    if (p.y + p.h >= sy - 12 && p.y + p.h <= sy + 20)
      return slopeGrade(v, c, px);
  }
  return 0;
}
export function grounded(S, p, noLadTop){
  var cx = footCenterX(p);
  if (slopeUnderAt(p, cx) !== null) return true;
  if (footSupported(p)) return true;
  if (platUnder(S, { x: cx - 1, y: p.y, w: 2, h: p.h }, p.y + p.h + 1)) return true;
  if (noLadTop) return false;
  return ladderTopUnder(p, p.y + p.h + 1) !== null;
}

export function setH(p, h){ var b = p.y + p.h; p.h = h; p.y = b - h; }
export function stanceBox(st){
  if (st === 2) return getAnimBox('hero', 'prone');
  if (st === 1) return getAnimBox('hero', 'crouch');
  return getAnimBox('hero', 'idle');
}
export function stanceH(st){ return stanceBox(st).h; }
export function stanceW(st){ return stanceBox(st).w; }
export function fitHeroBox(p, w, h){
  if (!p || (p.w === w && p.h === h)) return true;
  var cx = p.x + p.w / 2, btm = p.y + p.h;
  var nx = cx - w / 2, ny = btm - h;
  if (rectFree(nx, ny, w, h)){
    p.x = nx; p.y = ny; p.w = w; p.h = h;
    return true;
  }
  if (h !== p.h && rectFree(p.x, ny, p.w, h)){
    p.y = ny; p.h = h;
    return p.w === w;
  }
  return false;
}
function forceHeroBox(p, w, h){
  var btm, cx, nx;
  if (!p) return;
  if (p.w === w && p.h === h) return;
  if (fitHeroBox(p, w, h)) return;
  btm = p.y + p.h;
  cx = p.x + p.w / 2;
  p.h = h;
  p.y = btm - h;
  if (p.w === w) return;
  nx = cx - w / 2;
  if (rectFree(nx, p.y, w, p.h)){ p.x = nx; p.w = w; }
  else if (rectFree(p.x, p.y, w, p.h)) p.w = w;
}
export function applyHeroBox(p){
  var b, st;
  if (!p) return;
  st = p.state;
  if (st === 'hang' || st === 'climb' || st === 'ladder' || st === 'bars') return;
  if (p.warp) return;
  b = getAnimBox('hero', heroBoxAnim(p));
  if (p.rollT > 0) forceHeroBox(p, b.w, b.h);
  else fitHeroBox(p, b.w, b.h);
}
export function applyRollBox(p){
  var b = getAnimBox('hero', 'roll');
  p.rollAng = 0;
  p.stanceT = 0;                               // не крутить lerp стойки внутри переката
  forceHeroBox(p, b.w, b.h);
}
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

function handOffY(p){
  var y = p ? heroGrabOffset(p).y : C.HAND;
  return y > 0 ? y : C.HAND;
}

export function hangBox(cx, cy, facing, kind, p){
  var hy = handOffY(p);
  var b = getAnimBox('hero', kind === 'lad' ? 'hangLad' : 'hang');
  var w = b.w, h = b.h, y = cy - hy;
  if (kind === 'lad') return { x: cx - w / 2, y: y, w: w, h: h };
  return { x: facing > 0 ? cx - w : cx, y: y, w: w, h: h };
}
export function standBox(cx, cy, facing){
  var b = stanceBox(0);
  return { x: cx + facing * C.STAND_OFF - b.w / 2, y: cy - b.h, w: b.w, h: b.h };
}
export function ladBox(cx, cy){
  var b = getAnimBox('hero', 'ladder');
  return { x: cx - b.w / 2, y: cy - b.h, w: b.w, h: b.h };
}
/* площадка над кромкой в стойке st: 0 стоя, 1 присед, 2 лаз */
export function landBox(cx, cy, facing, st){
  var h = stanceH(st), w = stanceW(st);
  var tileL = facing > 0 ? cx : cx - T;
  var x;
  if (w > T) x = facing > 0 ? cx : cx - w;              // лёжа шире тайла — вылезаем в тоннель
  else {
    x = cx + facing * C.STAND_OFF - w / 2;
    if (x < tileL) x = tileL;
    if (x + w > tileL + T) x = tileL + T - w;
  }
  return { x: x, y: cy - h, w: w, h: h, stance: st };
}
export function bestLand(cx, cy, facing){
  for (var st = 0; st <= 2; st++){
    var b = landBox(cx, cy, facing, st);
    if (rectFree(b.x, b.y, b.w, b.h)) return b;
  }
  return null;
}
function dryOff(p){
  p.inWater = false; p.wading = false; p.atSurface = false; p.wasWet = false;
  p.swimLaunch = 0; p.apexY = p.y;
}
function pixSolid(px, py){
  return tileBlocks(Math.floor(px / T), Math.floor(py / T), py, 1, px, 1);
}
function findLedge(p, dir, extraUp){
  var g = heroGrabWorld(p);
  var handY = g.y;
  var hx = g.x;
  var lo = -C.TOL_DN - (extraUp || 0);                    // extraUp — выше рук (берег)
  var hi = C.TOL_UP;
  var best = null, bestD = 1e9;
  for (var dy = lo; dy <= hi; dy++){
    var py = handY + dy;
    if (pixSolid(hx, py) || !pixSolid(hx, py + 2)) continue;
    var top = Math.floor((py + 2) / T) * T, wc = Math.floor(hx / T);
    var d = Math.abs(top - handY);
    if (d >= bestD) continue;
    bestD = d;
    best = {
      cx: dir > 0 ? wc * T : (wc + 1) * T,
      top: top, wc: wc, tr: Math.floor(top / T)
    };
  }
  return best;
}

export function damage(S, n, stun){
  if (S.dead) return;
  S.hp -= n;
  if (S.hp < 0) S.hp = 0;
  S.p.stunT = stun; S.p.state = 'stun'; S.p.vx = 0;
  S.p.grapple = null; S.p.harpoonCd = C.HARPOON_CD;
  S.shake = Math.min(7, 3 + n * 2); S.hitStop = 0.09;
  S.p.events.push('hurt');
  breakTalk(S, 'hit');
  if (S.hp <= 0){ S.hp = 0; S.dead = true; S.p.events.push('dead'); }
}
/* приземление: залипаем в приседе (среднее) или лёжа (высокое), без управления */
export function startFallRecover(S, p, st, dur){
  var from = p.stance;
  if (!setStance(S, p, st) && st === 2) setStance(S, p, 1);
  p.recoverSt = p.stance;
  if (p.stance !== from){ p.stanceFrom = from; p.stanceT = C.STANCE_T; }
  p.stunT = dur; p.state = 'stun'; p.vx = 0;
  p.knockedOut = p.recoverSt === 2;      // лежит без сознания — закрытые глаза, пока не начнёт вставать
}
/* после высокого падения — отдельная анимация подъёма, не мгновенный щелчок стойки */
export function finishFallRecover(S, p){
  if (!p.recoverSt) return false;
  var from = p.recoverSt;
  p.recoverSt = 0;
  if (from === 2){
    p.knockedOut = false;
    if (stanceFitsAt(p, 0)){
      p.gettingUp = true; p.getupT = C.GETUP_T;   // хитбокс лёжа до конца позы — иначе зависает в воздухе
      return true;
    }
    if (!setStance(S, p, 1)) return false;       // тесно — только в присед
    if (p.stance !== from){ p.stanceFrom = from; p.stanceT = C.STANCE_T; }
    return p.stanceT > 0;
  }
  if (!setStance(S, p, 0)) setStance(S, p, Math.min(1, from));
  if (p.stance !== from){ p.stanceFrom = from; p.stanceT = C.STANCE_T; }
  return p.stanceT > 0;
}
/* стойка растёт только когда getupPose доиграла */
export function finishGetup(S, p){
  p.gettingUp = false;
  p.getupT = 0;
  if (!setStance(S, p, 0)) setStance(S, p, 1);
}

/* --- потолочные перекладины: движение на руках --- */
export function barAt(px, py){ return isBarV(tileAt(Math.floor(px/T), Math.floor(py/T))); }
export function tryBars(S, p){
  if (p.state !== 'normal' || p.onGround || p.vy < -40 || p.grabCd > 0) return false;
  var cx = p.x + p.w/2, handY = heroHandY(p);
  for (var dy = -8; dy <= 10; dy++){
    var py = handY + dy, r = Math.floor(py / T), c = Math.floor(cx / T);
    var vv = tileAt(c, r);
    if (vv === LADR || vv === LADL){                 // диагональ снизу — как перекладины
      var dgY = (r + 1) * T;
      if (Math.abs(dgY - handY) > 10) continue;
      var dny = dgY - handOffY(p);
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
    var ny = barY - handOffY(p);
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
    var rr2 = Math.floor((ny2 + handOffY(p) - 4) / T);
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

/* соседняя платформа продолжает поверхность встык с этой стороны — значит это не край, а склейка */
function platSeam(list, q, side){
  var ex = side > 0 ? q.x + q.w : q.x;
  for (var i = 0; i < list.length; i++){
    var o = list[i];
    if (o === q || Math.abs(o.y - q.y) > 2) continue;
    if (side > 0 && Math.abs(o.x - ex) < 2) return true;
    if (side < 0 && Math.abs(o.x + o.w - ex) < 2) return true;
  }
  return false;
}
/* --- захват края / нижней перекладины --- */
export function tryGrab(S, p){
  if (p.inWater) return false;                              // под водой кромки не берём
  if (p.grabCd > 0 || p.onGround || p.state !== 'normal' || p.rollT > 0) return false;
  if (p.vy < C.GRAB_VY) return false;
  var handY = heroHandY(p), dir = p.facing, dy;

  var led = findLedge(p, dir, 0);                           // кромка уступа
  if (led){
    var hb = hangBox(led.cx, led.top, dir, 'ledge', p);
    if (rectFree(hb.x, hb.y, hb.w, hb.h)){
      grabTo(p, led.cx, led.top, dir, 'ledge', led.wc, led.tr);
      return true;
    }
  }
  for (var pi = 0; pi < runtime.W.plats.length; pi++){              // кромка движущейся платформы
    var q = runtime.W.plats[pi];
    var side = (p.x + p.w/2 < q.x + q.w/2) ? -1 : 1;
    if (side !== dir) continue;
    if (platSeam(runtime.W.plats, q, side)) continue;      // платформы встык — тут уже не край, хват не даём
    var cxq = side > 0 ? q.x + q.w : q.x;
    if (Math.abs((dir > 0 ? p.x + p.w : p.x) - cxq) > 12) continue;
    if (Math.abs(handY - q.y) > 9) continue;
    var hbq = hangBox(cxq, q.y, dir, 'ledge', p);
    if (!rectFree(hbq.x, hbq.y, hbq.w, hbq.h)) continue;
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
      var lb = hangBox(lx, bot, dir, 'lad', p);
      if (!rectFree(lb.x, lb.y, lb.w, lb.h)) continue;
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
  dryOff(p);
  var b = hangBox(cx, cy, facing, kind === 'lad' ? 'lad' : 'ledge', p);
  p.x = b.x; p.y = b.y; p.w = b.w; p.h = b.h; p.vx = 0; p.vy = 0; p.facing = facing;
  p.state = 'hang'; p.onGround = false;
  p.hang = { cx: cx, cy: cy, kind: kind, tc: tc, tr: tr, lt: tileAt(tc, tr) };
  p.events.push('grab');
}
/* с поверхности воды: к сухому берегу; подводные полки и потолок над водой — нет */
export function tryClimbOut(S, p, dir){
  if (!dir || p.state !== 'normal' || p.grabCd > 0 || p.rollT > 0) return false;
  if (!p.atSurface || !p.inWater) return false;
  var surf = p.swimSurf;
  if (surf == null || p.y > surf + 2) return false;         // голова уже ниже линии воды
  if (!rectFree(p.x + 1, surf - 4, p.w - 2, 4)) return false; // потолок над водой — остаёмся
  var led = findLedge(p, dir, T + 4);                       // с поверхности достаём губу в тайл
  if (!led || led.top > surf + 2) return false;             // кромка под водой
  var land = bestLand(led.cx, led.top, dir);
  if (land){
    var lcx = land.x + land.w / 2, lcy = land.y + land.h / 2;
    if (isWaterV(tileAt(Math.floor(lcx / T), Math.floor(lcy / T)))) return false;
    p.facing = dir;
    startClimb(p, 1, led.cx, led.top, dir, 'ledge', land);
    return true;
  }
  var hb = hangBox(led.cx, led.top, dir, 'ledge', p);
  if (!rectFree(hb.x, hb.y, hb.w, hb.h)) return false;
  grabTo(p, led.cx, led.top, dir, 'ledge', led.wc, led.tr);
  return true;
}

export function stanceFitsAt(p, st){
  var h = stanceH(st), w = stanceW(st);
  return rectFree(p.x + p.w / 2 - w / 2, p.y + p.h - h, w, h);
}
/* в щели (встать нельзя) — защёлкиваем; сбрасываем только встав или на одноразовом выходе */
export function markGap(p){
  if (p.stance > 0 && !stanceFitsAt(p, 0)) p.gapCrawl = true;
  else if (p.stance === 0) p.gapCrawl = false;
}
/* сколько пикселей вниз до опоры сразу за краем */
function dropAhead(S, p, dir){
  var px = dir > 0 ? p.x + p.w + 2 : p.x - 2;
  var y0 = p.y + p.h;
  for (var d = 1; d <= T * 8; d++){
    if (solidAt(px, y0 + d)) return d;
    var probe = { x: dir > 0 ? p.x + 4 : p.x - 4, y: p.y, w: p.w, h: p.h };
    if (platUnder(S, probe, y0 + d)) return d;
  }
  return T * 8;
}
/* конец приседа/лаза: из лёжа у края — вис если яма >1 тайла, иначе скат;
   из щели на губу — встать один раз; открытый край в приседе — слезаем в вис */
export function tryCrawlEdge(S, p, dir){
  if (!dir || p.stance <= 0 || !p.onGround) return 0;
  if (groundAhead(S, p, dir)) return 0;
  if (p.stance === 2){
    var da = dropAhead(S, p, dir);
    if (da > T + 2){
      if (tryDescend(S, p, dir)) return 2;
      return 0;                                    // обрыв: не кувыркаемся, ждём ↓
    }
    if (da > 2){
      // обрыв ~1 тайл: лёжа (PRW) в него не влезает по ширине — скатываемся кувырком,
      // сужаясь до обычной ширины переката, а не замираем на кромке
      var cxr = p.x + p.w / 2;
      p.stance = 0;
      p.x = cxr - p.w / 2;
      p.rollT = C.ROLL_T; p.facing = dir; p.vx = dir * C.ROLL_V * 0.7;
      applyRollBox(p);
      p.onGround = false;
      p.events.push('roll');
      return 2;
    }
    p.grabCd = Math.max(p.grabCd, C.GRAB_CD);          // не хватать губу, с которой скатываемся
    return 0;
  }
  if (!p.gapCrawl){
    if (tryDescend(S, p, dir)) return 2;               // присед + ход с края — слезаем
    return 0;                                          // вис некуда (ступенька) — сходим, не стопаем
  }
  if (stanceFitsAt(p, 0)){                              // пол кончился, но потолок уже открылся — встаём
    var from0 = p.stance;
    setStance(S, p, 0);
    if (p.stance !== from0){ p.stanceFrom = from0; p.stanceT = C.STANCE_T; }
    p.gapCrawl = false;
    return 1;
  }
  if (stanceFitsAt(p, 2)){                              // потолок ещё держит присед — идём ниже, в лёжа
    var from2 = p.stance;
    setStance(S, p, 2);
    if (p.stance !== from2){ p.stanceFrom = from2; p.stanceT = C.STANCE_T; }
    return 1;
  }
  if (tryDescend(S, p, dir)) return 2;
  return -1;
}
function findDescend(p, want){
  var gy = Math.floor((p.y + p.h + 2) / T) * T;
  // если у края вплотную стоит лестница — кромка не работает, уходим на лестницу
  var lc0 = Math.floor((p.x + p.w/2) / T), lr0 = Math.floor((gy + 2) / T);
  if (ladderTile(lc0, lr0) || ladderTile(lc0 - 1, lr0) || ladderTile(lc0 + 1, lr0)) return null;
  var order = want ? [want, -want] : [p.facing, -p.facing];
  for (var i = 0; i < order.length; i++){
    var dir = order[i], col = -1;
    for (var d = 2; d <= 16; d += 2){
      var px = dir > 0 ? p.x + p.w - 1 + d : p.x - d;
      if (!solidAt(px, gy + 2)){ col = Math.floor(px / T) - dir; break; }
    }
    if (col < 0 || !solidTile(col, Math.floor((gy + 2) / T))) continue;
    var midX = p.x + p.w / 2;
    // опора = центр коробки: достаточно стоять на последнем тайле.
    // midTile отсекал лёжа (PRW>T/2) — губа уже под телом, центр ещё до середины
    if (Math.floor(midX / T) !== col) continue;
    var cx = dir > 0 ? (col + 1) * T : col * T, f = -dir;
    var hb = hangBox(cx, gy, f, 'ledge', p);
    if (!rectFree(hb.x, hb.y, hb.w, hb.h)) continue;       // вис — коробка hang
    return { cx: cx, gy: gy, facing: f, drop: dir };
  }
  return null;
}
export function canDescend(p, want){
  return !!findDescend(p, want);
}
/* держат ход от обрыва — не спускаться (лаз лёжа от края) */
export function awayFromEdge(p, ax){
  if (!ax) return false;
  var d = findDescend(p, 0);
  return !!(d && ax * d.drop < 0);
}
/* --- спуск спиной с края --- */
export function tryDescend(S, p, want){
  var d = findDescend(p, want);
  if (!d) return false;
  startClimb(p, -1, d.cx, d.gy, d.facing, 'ledge');
  p.climb.keepAx = d.drop;                            // ход в пропасть не срывает вис, пока не отпустят
  return true;
}
export function startClimb(p, dir, cx, cy, facing, kind, land){
  var from = { x: p.x, y: p.y }, to, ideal, st = 0;
  if (dir > 0 && kind === 'lad'){ to = ladBox(cx, cy); ideal = hangBox(cx, cy, facing, 'lad', p); }
  else if (dir > 0){
    if (!land) land = bestLand(cx, cy, facing);
    if (land){ to = { x: land.x, y: land.y }; st = land.stance; }
    else to = standBox(cx, cy, facing);
    ideal = hangBox(cx, cy, facing, 'ledge', p);
    // стойку жмём в конце анимации — иначе поза щёлкает сразу
  } else {
    to = hangBox(cx, cy, facing, 'ledge', p); ideal = standBox(cx, cy, facing);
    p.stance = 0; p.w = to.w; p.h = to.h;                 // с лаза в вис — коробка hang
  }
  dryOff(p);
  p.facing = facing; p.state = 'climb'; p.vx = 0; p.vy = 0; p.onGround = false;
  p.climb = { dir: dir, kind: kind, p: 0, dur: dir > 0 ? (kind === 'lad' ? C.TO_LAD : C.CLIMB_UP) : C.CLIMB_DN,
              cx: cx, cy: cy, facing: facing, from: from, to: to, stance: st,
              off: { x: from.x - ideal.x, y: from.y - ideal.y } };
  p.events.push(dir > 0 ? 'climbup' : 'climbdown');
  if (st === 1) p.events.push('crouch');
  else if (st === 2) p.events.push('prone');
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
    p.x += q.dx; p.y = q.y - handOffY(p);
  }
  var ax = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
  if (p.hang.keepAx){
    if (ax === p.hang.keepAx) ax = 0;                  // ещё держат ход, с которым слезли
    else p.hang.keepAx = 0;
  }
  var away = (ax && ax !== p.facing) ? ax : 0;
  var toward = ax === p.facing;
  if (p.hang.kind === 'lad') away = 0;
  if (inp.jumpPressed){
    if (away){                                       // прыжок спиной от стены
      p.state = 'normal'; p.hang = null; p.grabCd = C.GRAB_CD;
      p.vx = away * C.WJ_X * 0.9; p.vy = C.WJ_Y; p.facing = away;
      p.lock = C.WJ_LOCK; p.apexY = p.y; p.events.push('backjump');
      return;
    }
    if (tryClimbUp(p)) return;
  }
  if (inp.upPressed || inp.upHeld || toward){
    if (tryClimbUp(p)) return;
  }
  if (inp.downPressed){ releaseHang(p, 0); return; }
  if (away) releaseHang(p, away);
}
export function tryClimbUp(p){
  if (p.hang.kind === 'lad'){ startClimb(p, 1, p.hang.cx, p.hang.cy, p.facing, 'lad'); return true; }
  var land = bestLand(p.hang.cx, p.hang.cy, p.facing);
  if (!land) return false;
  startClimb(p, 1, p.hang.cx, p.hang.cy, p.facing, 'ledge', land);
  return true;
}
export function ease(t){ return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; }
export function updateClimb(S, p, dt){
  var cl = p.climb;
  cl.p += dt / cl.dur;
  if (cl.p >= 1){
    p.x = cl.to.x; p.y = cl.to.y; p.vy = 0; p.apexY = p.y;
    p.vx = 0;
    if (cl.dir > 0 && cl.kind === 'lad'){
      var lc = Math.floor((p.x + p.w/2) / T);
      p.hang = null; p.climb = null;
      var lr = Math.floor((p.y + p.h/2) / T);
      attach(p, tileAt(lc, lr) || LADW, lc, 0, 0);
      p.lad.tc = lc; p.lad.tr = lr;
    } else if (cl.dir > 0){
      if (cl.stance > 0){
        p.stanceFrom = 0; p.stance = cl.stance;
        p.w = stanceW(cl.stance); p.h = stanceH(cl.stance);
        p.stanceT = C.STANCE_T;
        p.gapCrawl = true;
      }
      p.state = 'normal'; p.onGround = true; p.coyote = C.COYOTE; p.landT = 0.08;
      p.hang = null; p.climb = null; p.events.push('mantled');
    } else {
      p.state = 'hang'; p.hang = { cx: cl.cx, cy: cl.cy, kind: 'ledge',
        tc: Math.floor((cl.facing > 0 ? cl.cx : cl.cx - 1) / T), tr: Math.floor(cl.cy / T),
        keepAx: cl.keepAx || 0 };
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
