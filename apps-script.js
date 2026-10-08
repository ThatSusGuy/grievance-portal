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
 * 3c. The "Grievances", "GameLog" and "Stories" (Pocket Ridit saves) tabs (used by the stats page) are
 *    created automatically the first time something is logged — no
 *    manual setup needed.
 * 4. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
 * 5. Paste it below in SHEET_ID
 * 6. In the Google Sheet, go to Extensions > Apps Script
 * 7. Paste this entire file into the script editor (replace any existing code)
 * 8. Click Deploy > Manage deployments > Edit (pencil icon)
 * 9. Set version to "New version" and click Deploy
 * 10. Copy the Web app URL and paste it into script.js as APPS_SCRIPT_URL
 * 11. Pocket Ridit (the text adventure) needs a free Gemini API key from
 *     Google AI Studio (aistudio.google.com > Get API key). In the Apps
 *     Script editor, open Project Settings (gear icon) > Script Properties
 *     > Add script property: name GEMINI_API_KEY, value = your key.
 *     Never paste the key into this file — it's published on GitHub.
 *     Optional: add GEMINI_MODEL to force a specific model.
 *     To check it works (and to grant the "connect to an external service"
 *     permission), pick testPocketRidit in the function dropdown at the top
 *     of the editor and click Run, then read the Execution log.
 */

const SHEET_ID = '154bYiZGAx4zsmapF8zZCYF5ObYy1_OiUBhQ98FwZtF8';

// ── Stats page config ──────────────────────────────────────────────
// Login usernames, exactly as they appear in the Users sheet
// (case doesn't matter)
var HER_USERNAME = 'babyyy';
var HIS_USERNAME = 'me';

// Music Tug-of-War baseline: songs added before per-user tracking
// existed. New songs are counted automatically via the logged-in user.
var SONG_BASELINE = {};
SONG_BASELINE[HER_USERNAME] = 4;
SONG_BASELINE[HIS_USERNAME] = 1;

// How the names appear on the stats page
var SONG_DISPLAY = {};
SONG_DISPLAY[HER_USERNAME] = 'Baby 🥰';
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
  var grievances = {
    total: 0, thisMonth: 0, moods: {}, severities: {},
    byDay: {},        // 'YYYY-MM-DD' -> count, for the Drama Calendar
    moodsByMonth: {}  // 'YYYY-MM' -> { mood: count }, for the Mood Trends chart
  };
  var grievancesSheet = spreadsheet.getSheetByName('Grievances');
  if (grievancesSheet) {
    var gData = grievancesSheet.getDataRange().getValues();
    var now = new Date();
    var monthPrefix = now.toISOString().slice(0, 7); // e.g. "2026-08"

    for (var g = 1; g < gData.length; g++) {
      if (!gData[g][0]) continue;
      grievances.total++;

      var iso = toIsoString(gData[g][0]);
      var day = iso.slice(0, 10);
      var month = iso.slice(0, 7);

      if (month === monthPrefix) grievances.thisMonth++;
      if (day) grievances.byDay[day] = (grievances.byDay[day] || 0) + 1;

      var mood = String(gData[g][2] || '').trim();
      if (mood) {
        grievances.moods[mood] = (grievances.moods[mood] || 0) + 1;
        if (month) {
          if (!grievances.moodsByMonth[month]) grievances.moodsByMonth[month] = {};
          grievances.moodsByMonth[month][mood] = (grievances.moodsByMonth[month][mood] || 0) + 1;
        }
      }

      var severity = String(gData[g][3] || '').trim();
      if (severity) grievances.severities[severity] = (grievances.severities[severity] || 0) + 1;
    }
  }

  // --- Word game ---
  // Results: won | lost | revealed (mid-game beg) | begged (beg after a loss,
  // logged in addition to that game's 'lost' row)
  var games = { won: 0, lost: 0, revealed: 0, begged: 0, firstTry: 0, winGuessTotal: 0, recent: [] };
  var gameSheet = spreadsheet.getSheetByName('GameLog');
  if (gameSheet) {
    var logData = gameSheet.getDataRange().getValues();
    var events = [];

    for (var r = 1; r < logData.length; r++) {
      var result = String(logData[r][2] || '').trim();
      var guesses = Number(logData[r][3]) || 0;

      if (result === 'won') {
        games.won++;
        games.winGuessTotal += guesses;
        if (guesses === 1) games.firstTry++;
        events.push('won');
      } else if (result === 'lost') {
        games.lost++;
        events.push('lost');
      } else if (result === 'revealed') {
        games.revealed++;
        events.push('revealed');
      } else if (result === 'begged') {
        games.begged++;
        // A beg after a loss belongs to the previous game, so upgrade
        // that game's entry instead of adding a new one
        for (var k = events.length - 1; k >= 0; k--) {
          if (events[k] === 'lost') { events[k] = 'begged'; break; }
        }
      }
    }

    games.recent = events.slice(-20);
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

// ── Pocket Ridit (text adventure) ──────────────────────────────────
// The portal POSTs the story so far; Gemini narrates the next beat and
// picks one of the pixel animations below. The API key lives in Script
// Properties (GEMINI_API_KEY), never in code.

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOutput({ status: 'error', code: 'bad_request' });
  }

  if (body.action === 'adventure') {
    return jsonOutput(adventureTurn(body));
  } else if (body.action === 'saveStory') {
    return jsonOutput(saveStoryRow(body));
  } else if (body.action === 'listStories') {
    return jsonOutput(listStoryRows(body));
  } else if (body.action === 'getStory') {
    return jsonOutput(getStoryRow(body));
  }
  return jsonOutput({ status: 'error', code: 'unknown_action' });
}

