# Незалежні від розкладки Vim-команди

Статус: **реалізовано у `feat/layout-independent-keys`; ручна перевірка фізичної клавіатури ще потрібна**.
Дата: 2026-11-06.

Нижче збережено початковий дизайн і його історичні факти. Код, конфігурація
`keyboard`, документація та автоматичні regression/E2E-тести вже додані.
Встановлений плагін, `cli.json`, кеш встановленого плагіна і версії залежностей не змінено.
Для використання потрібне окреме підключення feature-build; це не npm-реліз.

### Примітки реалізації

- Спільний resolver у `src/vim/keys.ts`: Literal / Command / джерело, валідована
  printable ASCII metadata, US Shift і явна таблиця `uk`; `event.code` не використовується.
- `inputIntent()` адаптера читає реальні фази engine після `attach()`: char payload
  та невідомі фази — Literal; відомі командні фази, register/macro/mark names — Command.
  Той самий вибір використано до host routing і в session/readers/form/composer/panes.
- RHS mappings і записані зміни не проходять keyboard resolver повторно.
  Виправлено повторне grapheme-кодування вже записаних токенів у dot repeat.
- Публічний optional `KeyEvent.baseCode` перевірено в locked OpenTUI `0.6.8`
  та локально кешованому `0.7.0`; змін залежностей для цього не потрібно.
- Нові `keyboard-*` E2E-сценарії запускають ізольований plugin у справжньому
  OpenCode через test PTY: raw UTF-8 та CSI u, а не події фізичної клавіатури.
  Наявність metadata в терміналі користувача залишається неперевіреною.
- Старі тести адаптовано до обов'язкового resource owner у locked OpenTUI,
  без змін runtime-залежностей чи host API.

### Перевірки реалізації

- `typecheck`, усі 346 unit/component tests, `format:check`, build і packing пройшли.
- Усі п'ять нових `keyboard-*` E2E-сценаріїв пройшли на OpenCode `2.2.5`;
  повний запуск: 77 passed / 7 failed. Усі сім failing scenarios відтворено
  на незміненому base `5ec1344` в окремій тимчасовій копії: `native-history`,
  `prompt-history`, `prompt-command-cursor`, `terminal-focus`,
  `clipboard-cancel-unload`, `runtime-source`, `runtime-npm`.
  Вони стосуються host history/rich paste або unload/lifecycle; цей feature
  не розширює scope до їх виправлення. Первинний паралельний `runtime-source`
  також мав cursor-style race; окремий повтор дійшов до того самого unload timeout,
  що й baseline.
- Ручний US → UK → US цикл і metadata фізичної клавіатури не перевірялися.

## 1. Мета

Зберегти м'язову пам'ять Vim під час роботи з українською розкладкою:
натискання клавіш на позиціях US QWERTY `h/j/k/l` має виконувати рухи,
навіть коли термінал передає `р/о/л/д`. Водночас введення тексту має
залишатися українським, зокрема аргументи команд пошуку символу та заміни.

Ціль — незалежність **команд** від розкладки, а не транслітерація тексту.
Базова командна розкладка цієї пропозиції — US QWERTY.

## 2. База та підтверджені факти

- Upstream: <https://github.com/Tarquinen/opencode-vim>.
- Fork: <https://github.com/nazariimoroz/opencode-vim>.
- Робоча гілка: `docs/layout-independent-keys`, від `origin/dev`,
  коміт `5ec1344e6b6ed288349ae7e1122d3a028f59ddd0`.
- Встановлений npm-плагін: `0.0.29`; його кеш не є робочим деревом форку.
- `main` і `dev` вже відрізняються залежностями та іншими upstream-змінами.
  Ця пропозиція не є дозволом оновлювати встановлений плагін чи його залежності.

Поточні точки обробки:

| Файл | Відповідальність / проблема |
| --- | --- |
| `src/vim/keys.ts` | `keyNotation()` читає `event.name`; `keyForVimee()` окремо знову читає його для Ctrl |
| `src/plugin.tsx` | Перевіряє session key, custom mappings, pass-through та навігацію діалогів до виклику адаптера |
| `src/vim/vimee.ts` | Має справжній стан Vim, pending-фази, history, keymaps, dot repeat та grapheme codec |
| `src/ui/session-keys.ts`, `src/ui/session.tsx` | Навігація transcript і read-only modal |
| `src/ui/form.tsx`, `src/ui/composer.ts` | Навігація формами та composer; окремо від редагування prompt |
| `src/ui/terminal.tsx`, `src/ui/pane-keys.ts` | Зарезервовані pane shortcuts і передавання решти подій дочірньому терміналу |
| `src/vim/config.ts` | Публічні опції та їх перевірка |

