// ============================================================
//  투표 백엔드 (Google Apps Script)
//  - 구글 시트에 붙어서(컨테이너 바운드) 동작
//  - doPost: 투표 저장 (사번당 1회)
//  - doGet : 결과 집계 반환
// ============================================================
var SHEET_NAME = 'votes';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    var saban = String(data.saban || '').trim();
    var choices = data.choices || [];
    if (!saban || choices.length !== 3) {
      return _json({ status: 'error', message: 'invalid' });
    }
    var sh = _sheet();
    var last = sh.getLastRow();
    if (last > 0) {
      var sabans = sh.getRange(1, 1, last, 1).getValues();
      for (var i = 0; i < sabans.length; i++) {
        if (String(sabans[i][0]).trim() === saban) {
          return _json({ status: 'dup' });
        }
      }
    }
    sh.appendRow([saban, choices[0], choices[1], choices[2], new Date()]);
    return _json({ status: 'ok' });
  } catch (err) {
    return _json({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var sh = _sheet();
  var last = sh.getLastRow();
  var rows = last > 0 ? sh.getRange(1, 1, last, 5).getValues() : [];
  var tally = {};
  var out = [];
  rows.forEach(function (r) {
    [r[1], r[2], r[3]].forEach(function (c) {
      if (c) tally[c] = (tally[c] || 0) + 1;
    });
    out.push({ saban: r[0], c: [r[1], r[2], r[3]], ts: r[4] });
  });
  return _json({ status: 'ok', total: rows.length, tally: tally, rows: out });
}

function _sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
