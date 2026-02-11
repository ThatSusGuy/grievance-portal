/**
 * Google Apps Script — Music Wall Backend
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Add these headers in row 1: url | embedUrl | addedBy | note | timestamp
 * 3. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
 * 4. Paste it below in SHEET_ID
 * 5. In the Google Sheet, go to Extensions > Apps Script
 * 6. Paste this entire file into the script editor (replace any existing code)
 * 7. Click Deploy > New deployment
 * 8. Select type: Web app
 * 9. Set "Execute as": Me
 * 10. Set "Who has access": Anyone
 * 11. Click Deploy and authorize when prompted
 * 12. Copy the Web app URL and paste it into script.js as APPS_SCRIPT_URL
 */

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'add') {
    return addSong(e.parameter);
  } else {
    return getSongs();
  }
}

function getSongs() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    // Only headers, no songs
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0];
  var songs = [];

  for (var i = 1; i < data.length; i++) {
    var song = {};
    for (var j = 0; j < headers.length; j++) {
      song[headers[j]] = data[i][j];
    }
    songs.push(song);
  }

  // Return newest songs first
  songs.reverse();

  return ContentService.createTextOutput(JSON.stringify(songs))
    .setMimeType(ContentService.MimeType.JSON);
}

function addSong(params) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();

  sheet.appendRow([
    params.url,
    params.embedUrl,
    params.addedBy,
    params.note || '',
    new Date().toISOString()
  ]);

  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
