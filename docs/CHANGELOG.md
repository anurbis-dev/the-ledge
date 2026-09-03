# Changelog (unreleased)

- Feat(core,entities,render): автомобиль (транспорт, vehicle mount) — расширены аним-слоты (turn, block, action1, action2), стойка за рулём гейтится по наличию аним у скина (crouch/prone не доступны без кадров), разворот вместо мгновенного флипа (если есть 'turn' anim), новые множители jumpMul (прыжок) и wallSlideMul (слайд стены), редактор: слайдеры Jump и Wall slide в окне Vehicle. Bug fix: speedMul теперь применяется в игре (раньше редактор читал, но ход игрока его игнорировал).
