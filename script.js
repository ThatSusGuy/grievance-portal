// Wait for the entire page to load before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Initialize EmailJS with your Public Key
    (function(){
        emailjs.init("PoB9fcQiaekD1g8OI"); // ⚠️ PASTE YOUR PUBLIC KEY HERE
    })();

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

    // Get references to all the elements we need to work with
    const welcomeScreen = document.getElementById('welcome-screen');
    const formScreen = document.getElementById('form-screen');
    const thanksScreen = document.getElementById('thanks-screen');

    const enterBtn = document.getElementById('enter-btn');
    const grievanceForm = document.getElementById('grievance-form');
    const submitAnotherBtn = document.getElementById('submit-another-btn');

    // --- Google Sheets Apps Script URL ---
    // Replace this with your deployed Apps Script web app URL
    const APPS_SCRIPT_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_URL';

    // Music Wall references
    const musicWallScreen = document.getElementById('music-wall-screen');
    const musicWallBtn = document.getElementById('music-wall-btn');
    const musicWallBackBtn = document.getElementById('music-wall-back-btn');
    const addSongForm = document.getElementById('add-song-form');
    const songUrlInput = document.getElementById('song-url');
    const songAddedByInput = document.getElementById('song-added-by');
    const songNoteInput = document.getElementById('song-note');
    const songsGrid = document.getElementById('songs-grid');
    const noSongsMsg = document.getElementById('no-songs-msg');
    const songError = document.getElementById('song-error');

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
            note: note
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