/* --- GEMINI CONFIG --- */
const GEMINI_API_KEY = ""; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

/* --- GAME STATE --- */
let players = []; // Array of hands. Index 0 is Human.
let totalPlayers = 2; // Default
let currentPlayer = 0; // Index of current player
let direction = 1; // 1 = Clockwise, -1 = Counter-Clockwise
let drawPile = [];
let topCard = '';
let gameActive = false;
let pendingWildCard = null;
let canPlayAfterDraw = false;

const CARDS = [
    'R0', 'G0', 'B0', 'Y0',
    ...['R','G','B','Y'].flatMap(c => Array(2).fill().flatMap((_,i) => Array(9).fill().map((_,j) => c+(j+1)))),
    ...['R','G','B','Y'].flatMap(c => Array(2).fill(c+'-D2')),
    ...['R','G','B','Y'].flatMap(c => Array(2).fill(c+'-S')), // Skip
    ...['R','G','B','Y'].flatMap(c => Array(2).fill(c+'-R')), // Reverse
    ...Array(4).fill('W-W'), ...Array(4).fill('W-D4')
];

/* --- SETUP --- */
function selectPlayerCount(num) {
    totalPlayers = num;
    document.querySelectorAll('.p-sel-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-p${num}`).classList.add('active');
}

function startGame() {
    let deck = [...CARDS].sort(() => Math.random() - 0.5);
    
    // Init Players
    players = [];
    for(let i=0; i<totalPlayers; i++) {
        players.push(deck.splice(0, 7));
    }
    
    drawPile = deck;
    direction = 1;
    currentPlayer = 0; // Human starts

    // Setup Top Card
    do {
        topCard = drawPile.pop();
        // Prevent complex start cards
        if(topCard.includes('-') || topCard.startsWith('W')) {
            drawPile.unshift(topCard);
            drawPile.sort(() => Math.random() - 0.5);
            topCard = '';
        }
    } while(!topCard);

    gameActive = true;
    canPlayAfterDraw = false;
    
    // UI Setup
    document.getElementById('scene-menu').classList.remove('active');
    setTimeout(() => document.getElementById('scene-game').classList.add('active'), 500);
    
    generateOpponentsUI();
    renderGame();
    showToast("Your Turn!");
}

/* --- GAME LOGIC --- */
function nextTurn(skip = false) {
    let steps = skip ? 2 : 1;
    currentPlayer = (currentPlayer + (direction * steps)) % totalPlayers;
    if(currentPlayer < 0) currentPlayer += totalPlayers;

    renderGame();

    // Check if Bot's turn
    if(currentPlayer !== 0 && gameActive) {
        setTimeout(botTurn, 1500);
    } else if (currentPlayer === 0) {
        showToast("Your Turn");
    }
}

function handlePostPlay(card) {
    if(checkWin(currentPlayer)) return;

    let { value } = getCardParts(card);
    let skipNext = false;

    // Special Cards
    if(value === 'S') { // Skip
        skipNext = true;
        showToast("Skip!");
    } else if (value === 'R') { // Reverse
        if(totalPlayers === 2) {
            skipNext = true; // Acts like Skip in 1v1
            showToast("Reverse (Skip)!");
        } else {
            direction *= -1;
            showToast("Direction Reversed!");
            // Visual indicator update
            document.getElementById('direction-indicator').style.transform = `scaleY(${direction})`;
        }
    } else if (value === 'D2') {
        giveCardsToNext(2);
        skipNext = true;
        showToast("Draw 2 & Skip!");
    } else if (value === 'D4') {
        giveCardsToNext(4);
        skipNext = true;
        showToast("Draw 4 & Skip!");
    }

    // Move to next player
    nextTurn(skipNext);
}

function giveCardsToNext(count) {
    // Determine victim index
    let victimIdx = (currentPlayer + direction) % totalPlayers;
    if(victimIdx < 0) victimIdx += totalPlayers;
    
    for(let i=0; i<count; i++) {
        if(drawPile.length === 0) reshuffle();
        players[victimIdx].push(drawPile.pop());
    }
}

function playCard(card) {
    if(!gameActive || currentPlayer !== 0 || pendingWildCard) return;

    const { color: cC, value: cV } = getCardParts(card);
    const { color: tC, value: tV } = getCardParts(topCard);

    if (cC !== 'W' && cC !== tC && cV !== tV) return;

    // Remove card
    let hand = players[0];
    hand.splice(hand.indexOf(card), 1);
    canPlayAfterDraw = false;

    if(card.startsWith('W')) {
        pendingWildCard = card;
        document.getElementById('modal-color').classList.remove('hidden');
        document.getElementById('modal-color').classList.add('flex');
        renderGame();
    } else {
        topCard = card;
        handlePostPlay(card);
    }
}

function selectWildColor(color) {
    let rawVal = getCardParts(pendingWildCard).value;
    topCard = `W-${color}-${rawVal}`;
    pendingWildCard = null;
    document.getElementById('modal-color').classList.add('hidden');
    document.getElementById('modal-color').classList.remove('flex');
    handlePostPlay(topCard);
}

function botTurn() {
    if(!gameActive || currentPlayer === 0) return;

    let hand = players[currentPlayer];
    let { color: tC, value: tV } = getCardParts(topCard);
    
    // Find Playable
    let playable = hand.filter(c => {
        let p = getCardParts(c);
        return p.color === 'W' || p.color === tC || p.value === tV;
    });

    if(playable.length > 0) {
        // Strategy: Save Wilds, play Action/Number
        playable.sort((a,b) => (a.includes('D4') || a.includes('W')) ? 1 : -1);
        let choice = playable[0];
        
        hand.splice(hand.indexOf(choice), 1);

        if(choice.startsWith('W')) {
            // Bot picks random color
            let colors = ['R','G','B','Y'];
            let pick = colors[Math.floor(Math.random()*4)];
            let raw = getCardParts(choice).value;
            topCard = `W-${pick}-${raw}`;
            showToast(`Bot ${currentPlayer} picked ${pick}`);
        } else {
            topCard = choice;
        }
        
        handlePostPlay(topCard);
    } else {
        // Draw
        drawOne(currentPlayer);
        // Bot plays drawn card if possible? Simplified: Bot just passes after draw.
        nextTurn(false); 
    }
}

function drawCard() {
    if(!gameActive || currentPlayer !== 0 || canPlayAfterDraw) return;
    drawOne(0);
    canPlayAfterDraw = true;
    showToast("You Drew");
    renderGame();
    // Auto scroll
    setTimeout(() => document.getElementById('player-cards').scrollLeft = 1000, 100);
}

function drawOne(pIdx) {
    if(drawPile.length === 0) reshuffle();
    players[pIdx].push(drawPile.pop());
}

function skipDrawnTurn() {
    if(!canPlayAfterDraw) return;
    canPlayAfterDraw = false;
    nextTurn(false);
}

function reshuffle() {
    drawPile = [...CARDS].sort(()=>Math.random()-0.5); // Simplified reshuffle
}

function checkWin(pIdx) {
    if(players[pIdx].length === 0) {
        gameActive = false;
        let msg = pIdx === 0 ? "YOU WIN!" : `BOT ${pIdx} WINS!`;
        document.getElementById('winner-text').textContent = msg;
        document.getElementById('modal-gameover').classList.remove('hidden');
        document.getElementById('modal-gameover').classList.add('flex');
        return true;
    }
    return false;
}

/* --- RENDERING --- */
function generateOpponentsUI() {
    const container = document.getElementById('opponents-container');
    container.innerHTML = '';
    
    // Create avatars for Player 1 to Total-1
    for(let i=1; i<totalPlayers; i++) {
        container.innerHTML += `
            <div id="opp-${i}" class="opponent-box">
                <div class="bot-avatar">🤖</div>
                <div class="text-[10px] font-bold text-gray-400 mb-1">BOT ${i}</div>
                <div class="text-xl font-black text-white leading-none" id="count-${i}">7</div>
            </div>
        `;
    }
}

function renderGame() {
    // Update Counts & Active Status
    for(let i=1; i<totalPlayers; i++) {
        document.getElementById(`count-${i}`).textContent = players[i].length;
        let box = document.getElementById(`opp-${i}`);
        if(currentPlayer === i) box.classList.add('active-player');
        else box.classList.remove('active-player');
    }
    
    // Update Hand BG for Player Turn
    const handBg = document.getElementById('player-hand-bg');
    if(currentPlayer === 0) handBg.classList.add('border-yellow-400', 'bg-white/10');
    else handBg.classList.remove('border-yellow-400', 'bg-white/10');

    // Top Card
    const topDiv = document.getElementById('top-card-container');
    if(topCard) {
        topDiv.innerHTML = renderCardHTML(topCard, false, '');
        topDiv.firstElementChild.style.marginRight = '0';
        topDiv.firstElementChild.classList.add('active-turn');
        topDiv.firstElementChild.classList.remove('opacity-70', 'grayscale-[0.3]');
    }

    // Player Hand
    const handDiv = document.getElementById('player-cards');
    handDiv.innerHTML = '';
    let hand = [...players[0]].sort(); // Sort for display
    let { color: tC, value: tV } = getCardParts(topCard);

    hand.forEach(c => {
        let { color: cC, value: cV } = getCardParts(c);
        let match = (cC === 'W' || cC === tC || cV === tV);
        let playable = (currentPlayer === 0) && !pendingWildCard && (match || canPlayAfterDraw);
        handDiv.innerHTML += renderCardHTML(c, playable, `playCard('${c}')`);
    });

    // Buttons
    document.getElementById('skip-btn').disabled = !canPlayAfterDraw;
    document.getElementById('draw-btn-container').style.opacity = (currentPlayer === 0 && !canPlayAfterDraw) ? '1' : '0.5';
    document.getElementById('draw-btn-container').style.pointerEvents = (currentPlayer === 0 && !canPlayAfterDraw) ? 'auto' : 'none';
}

/* --- UTILS --- */
function getCardParts(code) {
    if (!code) return { color: 'gray', value: '?', display: '?' };
    let color = code.startsWith('W-') && code.length > 2 ? code[2] : (code[0] || 'W');
    let val = code.startsWith('W-') && code.length > 4 ? code.substring(4) : (code.includes('-') ? code.substring(2) : code.substring(1));
    let disp = val;
    if(val==='D2') disp='+2'; if(val==='D4') disp='+4'; if(val==='S') disp='⊘'; if(val==='R') disp='⇄';
    return { color, value: val, display: disp };
}

function renderCardHTML(code, isPlayable, onClick) {
    const { color, display } = getCardParts(code);
    let bg = 'bg-black-card', txt = 'text-white';
    if(color==='R'){bg='bg-red-card';txt='text-R'} if(color==='G'){bg='bg-green-card';txt='text-G'}
    if(color==='B'){bg='bg-blue-card';txt='text-B'} if(color==='Y'){bg='bg-yellow-card';txt='text-Y'}
    if(color==='W'){bg='bg-wild-card';txt='text-W'}
    
    return `<div class="uno-card ${bg} ${isPlayable?'card-clickable':'opacity-70 grayscale-[0.3]'} transition-transform" style="margin-right:-45px;" onclick="${isPlayable?onClick:''}"><span class="card-corner top-left">${display}</span><div class="card-oval"><span class="card-main-value ${txt}">${display}</span></div><span class="card-corner bottom-right">${display}</span></div>`;
}

function showToast(msg) {
    let t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.style.opacity = '1'; t.style.transform = 'translate(-50%, -50%)';
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%, -150%)'; }, 2000);
}

/* --- GEMINI AI --- */
async function getStrategyAdvice() {
    if(currentPlayer !== 0) return;
    const btn = document.getElementById('strategy-btn');
    const out = document.getElementById('strategy-output');
    btn.disabled = true; out.textContent = "Analyzing...";
    try {
        const res = await fetch(GEMINI_API_URL, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: `UNO Strategy. Top: ${topCard}. Hand: ${players[0].join(',')}. 1 sentence advice.` }] }] })
        });
        const d = await res.json();
        out.textContent = d.candidates[0].content.parts[0].text;
    } catch(e) { out.textContent = "Error"; }
    btn.disabled = false;
}
