/**
 * Google Apps Script — Grievance Portal Backend
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. On the first sheet tab (for Music Wall), add headers in row 1:
 *    url | embedUrl | addedBy | note | timestamp
 * 3. Create a second sheet tab called "Users" with headers in row 1:
 *    username | password
 *    Then add your two username/password combos in rows 2 and 3.
 * 4. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
 * 5. Paste it below in SHEET_ID
 * 6. In the Google Sheet, go to Extensions > Apps Script
 * 7. Paste this entire file into the script editor (replace any existing code)
 * 8. Click Deploy > Manage deployments > Edit (pencil icon)
 * 9. Set version to "New version" and click Deploy
 * 10. Copy the Web app URL and paste it into script.js as APPS_SCRIPT_URL
 */

const SHEET_ID = '154bYiZGAx4zsmapF8zZCYF5ObYy1_OiUBhQ98FwZtF8';

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'login') {
    return validateLogin(e.parameter);
  } else if (action === 'add') {
    return addSong(e.parameter);
  } else if (action === 'getMessages') {
    return getMessages();
  } else {
    return getSongs();
  }
}

function validateLogin(params) {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var usersSheet = spreadsheet.getSheetByName('Users');

  if (!usersSheet) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Users sheet not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = usersSheet.getDataRange().getValues();
  var username = (params.username || '').trim().toLowerCase();
  var password = params.password || '';

  for (var i = 1; i < data.length; i++) {
    var storedUser = String(data[i][0]).trim().toLowerCase();
    var storedPass = String(data[i][1]).trim();

    if (storedUser === username && storedPass === password) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid credentials' }))
    .setMimeType(ContentService.MimeType.JSON);
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

function getMessages() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var messagesSheet = spreadsheet.getSheetByName('Messages');

  if (!messagesSheet) {
    return ContentService.createTextOutput(JSON.stringify({
      categories: [],
      messages: {}
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var data = messagesSheet.getDataRange().getValues();

  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      categories: [],
      messages: {}
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var messagesMap = {};

  for (var i = 1; i < data.length; i++) {
    var category = String(data[i][0]).trim();
    var message = String(data[i][1]).trim();

    if (category && message) {
      if (!messagesMap[category]) {
        messagesMap[category] = [];
      }
      messagesMap[category].push(message);
    }
  }

  var categories = Object.keys(messagesMap);

  return ContentService.createTextOutput(JSON.stringify({
    categories: categories,
    messages: messagesMap
  })).setMimeType(ContentService.MimeType.JSON);
}
