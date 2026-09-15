# MAG Welding Trainer — project_v1

**Версия:** MVP 1.0  
**Платформа:** Web  
**Стек:** HTML5, CSS3, JavaScript ES6+, Canvas 2D, audio samples / Web Audio API  
**Backend:** нет

**Главная цепочка:**  
`WFS → ток → дуга → КЗ → капли → ванна → проплавление (+ звук)`

**Out of scope (ТЗ §55):** TIG, MMA, pulse/spray/globular, материалы/газы/толщины/положения, угол и скорость горелки, 3D/CFD, backend, пользователи, scoring.

Полное ТЗ не копировать. Ссылки: `ТЗ §N`.

---

## Правила экономии токенов

1. **Один этап = одна сессия.** Следующий этап не начинать, пока `Done when` текущего не закрыт.
2. **Не копировать ТЗ** в ответы и коммиты. Ссылаться на `ТЗ §N` или строку чеклиста.
3. **Минимум контекста.** Читать только файлы текущего этапа + `js/data.js`. Из этого файла — только раздел нужного этапа.
4. **Малые диффы.** Менять 1–3 файла за сессию. UI-polish — только на этапе 8.
5. **Конфиг раньше магии.** Коэффициенты только в `data.js` / `WELDING_CONFIG` (ТЗ §43).
6. **Model ≠ View.** Физика в `*-model.js`, рисование только в `renderer.js` (ТЗ §48).
7. **Без лишнего.** README, тесты, сборки — только по запросу.
8. **Стоп по чеклисту.** После `Done when` — `STOP`. Без «ещё чуть polish».

---

## Архитектура скелета

```text
mag-trainer/
├── index.html
├── css/style.css
├── js/
│   ├── main.js
│   ├── data.js
│   ├── controls.js
│   ├── welding-model.js
│   ├── arc-model.js
│   ├── penetration-model.js
│   ├── renderer.js
│   └── audio.js
└── audio/
```

| Файл | Роль |
|------|------|
| `data.js` | диаметры, K, диапазоны, `WELDING_CONFIG`, визуальные константы |
| `controls.js` | слайдеры, START/STOP/RESET, отображение параметров |
| `welding-model.js` | WFS, ток, voltageActual, stick-out, state machine, КЗ, капли, stability |
| `arc-model.js` | длина/форма/интенсивность/свечение дуги |
| `penetration-model.js` | ванна, проплавление |
| `renderer.js` | только Canvas |
| `audio.js` | звук процесса |
| `main.js` | связка модулей + rAF loop |

**Loop (ТЗ §47):**

```text
updateWeldingModel → updateArc → updatePenetration → renderCanvas → updateAudio
```

**State (поля, ТЗ §44):**  
`welding`, `wireDiameter`, `wireFeed`, `voltageSet`, `current`, `voltageActual`, `stickOut`, `arcLength`, `poolWidth`, `poolLength`, `poolDepth`, `penetration`, `stability`, `state`, `droplets[]`, `shortCircuitFrequency`, `arcIntensity`, `beadVolume`

---

## Этапы реализации

Приоритет (ТЗ §58): логика → state machine → визуализация → penetration → audio → cosmetics. Этап 8 не трогать раньше.

### Этап 0 — Skeleton

**Сделать:** дерево файлов; пустые модули; `main.js` с rAF-заглушкой; в `data.js` — K, диапазоны тока/WFS/U, каркас `WELDING_CONFIG`.

**Файлы:** все из дерева выше.

**Done when:**
- [ ] страница открывается без ошибок в консоли
- [ ] animation loop крутится

---

### Этап 1 — Canvas geometry

**Сделать:** боковой вид (не сверху); пластина в разрезе; сопло; вертикальная проволока 90°; заглушки дуги, ванны, валика, проплавления (ТЗ §4–5).

**Файлы:** `renderer.js`, `css/style.css`, при необходимости `index.html`.

**Done when:**
- [ ] статичная сцена соответствует схеме бокового вида из ТЗ

---

### Этап 2 — Controls + base current

**Сделать:** Ø 0.8/1.0/1.2; WFS 1.0–15.0; U 15–30; `I_base = WFS / K` (K: 0.05 / 0.038 / 0.025); до START — `--- A` / `--- V`; каркас START/STOP/RESET (ТЗ §6–15, §51–52).

**Файлы:** `controls.js`, `data.js`, `welding-model.js` (минимум).

**Done when:**
- [ ] слайдеры меняют setpoint
- [ ] до START ток/факт. U = `---`
- [ ] после START отображается число тока

