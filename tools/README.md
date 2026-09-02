# tools/ — стенд для анализа референсов и проверки темплейтов

На прод не едет. Одноразовая установка на машину/сессию:

```
bash tools/setup.sh            # three.js + Playwright + ffmpeg в tools/node_modules, сервер :8123
MG_PORT=8131 bash tools/setup.sh   # второй worktree — свой порт (и MG_PORT=8131 перед verify/capture)
```

## Разобрать референс (видео → числа)

```
python3 tools/analyze-ref.py <video.mp4> <имя> [--axis x|y|both]
```
→ `tools/out/ref-<имя>/report.txt` (состояния покоя, длина бита, зазоры, размеры, профиль
движения по кадрам), `sheet.png` (контактный лист), `frames/`, `runs.json`.
Смотреть sheet.png обязательно: тёмные полосы ВНУТРИ картинки тоже режут «карточку» на куски.

## Проверить темплейт (обязательно перед снапшотом)

```
node tools/verify.js <id> --tilt --smoke
```
Шов петли при 3/7/20 картинках с миксом аспектов (0 px — иначе FAIL), рывки за бит
(дифф соседних кадров, шаг 4 мс) на дефолте и под наклонами ±45°/size 1.6/spacing 0.5,
смоук всех темплейтов. Код выхода 1 при любом провале.

## Посмотреть глазами

```
node tools/capture.js <id> <t0> <t1> <кадров> [ratio] ['{"rotX":25}']
```
→ `tools/out/<id>/sheet.png` + кадры + `dump.json` (позиции/renderOrder/uFade карточек).
