/* app.js - Main Application Logic & View Controller */

// ==========================================================================
// 1. STATE & CONSTANTS
// ==========================================================================
const playerId = 'player_' + Math.random().toString(36).substring(2, 11);

let currentRoomId = null;
let currentRoomCode = null;
let currentCrossword = null;
let isHost = false;
let isSolo = false;
let activeDirection = 'H'; // 'H' or 'V'
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
let activeCellKey = null; // "x,y"
let boardCellsMap = {}; // key: "x,y" -> { element, char, type, solved: false, text, image, arrow }
let localScore = 0;
let remoteScore = 0;

// Shuffled letters tray pool
let letterPoolQueue = [];
let activeTrayTiles = [];

// Fallback local crossword levels for Offline / Solo Play
const LOCAL_CROSSWORDS = [];
for (let i = 1; i <= 50; i++) {
    LOCAL_CROSSWORDS.push({
        level: i,
        name: `Łamigłówka ${i}`,
        words: {}
    });
}

// 50 9-letter spine words for level generation
const SPINE_WORDS = [
    { ans: "PODMORSKI", clue: "Przydenny oceaniczny" },
    { ans: "KOSMONAUT", clue: "Lata w kosmos" },
    { ans: "KOMPUTERY", clue: "Elektroniczne urządzenia" },
    { ans: "CZEKOLADA", clue: "Kakaowy przysmak" },
    { ans: "TELEWIZOR", clue: "Ekran w salonie" },
    { ans: "SAMOCHODY", clue: "Pojazdy czterokołowe" },
    { ans: "DŁUGOPISY", clue: "Przybory do pisania" },
    { ans: "SAMOLOCIK", clue: "Mały płatowiec" },
    { ans: "POMIDOREK", clue: "Czerwone warzywo na zupę" },
    { ans: "MATEMATYK", clue: "Naukowiec od liczb" },
    { ans: "PIEKARNIK", clue: "Kuchnia: piecze ciasta" },
    { ans: "KORYTARZE", clue: "Przejścia w budynku" },
    { ans: "MATERACYK", clue: "Posłanie do spania" },
    { ans: "NALEŚNIKI", clue: "Smażone okrągłe placki" },
    { ans: "KALENDARZ", clue: "Wskazuje dni roku" },
    { ans: "KRAJOBRAZ", clue: "Pejzaż, widok natury" },
    { ans: "GIMNASTYK", clue: "Sprawny sportowiec" },
    { ans: "NARCIARZE", clue: "Zjeżdżają po śniegu" },
    { ans: "BRAMKARZE", clue: "Pilnują futbolowej bramki" },
    { ans: "SIATKÓWKA", clue: "Gra z piłką przez siatkę" },
    { ans: "PŁYWACKI", clue: "Związany z basenem" },
    { ans: "RATOWNICY", clue: "Ratują na plaży" },
    { ans: "UCZNIOWIE", clue: "Uczą się w klasach" },
    { ans: "STUDENTKI", clue: "Dziewczyny na uczelni" },
    { ans: "OŁÓWECZEK", clue: "Mały przybór grafitowy" },
    { ans: "MALARSKI", clue: "Związany ze sztuką pędzla" },
    { ans: "RZEŹBIARZ", clue: "Tworzy w glinie lub kamieniu" },
    { ans: "MUZYKALNY", clue: "Posiada talent muzyczny" },
    { ans: "KONCERCIK", clue: "Mały występ na scenie" },
    { ans: "FESTIWALE", clue: "Duże imprezy artystyczne" },
    { ans: "SPEKTAKL", clue: "Przedstawienie w teatrze" },
    { ans: "AKTORSTWO", clue: "Sztuka odgrywania scen" },
    { ans: "REŻYSERIA", clue: "Kierowanie filmem" },
    { ans: "PODRÓŻNIK", clue: "Zwiedza odległe kraje" },
    { ans: "TURYSTYKA", clue: "Podróże dla wypoczynku" },
    { ans: "WAKACYJNY", clue: "Urlopowy, letni" },
    { ans: "PRZYGODNY", clue: "Napotkany przypadkowo" },
    { ans: "REKREACJA", clue: "Odpoczynek na powietrzu" },
    { ans: "ZDROWOTNY", clue: "Dobry dla organizmu" },
    { ans: "MEDYCZNY", clue: "Związany z leczeniem" },
    { ans: "DENTYSTKA", clue: "Leczy zęby" },
    { ans: "SZPITALNY", clue: "Związany z lecznicą" },
    { ans: "PACJENTKA", clue: "Kobieta u doktora" },
    { ans: "CHOROWITY", clue: "Często łapie przeziębienie" },
    { ans: "LEKARSTWO", clue: "Preparat na zdrowie" },
    { ans: "WITAMINKA", clue: "Odżywczy element owocu" },
    { ans: "JABŁUSZKO", clue: "Mały owoc z jabłoni" },
    { ans: "TRUSKAWKA", clue: "Czerwony owoc z działki" },
    { ans: "MALINOWY", clue: "Smak leśnego owocu" },
    { ans: "PIEKARNIA", clue: "Pieką tam świeży chleb" }
];

