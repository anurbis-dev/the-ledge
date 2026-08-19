import { T } from './constants.js';
import { runtime } from './runtime.js';
import { stashLayers } from './layers.js';
import { BAKED } from './defaults.js';
import { BOULDER_DEF } from '../entities/boulders.js';

var KEY = 'ledge.dev.levels';
var SAVED_KEY = 'ledge.dev.savedAt';
var dirty = false;
var saveT = null;
var waterFn = null;
var afterFlush = null;

export function bindPersist(hooks){
  waterFn = hooks && hooks.water;
  afterFlush = hooks && hooks.onFlush;
}

export function notifyDraftChange(){
  touchSavedAt();
  if (afterFlush) afterFlush();
}

export function touchSavedAt(){
  var t = Date.now();
  try { localStorage.setItem(SAVED_KEY, String(t)); } catch (_){}
  return t;
}

export function localSavedAt(){
  try { return +localStorage.getItem(SAVED_KEY) || 0; } catch (_){ return 0; }
}

export function bakedSavedAt(){
  return +BAKED.savedAt || 0;
}

/* localStorage — черновик этого origin. BAKED — то, что уедет в dist.
   file:// без метки времени = старый overlay, его игнорируем (иначе dist
   расходится с vite). С меткой — новее побеждает. */
export function preferLocal(){
  var localT = localSavedAt();
  var bakedT = bakedSavedAt();
  if (!localT){
    var store = readStore();
    var has = false, k;
    if (store){
      for (k in store) if (k !== '_gone'){ has = true; break; }
    }
    if (!has) return false;
    try { if (location.protocol === 'file:') return false; } catch (_){}
    return true;
  }
  if (!bakedT) return true;
  return localT >= bakedT;
}

function keyOf(lv){
  if (!lv) return '';
  return String(lv.id != null ? lv.id : lv.name || '');
}

function packU8(u8){
  if (!u8) return null;
  var a = new Array(u8.length), i;
  for (i = 0; i < u8.length; i++) a[i] = u8[i];
  return a;
}
function unpackU8(a){
  if (!a) return null;
  if (a.length != null) return new Uint8Array(a);
  var keys = Object.keys(a), n = 0, i, out;
  for (i = 0; i < keys.length; i++){
    var k = +keys[i];
    if (k + 1 > n) n = k + 1;
  }
  out = new Uint8Array(n);
  for (i = 0; i < keys.length; i++) out[+keys[i]] = a[keys[i]] | 0;
  return out;
}

function packStash(s){
  if (!s) return null;
  return {
    originC: s.originC, originR: s.originR, w: s.w, h: s.h,
    active: s.active, solo: s.solo, decor: s.decor,
    layers: (s.layers || []).map(function(L){
      var o = {};
      for (var k in L){
        if (k === 'base' || k === 'vary' || k === 'deco' || k === 'tint' || k === 'cover' || k === 'coverVary' || k === 'stamp' || k === 'stampVar' || k === 'stampDeco' || k === 'stampTint')
          o[k] = packU8(L[k]);
        else if (k === 'roomOf') continue;
        else if (k.charAt(0) !== '_' || k === '_stampW' || k === '_stampH')
          o[k] = L[k];
      }
      return o;
    })
  };
}
function unpackStash(s){
  if (!s) return null;
  return {
    originC: s.originC, originR: s.originR, w: s.w, h: s.h,
    active: s.active, solo: s.solo, decor: s.decor,
    layers: (s.layers || []).map(function(L){
      var o = {};
      for (var k in L){
        if (k === 'base' || k === 'vary' || k === 'deco' || k === 'tint' || k === 'cover' || k === 'coverVary' || k === 'stamp' || k === 'stampVar' || k === 'stampDeco' || k === 'stampTint')
          o[k] = unpackU8(L[k]);
        else o[k] = L[k];
      }
      return o;
    })
  };
}

function dumpItems(lv){
  if (!lv || !lv.items) return [];
  if (typeof lv.items === 'function') return lv.items();
  return lv.items;
}

