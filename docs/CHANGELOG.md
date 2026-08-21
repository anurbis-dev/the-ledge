# Changelog (unreleased)

- Object palette swatches: `objThumb` always returns a unique canvas (no shared-DOM steal when Coin + Coin copy share template); cache key = palKind + spriteId; dirty idle0 overrides procedural `paintObjIcon`; slot assign refreshes thumbs (`clearThumbCache` + `fillPal` via `onObjectChange`).
- Ctrl+D Objects: procedural kinds bake → `addTile` ("… icon", collide none) + `addSpriteDef` idle0; catalog sprites still `cloneSpriteDef` + bake empty frames into the clone only; `builtinSpriteId` reads SPRITE_DEFS catalog only (custom must not reuse template kind like `coin`).
- Sprite slot: procedural object drop payload `{ tileSrc, makeTile:true }` → tile+sprite; tile palette drops keep `tileSrc` without `makeTile`.
- `bakeKindFrame` / `bakeHeroFrame` / `spriteThumb`: paint via `def.kind`; hero-family clones use `isHeroSprite` + `bakeHeroFrame(id)`.
