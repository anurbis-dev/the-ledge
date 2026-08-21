# Changelog (unreleased)

- Editor: Paint only on Sprites (`canPaint` = sprite-mode); Tile/Object Details = params + Sprite slot (Edit/dblclick → `openSpriteEdit`). `openObjectEdit` no longer redirects Hero/Light/foes into Paint.
- `SPRITE_DEFS` expanded with placeable object icons; boot `migrateEditorGraphics` (`migrate-graphics.js`) bakes icon idle via `ensureCatalogIconFrames` (not characters) and migrates tile `src`/`frames`/`tileGfx` → spriteId.
- Tiles PNG-drop / Ctrl+D: immediately `migrateTilePicture` → spriteId.