---

### Этап 3 — State machine + short-circuit cycle

**Сделать:** состояния IDLE → WIRE FEED → SHORT CIRCUIT / IGNITION → ARC IGNITION → DROPLET FORMATION → SHORT CIRCUIT TRANSFER → ARC RECOVERY (ТЗ §24); цикл капли; капля как объект (ТЗ §16–19, §37–39).

**Файлы:** `welding-model.js`, `renderer.js`.

**Done when:**
- [ ] после START виден полный повторяющийся цикл: касание → КЗ → дуга → капля → перенос → recovery

---

### Этап 4 — Stick-out + torch movement

**Сделать:** база 15 mm; ON → плавно 12–18 mm псевдослучайно; OFF → 15 mm; умеренное влияние на ток/дугу (ТЗ §25–27). Движение только после зажигания; без бокового сдвига/наклона.

**Файлы:** `welding-model.js`, `controls.js`.

**Done when:**
- [ ] TORCH MOVEMENT заметно меняет stick-out
- [ ] цикл short-circuit не ломается

---

### Этап 5 — Stability regimes

**Сделать:** High WFS / Low U (короткая дуга, частые КЗ, возможен ARC FAILURE); Low WFS / High U (длинная дуга, крупная капля); `stability` 0…1; индикация STABLE / WARNING / UNSTABLE (ТЗ §21–23, §34).

**Файлы:** `welding-model.js`, `arc-model.js`.

**Done when:**
- [ ] намеренно достижимы STABLE, WARNING, UNSTABLE, ARC FAILURE

---

### Этап 6 — Pool + penetration

**Сделать:** динамика width/length/depth/яркости ванны; валик; проплавление в разрезе; `penetration = f(current, voltage, thickness, stability)` при фиксированной толщине (ТЗ §30–33).

**Файлы:** `penetration-model.js`, `renderer.js`.

**Done when:**
- [ ] ванна, валик и глубина проплавления реагируют на режим

---

### Этап 7 — Audio MVP

**Сделать:** samples в `audio/`; привязка к частоте КЗ, stability, состоянию дуги; на STOP/ARC FAILURE — тишина (ТЗ §40–41).

**Файлы:** `audio.js`, `audio/`.

**Done when:**
- [ ] стабильный и нестабильный режимы звучат по-разному
- [ ] STOP → звук прекращается

---

### Этап 8 — UI polish (mobile-first)

**Сделать:** верх — Canvas, низ — controls; крупные hit-area слайдеров; панель: WFS, Voltage Set, Actual V, Current, Stability; START/STOP/RESET (ТЗ §35, §49–50).

**Файлы:** `style.css`, `index.html`, `controls.js`.

**Done when:**
- [ ] удобно на телефоне и desktop
- [ ] закрыт Definition of Done MVP ниже

---

## Калибровка

Все числа — в `data.js` / `WELDING_CONFIG`. Ключи (ТЗ §43):  
`stickOutBase`, `stickOutMin`, `stickOutMax`, `currentCorrectionLimit`, `arcLengthFactor`, `dropletFrequency`, `shortCircuitThreshold`, `penetrationFactor`, `poolWidthFactor`, `poolDepthFactor`.

Формулы (не хардкодить вне конфига):
- ток: `I_base = WFS / K` (ТЗ §8–9)
- ориентир напряжения для стабильности: `U ≈ 0.04 × I + 14` (ТЗ §13) — не задание тока пользователем

---

## Definition of Done MVP

Пользователь может:

1. Открыть страницу, выбрать Ø / WFS / Voltage.
2. До START видеть `--- A` (и факт. U как `---`).
3. START → подача проволоки → касание → КЗ → дуга.
4. Видеть цикл: капля → перенос → recovery (повторяется).
5. Изменить WFS → меняется ток; изменить U → меняется длина дуги.
6. Получить устойчивый и намеренно нестабильный режимы.
7. Видеть изменение ванны и проплавления в разрезе.
8. Слышать изменение характера процесса; STOP → тишина.
9. Включить/выключить TORCH MOVEMENT.
10. STOP и RESET работают предсказуемо.

**Суть MVP (ТЗ §63):** не ролик и не картинка — упрощённая динамическая модель; ученик меняет WFS и Voltage и видит/слышит следствия.

---

## Шаблон промпта для следующей сессии

```text
Открой project_v1.md → только Этап N.
Не читай ТЗ целиком.
Сделай чеклист этапа. Остановись.
```
