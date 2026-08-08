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
 * 3b. Create a sheet tab called "Game" with headers in row 1:
 *    word | hint
 *    Add one row per secret word (with an optional hint). The portal
 *    picks a random word from the list for each new game.
 * 3c. The "Grievances" and "GameLog" tabs (used by the stats page) are
 *    created automatically the first time something is logged — no
 *    manual setup needed.
 * 4. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
 * 5. Paste it below in SHEET_ID
 * 6. In the Google Sheet, go to Extensions > Apps Script
 * 7. Paste this entire file into the script editor (replace any existing code)
 * 8. Click Deploy > Manage deployments > Edit (pencil icon)
 * 9. Set version to "New version" and click Deploy
 * 10. Copy the Web app URL and paste it into script.js as APPS_SCRIPT_URL
 */

const SHEET_ID = '154bYiZGAx4zsmapF8zZCYF5ObYy1_OiUBhQ98FwZtF8';

// ── Stats page config ──────────────────────────────────────────────
// Login usernames, exactly as they appear in the Users sheet
// (case doesn't matter)
var HER_USERNAME = 'baby';   // ⚠️ REPLACE with her real login username
var HIS_USERNAME = 'daddy';  // ⚠️ REPLACE with your real login username

// Music Tug-of-War baseline: songs added before per-user tracking
// existed. New songs are counted automatically via the logged-in user.
var SONG_BASELINE = {};
SONG_BASELINE[HER_USERNAME] = 4;
SONG_BASELINE[HIS_USERNAME] = 1;

// How the names appear on the stats page
var SONG_DISPLAY = {};
SONG_DISPLAY[HER_USERNAME] = 'Baby 💕';
SONG_DISPLAY[HIS_USERNAME] = 'Daddy 😎';

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'login') {
    return validateLogin(e.parameter);
  } else if (action === 'add') {
    return addSong(e.parameter);
  } else if (action === 'getMessages') {
    return getMessages();
  } else if (action === 'getGameWord') {
    return getGameWord();
  } else if (action === 'logGrievance') {
    return logGrievance(e.parameter);
  } else if (action === 'logGame') {
    return logGame(e.parameter);
  } else if (action === 'getStats') {
    return getStats();
  } else {
    return getSongs();
  }
}

// Returns the named sheet tab, creating it (with headers) if missing
function ensureSheet(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Timestamps read from the sheet may be Date objects or strings
function toIsoString(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || '');
}

function logGrievance(params) {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ensureSheet(spreadsheet, 'Grievances',
    ['timestamp', 'title', 'mood', 'severity']);

  sheet.appendRow([
    new Date().toISOString(),
    params.title || '',
    params.mood || '',
    params.severity || ''
  ]);

  return jsonOutput({ status: 'success' });
}

function logGame(params) {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ensureSheet(spreadsheet, 'GameLog',
    ['timestamp', 'word', 'result', 'guesses']);

  // The word arrives base64-encoded (same obfuscation as getGameWord);
  // decode it so the sheet stays readable
  var word = params.word || '';
  try {
    word = Utilities.newBlob(Utilities.base64Decode(word)).getDataAsString();
  } catch (err) { /* keep the raw value if it wasn't base64 */ }

  sheet.appendRow([
    new Date().toISOString(),
    word,
    params.result || '',
    Number(params.guesses) || 0
  ]);

  return jsonOutput({ status: 'success' });
}

