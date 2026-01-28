/**
 * Вставьте этот код в Google Apps Script (Расширения → Apps Script в Google Таблице).
 * Ожидаемые колонки: A — Имя и фамилия, B — Присутствие, C — Напитки.
 */
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