// Keep in sync with ADVENTURE_ANIMATIONS / ADVENTURE_LOCATIONS in script.js
var ADVENTURE_ANIMATIONS = {
  sleeping: 'asleep, snoring',
  waking: 'waking up: sits up, stretches, yawns',
  idle: 'standing around, nothing special',
  talking: 'chatting, explaining, answering',
  walking: 'walking somewhere or following you',
  eating: 'eating (usually Bournville)',
  happy: 'pleased, laughing, grinning',
  love: 'smitten, hugging, kissing, heart eyes',
  angry: 'grumpy, annoyed, offended',
  sad: 'upset, sulking, crying',
  scared: 'startled, nervous, panicking',
  confused: 'baffled, does not understand',
  dancing: 'dancing, celebrating, music playing',
  couch: 'banished to the couch, sitting there in shame',
  fainting: 'collapses dramatically, knocked out',
  sneaky: 'tiptoeing, hiding something, looking guilty',
  phone: 'glued to his phone, not listening',
  showering: 'in the shower, singing',
  toilet: 'on the toilet with his phone',
  brushing: 'brushing teeth',
  cooking: 'cooking, flipping a pan',
  cleaning: 'sweeping, tidying',
  working: 'on his laptop',
  gaming: 'playing video games',
  reading: 'reading a book',
  singing: 'singing into a mic',
  guitar: 'playing guitar',
  exercising: 'lifting weights',
  running: 'running, rushing',
  waving: 'waving hello or bye',
  kissing: 'blowing a kiss',
  proposing: 'on one knee with a ring',
  flowers: 'giving roses',
  gift: 'giving a present',
  crying: 'sobbing dramatically',
  laughing: 'laughing hard',
  blushing: 'shy, flustered',
  thinking: 'thinking hard',
  shocked: 'jaw-dropped, stunned',
  sulking: 'arms crossed, pouting',
  begging: 'on his knees pleading',
  apologizing: 'bowing, saying sorry',
  shrugging: 'shrugging, no idea',
  facepalm: 'facepalming',
  hiding: 'hiding in a cardboard box',
  sick: 'ill with a thermometer',
  sleepy: 'yawning, nodding off',
  selfie: 'taking a selfie',
  flexing: 'flexing his muscles',
  shivering: 'freezing cold',
  swimming: 'swimming in the sea'
};

var ADVENTURE_LOCATIONS = ['bedroom', 'kitchen', 'living_room', 'outside', 'cafe',
  'bathroom', 'shower', 'beach', 'gym', 'office', 'cinema', 'supermarket',
  'rooftop', 'party', 'car'];

