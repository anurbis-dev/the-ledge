import GAME from '../core/game.js';
import {
  cv, ctx, VW, VH, cam, view, rc, buildWater, clampCam, setViewScale,
  setPondShade, getPondShade, waterExport, shadePresetName, WATER_SHADE_PRESETS
} from '../render/index.js';
import { isMenu } from '../ui/menu.js';
import { hushLift } from '../audio/sfx.js';
import { findById } from '../entities/ids.js';
import { BOULDER_DEF } from '../entities/boulders.js';
import { isSlopeBrush, fitSlopeStroke } from './slopes.js';
import { tileThumb, objThumb, paintObjIcon } from './thumbs.js';
import { spriteThumb } from '../render/sprite-bake.js';
import { renderParams, resetAllParams } from './params.js';
import { getActiveLayer, getLayers, layerTile, layerVar, layerDeco, layerTileRaw, layerVarRaw, isTileLayer } from '../core/layers.js';
import {
  customSpecs, addTile, loadImageFile, sliceSheet, guessOverlay, bindTileset, isCustomId,
  getTileDef, updateTile
} from '../core/tileset.js';
import { bindTileEdit, openTileEdit, openSpriteEdit, closeTileEdit } from './tile-edit.js';
import { listSpriteDefs, spriteDefForKind, getSpriteDef, bindSpriteset } from '../core/spriteset.js';
import { clearThumbCache } from './thumbs.js';
import { setEditorRooms, stepRooms } from '../core/rooms.js';
import { showLayersPanel, bindLayersPanel } from './layers-panel.js';
import { bindIntroPanel, renderIntroPanel } from './intro-panel.js';
import { bindMixPanel, renderMixPanel } from './mix-panel.js';
import { bindGearPanel, renderGearPanel } from './gear-settings.js';
import { showInspect, bindInspect } from './inspect.js';
import { bindNpcTalk, openNpcTalk, closeNpcTalk } from './npc-talk.js';
import { bindBoulderSettings, openBoulderSettings, closeBoulderSettings } from './boulder-settings.js';
import { bindAllFloats, placeFloat, hasFloatPos } from './float.js';
import { pickSpecial, pickAllSpecial, hitGizmo, beginGizmo, moveGizmo, endGizmo, gizmoActive, drawGizmos } from './gizmos.js';
import { markLevelDirty as persistDirty, flushLevel, bindPersist } from '../core/persist.js';
import { scheduleBake, pushBake, collectFull } from '../core/bake-client.js';
import { beginOp, endOp, noteOp, undoOp, redoOp, canUndo, canRedo, bindHistory, clearHistory } from './history.js';
import { invalidateAll } from '../render/tiles.js';
import { renderLayersPanel } from './layers-panel.js';

function markLevelDirty(){
  noteOp();
  persistDirty();
}


var G = GAME;
var HOLD_MS = 450;
var ZOOM_STEPS = [0.25, 0.5, 1, 2, 4];
var ICON_MIN = 16, ICON_MAX = 56;
var HKEY = 'ledge.ed.h';
var IKEY = 'ledge.ed.icon';
var GKEY = 'ledge.ed.geo';

export var ED = {
  on: false, tab: 'tile', tool: 'tile', pal: 0, painting: false, erasing: false,
  panId: -1, panX: 0, panY: 0, camX: 0, camY: 0, last: null,
  stroke: null, strokeOrig: null, waterShade: 0.75,
  zoom: 1, icon: 28, hover: null,
  clickCell: null, clickBrush: -1,
  holdT: null, holdErased: false, holdX: 0, holdY: 0,
  dragObj: null, showGeo: false, cover: false, stampCover: false,
  sel: null, dragPal: null, giz: false,
  hitObj: null, pendHit: null,
  selTiles: null, boxing: null, moving: null, ctrlGest: null, clip: null
};

/* varN — сколько ручных узоров держит тайл; повторный клик по уже стоящему тайлу того же брашка
   перебирает узоры 1..varN (0 — авто-узор по хэшу позиции, применяется по умолчанию) */
export var ED_TILES = [
  { name: 'Empty',   id: 0,       color: '#241a30' },
  { name: 'Stone',   id: 1,       color: '#635c8c', varN: 5 },
  { name: 'Crumb',   id: 2,       color: '#96705a' },
  { name: 'Ladder',  id: 3,       color: '#bd8347' },
  { name: 'Ladder F',id: 4,       color: '#d09b5c' },
  { name: 'Slope R', id: G.SLR,   color: '#8f86b8', slope: 'r', varN: 5 },
  { name: 'Slope L', id: G.SLL,   color: '#8f86b8', slope: 'l', varN: 5 },
  { name: 'Half R lo', id: G.SLR2, color: '#9a92c4', slope: 'r2', varN: 5 },
  { name: 'Half R hi', id: G.SLR3, color: '#9a92c4', slope: 'r3', varN: 5 },
  { name: 'Half L hi', id: G.SLL2, color: '#9a92c4', slope: 'l2', varN: 5 },
  { name: 'Half L lo', id: G.SLL3, color: '#9a92c4', slope: 'l3', varN: 5 },
  { name: 'Arc R',   id: G.SLRCA, color: '#a89ed0', slope: 'arcR', varN: 5 },
  { name: 'Arc L',   id: G.SLLCB, color: '#a89ed0', slope: 'arcL', varN: 5 },
  { name: 'Half top',id: 7,       color: '#4a4069', varN: 5 },
  { name: 'Bar',     id: 8,       color: '#a9743f' },
  { name: 'Water',   id: 13,      color: '#49a0cf' },
  { name: 'Fall',    id: 14,      color: '#2f7fae' },
  { name: 'Diag R',  id: 5,       color: '#c9a06a', slope: 'r', varN: 5 },
  { name: 'Diag L',  id: 6,       color: '#c9a06a', slope: 'l', varN: 5 },
  { name: 'Plank',   id: G.PLANK, color: '#a9743f' },
  { name: 'Give',    id: G.GIVE,  color: '#4a4069' }
];
export var ED_OBJS = [
  { name: 'Foe 1',   kind: 'enemy0' },
  { name: 'Foe 2',   kind: 'enemy1' },
  { name: 'Foe 3',   kind: 'enemy2' },
  { name: 'Bird',    kind: 'flier0' },
  { name: 'Bird 2',  kind: 'flier1' },
  { name: 'Bird 3',  kind: 'flier2' },
  { name: 'Diver',   kind: 'flier3' },
  { name: 'Spider',  kind: 'spider0' },
  { name: 'Spider 2',kind: 'spider1' },
  { name: 'Spider 3',kind: 'spider2' },
  { name: 'Sting',   kind: 'tendril0' },
  { name: 'Grabber', kind: 'tendril1' },
  { name: 'Torch',   kind: 'torch' },
  { name: 'Chest',   kind: 'chest' },
  { name: 'Locked',  kind: 'chestL' },
  { name: 'Coin',    kind: 'coin' },
  { name: 'Gem',     kind: 'gem' },
  { name: 'Shroom',  kind: 'shroom' },
  { name: 'Relic',   kind: 'relic' },
  { name: 'Air tank',kind: 'tank' },
  { name: 'Key',      kind: 'key' },
  { name: 'Helmet',   kind: 'helmet' },
  { name: 'Shield',   kind: 'shield' },
  { name: 'Sword',    kind: 'sword' },
  { name: 'Scuba',    kind: 'scuba' },
  { name: 'Flippers', kind: 'flippers' },
  { name: 'Harpoon',  kind: 'harpoon' },
  { name: 'Bow',      kind: 'bow' },
  { name: 'Sound',   kind: 'sound' },
  { name: 'Light',   kind: 'light' },
  { name: 'Volume',  kind: 'volume' },
  { name: 'Boulder', kind: 'boulder' },
  { name: 'Hermit',  kind: 'npc_hermit' },
  { name: 'Wanderer', kind: 'npc_wanderer' }
];

/* предметы, которые можно тащить в сундук/врага; часть из них (не coin/gem/shroom)
   не работают как отдельный мировой предмет — только как содержимое лута */
var LOOT_KINDS = { coin:1, gem:1, shroom:1, key:1, helmet:1, shield:1, sword:1,
                    scuba:1, flippers:1, harpoon:1, bow:1 };
var LOOT_ONLY_KINDS = { key:1, helmet:1, shield:1, sword:1, scuba:1, flippers:1, harpoon:1, bow:1 };
var LOOT_NAMES = { key:'Key', coin:'Coin', gem:'Gem', shroom:'Shroom', helmet:'Helmet',
                    shield:'Shield', sword:'Sword', scuba:'Scuba', flippers:'Flippers',
                    harpoon:'Harpoon', bow:'Bow' };

/* сундук или враг под указанной мировой точкой — цель для добавления/просмотра лута */
function findLootTargetAt(wx, wy){
  var hits = findAllAt(wx, wy);
  for (var i = 0; i < hits.length; i++)
    if (hits[i].type === 'chest' || hits[i].type === 'enemy' || hits[i].type === 'flier') return hits[i];
  return null;
}
function addLoot(target, kind, qty){
  if (!target.loot) target.loot = [];
  var entry = null, i;
  for (i = 0; i < target.loot.length; i++) if (target.loot[i].kind === kind){ entry = target.loot[i]; break; }
  qty = Math.max(1, Math.min(99, qty | 0 || 1));
  if (entry) entry.qty = Math.max(1, Math.min(99, entry.qty + qty));
  else target.loot.push({ kind: kind, qty: qty });
  markLevelDirty();
}

