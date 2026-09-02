# Changelog (unreleased)

- Feat(editor): per-level `camZoom` поле (25–400%, дефолт 100) — зум камеры уровня в редакторе (вкладка Intro, слайдер Camera zoom). Масштабирует FOV (видимый мир на экране) в геймплее; редактор неподвижен на 320×180.
- Fix(render): `blitEntSprite`/`blitHeroSprite`/`blitHeldSprite` больше не растягивают native-разрешение кадра в footprint (fw×fh) по двум осям независимо — теперь единый масштаб (`fitFrame`, src/render/sprites.js), fw×fh остаётся верхней границей блита без искажения квадратности арт-пикселей.
