/* --- GEMINI CONFIG (Paste Key Below) --- */
const GEMINI_API_KEY = ""; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

/* --- GAME VARIABLES --- */
let play1 = [], play2 = [], drawPile = [];
let topCard = '';
let isPlayerTurn = false;
let gameActive = false;
let pendingWildCard = null;
let canPlayAfterDraw = false;

// Card Deck Definition
const CARDS = [
    'R0', 'G0', 'B0', 'Y0',
    ...['R','G','B','Y'].flatMap(c => Array(2).fill().flatMap((_,i) => Array(9).fill().map((_,j) => c+(j+1)))),
    ...['R','G','B','Y'].flatMap(c => Array(2).fill(c+'-D2')),
    ...Array(4).fill('W-W'), ...Array(4).fill('W-D4')
];

/* --- UI HELPERS --- */
function switchScene(fromId, toId) {
    document.getElementById(fromId).classList.remove('active');
    setTimeout(() => {
        document.getElementById(toId).classList.add('active');
    }, 500);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    const txt = document.getElementById('toast-msg');
    txt.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, -50%) scale(1)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -150%) scale(0.9)';
    }, 2000);
}

function getCardParts(code) {
    if (!code) return { color: 'gray', value: '?', display: '?' };
    
    let colorCode = code.startsWith('W-') && code.length > 2 ? code[2] : (code[0] || 'W');
    let valueRaw = code.startsWith('W-') && code.length > 4 ? code.substring(4) : (code.includes('-') ? code.substring(2) : code.substring(1));
    
    let display = valueRaw;
    if(valueRaw === 'D2') display = '+2';
    if(valueRaw === 'D4') display = '+4';
    
    return { color: colorCode, value: valueRaw, display: display };
}

function renderCardHTML(code, isPlayable, onClick) {
    const { color, display } = getCardParts(code);
    
    let bgClass = 'bg-black-card';
    let textClass = 'text-white';
    
    if (color === 'R') { bgClass = 'bg-red-card'; textClass = 'text-R'; }
    if (color === 'G') { bgClass = 'bg-green-card'; textClass = 'text-G'; }
    if (color === 'B') { bgClass = 'bg-blue-card'; textClass = 'text-B'; }
    if (color === 'Y') { bgClass = 'bg-yellow-card'; textClass = 'text-Y'; }
    if (color === 'W') { bgClass = 'bg-wild-card'; textClass = 'text-W'; }

    return `
    <div class="uno-card ${bgClass} ${isPlayable ? 'card-clickable' : 'opacity-70 grayscale-[0.3]'} transform transition-transform" 
         style="margin-right: -45px;"
         onclick="${isPlayable ? onClick : ''}">
        <span class="card-corner top-left">${display}</span>
        <div class="card-oval"><span class="card-main-value ${textClass}">${display}</span></div>
        <span class="card-corner bottom-right">${display}</span>
    </div>`;
}

/* --- GAME ENGINE --- */

function startGame() {
    let deck = [...CARDS].sort(() => Math.random() - 0.5);
    play1 = deck.splice(0, 7);
    play2 = deck.splice(0, 7);
    drawPile = deck;

    // First card logic
    do {
        topCard = drawPile.pop();
        if(topCard.includes('-D') || topCard.startsWith('W-D4')) {
            drawPile.unshift(topCard); 
            drawPile.sort(() => Math.random() - 0.5);
            topCard = '';
        }
    } while(!topCard);

    // Handle initial Wild (W-W)
    if(topCard === 'W-W') {
         const colors = ['R','G','B','Y'];
         const randColor = colors[Math.floor(Math.random()*4)];
         topCard = `W-${randColor}-W`;
    }

    gameActive = true;
    isPlayerTurn = true;
    
    switchScene('scene-menu', 'scene-game');
    renderGame();
    showToast("Your Turn!");
}

function playCard(card) {
    if(!gameActive || !isPlayerTurn || pendingWildCard) return;

    const { color: cC, value: cV } = getCardParts(card);
    const { color: tC, value: tV } = getCardParts(topCard);

    // Validation
    const isValid = (cC === 'W') || (cC === tC) || (cV === tV);
    if(!isValid) return;

    // Remove from hand
    play1.splice(play1.indexOf(card), 1);
    canPlayAfterDraw = false;

    // Check Wild
    if(card.startsWith('W')) {
        pendingWildCard = card;
        document.getElementById('modal-color').classList.remove('hidden');
        document.getElementById('modal-color').classList.add('flex');
        renderGame();
        return;
    }

    // Normal Play
    topCard = card;
    handlePostPlay(card, 'P1');
}

function selectWildColor(color) {
    const rawVal = getCardParts(pendingWildCard).value;
    topCard = `W-${color}-${rawVal}`; // e.g., W-R-D4
    pendingWildCard = null;
    
    document.getElementById('modal-color').classList.add('hidden');
    document.getElementById('modal-color').classList.remove('flex');

    handlePostPlay(topCard, 'P1');
}