/* единый список типов объектов: откуда брать массив в мире и как считать точку попадания курсора */
var OBJ_KINDS = [
  { type: 'enemy',   get: function(S){ return S.enemies; },        set: function(S, a){ S.enemies = a; },
    pos: function(o){ return [o.x + o.w/2, o.y + o.h/2]; } },
  { type: 'flier',   get: function(S){ return S.fliers; },         set: function(S, a){ S.fliers = a; },
    pos: function(o){ return [o.x + o.w/2, o.y + o.h/2]; } },
  { type: 'spider',  get: function(S){ return S.spiders; },        set: function(S, a){ S.spiders = a; },
    pos: function(o){ return [o.hx, o.hy - 8]; } },
  { type: 'tendril', get: function(S){ return S.tendrils || []; }, set: function(S, a){ S.tendrils = a; },
    pos: function(o){ return [o.bx, o.by]; } },
  { type: 'torch',   get: function(S){ return S.torches; },        set: function(S, a){ S.torches = a; },
    pos: function(o){ return [o.x, o.y - 8]; } },
  { type: 'chest',   get: function(S){ return S.chests; },         set: function(S, a){ S.chests = a; },
    pos: function(o){ return [o.x + 10, o.y - 6]; } },
  { type: 'item',    get: function(S){ return S.items; },          set: function(S, a){ S.items = a; },
    pos: function(o){ return [o.x, o.y]; } },
  { type: 'boulder', get: function(S){ return S.boulders; },       set: function(S, a){ S.boulders = a; },
    pos: function(o){ return [o.x + 6, o.y + 5]; } },
  { type: 'npc',     get: function(S){ return S.npcs || []; },     set: function(S, a){ S.npcs = a; },
    pos: function(o){ return [o.x + 5, o.y + 9]; } }
];
function objNear(pos, ox, oy){ return Math.abs(pos[0] - ox) < 14 && Math.abs(pos[1] - oy) < 18; }
function findObjectAt(px, py){
  var all = findAllAt(px, py);
  return all.length ? all[0] : null;
}
function findAllAt(px, py){
  var S = world(), out = [], i, j, k, arr;
  if (!S) return out;
  for (i = 0; i < OBJ_KINDS.length; i++){
    k = OBJ_KINDS[i]; arr = k.get(S) || [];
    for (j = arr.length - 1; j >= 0; j--)
      if (objNear(k.pos(arr[j]), px, py))
        out.push({ kindDef: k, type: k.type, obj: arr[j] });
  }
  var spec = pickAllSpecial(S, px, py);
  for (i = 0; i < spec.length; i++) out.push(spec[i]);
  return out;
}
function cycleHit(px, py){
  var hits = findAllAt(px, py);
  if (!hits.length) return null;
  var cur = (ED.sel && ED.sel.obj) || (ED.hitObj && ED.hitObj.obj);
  var i, idx = -1;
  for (i = 0; i < hits.length; i++)
    if (hits[i].obj === cur){ idx = i; break; }
  return hits[(idx + 1) % hits.length];
}
function applyHit(hit){
  ED.hitObj = hit;
  if (hit && isSpecialKind(hit.type)) selectSpecial(hit);
  else selectSpecial(null);
}
function removeObject(entry){
  var S = world(), k = entry.kindDef;
  k.set(S, k.get(S).filter(function(o){ return o !== entry.obj; }));
  if (entry.type === 'torch' && S.p.torch >= 0 && !findById(S.torches, S.p.torch)) S.p.torch = -1;
}
function respawnObjectAt(entry, cell){
  var S = world(), T = G.T;
  var cx = cell.c*T + 8, cy = cell.r*T + 8, floorY = (cell.r + 1)*T, o = entry.obj;
  if (entry.type === 'enemy') G.mkEnemyAt(S, cx - 5, floorY, o.kind, o.loot, o.random);
  else if (entry.type === 'flier') G.mkFlierAt(S, cx - 6, cy - 4, o.kind, o.loot, o.random);
  else if (entry.type === 'spider') G.mkSpiderAt(S, cx, floorY, o.kind);
  else if (entry.type === 'tendril') G.mkTendrilAt(S, cx, cy, o.kind);
  else if (entry.type === 'torch') G.mkTorchAt(S, cx, floorY);
  else if (entry.type === 'chest') G.mkChestAt(S, cell.c*T, floorY, o.loot, o.locked, o.random);
  else if (entry.type === 'item') G.mkItemAt(S, cx, cy, o.kind);
  else if (entry.type === 'boulder') G.mkBoulderAt(S, cx, floorY);
  else if (entry.type === 'npc') G.mkNpcAt(S, cx, floorY, o.tree, o.facing, o.dialog);
}
function newestOf(entry){
  var arr = entry.kindDef.get(world());
  return { kindDef: entry.kindDef, type: entry.type, obj: arr[arr.length - 1] };
}
/* перерисовывает объект на новой клетке сразу при протяжке, не дожидаясь отпускания кнопки */
function moveObjectTo(entry, cell){
  removeObject(entry);
  respawnObjectAt(entry, cell);
  return newestOf(entry);
}
/* Ctrl+драг: не трогая оригинал, заводит его копию на текущей клетке — дальше она таскается как обычный drag */
function copyObjectAt(entry, cell){
  respawnObjectAt(entry, cell);
  return newestOf(entry);
}

var edBar = document.getElementById('edbar');
var edPal = document.getElementById('edPal');
var edExtra = document.getElementById('edExtra');
var edOut = document.getElementById('edout'), edText = document.getElementById('edtext');
var edParams = document.getElementById('edParams');
var edParamList = document.getElementById('edParamList');
var edParamQ = document.getElementById('edParamQ');
var paramsBuilt = false;
var onOpen = null, onNewLevel = null, onDelLevel = null;

try {
  var ih = +localStorage.getItem(IKEY);
  if (ih >= ICON_MIN && ih <= ICON_MAX) ED.icon = ih;
  ED.showGeo = localStorage.getItem(GKEY) === '1';
} catch (_){}

bindLayersPanel({ onChange: function(){ markLevelDirty(); } });
bindIntroPanel();
bindGearPanel();
bindMixPanel();
bindInspect({ onChange: function(){ markLevelDirty(); }, onClose: function(){ ED.sel = null; } });
bindTileEdit({
  onChange: function(){
    scheduleBake();
    edRefresh();
  }
});
bindTileset({
  onChange: function(){
    clearThumbCache();
    invalidateAll();
    scheduleBake();
    edRefresh();
  }
});
bindSpriteset({
  onChange: function(){
    clearThumbCache();
    scheduleBake();
    edRefresh();
  }
});
bindNpcTalk({ onChange: function(){ markLevelDirty(); } });
bindBoulderSettings({ onChange: function(){ markLevelDirty(); } });
bindAllFloats();
bindPersist({ water: waterExport, onFlush: scheduleBake });
bindHistory({
  onChange: function(why){
    if (why === 'restore'){
      invalidateAll();
      buildWater();
      renderLayersPanel();
      if (ED.sel && ED.sel.obj){
        var still = findByIdRestored(ED.sel);
        if (still) selectSpecial(still);
        else selectSpecial(null);
      }
      persistDirty();
    }
    syncUndoBtns();
  }
});

function findByIdRestored(sel){
  var S = world();
  if (!S || !sel || !sel.obj) return null;
  var arr = sel.type === 'light' ? S.lights : sel.type === 'sound' ? S.sounds : sel.type === 'volume' ? S.volumes : null;
  if (!arr) return null;
  var id = sel.obj.id, i;
  for (i = 0; i < arr.length; i++) if (arr[i].id === id) return { type: sel.type, obj: arr[i] };
  return arr.length ? { type: sel.type, obj: arr[0] } : null;
}

function syncUndoBtns(){
  var u = document.getElementById('edUndo');
  var r = document.getElementById('edRedo');
  if (u) u.disabled = !canUndo();
  if (r) r.disabled = !canRedo();
}

export function bindEditor(hooks){
  onOpen = hooks && hooks.onOpen;
  onNewLevel = hooks && hooks.onNewLevel;
  onDelLevel = hooks && hooks.onDelLevel;
}

export function syncDelBtn(){
  var b = document.getElementById('edDel');
  if (b) b.disabled = G.LEVELS.length <= 1;
}

function world(){ return G.W; }

function objPalForKind(kind){
  var i;
  for (i = 0; i < ED_OBJS.length; i++)
    if (ED_OBJS[i].kind === kind) return i;
  return -1;
}
function selectSpriteBrush(def){
  var pal = def ? objPalForKind(def.kind) : -1;
  if (pal < 0) return false;
  ED.tool = 'obj';
  ED.pal = pal;
  return true;
}
function spriteDefForHit(hit){
  if (!hit || !hit.obj) return null;
  var o = hit.obj, sid;
  if (hit.type === 'light'){
    sid = o.sprite;
    if (!sid || sid === 'none') sid = 'lantern';
    return getSpriteDef(sid) || spriteDefForKind('light');
  }
  if (hit.type === 'enemy') return spriteDefForKind('enemy' + o.kind);
  if (hit.type === 'flier') return spriteDefForKind('flier' + o.kind);
  if (hit.type === 'spider') return spriteDefForKind('spider' + o.kind);
  if (hit.type === 'npc') return spriteDefForKind('npc_' + (o.tree || 'hermit'));
  return spriteDefForKind(hit.type);
}

function setTab(tab){
  ED.tab = tab;
  if (tab === 'tile' || tab === 'obj'){
    ED.tool = tab;
    ED.pal = 0;
  }
  edRefresh();
}

function syncTabs(){
  var tabs = edBar.querySelectorAll('.ed-tab');
  for (var i = 0; i < tabs.length; i++){
    tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === ED.tab);
  }
  var hidePal = ED.tab === 'params' || ED.tab === 'intro' || ED.tab === 'mix' || ED.tab === 'gear';
  if (edPal) edPal.hidden = hidePal;
  if (edExtra) edExtra.hidden = hidePal;
  if (edParams) edParams.hidden = ED.tab !== 'params';
  var edIntro = document.getElementById('edIntro');
  if (edIntro) edIntro.hidden = ED.tab !== 'intro';
  var edMix = document.getElementById('edMix');
  if (edMix) edMix.hidden = ED.tab !== 'mix';
  var edGear = document.getElementById('edGear');
  if (edGear) edGear.hidden = ED.tab !== 'gear';
}

function swatch(parent, canvas, label, active, onPick, kind, pal){
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'ed-swatch' + (active ? ' on' : '');
  b.title = label + ' — drag onto canvas';
  b.style.width = (ED.icon + 6) + 'px';
  b.style.height = (ED.icon + 6) + 'px';
  var img = canvas;
  img.className = 'ed-swatch-img';
  img.style.width = ED.icon + 'px';
  img.style.height = ED.icon + 'px';
  b.appendChild(img);
  b.addEventListener('pointerdown', function(e){
    if (e.button !== 0) return;
    if (e.detail === 2) return;
    e.stopPropagation();
    onPick();
    startPaletteDrag(e, kind, pal, img);
    edRefresh();
  });
  parent.appendChild(b);
  return b;
}

