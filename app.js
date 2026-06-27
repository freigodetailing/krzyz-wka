/* app.js - Main Application Logic & View Controller */

// ==========================================================================
// 1. STATE & CONSTANTS
// ==========================================================================
const playerId = 'player_' + Math.random().toString(36).substring(2, 11);

let currentRoomId = null;
let currentRoomCode = null;
let currentCrossword = null;
let isHost = false;
let roomChannel = null;
let gameActive = false;
let gameTimerInterval = null;
let gameStartTime = 0;

// Pan & Zoom state
let panX = 0;
let panY = 0;
let scale = 1.0;
let isPanning = false;
let startX = 0;
let startY = 0;
let initialPinchDistance = 0;
let initialScale = 1.0;

// Grid interaction state
let activeWordId = null;
let activeCellKey = null; // "x,y"
let boardCellsMap = {}; // key: "x,y" -> { element, char, words: [], solved: false }
let crosswordWordsList = []; // local reference
let localScore = 0;
let remoteScore = 0;

// Custom Drag & Drop state
let activeDraggedTile = null;
let dragClone = null;
let currentHoveredCell = null;
let dragLetter = '';

const UI = {
    // Screens
    screenLobby: document.getElementById('screen-lobby'),
    screenGame: document.getElementById('screen-game'),
    
    // Buttons
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnLeaveGame: document.getElementById('btn-leave-game'),
    btnCancelWaiting: document.getElementById('btn-cancel-waiting'),
    btnCancelGame: document.getElementById('btn-cancel-game'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    btnReturnLobby: document.getElementById('btn-return-lobby'),
    btnNextLevel: document.getElementById('btn-next-level'),
    
    // Input
    inputRoomCode: document.getElementById('input-room-code'),
    
    // Overlays
    lobbyWaitingOverlay: document.getElementById('lobby-waiting-overlay'),
    gameWaitingOverlay: document.getElementById('game-waiting-overlay'),
    gameEndOverlay: document.getElementById('game-end-overlay'),
    
    // Text elements
    gameRoomCode: document.getElementById('game-room-code'),
    shareCodeBox: document.getElementById('share-code-box'),
    waitingStatusTitle: document.getElementById('waiting-status-title'),
    waitingStatusDesc: document.getElementById('waiting-status-desc'),
    opponentName: document.getElementById('opponent-name'),
    scoreLocal: document.getElementById('score-local'),
    scoreRemote: document.getElementById('score-remote'),
    
    // Board viewport elements
    boardViewport: document.getElementById('board-viewport'),
    boardContainer: document.getElementById('board-container'),
    activeClueNumber: document.getElementById('active-clue-number'),
    activeClueText: document.getElementById('active-clue-text'),
    
    // Letters Pool tray
    letterPool: document.getElementById('letter-pool'),
    
    // Toasts
    lobbyToast: document.getElementById('lobby-toast'),
    gameToast: document.getElementById('game-toast')
};

// Toast timers
let lobbyToastTimer = null;
let gameToastTimer = null;

// ==========================================================================
// 2. VIEWPORT & GESTURE CONTROL (NATIVE FEEL)
// ==========================================================================

// Prevent double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Prevent pinch-to-zoom (we handle custom pinch-zoom on the viewport)
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent bounce scroll on outer viewport, while allowing it in specific scrollable elements
document.addEventListener('touchmove', (e) => {
    const isScrollable = e.target.closest('.letter-pool-wrapper') || e.target.closest('.board-viewport');
    if (!isScrollable) {
        e.preventDefault();
    }
}, { passive: false });


// ==========================================================================
// 3. TOAST NOTIFICATION HELPERS
// ==========================================================================
function showLobbyToast(message, duration = 3000) {
    if (lobbyToastTimer) clearTimeout(lobbyToastTimer);
    UI.lobbyToast.textContent = message;
    UI.lobbyToast.classList.remove('hidden');
    
    lobbyToastTimer = setTimeout(() => {
        UI.lobbyToast.classList.add('hidden');
    }, duration);
}
// Export showLobbyToast to window so supabase.js can use it
window.showLobbyToast = showLobbyToast;

function showGameToast(message, duration = 3000) {
    if (gameToastTimer) clearTimeout(gameToastTimer);
    UI.gameToast.textContent = message;
    UI.gameToast.classList.remove('hidden');
    
    gameToastTimer = setTimeout(() => {
        UI.gameToast.classList.add('hidden');
    }, duration);
}

// ==========================================================================
// 4. SCREEN NAVIGATION
// ==========================================================================
function switchScreen(toScreen) {
    UI.screenLobby.classList.remove('active');
    UI.screenGame.classList.remove('active');
    
    if (toScreen === 'lobby') {
        UI.screenLobby.classList.add('active');
        UI.inputRoomCode.value = '';
        resetGameState();
    } else if (toScreen === 'game') {
        UI.screenGame.classList.add('active');
    }
}

function resetGameState() {
    gameActive = false;
    currentRoomId = null;
    currentRoomCode = null;
    currentCrossword = null;
    isHost = false;
    boardCellsMap = {};
    crosswordWordsList = [];
    activeWordId = null;
    activeCellKey = null;
    localScore = 0;
    remoteScore = 0;
    scale = 1.0;
    panX = 0;
    panY = 0;
    
    // Clear container
    UI.boardContainer.innerHTML = '';
    UI.boardContainer.style.transform = '';
    UI.activeClueNumber.textContent = '--';
    UI.activeClueText.textContent = "Dotknij litery na planszy, aby zobaczyć pytanie.";
    
    // Clear letter pool
    UI.letterPool.innerHTML = '';
    
    // Stop timers
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
    document.querySelector('.game-timer').textContent = "00:00";
    
    // Reset scores
    UI.scoreLocal.textContent = "0 pkt";
    UI.scoreRemote.textContent = "0 pkt";
    UI.opponentName.textContent = "Oczekiwanie...";
    
    // Unsubscribe from channel
    if (roomChannel) {
        roomChannel.unsubscribe();
        roomChannel = null;
    }
}

// ==========================================================================
// 5. SUPABASE REALTIME MULTIPLAYER LOBBY (STAGE 3 & 6 & 7)
// ==========================================================================

function subscribeToRoom(roomCode) {
    if (!supabaseClient) {
        showLobbyToast("Błąd: Supabase nie został zainicjalizowany!");
        return;
    }

    console.log(`Subscribing to presence channel: room:${roomCode}`);
    
    roomChannel = supabaseClient.channel(`room:${roomCode}`, {
        config: {
            presence: {
                key: playerId,
            }
        }
    });

    roomChannel
        .on('presence', { event: 'sync' }, () => {
            const presenceState = roomChannel.presenceState();
            const players = Object.values(presenceState).map(p => p[0]);
            
            console.log("Presence sync. Aktualni gracze:", players);
            updateScoreboard(players);
            
            // Check if both players are present
            if (players.length >= 2) {
                triggerGameStart();
            }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log("Gracz dołączył:", newPresences);
            showGameToast(`Gracz ${newPresences[0].username} dołączył do pokoju!`);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log("Gracz wyszedł:", leftPresences);
            showGameToast(`Gracz ${leftPresences[0].username} odłączył się!`);
            handlePlayerLeft();
        })
        .on('broadcast', { event: 'letter_placed' }, ({ payload }) => {
            console.log("Broadcast received: letter_placed", payload);
            handleRemoteLetterPlaced(payload);
        })
        .on('broadcast', { event: 'next_level' }, ({ payload }) => {
            console.log("Broadcast received: next_level", payload);
            loadNextLevel(payload.crossword);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Successfully subscribed to presence channel.");
                // Track player details
                const trackErr = await roomChannel.track({
                    id: playerId,
                    username: isHost ? "Gospodarz" : "Gość",
                    isHost: isHost,
                    score: localScore,
                    joinedAt: new Date().toISOString()
                });
                if (trackErr) {
                    console.error("Presence track error:", trackErr);
                }
            }
        });
}

