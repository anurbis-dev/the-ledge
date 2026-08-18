import GAME from '../core/game.js';
import {
  cv, ctx, VW, VH, cam, view,
  sky, tiles, tilesFront, plats, lifts, caveExit, doors, chests, boulders, npcs,
  lootDrops, items, pickables, drawTorches, drawHarpoons, drawArrows, enemies, spiders, fliers, tendrils,
  hero, lightPass, drawWeeds, drawFish, drawParts, drawHearts,
  vignette, hud, drawIntro, drawPaused, drawOutro, drawDead, drawBubbles, hudHitsWeapon,
  applyPal, buildWater, stepWater, invalidateAll, fore, rc, getFish, spark, landDust, bonkDust, clampCam,
  setViewScale, applyVolumes, drawCollideOverlay,
  isInvOpen, invInspecting, openInv, closeInv, toggleInv, stepInv, drawInventory, handleInvPointer, handleInvKey,
  clientToGame, hitsHero
} from '../render/index.js';
import { blip, liftSound, hushLift, hushSounds, stepSounds } from '../audio/sfx.js';
import { startMusic, hushMusic, resumeMusic, musicPlaying, getMix, setScore, listScores, playMusic, pauseMusic, seekMusic, getTransport, musicHeld, musicArmed } from '../audio/music.js';
import { held, latch, ax, stick, bindInput } from '../input/input.js';
import { ED, edOpen, edClose, edApply, edExportText, edDrawOverlay, bindEditor, snapEditCam, syncDelBtn } from '../editor/editor.js';
import { hooks } from '../core/runtime.js';
import { prog, buildMenu, showMenu, showMenuHome, menuScreen, isMenu, setMenu, saveProgress, dropProgressAt, applyBootSettings } from '../ui/menu.js';
import { showSplash } from '../ui/splash.js';
import { findById } from '../entities/ids.js';
import { cycleHand } from '../entities/gear.js';
import { entitiesShown } from '../core/layers.js';
import { hydrateAll } from '../core/persist.js';
import { speechBlocks } from '../speech/runtime.js';

import { clearHistory, undoOp, redoOp, canUndo, canRedo } from '../editor/history.js';

var G = GAME;
hooks.onGrowMap = function(){ invalidateAll(); buildWater(); };
var S = null;
var paused = false, introT = 0, outro = null, gameOver = null;
var canResume = false;
var parts = view.parts, hearts = view.hearts;

function setS(w){ S = w; G.W = w; }
function setOutro(o){ outro = o; view.outro = o; }
var dbgOn = false, dbgEl = null;
var acc = 0, last = 0, STEP = 1/60;
var inp = { x:0, jumpHeld:false, jumpPressed:false, upHeld:false, upPressed:false, downHeld:false, downPressed:false, actPressed:false };

