# the LEDGE

Пещеры и кромки — пиксельный платформер (хваты кромок, лазы, вода, лифты).

Источник ревизии: `tmp/ledge-v19.html`. Модульный ES6 + Vite, сборка в один HTML.

## Run

```bash
npm install
npm run dev      # Vite
npm run build    # → dist/index.html (один файл)
```

На Windows PowerShell, если `npm` режет execution policy: `npm.cmd`.

## Layout

| Path | Role |
|------|------|
| `src/core/` | тайлы, карта, игрок, `step`, фасад `GAME` |
| `src/entities/` | враги, факелы, лифты, сундуки, лут |
| `src/levels/` | 5 уровней |
| `src/render/` | canvas, позы, свет, HUD |
| `src/input/` | клавиши + виртуальный стик |
| `src/editor/` | встроенный тайл-редактор |
| `src/audio/` | WebAudio blips |
| `tmp/ledge-v19.html` | канон монолита |

## Version

SemVer в `package.json`. Перед коммитом: `npm run bump:dev` (WIP) / `bump:patch` / `bump:minor`.

## Links

- Repo: https://github.com/anurbis-dev/the-ledge
