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

/* PNG-кадры + _meta/n/speed в BAKED.sprites (якоря — BAKED.objectAnchors).
   Пустой frames с холодной вкладки не затирает bake. */
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
      if (rec.speed != null) a.speed = +rec.speed;
      if (hasPic || rec.n != null || rec.speed != null) dst[anim] = a;
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

/* The client always sends its full current picture (boot() loads straight
   from BAKED, no competing localStorage draft — see persist fix), so `next`
   is authoritative for membership at both the sprite-id and per-anim level:
   an id/anim missing from `next` was deliberately cleared client-side and
   must not be resurrected from `base`. Only the picture bytes within an
   anim that's present in both get borrowed from `base` when `next` lacks
   them (mergeSpriteAnim) — that's not a membership question. */
function mergeSprites(base, next) {
  if (!next) return base || null;
  if (!base) return next;
  const out = {};
  for (const id of Object.keys(next)) {
    const b = base[id] || {};
    const n = next[id] || {};
    const merged = {};
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

/** Кастом-клоны спрайтов. Дамп клиента всегда полный (см. mergeSprites) —
 *  next авторитетен, включая удаление id, отсутствующих в next. */
export function mergeSpriteDefs(base, next) {
  if (next == null) return base || null;
  if (!Array.isArray(next)) return base || null;
  return next;
}

/** Paint overrides for built-in tiles. Same authoritative-next rule as
 *  mergeSprites — an id missing from `next` was cleared and must not be
 *  resurrected; only borrow picture bytes for ids present in both. */
export function mergeTileGfx(base, next) {
  if (next == null) return base || null;
  if (!base) return next;
  const out = {};
  for (const id of Object.keys(next)) {
    const n = next[id];
    const b = base[id];
    if (!b) { out[id] = n; continue; }
    const nPic = !!(n.src || (n.frames && n.frames.length));
    const bPic = !!(b.src || (b.frames && b.frames.length));
    if (nPic || !bPic) { out[id] = n; continue; }
    out[id] = { ...n, src: b.src || '', frames: Array.isArray(b.frames) ? b.frames.slice() : [] };
  }
  return out;
}

/** Кастом-объекты редактора (kind-шаблоны). Дамп клиента всегда полный. */
export function mergeObjects(base, next) {
  if (next == null) return base || null;
  if (!Array.isArray(next)) return base || null;
  return next;
}

/** Визуальные якоря объектов (origin/grab/weapon/box по objectKind/anim). */
export function mergeObjectAnchors(base, next) {
  if (next == null) return base || null;
  if (typeof next !== "object") return base || null;
  return next;
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
    levels: null, params: null, settings: null, score: null, mix: null, talk: null, intro: null,
    tiles: null, tileGfx: null, sprites: null, spriteDefs: null, objects: null, objectAnchors: null
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
      : (base.spriteDefs || null),
    objects: dump.objects !== undefined
      ? mergeObjects(base.objects, dump.objects)
      : (base.objects || null),
    objectAnchors: dump.objectAnchors !== undefined
      ? mergeObjectAnchors(base.objectAnchors, dump.objectAnchors)
      : (base.objectAnchors || null)
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
    "// Single source of truth for shipped visual data: levels, params, tiles/tileGfx,",
    "// sprite frames (+spriteDefs), objects/objectAnchors, optional settings/mix/talk/intro.",
    "// Written only by the editor's Bake button — no localStorage draft ever overrides this file.",
    `export var BAKED = ${JSON.stringify(merged, null, 2)};`,
    ""
  ].join("\n");
}
