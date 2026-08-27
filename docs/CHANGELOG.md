# Changelog (unreleased)

- **Fix: damage shake never played on custom (sprite-based) diggable tiles, only on plain rock/`CRUMB`.**
  - `paintTileId()` (`render/tiles.js`) computed the `cracking`/`sx` shake offset only in the generic procedural-rock branch, but custom tiles (id ≥ 64, e.g. "Stone TNT") exit earlier via `paintCustom(v, x, y)` returning `true` — the shake code was unreachable for them. Added a `digHp`-gated shake offset applied to the `x` passed into `paintCustom` itself, so sprite tiles wobble the same way while damaged.
  - Verified directly: chunk-canvas pixel snapshot of a `digHp`-active custom tile now differs between two `view.time` samples (previously byte-identical).
- **Fix: pickaxe hit/break particle+sound effects (and `CRUMB` collapse dust) spawned dozens of tiles away from the actual tile, effectively invisible.**
  - `onEvent()` (`app/loop.js`) decoded the `dighit`/`digclank`/`digbreak`/`crumble` event payload (a `mapIx` value) back to `col`/`row` via `% G.MAP_W` / `/ G.MAP_W` only, ignoring the map's origin offset (`runtime.originC`/`originR`, exposed as `mapIx(c,r) = (r-originR)*MAP_W + (c-originC)`). Any level with a non-zero origin (the current map has `originC = -48`) decoded a `col` that was off by `|originC|` tiles, spawning `spark`/`rockChunks`/`emitSand` far off-screen from the dig site.
  - Fixed all four decode sites to add back `G.mapMinC()`/`G.mapMinR()` (existing facade getters for `originC`/`originR`).
  - Verified directly: decoding `mapIx(50, 20)` now round-trips to `{col: 50, row: 20}` (previously `{col: 98, row: 20}`).
