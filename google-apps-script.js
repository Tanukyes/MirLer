var SPREADSHEET_ID = '1u1FlafbinlrbAaTnMqQ1IrZns-cHiRkJO75TjfEI68M'

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID)
}

function doGet(e) {
  var action = e.parameter.action || ''
  var result

  if (action === 'getPhotos') {
    result = getPhotos()
  } else {
    result = { result: 'ok' }
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    var body = {}
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents)
    }

    var action = body.action || ''

    if (action === 'addPhoto') {
      return addPhoto(body.imgUrl, body.publicId)
    }

    // Анкета гостя
    var sheet = getSpreadsheet().getSheets()[0]
    sheet.appendRow([body.name || '', body.attendance || '', body.drinks || ''])

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON)

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

function addPhoto(imgUrl, publicId) {
  if (!imgUrl || !publicId) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: 'Missing imgUrl or publicId' }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  var ss = getSpreadsheet()
  var sheet = ss.getSheetByName('photos')

  if (!sheet) {
    sheet = ss.insertSheet('photos')
    sheet.appendRow(['publicId', 'imgUrl', 'created'])
  }

  sheet.appendRow([publicId, imgUrl, new Date().toISOString()])

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON)
}

function getPhotos() {
  var ss = getSpreadsheet()
  var sheet = ss.getSheetByName('photos')

  if (!sheet) return { photos: [] }

  var data = sheet.getDataRange().getValues()
  var photos = []

  for (var i = 1; i < data.length; i++) {
    var row = data[i]
    if (row[0] && row[1]) {
      photos.push({ publicId: row[0], imgUrl: row[1], created: row[2] || '' })
    }
  }

  photos.reverse()
  return { photos: photos }
}
