# Changelog (unreleased)

- Fall strands (`paintFallStrands`): continuous world-Y phase through stacked FALL tiles (no per-tile `% T` clasp); light strand smoothstep alpha brightest at top → transparent at bottom along full **Length**.
- Fall Details: **Length** / **Wave** / **Random** / **Offset** (0–100, defaults 25/15/35/55) + existing **Speed** (0–200, 70) → `tileGfx[14]`; getters `getTileLength` / `getTileWave` / `getTileRandom` / `getTileOffset`.
- Fall Details: **Fade** (0–100, default 0) via `tileGfx[14].fade` / `getTileFade` — softer strand/body alpha (no hard holes that tear); also fades solid FALL fill and top foam.
