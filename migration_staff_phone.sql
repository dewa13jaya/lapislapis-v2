-- ============================================================
-- ADD PHONE COLUMN TO users_profile
-- Jalankan di Supabase SQL Editor (satu kali saja)
-- ============================================================

ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS phone TEXT;

-- Verifikasi
SELECT id, name, role, phone FROM users_profile ORDER BY name;
