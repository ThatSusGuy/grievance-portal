// --- AGREEMENT MARGIN NOTES ---
// Tap anywhere on a page of the Relationship Agreement to pin a note there.
// Notes (and replies) sync through the Apps Script backend; anything that
// can't reach it yet waits in localStorage and is sent later.
document.addEventListener('DOMContentLoaded', () => {

    const pagesEl = document.getElementById('pdf-pages');
    const countEl = document.getElementById('notes-count');
    const countLabelEl = document.getElementById('notes-count-label');
    const allBtn = document.getElementById('notes-all-btn');
    const syncEl = document.getElementById('notes-sync');
    const sheet = document.getElementById('notes-sheet');
    const sheetTitle = document.getElementById('notes-sheet-title');
    const sheetBody = document.getElementById('notes-sheet-body');
    const sheetClose = document.getElementById('notes-sheet-close');
    const backdrop = document.getElementById('notes-backdrop');

    const QUEUE_KEY = 'agreementNotesQueue';
    const POLL_MS = 45000;
    const MAX_LENGTH = 1000;
    // Notes sit in a margin beside the pages on wide screens; on phones they
    // open in a sheet from the bottom instead
    const wide = window.matchMedia('(min-width: 900px)');

    // Login usernames, as in the Users sheet
    const PEOPLE = {
        babyyy: { name: 'Kaajal', role: 'the girlfriend', tone: 'her' },
        me: { name: 'Ridit', role: 'the boyfriend', tone: 'him' }
    };

    const QUICK_NOTES = [
        'Objection! 🙋‍♀️',
        'Sustained ✅',
        'Needs an amendment 🖊️',
        'Add a Bournville clause 🍫',
        'Hmph 😤',
        'Agreed 💕'
    ];

    let serverNotes = [];
    let queue = loadQueue();
    let backendReady = null; // false once we know the backend predates notes
    let flushing = false;
    let sendFailed = false;    // the last send couldn't get through
    let retryTimer = null;
    let retryDelay = 4000;
    let pollTimer = null;
    let isOpen = false;

    const pages = {};          // page number -> { row, pageEl, layer, rail }
    const replyDrafts = {};    // thread id -> unsent reply text
    let activeId = null;
    let draft = null;          // a new note being written: { page, x, y, text }
    let sheetMode = null;      // 'thread' | 'compose' | 'list'
    let sheetThreadId = null;

    // ---------- people & helpers ----------

    function currentUser() {
        return (sessionStorage.getItem('portalUser') || '').toLowerCase();
    }

    function person(username) {
        if (PEOPLE[username]) return PEOPLE[username];
        const name = username ? username.charAt(0).toUpperCase() + username.slice(1) : 'Someone';
        return { name: name, role: 'a party to this agreement', tone: 'him' };
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function newId() {
        return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function timeAgo(iso) {
        const then = new Date(iso);
        if (isNaN(then)) return '';
        const mins = Math.floor((Date.now() - then) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + 'h ago';
        const days = Math.floor(hours / 24);
        if (days < 7) return days + 'd ago';
        return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function isTyping() {
        const a = document.activeElement;
        return !!(a && a.tagName === 'TEXTAREA' && a.closest('.note-card'));
    }

    // ---------- the offline queue ----------

    function loadQueue() {
        try {
            const saved = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (err) {
            return [];
        }
    }

    function saveQueue() {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (err) { /* private mode: the queue just lives in memory */ }
    }

    // Server notes, plus queued adds, minus queued deletes
    function allNotes() {
        const deleted = new Set(queue.filter(op => op.type === 'delete').map(op => op.id));
        const byId = new Map();
        serverNotes.forEach(n => byId.set(n.id, Object.assign({}, n)));
        queue.forEach(op => {
            if (op.type === 'add' && !byId.has(op.note.id)) {
                byId.set(op.note.id, Object.assign({ pending: true }, op.note));
            }
        });
        return Array.from(byId.values())
            .filter(n => !deleted.has(n.id) && !deleted.has(n.parentId));
    }

    function threads() {
        const notes = allNotes();
        const byTime = (a, b) => String(a.timestamp).localeCompare(String(b.timestamp));
        return notes
            .filter(n => !n.parentId)
            .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
            .map(root => Object.assign(root, {
                replies: notes.filter(n => n.parentId === root.id).sort(byTime)
            }));
    }

    function findThread(id) {
        return threads().find(t => t.id === id) || null;
    }

    // ---------- talking to Apps Script ----------

    function post(body) {
        // text/plain keeps this a "simple" request, so no CORS preflight
        return fetch(window.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        })
            .then(response => response.text())
            .then(text => {
                try {
                    return JSON.parse(text);
                } catch (err) {
                    return { status: 'error', code: /doPost/.test(text) ? 'old_backend' : 'unreachable' };
                }
            }, () => ({ status: 'error', code: 'unreachable' }));
    }

    function fetchNotes() {
        return fetch(window.APPS_SCRIPT_URL + '?action=getAgreementNotes')
            .then(response => response.json())
            .then(result => {
                if (result && result.status === 'success' && Array.isArray(result.notes)) {
                    backendReady = true;
                    serverNotes = result.notes;
                } else {
                    // A backend from before notes existed answers with the song list
                    backendReady = false;
                }
            })
            .catch(() => {});
    }

    // Send queued changes in order; stop at the first one that can't get through
    async function flushQueue() {
        if (flushing || !queue.length || !window.APPS_SCRIPT_URL) return;
        flushing = true;
        try {
            while (queue.length) {
                const op = queue[0];
                const result = op.type === 'add'
                    ? await post(Object.assign({ action: 'addAgreementNote' }, op.note))
                    : await post({ action: 'deleteAgreementNote', id: op.id, author: op.author });

                if (result.status === 'success') {
                    backendReady = true;
                    sendFailed = false;
                    retryDelay = 4000;
                    if (op.type === 'add') {
                        const saved = result.note || op.note;
                        serverNotes = serverNotes.filter(n => n.id !== saved.id).concat([saved]);
                        // Deleted while it was on its way up: delete it there too
                        if (!queue.includes(op)) queue.push({ type: 'delete', id: saved.id, author: saved.author });
                    } else {
                        serverNotes = serverNotes.filter(n => n.id !== op.id && n.parentId !== op.id);
                    }
                } else if (['unreachable', 'old_backend', 'unknown_action', 'busy'].includes(result.code)) {
                    if (result.code === 'old_backend' || result.code === 'unknown_action') backendReady = false;
                    sendFailed = true;
                    scheduleRetry();
                    break; // try again later
                }
                // Anything else was rejected for good (e.g. the note is already gone)
                queue = queue.filter(q => q !== op);
                saveQueue();
            }
        } finally {
            flushing = false;
        }
    }

    // A hiccup shouldn't leave a note waiting for the next poll: retry
    // soon, backing off up to 30s
    function scheduleRetry() {
        if (!isOpen || retryTimer || backendReady === false) return;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            flushQueue().then(afterSync);
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
    }

    async function refresh() {
        await flushQueue();
        await fetchNotes();
        afterSync();
    }

    // Re-render after a sync, unless that would yank away a half-typed
    // reply; then just update the "not sent yet" labels in place
    function afterSync() {
        if (!isTyping()) {
            render();
            return;
        }
        updateToolbar();
        const stillQueued = new Set(queue.filter(op => op.type === 'add').map(op => op.note.id));
        document.querySelectorAll('.note.pending[data-note-id], .note-pin.pending[data-id]').forEach(node => {
            const id = node.dataset.noteId || node.dataset.id;
            if (stillQueued.has(id)) return;
            node.classList.remove('pending');
            const meta = node.querySelector('.note-meta');
            if (meta) meta.textContent = meta.textContent.replace(/(not sent yet · retrying|saved on this device)$/, 'just now');
        });
    }

    function addNote(fields) {
        const note = Object.assign({
            id: newId(),
            parentId: '',
            page: 0,
            x: 0,
            y: 0,
            author: currentUser(),
            timestamp: new Date().toISOString()
        }, fields);
        note.text = note.text.slice(0, MAX_LENGTH);
        queue.push({ type: 'add', note: note });
        saveQueue();
        flushQueue().then(afterSync);
        return note;
    }

    function deleteNote(note) {
        const isQueued = queue.some(op => op.type === 'add' && op.note.id === note.id);
        if (isQueued) {
            // Never left this device: just forget it (and any replies to it)
            queue = queue.filter(op => !(op.type === 'add' &&
                (op.note.id === note.id || op.note.parentId === note.id)));
        } else {
            queue.push({ type: 'delete', id: note.id, author: currentUser() });
        }
        saveQueue();

        if (!note.parentId) {
            if (activeId === note.id) activeId = null;
            if (sheetMode === 'thread' && sheetThreadId === note.id) closeSheet();
        }
        render();
        flushQueue().then(afterSync);
    }

    // ---------- pages ----------

    function attachPage(n, row) {
        const pageEl = row.querySelector('.agreement-page');
        const layer = el('div', 'note-layer');
        const rail = el('div', 'note-rail');
        pageEl.appendChild(layer);
        row.appendChild(rail);
        pages[n] = { row: row, pageEl: pageEl, layer: layer, rail: rail };

        pageEl.addEventListener('click', event => {
            if (event.target.closest('.note-pin')) return;
            const rect = pageEl.getBoundingClientRect();
            const clamp = v => Math.min(0.97, Math.max(0.03, v));
            startDraft(n,
                clamp((event.clientX - rect.left) / rect.width),
                clamp((event.clientY - rect.top) / rect.height));
        });

        renderPage(n, threads());
    }

    function startDraft(page, x, y) {
        draft = { page: page, x: x, y: y, text: draft ? draft.text : '' };
        activeId = null;
        render();
        if (wide.matches) {
            focusComposer(pages[page].rail);
        } else {
            openSheet('compose');
        }
    }

    function focusComposer(container) {
        const box = container.querySelector('.note-composer textarea');
        if (!box) return;
        box.focus({ preventScroll: true });
        box.setSelectionRange(box.value.length, box.value.length);
    }

    // ---------- rendering ----------

    function render() {
        const all = threads();
        Object.keys(pages).forEach(n => renderPage(Number(n), all));
        updateToolbar(all);
        if (sheetMode === 'thread' || sheetMode === 'list') renderSheet();
    }

    function renderPage(n, all) {
        const p = pages[n];
        if (!p) return;
        const onPage = all.filter(t => t.page === n);

        p.layer.innerHTML = '';
        onPage.forEach(t => p.layer.appendChild(buildPin(t)));
        if (draft && draft.page === n) p.layer.appendChild(buildDraftPin());

        p.rail.innerHTML = '';
        if (!wide.matches) return;
        onPage.forEach(t => {
            const card = buildThreadCard(t);
            card.dataset.y = t.y;
            p.rail.appendChild(card);
        });
        if (draft && draft.page === n) {
            const composer = buildComposer();
            composer.dataset.y = draft.y;
            p.rail.appendChild(composer);
        }
        if (n === 1 && !all.length && !draft) {
            p.rail.appendChild(el('p', 'rail-hint', 'Your notes will live here, right beside the clause they’re about ✍️'));
        }
        layoutRail(n);
    }

    // Cards line up with their pins, nudged down so they never overlap
    function layoutRail(n) {
        const p = pages[n];
        if (!p || !wide.matches) return;
        const height = p.pageEl.clientHeight;
        let floor = 0;
        Array.from(p.rail.children)
            .filter(card => card.dataset.y !== undefined)
            .sort((a, b) => a.dataset.y - b.dataset.y)
            .forEach(card => {
                const top = Math.max(Math.max(0, card.dataset.y * height - 22), floor);
                card.style.top = top + 'px';
                floor = top + card.offsetHeight + 12;
            });
        p.rail.style.minHeight = floor + 'px';
    }

    function layoutAllRails() {
        Object.keys(pages).forEach(n => layoutRail(Number(n)));
    }

    function avatar(username) {
        const who = person(username);
        const a = el('span', 'note-avatar tone-' + who.tone, who.name.charAt(0));
        a.setAttribute('aria-hidden', 'true');
        return a;
    }

    function buildPin(thread) {
        const who = person(thread.author);
        const pin = el('button', 'note-pin tone-' + who.tone);
        pin.type = 'button';
        pin.dataset.id = thread.id;
        pin.style.left = (thread.x * 100) + '%';
        pin.style.top = (thread.y * 100) + '%';
        if (thread.id === activeId) pin.classList.add('active');
        if (thread.pending && sendFailed) pin.classList.add('pending');
        pin.setAttribute('aria-label', 'Note from ' + who.name + ': ' + thread.text);
        pin.appendChild(el('span', 'note-pin-face', who.name.charAt(0)));
        if (thread.replies.length) {
            pin.appendChild(el('span', 'note-pin-count', String(thread.replies.length + 1)));
        }
        pin.addEventListener('click', event => {
            event.stopPropagation();
            setActive(thread.id, 'pin');
        });
        return pin;
    }

    function buildDraftPin() {
        const pin = el('span', 'note-pin draft tone-' + person(currentUser()).tone);
        pin.style.left = (draft.x * 100) + '%';
        pin.style.top = (draft.y * 100) + '%';
        pin.appendChild(el('span', 'note-pin-face', '+'));
        return pin;
    }

    function buildNote(note, isRoot) {
        const who = person(note.author);
        const wrap = el('div', isRoot ? 'note' : 'note note-reply');
        wrap.dataset.noteId = note.id;

        const head = el('div', 'note-head');
        head.appendChild(avatar(note.author));
        const meta = el('div', 'note-who');
        meta.appendChild(el('span', 'note-name', who.name));
        // Notes show as sent straight away; only a failed send gets a label
        const stuck = note.pending && sendFailed;
        let when = timeAgo(note.timestamp);
        if (stuck) when = backendReady === false ? 'saved on this device' : 'not sent yet · retrying';
        meta.appendChild(el('span', 'note-meta', (isRoot ? who.role + ' · ' : '') + when));
        head.appendChild(meta);
        if (note.author === currentUser()) head.appendChild(buildDeleteButton(note));

        wrap.appendChild(head);
        wrap.appendChild(el('p', 'note-text', note.text));
        if (stuck) wrap.classList.add('pending');
        return wrap;
    }

    function buildDeleteButton(note) {
        const btn = el('button', 'note-delete', '🗑');
        btn.type = 'button';
        btn.title = 'Delete';
        let timer = null;
        btn.addEventListener('click', event => {
            event.stopPropagation();
            if (!btn.classList.contains('confirm')) {
                btn.classList.add('confirm');
                btn.textContent = 'Delete?';
                timer = setTimeout(() => {
                    btn.classList.remove('confirm');
                    btn.textContent = '🗑';
                }, 3000);
                return;
            }
            clearTimeout(timer);
            deleteNote(note);
        });
        return btn;
    }

    function buildThreadCard(thread) {
        const card = el('div', 'note-card tone-' + person(thread.author).tone);
        card.dataset.id = thread.id;
        if (thread.id === activeId) card.classList.add('active');

        card.appendChild(buildNote(thread, true));

        if (thread.replies.length) {
            const replies = el('div', 'note-replies');
            thread.replies.forEach(r => replies.appendChild(buildNote(r, false)));
            card.appendChild(replies);
        }

        card.appendChild(buildReplyBox(thread));
        card.addEventListener('click', event => {
            if (event.target.closest('button, textarea')) return;
            setActive(thread.id, 'card');
        });
        return card;
    }

    function autoGrow(box) {
        box.style.height = 'auto';
        box.style.height = box.scrollHeight + 'px';
    }

    function buildReplyBox(thread) {
        const form = el('form', 'note-reply-box');
        const box = el('textarea');
        box.rows = 1;
        box.maxLength = MAX_LENGTH;
        box.placeholder = 'Reply…';
        box.setAttribute('enterkeyhint', 'send');
        box.value = replyDrafts[thread.id] || '';
        const send = el('button', 'note-send', '↑');
        send.type = 'submit';
        send.setAttribute('aria-label', 'Send reply');
        form.appendChild(box);
        form.appendChild(send);

        box.addEventListener('input', () => {
            replyDrafts[thread.id] = box.value;
            autoGrow(box);
            layoutAllRails();
        });
        box.addEventListener('focus', () => setActive(thread.id, 'reply'));
        box.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (form.requestSubmit) form.requestSubmit();
                else send.click();
            }
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const text = box.value.trim();
            if (!text) return;
            delete replyDrafts[thread.id];
            addNote({ parentId: thread.id, page: thread.page, text: text });
            render();
            // Keep the conversation going: put the cursor back in the reply box
            const container = sheetMode === 'thread' ? sheetBody : pagesEl;
            const again = container.querySelector('.note-card[data-id="' + thread.id + '"] .note-reply-box textarea');
            if (again) again.focus({ preventScroll: true });
        });
        requestAnimationFrame(() => autoGrow(box));
        return form;
    }

    function buildComposer() {
        const card = el('div', 'note-card note-composer tone-' + person(currentUser()).tone);

        const head = el('div', 'note-head');
        head.appendChild(avatar(currentUser()));
        const meta = el('div', 'note-who');
        meta.appendChild(el('span', 'note-name', 'New note'));
        meta.appendChild(el('span', 'note-meta', 'Page ' + draft.page));
        head.appendChild(meta);
        card.appendChild(head);

        const box = el('textarea');
        box.rows = 3;
        box.maxLength = MAX_LENGTH;
        box.placeholder = 'What does the girlfriend have to say about this clause?';
        if (person(currentUser()).tone === 'him') box.placeholder = 'Add a note to this clause…';
        box.value = draft.text;
        card.appendChild(box);

        const chips = el('div', 'note-chips');
        QUICK_NOTES.forEach(text => {
            const chip = el('button', 'note-chip', text);
            chip.type = 'button';
            chip.addEventListener('click', () => {
                box.value = box.value.trim() ? box.value.trimEnd() + ' ' + text : text;
                draft.text = box.value;
                box.focus();
                autoGrow(box);
                layoutAllRails();
            });
            chips.appendChild(chip);
        });
        card.appendChild(chips);

        const actions = el('div', 'note-actions');
        const cancel = el('button', 'note-cancel', 'Cancel');
        cancel.type = 'button';
        const save = el('button', 'note-post', 'Post note 💌');
        save.type = 'button';
        actions.appendChild(cancel);
        actions.appendChild(save);
        card.appendChild(actions);

        const syncSave = () => { save.disabled = !box.value.trim(); };
        syncSave();
        box.addEventListener('input', () => {
            draft.text = box.value;
            syncSave();
            autoGrow(box);
            layoutAllRails();
        });
        box.addEventListener('keydown', event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save.click();
        });
        cancel.addEventListener('click', cancelDraft);
        save.addEventListener('click', () => {
            const text = box.value.trim();
            if (!text) return;
            const note = addNote({ page: draft.page, x: draft.x, y: draft.y, text: text });
            draft = null;
            if (sheetMode === 'compose') closeSheet();
            activeId = note.id;
            render();
            flashPin(note.id);
        });
        requestAnimationFrame(() => autoGrow(box));
        return card;
    }

    function cancelDraft() {
        draft = null;
        if (sheetMode === 'compose') closeSheet();
        render();
    }

    function updateToolbar(all) {
        const list = all || threads();
        countEl.textContent = list.length;
        countLabelEl.textContent = list.length === 1 ? 'note' : 'notes';

        let status = '';
        if (queue.length && sendFailed) {
            status = backendReady === false ? '💾 Saved on this device' : '⏳ Retrying…';
        }
        syncEl.textContent = status;
        syncEl.style.display = status ? 'inline-flex' : 'none';
    }

    // ---------- focus & navigation ----------

    function setActive(id, source) {
        activeId = id;
        // Focusing a reply box must not re-render it out from under the cursor
        if (draft && source !== 'reply') {
            draft = null;
            render();
        }
        document.querySelectorAll('.note-pin[data-id], .note-rail .note-card[data-id]').forEach(node => {
            node.classList.toggle('active', node.dataset.id === id);
        });

        if (!wide.matches) {
            if (source === 'pin' || source === 'list') openSheet('thread', id);
            return;
        }
        if (source === 'pin') {
            const card = pagesEl.querySelector('.note-rail .note-card[data-id="' + id + '"]');
            if (card) scrollIntoPages(card.offsetTop + card.parentNode.parentNode.offsetTop, card.offsetHeight);
        } else if (source === 'list') {
            flashPin(id);
        }
    }

    function scrollIntoPages(top, height) {
        const view = pagesEl.scrollTop;
        if (top >= view && top + height <= view + pagesEl.clientHeight) return;
        pagesEl.scrollTo({ top: Math.max(0, top - pagesEl.clientHeight / 3), behavior: 'smooth' });
    }

    function flashPin(id) {
        const thread = findThread(id);
        const p = thread && pages[thread.page];
        if (!p) return;
        scrollIntoPages(p.row.offsetTop + thread.y * p.pageEl.clientHeight, 40);
        const pin = p.layer.querySelector('.note-pin[data-id="' + id + '"]');
        if (!pin) return;
        pin.classList.remove('flash');
        void pin.offsetWidth; // restart the animation
        pin.classList.add('flash');
    }

    // ---------- the sheet ----------

    function openSheet(mode, id) {
        sheetMode = mode;
        sheetThreadId = id || null;
        renderSheet();
        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');
        if (mode === 'compose') {
            // After the slide-up, so phones scroll the keyboard into place
            setTimeout(() => focusComposer(sheetBody), 260);
        }
    }

    function closeSheet() {
        if (!sheetMode) return;
        const wasCompose = sheetMode === 'compose';
        sheetMode = null;
        sheetThreadId = null;
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
        if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
        if (wasCompose && draft) {
            draft = null;
            render();
        }
    }

    function renderSheet() {
        sheetBody.innerHTML = '';
        if (sheetMode === 'compose' && draft) {
            sheetTitle.textContent = 'Leave a note ✍️';
            sheetBody.appendChild(buildComposer());
        } else if (sheetMode === 'thread') {
            const thread = findThread(sheetThreadId);
            if (!thread) {
                closeSheet();
                return;
            }
            sheetTitle.textContent = 'On page ' + thread.page;
            sheetBody.appendChild(buildThreadCard(thread));
        } else if (sheetMode === 'list') {
            renderList();
        }
    }

    function renderList() {
        const all = threads();
        sheetTitle.textContent = 'All notes 💬';
        if (!all.length) {
            const empty = el('div', 'notes-empty');
            empty.appendChild(el('p', 'notes-empty-big', 'No notes yet'));
            empty.appendChild(el('p', 'notes-empty-small', 'Tap anywhere on a page and tell the boyfriend exactly what you think of that clause.'));
            sheetBody.appendChild(empty);
            return;
        }
        let lastPage = null;
        all.forEach(thread => {
            if (thread.page !== lastPage) {
                sheetBody.appendChild(el('p', 'notes-list-page', 'Page ' + thread.page));
                lastPage = thread.page;
            }
            const who = person(thread.author);
            const item = el('button', 'notes-list-item tone-' + who.tone);
            item.type = 'button';
            item.appendChild(avatar(thread.author));
            const text = el('span', 'notes-list-text');
            text.appendChild(el('span', 'notes-list-name', who.name));
            text.appendChild(el('span', 'notes-list-snippet', thread.text));
            const n = thread.replies.length;
            text.appendChild(el('span', 'notes-list-meta',
                (n ? n + (n === 1 ? ' reply' : ' replies') + ' · ' : '') + timeAgo(thread.timestamp)));
            item.appendChild(text);
            item.addEventListener('click', () => {
                closeSheet();
                setActive(thread.id, 'list');
                if (!wide.matches) setTimeout(() => flashPin(thread.id), 200);
            });
            sheetBody.appendChild(item);
        });
    }

    allBtn.addEventListener('click', () => openSheet('list'));
    sheetClose.addEventListener('click', closeSheet);
    backdrop.addEventListener('click', closeSheet);

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !isOpen) return;
        if (sheetMode) {
            closeSheet();
        } else if (draft) {
            cancelDraft();
        } else if (activeId) {
            activeId = null;
            render();
        }
    });

    wide.addEventListener('change', () => {
        if (sheetMode === 'thread' || sheetMode === 'compose') {
            const keepDraft = draft;
            closeSheet();
            draft = keepDraft;
        }
        render();
    });

    if (window.ResizeObserver) {
        new ResizeObserver(() => layoutAllRails()).observe(pagesEl);
    }

    // ---------- lifecycle ----------

    function open() {
        isOpen = true;
        render();
        refresh();
        clearInterval(pollTimer);
        // Pick up the other person's notes and replies while reading
        pollTimer = setInterval(() => {
            if (!document.hidden) refresh();
        }, POLL_MS);
    }

    function close() {
        isOpen = false;
        clearInterval(pollTimer);
        clearTimeout(retryTimer);
        retryTimer = null;
        closeSheet();
        draft = null;
        activeId = null;
    }

    window.agreementNotes = { attachPage: attachPage, open: open, close: close };
});