function startPaletteDrag(e, kind, pal, img){
  ED.dragPal = { kind: kind, pal: pal, x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId };
  var ghost = document.getElementById('edGhost');
  function showGhost(ev){
    if (!ghost || !ghost.hidden) return;
    ghost.textContent = '';
    var c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    c.style.width = ED.icon + 'px'; c.style.height = ED.icon + 'px';
    ghost.appendChild(c);
    ghost.hidden = false;
    ghost.style.left = ev.clientX + 8 + 'px';
    ghost.style.top = ev.clientY + 8 + 'px';
  }
  function move(ev){
    if (!ED.dragPal || ev.pointerId !== ED.dragPal.pointerId) return;
    if (Math.abs(ev.clientX - ED.dragPal.x) > 4 || Math.abs(ev.clientY - ED.dragPal.y) > 4){
      ED.dragPal.moved = true;
      showGhost(ev);
    }
    if (ghost && !ghost.hidden){
      ghost.style.left = ev.clientX + 8 + 'px';
      ghost.style.top = ev.clientY + 8 + 'px';
    }
  }
  function up(ev){
    if (!ED.dragPal || ev.pointerId !== ED.dragPal.pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    var r = cv.getBoundingClientRect();
    var over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    if (over && ED.dragPal.moved){
      var dKind = ED.dragPal.kind, dPal = ED.dragPal.pal;
      if (dKind === 'sprite'){
        var sdef = getSpriteDef(dPal);
        var spal = sdef ? objPalForKind(sdef.kind) : -1;
        if (spal < 0){
          ED.dragPal = null;
          if (ghost) ghost.hidden = true;
          return;
        }
        dKind = 'obj';
        dPal = spal;
      }
      var ospec = dKind === 'obj' ? ED_OBJS[dPal] : null;
      if (ospec && LOOT_KINDS[ospec.kind]){
        var wcellD = edCell(ev.clientX, ev.clientY, true);
        var lootHit = findLootTargetAt(wcellD.x, wcellD.y);
        if (lootHit){
          openChestAdd(lootHit.obj, ospec.kind, ev.clientX, ev.clientY);
          ED.dragPal = null;
          if (ghost) ghost.hidden = true;
          return;
        }
        if (LOOT_ONLY_KINDS[ospec.kind]){
          ED.dragPal = null;
          if (ghost) ghost.hidden = true;
          return;
        }
      }
      ED.tool = dKind === 'obj' ? 'obj' : 'tile';
      ED.pal = dPal;
      var cell = edCell(ev.clientX, ev.clientY);
      beginOp();
      edApply(cell, true);
      endOp();
    }
    ED.dragPal = null;
    if (ghost) ghost.hidden = true;
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function extraBtn(parent, label, active, onClick){
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'edb' + (active ? ' on' : '');
  b.textContent = label;
  b.addEventListener('click', function(e){ e.stopPropagation(); onClick(); edRefresh(); });
  parent.appendChild(b);
}

function fillPal(){
  if (!edPal) return;
  edPal.textContent = '';
  edPal.style.setProperty('--ed-icon', ED.icon + 'px');
  if (ED.tab === 'tile' || (ED.tab === 'params' && ED.tool === 'tile')){
    if (ED.tab !== 'tile') return;
    var tiles = palTiles();
    for (var j = 0; j < tiles.length; j++){
      (function(k){
        var spec = tiles[k];
        var sw = swatch(edPal, tileThumb(spec, ED.icon), spec.name + (spec.overlay ? ' (overlay)' : ''), ED.tool === 'tile' && ED.pal === k, function(){ ED.tool = 'tile'; ED.pal = k; }, 'tile', k);
        if (spec.overlay) sw.classList.add('deco');
        sw.addEventListener('dblclick', function(e){
          e.preventDefault(); e.stopPropagation();
          ED.pal = k;
          openTileEdit(spec, e.clientX, e.clientY);
          edRefresh();
        });
      })(j);
    }
    var spr = listSpriteDefs();
    if (spr.length){
      var slab = document.createElement('div');
      slab.className = 'ed-pal-hint';
      slab.textContent = 'Sprites — click to stamp; double-click to edit frames';
      edPal.appendChild(slab);
      var si;
      for (si = 0; si < spr.length; si++){
        (function(def){
          var stamp = objPalForKind(def.kind) >= 0;
          var on = ED.tool === 'obj' && ED_OBJS[ED.pal] && ED_OBJS[ED.pal].kind === def.kind;
          var sw = swatch(edPal, spriteThumb(def, ED.icon), def.name, on, function(){
            selectSpriteBrush(def);
          }, 'sprite', def.id);
          sw.title = def.name + (stamp ? ' — click/drag to stamp · double-click to edit' : ' — double-click to edit frames');
          sw.addEventListener('dblclick', function(e){
            e.preventDefault(); e.stopPropagation();
            openSpriteEdit(def, e.clientX, e.clientY);
          });
        })(spr[si]);
      }
    }
    var hint = document.createElement('div');
    hint.className = 'ed-pal-hint';
    hint.textContent = 'Drop PNG to add tiles · double-click to edit · Ctrl+drag selects a block';
    edPal.appendChild(hint);
  } else if (ED.tab === 'obj'){
    for (var m = 0; m < ED_OBJS.length; m++){
      (function(k){
        var spec = ED_OBJS[k];
        var sw = swatch(edPal, objThumb(spec.kind, ED.icon), spec.name, ED.pal === k, function(){ ED.pal = k; }, 'obj', k);
        if (LOOT_ONLY_KINDS[spec.kind]) sw.title = spec.name + ' — drag onto a chest, enemy or bird';
        sw.addEventListener('dblclick', function(e){
          var sd = spriteDefForKind(spec.kind);
          if (!sd) return;
          e.preventDefault(); e.stopPropagation();
          openSpriteEdit(sd, e.clientX, e.clientY);
        });
      })(m);
    }
  }
}

function fillExtra(){
  if (!edExtra) return;
  edExtra.textContent = '';
  if (ED.tab !== 'tile' || ED.tool === 'obj') return;
  var spec = palSpec();
  if (spec && spec.id === G.WATER){
    for (var s = 0; s < WATER_SHADE_PRESETS.length; s++){
      (function(k){
        var pr = WATER_SHADE_PRESETS[k];
        extraBtn(edExtra, pr[0], Math.abs(ED.waterShade - pr[1]) < 0.02, function(){ ED.waterShade = pr[1]; });
      })(s);
    }
  }
  if (spec && spec.id){
    extraBtn(edExtra, 'Edit', false, function(){ openTileEdit(spec); });
  }
  if (spec && spec.custom){
    extraBtn(edExtra, spec.overlay ? 'Overlay' : 'Main', !!spec.overlay, function(){
      var ts = getTileDef(spec.id);
      if (!ts) return;
      updateTile(spec.id, {
        overlay: !ts.overlay,
        collide: !ts.overlay ? 'none' : (ts.collide === 'none' ? 'full' : ts.collide)
      });
    });
  }
}

function showParams(){
  if (!edParamList) return;
  renderParams(edParamList, edParamQ ? edParamQ.value : '');
  paramsBuilt = true;
}

function edRefresh(){
  syncTabs();
  syncDelBtn();
  if (ED.tab === 'params'){
    showParams();
  } else if (ED.tab === 'intro'){
    renderIntroPanel();
  } else if (ED.tab === 'mix'){
    renderMixPanel();
  } else if (ED.tab === 'gear'){
    renderGearPanel();
  } else {
    fillPal();
    fillExtra();
  }
}

export function edOpen(){
  ED.on = true;
  hushLift();
  if (onOpen) onOpen();
  ED.camX = cam.x; ED.camY = cam.y;
  setViewScale(ED.zoom);
  view.edit = true;
  setEditorRooms(ED.cover);
  document.body.classList.add('edit-mode');
  edBar.classList.add('on');
  restoreHeight();
  edRefresh();
  showLayersPanel(true);
  syncGeoBtn();
  syncCoverBtn();
  dispatchEvent(new Event('resize'));
  flushLevel(world());
  pushBake({ silent: true }).catch(function(){});
}
export function edClose(){
  flushLevel(world());
  pushBake({ silent: true }).catch(function(){});
  ED.on = false;
  view.edit = false;
  var Sclose = world();
  if (Sclose) stepRooms(Sclose);
  else setEditorRooms(false);
  setViewScale(1);
  document.body.classList.remove('edit-mode');
  edBar.classList.remove('on');
  showLayersPanel(false);
  showInspect(null);
  closeNpcTalk();
  closeBoulderSettings();
  closeTileEdit();
  ED.sel = null;
  ED.selTiles = null;
  endGizmo();
  closeVarMenu();
  closeChestAdd();
  closeChestList();
  ED.dragObj = null;
  clearHold();
  ED.painting = false; ED.erasing = false; ED.panId = -1;
  dispatchEvent(new Event('resize'));
}
export function edToggle(){
  if (ED.on) edClose(); else edOpen();
}

function layerParallax(){
  var L = getActiveLayer();
  return { px: L && L.px != null ? L.px : 1, py: L && L.py != null ? L.py : 1 };
}

function edCell(clientX, clientY, worldSpace){
  var T = G.T, z = ED.zoom || 1;
  var r = cv.getBoundingClientRect();
  var sx = (clientX - r.left) / r.width * VW;
  var sy = (clientY - r.top) / r.height * VH;
  var P = worldSpace ? { px: 1, py: 1 } : layerParallax();
  var wx = cam.x * P.px + sx / z, wy = cam.y * P.py + sy / z;
  return { c: Math.floor(wx / T), r: Math.floor(wy / T), x: wx, y: wy, sx: sx, sy: sy };
}

function coverLayerOk(L){
  return !!(L && isTileLayer(L) && L.collide && !L.wrap && !L.locked);
}
function inCoverPaint(){
  return ED.cover && ED.tool === 'tile' && coverLayerOk(getActiveLayer());
}
function coverBrushId(spec){
  return spec && spec.id ? spec.id : G.COVER_AIR;
}
function brushTile(c, r){
  var L = getActiveLayer();
  if (ED.cover && ED.tool === 'tile'){
    var cv = G.coverRaw(L, c, r);
    return cv === G.COVER_AIR ? 0 : cv;
  }
  return L ? layerTile(L, c, r) : G.tileAt(c, r);
}
function brushVar(c, r){
  var L = getActiveLayer();
  if (ED.cover && ED.tool === 'tile') return G.coverVarRaw(L, c, r);
  return L ? layerVar(L, c, r) : G.varAt(c, r);
}
function brushDeco(c, r){
  var L = getActiveLayer();
  if (!L || !isTileLayer(L)) return 0;
  return layerDeco(L, c, r) || 0;
}

function selectSpecial(sel){
  ED.sel = sel;
  showInspect(sel);
}

function isSpecialKind(kind){
  return kind === 'sound' || kind === 'light' || kind === 'volume';
}

function palTiles(){ return ED_TILES.concat(customSpecs()); }
function palSpec(){ return palTiles()[ED.pal] || ED_TILES[0]; }
function specById(id){
  var t = palTiles(), i;
  for (i = 0; i < t.length; i++) if (t[i].id === id) return t[i];
  return null;
}

function tileMatchesBrush(spec, v){
  if (!spec) return false;
  if (spec.custom || isCustomId(spec.id)) return v === spec.id;
  return spec.slope ? G.isSlopeV(v) : v === spec.id;
}
function findVarSpec(v){
  if (!v) return null;
  for (var i = 0; i < ED_TILES.length; i++)
    if (ED_TILES[i].varN && tileMatchesBrush(ED_TILES[i], v)) return ED_TILES[i];
  return null;
}

var edVarMenu = document.getElementById('edVarMenu');
function closeVarMenu(){
  if (!edVarMenu || edVarMenu.hidden) return;
  edVarMenu.hidden = true;
  edVarMenu.textContent = '';
  document.removeEventListener('pointerdown', onVarMenuOutside, true);
}
function onVarMenuOutside(e){
  if (edVarMenu && !edVarMenu.contains(e.target)) closeVarMenu();
}
function openVarMenu(cell, spec, clientX, clientY){
  if (!edVarMenu) return;
  edVarMenu.textContent = '';
  var cur = brushVar(cell.c, cell.r);
  function addOpt(label, val){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'edb' + (cur === val ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', function(e){
      e.stopPropagation();
      beginOp();
      if (inCoverPaint()) G.setCoverVar(cell.c, cell.r, val);
      else G.setVar(cell.c, cell.r, val);
      markLevelDirty();
      endOp();
      closeVarMenu();
    });
    edVarMenu.appendChild(b);
  }
  addOpt('Auto', 0);
  for (var i = 1; i <= spec.varN; i++) addOpt(String(i), i);
  edVarMenu.hidden = false;
  var mw = edVarMenu.offsetWidth || 160, mh = edVarMenu.offsetHeight || 40;
  edVarMenu.style.left = Math.max(4, Math.min(clientX, innerWidth - mw - 4)) + 'px';
  edVarMenu.style.top = Math.max(4, Math.min(clientY, innerHeight - mh - 4)) + 'px';
  setTimeout(function(){ document.addEventListener('pointerdown', onVarMenuOutside, true); }, 0);
}

function lootIcon(kind, size){
  var c = document.createElement('canvas');
  c.width = size; c.height = size;
  var cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  paintObjIcon(cx, kind, size);
  c.className = 'ed-swatch-img';
  c.style.width = size + 'px'; c.style.height = size + 'px';
  return c;
}
function clampPopup(el, clientX, clientY){
  var mw = el.offsetWidth || 160, mh = el.offsetHeight || 40;
  el.style.left = Math.max(4, Math.min(clientX, innerWidth - mw - 4)) + 'px';
  el.style.top = Math.max(4, Math.min(clientY, innerHeight - mh - 4)) + 'px';
}

var edChestAdd = document.getElementById('edChestAdd');
function closeChestAdd(){
  if (!edChestAdd || edChestAdd.hidden) return;
  edChestAdd.hidden = true;
  edChestAdd.textContent = '';
  document.removeEventListener('pointerdown', onChestAddOutside, true);
}
function onChestAddOutside(e){
  if (edChestAdd && !edChestAdd.contains(e.target)) closeChestAdd();
}
function openChestAdd(chest, kind, clientX, clientY){
  if (!edChestAdd) return;
  closeChestList();
  edChestAdd.textContent = '';
  edChestAdd.appendChild(lootIcon(kind, 20));
  var lab = document.createElement('span');
  lab.className = 'ed-chestadd-label';
  lab.textContent = LOOT_NAMES[kind] || kind;
  edChestAdd.appendChild(lab);
  var inp = document.createElement('input');
  inp.type = 'number'; inp.min = '1'; inp.max = '99'; inp.value = '1';
  edChestAdd.appendChild(inp);
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'edb'; btn.textContent = 'Add';
  function confirmAdd(){
    var qty = Math.max(1, Math.min(99, +inp.value || 1));
    beginOp();
    addLoot(chest, kind, qty);
    endOp();
    closeChestAdd();
  }
  btn.addEventListener('click', function(e){ e.stopPropagation(); confirmAdd(); });
  inp.addEventListener('keydown', function(e){
    e.stopPropagation();
    if (e.key === 'Enter') confirmAdd();
    else if (e.key === 'Escape') closeChestAdd();
  });
  edChestAdd.appendChild(btn);
  edChestAdd.hidden = false;
  clampPopup(edChestAdd, clientX, clientY);
  inp.focus(); inp.select();
  setTimeout(function(){ document.addEventListener('pointerdown', onChestAddOutside, true); }, 0);
}

var edChestList = document.getElementById('edChestList');
var edChestListBody = document.getElementById('edChestListBody');
var edChestListTitle = document.getElementById('edChestListTitle');
var chestListTarget = null;
function closeChestList(){
  if (!edChestList || edChestList.hidden) return;
  edChestList.hidden = true;
  chestListTarget = null;
  document.removeEventListener('pointerdown', onChestListOutside, true);
}
function onChestListOutside(e){
  if (edChestList && !edChestList.contains(e.target)) closeChestList();
}
function renderChestList(){
  if (!edChestListBody || !chestListTarget) return;
  edChestListBody.textContent = '';
  var loot = chestListTarget.loot || [];
  if (loot.length > 1){
    var randRow = document.createElement('label');
    randRow.className = 'ed-check';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!chestListTarget.random;
    cb.addEventListener('change', function(){
      beginOp();
      chestListTarget.random = cb.checked;
      markLevelDirty();
      endOp();
    });
    randRow.appendChild(cb);
    var rl = document.createElement('span');
    rl.textContent = 'Random — drop only one';
    randRow.appendChild(rl);
    edChestListBody.appendChild(randRow);
  }
  if (!loot.length){
    var empty = document.createElement('div');
    empty.className = 'ed-loot-empty';
    empty.textContent = 'Empty — drag items here';
    edChestListBody.appendChild(empty);
    return;
  }
  loot.forEach(function(entry){
    var row = document.createElement('div');
    row.className = 'ed-loot-row';
    row.appendChild(lootIcon(entry.kind, 18));
    var name = document.createElement('span');
    name.className = 'ed-loot-name';
    name.textContent = LOOT_NAMES[entry.kind] || entry.kind;
    row.appendChild(name);
    var qtyInp = document.createElement('input');
    qtyInp.type = 'number'; qtyInp.min = '1'; qtyInp.max = '99'; qtyInp.value = String(entry.qty);
    qtyInp.addEventListener('keydown', function(e){ e.stopPropagation(); });
    qtyInp.addEventListener('change', function(){
      var v = Math.max(1, Math.min(99, +qtyInp.value || 1));
      beginOp();
      entry.qty = v;
      markLevelDirty();
      endOp();
      qtyInp.value = String(v);
    });
    row.appendChild(qtyInp);
    var del = document.createElement('button');
    del.type = 'button'; del.className = 'edb'; del.textContent = '×';
    del.addEventListener('click', function(e){
      e.stopPropagation();
      beginOp();
      chestListTarget.loot = chestListTarget.loot.filter(function(en){ return en !== entry; });
      markLevelDirty();
      endOp();
      renderChestList();
    });
    row.appendChild(del);
    edChestListBody.appendChild(row);
  });
}
function openChestList(target, type, clientX, clientY){
  if (!edChestList) return;
  closeChestAdd();
  chestListTarget = target;
  if (edChestListTitle){
    var label = type === 'enemy' ? 'Enemy' : (type === 'flier' ? 'Bird' : 'Chest');
    edChestListTitle.textContent = label + (target.locked ? ' (locked)' : '');
  }
  renderChestList();
  edChestList.hidden = false;
  if (!hasFloatPos(edChestList)) clampPopup(edChestList, clientX, clientY);
  else placeFloat(edChestList, parseFloat(edChestList.style.left), parseFloat(edChestList.style.top));
  setTimeout(function(){ document.addEventListener('pointerdown', onChestListOutside, true); }, 0);
}
var edChestListXBtn = document.getElementById('edChestListX');
if (edChestListXBtn) edChestListXBtn.addEventListener('click', function(){ closeChestList(); });

export function edApply(cell, isClick){
  var S = world();
  if (cell.c !== cell.c || cell.r !== cell.r) return;
  var key = cell.c + ':' + cell.r;
  if (ED.last === key && !isClick) return;
  ED.last = key;
  if (ED.tool === 'tile'){
    var act = getActiveLayer();
    if (act && !isTileLayer(act)) return;
    var spec = palSpec();
    if (!spec) return;
    if (spec.overlay && !ED.cover){
      G.setDeco(cell.c, cell.r, spec.id);
      markLevelDirty();
      return;
    }
    if (ED.cover){
      if (!coverLayerOk(act)) return;
      if (ED.stampCover){
        var raw = layerTileRaw(act, cell.c, cell.r);
        G.setCover(cell.c, cell.r, raw ? raw : G.COVER_AIR);
        G.setCoverVar(cell.c, cell.r, layerVarRaw(act, cell.c, cell.r));
        markLevelDirty();
        return;
      }
      if (isClick && ED.clickCell === key && ED.clickBrush === ED.pal && spec.varN &&
          tileMatchesBrush(spec, brushTile(cell.c, cell.r))){
        G.setCoverVar(cell.c, cell.r, (brushVar(cell.c, cell.r) % spec.varN) + 1);
        markLevelDirty();
        return;
      }
      G.setCover(cell.c, cell.r, coverBrushId(spec));
      markLevelDirty();
      return;
    }
    var nv = spec.id;
    if (isClick && ED.clickCell === key && ED.clickBrush === ED.pal && spec.varN &&
        tileMatchesBrush(spec, brushTile(cell.c, cell.r))){
      G.setVar(cell.c, cell.r, (brushVar(cell.c, cell.r) % spec.varN) + 1);
      markLevelDirty();
      return;
    }
    if (isSlopeBrush(nv)){ edPaintSlope(cell, nv); return; }
    var old = brushTile(cell.c, cell.r);
    if (nv === G.WATER && old === G.WATER){
      setPondShade(cell.c, cell.r, ED.waterShade);
      return;
    }
    G.setTile(cell.c, cell.r, nv);
    G.buildGates(S);
    if (old === G.WATER || old === G.FALL || nv === G.WATER || nv === G.FALL){
      buildWater();
      if (nv === G.WATER) setPondShade(cell.c, cell.r, ED.waterShade);
    }
    markLevelDirty();
  } else if (ED.tool === 'obj'){
    var ospec = ED_OBJS[ED.pal];
    if (ospec && isSpecialKind(ospec.kind)){
      if (!isClick) return;
      var hit = pickSpecial(S, cell.x, cell.y);
      if (hit && hit.type === ospec.kind){ selectSpecial(hit); return; }
    }
    edPlaceObject(cell);
    markLevelDirty();
  }
}
function edErase(cell, wcell){
  var S = world();
  if (cell.c !== cell.c || cell.r !== cell.r) return;
  var key = cell.c + ':' + cell.r;
  if (ED.last === key) return;
  ED.last = key;
  if (inCoverPaint()){
    G.setCover(cell.c, cell.r, 0);
    markLevelDirty();
    return;
  }
  var actE = getActiveLayer();
  if (actE && isTileLayer(actE) && brushDeco(cell.c, cell.r)){
    G.setDeco(cell.c, cell.r, 0);
    markLevelDirty();
    return;
  }
  var oldE = (actE && isTileLayer(actE)) ? brushTile(cell.c, cell.r) : G.tileAt(cell.c, cell.r);
  if (!actE || isTileLayer(actE)) G.setTile(cell.c, cell.r, 0);
  edEraseObjects(wcell || cell);
  G.buildGates(S);
  if (oldE === G.WATER || oldE === G.FALL) buildWater();
}
function edEraseObjects(cell){
  var S = world();
  var T = G.T, ox = cell.c*T + 8, oy = cell.r*T + 8;
  for (var i = 0; i < OBJ_KINDS.length; i++){
    (function(k){
      k.set(S, k.get(S).filter(function(o){ return !objNear(k.pos(o), ox, oy); }));
    })(OBJ_KINDS[i]);
  }
  if (S.p.torch >= 0 && !findById(S.torches, S.p.torch)) S.p.torch = -1;
  function away(o){ return Math.abs(o.x - ox) >= 14 || Math.abs(o.y - oy) >= 18; }
  if (S.lights) S.lights = S.lights.filter(away);
  if (S.sounds) S.sounds = S.sounds.filter(away);
  if (S.volumes) S.volumes = S.volumes.filter(function(v){
    return Math.abs(v.x + v.w/2 - ox) >= v.w/2 + 4 || Math.abs(v.y + v.h/2 - oy) >= v.h/2 + 4;
  });
  if (ED.sel && ED.sel.obj){
    var still = pickSpecial(S, ox, oy);
    if (!still || still.obj !== ED.sel.obj) selectSpecial(null);
  }
  markLevelDirty();
}
function edPlaceObject(cell){
  var S = world();
  var T = G.T;
  var spec = ED_OBJS[ED.pal];
  if (!spec) return;
  var kind = spec.kind;
  var cx = cell.c*T + 8, cy = cell.r*T + 8, floorY = (cell.r + 1)*T;
  if (kind === 'sound'){ selectSpecial({ type: 'sound', obj: G.mkSoundAt(S, cx, cy) }); return; }
  if (kind === 'light'){ selectSpecial({ type: 'light', obj: G.mkLightAt(S, cx, cy) }); return; }
  if (kind === 'volume'){ selectSpecial({ type: 'volume', obj: G.mkVolumeAt(S, cx, cy) }); return; }
  if (LOOT_KINDS[kind]){
    var lootAt = findLootTargetAt(cx, cy);
    if (lootAt){ addLoot(lootAt.obj, kind, 1); return; }
    if (LOOT_ONLY_KINDS[kind]) return;
  }
  if (kind.indexOf('enemy') === 0) G.mkEnemyAt(S, cx - 5, floorY, +kind.slice(5));
  else if (kind.indexOf('flier') === 0) G.mkFlierAt(S, cx - 6, cy - 4, +kind.slice(5));
  else if (kind.indexOf('spider') === 0) G.mkSpiderAt(S, cx, floorY, +kind.slice(6));
  else if (kind.indexOf('tendril') === 0) G.mkTendrilAt(S, cx, cy, +kind.slice(7));
  else if (kind === 'torch') G.mkTorchAt(S, cx, floorY);
  else if (kind === 'chest') G.mkChestAt(S, cell.c*T, floorY, [{ kind:'coin', qty:5 }], false);
  else if (kind === 'chestL') G.mkChestAt(S, cell.c*T, floorY, [{ kind:'gem', qty:3 }], true);
  else if (kind === 'boulder') G.mkBoulderAt(S, cx, floorY);
  else if (kind.indexOf('npc_') === 0) G.mkNpcAt(S, cx, floorY, kind.slice(4));
  else G.mkItemAt(S, cx, cy, kind);
}
function edPaintSlope(cell, brush){
  var S = world();
  if (!ED.stroke){ ED.stroke = []; ED.strokeOrig = {}; }
  ED.stroke.push({ c: cell.c, r: cell.r });
  applySlopePlan(fitSlopeStroke(ED.stroke, brush));
  G.buildGates(S);
}
function applySlopePlan(plan){
  var keep = {}, i, p, k, cr;
  for (i = 0; i < plan.length; i++){
    p = plan[i];
    k = p.c + ':' + p.r;
    keep[k] = true;
    if (ED.strokeOrig[k] === undefined) ED.strokeOrig[k] = G.tileAt(p.c, p.r);
  }
  for (k in ED.strokeOrig){
    if (keep[k]) continue;
    cr = k.split(':');
    G.setTile(+cr[0], +cr[1], ED.strokeOrig[k]);
    delete ED.strokeOrig[k];
  }
  for (i = 0; i < plan.length; i++){
    p = plan[i];
    G.setTile(p.c, p.r, p.v);
  }
}
export function edExportText(){
  var S = world();
  var T = G.T;
  var lv = G.levelSpec(), out = [];
  out.push('// ' + lv.name + ': geometry (paste into build())');
  var runs = [];
  var r0 = G.mapMinR(), r1 = G.mapMaxR(), c0e = G.mapMinC(), c1e = G.mapMaxC();
  for (var r = r0; r < r1; r++){
    var c = c0e;
    while (c < c1e){
      var v = G.tileAt(c, r);
      if (v === 0){ c++; continue; }
      var n = 1;
      while (c + n < c1e && G.tileAt(c + n, r) === v) n++;
      runs.push('fillR(' + c + ', ' + r + ', ' + n + ', 1, ' + v + ');');
      c += n;
    }
  }
  out.push(runs.join('\n'));
  var varRuns = [];
  for (var rv = r0; rv < r1; rv++){
    var cv = c0e;
    while (cv < c1e){
      var vv = G.varAt(cv, rv);
      if (!vv){ cv++; continue; }
      var nv2 = 1;
      while (cv + nv2 < c1e && G.varAt(cv + nv2, rv) === vv) nv2++;
      varRuns.push('varR(' + cv + ', ' + rv + ', ' + nv2 + ', 1, ' + vv + ');');
      cv += nv2;
    }
  }
  if (varRuns.length){
    out.push('');
    out.push('// узоры (варианты рисунка, import varR из core/map.js)');
    out.push(varRuns.join('\n'));
  }
  out.push('');
  out.push('// objects');
  out.push('enemies: [' + S.enemies.map(function(e){
    var base = Math.round(e.x) + ',' + Math.round(e.y + e.h) + ',' +
      Math.round(e.x0) + ',' + Math.round(e.x1) + ',' + Math.round(e.v) + ',' + e.kind;
    if (e.loot && e.loot.length){
      var lootTxt = e.loot.map(function(x){ return "['" + x.kind + "'," + x.qty + ']'; }).join(',');
      base += ',[' + lootTxt + '],' + !!e.random;
    }
    return '[' + base + ']';
  }).join(',') + '],');
  out.push('fliers: [' + S.fliers.map(function(f){
    var fbase = Math.round(f.x) + ',' + Math.round(f.y) + ',' +
      Math.round(f.x0) + ',' + Math.round(f.x1) + ',' + Math.round(f.v) + ',' + f.kind;
    if (f.loot && f.loot.length){
      var flootTxt = f.loot.map(function(x){ return "['" + x.kind + "'," + x.qty + ']'; }).join(',');
      fbase += ',[' + flootTxt + '],' + !!f.random;
    }
    return '[' + fbase + ']';
  }).join(',') + '],');
  out.push('spiders: [' + S.spiders.map(function(s2){
    return '[' + Math.floor(s2.hx / T) + ',' + (Math.floor(s2.hy / T) - 1) + ',' + s2.kind + ']';
  }).join(',') + '],');
  out.push('tendrils: [' + (S.tendrils || []).map(function(td){
    var side = td.side || 0;
    var col = td.col, row = td.row;
    if (col === undefined){
      if (side === 1){ col = Math.floor(td.bx / T); row = Math.floor((td.by - 1) / T); }
      else if (side === 2){ col = Math.floor((td.bx - 1) / T); row = Math.floor(td.by / T); }
      else { col = Math.floor(td.bx / T); row = Math.floor(td.by / T); }
    }
    return side
      ? '[' + col + ',' + row + ',' + td.kind + ',' + side + ']'
      : '[' + col + ',' + row + ',' + td.kind + ']';
  }).join(',') + '],');
  out.push('torches: [' + S.torches.map(function(t){
    return '[' + Math.floor(t.x / T) + ',' + (Math.floor(t.y / T) - 1) + ']';
  }).join(',') + '],');
  out.push('boulders: [' + S.boulders.map(function(b){
    var row = Math.floor((b.x + 6) / T) + ',' + (Math.floor((b.y + 11) / T) - 1);
    if (b.pushV != null || b.friction != null || b.rollMax != null){
      row += ',' + (b.pushV != null ? b.pushV : BOULDER_DEF.pushV) +
        ',' + (b.friction != null ? b.friction : BOULDER_DEF.friction) +
        ',' + (b.rollMax != null ? b.rollMax : BOULDER_DEF.rollMax);
    }
    return '[' + row + ']';
  }).join(',') + '],');
  out.push('npcs: [' + (S.npcs || []).map(function(n){
    var row = '[' + Math.floor((n.x + 5) / T) + ',' + (Math.floor((n.y + 18) / T) - 1) +
      ",'" + (n.tree || 'hermit') + "'," + (n.facing != null ? n.facing : -1);
    if (n.dialog && n.dialog.nodes) row += ',' + JSON.stringify(n.dialog);
    return row + ']';
  }).join(',') + '],');
  out.push('chests: [' + S.chests.map(function(c2){
    var loot2 = c2.loot || [];
    var lootTxt = loot2.map(function(e){ return "['" + e.kind + "'," + e.qty + ']'; }).join(',');
    return '[' + Math.floor(c2.x / T) + ',' + (Math.floor(c2.y / T) - 1) + ",'" +
      ((loot2[0] && loot2[0].kind) || 'coin') + "'," + !!c2.locked + ',[' + lootTxt + '],' + !!c2.random + ']';
  }).join(',') + '],');
  out.push('items: [' + S.items.map(function(i2){
    return '[' + Math.floor(i2.x / T) + ',' + Math.floor(i2.y / T) + ",'" + i2.kind + "']";
  }).join(',') + '],');
  out.push('water: [' + waterExport().map(function(e){
    return '[' + e[0] + ',' + e[1] + ',' + e[2] + ']';
  }).join(',') + '],');
  out.push('lights: [' + (S.lights || []).map(function(L){
    var lspr = L.sprite || (L.lantern === false ? 'none' : 'lantern');
    return '{x:' + Math.round(L.x) + ',y:' + Math.round(L.y) +
      ",color:'" + (L.color || '#ffbe74') + "',intensity:" + (L.intensity != null ? L.intensity : 1) +
      ',radius:' + (L.radius || 82) + ',lantern:' + (lspr !== 'none') +
      ",sprite:'" + lspr + "'}";
  }).join(',') + '],');
  out.push('sounds: [' + (S.sounds || []).map(function(s){
    return '{x:' + Math.round(s.x) + ',y:' + Math.round(s.y) +
      ",mode:'" + (s.mode || 'falloff') + "',vol:" + (s.vol != null ? s.vol : 0.4) +
      ',radius:' + (s.radius || 96) + ',freq:' + (s.freq || 220) +
      ",type:'" + (s.type || 'sine') + "'}";
  }).join(',') + '],');
  out.push('volumes: [' + (S.volumes || []).map(function(v){
    return '{x:' + Math.round(v.x) + ',y:' + Math.round(v.y) + ',w:' + Math.round(v.w) +
      ',h:' + Math.round(v.h) + ',rot:' + (v.rot || 0).toFixed(3) +
      ",mode:'" + (v.mode || 'color') + "',mask:'" + (v.mask || 'circle') +
      "',hue:" + (v.hue || 0) + ',sat:' + (v.sat != null ? v.sat : 1) +
      ',bright:' + (v.bright || 0) + ',contrast:' + (v.contrast != null ? v.contrast : 1) +
      ",tint:'" + (v.tint || '#88a0ff') + "',tintAmt:" + (v.tintAmt || 0) + '}';
  }).join(',') + '],');
  var ls = getLayers();
  out.push('layers: [' + ls.map(function(L){
    var p = "{name:'" + L.name + "',kind:'" + (L.kind || 'tiles') +
      "',px:" + L.px + ',py:' + L.py +
      ',hue:' + (L.hue || 0) + ',sat:' + (L.sat == null ? 1 : L.sat) +
      ',bright:' + (L.bright || 0) + ',collide:' + !!L.collide;
    if (L.wrap) p += ',wrap:true,wrapW:' + (L.wrapW || 8) + ',wrapH:' + (L.wrapH || 8);
    if (L.kind === 'ridge')
      p += ',amp:' + L.amp + ',y0:' + L.y0 + ",color:'" + (L.color || '#2b2154') + "'";
    if (L.kind === 'fore')
      p += ',period:' + L.period + ',hmin:' + L.hmin + ',hmax:' + L.hmax +
        ",col:'" + (L.col || '#1b1436') + "',colD:'" + (L.colD || '#241a44') + "',seed:" + L.seed;
    return p + '}';
  }).join(',') + ']');
  return out.join('\n');
}
export function edDrawOverlay(){
  var T = G.T, z = ED.zoom || 1;
  var visW = VW / z, visH = VH / z;
  var P = layerParallax();
  var camx = cam.x * P.px, camy = cam.y * P.py;
  ctx.setTransform(z, 0, 0, z, 0, 0);
  var c0 = Math.floor(camx/T) - 1, c1 = Math.floor((camx+visW)/T) + 1;
  var r0 = Math.floor(camy/T) - 1, r1 = Math.floor((camy+visH)/T) + 1;
  ctx.globalAlpha = 0.22;
  for (var c = c0; c <= c1 + 1; c++) rc(c*T - camx, 0, 1, visH, '#8f88bb');
  for (var r = r0; r <= r1 + 1; r++) rc(0, r*T - camy, visW, 1, '#8f88bb');
  ctx.globalAlpha = 1;
  var Lg = getActiveLayer();
  if (Lg && Lg.wrap){
    var ww = Lg.wrapW || 8, wh = Lg.wrapH || 8;
    ctx.globalAlpha = 0.4;
    var gc = Math.floor(c0 / ww) * ww;
    var gr = Math.floor(r0 / wh) * wh;
    for (; gc <= c1 + 1; gc += ww) rc(gc*T - camx, 0, 1, visH, '#ffd9a0');
    for (; gr <= r1 + 1; gr += wh) rc(0, gr*T - camy, visW, 1, '#ffd9a0');
    ctx.globalAlpha = 1;
  }
  if (ED.cover){
    var Lc = getActiveLayer();
    var cc, rr, cv, ox, oy;
    for (rr = r0; rr <= r1; rr++){
      for (cc = c0; cc <= c1; cc++){
        cv = G.coverRaw(Lc, cc, rr);
        if (!cv) continue;
        ox = cc * T - camx; oy = rr * T - camy;
        ctx.globalAlpha = 0.22;
        rc(ox, oy, T, T, cv === G.COVER_AIR ? '#ffe08a' : '#b48cff');
        ctx.globalAlpha = 0.55;
        rc(ox, oy, T, 1, '#e8d6ff');
        rc(ox, oy, 1, T, '#e8d6ff');
      }
    }
    ctx.globalAlpha = 1;
  }
  var box = ED.boxing || ED.selTiles;
  if (box){
    var bc0 = Math.min(box.c0, box.c1), br0 = Math.min(box.r0, box.r1);
    var bc1 = Math.max(box.c0, box.c1), br1 = Math.max(box.r0, box.r1);
    var bx = bc0 * T - camx, by = br0 * T - camy;
    var bw = (bc1 - bc0 + 1) * T, bh = (br1 - br0 + 1) * T;
    ctx.globalAlpha = 0.12;
    rc(bx, by, bw, bh, '#ffd9a0');
    ctx.globalAlpha = 1;
    rc(bx, by, bw, 1, '#ffd9a0'); rc(bx, by + bh - 1, bw, 1, '#ffd9a0');
    rc(bx, by, 1, bh, '#ffd9a0'); rc(bx + bw - 1, by, 1, bh, '#ffd9a0');
  }
  if (ED.hover && !box){
    var hx = ED.hover.c*T - camx, hy = ED.hover.r*T - camy;
    rc(hx, hy, T, 2, '#ffd9a0'); rc(hx, hy + T - 2, T, 2, '#ffd9a0');
    rc(hx, hy, 2, T, '#ffd9a0'); rc(hx + T - 2, hy, 2, T, '#ffd9a0');
    if (brushDeco(ED.hover.c, ED.hover.r))
      rc(hx + 2, hy + 2, 3, 3, '#7fc47f');
  }
  var S = world();
  if (S) drawGizmos(S, ED.sel);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  rc(0, 0, VW, 9, '#0d0a18cc');
  var spec = ED.tool === 'tile' ? palSpec() : ED_OBJS[ED.pal];
  var label = spec ? spec.name : ED.tool;
  var L = getActiveLayer();
  if (L) label = L.name + (L.wrap ? ' ▦' : '') + ' · ' + label;
  if (L && !isTileLayer(L) && ED.tool === 'tile') label = L.name + ' · props only';
  if (L && L.locked) label = 'Locked';
  if (ED.cover && ED.tool === 'tile'){
    label = (coverLayerOk(L) ? 'Cover' : 'Cover · collide') + ' · ' + label;
    if (ED.stampCover) label = 'Stamp · ' + label;
  }
  if (spec && spec.overlay) label += ' · overlay';
  if (ED.selTiles && !ED.boxing) label = 'Select · move / Del';
  if (ED.boxing) label = 'Select';
  if (ED.moving) label = ED.moving.copy ? 'Copy tiles' : 'Move tiles';
  if (ED.clip && !ED.selTiles) label += ' · copied';
  if (ED.erasing) label = ED.cover ? 'Cover erase' : 'Erase';
  if (ED.dragObj) label = ED.dragObj.copied ? 'Copy · ' + ED.dragObj.entry.type : 'Move · ' + ED.dragObj.entry.type;
  if (ED.hover && G.isWaterV(brushTile(ED.hover.c, ED.hover.r)))
    label += ' · ' + shadePresetName(getPondShade(ED.hover.c, ED.hover.r));
  if (ED.hover && spec && spec.varN && tileMatchesBrush(spec, brushTile(ED.hover.c, ED.hover.r))){
    var hv = brushVar(ED.hover.c, ED.hover.r);
    label += ' · v' + (hv > 0 ? hv : 'auto') + '/' + spec.varN;
  }
  if (ED.hover && ED.tool === 'tile'){
    var hid = brushDeco(ED.hover.c, ED.hover.r);
    if (hid){
      var hs = specById(hid);
      label += ' · +' + (hs ? hs.name : hid);
    }
  }
  var col = ED.erasing ? '#ff7a6a' : (L && L.locked ? '#ff7a6a' : '#ffd9a0');
  for (var i = 0; i < label.length && i < 22; i++)
    rc(3 + i*5, 3, 4, 4, col);
}

function clearHold(){
  if (ED.holdT){ clearTimeout(ED.holdT); ED.holdT = null; }
  ED.holdErased = false;
}

function normBox(b){
  return {
    c0: Math.min(b.c0, b.c1), r0: Math.min(b.r0, b.r1),
    c1: Math.max(b.c0, b.c1), r1: Math.max(b.r0, b.r1)
  };
}
function inSelTiles(c, r){
  var b = ED.selTiles;
  if (!b) return false;
  var n = normBox(b);
  return c >= n.c0 && c <= n.c1 && r >= n.r0 && r <= n.r1;
}
function readCells(c0, r0, c1, r1){
  var L = getActiveLayer(), out = [], c, r;
  for (r = r0; r <= r1; r++)
    for (c = c0; c <= c1; c++)
      out.push({
        dc: c - c0, dr: r - r0,
        v: L ? layerTileRaw(L, c, r) : G.tileAt(c, r),
        va: L ? layerVarRaw(L, c, r) : G.varAt(c, r),
        d: brushDeco(c, r)
      });
  return out;
}
function writeCell(c, r, v, va, d){
  G.setTile(c, r, v || 0);
  if (va) G.setVar(c, r, va);
  G.setDeco(c, r, d || 0);
}
function eraseSelTiles(){
  if (!ED.selTiles) return;
  var b = normBox(ED.selTiles), c, r;
  for (r = b.r0; r <= b.r1; r++)
    for (c = b.c0; c <= b.c1; c++){
      G.setDeco(c, r, 0);
      G.setTile(c, r, 0);
    }
  G.buildGates(world());
  buildWater();
  markLevelDirty();
}
function copySelTiles(){
  if (!ED.selTiles) return;
  var b = normBox(ED.selTiles);
  ED.clip = {
    w: b.c1 - b.c0, h: b.r1 - b.r0,
    cells: readCells(b.c0, b.r0, b.c1, b.r1)
  };
}
function pasteSelTiles(){
  if (!ED.clip || !ED.hover) return;
  var c0 = ED.hover.c, r0 = ED.hover.r, i, p;
  beginOp();
  for (i = 0; i < ED.clip.cells.length; i++){
    p = ED.clip.cells[i];
    writeCell(c0 + p.dc, r0 + p.dr, p.v, p.va, p.d);
  }
  ED.selTiles = { c0: c0, r0: r0, c1: c0 + ED.clip.w, r1: r0 + ED.clip.h };
  G.buildGates(world());
  buildWater();
  markLevelDirty();
  endOp();
}
function beginMoveSel(cell, copy){
  var b = normBox(ED.selTiles);
  ED.moving = {
    cells: readCells(b.c0, b.r0, b.c1, b.r1),
    w: b.c1 - b.c0, h: b.r1 - b.r0,
    grabC: cell.c, grabR: cell.r,
    fromC: b.c0, fromR: b.r0,
    posC: b.c0, posR: b.r0,
    under: null,
    copy: !!copy
  };
}
function snapshotCell(c, r){
  var L = getActiveLayer();
  return {
    c: c, r: r,
    v: L ? layerTileRaw(L, c, r) : G.tileAt(c, r),
    va: L ? layerVarRaw(L, c, r) : G.varAt(c, r),
    d: brushDeco(c, r)
  };
}
function applyMoveSel(cell){
  var m = ED.moving;
  if (!m) return;
  var nc = m.fromC + (cell.c - m.grabC);
  var nr = m.fromR + (cell.r - m.grabR);
  if (nc === m.posC && nr === m.posR && m.under) return;
  var i, p, u;
  if (m.under){
    for (i = 0; i < m.under.length; i++){
      u = m.under[i];
      writeCell(u.c, u.r, u.v, u.va, u.d);
    }
  } else if (!m.copy){
    for (i = 0; i < m.cells.length; i++){
      p = m.cells[i];
      writeCell(m.fromC + p.dc, m.fromR + p.dr, 0, 0, 0);
    }
  }
  m.under = [];
  for (i = 0; i < m.cells.length; i++){
    p = m.cells[i];
    m.under.push(snapshotCell(nc + p.dc, nr + p.dr));
  }
  for (i = 0; i < m.cells.length; i++){
    p = m.cells[i];
    writeCell(nc + p.dc, nr + p.dr, p.v, p.va, p.d);
  }
  m.posC = nc; m.posR = nr;
  ED.selTiles = { c0: nc, r0: nr, c1: nc + m.w, r1: nr + m.h };
  markLevelDirty();
}

function startHold(cell, wcell){
  clearHold();
  ED.holdT = setTimeout(function(){
    ED.holdT = null;
    ED.holdErased = true;
    ED.erasing = true;
    ED.painting = true;
    ED.last = null;
    edErase(cell, wcell);
  }, HOLD_MS);
}

function findTilePal(v){
  if (!v) return 0;
  var tiles = palTiles(), i;
  for (i = 1; i < tiles.length; i++)
    if (tileMatchesBrush(tiles[i], v)) return i;
  return 0;
}
function findObjPal(type, obj){
  var i, k;
  for (i = 0; i < ED_OBJS.length; i++){
    k = ED_OBJS[i].kind;
    if (type === 'enemy' && k === 'enemy' + (obj.kind | 0)) return i;
    if (type === 'flier' && k === 'flier' + (obj.kind | 0)) return i;
    if (type === 'spider' && k === 'spider' + (obj.kind | 0)) return i;
    if (type === 'tendril' && k === 'tendril' + (obj.kind | 0)) return i;
    if (type === 'torch' && k === 'torch') return i;
    if (type === 'chest' && k === (obj.locked ? 'chestL' : 'chest')) return i;
    if (type === 'item' && k === obj.kind) return i;
    if (type === 'sound' && k === 'sound') return i;
    if (type === 'light' && k === 'light') return i;
    if (type === 'volume' && k === 'volume') return i;
    if (type === 'boulder' && k === 'boulder') return i;
    if (type === 'npc' && k === 'npc_' + (obj.tree || 'hermit')) return i;
  }
  return 0;
}
function eyedrop(e, cell, wcell){
  var hit = (ED.cover && ED.tool === 'tile') ? null : cycleHit(wcell.x, wcell.y);
  if (hit){
    setTab('obj');
    ED.pal = findObjPal(hit.type, hit.obj);
    applyHit(hit);
    edRefresh();
    return true;
  }
  var deco = brushDeco(cell.c, cell.r);
  var v = deco || brushTile(cell.c, cell.r);
  var pal = findTilePal(v);
  setTab('tile');
  ED.pal = pal;
  var spec = palTiles()[pal];
  if (spec && spec.varN && tileMatchesBrush(spec, v))
    openVarMenu(cell, spec, e.clientX, e.clientY);
  edRefresh();
  return true;
}

export function snapEditCam(){
  var z = ED.zoom || 1;
  cam.x = Math.round(cam.x * z) / z;
  cam.y = Math.round(cam.y * z) / z;
}
function nearestZoomIx(z){
  var best = 0, bd = 1e9, i;
  for (i = 0; i < ZOOM_STEPS.length; i++){
    var d = Math.abs(ZOOM_STEPS[i] - z);
    if (d < bd){ bd = d; best = i; }
  }
  return best;
}
function setZoom(next, sx, sy){
  var old = ED.zoom || 1;
  if (sx == null) sx = VW / 2;
  if (sy == null) sy = VH / 2;
  var wx = cam.x + sx / old, wy = cam.y + sy / old;
  ED.zoom = next;
  setViewScale(next);
  var cl = clampCam(wx - sx / next, wy - sy / next);
  cam.x = cl.x; cam.y = cl.y;
  snapEditCam();
}
function applyZoom(dir, sx, sy){
  var i = nearestZoomIx(ED.zoom);
  var j = Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir));
  if (ZOOM_STEPS[j] === ED.zoom){ snapEditCam(); return; }
  setZoom(ZOOM_STEPS[j], sx, sy);
}
function resetZoom(){
  var sx = VW / 2, sy = VH / 2;
  if (ED.hover && ED.hover.sx != null){ sx = ED.hover.sx; sy = ED.hover.sy; }
  setZoom(1, sx, sy);
}

