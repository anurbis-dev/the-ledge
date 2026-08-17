# Changelog (unreleased)

- Ревизия ledge-v19: ES-модули + Vite single-file (`npm run build` → `dist/index.html`).
- Фасад `GAME`, 5 уровней, хуки `__state`/`__start`/`__game`.
- Фикс: `dropTorch` без факела не роняет цикл; `resetPlayer` снимает `held`.
- Фикс: точечный `invalidateChunk` (соседи 3×3), `hardReset` сбрасывает кэш.
- Фикс: `AudioContext.resume`, пауза на `visibilitychange`, пила лифта глушится.
- Фикс: скос LADR совпадает с физикой; LIGHTS только у ур.1 / `LV.lights`.
- Фикс: `R` в textarea экспорта не сбрасывает уровень; укус рыбы через `damage`.