// Vocabulary mapping of horizontal words starting with each Polish letter
const HORIZONTAL_WORDS = {
    'A': [
        { ans: "ANALOG", clue: "Niecyfrowy" },
        { ans: "ANANAS", clue: "Tropikalny owoc" },
        { ans: "ADRES", clue: "Gdzie mieszkasz" },
        { ans: "AKTOR", clue: "Gra w filmie" },
        { ans: "ALIBI", clue: "Dowód niewinności" }
    ],
    'B': [
        { ans: "BANAN", clue: "Żółty owoc" },
        { ans: "BRAMA", clue: "Wjazd na posesję" },
        { ans: "BUCIK", clue: "Mały kapeć" },
        { ans: "BALON", clue: "Lata w powietrzu" },
        { ans: "BURZA", clue: "Grom i błyskawice" }
    ],
    'C': [
        { ans: "CEBULA", clue: "Warzywo" },
        { ans: "CIASTO", clue: "Słodki wypiek" },
        { ans: "CUKIER", clue: "Słodzi herbatę" },
        { ans: "CZAJNIK", clue: "Gotuje wodę" },
        { ans: "CZAPKA", clue: "Na zimę" }
    ],
    'D': [
        { ans: "DOMENA", clue: "Adres www" },
        { ans: "DANE", clue: "Baza informacji" },
        { ans: "DOMEK", clue: "Małe lokum" },
        { ans: "DESKA", clue: "Z drewna" },
        { ans: "DROGA", clue: "Asfaltowa jezdnia" }
    ],
    'E': [
        { ans: "EKRAN", clue: "Pokazuje obraz" },
        { ans: "EPOKA", clue: "Okres w historii" },
        { ans: "EMALIA", clue: "Powłoka garnka" },
        { ans: "ETAP", clue: "Część zadania" },
        { ans: "ECHO", clue: "Wraca w górach" }
    ],
    'F': [
        { ans: "FARBA", clue: "Koloruje ściany" },
        { ans: "FOKA", clue: "Morski ssak" },
        { ans: "FOTEL", clue: "Wygodny mebel" },
        { ans: "FIAT", clue: "Włoskie auto" },
        { ans: "FIGURA", clue: "Kształt geometryczny" }
    ],
    'G': [
        { ans: "GÓRA", clue: "Szczyt" },
        { ans: "GARNEK", clue: "Do zupy" },
        { ans: "GAZETA", clue: "Wiadomości papierowe" },
        { ans: "GĄBKA", clue: "Do mycia" },
        { ans: "GIPS", clue: "Na złamaną nogę" }
    ],
    'H': [
        { ans: "HALA", clue: "Wielki pokój" },
        { ans: "HAK", clue: "Do wieszania" },
        { ans: "HEŁM", clue: "Chroni głowę" },
        { ans: "HONOR", clue: "Duma i zasady" },
        { ans: "HOTEL", clue: "Nocleg w trasie" }
    ],
    'I': [
        { ans: "IGŁA", clue: "Do szycia" },
        { ans: "IMBIR", clue: "Przyprawa korzenna" },
        { ans: "ISKRA", clue: "Mały ognik" },
        { ans: "INDYK", clue: "Ptak domowy" }
    ],
    'J': [
        { ans: "JABŁKO", clue: "Owoc z sadu" },
        { ans: "JAJKO", clue: "Znosi je kura" },
        { ans: "JADŁO", clue: "Inaczej jedzenie" },
        { ans: "JASKA", clue: "Głęboka jama" },
        { ans: "JELEŃ", clue: "Zwierz z porożem" }
    ],
    'K': [
        { ans: "KOALA", clue: "Miś z eukaliptusa" },
        { ans: "KABEL", clue: "Przewodzi prąd" },
        { ans: "KOTEK", clue: "Puszysty zwierz" },
        { ans: "KARTA", clue: "Do bankomatu" },
        { ans: "KREDA", clue: "Do tablicy" }
    ],
    'L': [
        { ans: "LAMA", clue: "Zwierzę plujące" },
        { ans: "LATO", clue: "Pora roku" },
        { ans: "LAS", clue: "Dużo drzew" },
        { ans: "LUSTRO", clue: "Odbija twarz" },
        { ans: "LIMON", clue: "Cytrus" }
    ],
    'Ł': [
        { ans: "ŁÓDŹ", clue: "Pływa po jeziorze" },
        { ans: "ŁĄKA", clue: "Trawa i kwiaty" },
        { ans: "ŁAPA", clue: "Noga psa" },
        { ans: "ŁAWKA", clue: "W parku" },
        { ans: "ŁUPER", clue: "Złodziej" }
    ],
    'M': [
        { ans: "MĄKA", clue: "Zboże na chleb" },
        { ans: "MASŁO", clue: "Do chleba" },
        { ans: "MOSTEK", clue: "Nad rzeczką" },
        { ans: "MODEM", clue: "Daje sieć" },
        { ans: "MAPA", clue: "Wskazuje trasę" }
    ],
    'N': [
        { ans: "NOGA", clue: "Część ciała" },
        { ans: "NURT", clue: "Przepływ rzeki" },
        { ans: "NIEBO", clue: "Z chmurami" },
        { ans: "NUTA", clue: "Zapis muzyczny" },
        { ans: "NÓŻ", clue: "Do krojenia" }
    ],
    'O': [
        { ans: "OSIOŁ", clue: "Uparty zwierz" },
        { ans: "OKNO", clue: "W ścianie" },
        { ans: "OGIEŃ", clue: "Parzy i świeci" },
        { ans: "OBIAD", clue: "Posiłek południowy" },
        { ans: "OPONA", clue: "Na koło" }
    ],
    'Ó': [
        { ans: "ÓSMY", clue: "Po siódmym" },
        { ans: "ÓSEMKA", clue: "Liczba" },
        { ans: "ÓW", clue: "Wskazany" }
    ],
    'P': [
        { ans: "PŁYTKA", clue: "Kafel" },
        { ans: "PIEC", clue: "Daje ciepło" },
        { ans: "PTAK", clue: "Lata i ćwierka" },
        { ans: "PALEC", clue: "Część dłoni" }
    ],
    'R': [
        { ans: "RADIO", clue: "Gra muzykę" },
        { ans: "REKORD", clue: "Najlepszy wynik" },
        { ans: "RYBA", clue: "Pływa w wodzie" },
        { ans: "RZEKA", clue: "Płynie do morza" },
        { ans: "RAMA", clue: "Obramowanie" }
    ],
    'S': [
        { ans: "SFINKS", clue: "Egipski lew" },
        { ans: "STRONA", clue: "Witryna www" },
        { ans: "SIEĆ", clue: "Internet" },
        { ans: "SER", clue: "Nabiał żółty" },
        { ans: "SZAFA", clue: "Na ubrania" }
    ],
    'T': [
        { ans: "TARCZA", clue: "Chroni wojownika" },
        { ans: "TORT", clue: "Urodzinowy" },
        { ans: "TRAMWAJ", clue: "Miejski pojazd szynowy" },
        { ans: "TEATR", clue: "Scena aktorów" }
    ],
    'U': [
        { ans: "ULICA", clue: "Miejski trakt" },
        { ans: "UCHO", clue: "Słyszy" },
        { ans: "URLOP", clue: "Czas wolny" },
        { ans: "UCZEŃ", clue: "Dziecko w szkole" }
    ],
    'W': [
        { ans: "WODA", clue: "Do picia" },
        { ans: "WENUS", clue: "Gorąca planeta" },
        { ans: "WIEŻA", clue: "Wysoki zamek" },
        { ans: "WORKI", clue: "Na śmieci" }
    ],
    'Z': [
        { ans: "ZEGAR", clue: "Wskazuje czas" },
        { ans: "ZUPA", clue: "Ciepłe danie płynne" },
        { ans: "ZBOŻE", clue: "Na polu" },
        { ans: "ZĄB", clue: "Do gryzienia" }
    ],
    'Ś': [
        { ans: "ŚNIEG", clue: "Biały puch" },
        { ans: "ŚWIAT", clue: "Ziemia" },
        { ans: "ŚWIECA", clue: "Daje płomień" }
    ],
    'Ć': [
        { ans: "ĆMA", clue: "Nocny owad" },
        { ans: "ĆWIK", clue: "Burak z chrzanem" }
    ],
    'Ź': [
        { ans: "ŹREBAK", clue: "Młody koń" },
        { ans: "ŹRÓDŁO", clue: "Początek rzeki" }
    ],
    'Ż': [
        { ans: "ŻYTO", clue: "Zboże na mąkę" },
        { ans: "ŻABA", clue: "Zielony płaz" },
        { ans: "ŻAGIEL", clue: "Napędza łódkę wiatrem" }
    ]
};

