# Changelog archive

## 2026-08-27

- **Fix: pickaxe-hit shake looped continuously for the entire time a tile was damaged instead of playing once per hit.**
  - The shake was gated on `S.digHp[k] != null` (set for the whole mid-dig duration, deleted only on break), so `paintTileId()` shook the tile every frame from the first hit until it broke. Replaced with a dedicated `S.digShakeT[k]` timer (`C.DIG_SHAKE_T = 0.18s`) set fresh on each `dighit` in `entities/mining.js`, decremented by a new `stepDigShake(S, dt)` wired into `core/step.js` next to `stepCrumbs`. `render/tiles.js`'s new `digHitShakeX(S, k)` derives the offset from elapsed-since-hit (not the global `time*46` wave), so amplitude decays to 0 over `DIG_SHAKE_T` and the tile sits still between hits. `CRUMB`'s own continuous crack-tremor (`crumbT`) is untouched.
  - `isDamaged(c, r)` (chunk-cache exclusion) switched from `digHp` to `digShakeT` to match тАФ a damaged-but-not-currently-shaking tile now sits back in the static chunk cache instead of redrawing every frame for the tile's entire mid-dig lifetime.
  - Because `digShakeT`'s window is short and state-based (unlike `CRUMB`, which is permanently excluded from the bake by tile id), the chunk must be explicitly invalidated on both the rising and falling edge тАФ `tryDig()` now calls `hooks.onSetTile(col, r)` when it sets `digShakeT`, and `stepDigShake()` calls it again when an entry expires тАФ otherwise the shaking dynamic draw would double up on top of a stale opaque static bake, or leave a transparent hole once the shake ends.
  - Verified directly: after one simulated hit, the chunk-canvas pixel at the tile goes from opaque to transparent (correctly excluded); after stepping `stepDigShake` past `DIG_SHAKE_T`, `digShakeT[k]` is deleted and the chunk pixel returns to the exact same opaque value as before the hit (clean round-trip, no residual hole or duplicate layer).

## 2026-08-27

- **Fix: damage shake never played on custom (sprite-based) diggable tiles, only on plain rock/`CRUMB`.**
  - `paintTileId()` (`render/tiles.js`) computed the `cracking`/`sx` shake offset only in the generic procedural-rock branch, but custom tiles (id ≥ 64, e.g. "Stone TNT") exit earlier via `paintCustom(v, x, y)` returning `true` — the shake code was unreachable for them. Added a `digHp`-gated shake offset applied to the `x` passed into `paintCustom` itself, so sprite tiles wobble the same way while damaged.
  - Verified directly: chunk-canvas pixel snapshot of a `digHp`-active custom tile now differs between two `view.time` samples (previously byte-identical).
- **Fix: pickaxe hit/break particle+sound effects (and `CRUMB` collapse dust) spawned dozens of tiles away from the actual tile, effectively invisible.**
  - `onEvent()` (`app/loop.js`) decoded the `dighit`/`digclank`/`digbreak`/`crumble` event payload (a `mapIx` value) back to `col`/`row` via `% G.MAP_W` / `/ G.MAP_W` only, ignoring the map's origin offset (`runtime.originC`/`originR`, exposed as `mapIx(c,r) = (r-originR)*MAP_W + (c-originC)`). Any level with a non-zero origin (the current map has `originC = -48`) decoded a `col` that was off by `|originC|` tiles, spawning `spark`/`rockChunks`/`emitSand` far off-screen from the dig site.
  - Fixed all four decode sites to add back `G.mapMinC()`/`G.mapMinR()` (existing facade getters for `originC`/`originR`).
  - Verified directly: decoding `mapIx(50, 20)` now round-trips to `{col: 50, row: 20}` (previously `{col: 98, row: 20}`).