function packLevel(lv){
  return {
    id: lv.id, name: lv.name, pal: lv.pal, blank: !!lv.blank,
    intro: lv.intro || '',
    gearDurability: lv.gearDurability || {},
    w: lv.w, h: lv.h,
    spawn: lv.spawn, exit: lv.exit,
    enemies: lv.enemies || [],
    fliers: lv.fliers || [],
    spiders: lv.spiders || [],
    tendrils: lv.tendrils || [],
    torches: lv.torches || [],
    chests: lv.chests || [],
    npcs: lv.npcs || [],
    items: dumpItems(lv),
    lights: lv.lights || [],
    sounds: lv.sounds || [],
    volumes: lv.volumes || [],
    water: lv.water || [],
    doors: lv.doors || [],
    lifts: lv.lifts || [],
    plats: lv.plats || [],
    dark: lv.dark || [],
    boulders: lv.boulders || [],
    stick: lv.stick || null,
    key: lv.key || null,
    stash: packStash(lv._stash)
  };
}

function applyRecord(lv, rec){
  if (!lv || !rec) return;
  if (rec.enemies) lv.enemies = rec.enemies;
  if (rec.fliers) lv.fliers = rec.fliers;
  if (rec.spiders) lv.spiders = rec.spiders;
  if (rec.tendrils) lv.tendrils = rec.tendrils;
  if (rec.torches) lv.torches = rec.torches;
  if (rec.chests) lv.chests = rec.chests;
  if (rec.npcs) lv.npcs = rec.npcs;
  if (rec.items){
    var items = rec.items;
    lv.items = function(){ return items.map(function(a){ return a.slice(); }); };
  }
  if (rec.lights) lv.lights = rec.lights;
  if (rec.sounds) lv.sounds = rec.sounds;
  if (rec.volumes) lv.volumes = rec.volumes;
  if (rec.water) lv.water = rec.water;
  if (rec.spawn) lv.spawn = rec.spawn;
  if (rec.exit) lv.exit = rec.exit;
  if (rec.intro != null) lv.intro = rec.intro;
  if (rec.gearDurability) lv.gearDurability = rec.gearDurability;
  if (rec.w) lv.w = rec.w;
  if (rec.h) lv.h = rec.h;
  if (rec.name) lv.name = rec.name;
  if (rec.pal) lv.pal = rec.pal;
  if (rec.doors) lv.doors = rec.doors;
  if (rec.lifts) lv.lifts = rec.lifts;
  if (rec.plats) lv.plats = rec.plats;
  if (rec.dark) lv.dark = rec.dark;
  if (rec.boulders) lv.boulders = rec.boulders;
  if (rec.stick) lv.stick = rec.stick;
  if (rec.key) lv.key = rec.key;
  if (rec.stash) lv._stash = unpackStash(rec.stash);
}

function makeBlank(rec){
  var items = rec.items || [];
  return {
    id: rec.id, name: rec.name || 'LEVEL', pal: rec.pal || 'stone',
    w: rec.w || 16, h: rec.h || 16, blank: true,
    intro: rec.intro || '',
    gearDurability: rec.gearDurability || {},
    spawn: rec.spawn || { x: 16, y: 6 * T - 22 },
    exit: rec.exit || { x: 12 * T, y: 8 * T },
    lights: rec.lights || [], sounds: rec.sounds || [], volumes: rec.volumes || [],
    items: function(){ return items.map(function(a){ return a.slice(); }); },
    enemies: rec.enemies || [], fliers: rec.fliers || [],
    spiders: rec.spiders || [], tendrils: rec.tendrils || [],
    torches: rec.torches || [], chests: rec.chests || [], npcs: rec.npcs || [],
    doors: rec.doors || [], lifts: rec.lifts || [], plats: rec.plats || [], dark: rec.dark || [],
    boulders: rec.boulders || [],
    water: rec.water || [],
    stick: rec.stick || { x: 40, y: 8 * T - 6 },
    key: rec.key || { x: 56, y: 8 * T - 6 },
    build: function(){},
    _stash: rec.stash ? unpackStash(rec.stash) : null
  };
}

