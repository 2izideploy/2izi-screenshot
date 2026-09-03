# Чек-лист публикации в Chrome Web Store

## 1. Что нужно заранее

- [ ] Аккаунт разработчика Chrome Web Store (одноразовый взнос $5, если ещё
      не платили — https://chrome.google.com/webstore/devconsole)
- [ ] Домен/страница поддержки уже готова: `https://2izi.ru/support`
- [ ] Файл `docs/PRIVACY.md` (EN) и `docs/PRIVACY.ru.md` (RU) нужно
      разместить как отдельную публичную страницу (например,
      `2izi.ru/support/privacy` или прямо в GitHub — главное, чтобы был
      постоянный публичный URL, его попросят указать в форме)
- [ ] Как минимум один скриншот интерфейса 1280×800 или 640×400 (PNG/JPG,
      без прозрачности) — сними сам попап расширения и/или процесс
      выделения области на реальном сайте
- [ ] Промо-плитка 440×280 — не обязательна, но повышает шанс на попадание
      в подборки

## 2. Собираем ZIP для загрузки

Загружать в дэшборд нужно **только** содержимое папки `extension/`
(манифест должен лежать в корне архива, без обёртки `extension/` внутри).

```bash
cd extension
zip -r ../2izi-screenshot-store-upload.zip . -x "*.DS_Store"
```

## 3. Store Listing → заполняем поля

| Поле | Что вставить |
|------|--------------|
| Item name | `2izi Screenshot — Full Page & Area to JPG` (EN) |
| Summary (короткое, до 132 симв.) | из `store/listing.en.md` / `store/listing.ru.md` |
| Description (полное) | из тех же файлов, раздел "Detailed description" |
| Category | Productivity |
| Language | добавь и English, и Russian — сам текст на двух языках вставлять не нужно, Chrome покажет `_locales` автоматически, но в описании листинга (Store Listing) можно продублировать оба текста через переключатель языка в самом дэшборде |
| Screenshots | минимум 1, до 5 штук, 1280×800 или 640×400 |
| Icon | `icons/icon128.png` (дэшборд попросит отдельно 128×128, даже если он уже в манифесте) |
| Support URL | `https://2izi.ru/support` |
| Homepage URL | `https://2izi.ru/support` |

## 4. Privacy practices (обязательная вкладка)

Chrome Web Store требует объяснить каждое разрешение и подтвердить, что вы
не продаёте пользовательские данные.

**Single purpose description** (впиши как есть или переведи):
> Captures the visible page or a user-selected area and saves it as a JPG
> file using Chrome's screenshot and downloads APIs.

**Обоснование разрешений** (можно копировать из `docs/PRIVACY.md`):

- `activeTab` — "Used to capture the tab the user is currently viewing,
  only after the user clicks the extension icon."
- `scripting` — "Used to inject the selection overlay and to scroll the
  page during full-page capture. Only runs on the active tab after user
  action."
- `downloads` — "Used to save the generated JPEG screenshot to the user's
  Downloads folder."

**Data usage:**
- Отметь, что расширение **не собирает** ни один из перечисленных типов
  данных (Personally identifiable information, Health info, Financial info,
  Authentication info, Personal communications, Location, Web history, User
  activity, Website content) — всё обрабатывается локально и никуда не
  уходит.
- Укажи ссылку на политику конфиденциальности (публичный URL из шага 1).
- Подтверди чекбоксы: "I do not sell or transfer user data to third
  parties" и "I do not use or transfer user data for purposes unrelated to
  the item's single purpose".

## 5. Distribution

- Visibility: Public (или Unlisted, если хочешь сначала протестировать по
  прямой ссылке)
- Regions: All regions, либо ограничь при желании

## 6. Отправка на проверку

- Проверь ещё раз, что версия в `manifest.json` совпадает с версией,
  которую ты вписал в дэшборде
- Нажми **Submit for review**
- Обычно проверка занимает от нескольких часов до нескольких дней;
  расширения с разрешением `scripting` иногда проверяют дольше первого раза

## 7. Публикация на GitHub

```bash
cd screenshot-extension-repo
git init
git add .
git commit -m "2izi Screenshot v1.1.0"
git branch -M main
git remote add origin <URL твоего репозитория>
git push -u origin main
```

Не забудь после публикации в Web Store вписать реальную ссылку на карточку
в `README.md`, `README.ru.md` и в оба файла `store/listing.*.md` (там сейчас
плейсхолдеры `[add your GitHub URL here]` / `[укажите ссылку на GitHub]`).
