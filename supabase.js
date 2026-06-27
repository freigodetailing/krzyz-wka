/* supabase.js - Supabase Client Initialization & Database Operations */

// ==========================================================================
// 1. CLIENT INITIALIZATION & CREDENTIALS MANAGEMENT
// ==========================================================================
let supabaseClient = null;

// Default empty placeholders - user can set these in the UI settings gear.
// If you want to hardcode them, fill them here:
let SUPABASE_URL = "https://sdhqlonipxxpwjrgkukb.supabase.co";
let SUPABASE_KEY = "sb_publishable_JxpjfvkDr_d_5LBy5R35bg_yUF2Lxg1";

// Check if credentials exist in localStorage, fallback to hardcoded variables
const storedUrl = localStorage.getItem('supabase_url') || SUPABASE_URL;
const storedKey = localStorage.getItem('supabase_key') || SUPABASE_KEY;

if (storedUrl && storedKey) {
    SUPABASE_URL = storedUrl;
    SUPABASE_KEY = storedKey;
    initializeSupabaseClient();
} else {
    console.warn("Supabase credentials not configured. Please use the settings gear in the Lobby to configure them.");
}

function initializeSupabaseClient() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return false;
    try {
        // Use the global CDN builder window.supabase to create the client instance
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabaseClient = supabaseClient; // Export to global scope
        console.log("Supabase client initialized successfully.");
        return true;
    } catch (e) {
        console.error("Error creating Supabase client:", e);
        return false;
    }
}

// ==========================================================================
// 2. CONFIGURATION UI LOGIC
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        const btnToggleSettings = document.getElementById('btn-toggle-settings');
        const settingsOverlay = document.getElementById('settings-overlay');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const btnSaveSettings = document.getElementById('btn-save-settings');
        const inputSupabaseUrl = document.getElementById('input-supabase-url');
        const inputSupabaseKey = document.getElementById('input-supabase-key');
        
        // Load inputs from current state
        if (inputSupabaseUrl && SUPABASE_URL) inputSupabaseUrl.value = SUPABASE_URL;
        if (inputSupabaseKey && SUPABASE_KEY) inputSupabaseKey.value = SUPABASE_KEY;

        // Toggle overlay
        if (btnToggleSettings && settingsOverlay) {
            btnToggleSettings.addEventListener('click', () => {
                settingsOverlay.classList.remove('hidden');
            });
        }

        if (btnCloseSettings && settingsOverlay) {
            btnCloseSettings.addEventListener('click', () => {
                settingsOverlay.classList.add('hidden');
            });
        }

        if (btnSaveSettings && inputSupabaseUrl && inputSupabaseKey && settingsOverlay) {
            btnSaveSettings.addEventListener('click', () => {
                const url = inputSupabaseUrl.value.trim();
                const key = inputSupabaseKey.value.trim();

                if (!url || !key) {
                    alert("Proszę podać zarówno URL, jak i Anon Key!");
                    return;
                }

                localStorage.setItem('supabase_url', url);
                localStorage.setItem('supabase_key', key);
                
                SUPABASE_URL = url;
                SUPABASE_KEY = key;

                if (initializeSupabaseClient()) {
                    settingsOverlay.classList.add('hidden');
                    if (window.showLobbyToast) {
                        window.showLobbyToast("Zapisano ustawienia Supabase! Zrestartowano połączenie.");
                    } else {
                        alert("Zapisano ustawienia Supabase!");
                    }
                } else {
                    alert("Błąd połączenia. Sprawdź poprawność URL i Klucza.");
                }
            });
        }
    } catch (err) {
        console.error("Error initializing Supabase UI settings event listeners:", err);
    }
});

// ==========================================================================
// 3. CODE GENERATOR & DB ACTIONS
// ==========================================================================

// Generate unique 6-character room pairing code (letters & numbers)
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded easy-to-confuse characters: I, O, 1, 0
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Action: Create Room
async function dbCreateRoom() {
    if (!supabaseClient) {
        throw new Error("Supabase nie jest skonfigurowany. Kliknij koło zębate w rogu, aby podać dane połączenia.");
    }
    
    // 1. Fetch available crossword levels
    const { data: crosswords, error: fetchErr } = await supabaseClient
        .from('crosswords')
        .select('id, level, name');
        
    if (fetchErr || !crosswords || crosswords.length === 0) {
        throw new Error("Nie udało się pobrać listy krzyżówek z bazy (lub tabela jest pusta). " + (fetchErr?.message || ""));
    }
    
    // 2. Select a random crossword from list
    const randomCrossword = crosswords[Math.floor(Math.random() * crosswords.length)];
    
    // 3. Generate room code
    const roomCode = generateRoomCode();
    
    // 4. Create room row
    const { data: room, error: insertErr } = await supabaseClient
        .from('rooms')
        .insert({
            code: roomCode,
            crossword_id: randomCrossword.id,
            status: 'waiting'
        })
        .select()
        .single();
        
    if (insertErr) {
        throw new Error("Błąd podczas tworzenia pokoju w bazie danych: " + insertErr.message);
    }
    
    // 5. Fetch full crossword definition
    const { data: crosswordFull, error: fetchFullErr } = await supabaseClient
        .from('crosswords')
        .select('*')
        .eq('id', randomCrossword.id)
        .single();
        
    if (fetchFullErr) {
        throw new Error("Błąd podczas pobierania definicji krzyżówki: " + fetchFullErr.message);
    }
    
    return {
        room: room,
        crossword: crosswordFull
    };
}

// Action: Join Room
async function dbJoinRoom(code) {
    if (!supabaseClient) {
        throw new Error("Supabase nie jest skonfigurowany. Kliknij koło zębate w rogu, aby podać dane połączenia.");
    }
    
    const formattedCode = code.toUpperCase().trim();
    
    // 1. Find room
    const { data: room, error: roomErr } = await supabaseClient
        .from('rooms')
        .select('*, crosswords(*)')
        .eq('code', formattedCode)
        .single();
        
    if (roomErr || !room) {
        throw new Error("Nie znaleziono pokoju o podanym kodzie lub połączenie wygasło.");
    }
    
    // 2. Check if room is waiting
    if (room.status !== 'waiting') {
        throw new Error("Nie można dołączyć. Ten pokój jest już w grze lub został zakończony.");
    }
    
    return {
        room: room,
        crossword: room.crosswords // supabase joined record relation
    };
}

// Action: Update Room Status
async function dbUpdateRoomStatus(roomId, newStatus) {
    if (!supabaseClient) return;
    await supabaseClient
        .from('rooms')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', roomId);
}

// Action: Delete Room (when host cancels)
async function dbDeleteRoom(roomId) {
    if (!supabaseClient) return;
    await supabaseClient
        .from('rooms')
        .delete()
        .eq('id', roomId);
}

// Export database actions explicitly to global scope
window.dbCreateRoom = dbCreateRoom;
window.dbJoinRoom = dbJoinRoom;
window.dbUpdateRoomStatus = dbUpdateRoomStatus;
window.dbDeleteRoom = dbDeleteRoom;