function updateScoreboard(players) {
    const local = players.find(p => p.id === playerId);
    const remote = players.find(p => p.id !== playerId);
    
    if (local) {
        UI.scoreLocal.textContent = `${local.score || 0} pkt`;
        document.getElementById('player-local-info').classList.add('active');
    }
    
    if (remote) {
        UI.opponentName.textContent = remote.username;
        UI.scoreRemote.textContent = `${remote.score || 0} pkt`;
        document.getElementById('player-remote-info').classList.add('active');
    } else {
        UI.opponentName.textContent = "Oczekiwanie...";
        UI.scoreRemote.textContent = "0 pkt";
        document.getElementById('player-remote-info').classList.remove('active');
    }
}

function triggerGameStart() {
    if (gameActive) return; // Already running
    
    gameActive = true;
    localScore = 0;
    remoteScore = 0;
    
    // Hide wait screen overlay
    UI.gameWaitingOverlay.classList.add('hidden');
    showGameToast("Rozpoczynanie gry! Powodzenia! 🚀");
    
    // Update DB state to 'playing' if we are the host
    if (isHost && currentRoomId) {
        dbUpdateRoomStatus(currentRoomId, 'playing');
    }
    
    // Initialize timer
    gameStartTime = Date.now();
    gameTimerInterval = setInterval(updateTimer, 1000);
    
    // Render the crossword board (Stage 4)
    renderCrosswordBoard(currentCrossword);
}