function onEvent(ev){
  var p = S.p, k = ev.split(':')[0];
  if (k === 'jump') { blip(430, 0.08); spark(p.x+5, p.y+p.h, 4, '#b9b2e6'); }
  else if (k === 'walljump' || k === 'backjump'){ blip(500, 0.09); spark(p.x+5, p.y+12, 7, '#cfc6ff', 90); }
  else if (k === 'land'){ blip(160, 0.06); }
  else if (k === 'hardland'){ blip(90, 0.2, 'sawtooth', 0.06); spark(p.x+5, p.y+p.h, 10, '#ffbba0', 110, 50); }
  else if (k === 'rollland' || k === 'roll'){ blip(240, 0.09, 'triangle'); spark(p.x+5, p.y+p.h, 6, '#d6cdb0', 90); }
  else if (k === 'landdust'){ landDust(p, +ev.split(':')[1] || 0); }
  else if (k === 'bonk'){
    var bSpd = +ev.split(':')[1] || 80;
    bonkDust(p, bSpd);
    if (p.helmet) blip(360, 0.07, 'square', 0.04);
    else blip(130, 0.09, 'sine', 0.045);
    if (bSpd > 150) S.shake = Math.max(S.shake, 1);
  }
  else if (k === 'grab'){ blip(720, 0.06); spark(p.hang.cx, p.hang.cy, 6, '#ffe08a', 60); }
  else if (k === 'mantled'){ blip(640, 0.09, 'triangle'); }
  else if (k === 'hanged' || k === 'onladder'){ blip(520, 0.05); }
  else if (k === 'release' || k === 'offladder'){ blip(280, 0.05); }
  else if (k === 'spark'){ spark(p.x + (p.sliding>0?p.w:0), p.y+14, 2, '#ffd9a0', 30, 10); }
  else if (k === 'swing'){ blip(300, 0.09, 'triangle', 0.045); }
  else if (k === 'kill'){
    blip(160, 0.16, 'sawtooth', 0.05);
    var tag = ev.split(':')[1] || '', vic;
    if (tag.charAt(0) === 'f') vic = findById(S.fliers, +tag.slice(1));
    else if (tag.charAt(0) === 's') vic = findById(S.spiders, +tag.slice(1));
    else if (tag.charAt(0) === 't') vic = findById(S.tendrils, +tag.slice(1));
    else vic = findById(S.enemies, +tag);
    if (vic){
      var vx = vic.tx !== undefined ? vic.tx : vic.x + (vic.w || 0) / 2;
      var vy = vic.ty !== undefined ? vic.ty : vic.y + (vic.h || 0) / 2;
      spark(vx, vy, 14, '#c79ae0', 110, 70);
    }
  }
  else if (k === 'getstick'){ blip(700, 0.16, 'triangle'); view.flash = 0.4; }
  else if (k === 'getkey'){ blip(880, 0.18, 'triangle'); view.flash = 0.4; }
  else if (k === 'locked'){ blip(140, 0.12, 'square', 0.05); S.shake = Math.max(S.shake, 2); }
  else if (k === 'unlock'){ blip(760, 0.22, 'triangle'); view.flash = 0.5; }
  else if (k === 'door'){ blip(360, 0.2, 'sine', 0.05); view.flash = 0.75; }
  else if (k === 'walljumpweak'){ blip(330, 0.07); spark(p.x+5, p.y+12, 3, '#9d95c9', 50); }
  else if (k === 'liftstop'){ blip(300, 0.12, 'sine', 0.05); blip(220, 0.16, 'sine', 0.04); }
  else if (k === 'liftcall'){ blip(520, 0.08, 'sine', 0.045); }
  else if (k === 'crouch'){ blip(190, 0.05, 'sine', 0.03); }
  else if (k === 'prone'){ blip(140, 0.07, 'sine', 0.035); }
  else if (k === 'stand'){ blip(260, 0.05, 'sine', 0.03); }
  else if (k === 'grabbar'){ blip(600, 0.06, 'triangle'); spark(p.x+5, p.y+2, 4, '#d0b98a', 40); }
  else if (k === 'bomb'){ blip(400, 0.05, 'square', 0.03); }
  else if (k === 'splat'){ blip(130, 0.06, 'sawtooth', 0.03); }
  else if (k === 'hitdrop'){ blip(110, 0.2, 'sawtooth', 0.06); view.flash = 0.4; }
  else if (k === 'burn'){
    blip(200, 0.22, 'sawtooth', 0.06); view.flash = 0.45;
    var pr = ev.split(':');
    if (pr[1] && pr[1].charAt(0) === 'f'){ var fv = findById(S.fliers, +pr[1].slice(1));
      if (fv) spark(fv.x + fv.w/2, fv.y, 18, '#ffd06a', 130, 80); }
    if (pr.length >= 4){
      var bxr = +pr[2], byr = +pr[3];
      spark(bxr, byr - 6, 22, '#ffd06a', 150, 90);
      spark(bxr, byr - 6, 10, '#ff7a3d', 110, 60);
    }
  }
  else if (k === 'doorout'){ view.warpJump = true; }
  else if (k === 'lostdark'){ blip(90, 0.35, 'sine', 0.05); view.flash = 0.2; }
  else if (k === 'snuff'){ blip(150, 0.2, 'sine', 0.05); spark(p.x+5, p.y+12, 10, '#6b6270', 60); }
  else if (k === 'stomp'){ blip(260, 0.09, 'square'); spark(p.x+5, p.y+p.h, 10, '#e0d0ff', 90); }
  else if (k === 'snap'){ blip(210, 0.05, 'sawtooth', 0.03); }
  else if (k === 'torchland'){ var tL = findById(S.torches, +ev.split(':')[1]);
    if (tL) spark(tL.x, tL.y, 6, '#ffb060', 70); }
  else if (k === 'torchtrail'){ var tT = findById(S.torches, +ev.split(':')[1]);
    if (tT && Math.random() < 0.6) spark(tT.x, tT.y - 6, 1, '#ffcf7a', 24, 8); }
  else if (k === 'chest'){
    var kind2 = ev.split(':')[1];
    blip(kind2 === 'helmet' || kind2 === 'shield' ? 880 : 700, 0.22, 'triangle');
    view.flash = 0.45; spark(p.x+5, p.y+8, 14, '#ffe9a8', 90, 60);
  }
  else if (k === 'chestlocked'){ blip(140, 0.12, 'square', 0.05); S.shake = Math.max(S.shake, 2); }
  else if (k === 'clank'){ blip(520, 0.07, 'square', 0.05); spark(p.x+5, p.y, 5, '#cfe0ff', 60); }
  else if (k === 'bash'){ blip(300, 0.09, 'square', 0.05); spark(p.x+5, p.y+10, 8, '#ffd08a', 90); }
  else if (k === 'splash'){
    blip(300, 0.12, 'sine', 0.05);
    var sy5 = p.swimSurf !== null ? p.swimSurf : p.y;
    for (var q5 = 0; q5 < 16; q5++)
      parts.push({ x: p.x + 5 + (Math.random()-0.5)*14, y: sy5,
                   vx: (Math.random()-0.5)*110, vy: -40 - Math.random()*90,
                   t: 0.35 + Math.random()*0.3, c: '#bfe6ff', g: 260 });
  }
  else if (k === 'bubble'){
    var bn = Math.random() < 0.28 ? 2 : 1;
    for (var bi = 0; bi < bn; bi++){
      var bsz = Math.random() < 0.12 ? 3 : (Math.random() < 0.48 ? 2 : 1);
      var spd = 8 + Math.random() * 52;
      parts.push({
        x: p.x + 5 + (Math.random() - 0.5) * 10,
        y: p.y + 3 + Math.random() * 10,
        vx: (Math.random() - 0.5) * (6 + Math.random() * 18),
        vy: -spd,
        t: 0.45 + Math.random() * 0.95 + bsz * 0.12,
        c: bsz > 2 ? '#e8f6ff' : '#cfeaff',
        g: -6 - Math.random() * 24,
        sz: bsz, kind: 'bubble',
        wob: 10 + Math.random() * 22,
        top: (p.bubTop !== undefined && p.bubTop !== null) ? p.bubTop : null
      });
    }
  }
  else if (k === 'stroke'){
    blip(240, 0.07, 'sine', 0.04);
    for (var q6 = 0; q6 < 6; q6++)
      parts.push({ x: p.x + 5 + (Math.random()-0.5)*10, y: p.y + 14,
                   vx: (Math.random()-0.5)*40, vy: 20 + Math.random()*30,
                   t: 0.4, c: '#9fd0ef', g: -10 });
  }
  else if (k === 'loot'){ blip(560, 0.06, 'triangle', 0.035); }
  else if (k === 'pickloot'){ blip(760, 0.07, 'triangle'); }
  else if (k === 'gasp'){ blip(420, 0.1, 'sine', 0.04); }
  else if (k === 'lowair'){ blip(240, 0.06, 'sine', 0.05); }
  else if (k === 'drown'){ blip(120, 0.3, 'sine', 0.06); view.flash = 0.4; }
  else if (k === 'dive'){ blip(620, 0.1, 'sawtooth', 0.045); }
  else if (k === 'peck'){ blip(180, 0.16, 'sawtooth', 0.06); view.flash = 0.35; }
  else if (k === 'thud'){
    blip(90, 0.2, 'sawtooth', 0.06); S.shake = Math.max(S.shake, 3);
    var fv2 = findById(S.fliers, +ev.split(':')[1]);
    if (fv2) spark(fv2.x + fv2.w/2, fv2.y + fv2.h, 12, '#a08a70', 90, 50);
  }
  else if (k === 'revive'){ blip(500, 0.1, 'triangle', 0.04); }
  else if (k === 'gear'){ blip(820, 0.2, 'triangle'); view.flash = 0.4; }
  else if (k === 'broke'){
    blip(160, 0.24, 'sawtooth', 0.06); S.shake = Math.max(S.shake, 3);
    spark(p.x + 5, p.y + 10, 12, '#cfc6ff', 110, 60);
  }
  else if (k === 'take'){ blip(660, 0.07, 'triangle'); }
  else if (k === 'throw'){ blip(340, 0.08); spark(p.x+5, p.y+14, 5, '#ffb060', 70); }
  else if (k === 'harpoon'){
    var hSub = ev.split(':')[1];
    if (hSub === 'shoot'){ blip(380, 0.09, 'square', 0.05); spark(p.x+5+p.facing*8, p.y+p.h/2, 4, '#c9d4dc', 60); }
    else if (hSub === 'hook'){ blip(220, 0.08, 'square', 0.05); spark(p.x+5, p.y+8, 5, '#c9d4dc', 50); }
    else if (hSub === 'release'){ blip(300, 0.07, 'triangle', 0.035); }
    else { blip(700, 0.08, 'triangle'); }
  }
  else if (k === 'swap'){ blip(640, 0.07, 'triangle', 0.04); }
  else if (k === 'tank'){ blip(500, 0.14, 'sine', 0.045); view.flash = 0.25; }
  else if (k === 'kelpsting'){ blip(180, 0.16, 'sawtooth', 0.06); view.flash = 0.3; spark(p.x+5, p.y+10, 8, '#c9de6a', 80); }
  else if (k === 'kelpwrap'){ blip(140, 0.2, 'sine', 0.05); S.shake = Math.max(S.shake, 2); spark(p.x+5, p.y+10, 10, '#4a8a7a', 70); }
  else if (k === 'kelphold'){ blip(90, 0.12, 'sine', 0.04); }
  else if (k === 'kelprelease'){ blip(280, 0.1, 'triangle', 0.04); spark(p.x+5, p.y+8, 6, '#8fd0b0', 50); }
  else if (k === 'kelpreach' || k === 'kelpstir'){ blip(210, 0.06, 'sine', 0.03); }
  else if (k === 'webcut'){ blip(480, 0.08, 'triangle', 0.04); spark(p.x+5, p.y, 6, '#d8e4f0', 50); }
  else if (k === 'spiderfall'){ blip(160, 0.1, 'sawtooth', 0.04); }
  else if (k === 'spiderflee'){ blip(220, 0.07, 'sine', 0.03); }
  else if (k === 'droptorch'){ blip(220, 0.06); }
  else if (k === 'crack'){ blip(120, 0.05, 'sawtooth'); }
  else if (k === 'crumble'){ blip(70, 0.25, 'sawtooth', 0.05); }
  else if (k === 'plankburn'){ blip(300, 0.08, 'sawtooth', 0.04); }
  else if (k === 'plankgone'){ blip(70, 0.22, 'sawtooth', 0.05); }
  else if (k === 'bouldland'){ blip(90, 0.15, 'square', 0.05); }
  else if (k === 'hurt'){
    blip(120, 0.25, 'sawtooth', 0.07); view.flash = 0.5;
    hearts.push({ x: p.x + p.w/2, y: p.y + 6, vx: (p.facing > 0 ? -1 : 1) * (30 + Math.random()*30),
                  vy: -110 - Math.random()*40, t: 1.1 });
  }
  else if (k === 'dead'){ blip(70, 0.45, 'sine', 0.08); view.flash = 0.35; }
  else if (k === 'respawn'){ blip(300, 0.3, 'sine', 0.05); view.flash = 0.9; }
  else if (k === 'pick'){
    var kind = ev.split(':')[1], it = findById(S.items, +ev.split(':')[2]);
    blip(kind==='relic'?900:(kind==='gem'?820:620), kind==='relic'?0.4:0.09, 'triangle');
    if (it) spark(it.x, it.y, kind==='relic'?26:10,
      kind==='gem'?'#9ff0ff':(kind==='shroom'?'#ffb08a':(kind==='relic'?'#f0e0ff':'#ffe9a8')), 90, 50);
    view.flash = kind==='relic' ? 0.8 : 0.25;
  }
}

