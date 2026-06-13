# План коммитов для текущего релиза

Дата: 2026-05-28

Цель: разложить текущие изменения на логические, чистые коммиты перед пушем.

## Коммит 1 — GitLens 18 workflow и документация

Файлы:
- .vscode/settings.json
- docs/ops-playbook.md
- docs/gitlens-18-daily-checklist.md
- .aiignore
- .gitignore

Команды:
```bash
git add .vscode/settings.json docs/ops-playbook.md docs/gitlens-18-daily-checklist.md .aiignore .gitignore
git commit -m "chore(gitlens): roll out v18 workflow and ai context safety"
```

## Коммит 2 — Header weather/UI пакет

Файлы:
- assets/js/site-shell.js
- assets/css/style.css
- assets/images/icon-pak/Gotovie iconki dlya saita/Globus language.png
- assets/images/icon-pak/Gotovie iconki dlya saita/sunrise.png
- 3d-weather-codrops-main/dist-widget/weather-widget.header-panel-dropdown-scene.es.js
- 3d-weather-codrops-main/dist-widget/weather-widget.header-panel-preview.es.js

Команды:
```bash
git add assets/js/site-shell.js assets/css/style.css "assets/images/icon-pak/Gotovie iconki dlya saita/Globus language.png" "assets/images/icon-pak/Gotovie iconki dlya saita/sunrise.png" 3d-weather-codrops-main/dist-widget/weather-widget.header-panel-dropdown-scene.es.js 3d-weather-codrops-main/dist-widget/weather-widget.header-panel-preview.es.js
git commit -m "feat(header): polish weather shell and icon assets"
```

## Коммит 3 — Cloudflare/deploy tooling

Файлы:
- tools/lib/cloudflare-auth.mjs
- tools/cf-verify-all-tokens.mjs
- tools/post-deploy.mjs
- package.json
- .dev.vars.example
- docs/operations.md
- AGENTS.md

Команды:
```bash
git add tools/lib/cloudflare-auth.mjs tools/cf-verify-all-tokens.mjs tools/post-deploy.mjs package.json .dev.vars.example docs/operations.md AGENTS.md
git commit -m "chore(deploy): harden cloudflare auth and post-deploy flow"
```

## Проверка перед пушем

```bash
npm run lint
npm run validate
```

## Пуш

```bash
npm run git:push
```

## Важно

- Папка `.pi/` исключена из git и не должна попадать в коммиты.
- Если нужен единый squashed-коммит, этот план можно свернуть в один коммит после проверки.