function getStats() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);

  // --- Songs (first sheet tab, full history) ---
  var songsData = spreadsheet.getSheets()[0].getDataRange().getValues();
  var songTotal = 0;
  var lastAdded = '';

  // The tug-of-war starts from the manual baseline (pre-tracking
  // history), then adds rows attributed via the logged-in user column
  var displayByKey = {};
  Object.keys(SONG_DISPLAY).forEach(function (name) {
    displayByKey[name.toLowerCase()] = SONG_DISPLAY[name];
  });

  var contributorCounts = {};
  var contributorNames = {};
  Object.keys(SONG_BASELINE).forEach(function (name) {
    var nameKey = name.toLowerCase();
    contributorCounts[nameKey] = SONG_BASELINE[name];
    contributorNames[nameKey] = displayByKey[nameKey] || name;
  });

  for (var i = 1; i < songsData.length; i++) {
    if (!songsData[i][0]) continue;
    songTotal++;

    var user = String(songsData[i][5] || '').trim().toLowerCase();
    if (user) {
      contributorCounts[user] = (contributorCounts[user] || 0) + 1;
      if (!contributorNames[user]) {
        contributorNames[user] = displayByKey[user] || String(songsData[i][5]).trim();
      }
    }

    var ts = toIsoString(songsData[i][4]);
    if (ts > lastAdded) lastAdded = ts;
  }

  var contributors = Object.keys(contributorCounts).map(function (key) {
    return { name: contributorNames[key], count: contributorCounts[key] };
  }).sort(function (a, b) { return b.count - a.count; });

  // --- Grievances ---
  var grievances = { total: 0, thisMonth: 0, moods: {}, severities: {} };
  var grievancesSheet = spreadsheet.getSheetByName('Grievances');
  if (grievancesSheet) {
    var gData = grievancesSheet.getDataRange().getValues();
    var now = new Date();
    var monthPrefix = now.toISOString().slice(0, 7); // e.g. "2026-08"

    for (var g = 1; g < gData.length; g++) {
      if (!gData[g][0]) continue;
      grievances.total++;

      if (toIsoString(gData[g][0]).slice(0, 7) === monthPrefix) {
        grievances.thisMonth++;
      }

      var mood = String(gData[g][2] || '').trim();
      if (mood) grievances.moods[mood] = (grievances.moods[mood] || 0) + 1;

      var severity = String(gData[g][3] || '').trim();
      if (severity) grievances.severities[severity] = (grievances.severities[severity] || 0) + 1;
    }
  }

  // --- Word game ---
  // Results: won | lost | revealed (mid-game beg) | begged (beg after a loss,
  // logged in addition to that game's 'lost' row)
  var games = { won: 0, lost: 0, revealed: 0, begged: 0, firstTry: 0, winGuessTotal: 0 };
  var gameSheet = spreadsheet.getSheetByName('GameLog');
  if (gameSheet) {
    var logData = gameSheet.getDataRange().getValues();
    for (var r = 1; r < logData.length; r++) {
      var result = String(logData[r][2] || '').trim();
      var guesses = Number(logData[r][3]) || 0;

      if (result === 'won') {
        games.won++;
        games.winGuessTotal += guesses;
        if (guesses === 1) games.firstTry++;
      } else if (result === 'lost') {
        games.lost++;
      } else if (result === 'revealed') {
        games.revealed++;
      } else if (result === 'begged') {
        games.begged++;
      }
    }
  }

  return jsonOutput({
    songs: { total: songTotal, contributors: contributors, lastAdded: lastAdded },
    grievances: grievances,
    games: games
  });
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

  // Make sure the 'user' header exists (column F was added later)
  if (!String(sheet.getRange(1, 6).getValue())) {
    sheet.getRange(1, 6).setValue('user');
  }

  sheet.appendRow([
    params.url,
    params.embedUrl,
    params.addedBy,
    params.note || '',
    new Date().toISOString(),
    params.user || ''
  ]);

  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getGameWord() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var gameSheet = spreadsheet.getSheetByName('Game');

  if (!gameSheet) {
    return ContentService.createTextOutput(JSON.stringify({ words: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = gameSheet.getDataRange().getValues();
  var words = [];

  for (var i = 1; i < data.length; i++) {
    var word = String(data[i][0]).trim();
    if (word) {
      // Base64-encode each word so they can't be read at a glance
      // in the browser's network tab (light obfuscation, not security)
      words.push({
        word: Utilities.base64Encode(word, Utilities.Charset.UTF_8),
        hint: String(data[i][1] || '').trim()
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ words: words }))
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