function readStore(){
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_){ return null; }
}

export function levelsStoreSnapshot(){
  return readStore();
}

function mergedStore(){
  var baked = BAKED.levels, local = readStore();
  if (!baked) return local;
  if (!local) return baked;
  var out = {}, k, gone = {};
  for (k in baked) if (k !== '_gone') out[k] = baked[k];
  for (k in local) if (k !== '_gone') out[k] = local[k];
  (baked._gone || []).forEach(function(id){ gone[id] = 1; });
  (local._gone || []).forEach(function(id){ gone[id] = 1; });
  out._gone = Object.keys(gone);
  return out;
}

function writeStore(store){
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_){}
}

function writeObjects(lv, S){
  if (!lv || !S) return;
  lv.enemies = (S.enemies || []).filter(function(e){ return !e.dead; }).map(function(e){
    var t = [Math.round(e.x), Math.round(e.y + e.h), Math.round(e.x0), Math.round(e.x1),
             Math.round(e.v), e.kind];
    if (e.loot && e.loot.length){
      t.push(e.loot.map(function(x){ return [x.kind, x.qty]; }));
      t.push(!!e.random);
    }
    return t;
  });
  lv.fliers = (S.fliers || []).map(function(f){
    var t = [Math.round(f.x), Math.round(f.y), Math.round(f.x0), Math.round(f.x1),
             Math.round(f.v), f.kind];
    if (f.loot && f.loot.length){
      t.push(f.loot.map(function(x){ return [x.kind, x.qty]; }));
      t.push(!!f.random);
    }
    return t;
  });
  lv.spiders = (S.spiders || []).filter(function(s){ return !s.dead; }).map(function(s){
    return [Math.floor(s.hx / T), Math.floor(s.hy / T) - 1, s.kind];
  });
  lv.tendrils = (S.tendrils || []).filter(function(td){ return !td.dead; }).map(function(td){
    var col = td.col, row = td.row, side = td.side || 0;
    if (col === undefined){
      if (side === 1){ col = Math.floor(td.bx / T); row = Math.floor((td.by - 1) / T); }
      else if (side === 2){ col = Math.floor((td.bx - 1) / T); row = Math.floor(td.by / T); }
      else { col = Math.floor(td.bx / T); row = Math.floor(td.by / T); }
    }
    return side ? [col, row, td.kind, side] : [col, row, td.kind];
  });
  lv.torches = (S.torches || []).filter(function(t){ return !t.held; }).map(function(t){
    return [Math.floor(t.x / T), Math.floor(t.y / T) - 1];
  });
  lv.chests = (S.chests || []).map(function(c){
    var loot = c.loot || [];
    return [Math.floor(c.x / T), Math.floor(c.y / T) - 1,
            (loot[0] && loot[0].kind) || 'coin', !!c.locked,
            loot.map(function(e){ return [e.kind, e.qty]; }), !!c.random];
  });
  lv.npcs = (S.npcs || []).map(function(n){
    var row = [Math.floor((n.x + 5) / T), Math.floor((n.y + 18) / T) - 1,
               n.tree || 'hermit', n.facing != null ? n.facing : -1];
    if (n.dialog && n.dialog.nodes) row.push(JSON.parse(JSON.stringify(n.dialog)));
    return row;
  });
  var items = (S.items || []).filter(function(it){ return !it.got; }).map(function(it){
    return [Math.floor(it.x / T), Math.floor(it.y / T), it.kind];
  });
  lv.items = function(){ return items.map(function(a){ return a.slice(); }); };
  lv.lights = (S.lights || []).map(function(L){
    var sprite = L.sprite || (L.lantern === false ? 'none' : 'lantern');
    return {
      x: L.x, y: L.y, color: L.color, intensity: L.intensity,
      radius: L.radius, lantern: sprite !== 'none', sprite: sprite, id: L.id
    };
  });
  lv.sounds = (S.sounds || []).map(function(s){
    return {
      x: s.x, y: s.y, mode: s.mode, vol: s.vol, radius: s.radius,
      freq: s.freq, type: s.type, id: s.id
    };
  });
  lv.volumes = (S.volumes || []).map(function(v){
    return {
      x: v.x, y: v.y, w: v.w, h: v.h, rot: v.rot, mode: v.mode, mask: v.mask,
      hue: v.hue, sat: v.sat, bright: v.bright, contrast: v.contrast,
      tint: v.tint, tintAmt: v.tintAmt, id: v.id
    };
  });
  lv.doors = (S.doors || []).map(function(d){
    return { id: d.id, x: d.x, y: d.y, locked: !!d.locked, pair: d.pair, tag: d.tag };
  });
  lv.lifts = (S.lifts || []).map(function(L){
    var floors = (L.floors || []).slice();
    return {
      x: L.x, w: L.w, hh: L.hh,
      y: floors.length ? floors[0] : L.y,
      floors: floors
    };
  });
  lv.plats = (S.plats || []).map(function(q){
    return {
      x: q.vert ? q.x : (q.x0 != null ? q.x0 : q.x),
      y: q.vert ? (q.y0 != null ? q.y0 : q.y) : q.y,
      w: q.w, h: q.h,
      x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1,
      v: q.v, dir: q.dir, vert: !!q.vert
    };
  });
  lv.dark = (S.dark || []).map(function(d){
    return { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, doorId: d.doorId, lit: d.lit };
  });
  lv.boulders = (S.boulders || []).map(function(b){
    var row = [Math.floor((b.x + 6) / T), Math.floor((b.y + 11) / T) - 1];
    if (b.pushV != null || b.friction != null || b.rollMax != null){
      row.push(b.pushV != null ? b.pushV : BOULDER_DEF.pushV);
      row.push(b.friction != null ? b.friction : BOULDER_DEF.friction);
      row.push(b.rollMax != null ? b.rollMax : BOULDER_DEF.rollMax);
    }
    return row;
  });
  if (S.pick && S.pick.stick) lv.stick = { x: S.pick.stick.x, y: S.pick.stick.y };
  if (S.pick && S.pick.key) lv.key = { x: S.pick.key.x, y: S.pick.key.y };
}