// Common near-misses from the model, mapped onto real animations
var ADVENTURE_ANIMATION_ALIASES = {
  sleep: 'sleeping', asleep: 'sleeping', snoring: 'sleeping',
  wake: 'waking', wakeup: 'waking', waking_up: 'waking', yawning: 'waking',
  standing: 'idle', neutral: 'idle', talk: 'talking', speaking: 'talking',
  walk: 'walking', running: 'walking', eat: 'eating', chewing: 'eating',
  laughing: 'happy', excited: 'happy', hug: 'love', hugging: 'love', kiss: 'love',
  loving: 'love', mad: 'angry', grumpy: 'angry', crying: 'sad', sulking: 'sad',
  nervous: 'scared', afraid: 'scared', shocked: 'scared', dance: 'dancing',
  celebrating: 'dancing', faint: 'fainting', fainted: 'fainting', ko: 'fainting',
  guilty: 'sneaky', on_phone: 'phone', texting: 'phone',
  shower: 'showering', bathing: 'showering', bath: 'showering', pooping: 'toilet',
  teeth: 'brushing', cook: 'cooking', sweeping: 'cleaning', typing: 'working',
  studying: 'working', game: 'gaming', playing: 'gaming', book: 'reading',
  sing: 'singing', workout: 'exercising', gym: 'exercising', run: 'running',
  wave: 'waving', blowing_kiss: 'kissing', propose: 'proposing', roses: 'flowers',
  present: 'gift', sobbing: 'crying', laugh: 'laughing', shy: 'blushing',
  think: 'thinking', surprised: 'shocked', pouting: 'sulking', pleading: 'begging',
  sorry: 'apologizing', shrug: 'shrugging', ill: 'sick', tired: 'sleepy',
  yawning: 'sleepy', flex: 'flexing', cold: 'shivering', freezing: 'shivering',
  swim: 'swimming'
};

// Each new story starts from one of these, so replays feel different
var ADVENTURE_OPENINGS = [
  'Morning, bedroom. Kaajal wakes up starving. Ridit is fast asleep next to her. Somewhere in the kitchen, a Bournville sits on the top shelf, just out of reach.',
  'Living room. Ridit has been sentenced to the couch for a crime he claims not to remember. Kaajal holds the evidence.',
  'Kitchen. Ridit has announced he is cooking dinner tonight. There is smoke. He says it is "part of the recipe".',
  'Cafe, date night. The bill has arrived. Ridit is patting his pockets with growing panic.',
  'Outside, an evening walk. Ridit insists he knows the way. He does not know the way.',
  'Bedroom, 2am. Kaajal is wide awake and wants attention. Ridit is asleep and snoring like a tractor.'
];

var ADVENTURE_MAX_TURNS = 10;      // history sent to the model
var ADVENTURE_RATE_LIMIT = 60;     // turns per 10 minutes, protects the free quota
// Flash-Lite first: it's the fastest and has the biggest free daily quota
var ADVENTURE_DEFAULT_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
];
var ADVENTURE_TIME_BUDGET_MS = 30000; // stop trying more models after this