У локально кешованому OpenTUI `0.7.0` тип `KeyEvent` містить необов'язковий
`baseCode`. Kitty parser бере його з третього підполя першого параметра CSI u.
Це **base-layout Unicode codepoint**, а не апаратний scancode. Поле `code`
не можна трактувати як браузерне `KeyboardEvent.code`: зокрема воно містить
термінальні коди функціональних клавіш.

Фактичну наявність `baseCode` в інтерактивних подіях користувача ще не перевірено.
`TERM=xterm-256color` не доводить ні наявності, ні відсутності такої підтримки.

`AGENTS.md` посилається на OpenCode source у `/home/dan/src/opencode`, а в
`dev` команда pull вказує `/home/dan/src/opencode/opencode`. Спроби виконати
зазначені `pull --ff-only` показали, що цих шляхів на цій машині немає.
Тому внутрішню реалізацію OpenCode не перевірено; межі host API звірено з
офіційною V2 документацією. Шляхи та інструкції upstream не змінювалися.

## 3. Обсяг і нецілі

У межах майбутньої роботи:

- normal, visual, visual-line та командні pending-фази;
- custom mappings цих режимів, вхід/вихід session mode;
- transcript, readers, нормальна навігація діалогами, question forms, composer;
- лише вже зарезервовані плагіном pane shortcuts, якщо відповідна команда доступна;
- збереження кирилиці при введенні, вставленні, пошуку та заміні.

Не входять:

- глобальні shortcuts OpenCode, GNOME, термінала або інших програм;
- перемикання системної розкладки, читання `/dev/input`, привілейовані hooks;
- зміни OpenCode чи OpenTUI, керування terminal negotiation власними escape codes;
- нові Vim-команди, розширення підтримки `R`, `/`, `?`, макросів чи marks;
- публікація npm, зміна `cli.json`, підключення форку або редагування кешу.

## 4. Рішення: окремо символ, окремо команда

Для кожної події зберігати дві інтерпретації:

1. **Literal**: поточна логічна клавіша / введений Unicode-текст без перетворення.
2. **Command**: канонічна Vim-клавіша US QWERTY разом із модифікаторами.

Вибирати інтерпретацію за **наміром введення**, а не лише `state.mode()`.
Навіть у normal mode наступний символ може бути даними, а не командою.
Не мутувати `event.name`, `event.sequence`, `event.raw` чи metadata оригіналу.
Подію, яку плагін не обробив, host або дочірня програма отримують незміненою.

### 4.1. Отримання Command

Увімкнена незалежність від розкладки застосовує такий пріоритет:

1. Валідний, придатний для команд `baseCode` від термінала.
2. Явно ввімкнений український fallback для розпізнаних кириличних літер.
3. Поточне логічне представлення клавіші без змін.

Перевіряти діапазон і цілочисельність codepoint; на першому етапі підтримувати
друковану ASCII-базу US QWERTY. Відхиляти surrogate, керівні, невідомі та
непридатні значення, не кидаючи exception. Named keys залишають свій шлях.
Metadata має пріоритет навіть тоді, коли fallback підказує іншу клавішу.

Для `baseCode` враховувати Shift один раз: `h → H`, `[ → {`, `1 → !` тощо.
Не використовувати shifted-символ поточної кириличної розкладки замість
US shifted-символу. При відсутності metadata зберігати наявну логіку Shift.
Caps Lock у metadata-backed командному шляху не підміняє Shift; у legacy
режимі неможливо завжди відрізнити Caps Lock від реально введеної великої літери.