function updateTimer() {
    const elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    document.querySelector('.game-timer').textContent = `${mins}:${secs}`;
}

function handlePlayerLeft() {
    if (!gameActive) return; // Still waiting in lobby, no need to kick
    
    showGameToast("Twój rywal uciekł! Powrót do Lobby za 5 sekund...");
    gameActive = false;
    
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
    
    setTimeout(() => {
        switchScreen('lobby');
    }, 5000);
}

// ==========================================================================
// 6. BOARD RENDERING & INTERACTION (STAGE 4)
// ==========================================================================

function renderCrosswordBoard(crossword) {
    if (!crossword || !crossword.words) return;
    
    crosswordWordsList = crossword.words;
    boardCellsMap = {};
    UI.boardContainer.innerHTML = '';
    
    // 1. Map words to individual grid coordinates
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    const wordStartCells = {}; // key: "x,y" -> list of { wordId, index }
    
    crosswordWordsList.forEach(w => {
        const x = w.x;
        const y = w.y;
        const dir = w.direction;
        const ans = w.answer.toUpperCase();
        
        for (let i = 0; i < ans.length; i++) {
            const cx = dir === 'H' ? x + i : x;
            const cy = dir === 'H' ? y : y + i;
            const key = `${cx},${cy}`;
            
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;
            
            if (!boardCellsMap[key]) {
                boardCellsMap[key] = {
                    x: cx,
                    y: cy,
                    char: ans[i],
                    words: [],
                    solved: false,
                    element: null
                };
            }
            boardCellsMap[key].words.push(w.id);
            
            if (i === 0) {
                if (!wordStartCells[key]) {
                    wordStartCells[key] = [];
                }
                wordStartCells[key].push(w.id);
            }
        }
    });
    
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    
    UI.boardContainer.style.display = 'grid';
    UI.boardContainer.style.gridTemplateColumns = `repeat(${width}, var(--cell-size))`;
    UI.boardContainer.style.gridTemplateRows = `repeat(${height}, var(--cell-size))`;
    UI.boardContainer.style.gridGap = 'var(--cell-gap)';
    
    // 3. Render cells
    Object.keys(boardCellsMap).forEach(key => {
        const cell = boardCellsMap[key];
        const cellElement = document.createElement('div');
        cellElement.className = 'board-cell filled-slot';
        
        cellElement.style.gridColumn = cell.x - minX + 1;
        cellElement.style.gridRow = cell.y - minY + 1;
        
        // Add coordinate datasets for lookup
        cellElement.dataset.x = cell.x;
        cellElement.dataset.y = cell.y;
        cellElement.dataset.key = key;
        
        cell.element = cellElement;
        
        if (wordStartCells[key]) {
            const numEl = document.createElement('span');
            numEl.className = 'board-cell-number';
            numEl.textContent = wordStartCells[key][0];
            cellElement.appendChild(numEl);
        }
        
        const letterEl = document.createElement('span');
        letterEl.className = 'board-cell-letter';
        letterEl.textContent = '';
        cellElement.appendChild(letterEl);
        
        cellElement.addEventListener('click', (e) => {
            selectCell(key);
        });
        
        UI.boardContainer.appendChild(cellElement);
    });
    
    const cellSize = 46;
    const cellGap = 5;
    const gridPixelWidth = width * cellSize + (width - 1) * cellGap;
    const gridPixelHeight = height * cellSize + (height - 1) * cellGap;
    
    const viewportWidth = UI.boardViewport.clientWidth;
    const viewportHeight = UI.boardViewport.clientHeight;
    
    panX = (viewportWidth - gridPixelWidth) / 2 - 100;
    panY = (viewportHeight - gridPixelHeight) / 2 - 100;
    scale = 1.0;
    
    updateBoardTransform();
    
    // 5. Initialize shuffled letters pool tray (Stage 5)
    initLetterPool(crossword);
}