function adventureSystemPrompt() {
  var animationLines = Object.keys(ADVENTURE_ANIMATIONS).map(function (name) {
    return name + ' (' + ADVENTURE_ANIMATIONS[name] + ')';
  }).join(', ');

  return [
    'You are the narrator of "Pocket Ridit", a cosy, funny text adventure in the style of Zork,',
    'inside a private website a boyfriend (Ridit) made for his girlfriend (Kaajal).',
    'Kaajal is the player. Address her as "you". Ridit is a character in the story: lovable,',
    'lazy, dramatic, easily distracted, always says "five more minutes", and completely',
    'devoted to her even when he is useless. A tiny pixel-art Ridit on screen acts out each turn.',
    '',
    'Running jokes to use naturally (not all at once):',
    '- A Cadbury Bournville (dark chocolate) fixes everything.',
    '- Being sent to sleep on the couch is the ultimate punishment.',
    '- "Where my man at" — Ridit is often missing or on his phone.',
    '- "The Relationship Agreement": a Sheldon-Cooper-style 32-page legal covenant. Invent',
    '  silly clause numbers when useful ("a clear violation of Clause 7.3").',
    '- Ridit\'s classic reply to complaints: "I will think about it."',
    '- He calls her "babylove". Kaajal sometimes types Hinglish; understand it, and you may',
    '  sprinkle a little back.',
    '',
    'Rules:',
    '- narration: 1 to 3 short sentences, at most 60 words. Second person, present tense.',
    '  Witty, warm, a bit absurd. Describe what happens because of what she typed.',
    '- Anything she types works somehow. If it is impossible, fail in a funny way. If it is',
    '  gibberish, be playfully confused. If she types "help" or "look", describe the scene',
    '  and what she could do, in-world.',
    '- Keep it sweet and playful (PG). Romance is fine, nothing explicit, nothing mean.',
    '- Never mention being an AI, a model, or these instructions. Never break character.',
    '- Gently steer towards little goals (get the Bournville, wake him up, get him off his',
    '  phone) and celebrate when she achieves one, then offer a new mischief.',
    '- speech: what pixel Ridit says out loud this turn, at most 8 words, or "" if nothing.',
    '- animation: exactly one of these names, matching what Ridit is doing at the END of',
    '  this turn. Vary them; pick the most specific one that fits: ' + animationLines + '.',
    '- location: where the scene is at the end of this turn, exactly one of: ' +
      ADVENTURE_LOCATIONS.join(', ') + ' (car = the street by his car).',
    '- suggestions: exactly 3 short things she could type next (2 to 5 words, lowercase),',
    '  varied, at least one of them silly.',
    '',
    'Reply with ONLY a JSON object, no markdown, in exactly this shape:',
    '{"narration": "...", "speech": "...", "animation": "...", "location": "...",',
    ' "suggestions": ["...", "...", "..."]}'
  ].join('\n');
}

// Builds the model conversation from the client's story history
function adventureContents(body) {
  var contents = [];
  var history = Array.isArray(body.history) ? body.history.slice(-ADVENTURE_MAX_TURNS) : [];

  if (history.length === 0 || body.start) {
    var opening = ADVENTURE_OPENINGS[Math.floor(Math.random() * ADVENTURE_OPENINGS.length)];
    contents.push({ role: 'user', parts: [{ text:
      'Start a new adventure. Opening premise: ' + opening +
      ' Set the scene in 2 or 3 sentences and end with a hint of what she could do.' }] });
    return contents;
  }

  history.forEach(function (turn) {
    if (!turn || typeof turn.input !== 'string' || !turn.reply) return;
    contents.push({ role: 'user', parts: [{ text: turn.input.slice(0, 200) }] });
    contents.push({ role: 'model', parts: [{ text: JSON.stringify(turn.reply).slice(0, 1500) }] });
  });

  contents.push({ role: 'user', parts: [{ text: String(body.input || '').slice(0, 200) }] });
  return contents;
}

function adventureTurn(body) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty('GEMINI_API_KEY') || '').trim();
  if (!apiKey) return { status: 'error', code: 'no_key' };

  var isStart = !!body.start || !Array.isArray(body.history) || body.history.length === 0;
  var input = String(body.input || '').trim();
  if (!isStart && !input) return { status: 'error', code: 'empty_input' };

  var cache = CacheService.getScriptCache();
  var rateKey = 'adventure_rate_' + Math.floor(Date.now() / 600000);
  var used = Number(cache.get(rateKey)) || 0;
  if (used >= ADVENTURE_RATE_LIMIT) return { status: 'error', code: 'rate_limited' };
  cache.put(rateKey, String(used + 1), 900);

  var request = {
    systemInstruction: { parts: [{ text: adventureSystemPrompt() }] },
    contents: adventureContents(body),
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 1.0,
      thinkingConfig: { thinkingLevel: 'low' }
    }
  };

  var result = callGemini(apiKey, request, props, cache);
  if (!result.ok) return { status: 'error', code: result.code, detail: result.detail };

  var reply = normalizeAdventureReply(result.text);
  if (!reply) {
    // One more go: an unreadable reply is usually a one-off
    console.log('Pocket Ridit unreadable reply, retrying: ' + result.text);
    var retry = callGemini(apiKey, request, props, cache);
    if (retry.ok) reply = normalizeAdventureReply(retry.text);
    if (!reply) {
      if (retry.ok) console.log('Pocket Ridit unreadable reply again: ' + retry.text);
      return { status: 'error', code: 'bad_reply', detail: String(result.text).slice(-200) };
    }
  }
  return { status: 'success', reply: reply };
}