function toggleDbg(){ dbgOn = !dbgOn; dbgEl.style.display = dbgOn ? 'block' : 'none'; }

function canPlayInv(){
  return !!(S && !ED.on && !isMenu() && introT <= 0 && !gameOver && !outro && !S.dead);
}

function tryToggleInv(){
  if (isInvOpen()){ closeInv(); return true; }
  if (!canPlayInv()) return false;
  openInv();
  latch.j = latch.u = latch.d = latch.a = false;
  return true;
}

function tryHeroInv(e){
  if (!canPlayInv() || isInvOpen()) return false;
  var g = clientToGame(e.clientX, e.clientY);
  if (!g || !hitsHero(g.x, g.y, S)) return false;
  openInv();
  latch.j = latch.u = latch.d = latch.a = false;
  return true;
}

function openGameMenu(){
  if (isMenu()) return;
  if (ED.on) edClose();
  closeInv(true);
  paused = true;
  canResume = !!(S && !S.dead && !gameOver && !outro);
  gameOver = null;
  showMenu();
}

function resumeGame(){
  if (!isMenu() || !canResume || !S) return false;
  setMenu(false);
  paused = false;
  introT = 0;
  return true;
}

function deleteLevelAt(idx, fromEditor){
  if (G.LEVELS.length <= 1) return;
  var lv = G.LEVELS[idx];
  if (!lv) return;
  if (!confirm('Delete "' + lv.name + '"?')) return;
  var wasCurrent = canResume && G.levelIndex() === idx;
  var inMenuNow = isMenu();
  var next = G.removeLevel(idx);
  dropProgressAt(idx);
  if (next < 0) return;
  if (wasCurrent){
    startLevel(next);
    introT = 0;
    if (fromEditor){
      if (!ED.on) edOpen();
    } else if (inMenuNow){
      showMenu();
    }
  } else if (inMenuNow){
    buildMenu();
  }
  syncDelBtn();
}