// Deterministic seed-based random generator (sfc32)
function createRandom(seedString) {
    let h = 1779033703 ^ seedString.length;
    for (let i = 0; i < seedString.length; i++) {
        h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    }
}

// Generate a perfect Swedish comb-layout crossword deterministically from a level number
function generateDeterministicCrossword(level) {
    const seed = "level_" + level;
    const rand = createRandom(seed);
    
    // Pick a 9-letter spine word
    const spineIndex = Math.floor(rand() * SPINE_WORDS.length);
    const spineWord = SPINE_WORDS[spineIndex];
    
    const cells = [
        { x: 0, y: 0, type: "empty" }
    ];
    
    // Create base coordinates 8x10
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 8; x++) {
            if (x === 0 && y === 0) continue;
            cells.push({ x, y, type: "empty" });
        }
    }
    
    const getCell = (x, y) => cells.find(c => c.x === x && c.y === y);
    
    // Set Spine Clue
    const spineClueCell = getCell(1, 0);
    if (spineClueCell) {
        spineClueCell.type = "clue";
        spineClueCell.text = spineWord.clue;
        spineClueCell.arrow = "↓";
    }
    
    // Set Spine Letter Cells
    for (let y = 1; y <= 9; y++) {
        const letterCell = getCell(1, y);
        if (letterCell) {
            letterCell.type = "letter";
            letterCell.char = spineWord.ans[y - 1];
        }
    }
    
    // Fill horizontal words branching off spine letters y = 1 to 9
    for (let y = 1; y <= 9; y++) {
        const char = spineWord.ans[y - 1];
        
        // Find matching horizontal options
        const options = [...(HORIZONTAL_WORDS[char] || [])];
        if (options.length === 0) {
            options.push({ ans: char + "XX", clue: "Brak podpowiedzi" });
        }
        
        // Shuffle options deterministically
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        
        const horiz = options[0];
        
        // Set horizontal clue cell at (0, y)
        const clueCell = getCell(0, y);
        if (clueCell) {
            clueCell.type = "clue";
            clueCell.text = horiz.clue;
            clueCell.arrow = "→";
        }
        
        // Set horizontal letters
        const maxLen = Math.min(horiz.ans.length, 7); // Fits inside 8 cols grid (x=1..7)
        for (let idx = 0; idx < maxLen; idx++) {
            const x = 1 + idx;
            const letterCell = getCell(x, y);
            if (letterCell) {
                letterCell.type = "letter";
                letterCell.char = horiz.ans[idx];
            }
        }
    }
    
    // Select 25% given letters deterministically
    const letterCells = cells.filter(c => c.type === "letter");
    const givenCount = Math.ceil(letterCells.length * 0.22);
    
    const shuffledLetterCells = [...letterCells];
    for (let i = shuffledLetterCells.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffledLetterCells[i], shuffledLetterCells[j]] = [shuffledLetterCells[j], shuffledLetterCells[i]];
    }
    
    for (let i = 0; i < givenCount; i++) {
        shuffledLetterCells[i].given = true;
    }
    
    return {
        cols: 8,
        rows: 10,
        cells: cells
    };
}

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
    btnPlaySolo: document.getElementById('btn-play-solo'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnLeaveGame: document.getElementById('btn-leave-game'),
    btnCancelWaiting: document.getElementById('btn-cancel-waiting'),
    btnCancelGame: document.getElementById('btn-cancel-game'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    btnReturnLobby: document.getElementById('btn-return-lobby'),
    btnNextLevel: document.getElementById('btn-next-level'),
    
    btnExchangeLetters: document.getElementById('btn-exchange-letters'),
    btnSkipTurn: document.getElementById('btn-skip-turn'),
    btnRevealWord: document.getElementById('btn-reveal-word'),
    btnRevealHint: document.getElementById('btn-reveal-hint'),
    btnDailyPlay: document.getElementById('btn-daily-play'),
    
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
window.showLobbyToast = showLobbyToast;

function showGameToast(message, duration = 3000) {
    if (gameToastTimer) clearTimeout(gameToastTimer);
    UI.gameToast.textContent = message;
    UI.gameToast.classList.remove('hidden');
    
    gameToastTimer = setTimeout(() => {
        UI.gameToast.classList.add('hidden');
    }, duration);
}

// Display current date in Polish (e.g. 27 czerwca) on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const dateEl = document.getElementById('daily-current-date');
    if (dateEl) {
        const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
        const today = new Date();
        const day = today.getDate();
        const month = months[today.getMonth()];
        dateEl.textContent = `${day} ${month}`;
    }
});

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
    isSolo = false;
    boardCellsMap = {};
    activeCellKey = null;
    localScore = 0;
    remoteScore = 0;
    scale = 1.0;
    panX = 0;
    panY = 0;
    letterPoolQueue = [];
    activeTrayTiles = [];
    
    // Clear container
    UI.boardContainer.innerHTML = '';
    UI.boardContainer.style.transform = '';
    
    // Clear letter pool
    UI.letterPool.innerHTML = '';
    
    // Stop timers
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
    
    // Restore opponent panel visibility in case Solo mode hid it
    const remoteInfoEl = document.getElementById('player-remote-info');
    if (remoteInfoEl) remoteInfoEl.style.display = 'flex';
    const vsEl = document.querySelector('.score-vs');
    if (vsEl) vsEl.style.display = 'block';
    
    // Reset scores
    UI.scoreLocal.textContent = "0";
    UI.scoreRemote.textContent = "2";
    UI.opponentName.textContent = "Przeciwnik";
    if (remoteInfoEl) remoteInfoEl.classList.add('player-waiting');
    
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
    if (!window.supabaseClient) {
        showLobbyToast("Błąd: Supabase nie został zainicjalizowany!");
        return;
    }

    console.log(`Subscribing to presence channel: room:${roomCode}`);
    
    roomChannel = window.supabaseClient.channel(`room:${roomCode}`, {
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
        localScore = local.score || 0;
        UI.scoreLocal.textContent = localScore;
        document.getElementById('player-local-info').classList.add('active');
    }
    
    if (remote) {
        UI.opponentName.textContent = remote.username;
        remoteScore = remote.score || 0;
        UI.scoreRemote.textContent = remoteScore;
        document.getElementById('player-remote-info').classList.add('active');
        document.getElementById('player-remote-info').classList.remove('player-waiting');
    } else {
        UI.opponentName.textContent = "Przeciwnik";
        UI.scoreRemote.textContent = "2";
        document.getElementById('player-remote-info').classList.remove('active');
        document.getElementById('player-remote-info').classList.add('player-waiting');
    }
}

