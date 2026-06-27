-- setup.sql - Etap 1: Fundamenty bazy danych (Supabase SQL)
-- Wklej ten kod w Supabase -> SQL Editor i kliknij "Run".
-- Te poziomy są zoptymalizowane pod 50 plansz krzyżówek szwedzkich (Jolek).
-- Treść plansz jest generowana deterministycznie na podstawie numeru poziomu.

-- 1. Tworzenie tabeli krzyżówek (crosswords)
CREATE TABLE IF NOT EXISTS crosswords (
    id SERIAL PRIMARY KEY,
    level INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    words JSONB NOT NULL, -- przechowuje pusty jsonb, struktura generowana jest w JS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tworzenie tabeli pokoi (rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    crossword_id INTEGER REFERENCES crosswords(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'waiting' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Włączenie RLS (Row Level Security)
ALTER TABLE crosswords ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 4. Polityki RLS dla tabeli 'crosswords'
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

-- 6. Dodanie zoptymalizowanych 50 poziomów plansz (seed)
-- Generuje automatycznie poziomy od 1 do 50.

INSERT INTO crosswords (level, name, words)
SELECT 
    i, 
    'Łamigłówka ' || i, 
    '{}'::jsonb
FROM generate_series(1, 50) i
ON CONFLICT (level) DO UPDATE SET 
    name = EXCLUDED.name,
    words = EXCLUDED.words;