function dismissDead(){
  gameOver = null;
  closeInv(true);
  canResume = false;
  showMenu();
}
function advanceScreens(){
  if (gameOver && gameOver.t > 0.5){ dismissDead(); return true; }
  if (introT > 0){ introT = 0; return true; }
  if (outro && outro.t > 0.4){
    var nx = outro.next; setOutro(null);
    if (nx >= 0) startLevel(nx);
    else { canResume = false; showMenu(); }
    return true;
  }
  if (paused){ paused = false; return true; }
  return false;
}

function hardReset(){
  gameOver = null;
  closeInv(true);
  clearHistory();
  setS(G.mkWorld(G.levelIndex()));
  parts.length = 0; view.flash = 0.6;
  applyPal(); buildWater(); invalidateAll();
}

function startLevel(idx){
  closeInv(true);
  clearHistory();
  setS(G.mkWorld(idx));
  introT = 1;                                  // плашка с названием, игра ждёт касания
  paused = false; gameOver = null; setOutro(null);
  parts.length = 0; view.flash = 0.7; view.warpJump = true;
  cam.x = S.p.x - VW/2; cam.y = S.p.y - VH/2;
  cam.ax = S.p.x + S.p.w/2; cam.ay = S.p.y + S.p.h/2;
  applyPal(); buildWater(); invalidateAll();
  setMenu(false);
  canResume = true;
  syncDelBtn();
  startMusic();
  if (G.levelSpec() && G.levelSpec().blank){
    introT = 0;
    if (!ED.on) edOpen();
  }
}

