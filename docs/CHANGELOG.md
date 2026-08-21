# Changelog (unreleased)

- Fall strands (`paintFallStrands`): continuous world-Y phase through stacked FALL tiles (no per-tile `% T` clasp); light strand smoothstep alpha brightest at bottom → transparent at top along full **Length**.
- Fall Details: **Length** / **Wave** / **Random** / **Offset** (0–100, defaults 25/15/35/55) + existing **Speed** (0–200, 70) → `tileGfx[14]`; getters `getTileLength` / `getTileWave` / `getTileRandom` / `getTileOffset`.
- Fall Details: **Fade** (0–100, default 0) via `tileGfx[14].fade` / `getTileFade` — softer strand/body alpha (no hard holes that tear); also fades solid FALL fill.
- Fall: removed per-tile top foam line (`#8fd0ef`) that drew light horizontal seams on every FALL edge.
- Fall strands: second layer between the main threads (phase from **Offset**, slightly dimmer).
- Fall Details L2: **L2 Speed** (−100…100, def −8) / **L2 Length** / **L2 Density** (1…8 strands) / **L2 Wave** → `tileGfx[14].speed2|length2|density2|wave2`.
- Fall foam/spray (`paintFallEnds`): foam cap + spray on topmost FALL; bottom foam/spray when `WATER` below. Details **Foam** / **Spray** (0–100, defs 45/55) → `tileGfx[14].foam` / `spray`.
