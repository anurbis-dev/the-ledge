# Changelog (unreleased)

- Камера: follow в `render/camera.js` (`followCam` / `resetCam` / `pushCamRender`); резина `kk=1-exp(-CAM_FOLLOW*dt)`, `CAM_SNAP` 1px липнет к цели (без дёрганья на стопе); blit по-прежнему `Math.round(cam+shake)`. `resetCam` обнуляет lead/look.
- Params → Camera: `CAM_DZ_*` / `CAM_FOLLOW` / `CAM_SNAP` / `CAM_LEAD*` / `CAM_LOOK*` в `C`, persist `ledge.dev.C`.

