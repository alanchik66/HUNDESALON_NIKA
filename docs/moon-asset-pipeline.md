# Moon asset pipeline

## Инструкция после мержа

1. Оператор After Effects экспортирует и кладет в `3d-weather-codrops-main/dist-widget/assets/Moon`:
   - `mission_2160p1_alpha.mov`
   - `mission_1080p30_alpha.mov`
2. Проверить, что в системе доступны `ffmpeg` и `ffprobe`, а сборка `ffmpeg` содержит `--enable-libvpx`.
3. В VS Code открыть проект и запустить задачу `Moon: Convert MOV -> WebM+MP4`.
4. После завершения запустить задачу `Moon: Verify Alpha Outputs`.
5. Проверить результаты в папке `assets/Moon`, WebM открыть в Chrome, MOV проверить в After Effects с включенной шахматкой прозрачности.

## Чеклист ревью

- [ ] В репозитории присутствуют `scripts/convert_to_webm.ps1` и `scripts/verify_outputs.ps1`.
- [ ] `.vscode/tasks.json` содержит задачи для конвертации и проверки.
- [ ] `README.md` обновлен с инструкцией по After Effects и запуску пайплайна.
- [ ] Скрипты запускаются без синтаксических ошибок.
- [ ] После ручного добавления `*_alpha.mov` задача `Moon: Convert MOV -> WebM+MP4` создает:
  - `mission_2160p1_alpha_2160.webm`
  - `mission_2160p1_alpha_fallback_1080.mp4`
  - `mission_1080p30_alpha_1080.webm`
  - `mission_1080p30_alpha_fallback_1080.mp4`
- [ ] `Moon: Verify Alpha Outputs` подтверждает наличие всех ожидаемых файлов.
- [ ] WebM файлы имеют `pix_fmt=yuva420p` или `alpha_mode=1` по данным `ffprobe`.
- [ ] Логи выполнения и скриншоты After Effects с включенной шахматкой приложены к PR при наличии проблем.

## Ветка и коммит

Рекомендуемая ветка:

```bash
feature/moon-asset-pipeline
```

Сообщение коммита:

```bash
chore(moon): add conversion scripts, verification script and VS Code tasks
```

В PR указать, кто выполнит After Effects экспорт и ожидаемую дату добавления `*_alpha.mov`.

## Что приложить к PR

- Логи выполнения `scripts/convert_to_webm.ps1` и `scripts/verify_outputs.ps1`.
- Скриншоты After Effects с включенной шахматкой для каждого экспортированного MOV.
- Список файлов в `assets/Moon` после выполнения задач.
- Краткое описание, если при вырезании фона использовались нестандартные параметры `Keylight` или `Roto Brush`.
