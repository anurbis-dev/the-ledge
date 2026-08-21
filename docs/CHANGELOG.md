# Changelog (unreleased)

- Editor: `#edbar` **Sprites** tab (listSpriteDefs, drag { spriteId }, PNG > ddSpriteDef, Ctrl+D cloneSpriteDef, Delete custom clears tile/object/spawn refs).
- Tile Details: **Sprite** slot (setTileSpriteId / getTileSpriteId); linked sprite hides Paint/Re-import/Reset picture; 	ileImage/	ileFrameSrc/	ileThumb prefer sprite idle (else legacy src/frames).
- Object Sprite slot: Sprites-tab drops only (no longer invents sprite from Tiles 	ileSrc/makeTile on the slot); frame replace may still use 	ileSrc.