export function markLevelDirty(){
  dirty = true;
  if (saveT) clearTimeout(saveT);
  saveT = setTimeout(function(){
    saveT = null;
    flushLevel(runtime.W);
  }, 280);
}

export function flushLevel(S){
  if (saveT){ clearTimeout(saveT); saveT = null; }
  if (!runtime.LV) return;
  stashLayers(runtime.LV);
  if (dirty && S) writeObjects(runtime.LV, S);
  if (waterFn && runtime.LV) runtime.LV.water = waterFn();
  var store = readStore() || {};
  store[keyOf(runtime.LV)] = packLevel(runtime.LV);
  writeStore(store);
  var wasDirty = dirty;
  dirty = false;
  if (wasDirty){
    touchSavedAt();
    if (afterFlush) afterFlush();
  }
}

export function forgetLevel(lv){
  if (!lv) return;
  var store = readStore() || {};
  var k = keyOf(lv);
  delete store[k];
  if (!lv.blank){
    if (!store._gone) store._gone = [];
    if (store._gone.indexOf(k) < 0) store._gone.push(k);
  }
  writeStore(store);
}

export function hydrateAll(levels){
  if (!levels) return;
  var store = preferLocal() ? mergedStore() : (BAKED.levels || null);
  if (!store) return;
  var gone = {}, seen = {}, i, k, rec;
  (store._gone || []).forEach(function(id){ gone[id] = 1; });
  for (i = levels.length - 1; i >= 0; i--){
    if (gone[keyOf(levels[i])] && levels.length > 1) levels.splice(i, 1);
  }
  for (i = 0; i < levels.length; i++){
    k = keyOf(levels[i]);
    seen[k] = 1;
    rec = store[k];
    if (rec) applyRecord(levels[i], rec);
  }
  for (k in store){
    if (k === '_gone') continue;
    rec = store[k];
    if (!rec || seen[k] || gone[k]) continue;
    if (rec.blank || rec.stash) levels.push(makeBlank(rec));
  }
}
