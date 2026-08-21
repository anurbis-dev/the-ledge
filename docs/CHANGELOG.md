# Changelog (unreleased)

- FX Sand: placeable Objects `fx_sand` → `LV.emitters` / `S.emitters` (`entities/emitters.js`: `mkEmitters` / `mkEmitterAt` / `stepEmitters` / `packEmitter`); Inspect density/speed/speedRand/color/life/lifeRand/gravity/size/spread/drag/lift; позиция = x,y (гизмо move); persist/history/rooms.
- Песок: общий `emitSand` + `SAND_DEF` в `render/sand-fx.js` (реэкспорт fx.js / render/index); CRUMB idle/crack drip и crumble burst через него; осыпавшийся CRUMB (`gone`) больше не рисует rubble — пусто.
- Ropes: мягкое проминание elast (spread rider load, spring stretch, без hard clamp → ровных крыльев).