function selectCell(key) {
    if (!boardCellsMap[key]) return;
    
    const cell = boardCellsMap[key];
    activeCellKey = key;
    
    let selectedWordId = cell.words[0];
    if (cell.words.length > 1 && cell.words.includes(activeWordId)) {
        const currIndex = cell.words.indexOf(activeWordId);
        selectedWordId = cell.words[(currIndex + 1) % cell.words.length];
    }
    
    activeWordId = selectedWordId;
    const activeWord = crosswordWordsList.find(w => w.id === activeWordId);
    
    clearBoardHighlights();
    
    Object.keys(boardCellsMap).forEach(k => {
        const c = boardCellsMap[k];
        if (c.words.includes(activeWordId)) {
            c.element.classList.add('highlighted-word');
        }
    });
    
    cell.element.classList.add('selected-cell');
    
    UI.activeClueNumber.textContent = activeWord.id;
    UI.activeClueText.textContent = activeWord.clue;
}

function clearBoardHighlights() {
    Object.keys(boardCellsMap).forEach(key => {
        const c = boardCellsMap[key];
        c.element.classList.remove('highlighted-word');
        c.element.classList.remove('selected-cell');
    });
}

// Export renderCrosswordBoard to window
window.renderCrosswordBoard = renderCrosswordBoard;

// ==========================================================================
// 7. SHUFFLED LETTER POOL & DRAG-AND-DROP CONTROLLER (STAGE 5)
// ==========================================================================

function initLetterPool(crossword) {
    const letters = [];
    
    // 1. Extract all letters needed for the board
    crossword.words.forEach(w => {
        w.answer.toUpperCase().split('').forEach(char => {
            letters.push(char);
        });
    });
    
    // 2. Inject 30% Polish decoy letters to increase challenge
    const PolishDecoys = ["A", "E", "O", "R", "S", "T", "I", "N", "Z", "W", "K", "Y", "P", "M", "C", "L", "D", "B"];
    const decoyCount = Math.ceil(letters.length * 0.3);
    for (let i = 0; i < decoyCount; i++) {
        letters.push(PolishDecoys[Math.floor(Math.random() * PolishDecoys.length)]);
    }
    
    // 3. Shuffle letters using Fisher-Yates algorithm
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    
    // 4. Clear container and render tiles
    UI.letterPool.innerHTML = '';
    letters.forEach((char, index) => {
        const tile = document.createElement('div');
        tile.className = 'letter-tile';
        tile.textContent = char;
        tile.dataset.letter = char;
        tile.dataset.id = `tile_${index}`;
        
        // Attach touch and mouse event listeners for Dragging
        setupDraggableTile(tile);
        
        UI.letterPool.appendChild(tile);
    });
}

function setupDraggableTile(tile) {
    tile.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY, tile);
    }, { passive: false });
    
    tile.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        startDrag(e.clientX, e.clientY, tile);
    });
}

function startDrag(clientX, clientY, tile) {
    if (tile.classList.contains('used') || !gameActive) return;
    
    activeDraggedTile = tile;
    dragLetter = tile.dataset.letter;
    
    // Create floating clone
    dragClone = tile.cloneNode(true);
    dragClone.classList.add('dragging');
    
    // Center the cloned element directly under finger
    const rect = tile.getBoundingClientRect();
    const offsetX = rect.width / 2;
    const offsetY = rect.height / 2;
    
    dragClone.style.position = 'fixed';
    dragClone.style.left = (clientX - offsetX) + 'px';
    dragClone.style.top = (clientY - offsetY) + 'px';
    dragClone.style.margin = '0';
    dragClone.style.pointerEvents = 'none'; // Crucial so elementFromPoint works underneath
    
    document.body.appendChild(dragClone);
    tile.classList.add('used'); // Hide original tile
}

