# Настройка отправки анкеты гостя в Google Таблицу

Анкета с сайта отправляет данные (имя, присутствие, напитки) в Google Таблицу через веб-приложение на Google Apps Script. Запрос отправляется с `Content-Type: text/plain`, чтобы избежать CORS-блокировки (preflight) при обращении с localhost или другого домена.

## 1. Создать Google Таблицу

1. Откройте [Google Таблицы](https://sheets.google.com) и создайте новую таблицу.
2. В первой строке задайте заголовки колонок:
   - **A1:** `Имя и фамилия`
   - **B1:** `Присутствие`
   - **C1:** `Напитки`

## 2. Добавить скрипт Apps Script

1. В таблице: **Расширения** → **Apps Script**.
2. Удалите содержимое файла `Code.gs` и вставьте код из файла `google-apps-script.js` в корне проекта (или скопируйте пример ниже).
3. Сохраните проект (Ctrl+S).

### Пример кода (Code.gs)

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var body = e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var name = body.name || '';
    var attendance = body.attendance || '';
    var drinks = body.drinks || '';
    sheet.appendRow([name, attendance, drinks]);
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Развернуть как веб-приложение

1. В редакторе Apps Script нажмите **Развернуть** → **Новые развёртывания**.
2. Тип: **Веб-приложение**.
3. **Описание:** например, «Приём анкет с сайта».
4. **Запуск от имени:** ваш аккаунт.
5. **У кого есть доступ:** **Все** (иначе сайт не сможет отправить запрос).
6. Нажмите **Развернуть**, при первом развёртывании подтвердите доступ к аккаунту.
7. Скопируйте **URL веб-приложения** (например, `https://script.google.com/macros/s/.../exec`).

## 4. Указать URL в проекте

1. В корне проекта создайте файл `.env` (если его ещё нет).
2. Добавьте строку (подставьте свой URL):

   ```
   VITE_GOOGLE_SHEET_URL=https://script.google.com/macros/s/ВАШ_ID/exec
   ```

3. Перезапустите dev-сервер (`npm run dev`), чтобы переменные окружения подхватились.
4. Добавьте `.env` в `.gitignore`, чтобы URL не попал в репозиторий.

После этого кнопка «Отправить» в анкете гостя будет добавлять строку в вашу таблицу.
