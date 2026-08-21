// Shared merge logic for baking editor snapshots into src/core/defaults.js.
// Used both by the Vite dev-server /__bake endpoint and by the standalone
// scripts/bake-defaults.mjs CLI fallback.

export function mergeLevels(oldLevels, newLevels) {
  if (!newLevels) return oldLevels;
  if (!oldLevels) return newLevels;
  const out = {};
  for (const k of Object.keys(oldLevels)) if (k !== "_gone") out[k] = oldLevels[k];
  for (const k of Object.keys(newLevels)) if (k !== "_gone") out[k] = newLevels[k];
  const gone = new Set([...(oldLevels._gone || []), ...(newLevels._gone || [])]);
  out._gone = [...gone];
  return out;
}

export function mergeFlat(oldObj, newObj) {
  if (!newObj) return oldObj || null;
  if (!oldObj) return newObj;
  return { ...oldObj, ...newObj };
}

/* Якоря + PNG-кадры в BAKED.sprites. Пустой frames с холодной вкладки не затирает bake. */
export function spriteAnchors(sprites) {
  if (!sprites || typeof sprites !== "object") return null;
  const out = {};
  for (const id of Object.keys(sprites)) {
    const src = sprites[id];
    if (!src || typeof src !== "object") continue;
    const dst = {};
    const m = src._meta;
    if (m && typeof m === "object") {
      dst._meta = { fw: m.fw, fh: m.fh, ox: m.ox, oy: m.oy, fx: m.fx };
    }
    for (const anim of Object.keys(src)) {
      if (anim === "_meta") continue;
      const rec = src[anim];
      if (!rec || typeof rec !== "object") continue;
      const a = {};
      const hasPic = !!(rec.frames && rec.frames.length);
      if (hasPic) {
        a.frames = rec.frames.slice();
        a.dirty = Array.isArray(rec.dirty) ? rec.dirty.slice() : [];
      }
      if (rec.n != null) a.n = rec.n | 0;
      if (rec.origin) a.origin = rec.origin;
      if (rec.grab) a.grab = rec.grab;
      if (Array.isArray(rec.weapon) && rec.weapon.some(Boolean)) a.weapon = rec.weapon;
      if (rec.box && rec.box.w != null && rec.box.h != null)
        a.box = { w: rec.box.w | 0, h: rec.box.h | 0 };
      if (hasPic || a.origin || a.grab || a.weapon || a.box || rec.n != null) dst[anim] = a;
    }
    if (Object.keys(dst).length) out[id] = dst;
  }
  return Object.keys(out).length ? out : null;
}

function animHasPic(rec) {
  return !!(rec && Array.isArray(rec.frames) && rec.frames.length);
}

function mergeSpriteAnim(baseAnim, nextAnim) {
  if (!nextAnim) return baseAnim || null;
  if (!baseAnim) return nextAnim;
  const out = { ...baseAnim, ...nextAnim };
  if (!animHasPic(nextAnim) && animHasPic(baseAnim)) {
    out.frames = baseAnim.frames;
    out.dirty = Array.isArray(baseAnim.dirty) ? baseAnim.dirty.slice() : [];
  }
  return out;
}

function mergeSprites(base, next) {
  if (!next) return base || null;
  if (!base) return next;
  const out = { ...base };
  for (const id of Object.keys(next)) {
    const b = base[id] || {};
    const n = next[id] || {};
    const merged = { ...b };
    if (n._meta) merged._meta = { ...n._meta };
    else if (b._meta) merged._meta = { ...b._meta };
    for (const anim of Object.keys(n)) {
      if (anim === "_meta") continue;
      merged[anim] = mergeSpriteAnim(b[anim], n[anim]);
    }
    out[id] = merged;
  }
  return out;
}

/** Кастом-клоны. Пустой dump не стирает уже запечённые defs. */
export function mergeSpriteDefs(base, next) {
  if (next == null) return base || null;
  if (!Array.isArray(next)) return base || null;
  if (!next.length) {
    if (Array.isArray(base) && base.length) return base;
    return next;
  }
  if (!Array.isArray(base) || !base.length) return next;
  const byId = new Map();
  for (const d of base) if (d && d.id != null) byId.set(String(d.id), d);
  for (const d of next) if (d && d.id != null) byId.set(String(d.id), d);
  return [...byId.values()];
}