function triggerGameStart() {
    if (gameActive) return;
    
    gameActive = true;
    localScore = 0;
    remoteScore = 0;
    
    UI.gameWaitingOverlay.classList.add('hidden');
    showGameToast("Rozpoczynanie gry! Powodzenia! 🚀");
    
    if (isHost && currentRoomId) {
        dbUpdateRoomStatus(currentRoomId, 'playing');
    }
    
    gameStartTime = Date.now();
    
    // Dynamic Level title
    document.getElementById('game-title-label').textContent = currentCrossword.name || `Łamigłówka ${currentCrossword.level}`;
    
    renderCrosswordBoard(currentCrossword);
}

function handlePlayerLeft() {
    if (!gameActive) return;
    
    showGameToast("Twój rywal uciekł! Powrót do Lobby za 5 sekund...");
    gameActive = false;
    
    setTimeout(() => {
        switchScreen('lobby');
    }, 5000);
}

// ==========================================================================
// 6. SWEDISH BOARD RENDERING & CELL SELECTION (STAGE 8)
// ==========================================================================

function renderCrosswordBoard(crossword) {
    if (!crossword) return;
    
    if (!crossword.words || !crossword.words.cells || Object.keys(crossword.words).length === 0) {
        crossword.words = generateDeterministicCrossword(crossword.level);
    }
    
    const gridData = crossword.words;
    const cols = gridData.cols || 8;
    const rows = gridData.rows || 10;
    const cells = gridData.cells || [];
    
    boardCellsMap = {};
    UI.boardContainer.innerHTML = '';
    
    // 1. Setup CSS Grid layout with zero gap
    UI.boardContainer.style.display = 'grid';
    UI.boardContainer.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    UI.boardContainer.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;
    UI.boardContainer.style.gridGap = '0px'; 
    
    // 2. Render cells
    cells.forEach(cell => {
        const key = `${cell.x},${cell.y}`;
        const cellEl = document.createElement('div');
        cellEl.dataset.x = cell.x;
        cellEl.dataset.y = cell.y;
        cellEl.dataset.key = key;
        
        cellEl.style.gridColumn = cell.x + 1;
        cellEl.style.gridRow = cell.y + 1;
        
        const cellData = {
            x: cell.x,
            y: cell.y,
            type: cell.type,
            char: cell.char ? cell.char.toUpperCase() : null,
            given: cell.given || false,
            solved: cell.given || false,
            text: cell.text || '',
            image: cell.image || '',
            arrow: cell.arrow || '',
            element: cellEl
        };
        boardCellsMap[key] = cellData;
        
        if (cell.type === 'clue') {
            cellEl.className = 'board-cell clue-cell';
            
            if (cell.image) {
                const imgEl = document.createElement('span');
                imgEl.className = 'clue-cell-image';
                imgEl.textContent = cell.image;
                cellEl.appendChild(imgEl);
            }
            
            if (cell.text) {
                const txtEl = document.createElement('span');
                txtEl.className = 'clue-cell-text';
                txtEl.innerHTML = cell.text.replace(/\n/g, '<br>');
                cellEl.appendChild(txtEl);
            }
            
            if (cell.arrow) {
                const arrowEl = document.createElement('span');
                arrowEl.className = 'clue-cell-arrow';
                arrowEl.textContent = cell.arrow;
                cellEl.appendChild(arrowEl);
            }
            
        } else if (cell.type === 'letter') {
            cellEl.className = 'board-cell filled-slot';
            if (cell.given) {
                cellEl.classList.add('given-cell');
            }
            
            const letterEl = document.createElement('span');
            letterEl.className = 'board-cell-letter';
            letterEl.textContent = cell.given ? cell.char.toUpperCase() : '';
            cellEl.appendChild(letterEl);
            
            cellEl.addEventListener('click', () => {
                selectLetterCell(key);
            });
            
        } else {
            cellEl.className = 'board-cell empty-cell';
        }
        
        UI.boardContainer.appendChild(cellEl);
    });
    
    // 3. Center board initially in viewport
    const cellSize = 46; 
    const gridPixelWidth = cols * cellSize;
    const gridPixelHeight = rows * cellSize;
    
    const viewportWidth = UI.boardViewport.clientWidth;
    const viewportHeight = UI.boardViewport.clientHeight;
    
    panX = (viewportWidth - gridPixelWidth) / 2;
    panY = (viewportHeight - gridPixelHeight) / 2;
    scale = 1.0;
    
    updateBoardTransform();
    
    // 4. Initialize letter tray pool
    initLetterPool(crossword);
}

