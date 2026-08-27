# Changelog (unreleased)

- Ctrl+D tile duplicate: `baseId` + `cloneTileGfxMeta` — Fall/Water (и любой builtin) копия показывает свои Details-слайдеры на `tileGfx[copyId]`; на карте `isFlowV`/`isWaterV` и procedural paint читают id клетки. Также копируется `durability`.