function handlePostPlay(card, player) {
    if(checkWin()) return;

    const { value } = getCardParts(card);
    let skipTurn = false;
    let opponent = player === 'P1' ? play2 : play1;

    if(value === 'D2') {
        opponent.push(drawPile.pop(), drawPile.pop());
        showToast(player === 'P1' ? "Bot Draws 2!" : "You Draw 2!");
        skipTurn = true;
    } else if(value === 'D4') {
         for(let i=0; i<4; i++) if(drawPile.length) opponent.push(drawPile.pop());
         showToast(player === 'P1' ? "Bot Draws 4!" : "You Draw 4!");
         skipTurn = true;
    }

    renderGame();

    if(skipTurn) {
        if(player === 'P1') {
            showToast("Play Again!");
            isPlayerTurn = true; 
            renderGame();
        } else {
            showToast("Bot Plays Again!");
            setTimeout(botTurn, 1500);
        }
    } else {
        // Switch Turn
        if(player === 'P1') {
            isPlayerTurn = false;
            document.getElementById('bot-status').textContent = "Thinking...";
            renderGame();
            setTimeout(botTurn, 1500);
        } else {
            isPlayerTurn = true;
            document.getElementById('bot-status').textContent = "Waiting...";
            showToast("Your Turn");
            renderGame();
        }
    }
}

function drawCard() {
    if(!gameActive || !isPlayerTurn || canPlayAfterDraw) return;
    
    if(drawPile.length === 0) {
        drawPile = [...CARDS].sort(()=>Math.random()-0.5); 
    }

    const newCard = drawPile.pop();
    play1.push(newCard);
    canPlayAfterDraw = true;
    showToast("Drew Card");
    
    // Auto scroll
    const box = document.getElementById('player-cards');
    setTimeout(() => box.scrollLeft = box.scrollWidth, 100);
    
    renderGame();
}

function skipDrawnTurn() {
    canPlayAfterDraw = false;
    isPlayerTurn = false;
    document.getElementById('bot-status').textContent = "Thinking...";
    renderGame();
    setTimeout(botTurn, 1000);
}

function botTurn() {
    if(!gameActive) return;

    // 1. Filter Playable
    const { color: tC, value: tV } = getCardParts(topCard);
    const playable = play2.filter(c => {
        const { color: cC, value: cV } = getCardParts(c);
        return cC === 'W' || cC === tC || cV === tV;
    });

    if(playable.length > 0) {
        // Simple AI: Prioritize Actions -> Numbers
        playable.sort((a,b) => {
            if(a.includes('D4')) return -1;
            if(b.includes('D4')) return 1;
            return 0;
        });
        
        const choice = playable[0];
        play2.splice(play2.indexOf(choice), 1);
        
        // Handle Wild Choice
        if(choice.startsWith('W')) {
            const colors = ['R','G','B','Y'];
            const picked = colors[Math.floor(Math.random()*4)];
            const rawVal = getCardParts(choice).value;
            topCard = `W-${picked}-${rawVal}`;
        } else {
            topCard = choice;
        }
        
        handlePostPlay(topCard, 'Bot');

    } else {
        // Bot Draws
        if(drawPile.length) {
            play2.push(drawPile.pop());
            showToast("Bot Drew Card");
        }
        isPlayerTurn = true;
        document.getElementById('bot-status').textContent = "Waiting...";
        renderGame();
    }
}

function checkWin() {
    if(play1.length === 0) {
        document.getElementById('winner-text').textContent = "YOU WIN!";
        document.getElementById('modal-gameover').classList.remove('hidden');
        document.getElementById('modal-gameover').classList.add('flex');
        gameActive = false;
        return true;
    }
    if(play2.length === 0) {
        document.getElementById('winner-text').textContent = "BOT WINS!";
        document.getElementById('winner-text').className = "text-6xl md:text-8xl font-black text-red-500 mb-6";
        document.getElementById('modal-gameover').classList.remove('hidden');
        document.getElementById('modal-gameover').classList.add('flex');
        gameActive = false;
        return true;
    }
    return false;
}

function renderGame() {
    document.getElementById('p2-count').textContent = play2.length;
    
    // Render Top Card
    const topDiv = document.getElementById('top-card-container');
    if(topCard) {
        topDiv.innerHTML = renderCardHTML(topCard, false, '');
        topDiv.firstElementChild.style.marginRight = '0';
        topDiv.firstElementChild.classList.add('active-turn');
        topDiv.firstElementChild.classList.remove('opacity-70', 'grayscale-[0.3]');
    }

    // Render Hand
    const handDiv = document.getElementById('player-cards');
    handDiv.innerHTML = '';
    
    // Sort hand: Color then Value
    play1.sort();

    const { color: tC, value: tV } = getCardParts(topCard);
    
    play1.forEach(c => {
        const { color: cC, value: cV } = getCardParts(c);
        // Check playability
        const isMatch = (cC === 'W') || (cC === tC) || (cV === tV);
        const canPlay = isPlayerTurn && !pendingWildCard && (isMatch || canPlayAfterDraw);
        
        handDiv.innerHTML += renderCardHTML(c, canPlay, `playCard('${c}')`);
    });

    // Button States
    document.getElementById('skip-btn').disabled = !canPlayAfterDraw;
    document.getElementById('draw-btn-container').style.opacity = (isPlayerTurn && !canPlayAfterDraw) ? '1' : '0.5';
    document.getElementById('draw-btn-container').style.pointerEvents = (isPlayerTurn && !canPlayAfterDraw) ? 'auto' : 'none';
}

async function getStrategyAdvice() {
    const btn = document.getElementById('strategy-btn');
    const out = document.getElementById('strategy-output');
    if(!isPlayerTurn) return;
    
    btn.disabled = true;
    out.textContent = "Analyzing...";
    
    const handStr = play1.join(',');
    const prompt = `UNO strategy. Top: ${topCard}. Hand: ${handStr}. Suggest 1 best card code to play or 'Draw'. Max 5 words.`;

    try {
        const res = await fetch(GEMINI_API_URL, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        out.textContent = data.candidates[0].content.parts[0].text;
    } catch(e) {
        out.textContent = "AI Error";
    }
    btn.disabled = false;
}