function levelTotals(){
  var t = { coin:0, gem:0, shroom:0, chests:S.chests.length, chestsOpen:0, secrets:0, secretsFound:0 };
  for (var i = 0; i < S.items.length; i++){
    var it = S.items[i];
    if (t[it.kind] === undefined) t[it.kind] = 0;
    t[it.kind] += 1;
  }
  for (var j = 0; j < S.chests.length; j++) if (S.chests[j].opened) t.chestsOpen++;
  t.secrets = S.dark.length;
  for (var d = 0; d < S.dark.length; d++){
    var dz = S.dark[d];
    var secD = findById(S.doors, dz.doorId);
    if (secD && !secD.locked) t.secretsFound++;
  }
  return t;
}
function finishLevel(){
  var i = G.levelIndex();
  prog.done[i] = true;
  setOutro({ t: 0, totals: levelTotals(), bag: { coin:S.bag.coin, gem:S.bag.gem, shroom:S.bag.shroom },
            next: i + 1 < G.LEVELS.length ? i + 1 : -1 });
  if (i + 1 < G.LEVELS.length) prog.max = Math.max(prog.max, i + 1);
  else prog.max = Math.max(prog.max, i);
  saveProgress();
}

function isFS(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function toggleFS(){
  var el = document.documentElement;
  if (!isFS()){
    var rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq){ try { var r = rq.call(el); if (r && r.catch) r.catch(function(){}); } catch(_){} }
    if (screen.orientation && screen.orientation.lock){
      try { var l = screen.orientation.lock('landscape'); if (l && l.catch) l.catch(function(){}); } catch(_){}
    }
  } else {
    var ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex){ try { ex.call(document); } catch(_){} }
  }
  setTimeout(resize, 180);
}
function resize(){
  var land = innerWidth > innerHeight;
  var padB = ED.on ? 8 : (land ? 4 : 150);
  var s = Math.min((innerWidth - (land ? 4 : 16))/VW, (innerHeight - padB)/VH);
  s = Math.max(0.55, s);
  cv.style.width = Math.floor(VW*s) + 'px';
  cv.style.height = Math.floor(VH*s) + 'px';
}

export function getOutro(){ return outro; }

