# Changelog (unreleased)

- Редактор: `Ctrl+D` дублирует кисть тайла палитры в новый кастом-тайл (`src`/`frames`/флаги); не выделение карты, объекты не клонируются.
- Редактор `#edTileEdit`: `+` кадр в ряд, драг-reorder превью, Play/Stop (~8 fps); у `enemy*`/`flier*`/`spider*` открытие материализует bake во все слоты.
- Редактор Objects: `Start` (`player_start`) — один `LV.spawn` на уровень (повтор = перенос; Delete → дефолт); маркер в гизмо, persist через `packLevel.spawn`.
