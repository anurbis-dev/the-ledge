import { T } from './constants.js';
import { runtime } from './runtime.js';
import { stashLayers } from './layers.js';

var KEY = 'ledge.dev.levels';
var dirty = false;
var saveT = null;
var waterFn = null;

export function bindPersist(hooks){
  waterFn = hooks && hooks.water;
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
        if (k === 'base' || k === 'vary' || k === 'stamp' || k === 'stampVar')
          o[k] = packU8(L[k]);
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
        if (k === 'base' || k === 'vary' || k === 'stamp' || k === 'stampVar')
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
  if (rec.stash) lv._stash = unpackStash(rec.stash);
}

function makeBlank(rec){
  var items = rec.items || [];
  return {
    id: rec.id, name: rec.name || 'LEVEL', pal: rec.pal || 'stone',
    w: rec.w || 16, h: rec.h || 16, blank: true,
    intro: rec.intro || '',
    spawn: rec.spawn || { x: 16, y: 6 * T - 22 },
    exit: rec.exit || { x: 12 * T, y: 8 * T },
    lights: rec.lights || [], sounds: rec.sounds || [], volumes: rec.volumes || [],
    items: function(){ return items.map(function(a){ return a.slice(); }); },
    enemies: rec.enemies || [], fliers: rec.fliers || [],
    spiders: rec.spiders || [], tendrils: rec.tendrils || [],
    torches: rec.torches || [], chests: rec.chests || [], npcs: rec.npcs || [],
    doors: [], lifts: [], plats: [], dark: [],
    water: rec.water || [],
    stick: { x: 40, y: 8 * T - 6 },
    key: { x: 56, y: 8 * T - 6 },
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
  lv.fliers = (S.fliers || []).filter(function(f){ return !f.dead; }).map(function(f){
    return [Math.round(f.x), Math.round(f.y), Math.round(f.x0), Math.round(f.x1),
            Math.round(f.v), f.kind];
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
    return [Math.floor((n.x + 5) / T), Math.floor((n.y + 18) / T) - 1,
            n.tree || 'hermit', n.facing != null ? n.facing : -1];
  });
  var items = (S.items || []).filter(function(it){ return !it.got; }).map(function(it){
    return [Math.floor(it.x / T), Math.floor(it.y / T), it.kind];
  });
  lv.items = function(){ return items.map(function(a){ return a.slice(); }); };
  lv.lights = (S.lights || []).map(function(L){
    return {
      x: L.x, y: L.y, color: L.color, intensity: L.intensity,
      radius: L.radius, lantern: L.lantern, id: L.id
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
  dirty = false;
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
  var store = readStore();
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