// Run this from the Apps Script editor (function dropdown > testPocketRidit
// > Run). The first run asks for permission to reach Gemini; the log then
// shows whether a story starts, or exactly why not.
function testPocketRidit() {
  var key = String(PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '').trim();
  Logger.log('GEMINI_API_KEY set: ' + (key ? 'yes (' + key.length + ' characters)' : 'NO'));
  var result = adventureTurn({ action: 'adventure', start: true });
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log(result.status === 'success' ? 'Pocket Ridit works!' : 'Pocket Ridit failed: ' + result.code);
}

// Tries models in order until one answers. Free-tier quotas are per model,
// so a 429 on one model falls through to the next. The model that worked
// is cached so later turns go straight to it.
function callGemini(apiKey, request, props, cache) {
  var models = [];
  var forced = String(props.getProperty('GEMINI_MODEL') || '').trim();
  var lastGood = cache.get('adventure_model');
  [forced, lastGood].concat(ADVENTURE_DEFAULT_MODELS).forEach(function (m) {
    if (m && models.indexOf(m) === -1) models.push(m);
  });

  var plain = JSON.parse(JSON.stringify(request));
  delete plain.generationConfig.thinkingConfig;

  var lastCode = 'ai_unavailable';
  var attempts = [];
  var started = Date.now();
  for (var i = 0; i < models.length; i++) {
    if (i > 0 && Date.now() - started > ADVENTURE_TIME_BUDGET_MS) {
      lastCode = 'slow';
      break;
    }
    var attemptStart = Date.now();
    var noThinkKey = 'adventure_nothink_' + models[i];
    var skipThinking = cache.get(noThinkKey) === '1';
    var response = fetchGemini(apiKey, models[i], skipThinking ? plain : request);

    // Older models reject thinkingLevel; retry the same model without it
    if (response.status === 400 && !skipThinking) {
      response = fetchGemini(apiKey, models[i], plain);
      if (response.status === 200) cache.put(noThinkKey, '1', 21600);
    }

    attempts.push(models[i] + ': ' + describeGeminiResponse(response) +
      ' (' + ((Date.now() - attemptStart) / 1000).toFixed(1) + 's)');

    if (response.status === 200) {
      console.log('Pocket Ridit: ' + attempts.join(' | '));
      var text = geminiText(response.json);
      if (text === null) return { ok: false, code: 'blocked', detail: attempts.join(' | ') };
      cache.put('adventure_model', models[i], 21600);
      return { ok: true, text: text };
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      // A bad or restricted key fails the same way on every model
      var message = JSON.stringify(response.json || {});
      if (/API_KEY|api key|PERMISSION_DENIED/i.test(message)) {
        return { ok: false, code: 'bad_key', detail: attempts.join(' | ') };
      }
    }
    // Apps Script hasn't been allowed to reach the internet yet
    if (response.status === 0 && /permission|authoriz/i.test(response.error || '')) {
      return { ok: false, code: 'needs_permission', detail: response.error };
    }
    lastCode = response.status === 429 ? 'quota' : 'ai_unavailable';
  }
  console.log('Pocket Ridit failed: ' + attempts.join(' | '));
  return { ok: false, code: lastCode, detail: attempts.join(' | ').slice(0, 600) };
}

// Short, key-free summary of a Gemini response for error messages
function describeGeminiResponse(response) {
  if (response.status === 0) return 'request failed (' + String(response.error || '').slice(0, 120) + ')';
  var err = response.json && response.json.error;
  return response.status + (err ? ' ' + (err.status || '') + ' ' + String(err.message || '').slice(0, 120) : '');
}

function fetchGemini(apiKey, model, request) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent';
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': apiKey },
      payload: JSON.stringify(request),
      muteHttpExceptions: true
    });
    var json = null;
    try { json = JSON.parse(res.getContentText()); } catch (err) { /* non-JSON error page */ }
    return { status: res.getResponseCode(), json: json };
  } catch (err) {
    return { status: 0, json: null, error: String(err && err.message || err) };
  }
}