function frame(now){
  var dt = Math.min(0.2, (now - last)/1000); last = now;
  acc += dt;
  if (!ED.on && !isMenu()){ view.time += dt; view.animT += dt; }
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt*2.2);

  if (isMenu()){ acc = 0; hushLift(); hushSounds(); hushMusic(); requestAnimationFrame(frame); return; }
  if (ED.on){
    acc = 0;
    hushLift();
    if (ED.tab === 'mix'){
      if (!musicHeld() && musicArmed()) resumeMusic();
    } else hushMusic();
    view.edit = true;
    snapEditCam();
    var z = ED.zoom || 1;
    setViewScale(z);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    sky();
    ctx.setTransform(z, 0, 0, z, 0, 0);
    tiles();
    if (entitiesShown(true)){
      plats(); lifts(); caveExit(); doors(); boulders(); chests();
      lootDrops(); items(); pickables(); drawTorches(); drawHarpoons(); drawArrows(); enemies(); spiders(); fliers(); npcs();
      hero(); drawFish();
    }
    tilesFront();
    drawParts(dt); drawHearts(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    applyVolumes();
    ctx.setTransform(z, 0, 0, z, 0, 0);
    drawWeeds();
    if (entitiesShown(true)) tendrils();
    if (ED.showGeo) drawCollideOverlay();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    fore();
    vignette();
    edDrawOverlay();
    if (ED.sel && ED.sel.type === 'sound') stepSounds(S, ED.sel.obj.id);
    else hushSounds();
    requestAnimationFrame(frame);
    return;
  }
  view.edit = false;
  setViewScale(1);
  if (S.done && !outro && S.p.warp && S.p.warp.exit && S.p.warp.moved){ finishLevel(); }
  if (S.dead && !gameOver) gameOver = { t: 0 };
  if (introT > 0 || paused || outro || gameOver || isInvOpen()){
    acc = 0;
    hushLift(); hushSounds();
    if ((paused && !isInvOpen()) || outro || gameOver) hushMusic();
    else resumeMusic();
    ctx.clearRect(0, 0, VW, VH);
    sky(); tiles();
    if (entitiesShown(false)){
      plats(); lifts(); caveExit(); doors(); boulders(); chests();
      lootDrops(); items(); pickables(); drawTorches(); drawHarpoons(); drawArrows(); enemies(); spiders(); fliers(); npcs();
      hero(); drawFish();
    }
    tilesFront(); lightPass(); applyVolumes(); drawWeeds(); tendrils();
    if (ED.showGeo) drawCollideOverlay();
    fore(); vignette(); drawBubbles(); hud();
    if (introT > 0) drawIntro();
    else if (outro){ outro.t += dt; drawOutro(); }
    else if (gameOver){ gameOver.t += dt; drawDead(gameOver); }
    else if (isInvOpen()){ stepInv(dt); if (isInvOpen()) drawInventory(); }
    else drawPaused();
    requestAnimationFrame(frame);
    return;
  }

  resumeMusic();
  var first = true;
  while (acc >= STEP){
    acc -= STEP;
    var kx = (held.r?1:0) - (held.l?1:0);
    inp.x = kx !== 0 ? kx : ax;
    inp.jumpHeld = held.j; inp.upHeld = held.u || stick.up; inp.downHeld = held.d || stick.dn;
    inp.jumpPressed = first && latch.j;
    inp.upPressed = first && latch.u;
    inp.downPressed = first && latch.d;
    inp.actPressed = first && latch.a;
    if (first){ latch.j = latch.u = latch.d = latch.a = false; first = false; }
    G.step(S, STEP, inp);
    for (var e = 0; e < S.p.events.length; e++){
      try { onEvent(S.p.events[e]); }
      catch (err){ if (typeof console !== 'undefined') console.warn('событие', S.p.events[e], err); }
    }
    var p = S.p;
    if (p.onGround && Math.abs(p.vx) > 8 && p.rollT <= 0) view.runPh += Math.abs(p.vx)*STEP*0.26;
    else if (p.state !== 'normal' || p.onGround) view.runPh = 0;
    if (S.dead){
      if (!gameOver) gameOver = { t: 0 };
      acc = 0;
      break;
    }
  }

  var p2 = S.p;
  var pcx = p2.x + p2.w/2, pcy = p2.y + p2.h/2;    // мёртвая зона: якорь двигаем только за её границей
  var DZX = 10, DZY = 8;
  if (pcx - cam.ax > DZX) cam.ax = pcx - DZX; else if (pcx - cam.ax < -DZX) cam.ax = pcx + DZX;
  if (pcy - cam.ay > DZY) cam.ay = pcy - DZY; else if (pcy - cam.ay < -DZY) cam.ay = pcy + DZY;
  var tgtLead = p2.facing * 20 * (Math.abs(p2.vx) > 30 ? 1 : 0.35);
  cam.lead += (tgtLead - cam.lead) * Math.min(1, dt*3.2);
  var wantLook = speechBlocks(S) ? 0 :
                 (inp.downHeld && p2.onGround && Math.abs(p2.vx) < 10 && p2.state === 'normal') ? 44 :
                 (inp.upHeld && p2.onGround && Math.abs(p2.vx) < 10 && p2.state === 'normal' ? -30 : 0);
  cam.look += (wantLook - cam.look) * Math.min(1, dt*2.2);
  var want = clampCam(cam.ax - VW/2 + cam.lead, cam.ay - VH/2 + cam.look);
  var tx = want.x, ty = want.y;
  var kk = 1 - Math.pow(0.0015, dt);
  if (S.fade >= 0.95 || view.warpJump){ cam.x = tx; cam.y = ty; view.warpJump = false; }   // прыжок камеры под чёрным экраном
  else { cam.x += (tx - cam.x)*kk; cam.y += (ty - cam.y)*kk; }
  var shx = 0, shy = 0;
  if (S.shake > 0.05){ shx = (Math.random()-0.5)*S.shake*2; shy = (Math.random()-0.5)*S.shake*2; }
  var rcx = cam.x, rcy = cam.y;
  cam.x = Math.round(cam.x + shx); cam.y = Math.round(cam.y + shy);

  var tail = view.tail;
  var tgtTail = -p2.vx*0.016 + (p2.state === 'ladder' ? 0 : Math.sin(view.time*5.5)*0.5) - (p2.vy < -80 ? 1.2 : 0);
  tail.v += (tgtTail - tail.a)*24*dt; tail.v *= 0.9; tail.a += tail.v*dt*7;
  if (tail.a > 3) tail.a = 3; if (tail.a < -3) tail.a = -3;

  stepWater(dt);
  var anyMoving = false;
  for (var lm = 0; lm < S.lifts.length; lm++) if (S.lifts[lm].st === 'move') anyMoving = true;
  liftSound(anyMoving);
  stepSounds(S);

  ctx.clearRect(0, 0, VW, VH);
  sky();
  tiles();
  plats();
  lifts();
  caveExit();
  doors();
  boulders();
  chests();
  lootDrops();
  items();
  pickables();
  drawTorches();
  drawHarpoons();
  drawArrows();
  enemies();
  spiders();
  fliers();
  npcs();
  hero();
  drawFish();
  tilesFront();
  drawParts(dt);
  drawHearts(dt);
  lightPass();
  applyVolumes();
  drawWeeds();
  tendrils();
  if (ED.showGeo) drawCollideOverlay();
  fore();
  vignette();
  drawBubbles();
  if (gameOver){ gameOver.t += dt; drawDead(gameOver); }
  if (S.fade > 0){
    ctx.globalAlpha = Math.min(1, S.fade);
    rc(0, 0, VW, VH, '#07060f');
    ctx.globalAlpha = 1;
  }
  hud();

  cam.x = rcx; cam.y = rcy;

  if (dbgOn){
    dbgEl.textContent = 'state ' + p2.state + ' face ' + p2.facing + ' hp ' + S.hp +
      '\nx ' + p2.x.toFixed(0) + ' y ' + p2.y.toFixed(0) + ' vy ' + p2.vy.toFixed(0) +
      '\nground ' + (p2.onGround?1:0) + ' slide ' + p2.sliding + ' roll ' + p2.rollT.toFixed(2) +
      '\nax ' + inp.x.toFixed(2) + ' up ' + (inp.upHeld?1:0) + ' dn ' + (inp.downHeld?1:0) +
      '\nfell ' + p2.fell.toFixed(0);
  }
  requestAnimationFrame(frame);
}

