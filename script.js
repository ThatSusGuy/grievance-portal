// Wait for the entire page to load before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Initialize EmailJS with your Public Key
    (function(){
        emailjs.init("PoB9fcQiaekD1g8OI"); // ⚠️ PASTE YOUR PUBLIC KEY HERE
    })();

    // --- Google Sheets Apps Script URL ---
    // Replace this with your deployed Apps Script web app URL
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxylONlZBEmsCjCuV-8bz8FeMBVZ1Jv0x3xVHylEUZLYek6dfvxbE7IwgTHhuRs-OXZ/exec';

    // --- Get references to all screens ---
    const loginScreen = document.getElementById('login-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    const formScreen = document.getElementById('form-screen');
    const thanksScreen = document.getElementById('thanks-screen');
    const musicWallScreen = document.getElementById('music-wall-screen');
    const messagesScreen = document.getElementById('messages-screen');
    const wordGameScreen = document.getElementById('word-game-screen');

    // --- Login Logic ---
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    function showApp() {
        loginScreen.style.display = 'none';
        document.body.classList.add('authenticated');
        welcomeScreen.style.display = 'flex';
    }

    // Check if already logged in this session
    if (sessionStorage.getItem('authenticated') === 'true') {
        showApp();
    }

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        loginError.style.display = 'none';

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking...';

        const params = new URLSearchParams({
            action: 'login',
            username: username,
            password: password
        });

        fetch(APPS_SCRIPT_URL + '?' + params.toString())
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success') {
                    sessionStorage.setItem('authenticated', 'true');
                    // Remember who logged in so new songs are attributed properly
                    sessionStorage.setItem('portalUser', username.toLowerCase());
                    showApp();
                } else {
                    loginError.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enter';
                }
            })
            .catch(() => {
                loginError.textContent = 'Something went wrong. Try again.';
                loginError.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enter';
            });
    });

    // --- Days Counter Logic ---
    const startDate = new Date('2023-01-05T00:00:00'); // Your start date (Jan 5, 2023)
    const today = new Date();

    // Calculate the difference in milliseconds
    const differenceInMs = today - startDate;

    // Convert milliseconds to days (1000ms * 60s * 60min * 24hr)
    const msPerDay = 1000 * 60 * 60 * 24;
    const differenceInDays = Math.floor(differenceInMs / msPerDay);

    // Add 1 to make it inclusive
    const inclusiveDays = differenceInDays + 1;

    // Find the element on the page
    const counterElement = document.getElementById('days-counter');

    // We use innerHTML here to allow the <br> tag to create a line break.
    counterElement.innerHTML = `Today is day ${inclusiveDays}/∞ of our beautiful, crazy journey.<br><br>(Your man knows his numbers 😉)`;

    // Get references to buttons and forms
    const enterBtn = document.getElementById('enter-btn');
    const grievanceForm = document.getElementById('grievance-form');
    const submitAnotherBtn = document.getElementById('submit-another-btn');

    // Music Wall references
    const musicWallBtn = document.getElementById('music-wall-btn');
    const musicWallBackBtn = document.getElementById('music-wall-back-btn');
    const addSongForm = document.getElementById('add-song-form');
    const songUrlInput = document.getElementById('song-url');
    const songAddedByInput = document.getElementById('song-added-by');
    const songNoteInput = document.getElementById('song-note');
    const songsGrid = document.getElementById('songs-grid');
    const noSongsMsg = document.getElementById('no-songs-msg');
    const songError = document.getElementById('song-error');

    // Love Notes references
    const loveNotesBtn = document.getElementById('love-notes-btn');
    const messagesBackBtn = document.getElementById('messages-back-btn');
    const categoriesArea = document.getElementById('categories-area');
    const categoriesLoading = document.getElementById('categories-loading');
    const messageDisplay = document.getElementById('message-display');
    const messageCategoryLabel = document.getElementById('message-category-label');
    const messageText = document.getElementById('message-text');
    const anotherMessageBtn = document.getElementById('another-message-btn');
    const pickCategoryBtn = document.getElementById('pick-category-btn');
    const messagesError = document.getElementById('messages-error');

    let messagesData = null;
    let currentCategory = null;

    // --- EVENT LISTENERS ---

    // 1. When the "Enter" button is clicked on the welcome screen
    enterBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none'; // Hide the welcome screen
        formScreen.style.display = 'flex';   // Show the form screen
    });

    // 2. When the grievance form is submitted
    grievanceForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Stop the default form submission

        // Get the submit button and show a "sending..." state
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Sending...";

        // These are the variables we'll send to the EmailJS template
        const templateParams = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            mood: document.getElementById('mood').value,
            severity: document.getElementById('severity').value,
        };

        // Also log it to the sheet for the stats page (fire-and-forget:
        // the email goes through even if this fails)
        const logParams = new URLSearchParams({
            action: 'logGrievance',
            title: templateParams.title,
            mood: templateParams.mood,
            severity: templateParams.severity
        });
        fetch(APPS_SCRIPT_URL + '?' + logParams.toString()).catch(() => {});


        // Use EmailJS to send the email
        emailjs.send('service_t6m8a9b', 'grievance', templateParams) // ⚠️ PASTE YOUR TEMPLATE ID HERE
            .then(function(response) {
                console.log('SUCCESS!', response.status, response.text);
                
                // On success, hide the form and show the thank you screen
                formScreen.style.display = 'none';
                thanksScreen.style.display = 'flex';
                grievanceForm.reset(); // Reset the form fields
                submitBtn.disabled = false; // Re-enable the button
                submitBtn.innerHTML = "Submit ❤️"; // Reset button text

            }, function(error) {
                console.log('FAILED...', error);

                // On failure, alert the user and re-enable the form
                alert('Oops! Something went wrong and your grievance could not be sent. Please try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Submit ❤️";
            });
    });

    // 3. When the "Submit Another" button is clicked on the thank you screen
    submitAnotherBtn.addEventListener('click', () => {
        thanksScreen.style.display = 'none'; // Hide the thank you screen
        formScreen.style.display = 'flex';   // Show the form screen
    });

    // --- MUSIC WALL ---

    // 4. When the "Our Music Wall" button is clicked on the welcome screen
    musicWallBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none';
        musicWallScreen.style.display = 'flex';
        fetchSongs();
    });

    // 5. When the "Back" button is clicked on the music wall
    musicWallBackBtn.addEventListener('click', () => {
        musicWallScreen.style.display = 'none';
        welcomeScreen.style.display = 'flex';
    });

    // --- LOVE NOTES ---

    // When the "Love Notes" button is clicked on the welcome screen
    loveNotesBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none';
        messagesScreen.style.display = 'flex';
        showCategoriesView();
        fetchMessages();
    });

    // When the "Back" button is clicked on the messages screen
    messagesBackBtn.addEventListener('click', () => {
        messagesScreen.style.display = 'none';
        welcomeScreen.style.display = 'flex';
    });

    function showMessagesError(message) {
        messagesError.textContent = message;
        messagesError.style.display = 'block';
        setTimeout(() => {
            messagesError.style.display = 'none';
        }, 5000);
    }

    function showCategoriesView() {
        messageDisplay.style.display = 'none';
        categoriesArea.style.display = 'flex';
        currentCategory = null;
    }

    function fetchMessages() {
        if (messagesData) {
            renderCategories(messagesData.categories);
            return;
        }

        categoriesArea.innerHTML = '';
        categoriesLoading.textContent = 'Loading categories...';
        categoriesArea.appendChild(categoriesLoading);
        categoriesLoading.style.display = 'block';

        fetch(APPS_SCRIPT_URL + '?action=getMessages')
            .then(response => response.json())
            .then(data => {
                messagesData = data;

                if (!data.categories || data.categories.length === 0) {
                    categoriesLoading.textContent = 'No messages yet. Check back later! 💭';
                    categoriesLoading.style.display = 'block';
                    return;
                }

                renderCategories(data.categories);
            })
            .catch(error => {
                console.error('Error fetching messages:', error);
                categoriesLoading.textContent = 'Could not load messages. Please try again later.';
                categoriesLoading.style.display = 'block';
            });
    }

    function renderCategories(categories) {
        categoriesArea.innerHTML = '';

        categories.forEach((category, index) => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = category;
            btn.style.animationDelay = (index * 0.05) + 's';

            btn.addEventListener('click', () => {
                selectCategory(category);
            });

            categoriesArea.appendChild(btn);
        });
    }

    function selectCategory(category) {
        currentCategory = category;
        categoriesArea.style.display = 'none';
        messageDisplay.style.display = 'flex';
        showRandomMessage();
    }

    function showRandomMessage() {
        if (!messagesData || !currentCategory) return;

        const categoryMessages = messagesData.messages[currentCategory];
        if (!categoryMessages || categoryMessages.length === 0) {
            messageText.textContent = 'No messages in this category yet.';
            messageCategoryLabel.textContent = currentCategory;
            return;
        }

        const randomIndex = Math.floor(Math.random() * categoryMessages.length);
        messageCategoryLabel.textContent = currentCategory;
        messageText.textContent = categoryMessages[randomIndex];

        // Re-trigger the CSS animation
        const card = messageText.closest('.message-card');
        card.style.animation = 'none';
        card.offsetHeight; // force reflow
        card.style.animation = '';
    }

    anotherMessageBtn.addEventListener('click', () => {
        showRandomMessage();
    });

    pickCategoryBtn.addEventListener('click', () => {
        showCategoriesView();
    });

    // --- WORD GAME (Wordle-style) ---

    const wordGameBtn = document.getElementById('word-game-btn');
    const wordGameBackBtn = document.getElementById('word-game-back-btn');
    const wordGameLoading = document.getElementById('word-game-loading');
    const wordGameArea = document.getElementById('word-game-area');
    const wordGameHint = document.getElementById('word-game-hint');
    const gameBoard = document.getElementById('game-board');
    const wordGameStatus = document.getElementById('word-game-status');
    const gameKeyboard = document.getElementById('game-keyboard');
    const tryAgainBtn = document.getElementById('try-again-btn');
    const revealBtn = document.getElementById('reveal-btn');
    const revealConfirm = document.getElementById('reveal-confirm');
    const revealYesBtn = document.getElementById('reveal-yes-btn');
    const revealNoBtn = document.getElementById('reveal-no-btn');

    const MAX_GUESSES = 5;
    const KEY_ROWS = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
    ];

    let gameAnswer = null;      // The secret answer's letters, uppercase A-Z only
    let gameWordParts = null;   // The answer split into words, e.g. ['AURORA','BOREALIS']
    let gameStorageKey = null;  // localStorage key for the current word
    let gameState = null;       // { guesses: [], revealed: false }
    let currentGuess = '';
    let justSubmittedRow = -1;  // row to play the flip animation on
    let statusTimeout = null;

    wordGameBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none';
        wordGameScreen.style.display = 'flex';
        fetchGameWord();
    });

    wordGameBackBtn.addEventListener('click', () => {
        wordGameScreen.style.display = 'none';
        welcomeScreen.style.display = 'flex';
    });

    function fetchGameWord() {
        wordGameArea.style.display = 'none';
        wordGameLoading.textContent = 'Loading your puzzle...';
        wordGameLoading.style.display = 'block';

        fetch(APPS_SCRIPT_URL + '?action=getGameWord')
            .then(response => response.json())
            .then(data => {
                const words = (data.words || []).filter(entry => {
                    return decodeGameWord(entry.word).answer.length > 0;
                });

                if (words.length === 0) {
                    wordGameLoading.textContent = 'No secret word set yet! Tell your man to pick one 😤';
                    return;
                }

                // Resume an unfinished game; otherwise pick a random word,
                // avoiding the one she just played (like the Love Notes shuffle)
                const currentB64 = localStorage.getItem('wordGameActive');
                let chosen = null;

                const currentEntry = words.find(entry => entry.word === currentB64);
                if (currentEntry) {
                    const savedState = loadSavedState(currentB64);
                    const answer = decodeGameWord(currentB64).answer;
                    if (savedState && savedState.guesses.length > 0 &&
                        !isFinishedState(savedState, answer)) {
                        chosen = currentEntry;
                    }
                }

                if (!chosen) {
                    const pool = words.length > 1
                        ? words.filter(entry => entry.word !== currentB64)
                        : words;
                    chosen = pool[Math.floor(Math.random() * pool.length)];
                }

                const decoded = decodeGameWord(chosen.word);
                gameWordParts = decoded.parts;
                gameAnswer = decoded.answer;
                gameStorageKey = 'wordGame_' + chosen.word;
                localStorage.setItem('wordGameActive', chosen.word);

                // Forget saved progress from other words
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.indexOf('wordGame_') === 0 && key !== gameStorageKey) {
                        localStorage.removeItem(key);
                    }
                }

                gameState = loadSavedState(chosen.word) || { guesses: [], revealed: false };

                currentGuess = '';
                justSubmittedRow = -1;

                if (chosen.hint) {
                    wordGameHint.textContent = 'Hint: ' + chosen.hint;
                    wordGameHint.style.display = 'block';
                } else {
                    wordGameHint.style.display = 'none';
                }

                wordGameLoading.style.display = 'none';
                wordGameArea.style.display = 'flex';
                revealConfirm.style.display = 'none';
                renderGame();
            })
            .catch(error => {
                console.error('Error fetching game word:', error);
                wordGameLoading.textContent = 'Could not load the game. Please try again later.';
            });
    }

    // Decode a base64 word (UTF-8 safe) into letter groups + joined answer
    function decodeGameWord(b64) {
        let decoded = '';
        try {
            decoded = decodeURIComponent(escape(atob(b64))).toUpperCase();
        } catch (e) { /* bad data in the sheet, treat as empty */ }
        const parts = decoded.split(/[^A-Z]+/).filter(part => part.length > 0);
        return { parts: parts, answer: parts.join('') };
    }

    function loadSavedState(b64) {
        try {
            const parsed = JSON.parse(localStorage.getItem('wordGame_' + b64));
            if (parsed && Array.isArray(parsed.guesses)) return parsed;
        } catch (e) { /* corrupt or old-format state */ }
        return null;
    }

    function isFinishedState(state, answer) {
        return state.revealed ||
            state.guesses.indexOf(answer) !== -1 ||
            state.guesses.length >= MAX_GUESSES;
    }

    function saveGameState() {
        localStorage.setItem(gameStorageKey, JSON.stringify(gameState));
    }

    function isGameWon() {
        return gameState.guesses.indexOf(gameAnswer) !== -1;
    }

    function isGameLost() {
        return !isGameWon() && gameState.guesses.length >= MAX_GUESSES;
    }

    function isGameOver() {
        return isGameWon() || isGameLost() || gameState.revealed;
    }

    // Wordle scoring: green first, then yellows limited by remaining letter counts
    function scoreGuess(guess) {
        const result = [];
        const remaining = {};

        for (let i = 0; i < gameAnswer.length; i++) {
            if (guess[i] === gameAnswer[i]) {
                result[i] = 'correct';
            } else {
                result[i] = 'absent';
                remaining[gameAnswer[i]] = (remaining[gameAnswer[i]] || 0) + 1;
            }
        }
        for (let i = 0; i < gameAnswer.length; i++) {
            if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
                result[i] = 'present';
                remaining[guess[i]]--;
            }
        }
        return result;
    }

    function makeTile(letter, extraClass) {
        const tile = document.createElement('span');
        tile.className = 'word-tile' + (extraClass ? ' ' + extraClass : '');
        tile.textContent = letter;
        return tile;
    }

    // Builds one board row, inserting a gap column between word groups
    function buildRow(makeTileAt) {
        const rowEl = document.createElement('div');
        rowEl.className = 'board-row';
        rowEl.style.gridTemplateColumns = gameWordParts
            .map(part => 'repeat(' + part.length + ', 1fr)')
            .join(' 10px ');
        rowEl.style.width = 'min(100%, ' +
            (gameAnswer.length * 58 + (gameWordParts.length - 1) * 10) + 'px)';

        let idx = 0;
        gameWordParts.forEach((part, p) => {
            if (p > 0) {
                const gap = document.createElement('span');
                gap.className = 'board-gap';
                rowEl.appendChild(gap);
            }
            for (let i = 0; i < part.length; i++) {
                rowEl.appendChild(makeTileAt(idx));
                idx++;
            }
        });
        return rowEl;
    }

    function renderBoard() {
        const won = isGameWon();
        const lost = isGameLost();
        const revealed = gameState.revealed;
        const len = gameAnswer.length;

        gameBoard.innerHTML = '';
        gameBoard.classList.toggle('long-word', len > 7);
        gameBoard.classList.toggle('very-long', len > 10);

        // When she gives up, the answer flips into the first unused row
        const revealRow = revealed && gameState.guesses.length < MAX_GUESSES
            ? gameState.guesses.length
            : -1;

        for (let row = 0; row < MAX_GUESSES; row++) {
            let rowEl;

            if (row < gameState.guesses.length) {
                const guess = gameState.guesses[row];
                const score = scoreGuess(guess);
                rowEl = buildRow(i => {
                    const tile = makeTile(guess[i], 'tile-' + score[i] +
                        (row === justSubmittedRow ? ' tile-flip' : ''));
                    if (row === justSubmittedRow) {
                        tile.style.animationDelay = (i * 0.15) + 's';
                    }
                    return tile;
                });
            } else if (row === revealRow) {
                rowEl = buildRow(i => {
                    const tile = makeTile(gameAnswer[i], 'tile-correct tile-flip');
                    tile.style.animationDelay = (i * 0.15) + 's';
                    return tile;
                });
            } else if (row === gameState.guesses.length && !won && !lost && !revealed) {
                rowEl = buildRow(i => {
                    const ch = currentGuess[i] || '';
                    return makeTile(ch, ch ? 'tile-typed' : '');
                });
                rowEl.id = 'current-row';
            } else {
                rowEl = buildRow(() => makeTile('', ''));
            }

            gameBoard.appendChild(rowEl);
        }

        justSubmittedRow = -1;
    }

    function renderGame() {
        const won = isGameWon();
        const lost = isGameLost();
        const revealed = gameState.revealed;
        const over = won || lost || revealed;

        renderBoard();

        // Status message
        if (revealed) {
            wordGameStatus.textContent = 'It was "' + gameWordParts.join(' ') + '" 💝 You owe me a kissie for telling 😌';
        } else if (won) {
            wordGameStatus.textContent = gameState.guesses.length === 1
                ? 'FIRST TRY?! Okay genius baby 🤯💕'
                : 'YAYYY you are so smart, my baby!! 🥳😘💕';
        } else if (lost) {
            wordGameStatus.textContent = 'Out of tries 😗 The word stays secret... unless you beg 🤭';
        } else {
            wordGameStatus.textContent = '';
        }

        // Keyboard — each key wears its best result so far
        const rank = { absent: 1, present: 2, correct: 3 };
        const keyStatus = {};
        gameState.guesses.forEach(guess => {
            const score = scoreGuess(guess);
            for (let i = 0; i < guess.length; i++) {
                const letter = guess[i];
                if (!keyStatus[letter] || rank[score[i]] > rank[keyStatus[letter]]) {
                    keyStatus[letter] = score[i];
                }
            }
        });

        gameKeyboard.innerHTML = '';
        KEY_ROWS.forEach(rowKeys => {
            const rowEl = document.createElement('div');
            rowEl.className = 'keyboard-row';
            rowKeys.forEach(k => {
                const key = document.createElement('button');
                key.type = 'button';
                key.textContent = k;
                key.className = 'key-btn';
                if (k === 'ENTER' || k === '⌫') {
                    key.className += ' key-wide';
                } else if (keyStatus[k]) {
                    key.className += ' key-' + keyStatus[k];
                }
                key.disabled = over;
                key.addEventListener('click', () => handleKey(k));
                rowEl.appendChild(key);
            });
            gameKeyboard.appendChild(rowEl);
        });

        // Buttons
        tryAgainBtn.style.display = lost && !revealed ? 'block' : 'none';
        revealBtn.style.display = won || revealed || revealConfirm.style.display !== 'none'
            ? 'none'
            : 'block';
    }

    function updateCurrentRow() {
        const rowEl = document.getElementById('current-row');
        if (!rowEl) return;
        const tiles = rowEl.querySelectorAll('.word-tile');
        for (let i = 0; i < tiles.length; i++) {
            const ch = currentGuess[i] || '';
            if (tiles[i].textContent !== ch) {
                tiles[i].textContent = ch;
                tiles[i].className = 'word-tile' + (ch ? ' tile-typed' : '');
            }
        }
    }

    function flashStatus(message) {
        wordGameStatus.textContent = message;
        clearTimeout(statusTimeout);
        statusTimeout = setTimeout(() => {
            if (!isGameOver()) wordGameStatus.textContent = '';
        }, 1500);
    }

    function handleKey(k) {
        if (!gameAnswer || !gameState || isGameOver()) return;

        if (k === 'ENTER') {
            submitGuess();
            return;
        }
        if (k === '⌫') {
            currentGuess = currentGuess.slice(0, -1);
            updateCurrentRow();
            return;
        }
        if (/^[A-Z]$/.test(k) && currentGuess.length < gameAnswer.length) {
            currentGuess += k;
            updateCurrentRow();
        }
    }

    function submitGuess() {
        if (currentGuess.length !== gameAnswer.length) {
            flashStatus('Not enough letters, cutie 😗');
            const rowEl = document.getElementById('current-row');
            if (rowEl) {
                rowEl.classList.remove('row-shake');
                rowEl.offsetHeight; // restart the animation
                rowEl.classList.add('row-shake');
            }
            return;
        }

        justSubmittedRow = gameState.guesses.length;
        gameState.guesses.push(currentGuess);
        currentGuess = '';

        if (isGameWon()) {
            logGameResult('won');
        } else if (isGameLost()) {
            logGameResult('lost');
        }

        saveGameState();
        renderGame();
    }

    // Log a finished game to the sheet for the stats page (once per game).
    // Only her games count — daddy's test runs stay off the books 😎
    function logGameResult(result) {
        if (sessionStorage.getItem('portalUser') !== 'babyyy') return;
        if (!gameState || !gameStorageKey) return;
        if (result !== 'begged') {
            if (gameState.logged) return;
            gameState.logged = true;
        }

        const params = new URLSearchParams({
            action: 'logGame',
            word: gameStorageKey.slice('wordGame_'.length),
            result: result,
            guesses: gameState.guesses.length
        });
        fetch(APPS_SCRIPT_URL + '?' + params.toString()).catch(() => {});
    }

    // Physical keyboard support while the game screen is open
    document.addEventListener('keydown', (event) => {
        if (wordGameScreen.style.display === 'none') return;
        if (wordGameArea.style.display === 'none') return;
        if (!gameAnswer || !gameState) return;
        if (event.metaKey || event.ctrlKey || event.altKey) return;

        if (event.key === 'Enter') {
            if (!isGameOver()) {
                event.preventDefault();
                handleKey('ENTER');
            }
        } else if (event.key === 'Backspace') {
            handleKey('⌫');
        } else if (/^[a-zA-Z]$/.test(event.key)) {
            handleKey(event.key.toUpperCase());
        }
    });

    tryAgainBtn.addEventListener('click', () => {
        gameState = { guesses: [], revealed: false };
        currentGuess = '';
        saveGameState();
        renderGame();
    });

    revealBtn.addEventListener('click', () => {
        revealBtn.style.display = 'none';
        revealConfirm.style.display = 'flex';
    });

    revealNoBtn.addEventListener('click', () => {
        revealConfirm.style.display = 'none';
        renderGame();
    });

    revealYesBtn.addEventListener('click', () => {
        revealConfirm.style.display = 'none';
        // A beg after a loss logs 'begged' (the game already logged 'lost');
        // a mid-game beg ends the game as 'revealed'
        logGameResult(gameState.logged ? 'begged' : 'revealed');
        gameState.revealed = true;
        saveGameState();
        renderGame();
    });

    // --- STATS PAGE ---

    const statsScreen = document.getElementById('stats-screen');
    const statsBtn = document.getElementById('stats-btn');
    const statsBackBtn = document.getElementById('stats-back-btn');
    const statsLoading = document.getElementById('stats-loading');
    const statsError = document.getElementById('stats-error');
    const statsContent = document.getElementById('stats-content');
    const dramaCalendar = document.getElementById('drama-calendar');
    const moodLegend = document.getElementById('mood-legend');
    const moodTrend = document.getElementById('mood-trend');
    const gameRings = document.getElementById('game-rings');
    const gameStreak = document.getElementById('game-streak');
    const severityBars = document.getElementById('severity-bars');
    const couchCount = document.getElementById('couch-count');
    const songSplit = document.getElementById('song-split');
    const gameChips = document.getElementById('game-chips');

    // Fixed color per mood (colorblind-safe with the portal palette)
    const MOOD_SERIES = [
        ['😠 angy 😠', 'angy 😠', '#e83e8c'],
        ['🥺 baby me', 'baby me 🥺', '#5d429a'],
        ['😞 sad aara hai', 'sad aara hai 😞', '#b3831d'],
        ['💃 fun time hehehehe', 'fun time 💃', '#178f7e']
    ];

    const CALENDAR_SHADES = [
        'rgba(93, 66, 154, 0.09)',
        'rgba(93, 66, 154, 0.32)',
        'rgba(93, 66, 154, 0.62)',
        '#5d429a'
    ];

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Short labels for the long severity options, in escalating order
    const SEVERITY_LABELS = [
        ['omgg drooling over my handsome and sexy hunk boyfriend', 'drooling 😍'],
        ['A cute bournville would fix this 🥰', 'bournville fix 🥰'],
        ['I need a hug... NOW 🥺', 'need a hug 🥺'],
        ['Where my man at 😔', 'where my man 😔'],
        ["You're sleeping on the couch 😡", 'the couch 😡'],
        ['Hell hath no fury like me today 🙂', 'hell hath no fury 🙂']
    ];

    statsBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none';
        statsScreen.style.display = 'flex';
        fetchStats();
    });

    statsBackBtn.addEventListener('click', () => {
        statsScreen.style.display = 'none';
        welcomeScreen.style.display = 'flex';
    });

    function fetchStats() {
        statsContent.style.display = 'none';
        statsError.style.display = 'none';
        statsLoading.style.display = 'block';

        fetch(APPS_SCRIPT_URL + '?action=getStats')
            .then(response => response.json())
            .then(stats => {
                statsLoading.style.display = 'none';
                statsContent.style.display = 'flex';
                renderStats(stats);
            })
            .catch(error => {
                console.error('Error fetching stats:', error);
                statsLoading.style.display = 'none';
                statsError.textContent = 'Could not count our everything. Try again later 💔';
                statsError.style.display = 'block';
            });
    }

    // Animate a number counting up from 0
    function countUp(el, target) {
        const duration = 1000;
        let startTime = null;

        function tick(now) {
            if (startTime === null) startTime = now;
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function makeBarRow(label, count, maxCount) {
        const row = document.createElement('div');
        row.className = 'stat-bar-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'stat-bar-label';
        labelEl.textContent = label;
        row.appendChild(labelEl);

        const track = document.createElement('div');
        track.className = 'stat-bar-track';
        const fill = document.createElement('div');
        fill.className = 'stat-bar-fill';
        fill.style.width = '0%';
        track.appendChild(fill);
        row.appendChild(track);

        const countEl = document.createElement('span');
        countEl.className = 'stat-bar-count';
        countEl.textContent = count;
        row.appendChild(countEl);

        // Let the row hit the DOM at 0% first so the width animates
        const percent = maxCount > 0 ? (count / maxCount) * 100 : 0;
        setTimeout(() => { fill.style.width = percent + '%'; }, 50);

        return row;
    }

    function emptyNote(text) {
        const note = document.createElement('p');
        note.className = 'small-text';
        note.textContent = text;
        note.style.marginBottom = '0';
        return note;
    }

    function makeChip(value, label) {
        const chip = document.createElement('div');
        chip.className = 'game-chip';

        const valueEl = document.createElement('span');
        valueEl.className = 'game-chip-value';
        valueEl.textContent = value;
        chip.appendChild(valueEl);

        const labelEl = document.createElement('span');
        labelEl.className = 'game-chip-label';
        labelEl.textContent = label;
        chip.appendChild(labelEl);

        return chip;
    }

    function renderDramaCalendar(byDay) {
        dramaCalendar.innerHTML = '';

        const CELL = 17, GAP = 3, WEEKS = 16;
        const now = new Date();
        const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const mondayIndex = (new Date(todayUtc).getUTCDay() + 6) % 7; // Mon = 0
        const start = todayUtc - ((WEEKS - 1) * 7 + mondayIndex) * 86400000;

        let svg = '';
        ['M', 'W', 'F'].forEach((label, i) => {
            svg += '<text x="10" y="' + (14 + (i * 2) * (CELL + GAP) + CELL / 2 + 3) +
                '" font-size="9" font-weight="700" fill="#8d8797" text-anchor="middle">' + label + '</text>';
        });

        for (let w = 0; w < WEEKS; w++) {
            for (let d = 0; d < 7; d++) {
                const t = start + (w * 7 + d) * 86400000;
                if (t > todayUtc) continue;
                const key = new Date(t).toISOString().slice(0, 10);
                const count = byDay[key] || 0;
                svg += '<rect x="' + (22 + w * (CELL + GAP)) + '" y="' + (10 + d * (CELL + GAP)) +
                    '" width="' + CELL + '" height="' + CELL + '" rx="4" fill="' +
                    CALENDAR_SHADES[Math.min(count, 3)] + '"><title>' + key +
                    (count === 1 ? ': 1 grievance' : ': ' + count + ' grievances') + '</title></rect>';
            }
        }

        // less → more legend
        const legendY = 10 + 7 * (CELL + GAP) + 8;
        svg += '<text x="22" y="' + (legendY + 9) + '" font-size="9" font-weight="700" fill="#8d8797">less</text>';
        CALENDAR_SHADES.forEach((shade, i) => {
            svg += '<rect x="' + (48 + i * 15) + '" y="' + legendY + '" width="11" height="11" rx="3" fill="' + shade + '"/>';
        });
        svg += '<text x="' + (48 + 4 * 15 + 4) + '" y="' + (legendY + 9) + '" font-size="9" font-weight="700" fill="#8d8797">more</text>';

        const width = 22 + WEEKS * (CELL + GAP);
        const height = legendY + 16;
        dramaCalendar.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img">' + svg + '</svg>';
    }

    function renderMoodTrend(moodsByMonth) {
        moodLegend.innerHTML = '';
        moodTrend.innerHTML = '';

        // The last 6 months, oldest first
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
                .toISOString().slice(0, 7));
        }

        const seriesValues = MOOD_SERIES.map(series =>
            months.map(month => (moodsByMonth[month] || {})[series[0]] || 0));
        const grandTotal = seriesValues.reduce((sum, vals) =>
            sum + vals.reduce((a, b) => a + b, 0), 0);

        if (grandTotal === 0) {
            moodTrend.appendChild(emptyNote('No grievances yet. Suspicious 🤨'));
            return;
        }

        MOOD_SERIES.forEach(series => {
            const item = document.createElement('span');
            item.className = 'mood-legend-item';
            item.innerHTML = '<span class="mood-legend-dot" style="background:' + series[2] + '"></span>' + series[1];
            moodLegend.appendChild(item);
        });

        const maxVal = Math.max(3, ...seriesValues.map(vals => Math.max(...vals)));
        const x0 = 26, x1 = 366, y0 = 118, y1 = 14;
        const xAt = i => x0 + i * (x1 - x0) / (months.length - 1);
        const yAt = v => y0 - (v / maxVal) * (y0 - y1);

        let svg = '';
        [0, Math.ceil(maxVal / 2), maxVal].forEach(v => {
            svg += '<line x1="' + x0 + '" y1="' + yAt(v) + '" x2="' + x1 + '" y2="' + yAt(v) +
                '" stroke="rgba(93,66,154,0.12)" stroke-width="1"/>' +
                '<text x="' + (x0 - 6) + '" y="' + (yAt(v) + 3) +
                '" font-size="9" font-weight="700" fill="#8d8797" text-anchor="end">' + v + '</text>';
        });

        months.forEach((month, i) => {
            svg += '<text x="' + xAt(i) + '" y="132" font-size="9" font-weight="700" ' +
                'fill="#8d8797" text-anchor="middle">' +
                MONTH_NAMES[Number(month.slice(5, 7)) - 1] + '</text>';
        });

        // Soft area fills first so every line stays visible on top of them
        MOOD_SERIES.forEach((series, s) => {
            const vals = seriesValues[s];
            const path = vals.map((v, i) => (i ? 'L' : 'M') + xAt(i) + ' ' + yAt(v)).join(' ');
            svg += '<path d="' + path + ' L ' + x1 + ' ' + y0 + ' L ' + x0 + ' ' + y0 +
                ' Z" fill="' + series[2] + '" fill-opacity="0.14"/>';
        });

        MOOD_SERIES.forEach((series, s) => {
            const vals = seriesValues[s];
            const path = vals.map((v, i) => (i ? 'L' : 'M') + xAt(i) + ' ' + yAt(v)).join(' ');
            svg += '<path d="' + path + '" stroke="' + series[2] +
                '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
            vals.forEach((v, i) => {
                svg += '<circle cx="' + xAt(i) + '" cy="' + yAt(v) + '" r="3.5" fill="' + series[2] +
                    '" stroke="#fff" stroke-width="1.5"><title>' + series[1] + ' · ' +
                    months[i] + ': ' + v + '</title></circle>';
            });
        });

        moodTrend.innerHTML = '<svg viewBox="0 0 380 140" role="img">' + svg + '</svg>';
    }

    function renderGameRings(played, games) {
        gameRings.innerHTML = '';

        const begs = games.revealed + games.begged;
        const rings = [
            [64, games.won / played, '#e83e8c', 'win rate ' + Math.round(games.won / played * 100) + '%'],
            [46, games.firstTry / played, '#5d429a', 'first tries ' + Math.round(games.firstTry / played * 100) + '%'],
            [28, begs / played, '#b3831d', 'begs ' + Math.round(begs / played * 100) + '%']
        ];

        const cx = 84, cy = 80;
        let svg = '', legend = '';
        rings.forEach((ring, i) => {
            const circumference = 2 * Math.PI * ring[0];
            svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ring[0] +
                '" stroke="rgba(93,66,154,0.1)" stroke-width="13" fill="none"/>' +
                '<circle class="ring-fill" cx="' + cx + '" cy="' + cy + '" r="' + ring[0] +
                '" stroke="' + ring[2] + '" stroke-width="13" fill="none" stroke-linecap="round"' +
                ' stroke-dasharray="0 ' + circumference + '" data-target="' +
                (circumference * Math.min(ring[1], 1)) + ' ' + circumference +
                '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
            legend += '<circle cx="184" cy="' + (50 + i * 26) + '" r="5" fill="' + ring[2] + '"/>' +
                '<text x="196" y="' + (54 + i * 26) + '" font-size="12.5" font-weight="700" fill="#3a3344">' +
                ring[3] + '</text>';
        });

        gameRings.innerHTML = '<svg viewBox="0 0 380 160" role="img">' + svg + legend + '</svg>';

        // Fill the rings after they land in the DOM so the sweep animates
        setTimeout(() => {
            gameRings.querySelectorAll('.ring-fill').forEach(el => {
                el.setAttribute('stroke-dasharray', el.getAttribute('data-target'));
            });
        }, 60);
    }

    function renderGameStreak(recent) {
        gameStreak.innerHTML = '';
        if (!recent || recent.length === 0) return;

        const colorFor = { won: '#178f7e', lost: '#8d8797', revealed: '#b3831d', begged: '#b3831d' };
        let streak = 0;
        for (let i = recent.length - 1; i >= 0 && recent[i] === 'won'; i--) streak++;

        let svg = '';
        recent.forEach((result, i) => {
            const x = 22 + (i % 10) * 36;
            const y = 22 + Math.floor(i / 10) * 36;
            svg += '<circle cx="' + x + '" cy="' + y + '" r="10" fill="' + colorFor[result] + '"/>';
            if (result === 'revealed' || result === 'begged') {
                svg += '<text x="' + x + '" y="' + (y + 4) + '" font-size="10" text-anchor="middle">🥺</text>';
            }
        });

        const rows = Math.ceil(recent.length / 10);
        const legendY = 22 + rows * 36;
        svg += '<circle cx="22" cy="' + legendY + '" r="5.5" fill="#178f7e"/>' +
            '<text x="33" y="' + (legendY + 4) + '" font-size="11" font-weight="700" fill="#3a3344">win</text>' +
            '<circle cx="76" cy="' + legendY + '" r="5.5" fill="#8d8797"/>' +
            '<text x="87" y="' + (legendY + 4) + '" font-size="11" font-weight="700" fill="#3a3344">loss</text>' +
            '<circle cx="136" cy="' + legendY + '" r="5.5" fill="#b3831d"/>' +
            '<text x="147" y="' + (legendY + 4) + '" font-size="11" font-weight="700" fill="#3a3344">beg 🥺</text>';

        if (streak >= 2) {
            svg += '<text x="366" y="' + (legendY + 4) + '" font-size="11.5" font-weight="800" ' +
                'fill="#e83e8c" text-anchor="end">streak: ' + streak + ' 🔥</text>';
        }

        gameStreak.innerHTML = '<svg viewBox="0 0 380 ' + (legendY + 14) + '" role="img">' + svg + '</svg>';
    }

    function renderStats(stats) {
        const songs = stats.songs || { total: 0, contributors: [] };
        const grievances = stats.grievances || { total: 0, thisMonth: 0, moods: {}, severities: {} };
        const games = stats.games || { won: 0, lost: 0, revealed: 0, begged: 0, firstTry: 0, winGuessTotal: 0, recent: [] };

        // Hero tiles
        countUp(document.getElementById('stat-days'), inclusiveDays);
        countUp(document.getElementById('stat-grievances'), grievances.total);
        countUp(document.getElementById('stat-songs'), songs.total);
        countUp(document.getElementById('stat-wins'), games.won);

        renderDramaCalendar(grievances.byDay || {});
        renderMoodTrend(grievances.moodsByMonth || {});

        // Drama Scale — fixed escalating order so the shape tells the story
        severityBars.innerHTML = '';
        couchCount.style.display = 'none';

        if (grievances.total === 0) {
            severityBars.appendChild(emptyNote('Zero drama recorded. For now 🤭'));
        } else {
            const severityMax = Math.max.apply(null, SEVERITY_LABELS.map(
                pair => grievances.severities[pair[0]] || 0
            ));
            SEVERITY_LABELS.forEach(pair => {
                severityBars.appendChild(
                    makeBarRow(pair[1], grievances.severities[pair[0]] || 0, severityMax)
                );
            });

            const couchTotal = grievances.severities["You're sleeping on the couch 😡"] || 0;
            if (couchTotal > 0) {
                couchCount.textContent = 'Couch sentences served: ' + couchTotal + ' 🛋️😡';
                couchCount.style.display = 'block';
            }
        }

        // Music Tug-of-War
        songSplit.innerHTML = '';
        const contributors = songs.contributors || [];

        if (contributors.length === 0) {
            songSplit.appendChild(emptyNote('No songs on the wall yet 🎧'));
        } else {
            const top = contributors.slice(0, 2);
            const splitTotal = top.reduce((sum, c) => sum + c.count, 0);

            const namesRow = document.createElement('div');
            namesRow.className = 'split-names';
            top.forEach(c => {
                const nameEl = document.createElement('span');
                nameEl.textContent = c.name + ' · ' + c.count;
                namesRow.appendChild(nameEl);
            });
            songSplit.appendChild(namesRow);

            const bar = document.createElement('div');
            bar.className = 'split-bar';
            top.forEach((c, i) => {
                const seg = document.createElement('div');
                seg.className = 'split-seg split-seg-' + i;
                seg.style.width = (c.count / splitTotal) * 100 + '%';
                bar.appendChild(seg);
            });
            songSplit.appendChild(bar);
        }

        // Game Corner
        gameChips.innerHTML = '';
        gameRings.innerHTML = '';
        gameStreak.innerHTML = '';
        const played = games.won + games.lost + games.revealed;

        if (played === 0) {
            gameChips.appendChild(emptyNote('No games played yet 🍫'));
        } else {
            renderGameRings(played, games);
            renderGameStreak(games.recent || []);

            const avgGuesses = games.won > 0
                ? (games.winGuessTotal / games.won).toFixed(1)
                : '–';
            gameChips.appendChild(makeChip(played, 'played'));
            gameChips.appendChild(makeChip(avgGuesses, 'avg guesses'));
        }
    }

    // --- Apple Music URL Parser ---
    function parseAppleMusicUrl(url) {
        url = url.trim();

        // Match: https://music.apple.com/{country}/(album|playlist)/{name}/{id}[?i={trackId}]
        const appleMusicPattern = /^https?:\/\/music\.apple\.com\/([a-z]{2})\/(album|playlist)\/([^\/]+)\/([^\?\s]+)(\?i=\d+)?$/;
        const match = url.match(appleMusicPattern);

        if (!match) {
            return null;
        }

        // Convert to embed URL
        const embedUrl = url.replace('music.apple.com', 'embed.music.apple.com');

        return {
            originalUrl: url,
            embedUrl: embedUrl
        };
    }

    // --- Song Error Display ---
    function showSongError(message) {
        songError.textContent = message;
        songError.style.display = 'block';
        setTimeout(() => {
            songError.style.display = 'none';
        }, 5000);
    }

    // --- Fetch Songs from Google Sheet ---
    function fetchSongs() {
        // Show loading state
        const existingCards = songsGrid.querySelectorAll('.song-card');
        existingCards.forEach(card => card.remove());
        noSongsMsg.textContent = 'Loading songs...';
        noSongsMsg.style.display = 'block';

        fetch(APPS_SCRIPT_URL + '?action=get')
            .then(response => response.json())
            .then(songs => {
                // Clear loading state
                const cards = songsGrid.querySelectorAll('.song-card');
                cards.forEach(card => card.remove());

                if (!songs || songs.length === 0) {
                    noSongsMsg.textContent = 'No songs yet. Be the first to add one! 🎧';
                    noSongsMsg.style.display = 'block';
                    return;
                }

                noSongsMsg.style.display = 'none';

                // Songs come newest-first from the Apps Script
                songs.forEach(song => {
                    const card = createSongCard(song);
                    songsGrid.appendChild(card);
                });
            })
            .catch(error => {
                console.error('Error fetching songs:', error);
                noSongsMsg.textContent = 'Could not load songs. Please try again later.';
                noSongsMsg.style.display = 'block';
            });
    }

    // --- Create a Song Card Element ---
    function createSongCard(songData) {
        const card = document.createElement('div');
        card.className = 'song-card';

        // Apple Music embed iframe
        const iframe = document.createElement('iframe');
        iframe.src = songData.embedUrl;
        iframe.height = '175';
        iframe.frameBorder = '0';
        iframe.allow = 'autoplay *; encrypted-media *; fullscreen *; clipboard-write';
        iframe.sandbox = 'allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation';
        iframe.loading = 'lazy';
        card.appendChild(iframe);

        // Note (if present)
        if (songData.note) {
            const noteEl = document.createElement('p');
            noteEl.className = 'song-note';
            noteEl.textContent = '"' + songData.note + '"';
            card.appendChild(noteEl);
        }

        // Meta info: added by + date
        const meta = document.createElement('div');
        meta.className = 'song-meta';

        const addedByEl = document.createElement('span');
        addedByEl.textContent = 'Added by ' + songData.addedBy;
        meta.appendChild(addedByEl);

        if (songData.timestamp) {
            const dateEl = document.createElement('span');
            const date = new Date(songData.timestamp);
            dateEl.textContent = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            meta.appendChild(dateEl);
        }

        card.appendChild(meta);
        return card;
    }

    // 6. When the add song form is submitted
    addSongForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const url = songUrlInput.value;
        const addedBy = songAddedByInput.value.trim();
        const note = songNoteInput.value.trim();

        // Parse and validate the Apple Music URL
        const parsed = parseAppleMusicUrl(url);
        if (!parsed) {
            showSongError(
                "That doesn't look like an Apple Music link. Try copying the link from Apple Music (Share \u2192 Copy Link)."
            );
            return;
        }

        // Disable the form while submitting
        const submitBtn = addSongForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        // Build the request URL with query parameters
        const params = new URLSearchParams({
            action: 'add',
            url: parsed.originalUrl,
            embedUrl: parsed.embedUrl,
            addedBy: addedBy,
            note: note,
            user: sessionStorage.getItem('portalUser') || ''
        });

        fetch(APPS_SCRIPT_URL + '?' + params.toString())
            .then(response => response.json())
            .then(() => {
                // Clear the form on success
                addSongForm.reset();
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add 🎶';
                // Refresh the songs list
                fetchSongs();
            })
            .catch(error => {
                console.error('Error adding song:', error);
                showSongError("Couldn't add the song. Please try again.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add 🎶';
            });
    });


});