// Joins the answer text, skipping thought summaries; null when blocked
function geminiText(json) {
  var candidate = json && json.candidates && json.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts) return null;
  var text = candidate.content.parts
    .filter(function (p) { return typeof p.text === 'string' && !p.thought; })
    .map(function (p) { return p.text; })
    .join('');
  return text || null;
}

// Reads the model's JSON even when it's slightly broken: wrapped in
// markdown, with raw line breaks inside strings, sent twice in a row,
// followed by chatter, or cut off part-way through
function parseAdventureJson(text) {
  var cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  var flattened = cleaned.replace(/[\u0000-\u001F]+/g, ' ');
  var attempts = [cleaned, flattened, firstJsonObject(cleaned), firstJsonObject(flattened)];
  for (var i = 0; i < attempts.length; i++) {
    if (!attempts[i]) continue;
    try { return JSON.parse(attempts[i]); } catch (err) { /* try the next form */ }
  }
  return salvageAdventureFields(flattened);
}

// The first complete {...} in the text, respecting braces inside strings
function firstJsonObject(text) {
  var start = text.indexOf('{');
  if (start === -1) return null;
  var depth = 0, inString = false, escaped = false;
  for (var i = start; i < text.length; i++) {
    var ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Last resort for a cut-off reply: pull out whatever fields made it through
function salvageAdventureFields(text) {
  function field(name) {
    var m = text.match(new RegExp('"' + name + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)("?)'));
    if (!m) return null;
    var value;
    try { value = JSON.parse('"' + m[1] + '"'); } catch (err) { value = m[1]; }
    return { value: value, complete: m[2] === '"' };
  }
  var narration = field('narration');
  if (!narration || narration.value.length < 20) return null;
  var story = narration.value;
  if (!narration.complete) {
    // cut off mid-sentence: keep the finished sentences only
    var end = Math.max(story.lastIndexOf('. '), story.lastIndexOf('! '), story.lastIndexOf('? '));
    if (end < 20) return null;
    story = story.slice(0, end + 1);
  }
  var animation = field('animation'), location = field('location'), speech = field('speech');
  return {
    narration: story,
    animation: animation && animation.complete ? animation.value : 'idle',
    location: location && location.complete ? location.value : '',
    speech: speech && speech.complete ? speech.value : '',
    suggestions: []
  };
}

// Parses and cleans the model's JSON so the page always gets a usable turn
function normalizeAdventureReply(text) {
  var data = parseAdventureJson(String(text || ''));
  if (Array.isArray(data)) data = data[0];
  if (!data || typeof data !== 'object') return null;

  var narration = String(data.narration || '').trim();
  if (!narration) return null;
  if (narration.length > 600) narration = narration.slice(0, 597).replace(/\s+\S*$/, '') + '...';

  var animation = String(data.animation || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!ADVENTURE_ANIMATIONS[animation]) animation = ADVENTURE_ANIMATION_ALIASES[animation] || 'idle';

  var location = String(data.location || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (location === 'living' || location === 'lounge') location = 'living_room';
  if (ADVENTURE_LOCATIONS.indexOf(location) === -1) location = '';

  var speech = String(data.speech || '').trim().replace(/^["']|["']$/g, '');
  if (speech.length > 60) speech = speech.slice(0, 57).replace(/\s+\S*$/, '') + '...';

  var suggestions = (Array.isArray(data.suggestions) ? data.suggestions : [])
    .map(function (s) { return String(s || '').trim(); })
    .filter(function (s) { return s && s.length <= 40; })
    .slice(0, 3);

  return {
    narration: narration,
    speech: speech,
    animation: animation,
    location: location,
    suggestions: suggestions
  };
}

// ── Pocket Ridit saved stories ─────────────────────────────────────
// One row per story in the "Stories" tab, filed under the login name so
// each person sees their own. The whole story is kept as JSON from column
// G onwards: a Sheets cell holds 50,000 characters, so a long story simply
// continues into H, I, J... and is stitched back together when loaded.

var STORY_CHUNK_CHARS = 45000;
var STORY_MAX_CHUNKS = 40; // ~1.8 million characters, thousands of moves
var STORY_DATA_COLUMN = 7;
var STORY_COLUMNS = ['id', 'user', 'title', 'updatedAt', 'moves', 'preview', 'data'];

function storiesSheet() {
  return ensureSheet(SpreadsheetApp.openById(SHEET_ID), 'Stories', STORY_COLUMNS);
}

function storyUser(value) {
  return String(value || '').trim().toLowerCase().slice(0, 40);
}

// Keeps Sheets from reading text like "=..." as a formula
function sheetText(value) {
  var text = String(value || '');
  return /^[=+\-@]/.test(text) ? ' ' + text : text;
}

function findStoryRow(sheet, id) {
  var cell = sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : 0;
}

function saveStoryRow(body) {
  var user = storyUser(body.user);
  var story = body.story;
  if (!user || !story || typeof story.id !== 'string' || !/^[a-z0-9_-]{4,40}$/i.test(story.id) ||
      !story.opening || typeof story.opening.narration !== 'string' || !Array.isArray(story.turns)) {
    return { status: 'error', code: 'bad_story' };
  }

  var copy = {
    id: story.id,
    title: String(story.title || '').slice(0, 60),
    createdAt: Number(story.createdAt) || Date.now(),
    updatedAt: Number(story.updatedAt) || Date.now(),
    opening: story.opening,
    turns: story.turns
  };
  var data = JSON.stringify(copy);
  // only a truly enormous story would ever lose its oldest moves
  while (data.length > STORY_CHUNK_CHARS * STORY_MAX_CHUNKS && copy.turns.length > 1) {
    copy.turns.splice(0, Math.ceil(copy.turns.length / 10));
    data = JSON.stringify(copy);
  }
  var chunks = [];
  for (var i = 0; i < data.length; i += STORY_CHUNK_CHARS) chunks.push(data.slice(i, i + STORY_CHUNK_CHARS));

  var last = copy.turns.length ? copy.turns[copy.turns.length - 1].reply : copy.opening;
  var values = [copy.id, user, sheetText(copy.title), new Date(copy.updatedAt).toISOString(),
    copy.turns.length, sheetText(String((last && last.narration) || '').slice(0, 140))].concat(chunks);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = storiesSheet();
    var row = findStoryRow(sheet, copy.id);
    if (row) {
      // only the person who started a story can overwrite it
      if (storyUser(sheet.getRange(row, 2).getValue()) !== user) return { status: 'error', code: 'not_yours' };
      // blank out any leftover pieces from a longer earlier version
      while (values.length < sheet.getLastColumn()) values.push('');
      sheet.getRange(row, 1, 1, values.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }
  } finally {
    lock.releaseLock();
  }
  return { status: 'success', moves: copy.turns.length, cells: chunks.length };
}

// The shelf: every story for this person, newest first, without the
// heavy JSON column
function listStoryRows(body) {
  var user = storyUser(body.user);
  if (!user) return { status: 'error', code: 'bad_story' };
  var sheet = storiesSheet();
  var lastRow = sheet.getLastRow();
  var stories = [];
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 6).getValues().forEach(function (row) {
      if (!row[0] || storyUser(row[1]) !== user) return;
      stories.push({
        id: String(row[0]),
        title: String(row[2]).trim(),
        updatedAt: Date.parse(toIsoString(row[3])) || 0,
        moves: Number(row[4]) || 0,
        preview: String(row[5]).trim()
      });
    });
  }
  stories.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  return { status: 'success', stories: stories.slice(0, 100) };
}

function getStoryRow(body) {
  var user = storyUser(body.user);
  var id = String(body.id || '');
  if (!user || !id) return { status: 'error', code: 'bad_story' };
  var sheet = storiesSheet();
  var row = findStoryRow(sheet, id);
  if (!row) return { status: 'error', code: 'not_found' };
  var values = sheet.getRange(row, 1, 1, Math.max(STORY_DATA_COLUMN, sheet.getLastColumn())).getValues()[0];
  if (storyUser(values[1]) !== user) return { status: 'error', code: 'not_found' };
  var data = '';
  for (var c = STORY_DATA_COLUMN - 1; c < values.length && values[c] !== ''; c++) data += String(values[c]);
  try {
    return { status: 'success', story: JSON.parse(data) };
  } catch (err) {
    return { status: 'error', code: 'bad_story' };
  }
}