function selectLetterCell(key) {
    const cell = boardCellsMap[key];
    if (!cell || cell.type !== 'letter') return;
    
    activeCellKey = key;
    clearBoardHighlights();
    
    // Highlight connected word path
    highlightWordLine(key);
    
    cell.element.classList.add('selected-cell');
}

function highlightWordLine(key) {
    const cell = boardCellsMap[key];
    if (!cell) return;
    
    const x = cell.x;
    const y = cell.y;
    
    let horizontalCells = [];
    let verticalCells = [];
    
    // Trace horizontal row block
    let cx = x;
    while (cx >= 0) {
        const k = `${cx},${y}`;
        const c = boardCellsMap[k];
        if (c && c.type === 'letter') {
            horizontalCells.unshift(c);
            cx--;
        } else {
            break;
        }
    }
    cx = x + 1;
    while (cx < 8) {
        const k = `${cx},${y}`;
        const c = boardCellsMap[k];
        if (c && c.type === 'letter') {
            horizontalCells.push(c);
            cx++;
        } else {
            break;
        }
    }
    
    // Trace vertical column block
    let cy = y;
    while (cy >= 0) {
        const k = `${x},${cy}`;
        const c = boardCellsMap[k];
        if (c && c.type === 'letter') {
            verticalCells.unshift(c);
            cy--;
        } else {
            break;
        }
    }
    cy = y + 1;
    while (cy < 10) {
        const k = `${x},${cy}`;
        const c = boardCellsMap[k];
        if (c && c.type === 'letter') {
            verticalCells.push(c);
            cy++;
        } else {
            break;
        }
    }
    
    // Highlight the longer line block
    const targetList = (horizontalCells.length >= verticalCells.length) ? horizontalCells : verticalCells;
    targetList.forEach(c => {
        c.element.classList.add('highlighted-word');
    });
}

function clearBoardHighlights() {
    Object.keys(boardCellsMap).forEach(key => {
        const c = boardCellsMap[key];
        if (c.element) {
            c.element.classList.remove('highlighted-word');
            c.element.classList.remove('selected-cell');
        }
    });
}

window.renderCrosswordBoard = renderCrosswordBoard;

// ==========================================================================
// 7. DRAGGABLE SCRAbble LETTERS TRAY LOGIC (STAGE 8)
// ==========================================================================

function initLetterPool(crossword) {
    if (!crossword || !crossword.words) return;
    
    const cells = crossword.words.cells || [];
    const requiredLetters = [];
    
    // Gather letters for non-given empty cells
    cells.forEach(cell => {
        if (cell.type === 'letter' && !cell.given) {
            requiredLetters.push(cell.char.toUpperCase());
        }
    });
    
    // Inject 30% Polish decoy letters
    const decoys = ["A", "E", "O", "R", "S", "T", "I", "N", "Z", "W", "K", "Y", "P", "M", "C", "L", "D", "B"];
    const decoyCount = Math.ceil(requiredLetters.length * 0.3);
    for (let i = 0; i < decoyCount; i++) {
        requiredLetters.push(decoys[Math.floor(Math.random() * decoys.length)]);
    }
    
    // Shuffle
    for (let i = requiredLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [requiredLetters[i], requiredLetters[j]] = [requiredLetters[j], requiredLetters[i]];
    }
    
    letterPoolQueue = requiredLetters;
    activeTrayTiles = [];
    
    fillTrayFromQueue();
}

