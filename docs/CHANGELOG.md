# Changelog (unreleased)

- Water waves: keep full layer amplitudes under FALL (dampen river travel only); per-layer bob/expand phase offsets so crests no longer lock as one sheet; `fallChurnAt` boils under impact.
- Water Details: **Splash** (0–100, default 80) via `tileGfx[13].splash` / `getTileSplash` — scales hero enter/exit ripples; stronger base splash amp.