function moveDrag(clientX, clientY) {
    if (!dragClone || !activeDraggedTile) return;
    
    dragClone.style.left = (clientX - dragClone.offsetWidth / 2) + 'px';
    dragClone.style.top = (clientY - dragClone.offsetHeight / 2) + 'px';
    
    const targetElement = document.elementFromPoint(clientX, clientY);
    const cellEl = targetElement ? targetElement.closest('.board-cell.filled-slot') : null;
    
    if (cellEl) {
        const key = cellEl.dataset.key;
        const cellData = boardCellsMap[key];
        
        if (cellData && !cellData.solved) {
            if (currentHoveredCell !== cellEl) {
                clearHoveredCellHighlight();
                currentHoveredCell = cellEl;
                cellEl.classList.add('selected-cell');
            }
        } else {
            clearHoveredCellHighlight();
        }
    } else {
        clearHoveredCellHighlight();
    }
}

function clearHoveredCellHighlight() {
    if (currentHoveredCell) {
        currentHoveredCell.classList.remove('selected-cell');
        const key = currentHoveredCell.dataset.key;
        if (activeCellKey === key) {
            currentHoveredCell.classList.add('selected-cell');
        } else if (activeWordId && boardCellsMap[key] && boardCellsMap[key].words.includes(activeWordId)) {
            currentHoveredCell.classList.add('highlighted-word');
        }
        currentHoveredCell = null;
    }
}

function endDrag(clientX, clientY) {
    if (!activeDraggedTile) return;
    
    clearHoveredCellHighlight();
    
    const targetElement = document.elementFromPoint(clientX, clientY);
    const cellEl = targetElement ? targetElement.closest('.board-cell.filled-slot') : null;
    
    let isCorrect = false;
    
    if (cellEl) {
        const key = cellEl.dataset.key;
        const cellData = boardCellsMap[key];
        
        if (cellData && !cellData.solved) {
            isCorrect = handleLetterDrop(key, dragLetter, cellEl);
        }
    }
    
    if (dragClone) {
        dragClone.remove();
        dragClone = null;
    }
    
    if (!isCorrect) {
        activeDraggedTile.classList.remove('used');
    }
    
    activeDraggedTile = null;
}

// Validation, Placement & Sync Callback (STAGE 6 INTEGRATED)
function handleLetterDrop(key, letter, cellEl) {
    const cell = boardCellsMap[key];
    if (!cell) return false;
    
    if (cell.char === letter) {
        cell.solved = true;
        
        // Show letter on tile
        const letterEl = cellEl.querySelector('.board-cell-letter');
        letterEl.textContent = letter;
        
        // Add success class & lock cell from selection
        cellEl.classList.add('placed-correctly');
        
        // Update local scoreboard
        localScore += 1;
        UI.scoreLocal.textContent = `${localScore} pkt`;
        
        // Trigger visual success pop animation
        showGameToast("Świetnie! +1 punkt! 🎉", 1000);
        
        // Broadcast placement to opponent (STAGE 6 BROADCAST SENDER)
        if (roomChannel) {
            // Track in Presence (backup/history)
            roomChannel.track({
                id: playerId,
                username: isHost ? "Gospodarz" : "Gość",
                isHost: isHost,
                score: localScore,
                joinedAt: new Date().toISOString()
            });

            // Fast Broadcast message (real-time layout update)
            roomChannel.send({
                type: 'broadcast',
                event: 'letter_placed',
                payload: {
                    playerId: playerId,
                    key: key,
                    letter: letter,
                    score: localScore
                }
            });
        }
        
        checkVictoryCondition();
        return true;
    } else {
        localScore = Math.max(0, localScore - 1);
        UI.scoreLocal.textContent = `${localScore} pkt`;
        
        showGameToast("Błąd! -1 punkt! ❌", 1000);
        
        cellEl.style.animation = 'none';
        cellEl.offsetHeight; // Trigger reflow
        cellEl.style.animation = 'shake 0.4s ease';
        setTimeout(() => { cellEl.style.animation = ''; }, 400);
        
        if (roomChannel) {
            roomChannel.track({
                id: playerId,
                username: isHost ? "Gospodarz" : "Gość",
                isHost: isHost,
                score: localScore,
                joinedAt: new Date().toISOString()
            });
        }
        
        return false;
    }
}