/* Paint overrides for built-in tiles. Cold tabs boot without LS and would
   POST tileGfx:{} — do not let that erase a non-empty baked set. */
export function mergeTileGfx(base, next) {
  if (next == null) return base || null;
  const nextKeys = Object.keys(next);
  if (!nextKeys.length) {
    if (base && Object.keys(base).length) return base;
    return next;
  }
  if (!base) return next;
  const out = { ...next };
  for (const id of Object.keys(base)) {
    const b = base[id];
    const n = out[id];
    if (!b) continue;
    const bPic = !!(b.src || (b.frames && b.frames.length));
    if (!bPic) continue;
    if (!n) {
      out[id] = { ...b };
      continue;
    }
    const nPic = !!(n.src || (n.frames && n.frames.length));
    if (!nPic) {
      out[id] = {
        ...n,
        src: b.src || '',
        frames: Array.isArray(b.frames) ? b.frames.slice() : []
      };
    }
  }
  return out;
}

/** Dump after sprite migrate may POST tiles with spriteId and empty src —
 *  keep prior baked pixels so dist/cold boot still paints. */
export function mergeTiles(base, next) {
  if (next == null) return base || null;
  if (!Array.isArray(next)) return base || null;
  if (!Array.isArray(base) || !base.length) return next;
  const byB = new Map(base.map((t) => [t && t.id, t]));
  return next.map((t) => {
    if (!t || t.id == null) return t;
    const b = byB.get(t.id);
    if (!b) return t;
    const nPic = !!(t.src || (t.frames && t.frames.length));
    const bPic = !!(b.src || (b.frames && b.frames.length));
    if (nPic || !bPic) return t;
    return {
      ...t,
      src: b.src || '',
      frames: Array.isArray(b.frames) ? b.frames.slice() : []
    };
  });
}

export function mergeBaked(existing, dump) {
  const base = existing || {
    levels: null, params: null, settings: null, score: null, mix: null, talk: null, intro: null, tiles: null, tileGfx: null, sprites: null, spriteDefs: null
  };
  const nextSprites = dump.sprites != null ? spriteAnchors(dump.sprites) : null;
  return {
    savedAt: dump.savedAt || Date.now(),
    levels: mergeLevels(base.levels, dump.levels),
    params: mergeFlat(base.params, dump.params),
    settings: mergeFlat(base.settings, dump.settings),
    score: dump.score || base.score || null,
    mix: mergeFlat(base.mix, dump.mix),
    talk: mergeFlat(base.talk, dump.talk),
    intro: dump.intro != null ? dump.intro : (base.intro || null),
    tiles: dump.tiles != null ? mergeTiles(base.tiles, dump.tiles) : (base.tiles || null),
    tileGfx: mergeTileGfx(base.tileGfx, dump.tileGfx),
    sprites: nextSprites != null ? mergeSprites(base.sprites, nextSprites) : (base.sprites || null),
    spriteDefs: dump.spriteDefs !== undefined
      ? mergeSpriteDefs(base.spriteDefs, dump.spriteDefs)
      : (base.spriteDefs || null)
  };
}

export function parseDefaultsSource(src) {
  const marker = "export var BAKED = ";
  const i = String(src).indexOf(marker);
  if (i < 0) return null;
  const start = src.indexOf("{", i);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let p = start; p < src.length; p++) {
    const c = src[p];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === "\"") inStr = false;
      continue;
    }
    if (c === "\"") { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(src.slice(start, p + 1));
    }
  }
  return null;
}

export function formatDefaults(merged) {
  return [
    "// Auto-generated by the editor (vite /__bake) or `npm run bake` — do not hand-edit.",
    "// Shipped snapshot: levels, params, sprite frames+anchors (+spriteDefs), optional settings/mix/talk/intro.",
    "// Per-browser localStorage is a draft overlay; newer savedAt wins (see persist.preferLocal).",
    `export var BAKED = ${JSON.stringify(merged, null, 2)};`,
    ""
  ].join("\n");
}