// ?level=<индекс|имя> — для агентов/тестов: сразу нужный уровень, минуя заставку и меню
function resolveDevLevel(){
  var qp;
  try { qp = new URLSearchParams(location.search); } catch (_){ return null; }
  if (!qp.has('level')) return null;
  var v = (qp.get('level') || '').trim();
  if (!v) return 0;
  var n = +v;
  if (!isNaN(n) && v === String(n|0)) return Math.max(0, Math.min(G.LEVELS.length - 1, n|0));
  var low = v.toLowerCase();
  for (var i = 0; i < G.LEVELS.length; i++){
    if (G.LEVELS[i].name && G.LEVELS[i].name.toLowerCase() === low) return i;
  }
  return 0;
}

export function start(){
  hydrateAll(G.LEVELS);
  setS(G.mkWorld());
  dbgEl = document.getElementById('dbg');
  bindInput({
    onReset: hardReset,
    onDbg: toggleDbg,
    blocked: function(){ return isInvOpen(); },
    onHeroTap: function(e){ return tryHeroInv(e); }
  });
  bindEditor({
    onOpen: function(){ paused = false; introT = 0; },
    onNewLevel: function(){
      var idx = G.newBlankLevel();
      prog.max = Math.max(prog.max, idx);
      saveProgress();
      startLevel(idx);
      introT = 0;
      if (!ED.on) edOpen();
    },
    onDelLevel: function(){
      deleteLevelAt(G.levelIndex(), true);
    }
  });

  function tryCycleHand(){
    if (!S || ED.on || isMenu() || introT > 0 || gameOver || outro) return false;
    return cycleHand(S);
  }

  addEventListener('keydown', function(e){
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (gameOver){ if (gameOver.t > 0.5) dismissDead(); return; }
    if (e.key !== 'Escape' && handleInvKey(e.key)){
      if (e.key === 'i' || e.key === 'I') e.preventDefault();
      return;
    }
    if (e.key === 'i' || e.key === 'I'){
      e.preventDefault();
      tryToggleInv();
      return;
    }
    if (e.key === 'r' || e.key === 'R'){ hardReset(); return; }
    if (e.key === 'h' || e.key === 'H'){ toggleDbg(); return; }
    if (e.key === 'q' || e.key === 'Q'){
      e.preventDefault();
      if (tryCycleHand()){
        try { onEvent(S.p.events[S.p.events.length - 1]); } catch (_){}
      }
      return;
    }
  });
  cv.addEventListener('pointerdown', function(e){
    if (!S || ED.on || isMenu() || introT > 0 || gameOver || outro) return;
    var g = clientToGame(e.clientX, e.clientY);
    if (!g) return;
    if (isInvOpen()){
      e.preventDefault();
      handleInvPointer(g.x, g.y);
      return;
    }
    if (tryHeroInv(e)){ e.preventDefault(); return; }
    if (hudHitsWeapon(g.x, g.y) && tryCycleHand()){
      e.preventDefault();
      try { onEvent(S.p.events[S.p.events.length - 1]); } catch (_){}
    }
  });
  document.getElementById('bFS').addEventListener('click', toggleFS);
  document.getElementById('bMenu').addEventListener('click', function(){
    openGameMenu();
  });
  document.getElementById('bPause').addEventListener('click', function(){
    if (!isMenu() && introT <= 0 && !outro && !gameOver) paused = !paused;
  });
  addEventListener('pointerdown', function(){ if (!ED.on && !isMenu()) advanceScreens(); });
  addEventListener('keydown', function(e){
    if (e.key === 'Escape'){
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (ED.on) return;
      if (handleInvKey('Escape')){ e.preventDefault(); return; }
      e.preventDefault();
      if (isMenu()){
        if (menuScreen() !== 'home'){ showMenuHome(); return; }
        resumeGame();
      }
      else openGameMenu();
      return;
    }
    if (gameOver) return;
    if (e.key === 'p' || e.key === 'P'){ if (!isMenu() && introT <= 0 && !outro) paused = !paused; return; }
    if (e.key === 'Enter' || e.key === ' ') advanceScreens();
  });
  document.getElementById('bReset').addEventListener('click', hardReset);
  document.addEventListener('visibilitychange', function(){
    if (document.hidden){ paused = true; hushLift(); hushSounds(); hushMusic(); }
  });
  addEventListener('resize', function(){ resize(); });
  addEventListener('orientationchange', function(){ setTimeout(resize, 160); });

  applyBootSettings();
  buildMenu({
    onStart: startLevel,
    onDelete: function(idx){ deleteLevelAt(idx, false); },
    onResume: resumeGame,
    canResume: function(){ return canResume; }
  });
  var devLevel = resolveDevLevel();
  if (devLevel !== null){
    var splashEl = document.getElementById('splash');
    if (splashEl) splashEl.classList.add('hide');
    startLevel(devLevel);
    introT = 0;
  } else {
    showSplash(function(){ showMenu(); });
  }
  if (typeof window !== 'undefined'){
    window.__state = function(){ return S; };
    window.__start = startLevel;
    window.__menu = function(){ return isMenu(); };
    window.__skip = function(){ introT = 0; paused = false; gameOver = null; setOutro(null); };
    window.__screens = function(){ return { intro: introT, paused: paused, outro: !!outro, dead: !!gameOver, resume: canResume, inv: isInvOpen() }; };
    window.__inv = {
      open: openInv, close: closeInv, toggle: toggleInv, isOpen: isInvOpen,
      tap: handleInvPointer, inspecting: invInspecting, step: stepInv,
      heroRect: function(){
        if (!S || !S.p) return null;
        var p = S.p, pad = 7;
        return { x: p.x - cam.x - pad, y: p.y - cam.y - pad, w: p.w + pad * 2, h: p.h + pad * 2 };
      }
    };
    window.__game = G;
    window.__music = {
      start: startMusic, play: playMusic, pause: pauseMusic, hush: hushMusic, resume: resumeMusic,
      seek: seekMusic, pos: getTransport, playing: musicPlaying, held: musicHeld, armed: musicArmed,
      mix: getMix, set: setScore, list: listScores
    };
    window.__fish = getFish;
    window.__editor = { open: edOpen, close: edClose, state: ED,
                        apply: function(c, r){ edApply({ c:c, r:r }); },
                        exportText: edExportText,
                        undo: undoOp, redo: redoOp, canUndo: canUndo, canRedo: canRedo };
  }
  cam.x = S.p.x - VW/2; cam.y = S.p.y - VH/2;
  cam.ax = S.p.x + S.p.w/2; cam.ay = S.p.y + S.p.h/2;
  resize();
  last = performance.now();
  requestAnimationFrame(frame);
}