function fillTrayFromQueue() {
    UI.letterPool.innerHTML = '';
    
    // Pull from queue to hold 5 letters in tray
    while (activeTrayTiles.length < 5 && letterPoolQueue.length > 0) {
        activeTrayTiles.push(letterPoolQueue.shift());
    }
    
    // Render tiles
    activeTrayTiles.forEach((char, index) => {
        const tile = document.createElement('div');
        tile.className = 'letter-tile';
        tile.textContent = char;
        tile.dataset.letter = char;
        tile.dataset.index = index;
        
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
    
    dragClone = tile.cloneNode(true);
    dragClone.classList.add('dragging');
    
    const rect = tile.getBoundingClientRect();
    const offsetX = rect.width / 2;
    const offsetY = rect.height / 2;
    
    dragClone.style.position = 'fixed';
    dragClone.style.left = (clientX - offsetX) + 'px';
    dragClone.style.top = (clientY - offsetY) + 'px';
    dragClone.style.margin = '0';
    dragClone.style.pointerEvents = 'none'; 
    
    document.body.appendChild(dragClone);
    tile.classList.add('used'); 
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
        
        if (cellData && cellData.type === 'letter' && !cellData.solved) {
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
        
        if (cellData && cellData.type === 'letter' && !cellData.solved) {
            isCorrect = handleLetterDrop(key, dragLetter, cellEl);
        }
    }
    
    if (dragClone) {
        dragClone.remove();
        dragClone = null;
    }
    
    if (isCorrect) {
        // Remove placement from active tray array and refill
        const index = parseInt(activeDraggedTile.dataset.index);
        activeTrayTiles.splice(index, 1);
        fillTrayFromQueue();
    } else {
        activeDraggedTile.classList.remove('used');
    }
    
    activeDraggedTile = null;
}

// Validation & Broadcast Senders
function handleLetterDrop(key, letter, cellEl) {
    const cell = boardCellsMap[key];
    if (!cell) return false;
    
    if (cell.char === letter) {
        cell.solved = true;
        
        const letterEl = cellEl.querySelector('.board-cell-letter');
        letterEl.textContent = letter;
        
        cellEl.classList.add('placed-correctly');
        
        localScore += 1;
        UI.scoreLocal.textContent = localScore;
        
        showGameToast("Świetnie! +1 punkt! 🎉", 1000);
        
        if (roomChannel) {
            roomChannel.track({
                id: playerId,
                username: isHost ? "Gospodarz" : "Gość",
                isHost: isHost,
                score: localScore,
                joinedAt: new Date().toISOString()
            });

            roomChannel.send({
                type: 'broadcast',
                event: 'letter_placed',
                payload: { playerId, key, letter, score: localScore }
            });
        }
        
        checkVictoryCondition();
        return true;
    } else {
        localScore = Math.max(0, localScore - 1);
        UI.scoreLocal.textContent = localScore;
        
        showGameToast("Błąd! -1 punkt! ❌", 1000);
        
        cellEl.style.animation = 'none';
        cellEl.offsetHeight; 
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

// Broadcast Receivers
function handleRemoteLetterPlaced(payload) {
    const { playerId: senderId, key, letter, score } = payload;
    if (senderId === playerId) return;
    
    const cell = boardCellsMap[key];
    if (cell && !cell.solved) {
        cell.solved = true;
        
        const letterEl = cell.element.querySelector('.board-cell-letter');
        if (letterEl) {
            letterEl.textContent = letter;
        }
        
        cell.element.classList.add('placed-correctly');
        showGameToast(`Rywal uzupełnił literę: ${letter}! ⚡`, 1200);
        
        remoteScore = score;
        UI.scoreRemote.textContent = remoteScore;
        
        checkVictoryCondition();
    }
}

function checkVictoryCondition() {
    // Only verify non-clue letter cells solved state
    const allSolved = Object.values(boardCellsMap)
        .filter(c => c.type === 'letter')
        .every(c => c.solved);
        
    if (allSolved) {
        // Save progression data locally
        if (currentCrossword) {
            const solvedLevels = JSON.parse(localStorage.getItem('solved_levels') || '[]');
            if (!solvedLevels.includes(currentCrossword.level)) {
                solvedLevels.push(currentCrossword.level);
                localStorage.setItem('solved_levels', JSON.stringify(solvedLevels));
            }
            const totalPoints = parseInt(localStorage.getItem('total_points') || '0') + localScore;
            localStorage.setItem('total_points', totalPoints);
        }
        
        showGameToast("Gratulacje! Ukończyłeś całą planszę! 🏆");
        
        if (gameTimerInterval) {
            clearInterval(gameTimerInterval);
            gameTimerInterval = null;
        }
        
        setTimeout(() => {
            document.getElementById('end-score-local').textContent = `${localScore} pkt`;
            document.getElementById('end-score-remote').textContent = `${remoteScore} pkt`;
            document.getElementById('end-opponent-name').textContent = UI.opponentName.textContent;
            
            const titleEl = document.getElementById('end-title');
            if (localScore > remoteScore) {
                titleEl.innerHTML = "Wygrałeś! 🥇";
            } else if (localScore < remoteScore) {
                titleEl.innerHTML = "Przegrałeś! 🥈";
            } else {
                titleEl.innerHTML = "Remis! 🤝";
            }
            
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

function loadNextLevel(crossword) {
    UI.gameEndOverlay.classList.add('hidden');
    
    gameActive = true;
    localScore = 0;
    remoteScore = 0;
    currentCrossword = crossword;
    activeCellKey = null;
    scale = 1.0;
    
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
    }
    
    gameStartTime = Date.now();
    
    UI.scoreLocal.textContent = "0";
    UI.scoreRemote.textContent = "2";
    
    document.getElementById('game-title-label').textContent = crossword.name || `Łamigłówka ${crossword.level}`;
    renderCrosswordBoard(crossword);
    
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

// --- Global Drag Move & End listeners ---
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

window.initLetterPool = initLetterPool;

// ==========================================================================
// 8. PAN AND ZOOM CONTROLLER (STAGE 4)
// ==========================================================================

function updateBoardTransform() {
    UI.boardContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

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

UI.boardViewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('.board-cell.filled-slot')) return;
    
    if (e.touches.length === 1) {
        isPanning = true;
        startX = e.touches[0].clientX - panX;
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

// Lobby trigger by Clicking Daily Play card (if exists)
if (UI.btnDailyPlay) {
    UI.btnDailyPlay.addEventListener('click', () => {
        UI.btnCreateRoom.click();
    });
}

// Create Room Action
UI.btnCreateRoom.addEventListener('click', async () => {
    if (!window.supabaseClient) {
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
        
        if (UI.gameRoomCode) UI.gameRoomCode.textContent = currentRoomCode;
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
    if (!window.supabaseClient) {
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
        
        if (UI.gameRoomCode) UI.gameRoomCode.textContent = currentRoomCode;
        
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
    if (isSolo) {
        const nextCw = LOCAL_CROSSWORDS[Math.floor(Math.random() * LOCAL_CROSSWORDS.length)];
        loadNextLevel(nextCw);
        return;
    }
    
    if (!isHost) return;
    
    UI.btnNextLevel.disabled = true;
    UI.btnNextLevel.textContent = "Losowanie...";
    
    try {
        const { data: crosswords, error: fetchErr } = await window.supabaseClient
            .from('crosswords')
            .select('id, level');
            
        if (fetchErr || !crosswords || crosswords.length === 0) {
            throw new Error("Nie można pobrać kolejnego poziomu.");
        }
        
        let nextCw = crosswords[Math.floor(Math.random() * crosswords.length)];
        if (crosswords.length > 1 && currentCrossword && nextCw.level === currentCrossword.level) {
            const others = crosswords.filter(c => c.level !== currentCrossword.level);
            nextCw = others[Math.floor(Math.random() * others.length)];
        }
        
        const { data: crosswordFull, error: fetchFullErr } = await window.supabaseClient
            .from('crosswords')
            .select('*')
            .eq('id', nextCw.id)
            .single();
            
        if (fetchFullErr) throw fetchFullErr;
        
        await window.supabaseClient
            .from('rooms')
            .update({
                crossword_id: nextCw.id,
                status: 'playing',
                updated_at: new Date().toISOString()
            })
            .eq('id', currentRoomId);
            
        if (roomChannel) {
            roomChannel.send({
                type: 'broadcast',
                event: 'next_level',
                payload: {
                    crossword: crosswordFull
                }
            });
        }
        
        loadNextLevel(crosswordFull);
        
    } catch (e) {
        showGameToast("Błąd ładowania poziomu: " + e.message);
        UI.btnNextLevel.disabled = false;
        UI.btnNextLevel.textContent = "Następny Poziom";
        console.error(e);
    }
});

// Letters pool exchange (🔄) action
UI.btnExchangeLetters.addEventListener('click', () => {
    if (!gameActive || activeTrayTiles.length === 0) return;
    
    // Put current active tiles back into the queue
    letterPoolQueue.push(...activeTrayTiles);
    activeTrayTiles = [];
    fillTrayFromQueue();
    showGameToast("Wymieniono kafelki w puli! 🔄", 1200);
});

// Skip (Pomiń) Turn / replace 1 kafel action
UI.btnSkipTurn.addEventListener('click', () => {
    if (!gameActive || activeTrayTiles.length === 0) return;
    
    // Swap first card with a new one from the queue
    const removed = activeTrayTiles.shift();
    letterPoolQueue.push(removed);
    fillTrayFromQueue();
    showGameToast("Ruch pominięty (wymieniono 1 kafel)! ⏭️", 1200);
});

// Reveal Word (🔑) shortcut helper action
UI.btnRevealWord.addEventListener('click', () => {
    if (!gameActive) return;
    
    // Find a random unsolved letter cell
    const unsolvedKeys = Object.keys(boardCellsMap).filter(k => boardCellsMap[k].type === 'letter' && !boardCellsMap[k].solved);
    if (unsolvedKeys.length > 0) {
        const randomKey = unsolvedKeys[Math.floor(Math.random() * unsolvedKeys.length)];
        const cell = boardCellsMap[randomKey];
        
        cell.solved = true;
        const letterEl = cell.element.querySelector('.board-cell-letter');
        if (letterEl) {
            letterEl.textContent = cell.char;
        }
        cell.element.classList.add('placed-correctly');
        
        localScore += 1;
        UI.scoreLocal.textContent = localScore;
        
        if (roomChannel) {
            roomChannel.send({
                type: 'broadcast',
                event: 'letter_placed',
                payload: { playerId, key: randomKey, letter: cell.char, score: localScore }
            });
        }
        
        showGameToast("Wykorzystano klucz do słowa! 🔑", 1200);
        checkVictoryCondition();
    }
});

// Reveal Hint (💡) shortcut helper action
UI.btnRevealHint.addEventListener('click', () => {
    if (!gameActive) return;
    
    if (!activeCellKey) {
        showGameToast("Zaznacz najpierw pole na planszy!", 1500);
        return;
    }
    
    const cell = boardCellsMap[activeCellKey];
    if (cell && !cell.solved) {
        cell.solved = true;
        const letterEl = cell.element.querySelector('.board-cell-letter');
        if (letterEl) {
            letterEl.textContent = cell.char;
        }
        cell.element.classList.add('placed-correctly');
        
        localScore += 1;
        UI.scoreLocal.textContent = localScore;
        
        if (roomChannel) {
            roomChannel.send({
                type: 'broadcast',
                event: 'letter_placed',
                payload: { playerId, key: activeCellKey, letter: cell.char, score: localScore }
            });
        }
        
        showGameToast("Użyto podpowiedzi! 💡", 1200);
        checkVictoryCondition();
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

// Play Solo (Offline / Local) Action
UI.btnPlaySolo.addEventListener('click', () => {
    isSolo = true;
    isHost = false;
    currentRoomId = null;
    currentRoomCode = null;
    roomChannel = null;
    
    // Pick first level or a random level from local fallbacks
    currentCrossword = LOCAL_CROSSWORDS[0];
    
    // Hide opponent info since it's Solo play
    const remoteInfoEl = document.getElementById('player-remote-info');
    if (remoteInfoEl) remoteInfoEl.style.display = 'none';
    const vsEl = document.querySelector('.score-vs');
    if (vsEl) vsEl.style.display = 'none';
    
    // Setup title
    document.getElementById('game-title-label').textContent = currentCrossword.name;
    
    // Transition
    switchScreen('game');
    UI.gameWaitingOverlay.classList.add('hidden');
    
    gameActive = true;
    localScore = 0;
    
    renderCrosswordBoard(currentCrossword);
    showGameToast("Rozpoczynasz grę Solo! Powodzenia! 🧩");
});

// Keyboard input listener to allow normal typing into cells
window.addEventListener('keydown', (e) => {
    if (!gameActive || !activeCellKey) return;
    
    const key = e.key.toUpperCase();
    
    // Allow A-Z and Polish diacritics
    if (key.length === 1 && /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(key)) {
        const cell = boardCellsMap[activeCellKey];
        if (cell && !cell.solved) {
            handleLetterPlacementByKey(activeCellKey, key);
        }
    }
});

function handleLetterPlacementByKey(key, letter) {
    const cell = boardCellsMap[key];
    if (!cell || cell.solved) return;
    
    if (cell.char === letter) {
        cell.solved = true;
        const letterEl = cell.element.querySelector('.board-cell-letter');
        if (letterEl) {
            letterEl.textContent = letter;
        }
        cell.element.classList.add('placed-correctly');
        
        localScore += 1;
        UI.scoreLocal.textContent = localScore;
        
        showGameToast("Dobrze! 🎉", 800);
        
        if (roomChannel) {
            roomChannel.track({
                id: playerId,
                username: isHost ? "Gospodarz" : "Gość",
                isHost: isHost,
                score: localScore,
                joinedAt: new Date().toISOString()
            });
            roomChannel.send({
                type: 'broadcast',
                event: 'letter_placed',
                payload: { playerId, key, letter, score: localScore }
            });
        }
        
        // Auto advance selection to next empty cell of word path
        moveToNextCell(key);
        
        checkVictoryCondition();
    } else {
        localScore = Math.max(0, localScore - 1);
        UI.scoreLocal.textContent = localScore;
        
        showGameToast("Błąd! ❌", 800);
        
        cell.element.style.animation = 'none';
        cell.element.offsetHeight; 
        cell.element.style.animation = 'shake 0.4s ease';
        setTimeout(() => { cell.element.style.animation = ''; }, 400);
    }
}

function moveToNextCell(key) {
    const cell = boardCellsMap[key];
    if (!cell) return;
    
    const x = cell.x;
    const y = cell.y;
    
    let nextKey = null;
    if (activeDirection === 'H') {
        let cx = x + 1;
        while (cx < 8) {
            const k = `${cx},${y}`;
            const c = boardCellsMap[k];
            if (c && c.type === 'letter') {
                if (!c.solved) {
                    nextKey = k;
                    break;
                }
                cx++;
            } else {
                break;
            }
        }
    } else {
        let cy = y + 1;
        while (cy < 10) {
            const k = `${x},${cy}`;
            const c = boardCellsMap[k];
            if (c && c.type === 'letter') {
                if (!c.solved) {
                    nextKey = k;
                    break;
                }
                cy++;
            } else {
                break;
            }
        }
    }
    
    if (nextKey) {
        selectLetterCell(nextKey);
    }
}

// ==========================================================================
// 10. BOTTOM NAVIGATION TABS & LEVEL SELECT LOGIC
// ==========================================================================

const navItems = document.querySelectorAll('.bottom-nav-bar .nav-item');
const tabViews = document.querySelectorAll('.tab-view');

navItems.forEach((btn, index) => {
    btn.addEventListener('click', () => {
        // Toggle tab highlights
        navItems.forEach(n => n.classList.remove('active'));
        btn.classList.add('active');
        
        // Toggle view containers
        tabViews.forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        
        if (index === 0) {
            const homeView = document.getElementById('lobby-home-view');
            if (homeView) {
                homeView.classList.add('active');
                homeView.classList.remove('hidden');
            }
        } else if (index === 1) {
            const levelsView = document.getElementById('lobby-levels-view');
            if (levelsView) {
                levelsView.classList.add('active');
                levelsView.classList.remove('hidden');
            }
            renderLevelsGrid();
        } else if (index === 2) {
            const profileView = document.getElementById('lobby-profile-view');
            if (profileView) {
                profileView.classList.add('active');
                profileView.classList.remove('hidden');
            }
            updateProfileStats();
        }
    });
});

function renderLevelsGrid() {
    const grid = document.getElementById('levels-grid-container');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Fetch completed levels from storage to show green ticks
    const solvedLevels = JSON.parse(localStorage.getItem('solved_levels') || '[]');
    
    for (let i = 1; i <= 50; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-select-btn';
        if (solvedLevels.includes(i)) {
            btn.classList.add('completed');
        }
        btn.textContent = i;
        
        btn.addEventListener('click', () => {
            // Load this specific level in Solo Mode!
            startSoloLevel(i);
        });
        
        grid.appendChild(btn);
    }
}

function startSoloLevel(levelNum) {
    isSolo = true;
    isHost = false;
    currentRoomId = null;
    currentRoomCode = null;
    roomChannel = null;
    
    currentCrossword = {
        level: levelNum,
        name: `Łamigłówka ${levelNum}`
    };
    
    // Hide opponent score details
    const remoteInfoEl = document.getElementById('player-remote-info');
    if (remoteInfoEl) remoteInfoEl.style.display = 'none';
    const vsEl = document.querySelector('.score-vs');
    if (vsEl) vsEl.style.display = 'none';
    
    // Setup title
    document.getElementById('game-title-label').textContent = currentCrossword.name;
    
    // Transition
    switchScreen('game');
    UI.gameWaitingOverlay.classList.add('hidden');
    
    gameActive = true;
    localScore = 0;
    
    renderCrosswordBoard(currentCrossword);
    showGameToast(`Uruchomiono Poziom ${levelNum}! Powodzenia! 🧩`);
}

function updateProfileStats() {
    const solvedLevels = JSON.parse(localStorage.getItem('solved_levels') || '[]');
    const solvedEl = document.getElementById('stat-solved-count');
    if (solvedEl) solvedEl.textContent = solvedLevels.length;
    
    const accumulatedPoints = parseInt(localStorage.getItem('total_points') || '0');
    const pointsEl = document.getElementById('stat-points');
    if (pointsEl) pointsEl.textContent = accumulatedPoints;
}