Ctrl та Alt мають використовувати ту саму канонічну клавішу в matching і
виконанні. Окремо зберегти відмінність `<C-[>` / Ctrl+Shift+[, наявний alias
Ctrl+_ / Ctrl+/, правила Super/Hyper та пріоритет host leader sequences.
Не додавати підтримку chord, якого поточний scope не вміє обробляти.

### 4.2. Український fallback — обмежений langmap

Профіль `uk` є явним припущенням про стандартне українське розташування літер,
а не визначенням активної розкладки ОС. Він зіставляє літери за позиціями:

| Українські клавіші | US QWERTY позиції |
| --- | --- |
| `й ц у к е н г ш щ з х ї` | `q w e r t y u i o p [ ]` |
| `ф і в а п р о л д ж є` | `a s d f g h j k l ; '` |
| `я ч с м и т ь б ю` | `z x c v b n m , .` |

Великі українські літери мають відповідати US Shift-позиціям: `Р → H`,
`Х → {`, `Ж → :`, `Є → "`, `Б → <`, `Ю → >`. Великі літери не можна
отримувати простим upper-case після перетворення punctuation.

Невідомі літери, інші варіанти розкладки та ISO-додаткові клавіші не вгадувати.
Не вмикати автоматично російські, білоруські чи довільні кириличні профілі.
Додаткові профілі — окреме розширення з власними таблицями та тестами.

**Обмеження:** legacy `.` не дозволяє визначити, чи це US `.`, чи українська
клавіша на позиції US `/`. Так само неоднозначні деякі Shift+digit і Ctrl-chords.
Fallback не перепризначає ASCII punctuation та digits: це зламало б англійську
розкладку або команду dot repeat. Без metadata повна незалежність punctuation
не гарантується; це документована деградація, а не привід вгадувати розкладку
за попередньою літерою. Частина Ctrl-подій може вже надходити як ASCII.

### 4.3. Коли вибирати Literal

| Контекст | Інтерпретація |
| --- | --- |
| normal/visual: motion, operator, count, text-object selector, префікс `g` | Command |
| Наступний символ після `f/F/t/T/r`, зокрема після operator+find | Literal |
| Insert у prompt, dialog filter, custom answer | Literal |
| Пошуковий рядок або replacement payload, якщо підтримується відповідним UI/engine | Literal |
| Ідентифікатор register, macro register чи mark, якщо підтримується | Command: один Latin namespace незалежно від розкладки |
| Paste, clipboard, attachment, IME/складений текст | Незмінені дані, не командна послідовність |
| Live terminal: усе, крім доступних зарезервованих pane shortcuts | Оригінальна подія |

`char-pending` у поточному engine охоплює find/till і single-character replace.
Escape та інші службові клавіші мають скасовувати очікування за чинними правилами.
Для невідомих майбутніх фаз консервативно зберігати Literal, а не перетворювати
дані на destructive-команду. Таблицю фаз звірити з реальною версією engine
перед реалізацією; поточний `isPending()` недостатньо інформативний.

Insert mappings, наприклад `kj → normal`, **залишаються логічними**: кириличне
`ло` не повинно непомітно перетворюватися на Escape. Pane chords обробляються
окремо і лише коли плагін уже резервує їх у відповідному контексті.

### 4.4. Пріоритети, replay та lifecycle

- Канонізація Command відбувається до custom keymap matching. Custom mapping
  зберігає наявний пріоритет над default command і session toggle.
- Host routing і адаптер повинні бачити однаковий намір введення та ключ:
  `f` + кириличний символ на позиції session key не має відкрити session mode.
- Уже синтезовані RHS custom mappings — канонічні токени; не застосовувати
  до них keyboard-layout fallback повторно.
- Dot repeat і macro replay, де вони підтримуються, відтворюють записану
  семантичну послідовність: команди канонічні, payload лишається кириличним.
- Async clipboard і question-form focus queues зберігають **оригінальні** події.
  При replay інтерпретувати кожну подію за актуальним режимом: queued `i`
  переводить у insert, і наступний кириличний текст уже є Literal.
- Focus change, timeout, toggle off та dispose скидають pending-стан за чинними
  правилами. При вимкненому Vim жодна нова канонізація не впливає на host.
- Не розширювати список перехоплених подій; press/repeat/release обробляти
  відповідно до чинного контракту host, не виконувати команду вдруге на release.

## 5. Пропонована конфігурація

Це **проєкт нових plugin options**, не існуючі поля і не готова конфігурація
OpenCode. До затвердження та реалізації не додавати їх у `cli.json`.

У `options.vim` пропонується об'єкт `keyboard`:

| Поле | Значення за замовчуванням | Семантика |
| --- | --- | --- |
| `mode` | `"logical"` | `"logical"` зберігає стару поведінку; `"layout-independent"` вмикає Command resolver |
| `fallback` | `"none"` | `"none"` або явний профіль `"uk"` при відсутності придатної metadata |

Бажане налаштування для цього сценарію: `mode = "layout-independent"`,
`fallback = "uk"`. Без нових опцій поведінка залишається старою; невідомі
значення перевіряються й безпечно повертаються до defaults. Власний `langmap`
або довільна базова розкладка не входять у початковий API.

## 6. План майбутніх змін

Назви нових функцій нижче є орієнтирами дизайну, не реалізацією.

1. Додати чистий resolver у `src/vim/keys.ts` або окремий модуль поруч:
   Literal, Command, джерело вибору (`baseCode`, `uk`, `logical`).
2. У `src/vim/vimee.ts` надати вузький API наміру поточного введення, наприклад
   `inputIntent()`, не витікаючи повним mutable engine context у UI.
   Узгодити `attach()`/focus reset до читання цього стану.
3. У `src/plugin.tsx` використовувати цей намір до session-key, pass-through,
   dialog-navigation та adapter handling. Усунути повторне читання сирого
   `event.name` у Ctrl-шляху `keyForVimee()` для вже канонізованих команд.
4. Підключити той самий resolver до session/readers/form/composer/pane handlers.
   Read-only adapter також має розрізняти motion-команди і find payload.
5. У `src/vim/config.ts` додати типи, defaults і перевірку нових опцій.
6. Доповнити configuration/keymap/behavior docs і focused regression tests.

Не замінювати `keyNotation()` глобально без контексту: вона спільна для
команд і введення. Не створювати другий незалежний парсер pending-команд у UI.
Не змінювати dependency versions лише заради цього дизайну; спочатку перевірити
публічний `KeyEvent` контракт на мінімальній заявленій та фактичній версіях.

## 7. Перевірка та критерії прийняття

### Unit / component integration

- Logical mode: незмінений результат на старих ASCII, named keys і modifiers.
- Metadata: `р` + `baseCode=h` дає `h`, з Shift — `H`; punctuation `[/{`,
  `1/!`, некоректна metadata, її пріоритет над fallback, Caps Lock policy.
- Без metadata: повна таблиця `uk`, великі літери й punctuation-позиції літер;
  незмінені ASCII `.`, `/`, digits та невідомі Unicode-символи.
- `р/о/л/д`, `ц`, `вв`, `вшц`, `пп`, Shift-команди, counts і visual selection
  виконують відповідно `h/j/k/l`, `w`, `dd`, `diw`, `gg` та їх чинну семантику.
- `f`/`t`/`r` (також введені з українських позицій) + `і/р/я` використовують
  саме кириличний аргумент, навіть якщо для нього присутній `baseCode`.
- Insert typing, filter, answer, clipboard/paste і grapheme/combining input
  не змінюються; insert `kj` mapping не спрацьовує від кириличного тексту.
- Custom mappings і session toggle зберігають precedence; Ctrl+r не губить
  канонічну клавішу між resolver і engine; Alt pane bindings працюють лише
  у вже дозволених контекстах. Неперехоплена подія лишається незміненою.
- Dot repeat після кириличного insert/replace, supported register/macro replay,
  pending cancellation, focus change, queued paste + `i` + текст, toggle/dispose.

Використовувати існуючі `test/unit/`, `test/integration/`, fixtures і нові
табличні кейси resolver. Не імітувати весь OpenCode через fake host context.

### Real OpenCode E2E та ручна перевірка

- Prompt, model/palette dialogs, session/readers, question forms і composer.
- Live side terminal: звичайна кирилиця, Escape, shell shortcuts не змінюються;
  лише доступні зарезервовані pane chords спрацьовують по канонічній клавіші.
- Окремо raw UTF-8 без metadata і коректні CSI u з `baseCode` через test PTY.
  Це доводить parser/routing, але не реальні події фізичної клавіатури.
- Ручний цикл у терміналі користувача: US → українська → US, Shift/Ctrl/Alt,
  кириличний find/replace, звичайний текст; за потреби окремо tmux/SSH.
- За згодою користувача перевірити metadata на спеціально введених тестових
  клавішах. Не вмикати глобальне логування реального введення або prompt text.

Майбутні команди перевірки з `CONTRIBUTING.md`: `bun run typecheck`,
`bun run test`, focused `bun run test:e2e`, `bun run format:check`, build і
перевірка packed plugin. Нині залежності не встановлювалися, код і тести
не змінювалися, ці перевірки не виконувалися.

Прийняття: однакова командна семантика US/UK у metadata-backed шляху;
підтримана таблиця літер у fallback; жодної транслітерації payload або
впливу на child input; logical mode не регресує. Не називати fallback повною
апаратною незалежністю від розкладки.

## 8. Відкриті питання та rollout

Перед імплементацією потрібно погодити цей API і перевірити термінал:

1. Чи надходить `baseCode` для звичайних літер, не лише modified chords?
   Самої підтримки Kitty недостатньо: потрібні alternate-key reporting і
   відповідне кодування подій; plugin не змінює negotiation host самостійно.
2. Чи відповідає користувацький український layout таблиці `uk`, і чи прийнятні
   legacy-обмеження punctuation? За іншого layout потрібен інший явний профіль.
3. Чи прийнятні логічні insert mappings та Latin namespace registers/marks?

Майбутній rollout: окрема feature branch від `dev`, тести, перевірка
ізольованого packed plugin, потім лише з дозволу зміна plugin entry користувача.
Зберегти попередній entry для повернення на `opencode-vim@latest`; не перезаписувати
npm cache. Не відкривати upstream PR і не публікувати пакет у рамках цього етапу.

## 9. Джерела

- Source files і `CONTRIBUTING.md` у цьому checkout на зазначеному коміті.
- Локальний кеш OpenTUI `0.7.0`: `lib/KeyHandler.d.ts`,
  `lib/parse.keypress.d.ts` та реалізація Kitty parser.
- Локальний кеш `@vimee/core`: `dist/index.d.ts` (pending-фази та char commands).
- [OpenCode V2 TUI plugin API](https://opencode.ai/v2/docs/build/plugins/cli).
- [Kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/):
  Key codes, Report alternate keys, Report all keys as escape codes.