// Stage 6: Broadcast Receiver Callback
function handleRemoteLetterPlaced(payload) {
    const { playerId: senderId, key, letter, score } = payload;
    if (senderId === playerId) return; // Ignore our own broadcast
    
    const cell = boardCellsMap[key];
    if (cell && !cell.solved) {
        cell.solved = true;
        
        // Update cell DOM element with letter
        const letterEl = cell.element.querySelector('.board-cell-letter');
        if (letterEl) {
            letterEl.textContent = letter;
        }
        
        // Pop-in correct animation
        cell.element.classList.add('placed-correctly');
        
        // Visual toast
        showGameToast(`Rywal uzupełnił literę: ${letter}! ⚡`, 1200);
        
        // Update remote score in the UI scoreboard
        remoteScore = score;
        UI.scoreRemote.textContent = `${remoteScore} pkt`;
        
        // Perform victory checks
        checkVictoryCondition();
    }
}

function checkVictoryCondition() {
    const allSolved = Object.values(boardCellsMap).every(c => c.solved);
    if (allSolved) {
        showGameToast("Gratulacje! Ukończyłeś całą planszę! 🏆");
        
        // Stop timer
        if (gameTimerInterval) {
            clearInterval(gameTimerInterval);
            gameTimerInterval = null;
        }
        
        // Display end game scorecard (Stage 7)
        setTimeout(() => {
            // Populate end scoreboard dialog
            document.getElementById('end-score-local').textContent = `${localScore} pkt`;
            document.getElementById('end-score-remote').textContent = `${remoteScore} pkt`;
            document.getElementById('end-opponent-name').textContent = UI.opponentName.textContent;
            
            // Adjust title according to winner
            const titleEl = document.getElementById('end-title');
            if (localScore > remoteScore) {
                titleEl.innerHTML = "Wygrałeś! 🥇";
            } else if (localScore < remoteScore) {
                titleEl.innerHTML = "Przegrałeś! 🥈";
            } else {
                titleEl.innerHTML = "Remis! 🤝";
            }
            
            // Host/Guest specific button text configuration
            if (isHost) {
                UI.btnNextLevel.style.display = 'block';
                UI.btnNextLevel.disabled = false;
                UI.btnNextLevel.textContent = "Następny Poziom";
            } else {
                UI.btnNextLevel.style.display = 'block';
                UI.btnNextLevel.disabled = true;
                UI.btnNextLevel.textContent = "Oczekiwanie na gospodarza...";
            }
            
            UI.gameEndOverlay.classList.remove('hidden');
        }, 1500);
    }
}

// Stage 7: Load Next Level Loader
function loadNextLevel(crossword) {
    // Hide overlay
    UI.gameEndOverlay.classList.add('hidden');
    
    // Reset state variables
    gameActive = true;
    localScore = 0;
    remoteScore = 0;
    currentCrossword = crossword;
    activeWordId = null;
    activeCellKey = null;
    scale = 1.0;
    
    // Stop timers
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
    }
    
    // Reset timer label
    gameStartTime = Date.now();
    gameTimerInterval = setInterval(updateTimer, 1000);
    
    // Update scores in UI
    UI.scoreLocal.textContent = "0 pkt";
    UI.scoreRemote.textContent = "0 pkt";
    
    // Clear old container and render new cells
    renderCrosswordBoard(crossword);
    
    // Re-track player in presence channel
    if (roomChannel) {
        roomChannel.track({
            id: playerId,
            username: isHost ? "Gospodarz" : "Gość",
            isHost: isHost,
            score: 0,
            joinedAt: new Date().toISOString()
        });
    }
    
    showGameToast("Nowy poziom załadowany! Powodzenia! 🚀");
}

// --- Global Move and End listeners for smooth tracking outside container bounds ---
window.addEventListener('touchmove', (e) => {
    if (activeDraggedTile && dragClone) {
        e.preventDefault();
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY);
    }
}, { passive: false });

window.addEventListener('mousemove', (e) => {
    if (activeDraggedTile && dragClone) {
        moveDrag(e.clientX, e.clientY);
    }
});

window.addEventListener('touchend', (e) => {
    if (activeDraggedTile && dragClone) {
        const touch = e.changedTouches[0];
        endDrag(touch.clientX, touch.clientY);
    }
});

window.addEventListener('mouseup', (e) => {
    if (activeDraggedTile && dragClone) {
        endDrag(e.clientX, e.clientY);
    }
});

