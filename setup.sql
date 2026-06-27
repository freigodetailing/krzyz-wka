-- setup.sql - Etap 1: Fundamenty bazy danych (Supabase SQL)
-- Wklej ten kod w Supabase -> SQL Editor i kliknij "Run".

-- 1. Tworzenie tabeli krzyżówek (crosswords)
CREATE TABLE IF NOT EXISTS crosswords (
    id SERIAL PRIMARY KEY,
    level INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    words JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tworzenie tabeli pokoi (rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    crossword_id INTEGER REFERENCES crosswords(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'waiting' NOT NULL, -- 'waiting', 'playing', 'finished'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Włączenie RLS (Row Level Security)
ALTER TABLE crosswords ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 4. Polityki RLS dla tabeli 'crosswords' (Odczyt dla wszystkich anonimowych/zalogowanych użytkowników)
DROP POLICY IF EXISTS "Allow anonymous read access on crosswords" ON crosswords;
CREATE POLICY "Allow anonymous read access on crosswords" 
ON crosswords FOR SELECT 
TO anon, authenticated
USING (true);

-- 5. Polityki RLS dla tabeli 'rooms'
DROP POLICY IF EXISTS "Allow anonymous select on rooms" ON rooms;
CREATE POLICY "Allow anonymous select on rooms" 
ON rooms FOR SELECT 
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on rooms" ON rooms;
CREATE POLICY "Allow anonymous insert on rooms" 
ON rooms FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update on rooms" ON rooms;
CREATE POLICY "Allow anonymous update on rooms" 
ON rooms FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 6. Dodanie przykładowych danych (seed) dla poziomów 1-3
-- Hasła (answer) są zapisane bez polskich znaków (ASCII), aby zapobiec problemom z wprowadzaniem z klawiatury
-- i kolizjami znaków na planszy. Pytania (clue) posiadają poprawne polskie znaki diakrytyczne.

INSERT INTO crosswords (level, name, words) VALUES 
(
1,
'Technologie internetowe',
'[
    {"id": 1, "x": 5, "y": 10, "direction": "H", "answer": "PROGRAMISTA", "clue": "Osoba pisząca kod źródłowy programów komputerowych"},
    {"id": 2, "x": 5, "y": 10, "direction": "V", "answer": "PROCESOR", "clue": "Mózg komputera, jednostka centralna (CPU)"},
    {"id": 3, "x": 5, "y": 15, "direction": "H", "answer": "STRONA", "clue": "Dokument HTML wyświetlany w przeglądarce internetowej"},
    {"id": 4, "x": 5, "y": 17, "direction": "H", "answer": "REKORD", "clue": "Pojedynczy wiersz w tabeli bazy danych"},
    {"id": 5, "x": 7, "y": 14, "direction": "V", "answer": "DRUK", "clue": "Przenoszenie tekstu lub obrazu na papier"},
    {"id": 6, "x": 9, "y": 15, "direction": "V", "answer": "NURT", "clue": "Kierunek w sztuce lub przepływ wody"},
    {"id": 7, "x": 10, "y": 15, "direction": "V", "answer": "ANDROID", "clue": "Popularny mobilny system operacyjny od Google"},
    {"id": 8, "x": 8, "y": 19, "direction": "H", "answer": "PROCES", "clue": "Uruchomiony i wykonywany program w systemie"},
    {"id": 9, "x": 11, "y": 19, "direction": "V", "answer": "CSS", "clue": "Kaskadowe arkusze stylów używane do wyglądu stron"},
    {"id": 10, "x": 12, "y": 19, "direction": "V", "answer": "EKRAN", "clue": "Wyświetlacz urządzenia elektronicznego"},
    {"id": 11, "x": 13, "y": 19, "direction": "V", "answer": "SIEC", "clue": "Połączone ze sobą komputery wymieniające dane (sieć)"},
    {"id": 12, "x": 11, "y": 21, "direction": "H", "answer": "SREBRO", "clue": "Kruszec szlachetny, drugi stopień podium"},
    {"id": 13, "x": 11, "y": 22, "direction": "H", "answer": "PACZKA", "clue": "Archiwum z kodem, moduł lub pakiet (np. npm)"},
    {"id": 14, "x": 10, "y": 5, "direction": "V", "answer": "DOMENA", "clue": "Adres internetowy strony, np. google.com"},
    {"id": 15, "x": 8, "y": 7, "direction": "H", "answer": "CHMURA", "clue": "Zdalne serwery i usługi hostingowe (cloud)"},
    {"id": 16, "x": 8, "y": 7, "direction": "V", "answer": "CIAG", "clue": "Struktura danych, np. znaków (string) lub liczb (ciąg)"},
    {"id": 17, "x": 12, "y": 7, "direction": "V", "answer": "RADIO", "clue": "Typ pola wyboru jednokrotnego wyboru (input type=radio)"},
    {"id": 18, "x": 12, "y": 9, "direction": "H", "answer": "DANE", "clue": "Informacje przetwarzane przez program"},
    {"id": 19, "x": 14, "y": 8, "direction": "V", "answer": "INTERNET", "clue": "Globalna sieć komputerowa"},
    {"id": 20, "x": 14, "y": 12, "direction": "H", "answer": "REACT", "clue": "Popularna biblioteka JS do budowy interfejsów od Meta"}
]'::jsonb
),
(
2,
'Kosmos i Astronomia',
'[
    {"id": 1, "x": 5, "y": 10, "direction": "H", "answer": "ASTRONOMIA", "clue": "Nauka o ciałach niebieskich"},
    {"id": 2, "x": 5, "y": 10, "direction": "V", "answer": "ASTEROIDA", "clue": "Mała planetoida krążąca wokół Słońca"},
    {"id": 3, "x": 7, "y": 10, "direction": "V", "answer": "TELESKOP", "clue": "Urządzenie optyczne do obserwacji odległych gwiazd"},
    {"id": 4, "x": 9, "y": 10, "direction": "V", "answer": "ORBITA", "clue": "Tor, po którym ciało niebieskie krąży wokół innego ciała"},
    {"id": 5, "x": 12, "y": 10, "direction": "V", "answer": "METEORYT", "clue": "Skalny okruch z kosmosu, który spadł na Ziemię"},
    {"id": 6, "x": 14, "y": 10, "direction": "V", "answer": "ATMOSFERA", "clue": "Gazowa powłoka otaczająca planetę"},
    {"id": 7, "x": 3, "y": 13, "direction": "H", "answer": "WIEZE", "clue": "Wysokie konstrukcje, np. obserwacyjne lub nadawcze (wieże)"},
    {"id": 8, "x": 3, "y": 13, "direction": "V", "answer": "WENUS", "clue": "Druga planeta od Słońca, bardzo gorąca"},
    {"id": 9, "x": 4, "y": 11, "direction": "V", "answer": "KSIEZYC", "clue": "Naturalny satelita Ziemi (Księżyc)"},
    {"id": 10, "x": 4, "y": 15, "direction": "H", "answer": "ZORKA", "clue": "Gwiazda poranna, jutrzenka"},
    {"id": 11, "x": 8, "y": 11, "direction": "H", "answer": "KRATER", "clue": "Zagłębienie powstałe po uderzeniu meteorytu"},
    {"id": 12, "x": 10, "y": 10, "direction": "V", "answer": "NASA", "clue": "Amerykańska agencja kosmiczna odpowiedzialna za loty kosmiczne"},
    {"id": 13, "x": 13, "y": 10, "direction": "V", "answer": "IRYS", "clue": "Słynna mgławica refleksyjna w gwiazdozbiorze Cefeusza"},
    {"id": 14, "x": 14, "y": 14, "direction": "H", "answer": "SLONCE", "clue": "Nasza najbliższa gwiazda centralna układu (Słońce)"},
    {"id": 15, "x": 14, "y": 16, "direction": "H", "answer": "ELIPSA", "clue": "Kształt orbity większości ciał niebieskich"},
    {"id": 16, "x": 16, "y": 14, "direction": "V", "answer": "ORION", "clue": "Jeden z najbardziej charakterystycznych gwiazdozbiorów zimowych"},
    {"id": 17, "x": 19, "y": 14, "direction": "V", "answer": "ETAN", "clue": "Prosty węglowodór obecny w jeziorach Tytana"},
    {"id": 18, "x": 13, "y": 18, "direction": "H", "answer": "MAGNES", "clue": "Ciało wytwarzające pole magnetyczne"},
    {"id": 19, "x": 18, "y": 18, "direction": "V", "answer": "SPUTNIK", "clue": "Pierwszy sztuczny satelita Ziemi wysłany w 1957 r."},
    {"id": 20, "x": 14, "y": 20, "direction": "H", "answer": "BIEGUN", "clue": "Punkt na powierzchni planety przez który przechodzi oś obrotu"}
]'::jsonb
),
(
3,
'Kuchnia i Kulinaria',
'[
    {"id": 1, "x": 5, "y": 10, "direction": "H", "answer": "PIECZENIE", "clue": "Obróbka cieplna potraw w piekarniku"},
    {"id": 2, "x": 5, "y": 10, "direction": "V", "answer": "PATELNIA", "clue": "Naczynie kuchenne do smażenia potraw"},
    {"id": 3, "x": 7, "y": 7, "direction": "V", "answer": "ESTEROWANIE", "clue": "Chemiczny proces otrzymywania estrów (zapachów owocowych)"},
    {"id": 4, "x": 9, "y": 10, "direction": "V", "answer": "ZIEMNIAK", "clue": "Popularne polskie warzywo bulwiaste podawane do obiadu"},
    {"id": 5, "x": 11, "y": 10, "direction": "V", "answer": "NALESNIK", "clue": "Smażony, cienki placek z ciasta mączno-jajecznego (naleśnik)"},
    {"id": 6, "x": 13, "y": 10, "direction": "V", "answer": "EMALIA", "clue": "Szklista powłoka ochronna na naczyniach metalowych"},
    {"id": 7, "x": 2, "y": 14, "direction": "H", "answer": "MASLO", "clue": "Produkt z tłuszczu mlecznego do smarowania pieczywa (masło)"},
    {"id": 8, "x": 2, "y": 14, "direction": "V", "answer": "MAKARON", "clue": "Produkt mączny o różnych kształtach, np. nitki, rurki"},
    {"id": 9, "x": 3, "y": 14, "direction": "V", "answer": "ANANAS", "clue": "Słodki i soczysty owoc tropikalny z pióropuszem liści"},
    {"id": 10, "x": 4, "y": 14, "direction": "V", "answer": "SER", "clue": "Produkt mleczny, np. twarogowy, żółty lub pleśniowy"},
    {"id": 11, "x": 2, "y": 16, "direction": "H", "answer": "KARI", "clue": "Indyjska kompozycja przypraw o żółtej barwie (curry)"},
    {"id": 12, "x": 1, "y": 18, "direction": "H", "answer": "KRAKER", "clue": "Chrupiący, lekko słony herbatnik"},
    {"id": 13, "x": 6, "y": 18, "direction": "V", "answer": "RYJOWY", "clue": "Zrobiony z ryżu, np. papier ryżowy"},
    {"id": 14, "x": 2, "y": 20, "direction": "H", "answer": "NAPOJ", "clue": "Płyn przeznaczony do picia (napój)"},
    {"id": 15, "x": 7, "y": 8, "direction": "H", "answer": "SOL", "clue": "Podstawowa przyprawa kuchenna wzmacniająca smak (sól)"},
    {"id": 16, "x": 8, "y": 8, "direction": "V", "answer": "OSCYPEK", "clue": "Tradycyjny, wędzony ser owczy wytwarzany w górach"},
    {"id": 17, "x": 7, "y": 15, "direction": "H", "answer": "NAIWNA", "clue": "Osoba łatwowierna"},
    {"id": 18, "x": 10, "y": 15, "direction": "V", "answer": "WARZYWA", "clue": "Rośliny jednoroczne lub dwuletnie, np. marchew, burak, sałata"},
    {"id": 19, "x": 9, "y": 19, "direction": "H", "answer": "RYBA", "clue": "Kulinarna ryba, np. dorsz, karp, łosoś"},
    {"id": 20, "x": 11, "y": 19, "direction": "V", "answer": "BANAN", "clue": "Mączysty owoc tropikalny w żółtej skórce"},
    {"id": 21, "x": 9, "y": 21, "direction": "H", "answer": "MANGO", "clue": "Słodki, soczysty owoc tropikalny z dużą płaską pestką"}
]'::jsonb
)
ON CONFLICT (level) DO UPDATE SET 
    name = EXCLUDED.name,
    words = EXCLUDED.words;
