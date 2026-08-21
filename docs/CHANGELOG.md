# Changelog (unreleased)

- Objects Details (`#edTileEdit`): opens for all Objects kinds (dblclick; single click retargets if already open). Same for Tiles. Non-sprite objects show Name / Type(role) / Sprite slot until a sprite is linked.
- Sprite slot: mini thumb in Details; drag-drop palette swatch (Tiles or Objects) assigns sprite. Customs + Hero/Start can set sprite; other builtins need Ctrl+D clone first.
- Object roles: actor | pickup | loot | prop | marker (`ledge.dev.objects`). Builtins inferred; customs editable. Affects loot-drag vs world place.
- Ctrl+D on Objects: clones to new custom kind (`ledge.dev.objects`) and clones sprite def when present (`ledge.dev.sprites`). Hero clone → family hero; placing that brush as Start sets `LV.spawn.spriteId`.
- Hero / Start palette rename; Details edits hero frames; `spawn.spriteId` drives playable sprite/box via `activeHeroId()`.
- Custom entities can carry `spriteId` (items/enemies/fliers/npcs) for draw/persist.