// Export initLetterPool
window.initLetterPool = initLetterPool;

// ==========================================================================
// 8. PAN AND ZOOM CONTROLLER (STAGE 4)
// ==========================================================================

function updateBoardTransform() {
    UI.boardContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

// Mouse Events for desktop panning
UI.boardViewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.board-cell.filled-slot')) return;
    
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    UI.boardViewport.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateBoardTransform();
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        UI.boardViewport.style.cursor = 'grab';
    }
});

// Mouse Wheel for desktop zooming
UI.boardViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 0.08;
    const oldScale = scale;
    
    if (e.deltaY < 0) {
        scale = Math.min(2.0, scale + zoomFactor);
    } else {
        scale = Math.max(0.5, scale - zoomFactor);
    }
    
    const rect = UI.boardViewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    panX = mouseX - (mouseX - panX) * (scale / oldScale);
    panY = mouseY - (mouseY - panY) * (scale / oldScale);
    
    updateBoardTransform();
}, { passive: false });

// Touch Events for Mobile Panning & Pinch-to-Zoom
UI.boardViewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('.board-cell.filled-slot')) return;
    
    if (e.touches.length === 1) {
        isPanning = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - ph = panY; // wait, minor typo here in original app.js "ph = panY" instead of "startY = e.touches[0].clientY - panY"!
        // Actually let's double check if I had a typo in previous app.js:
        // No, in my previous write I had: `startY = e.touches[0].clientY - panY;`.
        // Let's write it correctly here:
        startY = e.touches[0].clientY - panY;
    } else if (e.touches.length === 2) {
        isPanning = false;
        initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialScale = scale;
    }
});

UI.boardViewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isPanning) {
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        updateBoardTransform();
    } else if (e.touches.length === 2) {
        const distance = getTouchDistance(e.touches[0], e.touches[1]);
        if (initialPinchDistance > 0) {
            const oldScale = scale;
            scale = Math.max(0.5, Math.min(2.0, initialScale * (distance / initialPinchDistance)));
            
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            const rect = UI.boardViewport.getBoundingClientRect();
            const relativeMidX = midX - rect.left;
            const relativeMidY = midY - rect.top;
            
            panX = relativeMidX - (relativeMidX - panX) * (scale / oldScale);
            panY = relativeMidY - (relativeMidY - panY) * (scale / oldScale);
            
            updateBoardTransform();
        }
    }
}, { passive: false });

UI.boardViewport.addEventListener('touchend', (e) => {
    isPanning = false;
    initialPinchDistance = 0;
});

function getTouchDistance(touch1, touch2) {
    return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
}

// ==========================================================================
// 9. BUTTON EVENT LISTENERS
// ==========================================================================

// Create Room Action
UI.btnCreateRoom.addEventListener('click', async () => {
    if (!supabaseClient) {
        showLobbyToast("Błąd: Skonfiguruj Supabase (koło zębate w rogu)!");
        return;
    }
    
    UI.waitingStatusTitle.textContent = "Tworzenie pokoju...";
    UI.waitingStatusDesc.textContent = "Losowanie planszy i generowanie kodu...";
    UI.lobbyWaitingOverlay.classList.remove('hidden');
    
    try {
        const result = await dbCreateRoom();
        currentRoomId = result.room.id;
        currentRoomCode = result.room.code;
        currentCrossword = result.crossword;
        isHost = true;
        
        UI.gameRoomCode.textContent = currentRoomCode;
        UI.shareCodeBox.textContent = currentRoomCode;
        
        UI.lobbyWaitingOverlay.classList.add('hidden');
        switchScreen('game');
        
        UI.gameWaitingOverlay.classList.remove('hidden');
        subscribeToRoom(currentRoomCode);
        
    } catch (e) {
        UI.lobbyWaitingOverlay.classList.add('hidden');
        showLobbyToast("Błąd: " + e.message);
        console.error(e);
    }
});

