// Pocket Ridit: a text adventure narrated by Gemini (through the Apps
// Script backend) and acted out by a pixel-art Ridit drawn entirely in code.
document.addEventListener('DOMContentLoaded', () => {

    const screen = document.getElementById('pocket-ridit-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    const openBtn = document.getElementById('pocket-ridit-btn');
    const backBtn = document.getElementById('pocket-back-btn');
    const canvas = document.getElementById('pocket-canvas');
    const speechEl = document.getElementById('pocket-speech');
    const logEl = document.getElementById('pocket-log');
    const suggestionsEl = document.getElementById('pocket-suggestions');
    const form = document.getElementById('pocket-form');
    const input = document.getElementById('pocket-input');
    const sendBtn = document.getElementById('pocket-send-btn');
    const restartBtn = document.getElementById('pocket-restart-btn');

    // Keep in sync with ADVENTURE_ANIMATIONS / ADVENTURE_LOCATIONS in apps-script.js
    const ANIMATIONS = ['sleeping', 'waking', 'idle', 'talking', 'walking', 'eating',
        'happy', 'love', 'angry', 'sad', 'scared', 'confused', 'dancing', 'couch',
        'fainting', 'sneaky', 'phone',
        'showering', 'toilet', 'brushing', 'cooking', 'cleaning', 'working', 'gaming',
        'reading', 'singing', 'guitar', 'exercising', 'running', 'waving', 'kissing',
        'proposing', 'flowers', 'gift', 'crying', 'laughing', 'blushing', 'thinking',
        'shocked', 'sulking', 'begging', 'apologizing', 'shrugging', 'facepalm', 'hiding',
        'sick', 'sleepy', 'selfie', 'flexing', 'shivering', 'swimming'];
    const LOCATIONS = ['bedroom', 'kitchen', 'living_room', 'outside', 'cafe',
        'bathroom', 'shower', 'beach', 'gym', 'office', 'cinema', 'supermarket',
        'rooftop', 'party', 'car'];

    // =====================================================================
    // Pixel engine
    // =====================================================================

    const W = 128, H = 88, GROUND = 80, FPS = 12;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Ridit is drawn upright onto his own little canvas, then stamped onto
    // the scene (rotated 90° when lying down, which keeps pixels crisp)
    const sprite = document.createElement('canvas');
    sprite.width = 40;
    sprite.height = 50;
    const sctx = sprite.getContext('2d');
    const SOX = 20, SOY = 48; // sprite origin: between his feet

    // Ridit's head, traced from his photos: messy near-black hair with a
    // fringe swept across his forehead, very thick brows, ears tucked under
    // the hair, a broad nose, and a patchy moustache and chin stubble.
    // Column c is x = c - 9; row r is HEAD_TOP + r. Eyes, brows and mouth
    // are drawn on top so they can change with his mood.
    // H hair, h hair highlight, S skin, n nose shade, E ear, B stubble
    const HEAD = [
        '......HH.H........',
        '....HHHHHHHHH.....',
        '..HHHHHHHHHHHHH...',
        '.HHHHhHHHHHHHHHH..',
        '.HHHHHHHHHHHhHHHH.',
        'HHHHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHSSHHHH',
        '.HHHHHHHHHSSSSSHHH',
        '.HHHHHHHSSSSSSSSHH',
        '.HHHSSSSSSSSSSSSHH',
        '.HHSSSSSSSSSSSSSHH',
        '.ESSSSSSSSSSSSSSE.',
        '.ESSSSSSSSSSSSSSE.',
        '.ESSSSSSSSSSSSSSE.',
        '.ESSSSSSnnSSSSSSE.',
        '..SSSSSnSSnSSSSS..',
        '..BSSSBBBBBBSSSB..',
        '..BSSSSSSSSSSSSB..',
        '...BSSSSSSSSSSB...',
        '....BBBBBBBBBB....',
        '.....BBBBBBBB.....'
    ];
    const HEAD_TOP = -40; // relative to his feet; the chin sits on the collar

    const C = {
        skin: '#c28763', skinShade: '#a46c4c', hair: '#151112', hairLight: '#2e2523',
        stubble: '#94664c', lip: '#b06a72', lipDark: '#7a3f45',
        hoodie: '#1e1e22', hoodieShade: '#141417', collar: '#2c2c32',
        pants: '#cbbda4', pantsShade: '#b3a68e',
        shoe: '#f4f4f4', eye: '#1a1210', white: '#f4ece4',
        blush: '#ef7f9c', heart: '#e8344e', angry: '#d9483b',
        wrapper: '#4b1f5c', gold: '#d4a63a', choc: '#5a3420'
    };

    const GLYPHS = {
        heart: ['##.##', '#####', '.###.', '..#..'],
        tinyHeart: ['#.#', '###', '.#.'],
        x: ['#.#', '.#.', '#.#'],
        z: ['####', '..#.', '.#..', '####'],
        note: ['..##', '..#.', '..#.', '###.', '##..'],
        question: ['.##.', '#..#', '..#.', '.#..', '....', '.#..'],
        exclaim: ['#', '#', '#', '.', '#'],
        star: ['.#.', '###', '.#.'],
        drop: ['.#.', '###', '###', '.#.'],
        anger: ['##.##', '#...#', '.....', '#...#', '##.##'],
        sparkle: ['..#..', '.....', '#.#.#', '.....', '..#..'],
        bubble: ['#####', '#####', '.#...'],
        ha: ['#.#.###', '#.#.#.#', '###.###', '#.#.#.#', '#.#.#.#'],
        scribble: ['.##.#', '#..##', '.###.', '##..#', '#.##.'],
        flake: ['#.#', '.#.', '#.#']
    };

    function rect(c, x, y, w, h, color) {
        c.fillStyle = color;
        c.fillRect(Math.round(x), Math.round(y), w, h);
    }

    function glyph(c, name, x, y, color) {
        const rows = GLYPHS[name];
        c.fillStyle = color;
        for (let r = 0; r < rows.length; r++) {
            for (let col = 0; col < rows[r].length; col++) {
                if (rows[r][col] === '#') c.fillRect(Math.round(x) + col, Math.round(y) + r, 1, 1);
            }
        }
    }

    // ---- Ridit himself -------------------------------------------------

    // Hand positions relative to his feet (before the upper-body offset)
    const HANDS = {
        down: [[-8, -11], [6, -11]],
        up: [[-12, -36], [10, -36]],
        out: [[-12, -17], [10, -17]],
        chest: [[-3, -14], [1, -14]],
        hips: [[-10, -14], [8, -14]],
        phone: [[-3, -15], [1, -15]],
        gesture: [[-8, -11], [10, -22]],
        scratch: [[-10, -37], [6, -11]],
        eat: [[-8, -11], [3, -21]],
        sneak: [[-3, -14], [1, -15]],
        danceA: [[-12, -36], [6, -11]],
        danceB: [[-8, -11], [10, -36]],
        swingA: [[-9, -12], [5, -11]],
        swingB: [[-7, -11], [7, -12]],
        hold: [[-4, -15], [2, -15]],
        brush: [[-8, -11], [4, -22]],
        pan: [[-8, -11], [9, -16]],
        panUp: [[-8, -11], [9, -20]],
        broom: [[2, -17], [4, -12]],
        type: [[-4, -13], [2, -13]],
        mic: [[-8, -11], [3, -21]],
        guitar: [[-5, -12], [3, -15]],
        strum: [[-5, -12], [3, -12]],
        liftUp: [[-12, -34], [10, -34]],
        liftDown: [[-12, -21], [10, -21]],
        runA: [[-11, -14], [9, -21]],
        runB: [[-11, -21], [9, -14]],
        wave1: [[-8, -11], [11, -31]],
        wave2: [[-8, -11], [13, -27]],
        kiss: [[-8, -11], [2, -22]],
        blow: [[-8, -11], [12, -24]],
        offer: [[-8, -11], [11, -18]],
        pray: [[-2, -17], [0, -17]],
        chin: [[-3, -14], [2, -20]],
        shrug: [[-13, -18], [11, -18]],
        shrugLow: [[-12, -14], [10, -14]],
        cross: [[3, -15], [-5, -14]],
        face: [[-8, -11], [-1, -28]],
        selfie: [[-11, -30], [11, -35]],
        flex: [[-13, -29], [11, -29]],
        swimA: [[-12, -34], [10, -20]],
        swimB: [[-12, -20], [10, -34]]
    };

    function defaultPose() {
        return {
            eyes: 'open', brows: null, mouth: 'smile', blush: false, tint: 0,
            arms: 'down', legs: 'stand', bob: 0, look: 0, item: null, bite: 0,
            screenOn: true
        };
    }

    function drawRidit(pose) {
        const s = sctx;
        s.clearRect(0, 0, sprite.width, sprite.height);
        const up = pose.bob + (pose.legs === 'sit' ? 4 : 0);
        const p = (x, y, w, h, color) => rect(s, SOX + x, SOY + y, w, h, color);

        // Legs (beige trousers) and white shoes
        const legs = pose.legs;
        if (legs === 'sit') {
            p(-5, -4, 4, 3, C.pants); p(1, -4, 4, 3, C.pants);
            p(-6, -1, 5, 1, C.shoe); p(1, -1, 5, 1, C.shoe);
        } else {
            const liftL = legs === 'walkA' ? 1 : legs === 'runA' ? 3 : 0;
            const liftR = legs === 'walkB' ? 1 : legs === 'runB' ? 3 : 0;
            p(-5, -8, 4, 7 - liftL, C.pants);
            p(1, -8, 4, 7 - liftR, C.pants);
            p(-2, -8, 1, 7 - liftL, C.pantsShade); p(4, -8, 1, 7 - liftR, C.pantsShade);
            if (legs === 'tiptoe') {
                p(-4, -1 - liftL, 3, 1, C.shoe); p(2, -1 - liftR, 3, 1, C.shoe);
            } else {
                p(-6, -1 - liftL, 5, 1, C.shoe); p(1, -1 - liftR, 5, 1, C.shoe);
            }
        }

        // Black tee
        const B = -19 + up;
        p(-6, B, 12, 11, C.hoodie);
        p(-6, B + 10, 12, 1, C.hoodieShade);
        p(-3, B, 6, 1, C.collar);

        // Arms: a short black sleeve, then bare arm down to the hand
        const hands = HANDS[pose.arms] || HANDS.down;
        [[-7, hands[0]], [6, hands[1]]].forEach(([sx, hand]) => {
            const sy = B + 1, hx = hand[0], hy = hand[1] + up;
            const steps = Math.max(Math.abs(hx - sx), Math.abs(hy - sy), 1);
            for (let i = 0; i < steps; i++) {
                const color = i < Math.max(2, steps * 0.35) ? C.hoodie : C.skin;
                p(sx + Math.round((hx - sx) * i / steps), sy + Math.round((hy - sy) * i / steps), 2, 2, color);
            }
            p(hx, hy, 2, 2, C.skin);
        });

        // Head
        const T = HEAD_TOP + up;
        const f = (col, row, w, h, color) => p(col - 9, T + row, w, h, color);
        const HEAD_COLORS = { H: C.hair, h: C.hairLight, S: C.skin, n: C.skinShade, E: C.skinShade, B: C.stubble };
        HEAD.forEach((row, r) => {
            for (let col = 0; col < row.length; col++) {
                if (row[col] !== '.') f(col, r, 1, 1, HEAD_COLORS[row[col]]);
            }
        });

        if (pose.tint > 0) {
            s.globalAlpha = Math.min(1, pose.tint);
            f(2, 8, 14, 11, pose.tintColor || C.angry);
            s.globalAlpha = 1;
        }

        // Very thick brows, which carry most of his expressions
        switch (pose.brows) {
            case 'angry':
                f(3, 9, 2, 1, C.hair); f(5, 10, 2, 1, C.hair); f(7, 11, 1, 1, C.hair);
                f(13, 9, 2, 1, C.hair); f(11, 10, 2, 1, C.hair); f(10, 11, 1, 1, C.hair); break;
            case 'sad':
                f(3, 10, 2, 1, C.hair); f(5, 9, 3, 1, C.hair);
                f(10, 9, 3, 1, C.hair); f(13, 10, 2, 1, C.hair); break;
            case 'up':
                f(3, 8, 5, 2, C.hair); f(10, 8, 5, 2, C.hair); break;
            default:
                f(4, 9, 3, 1, C.hair); f(3, 10, 5, 1, C.hair);
                f(11, 9, 3, 1, C.hair); f(10, 10, 5, 1, C.hair);
        }

        // Eyes: left eye is columns 4-6, right eye 11-13
        const look = pose.look;
        [4, 11].forEach(ex => {
            switch (pose.eyes) {
                case 'closed':
                    f(ex, 13, 3, 1, C.eye); break;
                case 'half':
                    f(ex, 12, 3, 1, C.skinShade); f(ex, 13, 3, 1, C.eye); break;
                case 'happy':
                    f(ex, 13, 1, 1, C.eye); f(ex + 1, 12, 1, 1, C.eye); f(ex + 2, 13, 1, 1, C.eye); break;
                case 'heart':
                    glyph(s, 'tinyHeart', SOX + ex - 9, SOY + T + 11, C.heart); break;
                case 'x':
                    glyph(s, 'x', SOX + ex - 9, SOY + T + 11, C.eye); break;
                case 'wide':
                    f(ex, 11, 3, 1, C.eye); f(ex, 12, 3, 2, C.white); f(ex + 1, 12, 1, 2, C.eye); break;
                case 'down':
                    f(ex, 12, 3, 1, C.eye); f(ex + 1, 13, 1, 1, C.eye); break;
                case 'sparkle':
                    // big puppy eyes
                    f(ex, 12, 3, 2, C.eye); f(ex, 12, 1, 1, C.white); break;
                case 'up':
                    f(ex, 11, 3, 1, C.eye); f(ex, 12, 3, 2, C.white); f(ex + 1, 12, 1, 1, C.eye); break;
                case 'squint':
                    if (ex === 4) { f(ex, 13, 3, 1, C.eye); break; }
                    f(ex, 12, 3, 1, C.eye); f(ex, 13, 3, 1, C.white); f(ex + 1, 13, 1, 1, C.eye); break;
                default:
                    // heavy upper lid, white, dark iris
                    f(ex, 12, 3, 1, C.eye);
                    f(ex, 13, 3, 1, C.white);
                    f(ex + 1 + look, 13, 1, 1, C.eye);
            }
        });

        if (pose.blush) {
            f(3, 14, 2, 1, C.blush); f(13, 14, 2, 1, C.blush);
        }

        // Full lips: the mouth spans columns 6-11, rows 16-18
        switch (pose.mouth) {
            case 'big':
                f(6, 17, 6, 1, C.lipDark); f(7, 17, 4, 1, C.white); f(7, 18, 4, 1, C.lipDark); break;
            case 'flat':
                f(7, 17, 4, 1, C.lipDark); f(8, 18, 2, 1, C.lip); break;
            case 'frown':
                f(7, 17, 4, 1, C.lipDark); f(6, 18, 1, 1, C.lipDark); f(11, 18, 1, 1, C.lipDark);
                f(7, 18, 4, 1, C.lip); break;
            case 'o':
                f(7, 17, 4, 2, C.lip); f(8, 17, 2, 2, C.lipDark); break;
            case 'open':
                f(7, 17, 4, 2, C.lipDark); f(7, 18, 4, 1, C.lip); break;
            case 'chew':
                f(7, 17, 4, 1, C.lip); f(7, 18, 4, 1, C.lipDark); break;
            case 'wavy':
                f(7, 17, 1, 1, C.lipDark); f(8, 18, 1, 1, C.lipDark);
                f(9, 17, 1, 1, C.lipDark); f(10, 18, 1, 1, C.lipDark); break;
            case 'jaw':
                f(7, 16, 4, 4, C.lipDark); f(8, 17, 2, 2, '#3a1d20'); break;
            case 'pout':
                // the kissy face
                f(7, 16, 4, 3, C.lip); f(8, 17, 2, 1, C.lipDark); break;
            default:
                // his easy smile with a full lower lip
                f(6, 16, 1, 1, C.lipDark); f(11, 16, 1, 1, C.lipDark);
                f(7, 17, 4, 1, C.lipDark); f(7, 18, 4, 1, C.lip);
        }

        // Things he's holding
        const rx = hands[1][0], ry = hands[1][1] + up;
        switch (pose.item) {
            case 'bournville': {
                const choc = Math.max(0, 2 - pose.bite);
                p(rx + 1, ry - 3, 3, 4, C.wrapper);
                p(rx + 1, ry - 2, 3, 1, C.gold);
                if (choc > 0) p(rx + 1, ry - 3 - choc, 3, choc, C.choc);
                break;
            }
            case 'phone':
                p(-2, -19 + up, 4, 5, '#333');
                p(-1, -18 + up, 2, 3, pose.screenOn ? '#8fe3ff' : '#4d7f99');
                p(-3, -15 + up, 2, 2, C.skin); p(1, -15 + up, 2, 2, C.skin);
                break;
            case 'toothbrush':
                p(rx - 3, ry, 5, 1, '#4aa3ff'); p(rx - 4, ry - 1, 2, 1, C.white);
                break;
            case 'pan':
                p(rx + 2, ry, 4, 1, '#333'); p(rx + 5, ry - 1, 7, 2, '#2b2b2b'); p(rx + 7, ry - 2, 3, 1, '#f2c94c');
                break;
            case 'broom':
                for (let i = 0; i < 16; i++) p(rx + Math.round(i * 0.25), ry - 6 + i, 1, 1, '#8a5a3c');
                p(rx + 2, -3, 6, 3, '#e3b94c'); p(rx + 2, -1, 6, 1, '#c99a2e');
                break;
            case 'laptop':
                p(-8, -12 + up, 16, 1, '#9aa1a8'); p(-7, -21 + up, 14, 9, '#c0c6cc');
                p(-1, -18 + up, 2, 2, '#e83e8c');
                break;
            case 'controller':
                p(-6, -17 + up, 12, 4, '#3a3a40'); p(-5, -16 + up, 2, 1, '#888');
                p(3, -16 + up, 1, 1, '#e83e8c'); p(4, -15 + up, 1, 1, '#4aa3ff');
                break;
            case 'book':
                p(-7, -20 + up, 14, 7, '#e83e8c'); p(-6, -19 + up, 12, 5, C.white); p(0, -19 + up, 1, 5, '#d8c8d0');
                p(-5, -18 + up, 4, 1, '#aaa'); p(2, -17 + up, 3, 1, '#aaa');
                break;
            case 'mic':
                p(rx, ry - 3, 2, 3, '#555'); p(rx - 1, ry - 5, 4, 2, '#aaa');
                break;
            case 'guitar':
                p(-7, -15 + up, 9, 7, '#c8762e'); p(-6, -16 + up, 7, 1, '#c8762e'); p(-4, -13 + up, 2, 2, '#5a3420');
                p(2, -13 + up, 10, 1, '#6b4430'); p(11, -14 + up, 2, 3, '#6b4430');
                break;
            case 'dumbbell':
                hands.forEach(([hx, hy0]) => {
                    const hy = hy0 + up;
                    p(hx - 2, hy, 6, 1, '#888'); p(hx - 3, hy - 1, 2, 3, '#222'); p(hx + 3, hy - 1, 2, 3, '#222');
                });
                break;
            case 'ring':
                p(rx + 1, ry - 3, 4, 3, '#e83e8c'); p(rx + 1, ry - 4, 4, 1, '#c22a72'); p(rx + 2, ry - 5, 2, 1, C.gold);
                break;
            case 'flowers':
                // red roses, like the bouquet in their photo
                p(-3, -14 + up, 6, 3, '#f4ece4'); p(-1, -16 + up, 1, 3, '#3c8d40'); p(1, -16 + up, 1, 3, '#3c8d40');
                p(-5, -21 + up, 3, 3, '#d81e3a'); p(-2, -22 + up, 3, 3, '#e8344e'); p(1, -21 + up, 3, 3, '#d81e3a');
                p(-3, -19 + up, 3, 3, '#e8344e'); p(0, -19 + up, 3, 3, '#c41a33');
                p(-6, -18 + up, 2, 2, '#3c8d40'); p(4, -18 + up, 2, 2, '#3c8d40');
                break;
            case 'gift':
                p(-5, -20 + up, 10, 7, '#5d9cec'); p(-1, -20 + up, 2, 7, '#ffd84a'); p(-5, -17 + up, 10, 1, '#ffd84a');
                p(-3, -22 + up, 2, 2, '#ffd84a'); p(1, -22 + up, 2, 2, '#ffd84a');
                break;
            case 'thermometer':
                p(1, -22 + up, 6, 1, C.white); p(6, -22 + up, 1, 1, '#e8344e');
                break;
            case 'selfie':
                p(rx, ry - 4, 3, 5, '#333'); p(rx + 1, ry - 3, 1, 1, '#8fe3ff');
                p(hands[0][0], hands[0][1] + up - 2, 1, 2, C.skin); p(hands[0][0] + 2, hands[0][1] + up - 2, 1, 2, C.skin);
                break;
            case 'muscle':
                p(-12, -25 + up, 3, 3, C.skin); p(9, -25 + up, 3, 3, C.skin);
                break;
        }
    }

    // ---- Rooms ----------------------------------------------------------

    function floor(color, lineColor) {
        rect(ctx, 0, 66, W, 22, color);
        for (let y = 72; y < H; y += 7) rect(ctx, 0, y, W, 1, lineColor);
    }

    function cloud(x, y) {
        rect(ctx, x + 2, y, 8, 3, '#ffffff');
        rect(ctx, x, y + 2, 14, 3, '#ffffff');
        rect(ctx, x + 5, y - 1, 4, 2, '#ffffff');
    }

    const ROOMS = {
        bedroom(t) {
            rect(ctx, 0, 0, W, 66, '#f6dce8');
            for (let y = 4; y < 62; y += 8) {
                for (let x = (y % 16 === 4 ? 4 : 0); x < W; x += 8) rect(ctx, x, y, 1, 1, '#ecc3d6');
            }
            rect(ctx, 0, 64, W, 2, '#d9a9bf');
            floor('#c99a72', '#b4855f');
            // window with a drifting cloud
            rect(ctx, 80, 10, 30, 24, '#ffffff');
            rect(ctx, 82, 12, 26, 20, '#9fd6ff');
            ctx.save();
            ctx.beginPath(); ctx.rect(82, 12, 26, 20); ctx.clip();
            cloud(82 + ((t * 3) % 44) - 14, 17);
            ctx.restore();
            rect(ctx, 94, 12, 2, 20, '#ffffff'); rect(ctx, 82, 21, 26, 2, '#ffffff');
            rect(ctx, 76, 8, 5, 30, '#e83e8c'); rect(ctx, 109, 8, 5, 30, '#e83e8c');
            rect(ctx, 75, 7, 40, 2, '#8a5a3c');
            // heart poster
            rect(ctx, 50, 14, 15, 13, '#5d429a'); rect(ctx, 51, 15, 13, 11, '#ffffff');
            glyph(ctx, 'heart', 55, 18, C.heart);
            // bed
            rect(ctx, 4, 48, 6, 26, '#8a5a3c');
            rect(ctx, 4, 68, 52, 5, '#8a5a3c');
            rect(ctx, 52, 68, 4, 8, '#6b4430'); rect(ctx, 6, 72, 4, 4, '#6b4430');
            rect(ctx, 9, 62, 46, 7, '#ffffff');
            rect(ctx, 11, 57, 14, 6, '#fdf3f7'); rect(ctx, 11, 62, 14, 1, '#e8c8d8');
            // nightstand and lamp
            rect(ctx, 58, 62, 11, 12, '#a8714d'); rect(ctx, 59, 66, 9, 1, '#8a5a3c');
            rect(ctx, 62, 56, 2, 6, '#8a5a3c'); rect(ctx, 59, 51, 8, 5, '#ffd36b');
        },
        bedroomFront() {
            // the blanket goes over whoever is in bed
            rect(ctx, 28, 61, 28, 8, '#e86a9a');
            rect(ctx, 28, 61, 28, 2, '#f39bbd');
        },

        kitchen(t) {
            rect(ctx, 0, 0, W, 66, '#e9f3f1');
            for (let y = 30; y < 54; y += 6) rect(ctx, 0, y, W, 1, '#d3e6e2');
            for (let x = 0; x < W; x += 6) rect(ctx, x, 30, 1, 24, '#d3e6e2');
            // cabinets
            rect(ctx, 4, 4, 42, 18, '#7fb5a8');
            rect(ctx, 24, 4, 1, 18, '#6a9e92'); rect(ctx, 21, 12, 2, 3, '#e9f3f1'); rect(ctx, 27, 12, 2, 3, '#e9f3f1');
            // the top shelf, with the Bournville on it
            rect(ctx, 66, 20, 50, 2, '#8a5a3c');
            rect(ctx, 70, 12, 6, 8, '#f2c94c'); rect(ctx, 79, 14, 6, 6, '#e07a5f');
            rect(ctx, 104, 13, 9, 7, C.wrapper); rect(ctx, 104, 15, 9, 1, C.gold);
            if (Math.floor(t * 2) % 4 === 0) glyph(ctx, 'sparkle', 111, 8, '#ffffff');
            // fridge
            rect(ctx, 4, 28, 20, 50, '#f4f7f8');
            rect(ctx, 4, 28, 20, 1, '#c5d0d4'); rect(ctx, 4, 46, 20, 1, '#c5d0d4');
            rect(ctx, 20, 34, 2, 8, '#aab6bb'); rect(ctx, 20, 52, 2, 10, '#aab6bb');
            glyph(ctx, 'tinyHeart', 9, 36, C.heart);
            // counter, stove and a steaming pot
            rect(ctx, 28, 54, 100, 3, '#9aa7ad');
            rect(ctx, 28, 57, 100, 13, '#7fb5a8');
            for (let x = 40; x < W; x += 22) rect(ctx, x, 60, 2, 3, '#e9f3f1');
            rect(ctx, 60, 50, 18, 4, '#333');
            rect(ctx, 62, 44, 14, 7, '#c0c6cc'); rect(ctx, 60, 44, 18, 1, '#9aa1a8');
            for (let i = 0; i < 2; i++) {
                const ph = (t * 0.7 + i / 2) % 1;
                ctx.globalAlpha = 1 - ph;
                rect(ctx, 66 + i * 4 + Math.round(Math.sin(ph * 6) * 1), 40 - ph * 14, 3, 2, '#ffffff');
                ctx.globalAlpha = 1;
            }
            // checker floor
            for (let y = 66; y < H; y += 6) {
                for (let x = 0; x < W; x += 6) {
                    rect(ctx, x, y, 6, 6, ((x + y) / 6) % 2 ? '#d9c8b4' : '#f1e7da');
                }
            }
        },

        living_room(t) {
            rect(ctx, 0, 0, W, 66, '#e4dbf5');
            rect(ctx, 0, 64, W, 2, '#c3b3e3');
            floor('#b68a68', '#a3785a');
            rect(ctx, 16, 76, 96, 9, '#e893b9'); rect(ctx, 18, 78, 92, 5, '#f0aecb');
            // picture frame
            rect(ctx, 10, 12, 20, 15, '#8a5a3c'); rect(ctx, 12, 14, 16, 11, '#9fd6ff');
            rect(ctx, 12, 21, 16, 4, '#6cc070'); rect(ctx, 22, 16, 3, 3, '#ffd84a');
            // floor lamp
            rect(ctx, 6, 40, 2, 34, '#555'); rect(ctx, 2, 34, 10, 7, '#ffd36b'); rect(ctx, 3, 73, 8, 2, '#555');
            // TV with flickering show
            rect(ctx, 96, 60, 28, 10, '#6b4a3a');
            rect(ctx, 98, 38, 24, 20, '#1d1d24');
            rect(ctx, 100, 40, 20, 16, '#3a4a7a');
            for (let y = 40; y < 56; y += 3) {
                if ((Math.floor(t * 8) + y) % 5 === 0) rect(ctx, 100, y, 20, 1, '#5b6fa8');
            }
            rect(ctx, 108, 58, 4, 2, '#1d1d24');
            // the couch
            rect(ctx, 30, 52, 46, 14, '#8e5fb0');
            rect(ctx, 30, 52, 46, 2, '#a476c4');
            rect(ctx, 52, 54, 1, 12, '#7a4f9c');
            rect(ctx, 26, 64, 54, 9, '#7a4f9c');
            rect(ctx, 22, 58, 8, 16, '#6b438a'); rect(ctx, 76, 58, 8, 16, '#6b438a');
            rect(ctx, 26, 73, 3, 4, '#4a2f60'); rect(ctx, 77, 73, 3, 4, '#4a2f60');
        },

        outside(t) {
            rect(ctx, 0, 0, W, 22, '#8ccfff');
            rect(ctx, 0, 22, W, 20, '#a8dbff');
            rect(ctx, 0, 42, W, 20, '#c7e8ff');
            rect(ctx, 100, 8, 10, 10, '#ffd84a'); rect(ctx, 98, 10, 14, 6, '#ffd84a');
            cloud(((t * 4) % 170) - 20, 10);
            cloud(((t * 2.5 + 80) % 170) - 20, 24);
            for (let x = 0; x < W; x += 16) rect(ctx, x, 54, 16, 10, x % 32 ? '#8fd18a' : '#9bd896');
            rect(ctx, 0, 60, W, 28, '#6cc070');
            for (let x = 3; x < W; x += 7) rect(ctx, x, 62 + (x % 3) * 7, 1, 2, '#58a85c');
            // path
            for (let y = 64; y < H; y++) {
                const half = 8 + Math.round((y - 64) * 0.6);
                rect(ctx, 64 - half, y, half * 2, 1, '#e3cfa6');
            }
            // tree
            rect(ctx, 12, 40, 6, 32, '#7a4e2d');
            rect(ctx, 2, 22, 26, 20, '#4f9e52'); rect(ctx, 6, 16, 18, 8, '#4f9e52');
            rect(ctx, 6, 26, 4, 3, '#5fb862'); rect(ctx, 18, 20, 4, 3, '#5fb862');
            // flowers
            [[30, 74], [100, 70], [110, 82], [20, 84], [92, 84]].forEach(([x, y], i) => {
                rect(ctx, x, y, 2, 2, i % 2 ? '#ff8fb8' : '#ffd84a');
            });
        },

        cafe(t) {
            rect(ctx, 0, 0, W, 66, '#f3dfc4');
            rect(ctx, 0, 48, W, 18, '#c99a72'); rect(ctx, 0, 48, W, 2, '#a8714d');
            for (let y = 66; y < H; y += 6) {
                for (let x = 0; x < W; x += 6) {
                    rect(ctx, x, y, 6, 6, ((x + y) / 6) % 2 ? '#8a5a3c' : '#9c6b4a');
                }
            }
            // menu board
            rect(ctx, 6, 8, 38, 26, '#8a5a3c'); rect(ctx, 8, 10, 34, 22, '#2f4a3a');
            for (let y = 14; y < 30; y += 4) rect(ctx, 11, y, 18 + (y % 8), 1, '#dfe8dc');
            glyph(ctx, 'tinyHeart', 36, 26, '#ff8fb8');
            // window with awning
            rect(ctx, 84, 12, 36, 28, '#ffffff'); rect(ctx, 86, 14, 32, 24, '#bfe4ff');
            rect(ctx, 101, 14, 2, 24, '#ffffff');
            for (let x = 82; x < 122; x += 8) {
                rect(ctx, x, 6, 4, 6, '#e83e8c'); rect(ctx, x + 4, 6, 4, 6, '#ffffff');
            }
            // hanging lamp, swaying a touch
            const sway = Math.round(Math.sin(t * 1.5));
            rect(ctx, 62, 0, 1, 12, '#555');
            rect(ctx, 58 + sway, 12, 10, 4, '#e8a33c'); rect(ctx, 61 + sway, 16, 4, 1, '#fff3c4');
            // table with two drinks and cake
            rect(ctx, 70, 62, 42, 4, '#6b4430'); rect(ctx, 89, 66, 4, 12, '#6b4430'); rect(ctx, 83, 78, 16, 2, '#6b4430');
            rect(ctx, 75, 56, 6, 6, '#ffffff'); rect(ctx, 76, 56, 4, 1, '#6b3d1f');
            rect(ctx, 100, 56, 6, 6, '#ffb6d0'); rect(ctx, 101, 56, 4, 1, '#ffffff');
            rect(ctx, 88, 58, 7, 4, '#fff1d6'); rect(ctx, 88, 58, 7, 1, '#e83e8c');
        },

        bathroom(t) {
            rect(ctx, 0, 0, W, 66, '#dff1f7');
            for (let y = 6; y < 64; y += 7) rect(ctx, 0, y, W, 1, '#c7e3ec');
            for (let x = 0; x < W; x += 7) rect(ctx, x, 0, 1, 64, '#c7e3ec');
            for (let y = 66; y < H; y += 6) {
                for (let x = 0; x < W; x += 6) rect(ctx, x, y, 6, 6, ((x + y) / 6) % 2 ? '#e9eef1' : '#ffffff');
            }
            // mirror and sink
            rect(ctx, 70, 8, 26, 24, '#aab6bb'); rect(ctx, 72, 10, 22, 20, '#e8f6fb');
            rect(ctx, 76, 13, 6, 1, '#ffffff'); rect(ctx, 74, 15, 4, 1, '#ffffff');
            rect(ctx, 70, 44, 26, 5, '#ffffff'); rect(ctx, 70, 44, 26, 1, '#c9d3d8');
            rect(ctx, 79, 49, 8, 17, '#f4f7f8'); rect(ctx, 81, 40, 4, 4, '#aab6bb');
            // toilet with a roll of paper
            rect(ctx, 28, 46, 16, 20, '#ffffff'); rect(ctx, 27, 45, 18, 2, '#e3eaed'); rect(ctx, 40, 50, 2, 1, '#aab6bb');
            rect(ctx, 26, 66, 20, 5, '#f4f7f8'); rect(ctx, 26, 66, 20, 1, '#c9d3d8');
            rect(ctx, 30, 71, 12, 7, '#ffffff'); rect(ctx, 30, 77, 12, 1, '#c9d3d8');
            rect(ctx, 50, 52, 5, 6, '#ffffff'); rect(ctx, 49, 51, 7, 1, '#aab6bb');
            // towel and a rubber duck
            rect(ctx, 104, 30, 2, 2, '#aab6bb'); rect(ctx, 102, 32, 14, 18, '#f39bbd'); rect(ctx, 102, 46, 14, 2, '#e83e8c');
            rect(ctx, 88, 41, 4, 3, '#ffd84a'); rect(ctx, 91, 40, 2, 2, '#ffd84a'); rect(ctx, 93, 41, 1, 1, '#ff9f43');
        },
        toiletFront() {
            // the bowl's rim in front of him, so he's clearly sitting on it
            rect(ctx, 25, 70, 22, 3, '#ffffff'); rect(ctx, 25, 72, 22, 1, '#c9d3d8');
            rect(ctx, 29, 73, 14, 5, '#f4f7f8'); rect(ctx, 29, 77, 14, 1, '#c9d3d8');
        },
        shower(t) {
            rect(ctx, 0, 0, W, 70, '#e8f4f8');
            for (let y = 4; y < 70; y += 8) {
                for (let x = (y % 16 === 4 ? 0 : 4); x < W; x += 8) rect(ctx, x, y, 7, 7, '#d6ebf2');
            }
            rect(ctx, 0, 70, W, 18, '#c9d8de'); rect(ctx, 0, 70, W, 1, '#aab6bb');
            rect(ctx, 60, 80, 8, 2, '#8a979c');
            // pipe and shower head
            rect(ctx, 63, 0, 2, 12, '#aab6bb'); rect(ctx, 58, 12, 12, 3, '#c0c6cc'); rect(ctx, 59, 15, 10, 1, '#8a979c');
            // curtain rod and the bunched-up end of the curtain
            rect(ctx, 14, 6, 100, 2, '#aab6bb');
            for (let x = 14; x < 28; x += 3) rect(ctx, x, 8, 2, 70, x % 2 ? '#f39bbd' : '#e86a9a');
            // soap shelf
            rect(ctx, 100, 40, 14, 2, '#aab6bb'); rect(ctx, 102, 34, 4, 6, '#9fd6ff'); rect(ctx, 108, 36, 4, 4, '#ffd84a');
            // steam
            for (let i = 0; i < 3; i++) {
                const ph = (t * 0.3 + i / 3) % 1;
                ctx.globalAlpha = 0.5 * (1 - ph);
                rect(ctx, 36 + i * 22 + Math.sin(ph * 6) * 3, 30 - ph * 20, 10, 4, '#ffffff');
                ctx.globalAlpha = 1;
            }
        },
        showerFront(t) {
            // the drawn curtain, so only his head pokes out
            for (let x = 30; x < 100; x += 4) {
                rect(ctx, x, 58, 2, 28, '#f39bbd');
                rect(ctx, x + 2, 58, 2, 28, '#e86a9a');
            }
            for (let x = 30; x < 100; x += 6) rect(ctx, x + 1, 59, 2, 2, '#ffffff');
            rect(ctx, 30, 84, 70, 2, '#d1557f');
        },

        beach(t) {
            rect(ctx, 0, 0, W, 24, '#7fc8ff'); rect(ctx, 0, 24, W, 20, '#a8dbff');
            rect(ctx, 98, 8, 12, 12, '#ffd84a'); rect(ctx, 96, 11, 16, 6, '#ffd84a');
            cloud(((t * 3) % 170) - 20, 12);
            rect(ctx, 0, 44, W, 18, '#3fa3d9');
            for (let i = 0; i < 6; i++) {
                const x = ((i * 26 + t * 8) % 150) - 12;
                rect(ctx, x, 48 + (i % 3) * 4, 8, 1, '#bfe8ff');
            }
            rect(ctx, 0, 60, W, 3, '#e9f7ff');
            rect(ctx, 0, 62, W, 26, '#f2d59a');
            for (let x = 4; x < W; x += 9) rect(ctx, x, 68 + (x % 4) * 4, 1, 1, '#d9b877');
            // umbrella, towel, shell
            rect(ctx, 20, 40, 2, 34, '#8a5a3c');
            for (let i = 0; i < 6; i++) rect(ctx, 6 + i * 5, 36 + Math.abs(2.5 - i), 5, 5, i % 2 ? '#ffffff' : '#e8344e');
            rect(ctx, 26, 76, 22, 6, '#5d9cec'); rect(ctx, 26, 78, 22, 1, '#ffffff');
            rect(ctx, 108, 80, 4, 3, '#ffb6d0');
        },
        seaFront(t) {
            // swimming: the sea fills the foreground up to his shoulders
            rect(ctx, 0, 58, W, 30, '#3fa3d9');
            for (let i = 0; i < 8; i++) {
                const x = ((i * 19 + t * 10) % 150) - 12;
                rect(ctx, x, 58 + (i % 4) * 7, 9, 1, '#bfe8ff');
            }
            for (let x = 0; x < W; x += 6) rect(ctx, x + (Math.floor(t * 4) % 2) * 3, 57, 3, 1, '#ffffff');
        },

        gym(t) {
            rect(ctx, 0, 0, W, 66, '#d9dde3');
            rect(ctx, 0, 40, W, 2, '#e83e8c');
            rect(ctx, 0, 66, W, 22, '#3f444c');
            for (let x = 0; x < W; x += 16) rect(ctx, x, 66, 1, 22, '#353a41');
            // mirror wall
            rect(ctx, 30, 6, 60, 30, '#aab6bb'); rect(ctx, 32, 8, 56, 26, '#eef4f7');
            rect(ctx, 40, 12, 10, 1, '#ffffff'); rect(ctx, 36, 15, 6, 1, '#ffffff');
            // poster
            rect(ctx, 6, 10, 18, 22, '#1e1e22'); rect(ctx, 9, 14, 12, 2, '#ffd84a'); rect(ctx, 9, 19, 9, 2, '#ffffff'); rect(ctx, 9, 24, 11, 2, '#e83e8c');
            // dumbbell rack
            rect(ctx, 4, 50, 30, 3, '#555'); rect(ctx, 6, 53, 2, 13, '#555'); rect(ctx, 30, 53, 2, 13, '#555');
            for (let i = 0; i < 4; i++) { rect(ctx, 6 + i * 7, 46, 2, 4, '#222'); rect(ctx, 10 + i * 7, 46, 2, 4, '#222'); rect(ctx, 8 + i * 7, 47, 2, 2, '#888'); }
            // treadmill
            rect(ctx, 96, 70, 30, 6, '#222'); rect(ctx, 98, 68, 26, 2, '#555');
            rect(ctx, 120, 44, 3, 26, '#555'); rect(ctx, 112, 42, 14, 6, '#333'); rect(ctx, 114, 44, 6, 2, Math.floor(t * 2) % 2 ? '#4cd964' : '#2e8b4a');
        },

        office(t) {
            rect(ctx, 0, 0, W, 66, '#efe6d8');
            rect(ctx, 0, 66, W, 22, '#7d8a99');
            for (let y = 70; y < H; y += 6) rect(ctx, 0, y, W, 1, '#73808e');
            // window with the city
            rect(ctx, 6, 8, 40, 30, '#ffffff'); rect(ctx, 8, 10, 36, 26, '#9fd6ff');
            [[8, 20, 8], [17, 14, 7], [25, 22, 9], [35, 17, 9]].forEach(([x, y, w]) => {
                rect(ctx, x, y, w, 36 - y, '#6c7a8c');
                for (let wy = y + 2; wy < 34; wy += 4) rect(ctx, x + 2, wy, 2, 2, '#ffe9a8');
            });
            rect(ctx, 25, 10, 2, 26, '#ffffff');
            // clock
            rect(ctx, 60, 8, 10, 10, '#ffffff'); rect(ctx, 60, 8, 10, 1, '#555'); rect(ctx, 64, 10, 1, 4, '#333');
            rect(ctx, 64, 13, 1 + Math.floor(t) % 3, 1, '#e83e8c');
            // desk, monitor, mug, plant
            rect(ctx, 80, 52, 46, 3, '#8a5a3c'); rect(ctx, 82, 55, 3, 14, '#6b4430'); rect(ctx, 120, 55, 3, 14, '#6b4430');
            rect(ctx, 90, 34, 22, 16, '#222'); rect(ctx, 92, 36, 18, 12, '#3a6ea5');
            for (let y = 38; y < 47; y += 3) rect(ctx, 94, y, 6 + ((y + Math.floor(t * 2)) % 7), 1, '#9fd6ff');
            rect(ctx, 99, 50, 4, 2, '#222');
            rect(ctx, 114, 47, 4, 5, '#ffffff'); rect(ctx, 118, 48, 1, 2, '#ffffff');
            rect(ctx, 54, 54, 8, 12, '#c8762e'); rect(ctx, 52, 44, 12, 10, '#4f9e52'); rect(ctx, 56, 40, 4, 4, '#5fb862');
        },

        cinema(t) {
            rect(ctx, 0, 0, W, H, '#1b1626');
            // screen with a flickering film
            rect(ctx, 6, 4, 116, 34, '#2b2238');
            const hue = ['#5b6fa8', '#a85b8f', '#5ba88a', '#a8935b'][Math.floor(t / 1.5) % 4];
            rect(ctx, 8, 6, 112, 30, hue);
            for (let y = 6; y < 36; y += 4) if ((Math.floor(t * 10) + y) % 7 === 0) rect(ctx, 8, y, 112, 1, '#ffffff');
            rect(ctx, 50, 18, 8, 10, '#1b1626'); rect(ctx, 70, 16, 8, 12, '#1b1626');
            // projector beam
            ctx.globalAlpha = 0.08;
            for (let i = 0; i < 12; i++) rect(ctx, 64 - i * 5, 36 + i * 3, 10 + i * 10, 3, '#ffffff');
            ctx.globalAlpha = 1;
            // a row of seats behind him and the aisle lights
            for (let x = 2; x < W; x += 14) {
                rect(ctx, x, 54, 12, 10, '#a3203a'); rect(ctx, x, 54, 12, 2, '#c43150'); rect(ctx, x + 1, 64, 10, 3, '#7a1830');
            }
            rect(ctx, 0, 67, W, 21, '#140f1c');
            for (let x = 4; x < W; x += 12) rect(ctx, x, 86, 2, 1, '#ffd84a');
        },

        supermarket(t) {
            rect(ctx, 0, 0, W, 66, '#f4f6f8');
            rect(ctx, 0, 0, W, 6, '#e83e8c');
            for (let x = 4; x < W; x += 30) rect(ctx, x, 1, 20, 4, '#ffffff');
            for (let y = 66; y < H; y += 8) {
                for (let x = 0; x < W; x += 8) rect(ctx, x, y, 8, 8, ((x + y) / 8) % 2 ? '#dfe3e6' : '#eceff1');
            }
            // shelves stacked with products, one shelf of Bournville
            const colors = ['#e07a5f', '#f2c94c', '#5d9cec', '#4cd964', '#ff8fb8', '#9b6bd1'];
            rect(ctx, 4, 12, 120, 54, '#c9d3d8');
            [20, 36, 52].forEach((y, row) => {
                rect(ctx, 4, y + 10, 120, 2, '#8a979c');
                for (let x = 6; x < 122; x += 6) {
                    const choc = row === 1 && x > 60 && x < 100;
                    rect(ctx, x, y + (x % 4 ? 3 : 1), 5, x % 4 ? 7 : 9, choc ? C.wrapper : colors[(x / 6 + row) % colors.length]);
                    if (choc) rect(ctx, x, y + 5, 5, 1, C.gold);
                }
            });
            rect(ctx, 62, 8, 34, 6, '#4b1f5c'); rect(ctx, 64, 10, 30, 2, C.gold);
            // trolley
            rect(ctx, 100, 64, 22, 12, '#aab6bb'); rect(ctx, 101, 65, 20, 10, '#dfe3e6');
            for (let x = 102; x < 120; x += 3) rect(ctx, x, 65, 1, 10, '#aab6bb');
            rect(ctx, 98, 60, 2, 6, '#555'); rect(ctx, 102, 76, 3, 3, '#222'); rect(ctx, 117, 76, 3, 3, '#222');
        },

        rooftop(t) {
            rect(ctx, 0, 0, W, 30, '#141a3a'); rect(ctx, 0, 30, W, 30, '#20295a');
            for (let i = 0; i < 24; i++) {
                const x = (i * 37) % W, y = (i * 23) % 44;
                if ((Math.floor(t * 2) + i) % 5) rect(ctx, x, y, 1, 1, '#ffffff');
            }
            rect(ctx, 100, 6, 10, 10, '#fff6c8'); rect(ctx, 104, 6, 6, 6, '#141a3a');
            // skyline with lit windows
            [[0, 36, 18], [18, 28, 14], [34, 40, 20], [56, 24, 12], [70, 34, 22], [94, 30, 16], [112, 38, 16]].forEach(([x, y, w], i) => {
                rect(ctx, x, y, w, 60 - y, '#0d1128');
                for (let wy = y + 3; wy < 58; wy += 5) {
                    for (let wx = x + 2; wx < x + w - 2; wx += 4) {
                        if ((wx + wy + i) % 3) rect(ctx, wx, wy, 2, 2, '#ffd36b');
                    }
                }
            });
            // fairy lights and the parapet
            for (let x = 0; x < W; x += 8) {
                const sag = Math.round(Math.sin((x / W) * Math.PI) * 4);
                rect(ctx, x, 46 + sag, 2, 2, ['#ff8fb8', '#ffd84a', '#9fd6ff'][(x / 8 + Math.floor(t * 2)) % 3]);
            }
            rect(ctx, 0, 60, W, 6, '#6b6f7a'); rect(ctx, 0, 60, W, 1, '#8a8f9c');
            rect(ctx, 0, 66, W, 22, '#4a4e58');
        },

        party(t) {
            rect(ctx, 0, 0, W, H, '#241238');
            // rotating coloured beams
            const beams = ['#ff4fa0', '#4fd1ff', '#ffe04f'];
            ctx.globalAlpha = 0.18;
            for (let i = 0; i < 3; i++) {
                const a = t * 1.2 + i * 2.1;
                for (let s = 0; s < 40; s++) {
                    rect(ctx, 64 + Math.cos(a) * s * 2.2, 10 + Math.abs(Math.sin(a)) * s * 1.6 + s * 0.6, 4, 4, beams[i]);
                }
            }
            ctx.globalAlpha = 1;
            // disco ball
            rect(ctx, 63, 0, 1, 4, '#888');
            rect(ctx, 59, 4, 9, 9, '#c0c6cc');
            for (let i = 0; i < 4; i++) rect(ctx, 60 + ((i * 3 + Math.floor(t * 6)) % 8), 5 + (i * 2) % 7, 1, 1, '#ffffff');
            // speakers
            [4, 112].forEach(x => {
                rect(ctx, x, 40, 12, 26, '#111'); rect(ctx, x + 3, 44, 6, 6, '#333'); rect(ctx, x + 2, 54, 8, 8, '#333');
                rect(ctx, x + 4, 56 + (Math.floor(t * 8) % 2), 4, 4, '#555');
            });
            // flashing dance floor
            for (let y = 66; y < H; y += 6) {
                for (let x = 0; x < W; x += 8) {
                    rect(ctx, x, y, 8, 6, ['#5a2a8a', '#ff4fa0', '#4fd1ff', '#3a1a5c'][(x / 8 + y / 6 + Math.floor(t * 3)) % 4]);
                }
            }
            // confetti
            for (let i = 0; i < 14; i++) {
                const ph = (t * 0.4 + i / 14) % 1;
                rect(ctx, (i * 41) % W + Math.sin(ph * 8) * 2, ph * 66, 1, 2, beams[i % 3]);
            }
        },

        car(t) {
            rect(ctx, 0, 0, W, 40, '#9fd6ff');
            cloud(((t * 3 + 40) % 170) - 20, 8);
            [[0, 16, 20, '#c9b8d9'], [20, 22, 16, '#e3c9b0'], [36, 12, 18, '#b8cfd9'], [90, 18, 20, '#d9c0c9'], [110, 24, 18, '#c9d9b8']].forEach(([x, y, w, col]) => {
                rect(ctx, x, y, w, 40 - y, col);
                for (let wy = y + 3; wy < 38; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 5) rect(ctx, wx, wy, 2, 2, '#ffffff');
            });
            rect(ctx, 0, 40, W, 10, '#c9c9c9'); rect(ctx, 0, 40, W, 1, '#aaaaaa');
            rect(ctx, 0, 50, W, 38, '#5a5f66');
            for (let x = 0; x < W; x += 16) rect(ctx, (x + Math.floor(t * 4)) % (W + 16) - 8, 82, 8, 1, '#f2f2f2');
            // his car, parked
            rect(ctx, 6, 56, 50, 12, '#e8344e'); rect(ctx, 14, 48, 32, 9, '#e8344e');
            rect(ctx, 17, 50, 12, 6, '#bfe4ff'); rect(ctx, 31, 50, 12, 6, '#bfe4ff');
            rect(ctx, 6, 60, 50, 1, '#b8233a'); rect(ctx, 52, 58, 4, 2, '#ffd84a'); rect(ctx, 6, 58, 3, 2, '#ff6b6b');
            rect(ctx, 12, 66, 8, 8, '#222'); rect(ctx, 14, 68, 4, 4, '#888');
            rect(ctx, 42, 66, 8, 8, '#222'); rect(ctx, 44, 68, 4, 4, '#888');
            // lamp post
            rect(ctx, 110, 30, 2, 36, '#444'); rect(ctx, 106, 28, 10, 3, '#444'); rect(ctx, 107, 31, 8, 1, '#fff3c4');
        }
    };

    // Where Ridit stands by default in each room
    const HOME_X = {
        bedroom: 78, kitchen: 46, living_room: 90, outside: 64, cafe: 50,
        bathroom: 62, shower: 64, beach: 70, gym: 62, office: 40, cinema: 64,
        supermarket: 54, rooftop: 64, party: 64, car: 84
    };

    // ---- Effects --------------------------------------------------------

    // (hx, hy) = top centre of his head in scene coordinates
    function drawEffect(name, t, hx, hy) {
        switch (name) {
            case 'zzz':
                for (let i = 0; i < 3; i++) {
                    const ph = (t * 0.45 + i / 3) % 1;
                    ctx.globalAlpha = 1 - ph;
                    glyph(ctx, 'z', hx + 4 + ph * 10, hy - 4 - ph * 16, '#5d429a');
                }
                ctx.globalAlpha = 1;
                break;
            case 'hearts':
                for (let i = 0; i < 3; i++) {
                    const ph = (t * 0.5 + i / 3) % 1;
                    ctx.globalAlpha = 1 - ph * 0.8;
                    glyph(ctx, 'heart', hx - 12 + i * 10 + Math.sin(ph * 6 + i) * 2, hy - 2 - ph * 18, i === 1 ? '#ff8fb8' : C.heart);
                }
                ctx.globalAlpha = 1;
                break;
            case 'notes':
                for (let i = 0; i < 2; i++) {
                    const ph = (t * 0.6 + i / 2) % 1;
                    ctx.globalAlpha = 1 - ph;
                    glyph(ctx, 'note', hx + (i ? 9 : -14) + ph * (i ? 4 : -4), hy - ph * 16, i ? '#5d429a' : '#e83e8c');
                }
                ctx.globalAlpha = 1;
                break;
            case 'anger':
                if (Math.floor(t * 4) % 2 === 0) glyph(ctx, 'anger', hx + 7, hy - 1, C.angry);
                for (let i = 0; i < 2; i++) {
                    const ph = (t * 0.9 + i / 2) % 1;
                    ctx.globalAlpha = 1 - ph;
                    rect(ctx, hx + (i ? 4 : -7) + (i ? ph * 4 : -ph * 4), hy - 2 - ph * 10, 3, 2, '#ffffff');
                }
                ctx.globalAlpha = 1;
                break;
            case 'sweat':
                if (Math.floor(t * 2) % 3 !== 2) glyph(ctx, 'drop', hx + 9, hy + 8 + Math.floor(t * 4) % 3, '#6cc4ff');
                break;
            case 'tears': {
                const ph = (t * 1.2) % 1;
                glyph(ctx, 'drop', hx - 6, hy + 14 + ph * 8, '#6cc4ff');
                glyph(ctx, 'drop', hx + 3, hy + 14 + ((ph + 0.5) % 1) * 8, '#6cc4ff');
                break;
            }
            case 'question':
                glyph(ctx, 'question', hx + 6, hy - 9 + (Math.floor(t * 3) % 2), '#5d429a');
                break;
            case 'exclaim':
                glyph(ctx, 'exclaim', hx + 7, hy - 8, '#e83e8c');
                break;
            case 'stars':
                for (let i = 0; i < 3; i++) {
                    const a = t * 4 + i * 2.1;
                    glyph(ctx, 'star', hx + Math.cos(a) * 11 - 1, hy - 3 + Math.sin(a) * 3, '#ffd84a');
                }
                break;
            case 'cloud': {
                rect(ctx, hx - 7, hy - 12, 14, 4, '#8a8f9c');
                rect(ctx, hx - 4, hy - 14, 7, 2, '#8a8f9c');
                for (let i = 0; i < 3; i++) {
                    const ph = (t * 1.5 + i / 3) % 1;
                    rect(ctx, hx - 5 + i * 4, hy - 8 + ph * 7, 1, 2, '#6cc4ff');
                }
                break;
            }
            case 'sparkle':
                if (Math.floor(t * 3) % 2 === 0) {
                    glyph(ctx, 'sparkle', hx - 14, hy + 2, '#ffd84a');
                    glyph(ctx, 'sparkle', hx + 10, hy - 4, '#ff8fb8');
                } else {
                    glyph(ctx, 'sparkle', hx + 11, hy + 6, '#ffd84a');
                    glyph(ctx, 'sparkle', hx - 13, hy - 5, '#ff8fb8');
                }
                break;
            case 'crumbs': {
                const ph = (t * 1.5) % 1;
                rect(ctx, hx + 2, hy + 19 + ph * 14, 1, 1, C.choc);
                rect(ctx, hx - 1, hy + 19 + ((ph + 0.4) % 1) * 14, 1, 1, C.choc);
                break;
            }
            case 'notify':
                if (t % 2.4 < 1.2) glyph(ctx, 'bubble', hx + 9, hy - 3, '#ffffff');
                break;
            case 'water':
                for (let i = 0; i < 7; i++) {
                    const ph = (t * 2 + i / 7) % 1;
                    rect(ctx, 58 + i * 2, 16 + ph * (hy - 12), 1, 2, '#6cc4ff');
                }
                break;
            case 'foam':
                for (let i = 0; i < 3; i++) {
                    const ph = (t * 0.8 + i / 3) % 1;
                    ctx.globalAlpha = 1 - ph;
                    rect(ctx, hx + 2 + i * 2, hy + 18 - ph * 8, 2, 2, '#ffffff');
                }
                ctx.globalAlpha = 1;
                break;
            case 'steam':
                for (let i = 0; i < 3; i++) {
                    const ph = (t * 0.8 + i / 3) % 1;
                    ctx.globalAlpha = 0.8 * (1 - ph);
                    rect(ctx, hx + 15 + i * 2 + Math.sin(ph * 6), hy + 20 - ph * 14, 3, 2, '#ffffff');
                }
                ctx.globalAlpha = 1;
                break;
            case 'dust':
                for (let i = 0; i < 3; i++) {
                    const ph = (t * 1.2 + i / 3) % 1;
                    ctx.globalAlpha = 0.7 * (1 - ph);
                    rect(ctx, hx + 8 + ph * 10 + i * 3, GROUND - 3 - ph * 4, 3, 2, '#d8cbb8');
                }
                ctx.globalAlpha = 1;
                break;
            case 'speed':
                for (let i = 0; i < 3; i++) {
                    const len = 6 + ((Math.floor(t * 10) + i) % 3) * 3;
                    rect(ctx, hx - 14 - len, hy + 18 + i * 6, len, 1, '#ffffff');
                    rect(ctx, hx + 14, hy + 21 + i * 6, len, 1, '#ffffff');
                }
                break;
            case 'ha':
                glyph(ctx, 'ha', hx + (Math.floor(t * 3) % 2 ? 10 : -17), hy - 2 - (Math.floor(t * 3) % 2) * 4, '#e83e8c');
                break;
            case 'thought':
                rect(ctx, hx + 9, hy - 1, 1, 1, '#ffffff'); rect(ctx, hx + 11, hy - 4, 2, 2, '#ffffff');
                rect(ctx, hx + 13, hy - 14, 14, 8, '#ffffff');
                for (let i = 0; i <= Math.floor(t * 2) % 3; i++) rect(ctx, hx + 16 + i * 3, hy - 10, 2, 1, '#5d429a');
                break;
            case 'dots':
                for (let i = 0; i <= Math.floor(t * 2) % 3; i++) rect(ctx, hx + 11 + i * 3, hy - 3, 2, 2, '#5d429a');
                break;
            case 'snow':
                for (let i = 0; i < 12; i++) {
                    const ph = (t * 0.25 + i / 12) % 1;
                    glyph(ctx, 'flake', ((i * 47) % W) + Math.sin(ph * 6 + i) * 3, ph * H, '#ffffff');
                }
                break;
            case 'flash':
                if ((t % 2) < 0.12) {
                    ctx.globalAlpha = 0.7;
                    rect(ctx, 0, 0, W, H, '#ffffff');
                    ctx.globalAlpha = 1;
                }
                break;
            case 'kissheart': {
                const ph = (t * 0.6) % 1;
                ctx.globalAlpha = 1 - ph * 0.7;
                glyph(ctx, 'heart', hx + 8 + ph * 34, hy + 14 - ph * 18, C.heart);
                ctx.globalAlpha = 1;
                break;
            }
            case 'tearsBig':
                for (let i = 0; i < 4; i++) {
                    const ph = (t * 2 + i / 4) % 1;
                    rect(ctx, hx - 7 - ph * 4, hy + 14 + ph * 12, 2, 2, '#6cc4ff');
                    rect(ctx, hx + 5 + ph * 4, hy + 14 + ph * 12, 2, 2, '#6cc4ff');
                }
                break;
            case 'scribble':
                glyph(ctx, 'scribble', hx + 9 + (Math.floor(t * 6) % 2), hy - 6, '#333');
                break;
            case 'splash':
                for (let i = 0; i < 4; i++) {
                    const ph = (t * 1.5 + i / 4) % 1;
                    rect(ctx, hx - 14 + i * 9 + ph * 2, 56 - Math.sin(ph * Math.PI) * 5, 2, 1, '#ffffff');
                }
                break;
            case 'exclaim2':
                glyph(ctx, 'exclaim', hx + 9, hy - 8, '#e83e8c');
                glyph(ctx, 'exclaim', hx + 12, hy - 9, '#e83e8c');
                break;
        }
    }

    // ---- Animations -----------------------------------------------------

    // Each takes seconds since it started (and the room) and returns how to
    // draw this frame: pose, position, lying or standing, and effects
    function blinkEyes(t, open) {
        return (t % 3.1) < 0.15 ? 'closed' : open;
    }

    function lyingSpot(location) {
        if (location === 'bedroom') return { x: 52, y: 58, onBed: true };
        if (location === 'living_room') return { x: 72, y: 61 };
        return { x: HOME_X[location] + 18, y: GROUND - 10 };
    }

    const ANIMS = {
        idle(t, loc) {
            const pose = defaultPose();
            pose.eyes = blinkEyes(t, 'open');
            pose.bob = Math.floor(t * 1.4) % 2;
            pose.look = (t % 6) < 1 ? -1 : (t % 6) < 2 ? 1 : 0;
            return { pose, x: HOME_X[loc] };
        },
        talking(t, loc) {
            const pose = defaultPose();
            pose.eyes = blinkEyes(t, 'open');
            pose.mouth = Math.floor(t * 7) % 2 ? 'open' : 'smile';
            pose.arms = Math.floor(t * 1.2) % 2 ? 'gesture' : 'down';
            return { pose, x: HOME_X[loc] };
        },
        walking(t, loc) {
            const pose = defaultPose();
            const span = 22, speed = 14;
            const d = (t * speed) % (span * 4);
            const offset = d < span * 2 ? d - span : span * 3 - d;
            const step = Math.floor(t * 6) % 2;
            pose.legs = step ? 'walkA' : 'walkB';
            pose.arms = step ? 'swingA' : 'swingB';
            pose.bob = step;
            pose.eyes = blinkEyes(t, 'open');
            return { pose, x: Math.round(HOME_X[loc] + offset), flip: d >= span * 2 };
        },
        sleeping(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'closed';
            pose.mouth = Math.floor(t) % 2 ? 'o' : 'flat';
            return { pose, lying: lyingSpot(loc), fx: ['zzz'] };
        },
        waking(t, loc) {
            const pose = defaultPose();
            if (t < 0.9) {
                pose.eyes = 'closed';
                pose.mouth = 'flat';
                return { pose, lying: lyingSpot(loc), fx: ['zzz'] };
            }
            if (t < 2) {
                pose.eyes = 'closed';
                pose.mouth = 'open';
                pose.arms = 'up';
                pose.bob = t < 1.4 ? 1 : 0;
                return { pose, x: HOME_X[loc] };
            }
            if (t < 2.8) {
                pose.eyes = 'half';
                pose.mouth = 'flat';
                return { pose, x: HOME_X[loc], fx: ['exclaim'] };
            }
            const awake = ANIMS.idle(t, loc);
            awake.pose.eyes = (t % 4) < 0.6 ? 'half' : awake.pose.eyes;
            return awake;
        },
        eating(t, loc) {
            const pose = defaultPose();
            pose.arms = 'eat';
            pose.item = 'bournville';
            pose.bite = Math.floor(t * 0.9) % 4;
            pose.mouth = Math.floor(t * 4) % 2 ? 'chew' : 'smile';
            pose.eyes = (t % 2.5) < 0.8 ? 'happy' : blinkEyes(t, 'open');
            return { pose, x: HOME_X[loc], fx: ['crumbs'] };
        },
        happy(t, loc) {
            const pose = defaultPose();
            const hop = Math.floor(t * 4) % 2;
            pose.eyes = 'happy';
            pose.mouth = 'big';
            pose.arms = hop ? 'up' : 'down';
            pose.blush = true;
            return { pose, x: HOME_X[loc], jump: hop ? -2 : 0, fx: ['sparkle'] };
        },
        love(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'heart';
            pose.mouth = Math.floor(t * 1.5) % 2 ? 'pout' : 'smile';
            pose.blush = true;
            pose.arms = 'out';
            pose.bob = Math.floor(t * 2) % 2;
            return { pose, x: HOME_X[loc], fx: ['hearts'] };
        },
        angry(t, loc) {
            const pose = defaultPose();
            pose.brows = 'angry';
            pose.mouth = 'frown';
            pose.arms = 'hips';
            pose.tint = 0.35 + 0.25 * (Math.floor(t * 3) % 2);
            const stomp = (t % 1.6) < 0.3;
            return { pose, x: HOME_X[loc] + (stomp ? (Math.floor(t * 12) % 2 ? 1 : -1) : 0), fx: ['anger'] };
        },
        sad(t, loc) {
            const pose = defaultPose();
            pose.brows = 'sad';
            pose.mouth = 'frown';
            pose.eyes = blinkEyes(t, 'down');
            pose.bob = 1;
            return { pose, x: HOME_X[loc], fx: ['tears'] };
        },
        scared(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'wide';
            pose.brows = 'up';
            pose.mouth = 'o';
            pose.arms = 'up';
            const jitter = Math.floor(t * 14) % 2 ? 1 : -1;
            return { pose, x: HOME_X[loc] + jitter, fx: t < 1.2 ? ['exclaim', 'sweat'] : ['sweat'] };
        },
        confused(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'squint';
            pose.mouth = 'wavy';
            pose.arms = 'scratch';
            pose.bob = Math.floor(t * 3) % 2;
            return { pose, x: HOME_X[loc], fx: ['question'] };
        },
        dancing(t, loc) {
            const pose = defaultPose();
            const beat = Math.floor(t * 4) % 2;
            pose.eyes = 'happy';
            pose.mouth = 'big';
            pose.arms = beat ? 'danceA' : 'danceB';
            pose.legs = beat ? 'walkA' : 'walkB';
            const sway = Math.round(Math.sin(t * Math.PI) * 4);
            return { pose, x: HOME_X[loc] + sway, jump: beat ? -1 : 0, fx: ['notes'] };
        },
        couch(t) {
            const pose = defaultPose();
            pose.legs = 'sit';
            pose.brows = 'sad';
            pose.eyes = blinkEyes(t, 'down');
            pose.mouth = 'flat';
            pose.arms = 'chest';
            return { pose, x: 52, groundY: 76, fx: ['cloud'], room: 'living_room' };
        },
        fainting(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'x';
            pose.mouth = 'o';
            if (t < 0.6) {
                return { pose, x: HOME_X[loc] + (Math.floor(t * 14) % 2 ? 1 : -1), fx: ['stars'] };
            }
            return { pose, lying: { x: HOME_X[loc] + 18, y: GROUND - 10 }, fx: ['stars'] };
        },
        sneaky(t, loc) {
            const pose = defaultPose();
            const span = 16, speed = 6;
            const d = (t * speed) % (span * 4);
            const offset = d < span * 2 ? d - span : span * 3 - d;
            const step = Math.floor(t * 2.5) % 2;
            pose.legs = 'tiptoe';
            pose.arms = 'sneak';
            pose.item = 'bournville';
            pose.look = Math.floor(t * 1.5) % 2 ? -1 : 1;
            pose.mouth = 'flat';
            pose.bob = step;
            return { pose, x: Math.round(HOME_X[loc] + offset), flip: d >= span * 2, fx: (t % 3) < 1 ? ['sweat'] : [] };
        },
        phone(t, loc) {
            const pose = defaultPose();
            pose.arms = 'phone';
            pose.item = 'phone';
            pose.eyes = blinkEyes(t, 'down');
            pose.mouth = (t % 5) < 1 ? 'smile' : 'flat';
            pose.screenOn = Math.floor(t * 5) % 7 !== 0;
            return { pose, x: HOME_X[loc], fx: ['notify'] };
        },
        // ---- the second wave of animations ----
        showering(t) {
            const pose = defaultPose();
            pose.eyes = 'closed';
            pose.mouth = Math.floor(t * 3) % 2 ? 'open' : 'o';
            pose.arms = Math.floor(t * 2) % 2 ? 'up' : 'scratch';
            return { pose, x: 64, room: 'shower', front: 'showerFront', fx: ['water', 'notes'] };
        },
        toilet(t) {
            const pose = defaultPose();
            pose.legs = 'sit';
            pose.arms = 'phone';
            pose.item = 'phone';
            pose.eyes = blinkEyes(t, 'down');
            pose.mouth = (t % 4) < 1 ? 'smile' : 'flat';
            return { pose, x: 36, groundY: 76, room: 'bathroom', front: 'toiletFront', fx: ['dots'] };
        },
        brushing(t, loc) {
            const pose = defaultPose();
            pose.arms = 'brush';
            pose.item = 'toothbrush';
            pose.mouth = 'o';
            pose.eyes = blinkEyes(t, 'open');
            pose.look = -1;
            return { pose, x: HOME_X[loc] + (Math.floor(t * 8) % 2), fx: ['foam'] };
        },
        cooking(t, loc) {
            const pose = defaultPose();
            pose.arms = Math.floor(t * 2) % 2 ? 'pan' : 'panUp';
            pose.item = 'pan';
            pose.mouth = 'smile';
            pose.eyes = blinkEyes(t, 'open');
            return { pose, x: HOME_X[loc], fx: ['steam'] };
        },
        cleaning(t, loc) {
            const pose = defaultPose();
            pose.arms = 'broom';
            pose.item = 'broom';
            pose.eyes = blinkEyes(t, 'down');
            pose.mouth = 'flat';
            return { pose, x: HOME_X[loc] + Math.round(Math.sin(t * 4) * 3), fx: ['dust'] };
        },
        working(t, loc) {
            const pose = defaultPose();
            pose.legs = 'sit';
            pose.arms = 'type';
            pose.item = 'laptop';
            pose.eyes = blinkEyes(t, 'down');
            pose.brows = (t % 5) < 2 ? 'angry' : null;
            pose.mouth = 'flat';
            return { pose, x: HOME_X[loc], groundY: 78, fx: ['dots'] };
        },
        gaming(t, loc) {
            const pose = defaultPose();
            pose.arms = 'hold';
            pose.item = 'controller';
            pose.eyes = 'wide';
            pose.brows = 'angry';
            pose.mouth = Math.floor(t * 3) % 2 ? 'o' : 'flat';
            return { pose, x: HOME_X[loc] + (Math.floor(t * 10) % 2), fx: ['sweat'] };
        },
        reading(t, loc) {
            const pose = defaultPose();
            pose.arms = 'hold';
            pose.item = 'book';
            pose.eyes = blinkEyes(t, 'down');
            pose.look = Math.floor(t * 1.5) % 2 ? -1 : 0;
            pose.mouth = (t % 6) < 1 ? 'o' : 'flat';
            return { pose, x: HOME_X[loc] };
        },
        singing(t, loc) {
            const pose = defaultPose();
            pose.arms = 'mic';
            pose.item = 'mic';
            pose.eyes = (t % 3) < 1.5 ? 'closed' : 'happy';
            pose.mouth = Math.floor(t * 4) % 2 ? 'open' : 'o';
            return { pose, x: HOME_X[loc] + Math.round(Math.sin(t * 2) * 2), fx: ['notes'] };
        },
        guitar(t, loc) {
            const pose = defaultPose();
            pose.arms = Math.floor(t * 5) % 2 ? 'guitar' : 'strum';
            pose.item = 'guitar';
            pose.eyes = 'closed';
            pose.mouth = 'smile';
            pose.bob = Math.floor(t * 2) % 2;
            return { pose, x: HOME_X[loc], fx: ['notes'] };
        },
        exercising(t, loc) {
            const pose = defaultPose();
            const rep = Math.floor(t * 1.5) % 2;
            pose.arms = rep ? 'liftUp' : 'liftDown';
            pose.item = 'dumbbell';
            pose.brows = 'angry';
            pose.mouth = rep ? 'o' : 'flat';
            pose.eyes = rep ? 'closed' : 'open';
            return { pose, x: HOME_X[loc], fx: ['sweat'] };
        },
        running(t, loc) {
            const pose = defaultPose();
            const span = 30, speed = 40;
            const d = (t * speed) % (span * 4);
            const offset = d < span * 2 ? d - span : span * 3 - d;
            const step = Math.floor(t * 10) % 2;
            pose.legs = step ? 'runA' : 'runB';
            pose.arms = step ? 'runA' : 'runB';
            pose.mouth = 'o';
            pose.bob = step;
            return { pose, x: Math.round(HOME_X[loc] + offset), flip: d >= span * 2, fx: ['speed', 'sweat'] };
        },
        waving(t, loc) {
            const pose = defaultPose();
            pose.arms = Math.floor(t * 4) % 2 ? 'wave1' : 'wave2';
            pose.eyes = 'happy';
            pose.mouth = 'big';
            return { pose, x: HOME_X[loc] };
        },
        kissing(t, loc) {
            const pose = defaultPose();
            const blow = (t % 1.6) > 0.8;
            pose.arms = blow ? 'blow' : 'kiss';
            pose.mouth = 'pout';
            pose.eyes = 'closed';
            pose.blush = true;
            return { pose, x: HOME_X[loc], fx: ['kissheart'] };
        },
        proposing(t, loc) {
            const pose = defaultPose();
            pose.legs = 'sit';
            pose.arms = 'offer';
            pose.item = 'ring';
            pose.eyes = 'sparkle';
            pose.blush = true;
            pose.mouth = 'smile';
            return { pose, x: HOME_X[loc], fx: ['sparkle', 'hearts'] };
        },
        flowers(t, loc) {
            const pose = defaultPose();
            pose.arms = 'hold';
            pose.item = 'flowers';
            pose.eyes = 'happy';
            pose.blush = true;
            pose.bob = Math.floor(t * 2) % 2;
            return { pose, x: HOME_X[loc], fx: ['sparkle'] };
        },
        gift(t, loc) {
            const pose = defaultPose();
            pose.arms = 'hold';
            pose.item = 'gift';
            pose.eyes = 'happy';
            pose.mouth = 'big';
            return { pose, x: HOME_X[loc], jump: Math.floor(t * 3) % 2 ? -1 : 0, fx: ['sparkle'] };
        },
        crying(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'closed';
            pose.brows = 'sad';
            pose.mouth = 'open';
            pose.bob = Math.floor(t * 6) % 2;
            return { pose, x: HOME_X[loc], fx: ['tearsBig'] };
        },
        laughing(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'happy';
            pose.mouth = 'big';
            pose.arms = 'hold';
            pose.bob = Math.floor(t * 8) % 2 * 2;
            return { pose, x: HOME_X[loc], fx: ['ha'] };
        },
        blushing(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'down';
            pose.blush = true;
            pose.tint = 0.3;
            pose.tintColor = '#ff7aa2';
            pose.arms = 'pray';
            pose.mouth = 'wavy';
            pose.look = Math.floor(t) % 2;
            return { pose, x: HOME_X[loc] + (Math.floor(t * 1.5) % 2), fx: ['sparkle'] };
        },
        thinking(t, loc) {
            const pose = defaultPose();
            pose.arms = 'chin';
            pose.eyes = 'up';
            pose.mouth = 'flat';
            pose.brows = (t % 3) < 1.5 ? 'up' : null;
            return { pose, x: HOME_X[loc], fx: ['thought'] };
        },
        shocked(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'wide';
            pose.brows = 'up';
            pose.mouth = 'jaw';
            pose.arms = 'shrug';
            pose.tint = t < 0.4 ? 0.5 : 0;
            pose.tintColor = '#ffffff';
            return { pose, x: HOME_X[loc], jump: t < 0.3 ? -3 : 0, fx: ['exclaim2'] };
        },
        sulking(t, loc) {
            const pose = defaultPose();
            pose.arms = 'cross';
            pose.brows = 'angry';
            pose.mouth = 'pout';
            pose.eyes = 'down';
            pose.look = -1;
            return { pose, x: HOME_X[loc], fx: ['scribble'] };
        },
        begging(t, loc) {
            const pose = defaultPose();
            pose.legs = 'sit';
            pose.arms = 'pray';
            pose.eyes = 'sparkle';
            pose.brows = 'sad';
            pose.mouth = 'wavy';
            pose.bob = Math.floor(t * 3) % 2;
            return { pose, x: HOME_X[loc], fx: ['sparkle'] };
        },
        apologizing(t, loc) {
            const pose = defaultPose();
            const bow = (t % 2) < 1;
            pose.arms = 'pray';
            pose.eyes = 'closed';
            pose.brows = 'sad';
            pose.mouth = 'frown';
            pose.bob = bow ? 3 : 0;
            return { pose, x: HOME_X[loc], fx: ['sweat'] };
        },
        shrugging(t, loc) {
            const pose = defaultPose();
            const up = Math.floor(t * 1.5) % 2;
            pose.arms = up ? 'shrug' : 'shrugLow';
            pose.brows = 'up';
            pose.mouth = 'wavy';
            pose.eyes = blinkEyes(t, 'open');
            pose.bob = up ? 0 : 1;
            return { pose, x: HOME_X[loc] };
        },
        facepalm(t, loc) {
            const pose = defaultPose();
            pose.arms = 'face';
            pose.mouth = 'frown';
            pose.brows = 'angry';
            pose.bob = 1;
            return { pose, x: HOME_X[loc], fx: ['sweat'] };
        },
        hiding(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'open';
            pose.look = Math.floor(t * 1.2) % 2 ? -1 : 1;
            pose.bob = Math.floor(t * 0.8) % 2 ? 0 : 2;
            return { pose, x: HOME_X[loc] + (Math.floor(t * 6) % 7 === 0 ? 1 : 0), front: 'box' };
        },
        sick(t, loc) {
            const pose = defaultPose();
            pose.item = 'thermometer';
            pose.eyes = 'half';
            pose.mouth = 'flat';
            pose.brows = 'sad';
            pose.tint = 0.3;
            pose.tintColor = '#8bc34a';
            pose.arms = 'hold';
            pose.bob = Math.floor(t) % 2;
            return { pose, x: HOME_X[loc], fx: ['sweat'] };
        },
        sleepy(t, loc) {
            const pose = defaultPose();
            const nod = (t % 3) > 2;
            pose.eyes = nod ? 'closed' : 'half';
            pose.mouth = (t % 6) < 1 ? 'open' : 'flat';
            pose.bob = nod ? 2 : 0;
            return { pose, x: HOME_X[loc], fx: nod ? ['zzz'] : [] };
        },
        selfie(t, loc) {
            const pose = defaultPose();
            pose.arms = 'selfie';
            pose.item = 'selfie';
            pose.eyes = (t % 2) < 1 ? 'happy' : 'open';
            pose.mouth = (t % 2) < 1 ? 'pout' : 'big';
            return { pose, x: HOME_X[loc], fx: ['flash'] };
        },
        flexing(t, loc) {
            const pose = defaultPose();
            pose.arms = 'flex';
            pose.item = 'muscle';
            pose.brows = 'angry';
            pose.mouth = 'big';
            pose.bob = Math.floor(t * 2) % 2;
            return { pose, x: HOME_X[loc], fx: ['sparkle'] };
        },
        shivering(t, loc) {
            const pose = defaultPose();
            pose.arms = 'cross';
            pose.eyes = 'closed';
            pose.mouth = Math.floor(t * 8) % 2 ? 'wavy' : 'flat';
            pose.tint = 0.3;
            pose.tintColor = '#6cc4ff';
            return { pose, x: HOME_X[loc] + (Math.floor(t * 14) % 2 ? 1 : -1), fx: ['snow'] };
        },
        swimming(t) {
            const pose = defaultPose();
            const stroke = Math.floor(t * 2.5) % 2;
            pose.arms = stroke ? 'swimA' : 'swimB';
            pose.eyes = stroke ? 'closed' : 'happy';
            pose.mouth = 'o';
            return { pose, x: 64 + Math.round(Math.sin(t * 0.8) * 20), groundY: 76, room: 'beach', front: 'seaFront', fx: ['splash'] };
        },

        // A quick jolt when she taps him
        poke(t, loc) {
            const pose = defaultPose();
            pose.eyes = 'wide';
            pose.mouth = 'o';
            pose.arms = 'up';
            pose.blush = true;
            return { pose, x: HOME_X[loc], jump: t < 0.25 ? -3 : 0, fx: ['exclaim'] };
        }
    };

    // ---- Scene loop -----------------------------------------------------

    const scene = {
        animation: 'sleeping',
        location: 'bedroom',
        startedAt: performance.now(),
        pokeUntil: 0
    };
    let frameHandle = null;
    let lastFrame = 0;
    let headX = HOME_X.bedroom;

    function setAnimation(name, location) {
        const anim = ANIMATIONS.includes(name) ? name : 'idle';
        const loc = LOCATIONS.includes(location) ? location : scene.location;
        if (anim !== scene.animation || loc !== scene.location) scene.startedAt = performance.now();
        scene.animation = anim;
        scene.location = loc;
    }

    function drawScene(now) {
        const t = (now - scene.startedAt) / 1000;
        const poking = now < scene.pokeUntil;
        const frame = poking
            ? ANIMS.poke(1 - (scene.pokeUntil - now) / 700, scene.location)
            : ANIMS[scene.animation](t, scene.location);
        const room = frame.room || scene.location;

        ctx.clearRect(0, 0, W, H);
        ROOMS[room](now / 1000);

        drawRidit(frame.pose);
        let hx, hy;
        if (frame.lying) {
            const { x, y } = frame.lying;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(sprite, -SOX, -SOY);
            ctx.restore();
            if (frame.lying.onBed) ROOMS.bedroomFront();
            hx = x - 30;
            hy = y - 11;
        } else {
            const gy = (frame.groundY || GROUND) + (frame.jump || 0);
            const up = frame.pose.bob + (frame.pose.legs === 'sit' ? 4 : 0);
            if (frame.flip) {
                ctx.save();
                ctx.translate(frame.x, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, -SOX, gy - SOY);
                ctx.restore();
            } else {
                ctx.drawImage(sprite, frame.x - SOX, gy - SOY);
            }
            hx = frame.x;
            hy = gy - 40 + up;
        }

        if (frame.front === 'box') {
            // a cardboard box he's hiding in, peeking over the top
            const gy = frame.groundY || GROUND;
            rect(ctx, frame.x - 12, gy - 25, 24, 26, '#c8955a');
            rect(ctx, frame.x - 12, gy - 25, 24, 2, '#a8763e');
            rect(ctx, frame.x - 2, gy - 25, 4, 12, '#e3c08a');
            rect(ctx, frame.x - 9, gy - 12, 8, 1, '#8a5a2e'); rect(ctx, frame.x - 9, gy - 10, 5, 1, '#8a5a2e');
        } else if (frame.front) {
            ROOMS[frame.front](now / 1000);
        }

        (frame.fx || []).forEach(name => drawEffect(name, now / 1000, hx, hy));
        headX = hx;
        placeSpeech();
    }

    function loop(now) {
        frameHandle = requestAnimationFrame(loop);
        if (now - lastFrame < 1000 / FPS) return;
        lastFrame = now;
        drawScene(now);
    }

    function startLoop() {
        if (frameHandle === null) frameHandle = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (frameHandle !== null) cancelAnimationFrame(frameHandle);
        frameHandle = null;
    }

    // ---- Speech bubble --------------------------------------------------

    let speechTimer = null;

    // Centre the bubble over his head, but keep it inside the stage
    function placeSpeech() {
        if (speechEl.style.display === 'none') return;
        const stageW = canvas.clientWidth;
        const half = speechEl.offsetWidth / 2;
        const x = (headX / W) * stageW;
        speechEl.style.left = Math.min(stageW - half - 6, Math.max(half + 6, x)) + 'px';
    }

    function say(text, ms) {
        clearTimeout(speechTimer);
        if (!text) {
            speechEl.style.display = 'none';
            return;
        }
        speechEl.textContent = text;
        speechEl.style.display = 'block';
        // restart the pop-in animation
        speechEl.style.animation = 'none';
        void speechEl.offsetWidth;
        speechEl.style.animation = '';
        placeSpeech();
        speechTimer = setTimeout(() => { speechEl.style.display = 'none'; }, ms || 7000);
    }

    const POKE_LINES = ['Hehe stop 🙈', 'Ow! 😳', "I'm awake, I'm awake", 'Five more minutes...', 'Babylove?', 'That tickles!'];

    canvas.addEventListener('click', () => {
        scene.pokeUntil = performance.now() + 700;
        if (speechEl.style.display === 'none') {
            say(POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)], 1800);
        }
    });

    // =====================================================================
    // The story
    // =====================================================================

    const STORAGE_KEY = 'pocketRiditStory';
    const MAX_SAVED_TURNS = 60;
    const HISTORY_SENT = 10;
    const ERROR_LINES = {
        no_key: "Pocket Ridit isn't switched on yet. Tell Ridit to add the Gemini key 🔑",
        bad_key: "The Gemini key isn't working. Ridit needs to check it 🔑",
        quota: 'Pixel Ridit is exhausted (too many turns today). Try again a bit later 😴',
        rate_limited: 'Whoa, slow down! Pixel Ridit needs a breather. Try again in a few minutes 😴',
        blocked: 'The narrator blushed and refused to describe that 🙈 Try something else.',
        needs_permission: "Pocket Ridit isn't allowed online yet. Ridit needs to run testPocketRidit once in Apps Script 🔧",
        old_backend: "Pocket Ridit's backend isn't updated yet. Ridit needs to deploy the new Apps Script version 🔧",
        unreachable: "Couldn't reach the portal's backend. Check your internet and try again 📶",
        timeout: 'Gemini took too long to answer 🐢 Try again in a moment.',
        slow: 'Gemini is being really slow right now 🐢 Try again in a moment.',
        empty_input: 'Type something for Ridit to do first 😗'
    };
    const FALLBACK_ERROR = 'The narrator got distracted by a Bournville. Try again 🍫';

    let story = loadStory();
    let busy = false;

    function loadStory() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (saved && saved.opening && Array.isArray(saved.turns)) return saved;
        } catch (err) { /* storage unavailable or corrupt: start fresh */ }
        return { opening: null, turns: [] };
    }

    function saveStory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(story));
        } catch (err) { /* private mode: the story just won't persist */ }
    }

    function showError(err) {
        const code = err && err.code;
        const note = addLine('pocket-note', ERROR_LINES[code] || FALLBACK_ERROR);
        if (code && code !== 'empty_input') {
            const why = document.createElement('span');
            why.className = 'pocket-debug';
            why.textContent = ' [' + code + (err.detail ? ': ' + err.detail : '') + ']';
            note.appendChild(why);
        }
    }

    function addLine(className, text) {
        const line = document.createElement('p');
        line.className = className;
        line.textContent = text;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        return line;
    }

    function renderSuggestions(list) {
        suggestionsEl.innerHTML = '';
        (list || []).forEach(text => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.textContent = text;
            chip.disabled = busy;
            chip.addEventListener('click', () => takeTurn(text));
            suggestionsEl.appendChild(chip);
        });
    }

    function latestReply() {
        const last = story.turns[story.turns.length - 1];
        return last ? last.reply : story.opening;
    }

    function renderStory() {
        logEl.innerHTML = '';
        if (story.opening) addLine('pocket-narration', story.opening.narration);
        story.turns.forEach(turn => {
            addLine('pocket-you', '> ' + turn.input);
            addLine('pocket-narration', turn.reply.narration);
        });
        const reply = latestReply();
        if (reply) {
            setAnimation(reply.animation, reply.location);
            renderSuggestions(reply.suggestions);
        }
    }

    function setBusy(value) {
        busy = value;
        sendBtn.disabled = value;
        suggestionsEl.querySelectorAll('button').forEach(b => { b.disabled = value; });
    }

    function addThinking(text) {
        const line = addLine('pocket-narration pocket-thinking', text);
        const slow = setTimeout(() => {
            line.textContent = 'Still thinking (the first move can take a few seconds)';
        }, 8000);
        return { remove: () => { clearTimeout(slow); line.remove(); } };
    }

    function applyReply(reply) {
        setAnimation(reply.animation, reply.location);
        say(reply.speech);
        renderSuggestions(reply.suggestions);
    }

    function callAdventure(body) {
        const url = window.APPS_SCRIPT_URL;
        if (!url) return Promise.reject(new Error('no url'));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);
        // text/plain keeps this a "simple" request, so no CORS preflight
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(Object.assign({ action: 'adventure' }, body)),
            signal: controller.signal
        })
            .then(response => response.text())
            .then(text => {
                try {
                    return JSON.parse(text);
                } catch (err) {
                    // The old backend has no doPost and answers with an HTML error page
                    const code = /doPost/.test(text) ? 'old_backend' : 'unreachable';
                    return { status: 'error', code: code, detail: text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) };
                }
            }, () => ({ status: 'error', code: controller.signal.aborted ? 'timeout' : 'unreachable' }))
            .finally(() => clearTimeout(timeout));
    }

    function historyForServer() {
        const history = [{ input: 'Start the adventure.', reply: story.opening }].concat(story.turns);
        return history.slice(-HISTORY_SENT);
    }

    // Opening scenes are written ahead of time, so a new story starts
    // instantly instead of waiting on Gemini. Gemini takes over from her
    // first move.
    const OPENINGS = [
        { narration: 'Morning light spills across the bedroom. You wake up absolutely starving, and Ridit is asleep beside you, snoring like a tiny tractor. Somewhere in the kitchen, a Bournville sits on the top shelf, just out of reach.',
            speech: '', animation: 'sleeping', location: 'bedroom', suggestions: ['wake ridit', 'go to the kitchen', 'steal his blanket'] },
        { narration: 'The living room, late evening. Ridit has been sentenced to the couch for a crime he claims not to remember. A tiny rain cloud hovers over his head. You hold the evidence.',
            speech: 'I was framed, babylove', animation: 'couch', location: 'living_room', suggestions: ['read him the charges', 'pardon him', 'take the remote'] },
        { narration: 'Ridit has announced that he is cooking dinner tonight. There is smoke. He insists the smoke is "part of the recipe" and flips something that may once have been an egg.',
            speech: 'Trust the process', animation: 'cooking', location: 'kitchen', suggestions: ['taste it', 'open a window', 'order pizza instead'] },
        { narration: 'Date night at the cafe. The bill arrives on a little tray. Ridit pats his pockets, then pats them again, with growing horror. His wallet is not in any of them.',
            speech: 'I definitely had it', animation: 'shocked', location: 'cafe', suggestions: ['make him wash dishes', 'pay and gloat', 'check his jacket'] },
        { narration: 'An evening walk. Ridit insists he knows exactly where the park is. He has turned left three times. You are now back where you started.',
            speech: "It's a shortcut", animation: 'walking', location: 'outside', suggestions: ['ask for directions', 'hold his hand', 'race him home'] },
        { narration: 'It is 2am and you are wide awake and in need of attention. Ridit is asleep, snoring loudly enough to rattle the window.',
            speech: '', animation: 'sleeping', location: 'bedroom', suggestions: ['poke his cheek', 'whisper bournville', 'steal all the blanket'] },
        { narration: 'From the bathroom comes a dramatic, slightly off-key ballad. Ridit is in the shower, performing for an audience of one rubber duck. He is also using your shampoo.',
            speech: '🎵 And I will always love youuu', animation: 'showering', location: 'shower', suggestions: ['turn off the hot water', 'join the chorus', 'hide his towel'] },
        { narration: 'Up on the rooftop, fairy lights twinkle over the city. Ridit has brought a guitar he cannot actually play, and he is about to serenade you anyway.',
            speech: 'This one is for you', animation: 'guitar', location: 'rooftop', suggestions: ['request a love song', 'sing along', 'take the guitar'] },
        { narration: 'At the supermarket you turn your back for one second. When you look again, Ridit is tiptoeing away from the trolley, which is now mostly Bournville.',
            speech: 'Those were already there', animation: 'sneaky', location: 'supermarket', suggestions: ['check the trolley', 'interrogate him', 'add more chocolate'] },
        { narration: 'At the gym, Ridit has done exactly one push-up. He is now flexing in the mirror and asking strangers if they can see his abs.',
            speech: 'Feel this muscle, babylove', animation: 'flexing', location: 'gym', suggestions: ['poke his arm', 'make him do a set', 'take a photo'] },
        { narration: 'You are at the movies and the film has just started. Ridit is scrolling on his phone, the screen lighting up his face like a lighthouse.',
            speech: 'One sec, one sec...', animation: 'phone', location: 'cinema', suggestions: ['where my man at', 'steal his popcorn', 'take his phone'] },
        { narration: 'A perfect beach day. Ridit is already in the sea, waving his arms and shouting that the water is "totally not cold". His lips are slightly blue.',
            speech: 'Come in, it is warm!', animation: 'swimming', location: 'beach', suggestions: ['jump in', 'stay on the towel', 'bury his shoes'] },
        { narration: 'The party is in full swing. Ridit has discovered the dance floor and is doing a move that looks like a confused octopus. People are filming.',
            speech: 'THIS IS MY SONG', animation: 'dancing', location: 'party', suggestions: ['dance with him', 'drag him home', 'request a slow song'] },
        { narration: 'Ridit is at his desk, typing furiously. He promised it would be "five more minutes" an hour ago. You have been counting.',
            speech: 'Almost done, I swear', animation: 'working', location: 'office', suggestions: ['close his laptop', 'sit on his desk', 'bring him a bournville'] },
        { narration: 'You are standing by the car, ready to leave. Ridit has searched every pocket three times. The car keys are, as always, nowhere.',
            speech: 'They were RIGHT here', animation: 'confused', location: 'car', suggestions: ['check his hand', 'help him look', 'call a taxi'] }
    ];

    function pickOpening() {
        let last = -1;
        try { last = Number(localStorage.getItem('pocketRiditLastOpening')); } catch (err) { /* fine */ }
        let index = Math.floor(Math.random() * OPENINGS.length);
        if (index === last) index = (index + 1) % OPENINGS.length;
        try { localStorage.setItem('pocketRiditLastOpening', String(index)); } catch (err) { /* fine */ }
        return JSON.parse(JSON.stringify(OPENINGS[index]));
    }

    function startStory() {
        if (busy) return;
        logEl.innerHTML = '';
        say('');
        const opening = pickOpening();
        story = { opening: opening, turns: [] };
        saveStory();
        addLine('pocket-narration', opening.narration);
        applyReply(opening);
    }

    // Apps Script sleeps when unused and takes a few seconds to wake up.
    // Nudge it as soon as she opens Pocket Ridit, so her first move is quick.
    let warmedUp = false;
    function warmUp() {
        if (warmedUp) return;
        warmedUp = true;
        callAdventure({ action: 'warmup' }).catch(() => { /* just a nudge */ });
    }

    function takeTurn(text) {
        const command = String(text || '').trim();
        if (busy || !command) return;
        if (!story.opening) {
            startStory();
            return;
        }
        setBusy(true);
        if (input.value.trim() === command) input.value = '';
        say('');
        addLine('pocket-you', '> ' + command);
        const thinking = addThinking('The narrator is thinking');

        callAdventure({ input: command, history: historyForServer() })
            .then(result => {
                thinking.remove();
                if (result.status !== 'success') throw result;
                story.turns.push({ input: command, reply: result.reply });
                if (story.turns.length > MAX_SAVED_TURNS) story.turns.shift();
                saveStory();
                addLine('pocket-narration', result.reply.narration);
                applyReply(result.reply);
            })
            .catch(err => {
                thinking.remove();
                showError(err);
                if (!input.value) input.value = command;
            })
            .finally(() => {
                setBusy(false);
                input.focus({ preventScroll: true });
            });
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        takeTurn(input.value);
    });

    // Starting over takes two taps so a stray click can't wipe the story
    let restartArmed = null;
    restartBtn.addEventListener('click', () => {
        if (busy) return;
        if (!restartArmed) {
            restartBtn.textContent = 'Sure? Tap again 🔄';
            restartArmed = setTimeout(() => {
                restartArmed = null;
                restartBtn.textContent = 'New story 🔄';
            }, 3000);
            return;
        }
        clearTimeout(restartArmed);
        restartArmed = null;
        restartBtn.textContent = 'New story 🔄';
        startStory();
    });

    openBtn.addEventListener('click', () => {
        welcomeScreen.style.display = 'none';
        screen.style.display = 'flex';
        startLoop();
        warmUp();
        if (story.opening) {
            renderStory();
        } else {
            startStory();
        }
    });

    backBtn.addEventListener('click', () => {
        screen.style.display = 'none';
        welcomeScreen.style.display = 'flex';
        stopLoop();
        say('');
    });
});
