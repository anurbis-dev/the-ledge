/* Boot: bake object-icon catalog frames; migrate tile src/frames → spriteId. */
import {
  SPRITE_DEFS, getSpriteDef, isSpriteFrameDirty, setSpriteFrame,
  setAnimFrameCount, addSpriteDef, isHeroSprite
} from '../core/spriteset.js';
import {
  listTiles, getTileSpriteId, setTileSpriteId, snapshotGfx, getTileDef,
  ensureTileLegacyPictures
} from '../core/tileset.js';
import { bakeSpriteFrameSrc } from '../render/sprite-bake.js';

/** Character procedural art — never auto-bake icon over empty frames. */
function isCharacterSprite(id){
  if (!id) return false;
  if (id === 'hero' || isHeroSprite(id)) return true;
  if (/^(enemy|flier|spider)\d+$/.test(id)) return true;
  if (id.indexOf('npc_') === 0) return true;
  return false;
}

/** Catalog icon sprites that get paintObjIcon baked into dirty idle0. */
export function catalogIconSpriteIds(){
  var out = [], i, d;
  for (i = 0; i < SPRITE_DEFS.length; i++){
    d = SPRITE_DEFS[i];
    if (!d || !d.id || isCharacterSprite(d.id)) continue;
    out.push(d.id);
  }
  return out;
}

/** Bake missing idle frames for icon catalog entries (idempotent). */
export function ensureCatalogIconFrames(){
  var ids = catalogIconSpriteIds(), i, id, def, anim, n, f, changed = 0;
  for (i = 0; i < ids.length; i++){
    id = ids[i];
    def = getSpriteDef(id);
    if (!def || !def.anims || !def.anims.length) continue;
    anim = def.anims[0].id;
    n = Math.max(1, def.anims[0].n | 0);
    for (f = 0; f < n; f++){
      if (isSpriteFrameDirty(id, anim, f)) continue;
      setSpriteFrame(id, anim, f, bakeSpriteFrameSrc(id, anim, f), true);
      changed++;
    }
  }
  return changed;
}

/**
 * One tile with legacy picture → sprite + spriteId.
 * Returns new sprite def or null if nothing to do.
 */
export function migrateTilePicture(id, opt){
  id = id | 0;
  if (id <= 0 || getTileSpriteId(id)) return null;
  opt = opt || {};
  var src = opt.src || '';
  var frames = Array.isArray(opt.frames) ? opt.frames.filter(Boolean) : [];
  var fr = frames.length ? frames.slice() : (src ? [src] : []);
  if (!fr.length) return null;
  var name = opt.name || ('Tile ' + id);
  var def = addSpriteDef({
    name: name,
    fw: 16, fh: 16, ox: 0, oy: 0,
    kind: 'tile_' + id,
    anims: [{ id: 'idle', name: 'Idle', n: fr.length }],
    src: fr[0]
  });
  if (!def) return null;
  if (fr.length > 1){
    setAnimFrameCount(def.id, 'idle', fr.length);
    var j;
    for (j = 0; j < fr.length; j++) setSpriteFrame(def.id, 'idle', j, fr[j], true);
  }
  setTileSpriteId(id, def.id);
  return def;
}

/** Migrate all custom tiles + tileGfx entries that still hold src/frames. */
export function migrateTilePicturesToSprites(){
  var n = 0, tiles = listTiles(), i, t, gfx, id, g, def;
  for (i = 0; i < tiles.length; i++){
    t = tiles[i];
    if (!t || getTileSpriteId(t.id)) continue;
    if (!(t.src || (t.frames && t.frames.length))) continue;
    if (migrateTilePicture(t.id, { name: t.name, src: t.src, frames: t.frames })) n++;
  }
  gfx = snapshotGfx() || {};
  for (id in gfx){
    if (!Object.prototype.hasOwnProperty.call(gfx, id)) continue;
    g = gfx[id];
    if (!g || getTileSpriteId(id)) continue;
    if (!(g.src || (g.frames && g.frames.length))) continue;
    def = getTileDef(id | 0);
    if (migrateTilePicture(id | 0, {
      name: (def && def.name) || ('Tile ' + id),
      src: g.src,
      frames: g.frames
    })) n++;
  }
  return n;
}

/** Run both boot migrations. */
export function migrateEditorGraphics(){
  var tiles = migrateTilePicturesToSprites();
  return {
    icons: ensureCatalogIconFrames(),
    tiles: tiles,
    legacy: ensureTileLegacyPictures()
  };
}
