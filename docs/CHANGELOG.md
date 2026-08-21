# Changelog (unreleased)

- Editor: `#edbar` **Sprites** tab (`listSpriteDefs`, drag `{ spriteId }`, PNG → `addSpriteDef`, Ctrl+D `cloneSpriteDef`, Delete custom clears tile/object/spawn refs).
- Tile Details: **Sprite** slot (`setTileSpriteId` / `getTileSpriteId`); linked sprite hides Paint/Re-import/Reset picture; `tileImage`/`tileFrameSrc`/`tileThumb` prefer sprite idle (else legacy src/frames).
- Object Sprite slot: Sprites-tab drops only (no longer invents sprite from Tiles `tileSrc`/`makeTile` on the slot); frame replace may still use `tileSrc`.