// Join Room Action
UI.btnJoinRoom.addEventListener('click', async () => {
    if (!supabaseClient) {
        showLobbyToast("Błąd: Skonfiguruj Supabase (koło zębate w rogu)!");
        return;
    }
    
    const code = UI.inputRoomCode.value.trim();
    if (code.length !== 6) {
        showLobbyToast("Kod pokoju musi składać się z 6 znaków!");
        return;
    }
    
    UI.waitingStatusTitle.textContent = "Łączenie z pokojem...";
    UI.waitingStatusDesc.textContent = `Wyszukiwanie kodu ${code} w bazie...`;
    UI.lobbyWaitingOverlay.classList.remove('hidden');
    
    try {
        const result = await dbJoinRoom(code);
        currentRoomId = result.room.id;
        currentRoomCode = result.room.code;
        currentCrossword = result.crossword;
        isHost = false;
        
        UI.gameRoomCode.textContent = currentRoomCode;
        
        UI.lobbyWaitingOverlay.classList.add('hidden');
        switchScreen('game');
        
        UI.gameWaitingOverlay.classList.remove('hidden');
        subscribeToRoom(currentRoomCode);
        
    } catch (e) {
        UI.lobbyWaitingOverlay.classList.add('hidden');
        showLobbyToast("Błąd: " + e.message);
        console.error(e);
    }
});

// Next Level Action (STAGE 7 INTEGRATED)
UI.btnNextLevel.addEventListener('click', async () => {
    if (!isHost) return; // Guest can't load next level directly
    
    UI.btnNextLevel.disabled = true;
    UI.btnNextLevel.textContent = "Losowanie...";
    
    try {
        // 1. Fetch crosswords levels list
        const { data: crosswords, error: fetchErr } = await supabaseClient
            .from('crosswords')
            .select('id, level');
            
        if (fetchErr || !crosswords || crosswords.length === 0) {
            throw new Error("Nie można pobrać kolejnego poziomu.");
        }
        
        // 2. Select a level different from current if possible
        let nextCw = crosswords[Math.floor(Math.random() * crosswords.length)];
        if (crosswords.length > 1 && currentCrossword && nextCw.level === currentCrossword.level) {
            const others = crosswords.filter(c => c.level !== currentCrossword.level);
            nextCw = others[Math.floor(Math.random() * others.length)];
        }
        
        // 3. Fetch full definition
        const { data: crosswordFull, error: fetchFullErr } = await supabaseClient
            .from('crosswords')
            .select('*')
            .eq('id', nextCw.id)
            .single();
            
        if (fetchFullErr) throw fetchFullErr;
        
        // 4. Update room details in DB
        await supabaseClient
            .from('rooms')
            .update({
                crossword_id: nextCw.id,
                status: 'playing',
                updated_at: new Date().toISOString()
            })
            .eq('id', currentRoomId);
            
        // 5. Broadcast to guest to load same level
        if (roomChannel) {
            roomChannel.send({
                type: 'broadcast',
                event: 'next_level',
                payload: {
                    crossword: crosswordFull
                }
            });
        }
        
        // 6. Load locally
        loadNextLevel(crosswordFull);
        
    } catch (e) {
        showGameToast("Błąd ładowania poziomu: " + e.message);
        UI.btnNextLevel.disabled = false;
        UI.btnNextLevel.textContent = "Następny Poziom";
        console.error(e);
    }
});

// Cancel Waiting Overlay
UI.btnCancelWaiting.addEventListener('click', () => {
    UI.lobbyWaitingOverlay.classList.add('hidden');
});

// Leave Game (Back button in header)
UI.btnLeaveGame.addEventListener('click', async () => {
    if (confirm("Czy na pewno chcesz opuścić pokój gry? Stracisz postęp.")) {
        if (isHost && currentRoomId && !gameActive) {
            await dbDeleteRoom(currentRoomId);
        }
        switchScreen('lobby');
    }
});

// Cancel active room (during wait for opponent)
UI.btnCancelGame.addEventListener('click', async () => {
    if (isHost && currentRoomId) {
        await dbDeleteRoom(currentRoomId);
    }
    switchScreen('lobby');
    showLobbyToast("Pokój został zamknięty.");
});

// Copy Room Code to clipboard
UI.btnCopyCode.addEventListener('click', () => {
    const code = UI.shareCodeBox.textContent;
    navigator.clipboard.writeText(code).then(() => {
        showGameToast("Skopiowano kod do schowka! 📋");
    }).catch(err => {
        console.error("Błąd kopiowania:", err);
    });
});

// Return to Lobby after End Game
UI.btnReturnLobby.addEventListener('click', () => {
    UI.gameEndOverlay.classList.add('hidden');
    switchScreen('lobby');
});