function bumpIcon(dir){
  var n = Math.round(ED.icon + dir * 4);
  n = Math.max(ICON_MIN, Math.min(ICON_MAX, n));
  if (n === ED.icon) return;
  ED.icon = n;
  try { localStorage.setItem(IKEY, String(n)); } catch (_){}
  if (ED.tab === 'tile' || ED.tab === 'obj') fillPal();
}

cv.addEventListener('pointerdown', function(e){
  if (!ED.on) return;
  e.preventDefault();
  var cell = edCell(e.clientX, e.clientY, ED.tool === 'obj');
  var wcell = edCell(e.clientX, e.clientY, true);
  ED.hover = cell;
  if (e.button === 1){
    ED.panId = e.pointerId; ED.panX = e.clientX; ED.panY = e.clientY;
    ED.camX = cam.x; ED.camY = cam.y;
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (e.button === 2){
    closeVarMenu();
    beginOp();
    ED.erasing = true; ED.painting = true; ED.last = null; ED.stroke = null; ED.strokeOrig = null;
    edErase(cell, wcell);
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (e.button !== 0) return;
  closeVarMenu();
  closeChestAdd();
  closeChestList();
  closeNpcTalk();
  closeBoulderSettings();
  if (e.ctrlKey || e.metaKey){
    if (ED.tool !== 'tile' || ED.cover){
      eyedrop(e, cell, wcell);
      return;
    }
    ED.ctrlGest = { x: e.clientX, y: e.clientY, cell: cell, wcell: wcell };
    ED.boxing = null;
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (ED.selTiles && ED.tool === 'tile' && !ED.cover && inSelTiles(cell.c, cell.r)){
    beginOp();
    beginMoveSel(cell, !!e.shiftKey);
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (ED.selTiles){
    ED.selTiles = null;
  }
  ED.stampCover = !!e.altKey;
  var S0 = world();
  var hits = findAllAt(wcell.x, wcell.y);
  var giz = S0 && hitGizmo(S0, ED.sel, wcell.x, wcell.y);
  if (giz && giz.kind !== 'move'){
    beginOp();
    ED.giz = true;
    beginGizmo(giz, wcell.x, wcell.y);
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (hits.length > 1){
    var npcHit = null, hi;
    for (hi = 0; hi < hits.length; hi++) if (hits[hi].type === 'npc'){ npcHit = hits[hi]; break; }
    applyHit(npcHit || cycleHit(wcell.x, wcell.y));
    ED.pendHit = { hit: ED.hitObj, x: e.clientX, y: e.clientY, c: wcell.c, r: wcell.r, single: !npcHit };
    ED.painting = false;
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (giz){
    beginOp();
    ED.giz = true;
    applyHit({ type: giz.type, obj: giz.obj });
    beginGizmo(giz, wcell.x, wcell.y);
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  if (hits.length === 1){
    applyHit(hits[0]);
    ED.pendHit = { hit: hits[0], x: e.clientX, y: e.clientY, c: wcell.c, r: wcell.r, single: true };
    ED.painting = false;
    try { cv.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  beginOp();
  ED.painting = true; ED.erasing = false; ED.last = null; ED.stroke = null; ED.strokeOrig = null;
  ED.holdX = e.clientX; ED.holdY = e.clientY;
  var ospec0 = ED.tool === 'obj' ? ED_OBJS[ED.pal] : null;
  if (!(ospec0 && isSpecialKind(ospec0.kind))) startHold(cell, wcell);
  edApply(cell, true);
  ED.clickCell = cell.c + ':' + cell.r;
  ED.clickBrush = ED.pal;
  try { cv.setPointerCapture(e.pointerId); } catch(_){}
});
cv.addEventListener('pointermove', function(e){
  if (!ED.on) return;
  var cell = edCell(e.clientX, e.clientY, ED.tool === 'obj');
  var wcell = edCell(e.clientX, e.clientY, true);
  ED.hover = cell;
  if (ED.ctrlGest){
    if (Math.abs(e.clientX - ED.ctrlGest.x) > 4 || Math.abs(e.clientY - ED.ctrlGest.y) > 4){
      var a = ED.ctrlGest.cell;
      ED.boxing = { c0: a.c, r0: a.r, c1: cell.c, r1: cell.r };
    }
    return;
  }
  if (ED.moving){
    applyMoveSel(cell);
    return;
  }
  if (ED.pendHit){
    if (Math.abs(e.clientX - ED.pendHit.x) > 4 || Math.abs(e.clientY - ED.pendHit.y) > 4){
      var ph = ED.pendHit;
      ED.pendHit = null;
      beginOp();
      if (isSpecialKind(ph.hit.type)){
        ED.giz = true;
        beginGizmo({ kind: 'move', type: ph.hit.type, obj: ph.hit.obj }, wcell.x, wcell.y);
      } else {
        ED.dragObj = { entry: ph.hit, at: { c: ph.c, r: ph.r }, copied: false };
      }
    } else return;
  }
  if (ED.giz && gizmoActive()){
    moveGizmo(wcell.x, wcell.y);
    if (ED.sel) showInspect(ED.sel);
    markLevelDirty();
    return;
  }
  if (ED.dragObj){
    if (wcell.c !== ED.dragObj.at.c || wcell.r !== ED.dragObj.at.r){
      ED.dragObj.entry = moveObjectTo(ED.dragObj.entry, wcell);
      ED.dragObj.at = { c: wcell.c, r: wcell.r };
      markLevelDirty();
    }
    return;
  }
  if (ED.panId === e.pointerId){
    var r = cv.getBoundingClientRect();
    var z = ED.zoom || 1;
    var cl = clampCam(ED.camX - (e.clientX - ED.panX) / r.width * VW / z,
                      ED.camY - (e.clientY - ED.panY) / r.height * VH / z);
    cam.x = cl.x; cam.y = cl.y;
    snapEditCam();
    return;
  }
  if (ED.holdT && (Math.abs(e.clientX - ED.holdX) > 5 || Math.abs(e.clientY - ED.holdY) > 5))
    clearHold();
  if (ED.erasing && ED.painting) edErase(cell, wcell);
  else if (ED.painting && !ED.holdErased) edApply(cell, false);
});
function edUp(e){
  if (e && e.pointerId === ED.panId) ED.panId = -1;
  if (ED.ctrlGest){
    if (ED.boxing) ED.selTiles = normBox(ED.boxing);
    else if (e && e.type === 'pointerup') eyedrop(e, ED.ctrlGest.cell, ED.ctrlGest.wcell);
    ED.ctrlGest = null;
    ED.boxing = null;
  }
  if (ED.moving){
    if (world()) G.buildGates(world());
    buildWater();
    ED.moving = null;
  }
  if (e && e.type === 'pointerup' && ED.pendHit){
    var ph = ED.pendHit.hit;
    if (ph && (ph.type === 'chest' || ph.type === 'enemy' || ph.type === 'flier') && ED.pendHit.single)
      openChestList(ph.obj, ph.type, ED.pendHit.x, ED.pendHit.y);
    else if (ph && ph.type === 'npc')
      openNpcTalk(ph.obj, ED.pendHit.x, ED.pendHit.y);
    else if (ph && ph.type === 'boulder')
      openBoulderSettings(ph.obj, ED.pendHit.x, ED.pendHit.y);
  }
  ED.dragObj = null;
  ED.pendHit = null;
  ED.painting = false; ED.erasing = false;
  ED.stampCover = false;
  ED.last = null; ED.stroke = null; ED.strokeOrig = null;
  ED.giz = false;
  endGizmo();
  clearHold();
  endOp();
}
cv.addEventListener('pointerup', edUp);
cv.addEventListener('pointercancel', edUp);
cv.addEventListener('dblclick', function(e){
  if (!ED.on) return;
  var wcell = edCell(e.clientX, e.clientY, true);
  var sd = spriteDefForHit(findObjectAt(wcell.x, wcell.y));
  if (sd){
    e.preventDefault();
    openSpriteEdit(sd, e.clientX, e.clientY);
    return;
  }
  if (ED.tool !== 'tile') return;
  var cell = edCell(e.clientX, e.clientY);
  var deco = brushDeco(cell.c, cell.r);
  var v = deco || brushTile(cell.c, cell.r);
  var pal = findTilePal(v);
  var spec = palTiles()[pal];
  if (spec && spec.id){
    ED.pal = pal;
    openTileEdit(spec, e.clientX, e.clientY);
    edRefresh();
  }
});
cv.addEventListener('contextmenu', function(e){ if (ED.on) e.preventDefault(); });
cv.addEventListener('auxclick', function(e){ if (ED.on) e.preventDefault(); });
cv.addEventListener('wheel', function(e){
  if (!ED.on) return;
  e.preventDefault();
  if (e.ctrlKey && ED.tab === 'obj'){
    bumpIcon(e.deltaY < 0 ? 1 : -1);
    return;
  }
  var cell = edCell(e.clientX, e.clientY);
  applyZoom(e.deltaY < 0 ? 1 : -1, cell.sx, cell.sy);
}, { passive: false });

if (edBar){
  edBar.addEventListener('wheel', function(e){
    if (!ED.on) return;
    if (e.ctrlKey && (ED.tab === 'obj' || ED.tab === 'tile')){
      e.preventDefault();
      bumpIcon(e.deltaY < 0 ? 1 : -1);
    }
  }, { passive: false });
  var tabRow = edBar.querySelector('.ed-tabs');
  if (tabRow){
    tabRow.addEventListener('click', function(e){
      var t = e.target.closest('.ed-tab');
      if (!t) return;
      setTab(t.getAttribute('data-tab'));
    });
  }
}

if (edParamQ){
  edParamQ.addEventListener('input', function(){ showParams(); });
  edParamQ.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ e.stopPropagation(); edClose(); }
  });
}
var edReset = document.getElementById('edParamReset');
if (edReset) edReset.addEventListener('click', function(){ resetAllParams(); showParams(); });

function restoreHeight(){
  try {
    var h = +localStorage.getItem(HKEY);
    if (h >= 120 && h <= innerHeight * 0.8) edBar.style.height = h + 'px';
  } catch (_){}
}
function bindResize(){
  var bar = document.getElementById('edResize');
  if (!bar) return;
  var drag = null;
  bar.addEventListener('pointerdown', function(e){
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { y: e.clientY, h: edBar.getBoundingClientRect().height };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', function(e){
    if (!drag) return;
    var nh = Math.max(120, Math.min(innerHeight * 0.8, drag.h - (e.clientY - drag.y)));
    edBar.style.height = nh + 'px';
  });
  function end(){
    if (!drag) return;
    drag = null;
    try { localStorage.setItem(HKEY, String(Math.round(edBar.getBoundingClientRect().height))); } catch (_){}
  }
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}
bindResize();
restoreHeight();

addEventListener('keydown', function(e){
  var tag = (e.target && e.target.tagName) || '';
  if (e.key === 'Tab'){
    if (tag === 'INPUT' && e.target.id === 'edParamQ' && ED.on){
      e.preventDefault();
      edClose();
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (isMenu() && !ED.on) return;
    e.preventDefault();
    edToggle();
    return;
  }
  if (e.key === 'Escape' && ED.on){
    e.preventDefault();
    e.stopImmediatePropagation();
    var te = document.getElementById('edTileEdit');
    if (te && !te.hidden){ closeTileEdit(); return; }
    if (ED.selTiles){ ED.selTiles = null; return; }
    edClose();
    return;
  }
  if (ED.on && (e.key === '0' || e.code === 'Numpad0')){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    resetZoom();
  }
  if (ED.on && (e.key === 'g' || e.key === 'G')){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    toggleGeo();
  }
  if (ED.on && (e.key === 'Delete' || e.key === 'Backspace') && ED.selTiles && ED.tool === 'tile'){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    beginOp();
    eraseSelTiles();
    ED.selTiles = null;
    endOp();
    return;
  }
  if (ED.on && e.key === 'Delete' && ED.sel && ED.sel.obj){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    beginOp();
    deleteSelected();
    markLevelDirty();
    endOp();
  }
  if (ED.on && (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && ED.selTiles){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    copySelTiles();
    return;
  }
  if (ED.on && (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && ED.clip){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    pasteSelTiles();
    return;
  }
  if (ED.on && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')){
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (e.key === 'y' || e.key === 'Y' || e.shiftKey) redoOp();
    else undoOp();
  }
}, true);

var bUndo = document.getElementById('edUndo');
var bRedo = document.getElementById('edRedo');
if (bUndo) bUndo.addEventListener('click', function(){ undoOp(); });
if (bRedo) bRedo.addEventListener('click', function(){ redoOp(); });
syncUndoBtns();

function isImageFile(f){
  return !!(f && (f.type && f.type.indexOf('image/') === 0 || /\.(png|gif|webp|jpe?g)$/i.test(f.name || '')));
}
function importImageFiles(files){
  var list = [], i;
  for (i = 0; i < files.length; i++) if (isImageFile(files[i])) list.push(files[i]);
  if (!list.length) return Promise.resolve();
  setTab('tile');
  var chain = Promise.resolve(), added = [];
  list.forEach(function(file){
    chain = chain.then(function(){
      return loadImageFile(file).then(function(img){
        var slices = sliceSheet(img, file.name);
        var j, jobs = [];
        for (j = 0; j < slices.length; j++){
          jobs.push((function(sl){
            return guessOverlay(sl.src).then(function(ov){
              var t = addTile({
                name: sl.name,
                src: sl.src,
                overlay: ov,
                collide: ov ? 'none' : 'full'
              });
              if (t) added.push(t);
            });
          })(slices[j]));
        }
        return Promise.all(jobs);
      });
    });
  });
  return chain.then(function(){
    if (!added.length) return;
    var tiles = palTiles();
    ED.pal = Math.max(0, tiles.length - added.length);
    ED.tool = 'tile';
    clearThumbCache();
    invalidateAll();
    edRefresh();
    if (added[0]) openTileEdit({
      name: added[0].name, id: added[0].id, custom: true,
      overlay: added[0].overlay, src: added[0].src
    });
  }).catch(function(){});
}
function onEditorDragOver(e){
  if (!ED.on) return;
  var dt = e.dataTransfer;
  if (!dt) return;
  var has = false, i;
  if (dt.types){
    for (i = 0; i < dt.types.length; i++)
      if (dt.types[i] === 'Files') has = true;
  }
  if (!has) return;
  e.preventDefault();
  dt.dropEffect = 'copy';
}
function onEditorDrop(e){
  if (!ED.on) return;
  var files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return;
  var any = false, i;
  for (i = 0; i < files.length; i++) if (isImageFile(files[i])) any = true;
  if (!any) return;
  e.preventDefault();
  e.stopPropagation();
  importImageFiles(files);
}
window.addEventListener('dragover', onEditorDragOver);
window.addEventListener('drop', onEditorDrop);

function deleteSelected(){
  var S = world();
  if (!S || !ED.sel) return;
  var t = ED.sel.type, o = ED.sel.obj;
  if (t === 'light') S.lights = (S.lights || []).filter(function(x){ return x !== o; });
  else if (t === 'sound') S.sounds = (S.sounds || []).filter(function(x){ return x !== o; });
  else if (t === 'volume') S.volumes = (S.volumes || []).filter(function(x){ return x !== o; });
  selectSpecial(null);
}

function toggleGeo(){
  ED.showGeo = !ED.showGeo;
  try { localStorage.setItem(GKEY, ED.showGeo ? '1' : '0'); } catch (_){}
  syncGeoBtn();
}
function syncGeoBtn(){
  var b = document.getElementById('edGeo');
  if (b) b.classList.toggle('on', !!ED.showGeo);
}
function toggleCover(){
  ED.cover = !ED.cover;
  setEditorRooms(ED.cover);
  syncCoverBtn();
}
function syncCoverBtn(){
  var b = document.getElementById('edCover');
  if (b) b.classList.toggle('on', !!ED.cover);
}

var bGeo = document.getElementById('edGeo');
if (bGeo) bGeo.addEventListener('click', function(){ toggleGeo(); });
var bCover = document.getElementById('edCover');
if (bCover) bCover.addEventListener('click', function(){ toggleCover(); });

var bEdit = document.getElementById('bEdit');
if (bEdit) bEdit.addEventListener('click', function(){
  if (isMenu()) return;
  edToggle();
});
document.getElementById('edClose').addEventListener('click', function(){ edClose(); });
document.getElementById('edExport').addEventListener('click', function(){
  edText.value = edExportText();
  edOut.classList.add('on');
  try { edText.select(); } catch(_){}
});
document.getElementById('edOk').addEventListener('click', function(){ edOut.classList.remove('on'); });
function downloadBakeJson(data){
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'ledge-bake.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

var bBake = document.getElementById('edBake');
if (bBake) bBake.addEventListener('click', function(){
  flushLevel(world());
  bBake.disabled = true;
  pushBake({ full: true, silent: false, timeout: 4000 }).then(function(res){
    bBake.disabled = false;
    edText.value = 'Baked OK — src/core/defaults.js updated.\nLevels: ' + res.levels;
    edOut.classList.add('on');
  }).catch(function(err){
    bBake.disabled = false;
    downloadBakeJson(collectFull());
    edText.value = 'Live write failed (' + (err && err.timedOut ? 'timeout' : err) + ').\n' +
      'Editor already autosaves levels/params into defaults.js while the dev server runs.\n' +
      'If this keeps failing, restart start-dev-server.bat.';
    edOut.classList.add('on');
  });
});
var bNew = document.getElementById('edNew');
if (bNew) bNew.addEventListener('click', function(){
  if (onNewLevel) onNewLevel();
});
var bDel = document.getElementById('edDel');
if (bDel) bDel.addEventListener('click', function(){
  if (onDelLevel) onDelLevel();
});

function flushBakeQuiet(){
  flushLevel(world());
  pushBake({ silent: true }).catch(function(){});
}
document.addEventListener('visibilitychange', function(){
  if (document.hidden) flushBakeQuiet();
});
addEventListener('pagehide', flushBakeQuiet);