- **Fix: mined tiles now actually disappear — `render/tiles.js` chunk cache baked solid tiles unconditionally, ignoring `gone`.**
  - `chunkOf()` (per-8×8-chunk static tile cache) painted every solid tile id via `drawTile` regardless of `world().gone`, so even though `entities/mining.js` calls `hooks.onSetTile` → `invalidateChunk()` on break, the rebake redrew the exact same rock texture — a mined tile stayed visually solid forever, only its collision (correctly) turned off. Added a `gone` check before the draw call, matching the pattern already used by `sAt()`/render-collision checks in the same file.
  - The reported "falling into the mined spot snaps the player to the nearest edge" did not reproduce against current `player.js` (`fallingThroughGone()` in `tryGrab`, added in a prior fix, already bails ledge-grab correctly when the player's own column is a `gone` cell) — verified directly via `tryGrab`/`solidTile` with a freshly-dug tile. Likely the same visual-desync symptom as above (tile still drawn solid while physics already treats it as air).
- **Fix: mined custom tiles still blocked the player as a solid wall, and shoved them out after falling into the hole from above.**
  - `tileBlocks()` (`core/map.js`) is the AABB collision check used by `moveX`/`moveY`/`rectFree`. For custom tiles (id ≥ 64) with a box-based `collide` (`full`/`half`/`bar`/`custom`), it computed overlap directly from the tile's static box and never called `solidTile()` — so it never saw `S.gone`. The previous chunk-cache render fix only fixed the *visual* disappearance; the tile was still a solid wall to the player. `solidAt()` (single-point checks) already delegated to `solidTile()` for the same case and was unaffected. Added an early `gone` check to `tileBlocks()`, matching `solidTile()`.
  - Verified directly: `tileBlocks()`/`rectFree()` on a mined custom tile's cell now return `false` (previously `true`) at the same coordinates where `solidTile()` already correctly returned `false`.
- **Feat: a diggable tile now shakes (like `CRUMB`) while damaged (hit at least once, not yet broken) instead of staying static until it suddenly vanishes.**
  - `render/tiles.js` `paintTileId()`: the `cracking`/`sx` shake offset (previously gated on `CRUMB` + active `crumbT`) now also triggers whenever `S.digHp[k] != null` (tile took a pickaxe hit but its durability hasn't hit 0 yet).
  - A damaged tile must be redrawn every frame for the shake to animate, so it can no longer sit in the static per-chunk cache: added an `isDamaged(c, r)` check (mirrors the existing `CRUMB`/water/flow/plank/give dynamic-tile list) to both `chunkOf()` (skip baking it into the chunk canvas) and `blitLayer()` (redraw it every frame on top). Once the tile breaks, `digHp[k]` is deleted and `gone` takes over — it drops out of the dynamic list and stays unbaked, same as any other mined tile.

## 2026-08-26 (2)

- **Feat: custom objects and their visual anchors now bake into `defaults.js` — closes the last localStorage-only gap in the asset-baking pipeline.**
  - `objectset.js` (custom object-kind templates) and `object-anchors.js` (their origin/grab/weapon/box anchors) previously had no `BAKED` counterpart and lived only in per-browser `localStorage`, unlike every other asset type — flagged as a known gap in the prior bake-persistence fix. Added `BAKED.objects` / `BAKED.objectAnchors`, `snapshotObjects()` / `snapshotObjectAnchors()`, and wired both into `bake-client.js` (`collectAuto`) and `scripts/bake-merge.mjs` (`mergeObjects`, `mergeObjectAnchors`, `mergeBaked`).
  - `boot()` in both modules now loads from `BAKED` first; the old combined localStorage key is read once only as a migration bridge when `BAKED` is still empty (pre-fix snapshot), then `BAKED` wins permanently after the next Bake.
  - `mergeSprites`/`mergeSpriteDefs`/`mergeTileGfx` in `bake-merge.mjs` changed from base∪next id-union to next-authoritative: the client always sends its full current picture on Bake (no competing localStorage draft anymore), so an id/anim missing from the new dump was deliberately deleted and must no longer be resurrected from the previous bake — fixes the separately-flagged "deleting a baked sprite/tile doesn't stick across Bake" gap.
- **Feat: multi-character rig for the procedural stick-figure renderer — `figure.js` now draws per-character appearance (palette, body proportions, head shape, gear parts, draw order) instead of a single hardcoded Hero look.**
  - New `src/render/characters.js` registry (`getCharacter(id)`) and `src/render/hero-look.js` (Hero's palette/style/head/parts, extracted from the old hardcoded constants) plus `src/render/shirley/data.js` (a second full character, "Shirley", authored via an external Shirley.html tool and exported as palette/style/headRows/parts/pivots/drawOrder).
  - `figure(pt, facing, wag, frontal, rim, heldStick, backStick, gear, tilt, charId, animId)` gained `charId`/`animId` params; `hero.js` now resolves `activeHeroId()` (level spawn's `spriteId`) and passes it through, so the vector-fallback renderer (used when no baked sprite frame exists for the current animation) matches whichever character is spawned.
  - Added a richer pose rig on top of the existing 11-point `poses.js` skeleton: procedural pack, 3-segment tail, independent front/back shoulders and hips (`upgradePose` in `figure.js`), plus a per-character/per-animation `drawOrder` (falls back to the historical hardcoded layer order for `hero` and any character without one).
  - `sprite-anchors.js`/`sprite-bake.js` updated to key off `isHeroSprite(id)` instead of the literal string `'hero'`, so baked-frame anchor defaults and the sprite-baking canvas also cover non-default hero-family sprite ids.
  - Verified in-browser: booting, swapping level spawn `spriteId` to `shirley`, and calling `figure()` directly across multiple characters/animations/gear combinations (helmet+shield, roll, frontal) — no console errors, no exceptions.

## 2026-08-26

- **Fix: asset-baking persistence architecture — removed localStorage draft overlay shadowing baked data.**
  - **Root cause of "old picture comes back after baking"**: boot functions in `tileset.js` and `spriteset.js` unconditionally re-merged a per-browser `localStorage` draft (keyed by `ledge.dev.savedAt` timestamp race against `BAKED.savedAt`) over freshly baked picture data from `src/core/defaults.js` on every page load, silently restoring old tile/sprite visuals regardless of a successful Bake. Removed this competing source: boot() now loads tile/sprite picture data purely from `BAKED`, matching the actual runtime source-of-truth (tile/sprite gfx is never read from disk files or localStorage at runtime). In-editor session state remains the only "draft" (lives in memory, lost on reload unless baked).
  - **Removed silent autosave vector**: `pullLocalSpritesForBake()` in `bake-client.js` unconditionally re-merged localStorage sprite data into every Bake payload regardless of tab staleness; deleted.
  - **Removed hidden dev endpoint**: `pushTileFile()`/`pushAllTileFiles()` in `tileset.js` silently POSTed every `addTile`/`updateTile` picture to `/__tile` dev endpoint, bypassing the Bake button entirely and writing `src/tiles/tNN.png` files to disk on every editor edit — verified via grep that nothing in the game ever reads these files back. Endpoint removed from `vite.config.js`, `src/tiles/*.png` files git-removed (`.gitkeep` preserved).
  - **Kept intentional exception**: builtin sprite/tile display-name overrides (cosmetic editor label, not picture data, with no `BAKED` counterpart) still load from dedicated localStorage keys (`ledge.ed.spriteNames` / `ledge.ed.tileNames`), applied at module load — no race condition because there is no BAKED counterpart to shadow.
  - **Critical bug in post-bake invalidation**: `server.moduleGraph.getModulesByFile(defaultsPath)` in `vite.config.js` was called with Windows backslash path (from `path.join`), but Vite's module graph internally uses posix forward slashes — lookup silently matched zero modules and the post-bake invalidation was a no-op. Net effect: Bake correctly wrote `src/core/defaults.js` to disk, but the running dev server kept serving pre-bake transformed module forever (verified: `curl` to `/src/core/defaults.js` returned stale content after successful bake+reload, while cache-busted URL returned fresh). Fixed by normalizing the path via Vite's exported `normalizePath()` before `getModulesByFile` call. Verified live: bake now reflected on next plain request/reload with no server restart needed.
  - **Known related gap, not fixed (flagged for separate task)**: server-side merge in `scripts/bake-merge.mjs` unions base+incoming by id and never drops an id that existed in a previous bake but is absent from new dump — deleting a previously-baked sprite/tile doesn't stick across Bake, unlike `levels` which has proper `_gone` tombstone list. Also noted: `objectset.js` (custom object kinds) and `object-anchors.js` (their visual anchors) have no `BAKED` counterpart — persist only in localStorage, never reach `defaults.js` via Bake.
- **Feat: palette swatch inline-rename (F2) now works on all tabs and builtin catalog entries.**
  - **F2 hover-trigger extended from Objects-only to Tiles, Objects, and Sprites tabs.** Previously, pressing F2 only worked when hovering a custom object in the Objects tab; the trigger relied on the swatch having a visible name label (which required the global "Display Names" toggle to be on). Now F2 works across all palette tabs and doesn't depend on the name-label visibility — if a name label doesn't exist yet, one is created on the fly. Hover-tracking (`hoverPalSwatch`) is now unconditionally attached to swatches in all three palette kinds.
  - **Renaming builtin catalog entries via F2.** Builtin Tiles, Objects, and Sprites can now be renamed via F2 (or the Details panel Name field). Renaming a builtin entry persists a draft override in localStorage (e.g., `ledge.ed.tileNames` for tiles, `ledge.dev.objects.names` for objects, `ledge.dev.sprites.names` for sprites), applied at module load — this is a per-browser draft, not a change to the shipped catalog data. Undo/redo only applies to custom items, as builtin renames are persisted as-is (tier with "Display Names" toggle).
  - **Details panel Name field enabled for builtins.** The Objects and Tiles Details panel Name fields (`#edTileEdit` → `fillObjectHeader`/`fillTileParamsOnly`) are no longer disabled for builtin entries, allowing rename from the panel too. New: Sprites tab Details panel (opened via double-click from Sprites palette) now includes a Name field when opened standalone (calls `renameSpriteDef` for both custom and builtin sprites).
  - Exports: new `renameSpriteDef(id, name)` and `renameBuiltinTile(id, name)` functions. `updateObject(id, patch)` contract changed — non-custom ids now check `BUILTIN_OBJS` and apply renames when `patch.name` is given.
- **Fix: three follow-up bugs in the pickaxe/tile-sprite/editor area.**
  - **Tile sprite assignment silently fell back to procedural drawing.** Dragging a Sprites-tab swatch onto a tile's sprite slot (`applySpriteSlotPayload`, `editor/tile-edit.js`) only linked the tile to a `spriteId` via `setTileSpriteId` — it never baked an actual raster frame for it. The render path (`tileset.js`: `tileImage`/`tileFrameImage`) tries the sprite's frame image first, but that lookup only succeeds once a frame has actually been written into the spriteset's frame store; with none written, it fell through to the tile's own legacy `src`/`frames`, which were also empty for a tile that used to draw procedurally — so `paintCustom` (`render/tiles.js`) had nothing to draw and `paintTileId` kept running its procedural branches, silently ignoring the assignment. Fixed by calling `syncTileLegacyFromSprite(id)` right after `setTileSpriteId`, populating the tile's legacy picture from the linked sprite's first frame (mirrors what `ensureTileLegacyPictures()` already does in bulk elsewhere). Verified: a tile with no prior picture now resolves a real loaded image immediately after assignment instead of falling back.
  - **Placing the pickaxe on a level required a chest/enemy/bird already present.** Registering `pickaxe` alongside `harpoon`/`bow` in the previous session's editor-registration fix also mirrored their "loot-only" restriction: both `LOOT_ONLY_KINDS` (`editor/editor.js`) and the equivalent `LOOT_KINDS` (`core/objectset.js`, which drives the custom-object `role` resolution) required an existing chest/enemy/flier under the cursor before the drop would place anything — a bare pickaxe drop silently no-oped. Unlike harpoon/bow, the pickaxe is a standalone traversal tool, not exclusively enemy/chest loot, so it's dropped from both loot-only lists and added to `PICKUP_KINDS` (`objectset.js`) instead — same treatment as coin/gem/shroom: freely placeable on the ground, and still valid as chest content (`isLootRole` covers both `loot` and `pickup` roles). Verified: `builtinRole('pickaxe')` now resolves to `'pickup'` (`isLootOnlyRole` false, `isLootRole` true).
  - **Landing/descending into a pit dug at a negative map column got the player yanked to a neighboring tile's edge instead.** `findDescendTile` (`core/player.js`, backs the crouch-and-descend-off-an-edge move) used `col = -1` as its "no edge found yet" sentinel while scanning for the last solid column before a drop, then rejected the result with `if (col < 0) continue`. The LEDGE's maps legitimately extend into negative column indices (the spawn area of the affected level sits at columns like `-13`), so a perfectly valid edge column collided with the sentinel and was always rejected — the descend-into-pit move silently failed at any negative-column edge, mined pit or not. This is a pre-existing bug in the general ledge-descend code, just newly surfaced by pickaxe testing happening right at spawn. Fixed by using `col = null` as the sentinel instead. Verified live: crouching to prone at the edge of a pit dug at column -12 and tapping down now triggers the normal `climbdown` → hang sequence with no teleport, where before `canDescend` returned `false` unconditionally.

## 2026-08-25

- **Fix: mined tiles stayed visible and could yank the player onto a neighboring ledge.** Three related bugs reported after the pickaxe/mining feature: (1) a destroyed tile didn't visually disappear, (2) dig/break particle effects seemed not to play, (3) landing where a tile was mined could fling the character onto the edge of another tile.
  - **Root cause of (1)/(2):** `chunkOf` (`render/tiles.js`) bakes ordinary solid tiles into a cached canvas once and only repaints on `hooks.onSetTile` (the same hook the editor uses after every tile edit) — CRUMB/water/flow/PLANK/GIVE are special-cased out of that cache so they redraw live, but a durability-tile broken by mining only flipped `S.gone[k]`, never calling the invalidation hook, so the stale baked image kept showing the "destroyed" tile as solid rock. Physically the tile *was* gone (`solidTile()` correctly returned false), so hit/break particles genuinely fired — but with the block still visually present, repeated hits looked like nothing was happening at all. Fixed by calling `hooks.onSetTile(col, r)` from `entities/mining.js` when a tile breaks, same as any other tile-set path. Verified live: the mined block now disappears immediately, matching physics.
  - **Root cause of (3):** the ledge-grab assist (`tryGrab` → `findLedge`, `core/player.js`) auto-climbs the player onto any solid ledge detected while falling fast — normally this only ever triggers at level-authored edges. Mining can carve a 1-tile-wide vertical shaft whose still-solid neighboring column presents exactly that ledge geometry, so a player falling through their own dug hole got auto-grabbed and yanked up onto the adjacent tile's edge instead of falling through. Fixed with a targeted guard (`fallingThroughGone` in `player.js`): `tryGrab` now bails out if the player's own current column/row is a `gone` cell (mined or crumbled), leaving ordinary ledge-grab at real level edges untouched since it only ever short-circuits on that sparse flag.
  - Also corrects a documentation error from the previous pickaxe changelog entry, which claimed `S.gone` handling in tile rendering was already "universalized" — it wasn't; the chunk-cache bypass above was still CRUMB-only until this fix.
- **Fix: pickaxe was not placeable/testable on a level, weapon-durability panel missing it**. The `pickaxe` gear kind was wired into inventory/hand-slot logic but never registered as a world object: missing from `BUILTIN_OBJS`/`LOOT_KINDS` (`core/objectset.js`), the editor's loot registries (`editor.js`: `LOOT_KINDS`/`LOOT_ONLY_KINDS`/`LOOT_NAMES`), its palette thumbnail icon (`editor/thumbs.js`), and `WEAPON_TYPES` (`entities/gear.js`) — so it couldn't be dragged onto a level from the Objects tab, had no icon, and had no per-level durability slider in the editor's Gear panel (`editor/gear-settings.js`). Registered `pickaxe` alongside `harpoon`/`bow` in all five places; pickup/loot resolution is generic on the `kind` string so no gameplay code changed. Verified via `allPaletteObjects()` (role resolves to `loot`, matching harpoon/bow) and a direct icon-paint call, no console errors.
- **Clarification (tile durability field): only custom tiles are editable.** The "Durability" input in Tile Details (`editor/tile-edit.js`) is gated `disabled = !custom`, same as every other tile property (name, collide, climb, one-way, front) — built-in palette tiles can't have any field edited directly by design. To make an existing terrain tile diggable, duplicate it into a custom tile first (palette duplicate), then set Durability on the copy. Verified `addTile`/`updateTile`/`tileDurability` round-trip correctly on a custom tile (no code change needed here).
- **New: pickaxe + tile mining mechanic**. Added dedicated hand-slot `pickaxe` (sibling to `harpoon`, separate from `weapon` — new branches in `gear.js`: `HAND_SLOTS.pickaxe`, `giveGear`, `wearGear`, `listHand`, `cycleHand`, `isPickaxeHand`). Core mechanic in new module `src/entities/mining.js` (`tryDig(S)`): digs the tile beneath player's feet in the direction they're facing (`p.facing`), or if a solid block stands at body-level ahead, digs that instead — two modes: `dig` for wall-ahead, `digDown` for floor-ahead. Water cannot be mined (full refusal, no animation). Tiles carry `durability` (number of pickaxe hits to destroy); per-instance HP stored lazily in `S.digHp[mapIx]`, destroyed tiles go into `S.gone` (same as CRUMB); unbreakable tiles (`durability:0`) spark but never break. Integrated into `tryAction` in `entities/torches.js` — single entry point via action button when pickaxe is equipped. **Durability property** (`src/core/tileset.js`, `normalizeTile` whitelist): new `durability` field (default 0 = unbreakable), exported as `tileDurability(id)` — built-in tiles always unbreakable, custom tiles can be mined. Editor panel (`src/editor/tile-edit.js`): new numeric field "Durability (pickaxe hits, 0 = unbreakable)" for custom tiles only. **Gone state universalized**: `S.gone[]` check was hardcoded for CRUMB in `solidTile` / `paintTileId` — now generalizes to any tile source (crumble or mine), fixing the bug where excavated custom tiles remained solid+drawn. **Animations** (2 poses, vector fallback): `DIG0/DIG1/DIG2` (wall swing, horizontal) and `DIGD0/DIGD1/DIGD2` (floor swing, diagonal-down) in `render/poses.js`, registered in `HERO_POSES` and hero's anim catalog (`spriteset.js`); game does not depend on PNG art. Render branches (`hero.js`, `heroWeaponState`): pickaxe drawn in hand during swing, `p.digT > 0` trigger same as attack. **Effects**: new event handlers in `loop.js:onEvent` — `'dighit'` (sparks + small rocks), `'digclank'` (sparks only, unbreakable block), `'digbreak'` (big dust cloud + large chunks via `rockChunks`); new FX helper `rockChunks(x,y,n,sz)` in `render/fx.js`. **Inventory**: `ITEMS.pickaxe`, `SLOT_NAME.pickaxe`, `GEAR_SLOTS`, dev-kit `'1'` includes pickaxe; pixel icon added to `render/icons.js`. New constants `C.DIG_T` (0.36s) and `C.DIG_CD` (0.12s) in `core/constants.js`; `p.digT/digCd/digMode/hasPick` in `core/player.js` with `hasPick` persisting through `resetPlayer()`; step decrement in `core/step.js`. Verified: pickup/cycle pickaxe, both anim modes, multi-hit durability → destruction (`S.gone`, tile goes solid-free and invisible), unbreakable → spark-only, water → no-op, particles via event pipeline.
- **New: birds (`flier0-3`) glide instead of flapping continuously**. Added a `glide` animation to the catalog sprite defs (`flier0-3` in `spriteset.js`). `stepFliers` (`entities/fliers.js`) now tracks flight intent per-bird: climbing (`stepY < -2`) forces `flap`; otherwise the bird `glide`s, with a randomized periodic flap burst (~0.3-0.6s every ~2-5s) so it doesn't glide forever — divers (`kind:3`) always `flap` mid-dive. `render/sprites.js` blits whichever anim (`f.anim`) is active instead of hardcoding `'flap'`, and softens the procedural wing-line motion while gliding.
- **Fix: sprite-asset icon didn't refresh after editing non-idle sprites (birds)**. `objThumb`/`tileThumb` (`thumbs.js`) and drag-drop `resolveDropSrc` (`tile-edit.js`) always queried the `idle` animation for the icon frame, but `flier0-3` only have a `flap` animation — edits never showed up on their palette icon. Now resolved from the sprite's actual first animation (`def.anims[0].id`), matching the existing `spriteThumb` behavior.
- **Fix: H-flip on slopes now shows a mirrored sprite** (previously painted a blank tile). Root cause: H-flip swapped to a different built-in tile id (`mirrorSlopeId`, e.g. SLR→SLL) for correct geometry, but the mirror id usually has no sprite configured in Tile Details (only the original does) — flipping silently painted a spriteless id. Fixed by dropping the id-swap: slopes now use the same generic per-cell `flip` channel as every other tile (`edApply`: `G.setFlip(cell.c, cell.r, (ED.flipH?1:0)|(ED.flipV?2:0))`, one id, both axes). `slopeSpec(v, fl)` (`map.js`) now mirrors y0/y1 in place for built-in `SLOPE_SPEC` ids when `fl&1`, same as it already did for custom `slope-r`/`slope-l` Tile-Details defs — one authored sprite now mirrors correctly via the existing generic canvas-mirror transform in `render/tiles.js` for H, V, and combined H+V. Also fixes flip not registering when both X and Y are held at once (slopes now go through the same single OR'd `setFlip` call regular tiles always used). (Supersedes an incorrect earlier fix in this same unreleased window that added a `runtime.flip` base-map fallback — reverted; real levels always have an active editor layer, so that path was never the actual bug.)
- **Fix: ceiling slopes (V-flip) now block movement while walking, not just mid-jump**. `tileBlocks`/`rectFree` treated every slope (built-in and custom `slope-r`/`slope-l`) as fully non-blocking regardless of flip — by design for floor slopes, but it also silently exempted V-flipped ceiling slopes from all AABB collision outside the dedicated `ceilYAt` point-probe in `moveY`'s upward-jump branch. A player walking (not jumping) into a low ceiling slope, or standing under one, passed through with no collision, and the existing crouch-if-too-low stance safety net (which regular ceiling tiles already trigger) never engaged. New `ceilSlopeBlocks(...)` in `map.js` makes `tileBlocks` block a ceiling slope's solid region (worst-case surface height across the query box's x-overlap with the tile), wired into both the built-in and custom slope-r/slope-l branches. Ceiling slopes now bump/stop a standing player exactly like a regular half-block, and let a crouching player through — verified head-to-head against `HTOP`. The precise `ceilYAt` jump-arc stop is untouched and still takes priority when applicable.
- **New tunable: auto step-up height** (`C.STEP_UP`, default 3px) — the previously-hardcoded step height `moveX` lets a walking player climb onto automatically (no mantle) is now a named constant with a live slider in editor Params → Run/Walk.
- **Asset window: names on every tab, RMB "Display Names" toggle, header search filter, F2-by-hover rename fix** (`src/editor/editor.js`, `src/styles.css`, `index.html`). Object/tile/sprite name labels under palette icons are no longer Objects-only — a single global `ED.showNames` flag (persisted, `ledge.ed.showNames`) controls all three tabs at once. Right-click anywhere in the asset window (`#edbar`) opens a small context menu (`#edPalMenu`) with one checkbox item, "Display Names", toggling that flag. New search input centered in the asset window's header (`#edPalSearch`, between the tabs and the action buttons) filters the current tab's palette by name substring, live on input. F2 rename (custom objects only) now targets whichever swatch the pointer is hovering (`hoverPalSwatch`, tracked via pointerenter/pointerleave, same pattern as the layers panel), not whichever swatch is the currently-selected brush — previously F2 only worked on the active/selected swatch, which didn't match the documented "hover + F2" behavior.

## 2026-08-24 (later)

- **Flipped-tile install fix** *(superseded same day — see below/current CHANGELOG.md: this diagnosis was wrong, real levels always have an active editor layer; reverted)*: flip data (X/Y-flip bits per tile) now persists in base map via new `flip` Uint8Array in `runtime.js` (peer to `base`/`vary`). `setFlip`/`flipAt` in `game.js` previously required an active editor layer and silently no-op'd for base-map tiles; flipped tiles painted in the editor never persisted. Fixed by adding fallback to `runtime.flip` (same pattern as `base`/`vary`). Editor's "export text" (`edExportText`) now emits `flipR(...)` blocks alongside `fillR`/`varR` so flip data round-trips into level source code. New `flipR(c, r, w, h, v)` export in `map.js` for level authors (bit0=H-flip, bit1=V-flip).
- **Ceiling-slope collider verified** *(superseded same day — see current CHANGELOG.md: this verification missed the walking/standing case, real bug found and fixed)*: re-confirmed isCeilSlope / ceilYAt behavior at multiple speeds via chrome-devtools; collision geometry is correct, no code changes.
- **Sloped-floor-to-flat-floor Y-jitter fix**: per-frame onGround Y-snap no longer drops height probes at slope edges. New `groundSurfaceUnder(p)` in `player.js` — same 3-probe shape as `slopeUnder` but falls back to `groundYAt` for probes outside slopes, covering flat ground continuously. `step.js` calls `groundSurfaceUnder` instead of `slopeUnder` at the one Y-snap site; `slopeUnder`/`slopeUnderAt` and all other call sites (wall-block-bypass, boulders/enemies/NPCs) unchanged.
- **Sprites tab moved first** in editor panel order (index.html:54-57): visual button sequence is now Sprites, Tiles, Objects, Params, Intro, Gear, Mix; default active tab remains Tiles (ED.tab in editor.js:75).
- **Sprite frame editor: arrow-key stepping + animation search filter** (src/editor/tile-edit.js, src/editor/editor.js, src/styles.css): new exported `stepDetailsFrame(dir)` steps current animation's frame ±1 with wraparound when Details is open; ArrowLeft/ArrowRight wired in global keydown handler, guarded vs. text input focus. New `.ed-tile-anim-search` filter input (placeholder "Find animation…") at top of animation list (appears when sprite has 2+ anims); filters by name substring case-insensitive; resets on Details reopen.
- **Objects palette: names under swatches + F2 inline rename** (src/editor/editor.js, src/styles.css): `swatch()` gained `showLabel` param; only Objects tab passes true. `.ed-swatch-name` / `.ed-swatch-named` classes + `_nameLabel` storage on swatch DOM. F2 on custom object in Objects tab activates inline rename (`.ed-swatch-name-edit`); Enter commits via `updateObject()` (undo/redo wrapped), Escape cancels, blur commits. Built-in objects remain non-renamable (silent no-op).

## 2026-08-24

- **Ceiling slopes via V-flip**: slope brushes now support vertical flip (**Y** key held) to create diagonal ceiling surfaces (`isCeilSlope(v, fl)` when `fl & 2`). These collide only during upward movement through new `ceilYAt(px, py)` point-check (separate from regular `tileBlocks` AABB), stopping the player with head-bump event `'bonk'` just like a solid ceiling. Geometry mirrors via `slopeTop(v,c,px,fl)` reading `fl&2`, and physics (`slopeUnderAt`/`slopeGradeUnder`) ignores V-flipped slopes so they don't serve as ground/slide surfaces — ceiling slopes are traversal hazards only during upward flight. **Limitation**: does not block AABB or create lateral collision redirection; unsupported for boulders/ropes; only player upward movement (`moveY` when `dy<0`).
- **Flip now mirrors collision geometry, not just the sprite**: for tiles whose Tile-Details collision is `half`, `bar`, `custom` (box), or `slope-r`/`slope-l`, the per-cell `flip` bits are now read by `solidAt`/`tileBlocks`/`groundYAt` in `src/core/map.js`, which mirror the collision box (new private `flipBox(box, fl)`) or swap the slope side (`slopeSpec(v, fl)`) to match the mirrored sprite. Previously only rendering respected flip; collision stayed at the unflipped geometry, so an X/Y-flipped custom tile looked mirrored but collided as if it weren't. `slopeTop`/`slopeGrade`/`slopeRiseRight` gained an optional trailing `fl` param, threaded through every gameplay call site that resolves a slope surface under a moving entity (`player.js` `slopeUnderAt`/`slopeGradeUnder`, `boulders.js` `slopeSurfaceUnder`/`stepBoulders`) via new `tileFlipAt(c,r)` (`map.js`, exported on `GAME`) — plus the Collision-tool debug overlay (`render/collide.js`), so the drawn hitbox now matches what actually collides. Built-in numeric slope ids (SLR/SLL/…) are untouched by this — their H-mirroring still goes through the existing `mirrorSlopeId` id-swap, since their geometry is baked into the tile id rather than this per-cell channel; painting a numeric slope brush now also explicitly clears any stale `flip` bit left on that cell by a prior non-slope paint, so it can't wrongly canvas-mirror the slope's sprite.
- **Eyedropper** (tile/color/object picker) moved from Ctrl+click to **Alt+hover**: holding Alt and moving the mouse over canvas now live-samples the brush from whatever is under the cursor, no click needed. New helper `sampleEyedrop()`/`eyedrop()`.
- **Ctrl+drag** for direct move-mode: dragging with Ctrl held grabs whatever tile/object is under the cursor and moves it immediately, no pre-selection needed (`beginCtrlMove`). Special-kind objects through gizmo; regular objects through `ED.dragObj`; bare tile/deco cell as ad-hoc 1×1 selection via `beginMoveSel`.
- **Box-select** (rectangular multi-tile selection for copy/paste/erase, `ED.selTiles`/`ED.boxing`) moved from Ctrl+drag to **Shift+drag**. Ctrl+C/Ctrl+V/Delete on selection unchanged.
- **Ctrl+Shift+drag** shifts entire level: all tile layers + every placed object (enemies, fliers, spiders, tendrils, torches, chests, items, boulders, npcs, doors, lights, sounds, emitters, volumes, ropes, plats, lifts, player start, level exits) by whole tiles, computed from drag distance and applied on release (`beginShiftAll`/`shiftWorldBy`/`shiftAllObjects`). Shows "Shift level dc,dr" label while dragging.
- **Live brush preview** in edDrawOverlay: normal tile-brush mode shows translucent ghost of selected tile; Color/paint mode tints hover cell with pending grade; Cover mode shows actual tile art with thin 1px border (replacing old plain yellow highlight, now fallback only for modes without preview like object tool).
- **Real tile flip**: holding **X** mirrors brush horizontally, holding **Y** mirrors it vertically, live in preview AND applied when tile/overlay-deco painted (`edApply`). New per-cell data channel `flip` (bit0=H, bit1=V), parallel to existing `deco`/`tint` — added to `src/core/layers.js` (layerFlipRaw/ensureFlip + layer creation + snapshot/copy), `src/core/runtime.js` (grows with map like deco/tint), `src/core/game.js` (setFlip/flipAt on GAME facade, incl. wrap-layer stampFlip), `src/core/persist.js` (saved/loaded like other layer arrays), and rendered in `src/render/tiles.js` drawTile via canvas mirror transform (works for procedural and image-based tiles). Erasing tile clears flip; move/copy/paste/undo carry flip automatically.
- **Fix**: X-flip now works on slope brushes too (**Y** stays a no-op there by design — see below). Slopes don't use the generic `flip` channel (their direction is already baked into the tile id, and a canvas-mirrored slope would desync visual from collision) — instead `edApply` swaps to the geometrically-mirrored id before the slope auto-fit runs, via new `mirrorSlopeId(v)` (`src/core/map.js`, exported on GAME), which searches `SLOPE_SPEC` for the id with swapped y0/y1 and inverted ease (excludes `LADR`/`LADL`, which share slope geometry but aren't slope-brush tiles).
- **Slope rendering is no longer procedural**: `paintTileId` (`src/render/tiles.js`) dropped the triangle-fill + edge/decor-pixel drawing entirely. Slope tiles now render exactly like any other tile — whatever picture/sprite is assigned in Tile Details (`paintCustom`, checked before the slope branch) — and draw nothing if none is assigned. This also means vertical flip is not meaningfully supported for slopes: their surface direction (and the collision that reads it via `slopeTop`) is encoded in the tile id, not a flippable bitmap, and there's no ceiling-slope collision in this engine to make a vertically-mirrored slope walkable — only the horizontal id-swap above is implemented.

## 2026-08-24 (pre-commit)

- **Flip now mirrors collision geometry, not just the sprite**: for tiles whose Tile-Details collision is `half`, `bar`, `custom` (box), or `slope-r`/`slope-l`, the per-cell `flip` bits are now read by `solidAt`/`tileBlocks`/`groundYAt` in `src/core/map.js`, which mirror the collision box (new private `flipBox(box, fl)`) or swap the slope side (`slopeSpec(v, fl)`) to match the mirrored sprite. Previously only rendering respected flip; collision stayed at the unflipped geometry, so an X/Y-flipped custom tile looked mirrored but collided as if it weren't. `slopeTop`/`slopeGrade`/`slopeRiseRight` gained an optional trailing `fl` param, threaded through every gameplay call site that resolves a slope surface under a moving entity (`player.js` `slopeUnderAt`/`slopeGradeUnder`, `boulders.js` `slopeSurfaceUnder`/`stepBoulders`) via new `tileFlipAt(c,r)` (`map.js`, exported on `GAME`) — plus the Collision-tool debug overlay (`render/collide.js`), so the drawn hitbox now matches what actually collides. Built-in numeric slope ids (SLR/SLL/…) are untouched by this — their H-mirroring still goes through the existing `mirrorSlopeId` id-swap, since their geometry is baked into the tile id rather than this per-cell channel; painting a numeric slope brush now also explicitly clears any stale `flip` bit left on that cell by a prior non-slope paint, so it can't wrongly canvas-mirror the slope's sprite.
- **Still open** (resolved 2026-08-24, see current CHANGELOG.md "Ceiling slopes via V-flip"): vertical flip does not create new "ceiling" collision, for either built-in slopes or custom `slope-r`/`slope-l` tiles — the physics engine has no concept of a sloped ceiling anywhere (`tileBlocks` never treats a slope as AABB-blocking, and there's no head-bump-against-a-diagonal resolution in `player.js`/`boulders.js`/`ropes.js`), so a V-flipped slope's sprite would canvas-mirror to look like an overhang while nothing would actually collide with it. Building real ceiling-slope physics is a separate, larger change touching movement resolution in multiple files, not just the collision-query functions above.
- **Eyedropper** (tile/color/object picker) moved from Ctrl+click to **Alt+hover**: holding Alt and moving the mouse over canvas now live-samples the brush from whatever is under the cursor, no click needed. New helper `sampleEyedrop()`/`eyedrop()`.
- **Ctrl+drag** for direct move-mode: dragging with Ctrl held grabs whatever tile/object is under the cursor and moves it immediately, no pre-selection needed (`beginCtrlMove`). Special-kind objects through gizmo; regular objects through `ED.dragObj`; bare tile/deco cell as ad-hoc 1×1 selection via `beginMoveSel`.
- **Box-select** (rectangular multi-tile selection for copy/paste/erase, `ED.selTiles`/`ED.boxing`) moved from Ctrl+drag to **Shift+drag**. Ctrl+C/Ctrl+V/Delete on selection unchanged.
- **Ctrl+Shift+drag** shifts entire level: all tile layers + every placed object (enemies, fliers, spiders, tendrils, torches, chests, items, boulders, npcs, doors, lights, sounds, emitters, volumes, ropes, plats, lifts, player start, level exits) by whole tiles, computed from drag distance and applied on release (`beginShiftAll`/`shiftWorldBy`/`shiftAllObjects`). Shows "Shift level dc,dr" label while dragging.
- **Live brush preview** in edDrawOverlay: normal tile-brush mode shows translucent ghost of selected tile; Color/paint mode tints hover cell with pending grade; Cover mode shows actual tile art with thin 1px border (replacing old plain yellow highlight, now fallback only for modes without preview like object tool).
- **Real tile flip**: holding **X** mirrors brush horizontally, holding **Y** mirrors it vertically, live in preview AND applied when tile/overlay-deco painted (`edApply`). New per-cell data channel `flip` (bit0=H, bit1=V), parallel to existing `deco`/`tint` — added to `src/core/layers.js` (layerFlipRaw/ensureFlip + layer creation + snapshot/copy), `src/core/runtime.js` (grows with map like deco/tint), `src/core/game.js` (setFlip/flipAt on GAME facade, incl. wrap-layer stampFlip), `src/core/persist.js` (saved/loaded like other layer arrays), and rendered in `src/render/tiles.js` drawTile via canvas mirror transform (works for procedural and image-based tiles). Erasing tile clears flip; move/copy/paste/undo carry flip automatically.
- **Fix**: X-flip now works on slope brushes too (**Y** stays a no-op there by design — see below). Slopes don't use the generic `flip` channel (their direction is already baked into the tile id, and a canvas-mirrored slope would desync visual from collision) — instead `edApply` swaps to the geometrically-mirrored id before the slope auto-fit runs, via new `mirrorSlopeId(v)` (`src/core/map.js`, exported on GAME), which searches `SLOPE_SPEC` for the id with swapped y0/y1 and inverted ease (excludes `LADR`/`LADL`, which share slope geometry but aren't slope-brush tiles).
- **Slope rendering is no longer procedural**: `paintTileId` (`src/render/tiles.js`) dropped the triangle-fill + edge/decor-pixel drawing entirely. Slope tiles now render exactly like any other tile — whatever picture/sprite is assigned in Tile Details (`paintCustom`, checked before the slope branch) — and draw nothing if none is assigned. This also means vertical flip is not meaningfully supported for slopes: their surface direction (and the collision that reads it via `slopeTop`) is encoded in the tile id, not a flippable bitmap, and there's no ceiling-slope collision in this engine to make a vertically-mirrored slope walkable — only the horizontal id-swap above is implemented.

## 2026-08-24 (pre-commit)

- Fall **Taper Len** default 3→6, range 1–12 (hanging tip fades over more tiles).

## 2026-08-21 (pre-commit)

- Fall foam/spray at column tip: impact when **any** tile below (water/solid/slope…); empty below = no bottom foam (`fallTipKind` `hit` vs `air`).
- Fall hanging tip: strands + fill taper edges→center over last N tiles (`taper`/`taperLen`); edge strands → dots → gone, center stays lines longer.
- Fall Details: **Taper** (0–100, def 60) / **Taper Len** (1–8, def 3) → `tileGfx[14]`; getters `getTileTaper` / `getTileTaperLen`; helpers `fallColumnTip` / `fallTipKind`.

## 2026-08-21 (pre-commit)

- Bake: clear error if tab is `file://` / not localhost — `/__bake` only on Vite `http://localhost:5174/`.
- Dev: `start-dev-server.bat` / `npm run dev:74` всегда поднимает Vite на **5174** (`strictPort --open`).

## 2026-08-21 (pre-commit)

- Sprites: LS overlay only when `preferLocal`; Bake pulls LS frames before dump; world/loot/icons use baked sprite frames (e.g. coin) before procedural fallback.

## 2026-08-21 (pre-commit)

- Bake: `BAKED.sprites` includes PNG frames (+ `spriteDefs` for clones); no JSON download fallback on Bake failure.

## 2026-08-21 (pre-commit)

- Persist: auto-bake off — `defaults.js` only via Bake button; levels no longer use `ledge.dev.levels` (session mem + `BAKED.levels` only).

## 2026-08-21 (pre-commit)

- Water immersion: splash/`wasWet` via `wetContact` (inWater||wading); continuous `stepHeroWaterRipples`; fish scare on wade; `drawWaterImmersion` + `immerseHero` wobble/tint below surface.

## 2026-08-21 (pre-commit)

- Ladder: soft mount only when approaching axis (`towardLadAxis`); leaving with vx/inp away no longer remagnetizes. Exit lerp kept.

## 2026-08-21 (pre-commit)

- Ladder mount (`tryLadder` / `autoLadder` / top ↓): soft `mountLad` ease-snap instead of hard teleport onto rail.

## 2026-08-21 (pre-commit)

- Fall Details: **Foam Size** / **Foam Random** / **Foam Speed** / **Spray Speed** → `tileGfx[14].foamSize|foamRandom|foamSpeed|spraySpeed` (defs 40/40/100/100).

## 0.18.2

- FALL ends: пена — частая многослойная волна (`paintFallFoamWave`), брызги — веер капель разного размера/направления (`paintFallSpray`); Foam/Spray по-прежнему 0–100.

## 0.18.1

- Fix: custom/painted tiles blank after Sprites split — `setTileSpriteId` keeps legacy `src`; `tileFrameSrc`/`tileImage` fall back to legacy; bake `mergeTiles`/`mergeTileGfx` keep prior pixels; boot heals empty LS from BAKED.

## 2026-08-21 (pre-commit)

- Fall strands (`paintFallStrands`): continuous world-Y phase through stacked FALL tiles (no per-tile `% T` clasp); light strand smoothstep alpha brightest at bottom → transparent at top along full **Length**.
- Fall Details: **Length** / **Wave** / **Random** / **Offset** (0–100, defaults 25/15/35/55) + existing **Speed** (0–200, 70) → `tileGfx[14]`; getters `getTileLength` / `getTileWave` / `getTileRandom` / `getTileOffset`.
- Fall Details: **Fade** (0–100, default 0) via `tileGfx[14].fade` / `getTileFade` — softer strand/body alpha (no hard holes that tear); also fades solid FALL fill.
- Fall: removed per-tile top foam line (`#8fd0ef`) that drew light horizontal seams on every FALL edge.
- Fall strands: second layer between the main threads (phase from **Offset**, slightly dimmer).
- Fall Details L2: **L2 Speed** (−100…100, def −8) / **L2 Length** / **L2 Density** (1…8 strands) / **L2 Wave** → `tileGfx[14].speed2|length2|density2|wave2`.
- Fall foam/spray (`paintFallEnds`): foam cap + spray on topmost FALL; bottom foam/spray when `WATER` below. Details **Foam** / **Spray** (0–100, defs 45/55) → `tileGfx[14].foam` / `spray`.

## 0.15.1

- Params: detailed hover tooltips for all `C` sliders; clarify `PLAT_GRAB` (X hand→lip) vs `PLAT_GRAB_Y` (Y hand→deck).

## 0.15.0

- Water waves: keep full layer amplitudes under FALL (dampen river travel only); per-layer bob/expand phase offsets so crests no longer lock as one sheet; `fallChurnAt` boils under impact.
- Water Details: **Splash** (0–100, default 80) via `tileGfx[13].splash` / `getTileSplash` — scales hero enter/exit ripples; stronger base splash amp.

## 0.14.2

- Plat grab: bind by `heroGrabWorld` + `C.PLAT_GRAB`/`PLAT_GRAB_Y`; only grab when facing the deck (no back-grab).

## 0.14.1

- Climb on moving plat: `updateClimb` carries `cx/cy/from/to` with deck (`q.dx` + `q.y`) so hang lip and body stay on the platform.

## 0.14.0

- Water: FALL waves expand left/right via `sin(k·|x−src|−ωt)` (river drift damped near fall; no bob amplify). Player enter/exit splash adds surface ripples (`addWaterRipple`).

## 0.13.0

- Editor: Paint only on Sprites (`canPaint` = sprite-mode); Tile/Object Details = params + Sprite slot (Edit/dblclick → `openSpriteEdit`). `openObjectEdit` no longer redirects Hero/Light/foes into Paint.
- `SPRITE_DEFS` expanded with placeable object icons; boot `migrateEditorGraphics` (`migrate-graphics.js`) bakes icon idle via `ensureCatalogIconFrames` (not characters) and migrates tile `src`/`frames`/`tileGfx` → spriteId.
- Tiles PNG-drop / Ctrl+D: immediately `migrateTilePicture` → spriteId.

## 0.12.6

- Plat climb-up: restore idle `w/h` when mantle ends (hang box left feet above deck → lost ride, bars steal ~T inland).

## 0.12.5

- Water waves: base travel again matches canon (Shift default 100); FALL boosts amplitude and adds expanding ripples instead of spatially-varying phase (fixes torn crests).

## 0.12.2

- docs: repair CHANGELOG archive for Sprites tab release notes.

## 0.12.1

- docs: restore CHANGELOG markup after PowerShell mangling of Sprites-tab bullets.

## 0.12.0

- Editor: `#edbar` **Sprites** tab (`listSpriteDefs`, drag `{ spriteId }`, PNG → `addSpriteDef`, Ctrl+D `cloneSpriteDef`, Delete custom clears tile/object/spawn refs).
- Tile Details: **Sprite** slot (`setTileSpriteId` / `getTileSpriteId`); linked sprite hides Paint/Re-import/Reset picture; `tileImage`/`tileFrameSrc`/`tileThumb` prefer sprite idle (else legacy src/frames).
- Object Sprite slot: Sprites-tab drops only (no longer invents sprite from Tiles `tileSrc`/`makeTile` on the slot); frame replace may still use `tileSrc`.

## 0.11.3

- Water waves: continuous world-X phase/bob + lerped FALL travel across the strip (no crest tear at tile edges).

## 0.11.2

- Plat descend/hang: слезание с края платформы; лаз обратно на неё; отцеп сбрасывает `ride`; защемление виса о solid → урон+падение.
- Air pose: в воздухе всегда `fall` (не jump по `vy`).

## 0.11.1

- Object palette swatches: `objThumb` always returns a unique canvas (no shared-DOM steal when Coin + Coin copy share template); cache key = palKind + spriteId; dirty idle0 overrides procedural `paintObjIcon`; slot assign refreshes thumbs (`clearThumbCache` + `fillPal` via `onObjectChange`).
- Ctrl+D Objects: procedural kinds bake → `addTile` ("… icon", collide none) + `addSpriteDef` idle0; catalog sprites still `cloneSpriteDef` + bake empty frames into the clone only; `builtinSpriteId` reads SPRITE_DEFS catalog only (custom must not reuse template kind like `coin`).
- Sprite slot: procedural object drop payload `{ tileSrc, makeTile:true }` → tile+sprite; tile palette drops keep `tileSrc` without `makeTile`.
- `bakeKindFrame` / `bakeHeroFrame` / `spriteThumb`: paint via `def.kind`; hero-family clones use `isHeroSprite` + `bakeHeroFrame(id)`.

## 0.11.0

- Smart water waves: FALL above/edge drives travel away with distance falloff; calm water stands still. Water Details: Shift (−100…100) river drift, Wave X (0…100) crest/bob amp (`tileGfx[13]`).


## 0.9.3

- Moving plat hang facing: лицом к платформе (`face = -edgeSide`), как у tile ledge.

## 0.9.2

- Moving plat edge grab: hang (not instant climb); face by edge side; suppress held toward/↑ until release (`keepAx`/`keepUp`).

## 0.9.1

- Water waves: к горизонтальному сдвигу фазы добавлен вертикальный bob гребня (`paintWaves`).
- Fall tile Details: слайдер Speed (0–200, дефолт 70) → `tileGfx[14].speed`; `getTileSpeed`; Reset picture сохраняет speed.

## 0.9.0

- Palette swatch: одиночный клик переключает открытый Details; клик-драг не меняет цель и дропает на Sprite slot / кадр action (`hitDetailsDrop`).
- Editor undo: Details (tileset/spriteset/objectset + spawn.spriteId) в общем стеке Ctrl+Z / Undo·Redo.

## 0.8.0

- Objects: свачи Hero (кадры, не placeable) и Start (спавн) разделены; hero-слоты Rope climb / Rope swing (ladder / ladderD + fallback; swing зеркало facing).

## 0.7.4

- FX Sand: при `speed=0` `speedRand` не даёт импульс; `spread` только позиция спавна (без `vx`).

## 0.7.3

- Editor floats: ПКМ-drag окна через capture поверх кнопок/инпутов; canvas/tilegeo по-прежнему со своей RMB-семантикой.

## 0.7.2

- FX Sand: `gravity=0` + `speed=0` больше не дают падения из‑за `speedRand`; при `g=0` drag гасит и `vy`.

## 0.7.1

- Ropes: райдер упирается головой/боками (clamp `t` + snap); спуск на землю/платформу → отцеп.

## 0.7.0

- FX Sand: формы эмиттера point|square|circle|line (`shape`/`shapeSize`/`shapeAngle`); Inspect + гизмо `emitSize`; persist `packEmitter`.

## 0.6.0

- Objects: `Plat H` / `Plat V` / `Lift` в палитре + Inspect/гизмо; `plats.js`/`lifts.js` params (travel/loop/trigger/onLeave, floors); persist `packPlat`/`packLift`.

## 0.5.0

- Ropes: коллизия Verlet-нод с solid-тайлами (`solidAt` в constrain loop) + unstick AABB райдера; `C.ROPE_COL_EPS`.

## 0.4.0

- FX Sand: placeable Objects `fx_sand` → `LV.emitters` / `S.emitters` (`entities/emitters.js`: `mkEmitters` / `mkEmitterAt` / `stepEmitters` / `packEmitter`); Inspect density/speed/speedRand/color/life/lifeRand/gravity/size/spread/drag/lift; позиция = x,y (гизмо move); persist/history/rooms.
- Песок: общий `emitSand` + `SAND_DEF` в `render/sand-fx.js` (реэкспорт fx.js / render/index); CRUMB idle/crack drip и crumble burst через него; осыпавшийся CRUMB (`gone`) больше не рисует rubble — пусто.
- Ropes: мягкое проминание elast (spread rider load, spring stretch, без hard clamp → ровных крыльев).

## 0.3.4

- Ropes: V attach wobble + climbLock (↑↓ после отпускания); H Length+ (0=span); elast^2.6.

## 0.3.3

- Ropes: elast — линейный stretch + soft-шкала g/rider (без скачка 0.01/0.03); H — анимация/box `bars` как у гориз. лестницы.

## 0.3.2

- Ropes: V swing — импульс на каждый edge-press L/R (без apex-gate); elast²·2.5 растяг (0.01 не даёт провис); H — отцеп по ↓.

## 0.3.1

- Fall rollland: урон при `fall > C.ROLL_HURT` (было `HURT*1.6`), stun `C.ROLL_HURT_T` — оба в Params → Fall / Damage.

## 0.2.0

- Ropes: `LV.ropes` / `entities/ropes.js` - vertical + horizontal Verlet ropes. Climb with up/down, swing L/R (impulse), jump/bottom detach; H sags under weight. Editor Rope V/H, dual handles, `#edRopeSettings`. Params `C.ROPE_*`.

## 0.1.3-dev.3

- Objects Details (`#edTileEdit`): opens for all Objects kinds (dblclick; single click retargets if already open). Same for Tiles. Non-sprite objects show Name / Type(role) / Sprite slot until a sprite is linked.
- Sprite slot: mini thumb in Details; drag-drop palette swatch (Tiles or Objects) assigns sprite. Customs + Hero/Start can set sprite; other builtins need Ctrl+D clone first.
- Object roles: actor | pickup | loot | prop | marker (`ledge.dev.objects`). Builtins inferred; customs editable. Affects loot-drag vs world place.
- Ctrl+D on Objects: clones to new custom kind (`ledge.dev.objects`) and clones sprite def when present (`ledge.dev.sprites`). Hero clone тЖТ family hero; placing that brush as Start sets `LV.spawn.spriteId`.
- Hero / Start palette rename; Details edits hero frames; `spawn.spriteId` drives playable sprite/box via `activeHeroId()`.
- Custom entities can carry `spriteId` (items/enemies/fliers/npcs) for draw/persist.

## 0.1.3-dev.2

- Editor Tiles tab: tiles only (built-in + custom); Sprites section removed from Tiles.
- Editor Objects: placeable ED_OBJS; double-click Start opens Hero frame editor; other sprite kinds open their edit; Ctrl+D clones tiles only.
- Delete custom tile: Delete/Backspace on Tiles custom brush (no map sel) or Delete in tile editor вЂ” scan all levels, confirm if used, wipe everywhere + remove + flush.
- #edbar: scrollbar hidden; middle-click drag pans scroll (bindMiddleScroll).

## 0.1.3-dev.2

# Changelog (unreleased)

- РЎС‚СѓРїРµРЅСЊ +1 С‚Р°Р№Р»: Р·Р°Р»РµР·Р°РЅРёРµ (`tryMantle` в†’ climb) С‚РѕР»СЊРєРѕ РїСЂРё РІРїРµСЂС‘Рґ+РІРІРµСЂС…; Р±РµР· в†‘ вЂ” СѓРїРѕСЂ РІ СЃС‚РµРЅСѓ.

## 0.1.3-dev.0

- Cover: dyn/Р°РЅРёРјРёСЂРѕРІР°РЅРЅС‹Рµ С‚Р°Р№Р»С‹ (РІРѕРґР°, РїРѕС‚РѕРє, `frames[]`) СЂРёСЃСѓСЋС‚СЃСЏ РєР°Р¶РґС‹Р№ РєР°РґСЂ, РЅРµ Р·Р°РїРµРєР°СЋС‚СЃСЏ РІ `_coverCans`.

## 0.1.2-dev.27

- Bake: РѕРєРЅРѕ С„РёРґР±СЌРєР° (`#edout.bake-fb`) С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ СЂРµР°Р»СЊРЅРѕРіРѕ `/__bake` (РѕС‡РµСЂРµРґСЊ РІРјРµСЃС‚Рѕ busy-stub OK); РїР°РЅРµР»СЊ РІ РЅРёР¶РЅРµР№ С‚СЂРµС‚Рё СЌРєСЂР°РЅР°.

## 0.1.2-dev.26

- Dev: РєР»Р°РІРёС€Р° `9` вЂ” toggle invulnerability (`GAME.toggleInvuln` / `isInvuln`): РЅРµС‚ СѓСЂРѕРЅР° РѕС‚ РІСЂР°РіРѕРІ, РїР°РґРµРЅРёСЏ (Рё knockdown), СѓС‚РѕРїР»РµРЅРёСЏ Рё РїСЂРѕС‡РёС… `damage()`; РѕС‚РєРёРґС‹РІР°РЅРёРµ/hurtCd С‚РѕР¶Рµ РЅРµ РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ.

## 0.1.2-dev.25

- Р РµРґР°РєС‚РѕСЂ: RMB СЃС‚РёСЂР°РµС‚ `Door` (РѕР±Р° РєРѕРЅС†Р° РїР°СЂС‹), `Exit`, `Start` (СЃР±СЂРѕСЃ) Рё РїСЂРѕС‡РёРµ specials; РёРЅРґРёРєР°С†РёСЏ РїР°СЂ РґРІРµСЂРµР№ (С†РІРµС‚/Р±РµР№РґР¶ + Р»РёРЅРёСЏ); Р·Р°РїСЂРµС‚ СЃС‚Р°РІРёС‚СЊ С‚РѕС‚ Р¶Рµ `kind` РїРѕРІС‚РѕСЂРЅРѕ РІ РѕРґРЅСѓ РєР»РµС‚РєСѓ.

## 0.1.2-dev.24

- РџРѕРґР±РѕСЂ СЃ СЃС‚РѕСЏ: С…РёС‚Р±РѕРєСЃ `idleв†’crouchв†’idle` РѕРєРѕР»Рѕ Р°РїРµРєСЃР° `pickPose` (РЅРµ РЅР° РІСЃС‘Рј `pickT`); РЅРѕРіРё СЏРєРѕСЂСЏС‚СЃСЏ Рє РЅРёР·Сѓ box РїСЂРё СЃРјРµРЅРµ `h` вЂ” Р±РµР· РїСЂРѕРІР°Р»Р° РІ РїРѕР» Рё Р±РµР· В«РІС‹СЃРѕРєРѕР№В» СѓСЏР·РІРёРјРѕСЃС‚Рё РІ РїСЂРёСЃРµРґРµ.

## 0.1.2-dev.23

- РџРѕРґР±РѕСЂ СЃ СЃС‚РѕСЏ: `heroBoxAnim` Р±РѕР»СЊС€Рµ РЅРµ РїРµСЂРµРєР»СЋС‡Р°РµС‚ С…РёС‚Р±РѕРєСЃ РЅР° `pick` (baked hв‰€crouch) вЂ” `PICK_B` РЅРµ РїСЂРѕРІР°Р»РёРІР°РµС‚СЃСЏ РІ РїРѕР»; Р¶РµСЃС‚ РѕСЃС‚Р°С‘С‚СЃСЏ РІ `heroClip`.

## 0.1.2-dev.22

- Cover: `stepRooms` СѓС‡РёС‚С‹РІР°РµС‚ РєР»РµС‚РєСѓ РїРѕРґ РЅРѕРіР°РјРё (Рё +1px), РЅРµ С‚РѕР»СЊРєРѕ РєРѕСЂРїСѓСЃ вЂ” Р»Р°Р·/`COVER_AIR` РІ РїРѕР»Сѓ Р±РѕР»СЊС€Рµ РЅРµ РјРёРіР°РµС‚ solidв†”air (РїРѕР·Р° jump/fall РЅР° CRUMB РЅР°Рґ РіСЂРѕС‚РѕРј).
- Р РµРґР°РєС‚РѕСЂ Objects: `Exit` (`level_exit`) вЂ” РЅРµСЃРєРѕР»СЊРєРѕ `LV.exits[{id,x,y,toId}]` (РјРёРіСЂР°С†РёСЏ СЃ `LV.exit`; blank в†’ `[]`); Inspect Target level (РїСѓСЃС‚Рѕ = MENU); `tryExit` / `finishLevel` в†’ РёРЅРґРµРєСЃ `LEVELS` РёР»Рё РјРµРЅСЋ; persist `exits`.
- Р РµРґР°РєС‚РѕСЂ Objects: `Door` вЂ” РїР°СЂР° Р·Р° 2 РєР»РёРєР° (`mkDoorAt`, Esc РѕС‚РјРµРЅСЏРµС‚ РїРµСЂРІС‹Р№, Delete СЃРЅРёРјР°РµС‚ РѕР±Р°); Inspect: required bag item + consume-on-activate (`locked=!!need`); persist `need`/`consume`.

## 0.1.2-dev.20

- Р РµРґР°РєС‚РѕСЂ: `Ctrl+D` РґСѓР±Р»РёСЂСѓРµС‚ РєРёСЃС‚СЊ С‚Р°Р№Р»Р° РїР°Р»РёС‚СЂС‹ РІ РЅРѕРІС‹Р№ РєР°СЃС‚РѕРј-С‚Р°Р№Р» (`src`/`frames`/С„Р»Р°РіРё); РЅРµ РІС‹РґРµР»РµРЅРёРµ РєР°СЂС‚С‹, РѕР±СЉРµРєС‚С‹ РЅРµ РєР»РѕРЅРёСЂСѓСЋС‚СЃСЏ.
- Р РµРґР°РєС‚РѕСЂ `#edTileEdit`: `+` РєР°РґСЂ РІ СЂСЏРґ, РґСЂР°Рі-reorder РїСЂРµРІСЊСЋ, Play/Stop (~8 fps); Сѓ `enemy*`/`flier*`/`spider*` РѕС‚РєСЂС‹С‚РёРµ РјР°С‚РµСЂРёР°Р»РёР·СѓРµС‚ bake РІРѕ РІСЃРµ СЃР»РѕС‚С‹.
- Р РµРґР°РєС‚РѕСЂ Objects: `Start` (`player_start`) вЂ” РѕРґРёРЅ `LV.spawn` РЅР° СѓСЂРѕРІРµРЅСЊ (РїРѕРІС‚РѕСЂ = РїРµСЂРµРЅРѕСЃ; Delete в†’ РґРµС„РѕР»С‚); РјР°СЂРєРµСЂ РІ РіРёР·РјРѕ, persist С‡РµСЂРµР· `packLevel.spawn`.

## 0.1.2-dev.19

- Р РµРґР°РєС‚РѕСЂ: `Ctrl+РџРљРњ-РґСЂР°Рі` РЅР° РєР°РЅРІРµ Р·СѓРјРёС‚ СѓСЂРѕРІРµРЅСЊ (С‚РѕС‚ Р¶Рµ `setZoom` / С€Р°РіРё 25вЂ“400%, СЏРєРѕСЂСЊ Сѓ РєСѓСЂСЃРѕСЂР°), РєР°Рє РјР°СЃС€С‚Р°Р± РёРєРѕРЅРѕРє РЅР° РїР°Р»РёС‚СЂРµ.

## 0.1.2-dev.18

- РЎС…РѕРґС‹ СЃ Р»РµСЃС‚РЅРёС†С‹ Рё Р»РёРїРєРѕСЃС‚СЊ СЃРІРµСЂС…Сѓ вЂ” РјСЏРіРєРёР№ `ease`-lerp РІ `state=snap` (`startLadSnap`), Р±РµР· СЂРµР·РєРѕРіРѕ С‚РµР»РµРїРѕСЂС‚Р°.

## 0.1.2-dev.17

- Bake СЃРЅРѕРІР° РїРёС€РµС‚ `tileGfx` (Paint Сѓ С‚Р°Р№Р»РѕРІ 1вЂ“32) РІ `defaults.js`; РїСѓСЃС‚РѕР№ dump СЃ С…РѕР»РѕРґРЅРѕР№ РІРєР»Р°РґРєРё Р±РѕР»СЊС€Рµ РЅРµ Р·Р°С‚РёСЂР°РµС‚ baked-РѕРІРµСЂСЂР°Р№РґС‹.

## 0.1.2-dev.16

- Р’РµСЂС… Р»РµСЃС‚РЅРёС†С‹ РґРµСЂР¶РёС‚ РєР°Рє Р±Р»РѕРє С‡РµСЂРµР· `groundYAt`/`footSupported` + РїРѕСЃР°РґРєР° РІ `moveY` (РЅРµ `tileBlocks`); в†‘ в†’ `exitTop`; СЃС…РѕРґ РІР±РѕРє СЃ `ladCd` (autoLadder С‡С‚РёС‚); РІ СЃС‚РµРЅСѓ РЅРµ РІС‹С…РѕРґРёРј.

## 0.1.2-dev.15

- Р’РµСЂС… Р»РµСЃС‚РЅРёС†С‹ РґРµСЂР¶РёС‚ РєР°Рє Р±Р»РѕРє: one-way РІ `tileBlocks`/`groundYAt`, в†‘ РЅР° РІРµСЂС…Сѓ СЃСЂР°Р·Сѓ `exitTop` (РЅРµ Р»РµР·РµС‚ РІ РІРѕР·РґСѓС… Рё РЅРµ СЃСЂС‹РІР°РµС‚СЃСЏ СЃ РєСЂР°СЏ).

## 0.1.2-dev.14

- РЎРЅСЏС‚ GitHub Pages СЃ СЌС‚РѕР№ СЂРµРїС‹: РЅРµ РїСѓР±Р»РёРєРѕРІР°С‚СЊ РёРіСЂСѓ РїРѕРґ РґРѕРјРµРЅ user-site.

## 0.1.2-dev.13

- РџСѓР±Р»РёС‡РЅР°СЏ СЃР±РѕСЂРєР° РЅР° GitHub Pages: `https://anurbis-dev.github.io/the-ledge/` (`pages.yml` в†’ `dist/`).

## 0.1.2-dev.12

- РџРµСЂРµРєР°С‚ РІСЃРµРіРґР° Р±РµСЂС‘С‚ РїРѕР·Сѓ `roll`/`ROLLP`: РїСЂРёСЃРµРґ, Р»С‘Р¶Р° Рё lerp СЃС‚РѕР№РєРё Р±РѕР»СЊС€Рµ РЅРµ РєСЂСѓС‚СЏС‚СЃСЏ РІРјРµСЃС‚Рѕ РєР»СѓР±РєР°.

## 0.1.2-dev.11

- РЎРїР»СЌС€-Р·Р°РіРѕР»РѕРІРѕРє РїСЂРѕСЏРІР»СЏРµС‚СЃСЏ РїРѕ С†РµРЅС‚СЂСѓ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё С€СЂРёС„С‚Р° Рё СЃС‚РёР»СЏ: Р±РµР· СЃРґРІРёРіР°, Р±РµР· СЃРјРµРЅС‹ РіР°СЂРЅРёС‚СѓСЂС‹ РЅР° РіР»Р°Р·Р°С….

## 0.1.2-dev.10

- РџРѕСЃР»Рµ РїР°РґРµРЅРёСЏ СЃ РєСЂР°СЏ РїРѕ С†РµРЅС‚СЂСѓ РєРѕСЂРѕР±РєРё РіРµСЂРѕРёРЅСЋ РІС‹С‚Р°Р»РєРёРІР°РµС‚ РёР· РЅР°С…Р»С‘СЃС‚Р° РЅР° РіСЂР°РЅСЊ СЃС‚РµРЅС‹ вЂ” СЃР»Р°Р№Рґ СЃРЅРѕРІР° Р±РµСЂС‘С‚СЃСЏ, СЃРєРІРѕР·СЊ РїР»РёС‚РєСѓ РЅРµ Р»РµС‚РёС‚.

## 0.1.2-dev.9

- РР· Р»С‘Р¶Р° РЅР° РєСЂР°СЋ в†“ СЃРЅРѕРІР° СЃРїСѓСЃРєР°РµС‚ РІ РІРёСЃ: `findDescend` СЃРјРѕС‚СЂРёС‚, С‡С‚Рѕ С†РµРЅС‚СЂ РЅР° РїРѕСЃР»РµРґРЅРµРј С‚Р°Р№Р»Рµ, Р° РЅРµ Р·Р° РµРіРѕ СЃРµСЂРµРґРёРЅРѕР№; СЃ РѕР±СЂС‹РІР° Р»С‘Р¶Р° Р±РѕР»СЊС€Рµ РЅРµ СѓС…РѕРґРёС‚ РІ РєСѓРІС‹СЂРѕРє, РµСЃР»Рё РІРёСЃ РЅРµ РІР·СЏР»СЃСЏ.

## 0.1.2-dev.8

- РќР° Р·Р°СЃС‚Р°РІРєРµ РІРѕР·РІСЂР°С‰РµРЅРѕ РјРіРЅРѕРІРµРЅРЅРѕРµ РїРѕСЏРІР»РµРЅРёРµ РЅР°Р·РІР°РЅРёСЏ Р±РµР· СЃС‚Р°СЂС‚РѕРІРѕР№ Р°РЅРёРјР°С†РёРё; РґРІРёР¶РµРЅРёРµ РѕСЃС‚Р°С‘С‚СЃСЏ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РІРІРѕРґР°.

## 0.1.2-dev.7

- Р’ РїР°РЅРµР»СЏС… СЂРµРґР°РєС‚РѕСЂР° РѕС‚РєР»СЋС‡С‘РЅ РїРёРєСЃРµР»СЊРЅС‹Р№ С€СЂРёС„С‚: РёРЅС‚РµСЂС„РµР№СЃ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ СЃРЅРѕРІР° РёСЃРїРѕР»СЊР·СѓРµС‚ РѕР±С‹С‡РЅСѓСЋ СЃРёСЃС‚РµРјРЅСѓСЋ РіР°СЂРЅРёС‚СѓСЂСѓ.

## 0.1.2-dev.6

- Р”РѕР±Р°РІР»РµРЅ С…РѕС‚РєРµР№ `0`, РєРѕС‚РѕСЂС‹Р№ РѕС‚РєСЂС‹РІР°РµС‚ РІСЃРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ Рё Р±СѓРґСѓС‰РёРµ СѓСЂРѕРІРЅРё РІ РІС‹Р±РѕСЂРµ РїСѓС‚Рё Р±РµР· СЂСѓС‡РЅРѕРіРѕ РѕР±С…РѕРґР° РїСЂРѕРіСЂРµСЃСЃР°.
- РќР° СЃС‚Р°СЂС‚Рµ РёРіСЂР° С‚РµРїРµСЂСЊ РїРѕРєР°Р·С‹РІР°РµС‚ РїСЂРѕСЃС‚РѕР№ С‚РёС‚СѓР» СЃ РјСЏРіРєРёРј РїСЂРѕСЏРІР»РµРЅРёРµРј, Р° РїРѕ РєР»РёРєСѓ РёР»Рё РєР»Р°РІРёС€Рµ РјРµРЅСЋ РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ РїР»Р°РІРЅРѕ РїРѕРґ РЅРёРј.
- Р’ СЂРµРґР°РєС‚РѕСЂРµ СЃРїСЂР°Р№С‚Р° РґРѕР±Р°РІР»РµРЅС‹ РѕС‚РґРµР»СЊРЅС‹Рµ Р°РЅРёРјР°С†РёРё РїРѕРґР±РѕСЂР° РґР»СЏ СЃС‚РѕР№РєРё, РїСЂРёСЃРµРґР° Рё Р»С‘Р¶Р°: `pick`, `pickCrouch`, `pickProne`.
- Р“Р»Р°РІРЅРѕРµ РјРµРЅСЋ Рё СЃС‚Р°СЂС‚РѕРІС‹Р№ СЌРєСЂР°РЅ РїСЂРёРІРµРґРµРЅС‹ Рє РїРёРєСЃРµР»СЊРЅРѕРјСѓ СЃС‚РёР»СЋ РёРЅРІРµРЅС‚Р°СЂСЏ: РїР°РЅРµР»Рё, Р·Р°РіРѕР»РѕРІРєРё Рё РєРЅРѕРїРєРё С‚РµРїРµСЂСЊ РґРµСЂР¶Р°С‚ С‚РѕС‚ Р¶Рµ С‚РµРјРЅС‹Р№ СЂРµС‚СЂРѕ-СЃР»РѕР№ Рё СЂР°РјРєРё.

## 0.1.2-dev.2

# Changelog (unreleased)  - в•ЁРЇв•¤Рђв•Ёв••в•Ёв•–в•Ёв•Ўв•Ёв•ќв•Ёв•—в•Ёв•Ўв•Ёв•њв•Ёв••в•Ёв•Ў в•Ёв–’в•Ёв•›в•Ёв•—в•¤Рњв•¤Рв•Ёв•Ў в•Ёв•њв•Ёв•Ў в•Ёв”ђв•¤Рђв•¤Р›в•Ёв”‚в•Ёв–‘в•Ёв•Ўв•¤Р’: в•Ёв•њв•Ёв•›в•Ёв”‚в•Ёв•• в•¤Р‘в•Ёв–‘в•Ёв•ўв•Ёв–‘в•¤Рћв•¤Р’в•¤Р‘в•¤Рџ в•Ёв•њв•Ёв–‘ в•Ёв”ђв•Ёв•›в•Ёв–“в•Ёв•Ўв•¤Рђв•¤Р•в•Ёв•њв•Ёв•›в•¤Р‘в•¤Р’в•¤Рњ в•Ёв”ђв•Ёв•›в•Ёв”¤ в•¤Р–в•Ёв•Ўв•Ёв•њв•¤Р’в•¤Рђв•Ёв•›в•Ёв•ќ в•Ёв•‘в•Ёв•›в•¤Рђв•Ёв•›в•Ёв–’в•Ёв•‘в•Ёв••, в•Ёв–‘ в•Ёв•њв•Ёв•Ў в•Ёв•њв•Ёв–‘ в•¤Р‘в•Ёв•Ўв•¤Р’в•Ёв•‘в•¤Р“ в•¤Р’в•Ёв–‘в•Ёв•Јв•Ёв•—в•Ёв–‘.

# Changelog archive

## 0.1.2-dev.1

- РЎРІРµСЃ: РїР°РґР°РµРј, РєРѕРіРґР° С†РµРЅС‚СЂ С‚РµРєСѓС‰РµР№ РєРѕСЂРѕР±РєРё (РїРѕР·Р° / СЏС‰РёРє РёР· СЂРµРґР°РєС‚РѕСЂР°) СѓС€С‘Р» Р·Р° РєСЂР°Р№ С‚Р°Р№Р»Р° вЂ” Р±РµР· РґС‘СЂРіР°РЅСЊСЏ РІРІРµСЂС…-РІРЅРёР· РЅР° РіСѓР±Рµ AABB.
- РљСЂР°Р№ РЅР° РѕСЃС‹РїР°СЋС‰РµРјСЃСЏ РєР°СЂРЅРёР·Рµ Р±РѕР»СЊС€Рµ РЅРµ РїРµСЂРµР·Р°РїСѓСЃРєР°РµС‚ С‚СЂРµСЃРє: С‚СЂРµСЃРє РїСЂРёС…РѕРґРёС‚ С‚РѕР»СЊРєРѕ РѕС‚ РѕРїРѕСЂС‹ РїРѕРґ С†РµРЅС‚СЂРѕРј РїРµСЂСЃРѕРЅР°Р¶Р°.
- РћСЃС‹РїР°СЋС‰РёР№СЃСЏ РєР°СЂРЅРёР· Р±РѕР»СЊС€Рµ РЅРµ С€Р»С‘С‚ РІРµСЃСЊ РјРёСЂ РІ РґСЂРѕР¶СЊ: РїР»РёС‚РєР° РґС‘СЂРіР°РµС‚СЃСЏ Р»РѕРєР°Р»СЊРЅРѕ, Р° РєР°РјРµСЂР° Рё РіРµСЂРѕР№ РѕСЃС‚Р°СЋС‚СЃСЏ РЅРµРїРѕРґРІРёР¶РЅС‹РјРё.

## 0.1.2-dev.0

- РЈР±СЂР°РЅ 1px РјРѕСЂРі fold-РѕРєРѕРЅ РїСЂРё Р·Р°РєСЂС‹С‚РёРё inventory/intro/outro: РјРµР»РєРёРµ РєР°РґСЂС‹ fold-Р±Р»РёРёС‚Р° С‚РµРїРµСЂСЊ РЅРµ СЂРёСЃСѓСЋС‚СЃСЏ.
- РџРѕСЃР»Рµ Р·Р°РєСЂС‹С‚РёСЏ inventory Р±РѕР»СЊС€Рµ РЅРµ РІСЃРїС‹С…РёРІР°РµС‚ РїР°РЅРµР»СЊ РїР°СѓР·С‹ (РѕРґРёРЅ РєР°РґСЂ `drawPaused` РїРѕСЃР»Рµ `stepInv`).
- РЈР·РєР°СЏ С„Р°Р·Р° fold Р±РѕР»СЊС€Рµ РЅРµ СЃР¶РёРјР°РµС‚ РїР°РЅРµР»СЊ РІ 2px-С€СѓРј: РІРјРµСЃС‚Рѕ Р±Р»РёС‚Р° СЂРёСЃСѓРµС‚СЃСЏ С‡РёСЃС‚Р°СЏ СЃРєР»Р°РґРєР°.

## 0.1.1-dev.3

- Р’СЂР°РіРё Р±РµСЂСѓС‚ С…РёС‚Р±РѕРєСЃ РёР· `getAnimBox` СЃРїСЂР°Р№С‚Р° (`enemyN/idle`), Р° РЅРµ РёР· С…Р°СЂРґРєРѕРґР° 11Г—14 / 14Г—18.

## 0.1.1-dev.2

- РЈР±СЂР°РЅ СЃС‚Р°СЂС‚РѕРІС‹Р№ РїСЂРѕРјРѕСЂРі Р±РµР»РѕРіРѕ/РЅРµСЃС‚РёР»РёР·РѕРІР°РЅРЅРѕРіРѕ СЌРєСЂР°РЅР°: РґРѕ РїСЂРёРјРµРЅРµРЅРёСЏ CSS СЃС‚СЂР°РЅРёС†Р° РґРµСЂР¶РёС‚СЃСЏ РЅР° С‚С‘РјРЅРѕРј С„РѕРЅРµ Рё РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ РїРѕСЃР»Рµ РіРѕС‚РѕРІРЅРѕСЃС‚Рё РєР»СЋС‡РµРІС‹С… СЃС‚РёР»РµР№.

## 0.1.0

- РСЃРїСЂР°РІР»РµРЅ Р·Р°Р»РёРїР°СЋС‰РёР№ С€РµР№Рє РєР°РјРµСЂС‹ РїРѕСЃР»Рµ СЃРјРµСЂС‚РµР»СЊРЅРѕРіРѕ СѓРґР°СЂР° Рё РїР°СѓР·С‹: С‚РµРїРµСЂСЊ РѕРЅ Р·Р°С‚СѓС…Р°РµС‚ РІ РєР°Р¶РґРѕРј РєР°РґСЂРµ, РґР°Р¶Рµ РєРѕРіРґР° РёРіСЂР° РѕСЃС‚Р°РЅРѕРІР»РµРЅР°.
- Р РµРґР°РєС‚РѕСЂ: РєРёСЃС‚СЊ Color вЂ” hue/sat/brightness/contrast РЅР° РєР»РµС‚РєСѓ Р±РµР· РѕС‚РґРµР»СЊРЅС‹С… РІР°СЂРёР°РЅС‚РѕРІ С‚Р°Р№Р»Р°. LMB РєСЂР°СЃРёС‚, RMB СЃР±СЂР°СЃС‹РІР°РµС‚, Ctrl+click Р±РµСЂС‘С‚.

## 0.1.0-dev.81

- Origin/box/Hands СЃРїСЂР°Р№С‚Р° РїРёС€СѓС‚СЃСЏ Bake РІ `BAKED.sprites` (Р±РµР· PNG). Р’С‚РѕСЂРѕР№ РєСѓРІС‹СЂРѕРє СЃРЅРѕРІР° Р±РµСЂС‘С‚ РєРѕСЂРѕР±РєСѓ РґРµР№СЃС‚РІРёСЏ (`forceHeroBox`, `rollAng` СЃР±СЂР°СЃС‹РІР°РµС‚СЃСЏ РЅР° СЃС‚Р°СЂС‚Рµ).

## 0.1.0-dev.80

- РљР°РјРµСЂР°: РјРёСЂ РІ С†РµР»С‹С… px, РґРѕР»СЏ вЂ” CSS-СЃРґРІРёРі Р±СѓС„РµСЂР° 321Г—181 РІ `#view` (С€Р°Рі СЌРєСЂР°РЅР°). HUD РЅР° `#h`. `C.CAM_SUBPX` (Params, 1 РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ).

## 0.1.0-dev.78

- Р”Р°Р±Р»РєР»РёРє РїРѕ СЃРІР°С‡Сѓ РІ РїР°Р»РёС‚СЂРµ РѕС‚РєСЂС‹РІР°РµС‚ СЂРµРґР°РєС‚РѕСЂ РєР°РґСЂРѕРІ (РЅР° РєР°РЅРІРµ вЂ” РЅРµС‚); РїРµСЂРІС‹Р№ РєР»РёРє Р±РѕР»СЊС€Рµ РЅРµ СЃРЅРѕСЃРёС‚ DOM РґРѕ РІС‚РѕСЂРѕРіРѕ.
- Р Р°Р·РјРµСЂ РёРєРѕРЅРѕРє РїР°Р»РёС‚СЂС‹: Ctrl+РџРљРњ-РґСЂР°Рі, РєР°Рє Ctrl+РєРѕР»РµСЃРѕ.
- РЎРїСЂР°Р№С‚-СЂРµРґР°РєС‚РѕСЂ: РєСЂР°СЃРЅР°СЏ РєРѕСЂРѕР±РєР° РЅР° РєР°РґСЂРµ = С…РёС‚Р±РѕРєСЃ РґРµР№СЃС‚РІРёСЏ (origin = РІРµСЂС…-Р»РµРІРѕ, РЅРёР· = Р·РµРјР»СЏ). РџРѕР»СЏ Box / Hit-drag; `saved[id][anim].box`; С„РёР·РёРєР° Р±РµСЂС‘С‚ `getAnimBox` (СЃС‚РѕР№РєР° idle/crouch/prone, РєСѓРІС‹СЂРѕРє, С‚РµРєСѓС‰РёР№ clip).

## 0.1.0-dev.77

- РљР°РјРµСЂР°: follow РІ `render/camera.js` (`followCam` / `resetCam` / `pushCamRender`); СЂРµР·РёРЅР° `kk=1-exp(-CAM_FOLLOW*dt)`, `CAM_SNAP` 1px Р»РёРїРЅРµС‚ Рє С†РµР»Рё (Р±РµР· РґС‘СЂРіР°РЅСЊСЏ РЅР° СЃС‚РѕРїРµ); blit РїРѕ-РїСЂРµР¶РЅРµРјСѓ `Math.round(cam+shake)`. `resetCam` РѕР±РЅСѓР»СЏРµС‚ lead/look.
- Params в†’ Camera: `CAM_DZ_*` / `CAM_FOLLOW` / `CAM_SNAP` / `CAM_LEAD*` / `CAM_LOOK*` РІ `C`, persist `ledge.dev.C`.

## 0.1.0-dev.76

- РЎРїСЂР°Р№С‚С‹ РІ РїР°Р»РёС‚СЂРµ: СЂРµРґР°РєС‚РѕСЂ РєР°РґСЂРѕРІ С‚РѕР»СЊРєРѕ РїРѕ РґР°Р±Р»РєР»РёРєСѓ (РІ С‚.С‡. РіРµСЂРѕРёРЅСЏ); РєР»РёРє СЃС‚Р°РІРёС‚, РµСЃР»Рё РµСЃС‚СЊ РєРёСЃС‚СЊ РѕР±СЉРµРєС‚Р°.
- Light: РїРѕСЃС‚Р°РЅРѕРІРєР° СЂРёСЃСѓРµС‚ С„Р°РєРµР»; РІ Inspect РїР°СЂР°РјРµС‚СЂ Sprite (`lantern` / Р»СЋР±РѕР№ СЃРїСЂР°Р№С‚ / None).

## 0.1.0-dev.75

- РџРµСЂРµРєР°С‚: СЃРїСЂР°Р№С‚ РєСЂСѓС‚РёС‚СЃСЏ С†РµР»РёРєРѕРј (`rollAng`), РіРѕР»РѕРІР° Р±РѕР»СЊС€Рµ РЅРµ СЂРёСЃСѓРµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ СЃ С„РёРєСЃРёСЂРѕРІР°РЅРЅРѕР№ РѕСЂРёРµРЅС‚Р°С†РёРµР№.
- Р“РµСЂРѕРёРЅСЏ: СѓР±СЂР°РЅ РєРѕРЅС‚СЂРѕРІРѕР№ Р±Р»РёРє РѕС‚ С„Р°РєРµР»РѕРІ (`lightDirAt` / rim).

## 0.1.0-dev.74

- РЎРїСЂР°Р№С‚: origin РѕР±С‰РёР№ РЅР° РґРµР№СЃС‚РІРёРµ, Hands (Р·РѕР»РѕС‚РѕР№ СЂРѕРјР±) вЂ” РїРѕРёСЃРє РєСЂРѕРјРєРё РІРјРµСЃС‚Рѕ `C.HAND`, weapon вЂ” РЅР° РєР°РґСЂ; РєСЂРµСЃС‚ origin; С‚РѕС‡РєРё РЅР° РїСЂРµРІСЊСЋ; Reset anchors.

## 0.1.0-dev.72

- Р РµРґР°РєС‚РѕСЂ СЃРїСЂР°Р№С‚Р°: РЅР° РєР°Р¶РґРѕРј РєР°РґСЂРµ СЏРєРѕСЂСЊ РїСЂРёРІСЏР·РєРё (РіРѕР»СѓР±РѕР№) Рё С‚РѕС‡РєР° РѕСЂСѓР¶РёСЏ (РїСѓСЂРїСѓСЂРЅС‹Р№) вЂ” РґСЂР°Рі РёР»Рё РїРѕР»СЏ X/Y; Size РјРµРЅСЏРµС‚ СЂР°Р·РјРµСЂ РєР°РґСЂР°. РќР° РЅР°СЂРёСЃРѕРІР°РЅРЅРѕРј РєР°РґСЂРµ РіРµСЂРѕСЏ РѕСЂСѓР¶РёРµ СЂРёСЃСѓРµС‚СЃСЏ РІ С‚РѕС‡РєРµ weapon.

## 0.1.0-dev.71

- РџР»Р°РІР°СЋС‰РёРµ РѕРєРЅР°: РїРѕР»РѕСЃ РїСЂРѕРєСЂСѓС‚РєРё РЅРµС‚, РїР°РЅРѕСЂР°РјР° РЎРљРњ-РґСЂР°РіРѕРј РїРѕ РєРѕРЅС‚РµРЅС‚Сѓ (Р±Р»РёР¶Р°Р№С€РёР№ overflow). РџРѕР»РѕСЃР° РєР°РґСЂРѕРІ СЃРїСЂР°Р№С‚Р° вЂ” РѕРґРЅР° СЃС‚СЂРѕРєР° + СЃРµРїР°СЂР°С‚РѕСЂ. РљРЅРѕРїРєР° Erase СѓР±СЂР°РЅР° (RMB). РџРёРїРµС‚РєР° вЂ” РєСѓСЂСЃРѕСЂ-РєР°РїРµР»СЊРєР°. РџСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ вЂ” РїР»РѕСЃРєР°СЏ СЃРµСЂР°СЏ С€Р°С…РјР°С‚РєР°, Р±РµР· СЃРµС‚РєРё-С‚РµРЅРё.

## 0.1.0-dev.70

- РђРІС‚Рѕ-РїР°СЂРєСѓСЂ РЅР° СѓСЃС‚СѓРї +1 С‚Р°Р№Р» СЃРЅСЏС‚: РІ СЃС‚СѓРїРµРЅСЊРєСѓ Р±РѕР»СЊС€Рµ РЅРµ Р·Р°СЃРєР°РєРёРІР°РµРј СЃР°РјРё. РР· РїСЂРёСЃРµРґР° С…РѕРґ СЃ РєСЂР°СЏ вЂ” СЃР»РµР·Р°РЅРёРµ РІ РІРёСЃ; РїСЂРёСЃРµРґ + С…РѕРґ + в†“ вЂ” РїРµСЂРµРєР°С‚ (РЅРµ Р»РѕР¶РёРјСЃСЏ).

## 0.1.0-dev.69

- РўР°Р№Р»С‹ Рё РїРµСЂСЃРѕРЅР°Р¶Рё РІ РѕРґРЅРѕРј СЃРїСЂР°Р№С‚-РѕРєРЅРµ: РІСЃС‚СЂРѕРµРЅРЅС‹Р№ С‚Р°Р№Р» РјРѕР¶РЅРѕ РїРµСЂРµРєСЂР°СЃРёС‚СЊ (РєРѕР»Р»РёР·РёСЏ Р·Р°РІРѕРґСЃРєР°СЏ); Сѓ РіРµСЂРѕРёРЅРё/РІСЂР°РіРѕРІ вЂ” СЃС‚СЂРѕРєР° РєР°РґСЂРѕРІ РЅР° РєР°Р¶РґСѓСЋ Р°РЅРёРјР°С†РёСЋ, РєР»РёРє РѕС‚РєСЂС‹РІР°РµС‚ РєР°РґСЂ РІ РїРёРєСЃРµР»СЊРЅРѕРј СЂРµРґР°РєС‚РѕСЂРµ. РќРµРїСЂР°РІР»РµРЅРЅС‹Р№ РєР°РґСЂ РІ РёРіСЂРµ РѕСЃС‚Р°С‘С‚СЃСЏ СЃС‚Р°СЂС‹Рј СЂРёСЃСѓРЅРєРѕРј.

## 0.1.0-dev.68

- Cover-РѕРІРµСЂР»РµР№ Р·Р°С…РІР°С‚С‹РІР°РµС‚ РєРѕР»СЊС†Рѕ РІ 1 С‚Р°Р№Р» РІРѕРєСЂСѓРі РєРѕРјРЅР°С‚С‹ вЂ” Р°РІС‚РѕРєСЂРѕРјРєР° СЃРѕСЃРµРґРµР№ РЅРµ СЂРёСЃСѓРµС‚ СЂР°РјРєСѓ, РїРѕРєР° РєРѕРјРЅР°С‚Р° СЃРєСЂС‹С‚Р°; РїСЂРё РїСЂРѕСЏРІР»РµРЅРёРё РєСЂР°Р№ СЂР°СЃС‚РІРѕСЂСЏРµС‚СЃСЏ РІРјРµСЃС‚Рµ СЃ РіСЂСѓРЅС‚РѕРј.

## 0.1.0-dev.67

- РћРєРЅРѕ С‚Р°Р№Р»Р°: Paint / Erase / Pick РїСЂР°РІСЏС‚ РїРёРєСЃРµР»Рё (RMB вЂ” Р»Р°СЃС‚РёРє), Hit вЂ” РєСЂР°СЃРЅР°СЏ СЂР°РјРєР° РєРѕР»Р»РёР·РёРё РіРµСЂРѕСЏ, РЅРµ РєР°СЂС‚РёРЅРєР°. Re-import PNG Рё РґСЂРѕРї РЅР° РѕРєРЅРѕ РјРµРЅСЏСЋС‚ `src`. РџРљРњ РїРѕ РєР°РЅРІРµ Р±РѕР»СЊС€Рµ РЅРµ С‚Р°СЃРєР°РµС‚ РѕРєРЅРѕ.

## 0.1.0-dev.66

- РђРіРµРЅС‚С‹ РЅРµ С€Р°СЂСЏС‚ Vite: СЃРІРѕР№ СЃРµСЂРІРµСЂ РЅР° СЃРµСЃСЃРёСЋ, РїРѕСЃР»Рµ РґРµР±Р°РіР° РіР°СЃСЏС‚ PID Рё СЃРІРѕСЋ РІРєР»Р°РґРєСѓ.
- РђРіРµРЅС‚ РєРѕРјРјРёС‚РёС‚ С‚РѕР»СЊРєРѕ Р»РѕРєР°Р»СЊРЅРѕ. РџСѓС€ РІ remote вЂ” РїРѕ РєРѕРјР°РЅРґРµ РёР»Рё РєРЅРѕРїРєРѕР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
- РџСЂР°РІРёР»Р° Р°РіРµРЅС‚РѕРІ РєР°Рє РІ PixisEditor: РїРѕР»РЅС‹Р№ `AGENTS.md` (MemPalace, post-fix, git/bump-hook, token-audit, СЃСѓР±Р°РіРµРЅС‚С‹), `agents/*` в†’ `npm run sync:agents`.
- Р РµРґР°РєС‚РѕСЂ: С‚Р°Р№Р»С‹-РґРµРєРѕСЂР°С†РёРё (`deco` РїРѕРІРµСЂС… `base`, РЅРµ `cover`), РґСЂР°Рі-РґСЂРѕРї PNG РІ РїР°Р»РёС‚СЂСѓ (`src/tiles/` + Bake), РґР°Р±Р»РєР»РёРє вЂ” РѕРєРЅРѕ РєРѕР»Р»РёР·РёРё/РѕРІРµСЂР»РµСЏ/РїРµСЂРµРґРЅРµРіРѕ РїР»Р°РЅР°, Ctrl+РґСЂР°Рі вЂ” СЂР°РјРєР°, Shift+РґСЂР°Рі РєРѕРїРёСЂСѓРµС‚, Ctrl+C/V Р±СѓС„РµСЂ. Overlay-РєРЅРѕРїРєР° РЅР° РєРёСЃС‚Рё. Esc СЃРЅР°С‡Р°Р»Р° Р·Р°РєСЂС‹РІР°РµС‚ РѕРєРЅРѕ С‚Р°Р№Р»Р° / СЃРЅРёРјР°РµС‚ СЃРµР»РµРєС‚.
- РџРѕРјРµС‰РµРЅРёСЏ: cover РїСЂРѕСЏРІР»СЏРµС‚СЃСЏ Рё СЃРєСЂС‹РІР°РµС‚СЃСЏ РїР»Р°РІРЅРѕ (`C.ROOM_FADE` в‰€ 0.55 СЃ, Params в†’ World). РљРѕР»Р»РёР·РёСЏ С‰С‘Р»РєР°РµС‚ СЃСЂР°Р·Сѓ; СЂРёСЃСѓРЅРѕРє вЂ” РїСЂР°РІРґР° РєР°СЂС‚С‹ + СЂР°СЃС‚РІРѕСЂСЏСЋС‰РёР№СЃСЏ cover. РћР±СЉРµРєС‚С‹ РіР°СЃРЅСѓС‚ С‚РѕР№ Р¶Рµ Р°Р»СЊС„РѕР№.
- РџРѕРјРµС‰РµРЅРёСЏ (cutaway): СЂРµР¶РёРј Cover РІ СЂРµРґР°РєС‚РѕСЂРµ СЂРёСЃСѓРµС‚ С‚Р°Р№Р»С‹ В«СЃРЅР°СЂСѓР¶РёВ». РџРѕРєР° РіРµСЂРѕРёРЅСЏ РЅРµ РІ СЃРІСЏР·РЅРѕР№ РѕР±Р»Р°СЃС‚Рё cover, СЌС‚Рё РєР»РµС‚РєРё РїРѕРґРјРµРЅСЏСЋС‚ `tileAt` (Empty = Р»Р°Р· `255`). Р’С‹С€Р»Р° вЂ” СЃРЅРѕРІР° РіСЂСѓРЅС‚. РћР±СЉРµРєС‚С‹ РІ Р·Р°РєСЂС‹С‚РѕР№ РєРѕРјРЅР°С‚Рµ РЅРµ СЂРёСЃСѓСЋС‚СЃСЏ Рё РЅРµ С‚РёРєР°СЋС‚. Alt+РґСЂР°Рі РєРѕРїРёСЂСѓРµС‚ С‚РµРєСѓС‰СѓСЋ РєР°СЂС‚Сѓ РІ cover.
- Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅР° СЃ С‚РµРєСѓС‰РёРј РєРѕРґРѕРј СЂРµРґР°РєС‚РѕСЂР°; РґРѕР±Р°РІР»РµРЅ РѕС‚РґРµР»СЊРЅС‹Р№ РіР°Р№Рґ `docs/EDITOR_GUIDE.md` СЃ РїРѕР»РЅС‹Рј РѕРїРёСЃР°РЅРёРµРј РёРЅСЃС‚СЂСѓРјРµРЅС‚РѕРІ, С…РѕС‚РєРµРµРІ Рё РїСЂР°РєС‚РёС‡РµСЃРєРёС… СЃС†РµРЅР°СЂРёРµРІ СЃР±РѕСЂРєРё РёРіСЂРѕРІС‹С… СЃРёС‚СѓР°С†РёР№.
- Р РµРґР°РєС‚РѕСЂ СЃР°Рј РїРёС€РµС‚ СѓСЂРѕРІРЅРё Рё Params РІ `src/core/defaults.js` (РїРѕРєР° РєСЂСѓС‚РёС‚СЃСЏ Vite). `stop-and-build.bat` СЃРѕР±РёСЂР°РµС‚ С‚РѕС‚ Р¶Рµ СЃРЅРёРјРѕРє, С‡С‚Рѕ РІРёРґРµРЅ РІ dev. РќР° `file://` СЃС‚Р°СЂС‹Р№ localStorage Р±РѕР»СЊС€Рµ РЅРµ РїРµСЂРµРєСЂС‹РІР°РµС‚ СЃРІРµР¶РёР№ Bake. Persist С‚РµРїРµСЂСЊ С…СЂР°РЅРёС‚ РґРІРµСЂРё, Р»РёС„С‚С‹, РїР»Р°С‚С„РѕСЂРјС‹, С‚СЊРјСѓ, РІР°Р»СѓРЅС‹, РїР°Р»РєСѓ Рё РєР»СЋС‡.
- РћРєРЅРѕ РЅР°Р·РІР°РЅРёСЏ СѓСЂРѕРІРЅСЏ Рё РѕРєРЅРѕ СЃС‚Р°С‚РёСЃС‚РёРєРё РІ РєРѕРЅС†Рµ СЂР°СЃРєСЂС‹РІР°СЋС‚СЃСЏ РёР· РіРµСЂРѕРёРЅРё РєР°Рє РёРЅРІРµРЅС‚Р°СЂСЊ (СЃРЅР°С‡Р°Р»Р° РІРµСЂС‚РёРєР°Р»СЊ, РїРѕС‚РѕРј РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊ). Р’ РєРѕРЅС†Рµ СѓСЂРѕРІРЅСЏ РєРЅРѕРїРєРё REPLAY (РїРµСЂРµРёРіСЂР°С‚СЊ С‚РµРєСѓС‰РёР№) Рё CONTINUE (СЃР»РµРґСѓСЋС‰РёР№; РЅР° РїРѕСЃР»РµРґРЅРµРј вЂ” MENU). Enter/РїСЂРѕР±РµР» вЂ” РІС‹Р±СЂР°РЅРЅР°СЏ РєРЅРѕРїРєР°, в†ђ/в†’ вЂ” РІС‹Р±РѕСЂ, R вЂ” replay.
- Р”СЂРѕРїРЅСѓС‚С‹Р№ Р»СѓС‚ РїРѕРєР°С‡РёРІР°РµС‚СЃСЏ РєР°Рє РїСЂРµРґРјРµС‚С‹ РЅР° РєР°СЂС‚Рµ (`sin(timeВ·2.4 + ph)`), Р° РЅРµ СЃС‚РѕРёС‚ СЃС‚Р°С‚РёС‡РЅРѕ РїРѕСЃР»Рµ РїСЂРёР·РµРјР»РµРЅРёСЏ.
- DROP: РїРѕСЃР»Рµ РєРЅРѕРїРєРё вЂ” РјРѕРґР°Р»РєР° СЃРєРѕР»СЊРєРѕ РІС‹РєРёРЅСѓС‚СЊ (в€’ / +). РџСЂРµРґРјРµС‚С‹ Р»РµС‚СЏС‚ СЃСЂР°Р·Сѓ Рё РІ СЂР°Р·РЅС‹Рµ СЃС‚РѕСЂРѕРЅС‹. РђРІС‚РѕРїРѕРґР±РѕСЂ С‚РѕР»СЊРєРѕ РµРґР°/РјРѕРЅРµС‚С‹/СЃР°РјРѕС†РІРµС‚С‹ Рё СЃРѕРґРµСЂР¶РёРјРѕРµ СЃСѓРЅРґСѓРєР°; РѕСЂСѓР¶РёРµ, СЃС‚СЂРµР»С‹, С„Р°РєРµР» Рё РїСЂРѕС‡РµРµ вЂ” РєРЅРѕРїРєРѕР№ вњ‹.
- РРЅРІРµРЅС‚Р°СЂСЊ: С‚Р°Рї Рё DROP Р±РѕР»СЊС€Рµ РЅРµ РіР»РѕС‚Р°РµС‚ РїСЂРѕР·СЂР°С‡РЅС‹Р№ СЃС‚РёРє вЂ” СЃР»СѓС€Р°С‚РµР»СЊ РЅР° window capture. РЎС‚РёРє Рё вњ‹/в¤’ РїРѕР»РЅРѕСЃС‚СЊСЋ РїСЂСЏС‡СѓС‚СЃСЏ РІ РїР°РєРµ, РјРµРЅСЋ, РїР°СѓР·Рµ, Р·Р°СЃС‚Р°РІРєРµ Рё СЂРµРґР°РєС‚РѕСЂРµ. Dev-С…РѕС‚РєРµРё: 1 РѕСЂСѓР¶РёРµ, 2 РїСЂРµРґРјРµС‚С‹, 3 РµРґР°, 4 Р±СЂРѕРЅСЏ, 5 РєСѓСЃРєРё.
- РРЅРІРµРЅС‚Р°СЂСЊ: С‚Р°Р±С‹ ALL/FIND/GEAR/PART; РІ РєР°СЂС‚РѕС‡РєРµ DROP (СЃ С‡РёСЃР»РѕРј, РµСЃР»Рё СЃС‚РµРє >1); РґСЂР°Рі РїСЂРµРґРјРµС‚Р° РЅР° РїСЂРµРґРјРµС‚ вЂ” РєСЂР°С„С‚ (РїР°Р»РєР°+РєР°РјРµРЅСЊ=РєРѕРїСЊС‘) РёР»Рё СЃР±РѕСЂРєР° РєСѓСЃРєРѕРІ РїР°Р·Р»Р°; С‚Р°Рї-РґСЂР°Рі СЃРєСЂРѕР»Р» Р±РµР· РїРѕР»РѕСЃС‹.
- РРЅРІРµРЅС‚Р°СЂСЊ: I РёР»Рё С‚Р°Рї РїРѕ РіРµСЂРѕРёРЅРµ. РџР°РЅРµР»СЊ 70% СЌРєСЂР°РЅР°, СЃРєР»Р°РґРєР° РёР· РіРµСЂРѕРёРЅРё вЂ” СЃРЅР°С‡Р°Р»Р° РІРµСЂС‚РёРєР°Р»СЊ, РїРѕС‚РѕРј РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊ; Р·Р°РєСЂС‹С‚РёРµ РІ РѕР±СЂР°С‚РЅРѕРј РїРѕСЂСЏРґРєРµ. РўР°Рї РїРѕ РїСЂРµРґРјРµС‚Сѓ вЂ” РєР°СЂС‚РѕС‡РєР° СЃ РєР°СЂС‚РёРЅРєРѕР№, СЃС‚Р°С‚Р°РјРё Рё РѕРїРёСЃР°РЅРёРµРј. Р‘Р»РёРїС‹ РЅР° РѕС‚РєСЂС‹С‚РёРµ/Р·Р°РєСЂС‹С‚РёРµ РїР°РєР° Рё РєР°СЂС‚РѕС‡РєРё.
- Mix: РїР°СѓР·Р° РЅРµ СЃР±СЂР°СЃС‹РІР°РµС‚ РїРѕР·РёС†РёСЋ, РїРѕР»РѕСЃР° РїРµСЂРµРјРѕС‚РєРё, РєРЅРѕРїРєРё Intro/Verse/Chorus/End Рё С€Р°Рі РїРѕ С‚Р°РєС‚Сѓ. Р’РєР»Р°РґРєР° Р±РѕР»СЊС€Рµ РЅРµ СЃРЅРёРјР°РµС‚ РїР°СѓР·Сѓ СЃР°РјР°.
- Р“Р°СЂРїСѓРЅ РЅР° СЃСѓС€Рµ: РєСЂСЋРє РїРѕРґ 45В° (в†‘ вЂ” СЃС‚СЂРѕРіРѕ РІРІРµСЂС…), С‚СЏРЅРµС‚ Рє С‚РѕС‡РєРµ Рё РѕС‚СЃС‚С‘РіРёРІР°РµС‚СЃСЏ РЅРµ РґРѕР»РµС‚Р°СЏ вЂ” РїРѕР»С‘С‚ РїРѕ РёРјРїСѓР»СЊСЃСѓ. Р’ РІРѕРґРµ РїРѕ-РїСЂРµР¶РЅРµРјСѓ Р±РѕР»С‚ Р±РµР· РїРѕРґС‚СЏРіР°. Р”Р»РёРЅР°/С‚СЏРіР° РІ Params. Q Рё С‚Р°Рї РїРѕ РёРєРѕРЅРєРµ РѕСЂСѓР¶РёСЏ РїРµСЂРµРєР»СЋС‡Р°СЋС‚ СЂСѓРєСѓ (РїР°Р»РєР° / Р»СѓРє / РіР°СЂРїСѓРЅ).
- РњСѓР·С‹РєР°: С‡РµС‚С‹СЂРµ Р°РІС‚РѕСЂСЃРєРёС… С‚СЂРµРєР° С„РѕСЂРјРѕР№ Sonic/Contra вЂ” intro РѕРґРёРЅ СЂР°Р·, РґР°Р»СЊС€Рµ verse в†’ chorus в†’ end Рё Р»СѓРї СЃ РєСѓРїР»РµС‚Р°. РљР°С‚Р°Р»РѕРі РІ Mix, `ledge.dev.score`. РџР»РµРµСЂ Р±РѕР»СЊС€Рµ РЅРµ РєСЂСѓС‚РёС‚ РёРЅС‚СЂРѕ РїРѕ РєСЂСѓРіСѓ.
- Р“Р»Р°РІРЅРѕРµ РјРµРЅСЋ РїРѕСЃР»Рµ Р·Р°СЃС‚Р°РІРєРё вЂ” РІС‹Р±СЂР°РЅРЅС‹Р№ РјР°РєРµС‚ В«РЈСЃС‚СѓРїВ»: New Game, Continue (РєР°СЂС‚Р° СѓСЂРѕРІРЅРµР№), Settings, Credits. РЎРїРёСЃРѕРє СѓСЂРѕРІРЅРµР№ Р±РѕР»СЊС€Рµ РЅРµ РїРµСЂРІС‹Р№ СЌРєСЂР°РЅ.
- РџРѕСЃР»Рµ РІС‹СЃРѕРєРѕРіРѕ РїР°РґРµРЅРёСЏ С…РёС‚Р±РѕРєСЃ РѕСЃС‚Р°С‘С‚СЃСЏ Р»С‘Р¶Р° РґРѕ РєРѕРЅС†Р° `getupPose`; РІСЃС‚Р°С‘С‚ С‚РѕР»СЊРєРѕ РєРѕРіРґР° Р°РЅРёРјР°С†РёСЏ РґРѕРёРіСЂР°Р»Р° вЂ” Р±РѕР»СЊС€Рµ РЅРµ Р·Р°РІРёСЃР°РµС‚ РІ РІРѕР·РґСѓС…Рµ.
- РџРѕСЃР»Рµ РІС‹СЃРѕРєРѕРіРѕ РїР°РґРµРЅРёСЏ `getupT` СЃРЅРѕРІР° С‚РёРєР°РµС‚СЃСЏ вЂ” РіРµСЂРѕРёРЅСЏ РІСЃС‚Р°С‘С‚ (`getupPose`) Рё Р±РµР¶РёС‚, Р° РЅРµ Р·Р°Р»РёРїР°РµС‚ Р»С‘Р¶Р°.
- Р РµРґР°РєС‚РѕСЂ: Сѓ РїР»Р°РІР°СЋС‰РёС… РѕРєРѕРЅ СѓРіРѕР»РѕРє СЂРµСЃР°Р№Р·Р° (SE) вЂ” С‚СЏРЅРµС‚СЃСЏ, СЂР°Р·РјРµСЂ РїРёС€РµС‚СЃСЏ РІ `ledge.ed.float`.
- Р РµРґР°РєС‚РѕСЂ: РѕРєРЅР° СЃРЅРѕРІР° С‚Р°СЃРєР°СЋС‚СЃСЏ вЂ” bindFloat РІРµС€Р°РµС‚СЃСЏ СЃР°Рј Рё СЃР»СѓС€Р°РµС‚ move РЅР° window, РЅРµ С‚РµСЂСЏРµС‚СЃСЏ РїРѕСЃР»Рµ РїСЂР°РІРѕРє editor.js.
- Р РµРґР°РєС‚РѕСЂ: РїР»Р°РІР°СЋС‰РёРµ РѕРєРЅР° (СЃР»РѕРё, РґРёР°Р»РѕРі NPC, РёРЅСЃРїРµРєС‚РѕСЂ, Р»СѓС‚) С‚Р°СЃРєР°СЋС‚СЃСЏ Р·Р° С€Р°РїРєСѓ Рё РџРљРњ, СЃРєСЂРѕР»Р» вЂ” РЎРљРњ-РґСЂР°Рі Рё РєРѕР»РµСЃРѕ, РїРѕР»РѕСЃ РїСЂРѕРєСЂСѓС‚РєРё РЅРµС‚. РЈР±СЂР°РЅР° РІРµСЂС…РЅСЏСЏ РїРѕР»РѕСЃРєР° Edit/Pause/Menu/Full/Restart/Debug вЂ” Tab / Esc / P / R.
- Р”РёР°Р»РѕРіРё: РІС‹Р±РѕСЂ РѕС‚РІРµС‚Р° РЅРµ РјРµРЅСЏРµС‚ РїРѕР·Сѓ. РЈРґР°СЂ РІСЂР°РіР° РёР»Рё РёСЃРїСѓРі NPC РѕР±СЂС‹РІР°РµС‚ СЂР°Р·РіРѕРІРѕСЂ вЂ” СЃРѕР±РµСЃРµРґРЅРёРє Р±РµР¶РёС‚ РґРѕРјРѕР№/РІ РґРІРµСЂСЊ, РїРѕРєР° РІСЂР°РіРё СЂСЏРґРѕРј. РџРѕСЃР»Рµ СЃСѓС‚Рё вЂ” РєРѕСЂРѕС‚РєРёРµ В«already talkedВ» / В«anything else?В», РїРѕРІС‚РѕСЂ С‚РѕР»СЊРєРѕ РїРѕ РїСЂРѕСЃСЊР±Рµ. Р’ СЂРµРґР°РєС‚РѕСЂРµ РєР»РёРє РїРѕ NPC РѕС‚РєСЂС‹РІР°РµС‚ РѕРєРЅРѕ РґРµСЂРµРІР°.
- РњСѓР·С‹РєР°: chip-РїР»РµРµСЂ (`src/audio/music.js`) РёРіСЂР°РµС‚ Р°РІС‚Рѕ-РїР°СЂС‚РёС‚СѓСЂСѓ `lantern-key` (~12 РљР‘, G minor, 99 BPM, Р»СѓРї 32 С‚Р°РєС‚Р°). РЎР±РѕСЂС‰РёРє `npm run music:score` РіРѕРЅСЏРµС‚ MP3 в†’ JSON (HPS РїРѕ РїРѕР»РѕСЃР°Рј, РЅРµ РєР»РѕРЅ). РЎС‚Р°СЂС‚ СЃ СѓСЂРѕРІРЅСЏ, РїР°СѓР·Р°/РјРµРЅСЋ/СЂРµРґР°РєС‚РѕСЂ/hidden вЂ” hush.
- Р‘Р°Р±Р±Р»С‹: РЅРµР±Р»РѕРєРёСЂСѓСЋС‰РёРµ СЂРµРїР»РёРєРё РіРµСЂРѕРёРЅРё (РїСѓСЃС‚РѕР№ СЃСѓРЅРґСѓРє, Р·Р°РїРµСЂС‚Р°СЏ РґРІРµСЂСЊ, РїРµСЂРІС‹Р№ РїРѕРґР±РѕСЂ РїСЂРµРґРјРµС‚Р°) Рё РІРµС‚РІСЏС‰РёРµСЃСЏ РґРёР°Р»РѕРіРё NPC. Р—РІСѓРє РїРѕ Р±СѓРєРІР°Рј СЃ РІР°СЂРёР°РЅС‚Р°РјРё С‚РµРјР±СЂР° вЂ” СЃС‚СЂР°РЅРёС†Р° `/talk-lab.html`.
- Р’РѕРґР°: РЅС‹СЂРѕРє РјРµРґР»РµРЅРЅС‹Р№ (`SWIM_DN` 40), РІСЃРїР»С‹С‚РёРµ Р±С‹СЃС‚СЂРѕРµ (`SWIM_UP` в€’90). РЎРЅСЏС‚С‹ РїРѕС‚РѕР»РєРё в€’28/в€’22; РіСЂРµР±РѕРє РёР· РіР»СѓР±РёРЅС‹ РЅРµ СЂРµР¶РµС‚СЃСЏ. РџСЂС‹Р¶РѕРє СЃ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё РЅРµ СЂРµР¶РµС‚ jump-cut вЂ” РІС‹Р»РµС‚ РєР°Рє СЃ СЃСѓС€Рё.
- Р РµРґР°РєС‚РѕСЂ: РІРєР»Р°РґРєР° Intro вЂ” РїСЂР°РІРєР° РїСѓР»Р° С„СЂР°Р· Рё СЃРІРѕРµР№ С„СЂР°Р·С‹ СѓСЂРѕРІРЅСЏ (РїСѓСЃС‚Рѕ = СЂР°РЅРґРѕРј). РџСѓР» РІ `ledge.dev.intro`, РЅР° СѓСЂРѕРІРµРЅСЊ вЂ” `LV.intro`.
- Р—Р°СЃС‚Р°РІРєР° СѓСЂРѕРІРЅСЏ: РІРјРµСЃС‚Рѕ TAP СЃР»СѓС‡Р°Р№РЅР°СЏ С„СЂР°Р·Р° РёР· РїСѓР»Р° (РєСЂРѕРјРµ 11/17/18).
- Р—Р°СЃС‚Р°РІРєР° СѓСЂРѕРІРЅСЏ: РЅР°Р·РІР°РЅРёРµ РїРёРєСЃРµР»СЊРЅС‹Рј С€СЂРёС„С‚РѕРј РІРјРµСЃС‚Рѕ Р¶С‘Р»С‚С‹С… РєРІР°РґСЂР°С‚РѕРІ-Р·Р°РіР»СѓС€РµРє.
- РњРµРЅСЋ: РєРЅРѕРїРєР° Г— СѓРґР°Р»СЏРµС‚ СѓСЂРѕРІРµРЅСЊ (РїРѕСЃР»РµРґРЅРёР№ РЅРµР»СЊР·СЏ). Р РµРґР°РєС‚РѕСЂ вЂ” Del Level. РЈРґР°Р»С‘РЅРЅС‹Рµ РїРёС€СѓС‚СЃСЏ РІ `ledge.dev.levels._gone`.
- ESC РёР· РёРіСЂС‹ РѕС‚РєСЂС‹РІР°РµС‚ РјРµРЅСЋ Рё СЃС‚Р°РІРёС‚ РїР°СѓР·Сѓ; ESC РёР· РјРµРЅСЋ РІРѕР·РІСЂР°С‰Р°РµС‚ РІ С‚Сѓ Р¶Рµ СЃРµСЃСЃРёСЋ. РџРµСЂРІС‹Р№ СЌРєСЂР°РЅ (РµС‰С‘ РЅРµ РёРіСЂР°Р»Рё) ESC РЅРµ Р·Р°РєСЂС‹РІР°РµС‚.
- РЎС‚РѕР№РєРё СЃРЅРѕРІР° Р¶РґСѓС‚ РєРѕРЅРµС† Р°РЅРёРјР°С†РёРё (`stanceT`); СѓРґРµСЂР¶Р°РЅРёРµ в†‘ РЅРµ С‰С‘Р»РєР°РµС‚ С‡РµСЂРµР· РїСЂРёСЃРµРґ.
- Р’ С‰РµР»СЊ РЅР° СѓСЂРѕРІРЅРµ РіСЂСѓРґРё вЂ” РїР°СЂРєСѓСЂ РЅР° 1 С‚Р°Р№Р», РїСЂРёСЃРµРґ/Р»С‘Р¶Р° РїРѕСЃР»Рµ Р°РЅРёРјР°С†РёРё. РЈ РїРѕР»Р° РёР· СЃС‚РѕР№РєРё СЃР°РјР° РЅРµ Р·Р°Р»РµР·Р°РµС‚ (РЅСѓР¶РµРЅ в†“). РќР°Р»РµРІРѕ РІ С‚РѕРЅРЅРµР»СЊ 1 Р±Р»РѕРєР° С‚РѕР¶Рµ СЂР°Р±РѕС‚Р°РµС‚ (`findChestStep`).
- РђРІС‚Рѕ-РїР°СЂРєСѓСЂ РЅР° 1 С‚Р°Р№Р» Р±РµР· Р·РµРјР»Рё РїРѕРґ СѓСЃС‚СѓРїРѕРј: РїР°СЂСЏС‰Р°СЏ РїРѕР»РєР° Рё СЏРјР° РїРµСЂРµРґ РЅРµР№ С‚РѕР¶Рµ Р±РµСЂСѓС‚ РјР°РЅС‚Р» (РЅРµ С‚РѕР»СЊРєРѕ СЃС‚СѓРїРµРЅСЊ РЅР° РїРѕР»Сѓ).
- Р©РµР»СЊ Сѓ РїРѕР»Р° (16px / HTOP) РёР· СЃС‚РѕР№РєРё вЂ” РїР°СЂРєСѓСЂ, РїРѕС‚РѕРј РїСЂРёСЃРµРґ РёР»Рё Р»С‘Р¶Р°; Р±РѕР»СЊС€Рµ РЅРµ СЃС‚РѕРїРѕСЂРёС‚ РІ СЃС‚РµРЅСѓ. РЇРјР° РІРЅРёР· РїРѕ-РїСЂРµР¶РЅРµРјСѓ РїРѕ в†“.
- РџР°СЂРєСѓСЂ С‚РѕР»СЊРєРѕ РЅР° СЃС‚СѓРїРµРЅСЊ +1 С‚Р°Р№Р». РџСЂРѕРїР°СЃС‚СЊ С€РёСЂРµ С‚Р°Р№Р»Р° РЅРµ РїРµСЂРµР»РµС‚Р°РµС‚ Рё РЅРµ Р°РІС‚Рѕ-Р»РµР·РµС‚ (РІ РІРѕР·РґСѓС…Рµ СЃРЅРѕРІР° С‚РѕР»СЊРєРѕ С…РІР°С‚).
- РР· Р»С‘Р¶Р° Сѓ РєСЂР°СЏ: РІРёСЃ РµСЃР»Рё СЏРјР° >1 С‚Р°Р№Р»Р°, РёРЅР°С‡Рµ СЃРєР°С‚.
- РђРІС‚Рѕ-РІСЃС‚Р°РІР°РЅРёРµ С‚РѕР»СЊРєРѕ РѕРґРёРЅ СЂР°Р· РЅР° РІС‹С…РѕРґРµ РёР· С‚РѕРЅРЅРµР»СЏ, РЅРµ РІРЅСѓС‚СЂРё.
- Р РµРґР°РєС‚РѕСЂ: Undo/Redo (Ctrl+Z / Ctrl+Y). РљР»РёРє РїРѕ СЃС‚РѕРїРєРµ РѕР±СЉРµРєС‚РѕРІ РїРµСЂРµР±РёСЂР°РµС‚ РёС…. Backspace РЅР° РїР°СЂР°РјРµС‚СЂРµ СЃР±СЂР°СЃС‹РІР°РµС‚ РЅР° Р·Р°РІРѕРґСЃРєРѕР№ РґРµС„РѕР»С‚ (РЅРµ РЅР° Р·РЅР°С‡РµРЅРёРµ РїСЂРё РѕС‚РєСЂС‹С‚РёРё РїР°РЅРµР»Рё).
- Р РµРґР°РєС‚РѕСЂ: РїСЂРё РґСЂР°РіРµ СЃР»РѕСЏ РїРѕРґСЃРІРµС‡РёРІР°РµС‚СЃСЏ СЃР»РѕС‚ РІСЃС‚Р°РІРєРё (РїРѕР»РѕСЃР° РјРµР¶РґСѓ СЃС‚СЂРѕРєР°РјРё).
- Р РµРґР°РєС‚РѕСЂ: РґСЂР°Рі СЃР»РѕС‘РІ РІ РїР°РЅРµР»Рё; hue/sat/brightness РЅР° СЃР»РѕР№; С€С‚Р°РјРї Repeat РґРѕ 256. РЎРѕР»Рѕ РїСЂСЏС‡РµС‚ РіРµСЂРѕСЏ Рё РѕР±СЉРµРєС‚С‹, РµСЃР»Рё СЃР»РѕР№ РЅРµ collision (РѕРЅРё Р¶РёРІСѓС‚ РЅР° Main). Ctrl+РєР»РёРє вЂ” РїРёРїРµС‚РєР° (С‚Р°Р№Р»/РѕР±СЉРµРєС‚), РџРљРњ вЂ” СЃС‚С‘СЂРєР°, СѓРґРµСЂР¶Р°РЅРёРµ СЃРЅРѕРІР° С‚СЏРЅРµС‚ СЃС‚РёСЂР°РЅРёРµ. РџСЂР°РІРєРё РїРёС€СѓС‚СЃСЏ РІ СѓСЂРѕРІРµРЅСЊ (`ledge.dev.levels`).
- РЎР»РѕРё: РЅРµР±Рѕ, С…РѕР»РјС‹, РєСѓСЃС‚С‹ Рё РїС‹Р»СЊС†Р° вЂ” РІ РїР°РЅРµР»Рё СЃ РїР°СЂР°Р»Р»Р°РєСЃРѕРј Рё РіР»Р°Р·РѕРј. РЈ С‚Р°Р№Р»РѕРІРѕРіРѕ СЃР»РѕСЏ С„Р»Р°Рі Repeat: С€С‚Р°РјРї WГ—H С‚Р°Р№Р»РёС‚СЃСЏ Р±РµСЃРєРѕРЅРµС‡РЅРѕ (1Г—1 = Р·Р°Р»РёРІРєР°).
- РЎР»РѕРё: СЃРѕР»Рѕ вЂ” Ctrl+РєР»РёРє РїРѕ РіР»Р°Р·Сѓ (РєР°Рє РІ Pixis); РіР»Р°Р· СЃРµСЂС‹Р№, РЅРµ С‚С‘РјРЅС‹Р№ СЌРјРѕРґР·Рё.
- Р РµРґР°РєС‚РѕСЂ: РґСЂР°Рі-РґСЂРѕРї С‚Р°Р№Р»РѕРІ/РѕР±СЉРµРєС‚РѕРІ РЅР° РєР°РЅРІСѓ; РїР°РЅРµР»СЊ СЃР»РѕС‘РІ (рџ‘Ѓ / Р·Р°РјРѕРє / СЃРѕР»Рѕ, +/в€’, РїР°СЂР°Р»Р»Р°РєСЃ X/Y); Geo вЂ” РѕРІРµСЂР»РµР№ РєРѕР»Р»РёР·РёР№ (`G`). РћР±СЉРµРєС‚С‹ Sound (flat/falloff), Light (С†РІРµС‚/СЃРёР»Р°/СЂР°РґРёСѓСЃ), Volume (color correct + РјР°СЃРєРё, С…СЌРЅРґР»С‹ Рё РїРѕРІРѕСЂРѕС‚).
- Р’СЃРїР»С‹С‚РёРµ Сѓ РєР°РјРµРЅРЅРѕРіРѕ РїРѕС‚РѕР»РєР°: Р±РѕР»СЊС€Рµ РЅРµ С‚СЏРЅРµС‚ Рє РєСЂР°СЋ Рё РЅРµ РІС‹Р»РµР·Р°РµС‚ СЃРєРІРѕР·СЊ РєР°РјРµРЅСЊ (`tryClimbOut` С‚РѕР»СЊРєРѕ СЃ РѕС‚РєСЂС‹С‚РѕР№ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё; Р»РёРЅРёСЏ РїРѕРєРѕСЏ вЂ” РЅРёР· РєР°РјРЅСЏ).
- Р РµРіСЂРµСЃСЃРёСЏ Р·СѓРјР°: С†РёРєР» С‡Р°РЅРєРѕРІ РІ `tiles()` РїРѕС‚РµСЂСЏР» СЃРєРѕР±РєРё вЂ” СЂРёСЃРѕРІР°Р»СЃСЏ РѕРґРёРЅ С‡Р°РЅРє СЃРѕ СЃРґРІРёРіРѕРј, РєР°РјРЅРё В«СЃСЉРµР·Р¶Р°Р»РёВ». РЎРєРѕР±РєРё РІРµСЂРЅСѓР»Рё; `viewScale` СЃР±СЂР°СЃС‹РІР°РµС‚СЃСЏ РїСЂРё РІС‹С…РѕРґРµ РёР· СЂРµРґР°РєС‚РѕСЂР°.
- Р РµРґР°РєС‚РѕСЂ: Р·СѓРј СЃС‚СѓРїРµРЅСЏРјРё 25/50/100/200/400% (nearest-neighbor, РєР°РјРµСЂР° РЅР° СЃРµС‚РєРµ Р·СѓРјР°) вЂ” Р±РµР· СЃС‚СЂРѕР±Р° РїРёРєСЃРµР»РµР№; `0` СЃР±СЂР°СЃС‹РІР°РµС‚ РІ 1:1.
- РљР°СЂС‚Р° Р±РµР· С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹С… РіСЂР°РЅРёС†: origin + СЂРѕСЃС‚ Р±СѓС„РµСЂР° РІ Р»СЋР±СѓСЋ СЃС‚РѕСЂРѕРЅСѓ (РІ С‚.С‡. РІ РјРёРЅСѓСЃ). Р’ СЂРµРґР°РєС‚РѕСЂРµ РєР°РјРµСЂР° РЅРµ Р·Р°Р¶РёРјР°РµС‚СЃСЏ.
- Р РµРґР°РєС‚РѕСЂ: РїР°РЅРµР»СЊ СЃ Р·Р°РєР»Р°РґРєР°РјРё Tiles / Objects / Params, СЂРµСЃР°Р№Р·, TAB/ESC. MMB вЂ” РїР°РЅ, РєРѕР»РµСЃРѕ вЂ” Р·СѓРј, RMB вЂ” СЃС‚С‘СЂРєР°, long-press вЂ” СѓРґР°Р»РёС‚СЊ. РЈР±СЂР°РЅС‹ РєРЅРѕРїРєРё В«СЃС‚РµСЂРµС‚СЊВ» Рё В«СЂСѓРєР°В». HUD Рё СЃС‚РёРєРё СЃРєСЂС‹РІР°СЋС‚СЃСЏ. РћР±СЉРµРєС‚С‹ вЂ” РёРєРѕРЅРєРё (Ctrl+РєРѕР»РµСЃРѕ вЂ” СЂР°Р·РјРµСЂ). Params вЂ” СЃРіСЂСѓРїРїРёСЂРѕРІР°РЅРЅС‹Рµ СЃР»Р°Р№РґРµСЂС‹ `C` СЃ РїРѕРёСЃРєРѕРј, СЃСЂР°Р·Сѓ РІ РёРіСЂСѓ. New Level. РџРѕРІС‚РѕСЂРЅС‹Р№ РєР»РёРє С‚Р°Р№Р»Р° вЂ” СЂР°РЅРґРѕРј РёР· `variants`. UI РјРµРЅСЋ Рё СЂРµРґР°РєС‚РѕСЂР° РЅР° Р°РЅРіР»РёР№СЃРєРѕРј.
- Р’РѕРґР°: Р±СЂС‹Р·РіРё РЅР° РІРµСЂС…РЅРёС… С‚Р°Р№Р»Р°С… Сѓ Р±РµСЂРµРіР° (СЃРёРЅС…СЂРѕРЅ СЃ РіСЂРµР±РЅРµРј РІРѕР»РЅС‹).
- РџСѓР·С‹СЂСЊРєРё РІРѕР·РґСѓС…Р°: СЂР°Р·Р±СЂРѕСЃ СЂР°Р·РјРµСЂР° (1вЂ“3px) Рё СЃРєРѕСЂРѕСЃС‚Рё.
- Р—Р°С‚РµРјРЅРµРЅРёРµ РІРѕРґС‹ Рё РіРµСЂРѕСЏ РїРѕ РіР»СѓР±РёРЅРµ РѕР·РµСЂР°; РІ СЂРµРґР°РєС‚РѕСЂРµ РїСЂРµСЃРµС‚С‹ РєРёСЃС‚Рё В«РІРѕРґР°В» (С‡РёСЃС‚Р°СЏвЂ¦Р±РµР·РґРЅР°). `LV.water: [[c,r,shade],вЂ¦]`.
- РЎРєРѕСЃС‹: 2:1 (`SLR2`/`SLR3`, `SLL2`/`SLL3`), 4:1 (`SLR4AвЂ¦D`) Рё РґСѓРіРё (`SLRCA`/`SLRCB`) СЃС‚С‹РєСѓСЋС‚СЃСЏ РїРѕ РІС‹СЃРѕС‚Рµ РєСЂР°СЏ вЂ” РєРѕС‡РєРё Рё СЏРјС‹ Р±РµР· СЃС‚СѓРїРµРЅРё 45В°.
- Р РµРґР°РєС‚РѕСЂ: РїСЂРѕС‚СЏР¶РєР° РєРёСЃС‚Рё СЃРєРѕСЃР° СЃР°РјР° РєР»Р°РґС‘С‚ РїРѕР»РѕРіСѓСЋ С†РµРїРѕС‡РєСѓ; С€С‚СЂРёС… РІРІРµСЂС…-РІРЅРёР· вЂ” РґСѓРіР° (РєРѕС‡РєР°/СЏРјР°).
- РҐРѕРґСЊР±Р° РїРѕ СЃРєРѕСЃСѓ: Р·Р°РјРµРґР»РµРЅРёРµ РѕС‚ СЂРµР°Р»СЊРЅРѕРіРѕ СѓРєР»РѕРЅР°, РЅРµ РІСЃРµРіРґР° РєР°Рє 45В°.
- РҐРѕРґСЊР±Р° РїРѕ СЃРєРѕСЃСѓ: РІРґРѕР»СЊ СЃРєР»РѕРЅР° ~90% Р±РµРіР° (РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Р№ С€Р°Рі /в€љ2), РёРЅР°С‡Рµ РіРёРїРѕС‚РµРЅСѓР·Р° Р±С‹СЃС‚СЂРµРµ Р±РµРіР°.
- РџР°РґРµРЅРёРµ: СЃСЂРµРґРЅСЏСЏ РІС‹СЃРѕС‚Р° вЂ” Р·Р°Р»РёРїР°РЅРёРµ РІ РїСЂРёСЃРµРґРµ, Р±РѕР»СЊС€Р°СЏ вЂ” Р»С‘Р¶Р°; СЃР°РјР° РІСЃС‚Р°С‘С‚, РїРѕС‚РѕРј СѓРїСЂР°РІР»РµРЅРёРµ.
- РџРѕР»РЅР°СЏ СЃРјРµСЂС‚СЊ (0 hp): РїР°СѓР·Р°, Р·Р°С‚РµРјРЅРµРЅРёРµ, РїР»Р°С€РєР° В«life capacity reachedВ», С‚Р°Рї/РєР»Р°РІРёС€Р° вЂ” РІ РјРµРЅСЋ.
- РџС‹Р»СЊ РїСЂРё РїСЂРёР·РµРјР»РµРЅРёРё: РјР°СЃС€С‚Р°Р± РѕС‚ РІС‹СЃРѕС‚С‹ РїР°РґРµРЅРёСЏ (СЃРѕР±С‹С‚РёРµ `landdust`).
- РЈРґР°СЂ РіРѕР»РѕРІРѕР№ Рѕ РїРѕС‚РѕР»РѕРє РІ РїСЂС‹Р¶РєРµ: РєСЂРѕС€РєР°, РіР»СѓС…РѕР№ Р·РІСѓРє (`bonk`).
- РџРѕРґРІРѕРґРЅРѕРµ СЃРЅР°СЂСЏР¶РµРЅРёРµ: Р°РєРІР°Р»Р°РЅРі (Р±РѕР»СЊС€Рµ Р·Р°РїР°СЃ РІРѕР·РґСѓС…Р°, Р°РІС‚Рѕ-РґРѕР·Р°РїСЂР°РІРєР° Р·Р°РїР°СЃРЅС‹Рј Р±Р°Р»Р»РѕРЅРѕРј), Р±Р°Р»Р»РѕРЅС‹ СЃ РІРѕР·РґСѓС…РѕРј (РїРѕРґР±РёСЂР°РµРјС‹Р№ СЂРµСЃСѓСЂСЃ `S.bag.tank`), Р»Р°СЃС‚С‹ (СѓСЃРєРѕСЂСЏСЋС‚ РїР»Р°РІР°РЅРёРµ), РіР°СЂРїСѓРЅ (РѕС‚РґРµР»СЊРЅС‹Р№ СЃР»РѕС‚, СЃС‚СЂРµР»СЏРµС‚ РІ РІРѕРґРµ, СЃС‚СЂРµР»С‹ РїРѕРґР±РёСЂР°СЋС‚СЃСЏ РѕР±СЂР°С‚РЅРѕ вЂ” `src/entities/harpoons.js`).
- Р’Р·РіР»СЏРґ РІРІРµСЂС…: РІРјРµСЃС‚Рѕ РІС‹С‚СЏРіРёРІР°РЅРёСЏ РіРѕР»РѕРІС‹/С€РµРё РІРІРµСЂС… вЂ” РїРѕРІРѕСЂРѕС‚ С‡РµСЂРµРїР° РІРѕРєСЂСѓРі РѕСЃРЅРѕРІР°РЅРёСЏ Сѓ С€РµРё (`figure.js:drawHead`), РєРѕСЃР° РїРѕ-РїСЂРµР¶РЅРµРјСѓ СЃРІРёСЃР°РµС‚ РїРѕРґ РіСЂР°РІРёС‚Р°С†РёРµР№ Рё РЅРµ С‚СЏРЅРµС‚СЃСЏ Р·Р° РїРѕРІРѕСЂРѕС‚РѕРј РіРѕР»РѕРІС‹.

## 0.1.0-dev.13

- РќР° РєСЂР°СЋ в†“: РЅР°Р¶Р°С‚РёРµ вЂ” РїСЂРёСЃРµРґ в†’ Р»С‘Р¶Р° в†’ РІРёСЃ; СѓРґРµСЂР¶Р°РЅРёРµ вЂ” СЃСЂР°Р·Сѓ РІ РІРёСЃ, РєСЂРѕРјРµ С…РѕРґР° РѕС‚ РєСЂР°СЏ (Р»Р°Р· Р»С‘Р¶Р°).
- РђРІС‚Рѕ-РїРѕРґСЉС‘Рј С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РІС‹С…РѕРґР° РёР· С‰РµР»Рё, РЅРµ РїРµСЂРµРґ РЅРµР№.
- РђРІС‚Рѕ-Р·Р°РїСЂС‹РіРёРІР°РЅРёРµ РЅР° РѕРґРЅРѕС‚Р°Р№Р»РѕРІС‹Р№ СѓСЃС‚СѓРї РЅРµ РёР· РїСЂРёСЃРµРґР° Рё РЅРµ Р»С‘Р¶Р°.

## 0.1.0-dev.11

- Р©СѓРїР°Р»СЊС†Р°: РІС‹С…РѕРґ СЃ РїРѕР»Р° / СЃС‚РµРЅ / РїРѕС‚РѕР»РєР° (`side` 0вЂ“3). Р“Р°СЂРїСѓРЅ СѓР±РёРІР°РµС‚ РІ `stepTendrils`.
- РџР°СѓРє: РѕР±РІР°Р» РїРѕС‚РѕР»РєР° РёР»Рё СЂР°Р·СЂС‹РІ РїР°СѓС‚РёРЅС‹ вЂ” РїР°РґР°РµС‚ Рё СѓР±РµРіР°РµС‚. РќРёС‚СЊ РІ РґРІР° С‚РѕРЅР°.
- Р©СѓРїР°Р»СЊС†Р° РІРѕРґРѕСЂРѕСЃР»РµР№: Р¶Р°Р»Рѕ (kind 0) Рё С…РІР°С‚ РЅР° РґРЅРѕ (kind 1, `snare`). РћР·РµСЂРѕ РѕР±СЂС‹РІР° Рё РєСѓРїРµР»СЊ РІРѕРґРѕРїР°РґР°.

## 0.1.0-dev.9

- Р’С‹С…РѕРґ РёР· Р»Р°Р·Р°: Р±РµР· РїРѕС‚РѕР»РєР° РІСЃС‚Р°С‘Рј СЃР°РјРё, С‰РµР»СЊ РґР»СЏ РїСЂРёСЃРµРґР° вЂ” РІ РїСЂРёСЃРµРґ; РЅРёР¶Рµ вЂ” РІРёСЃ.
- РџРѕРґ РІРѕРґРѕР№ РІС‹Р»Р°Р· РЅР° СѓСЃС‚СѓРї РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°РµС‚ (С‚РѕР»СЊРєРѕ СЃСѓС…РѕР№ Р±РµСЂРµРі СЃ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё).

## 0.1.0-dev.8

- Р’РѕРґР° РїРѕРґ РїРѕРіСЂСѓР¶С‘РЅРЅС‹Рј РєР°РјРЅРµРј (РІРѕРґР° СЃРІРµСЂС…Сѓ Рё СЃРЅРёР·Сѓ РєР°РјРЅСЏ) СЂРёСЃСѓРµС‚СЃСЏ Р±РµР· РІРѕР»РЅ.

## 0.1.0-dev.7

- РљРѕРЅРµС† Р»Р°Р·Р°/РїСЂРёСЃРµРґР° Сѓ РѕР±СЂС‹РІР°: Р±РµР· РїРѕС‚РѕР»РєР° РІСЃС‚Р°С‘Рј РЅР° РєСЂР°Р№, СЃ РїРѕС‚РѕР»РєРѕРј вЂ” СЃРїСѓСЃРє РІ РІРёСЃ (Р±РѕР»СЊС€Рµ РЅРµ СѓРїРёСЂР°РµС‚СЃСЏ).

## 0.1.0-dev.6

- РЎ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё РІРѕРґС‹ Рє РєСЂР°СЋ + РЅР°РїСЂР°РІР»РµРЅРёРµ вЂ” Р·Р°Р±РёСЂР°РµС‚СЃСЏ (`tryClimbOut`); РїРѕРґ РІРѕРґРѕР№ РєСЂРѕРјРєРё РЅРµ С…РІР°С‚Р°РµС‚.
- РР· СЃРІРёСЃР°РЅРёСЏ Р»Р°Р· СЃСЂР°Р·Сѓ РІ СЃС‚РѕР№РєСѓ С‰РµР»Рё: СЃС‚РѕСЏ / РїСЂРёСЃРµРґ / РїРѕР»Р·РѕРє (`bestLand`).
- РџРѕРґР±РѕСЂ С„Р°РєРµР»Р°/РїР°Р»РєРё: РїСЂРµРґРјРµС‚ Р°С‚Р°С‡РёС‚СЃСЏ Рє СЂСѓРєРµ РЅР° РєР°РґСЂРµ РЅРёР¶РЅРµР№ С‚РѕС‡РєРё РїСЂРёСЃРµРґР° (`resolvePickup`).
- Р‘СЂРѕСЃРѕРє С„Р°РєРµР»Р°: Р°РЅРёРјР°С†РёСЏ Р·Р°РјР°С…Р°, С„Р°РєРµР» СѓР»РµС‚Р°РµС‚ РЅР° ~40% Р°РЅРёРјР°С†РёРё.
- РЈРїРѕСЂ РІ СЃС‚РµРЅСѓ вЂ” РїРѕР·Р° `WALLPUSH`.
- РџР»Р°РІРЅС‹Р№ РїРµСЂРµС…РѕРґ СЃС‚РѕСЏ/РїСЂРёСЃРµРґ/Р»С‘Р¶Р° (`p.stanceT`).
- Р’Р·РіР»СЏРґ РІРІРµСЂС… РЅР° РјРµСЃС‚Рµ (`p.lookUp`, `LOOKUP_A`).
- РљР°РјРµСЂР°: РјС‘СЂС‚РІР°СЏ Р·РѕРЅР° `cam.ax/ay` 10Г—8px.

## 0.1.0-dev.5

- Р’СЃРїР»С‹С‚РёРµ Р±РѕР»СЊС€Рµ РЅРµ Р±СЊС‘С‚ РіРѕР»РѕРІРѕР№ Рѕ РїРѕРІРµСЂС…РЅРѕСЃС‚СЊ: РІ РІРѕРґРµ СЃР±СЂР°СЃС‹РІР°РµС‚СЃСЏ `apexY`, Сѓ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё СЂРµР¶РµС‚СЃСЏ СЃРєРѕСЂРѕСЃС‚СЊ РІРІРµСЂС…, С…РІР°С‚ РєСЂРѕРјРѕРє РІ РІРѕРґРµ РІС‹РєР»СЋС‡РµРЅ.

## 0.1.0-dev.4

- Р’С…РѕРґ РІ РІРѕРґСѓ Рё РІРѕР·РІСЂР°С‚ РїРѕСЃР»Рµ РІС‹РїСЂС‹РіРёРІР°РЅРёСЏ: РєРѕСЂРѕС‚РєРёР№ РЅС‹СЂРѕРє (~14px), Р±РµР· СЂРµР·РєРѕРіРѕ СЃС‚РѕРїР° РЅР° РїРѕРІРµСЂС…РЅРѕСЃС‚Рё.

## 0.1.0-dev.3

- `rc`/`lb` РЅРµ СЃС‚Р°РІСЏС‚ `fillStyle`, РµСЃР»Рё С†РІРµС‚ С‚РѕС‚ Р¶Рµ (`setFill`).
- РњРµСЂС†Р°РЅРёРµ С„Р°РєРµР»РѕРІ: С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹Р№ СЂР°РґРёСѓСЃ, РїСѓР»СЊСЃ Р°Р»СЊС„С‹.
- РџРѕР»РѕСЃР° РІРѕР»РЅ РІРѕРґС‹ СЃРѕР±РёСЂР°РµС‚СЃСЏ СЂР°Р· РЅР° РєР°РґСЂ Рё Р±Р»РёС‚СѓРµС‚СЃСЏ РЅР° РїРѕРІРµСЂС…РЅРѕСЃС‚СЊ.
- РўСЂРё СЃР»РѕСЏ РїРµСЂРµРґРЅРµРіРѕ РїР»Р°РЅР° вЂ” offscreen РЅР° С€РёСЂРёРЅСѓ РєР°СЂС‚С‹, РїС‹Р»СЊС†Р° РїРѕ-РїСЂРµР¶РЅРµРјСѓ Р¶РёРІР°СЏ.
- РљР°РјРµСЂР° Рё РїР°РЅ СЂРµРґР°РєС‚РѕСЂР° С‡РµСЂРµР· `clampCam`; `spark` СЂРµСЌРєСЃРїРѕСЂС‚ С„Р°СЃР°РґР° СЂРµРЅРґРµСЂР°.
- РђРІС‚Рѕ-РєР°СЂР°Р±РєР°РЅСЊРµ РЅР° СѓСЃС‚СѓРї РІ 1 С‚Р°Р№Р» РїСЂРё С…РѕРґСЊР±Рµ (Р±РµР· РїСЂС‹Р¶РєР°): РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµС‚ Р°РЅРёРјР°С†РёСЋ `climb`, РЅРµ СЂРѕРЅСЏРµС‚ С„Р°РєРµР» РІ СЂСѓРєРµ.
- РќС‹СЂРѕРє РїРѕСЃР»Рµ РїСЂС‹Р¶РєР° СЃ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё: `swimLaunch` С‚РѕР»СЊРєРѕ РІРІРµСЂС…, РЅР° РїР°РґРµРЅРёРё РІРѕРґР° СЃСЂР°Р·Сѓ РіР°СЃРёС‚ СЃРєРѕСЂРѕСЃС‚СЊ.

## 0.1.0-dev.2

- Р”РІРµСЂРё Рё РІР°СЂРї РёС‰СѓС‚СЃСЏ РїРѕ `id`, РЅРµ РїРѕ РёРЅРґРµРєСЃСѓ РјР°СЃСЃРёРІР° (N7).
- Р¤РёРЅРёС€ 5-РіРѕ СѓСЂРѕРІРЅСЏ Р±РѕР»СЊС€Рµ РЅРµ РіР»РѕС‚Р°РµС‚ outro РјРµРЅСЋ (N8).
- Р С‹Р±С‹ Р¶РёРІСѓС‚ РІ СЃРІРѕС‘Рј РІРѕРґРѕС‘РјРµ, Р° РЅРµ РїРѕ РІСЃРµР№ РІРѕРґРµ СѓСЂРѕРІРЅСЏ (N9).
- РџРµСЂРµРєР°С‚ Р±РµР· `inp.x` РЅРµ СЂР°Р·РІРѕСЂР°С‡РёРІР°РµС‚ Р»РёС†РѕРј РІР»РµРІРѕ (N10).
- РџСЂРёР·РµРјР»РµРЅРёРµ РІР±СЂРѕРґ / РІ РІРѕРґСѓ РЅРµ РґР°С‘С‚ СѓСЂРѕРЅ РѕС‚ РїР°РґРµРЅРёСЏ (N11).
- РЎС‚Р°Р±РёР»СЊРЅС‹Рµ id СЃСѓС‰РЅРѕСЃС‚РµР№: `allocId` / `findById`, С„Р°РєРµР» РІ СЂСѓРєРµ С…СЂР°РЅРёС‚ id (P8).
- РџРµСЂС„: РІРѕР»РЅС‹ С‚РѕР»СЊРєРѕ РЅР° РїРѕРІРµСЂС…РЅРѕСЃС‚Рё РІРѕРґС‹, РєСЌС€ `torchPts` РЅР° РєР°РґСЂ, Y-РѕС‚СЃРµС‡РµРЅРёРµ РІРѕРґРѕСЂРѕСЃР»РµР№, `buildWater` С‚РѕР»СЊРєРѕ РїСЂРё СЃРјРµРЅРµ РІРѕРґС‹.

## 0.1.0-dev.1

- РЈР±СЂР°РЅС‹ СЃР»СѓР¶РµР±РЅС‹Рµ РїР»Р°РЅС‹ СЂРµРІРёР·РёРё (`tmp/revision-plan.md`, `tmp/bugs.md`, `tmp/perf.md`).

## 0.1.0-dev.0

- Р РµРІРёР·РёСЏ ledge-v19: ES-РјРѕРґСѓР»Рё + Vite single-file (`npm run build` в†’ `dist/index.html`).
- Р¤Р°СЃР°Рґ `GAME`, 5 СѓСЂРѕРІРЅРµР№, С…СѓРєРё `__state`/`__start`/`__game`.
- Р¤РёРєСЃ: `dropTorch` Р±РµР· С„Р°РєРµР»Р° РЅРµ СЂРѕРЅСЏРµС‚ С†РёРєР»; `resetPlayer` СЃРЅРёРјР°РµС‚ `held`.
- Р¤РёРєСЃ: С‚РѕС‡РµС‡РЅС‹Р№ `invalidateChunk` (СЃРѕСЃРµРґРё 3Г—3), `hardReset` СЃР±СЂР°СЃС‹РІР°РµС‚ РєСЌС€.
- Р¤РёРєСЃ: `AudioContext.resume`, РїР°СѓР·Р° РЅР° `visibilitychange`, РїРёР»Р° Р»РёС„С‚Р° РіР»СѓС€РёС‚СЃСЏ.
- Р¤РёРєСЃ: СЃРєРѕСЃ LADR СЃРѕРІРїР°РґР°РµС‚ СЃ С„РёР·РёРєРѕР№; LIGHTS С‚РѕР»СЊРєРѕ Сѓ СѓСЂ.1 / `LV.lights`.
- Р¤РёРєСЃ: `R` РІ textarea СЌРєСЃРїРѕСЂС‚Р° РЅРµ СЃР±СЂР°СЃС‹РІР°РµС‚ СѓСЂРѕРІРµРЅСЊ; СѓРєСѓСЃ СЂС‹Р±С‹ С‡РµСЂРµР· `damage`.