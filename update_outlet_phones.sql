-- ============================================================
-- UPDATE OUTLET PHONE NUMBERS dari lapislapis.co.id/stores
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Step 1: Pastikan kolom phone ada
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================
-- TANGERANG
-- ============================================================
UPDATE outlets SET phone = '0811-1788-019'
  WHERE name ILIKE '%terminal 3%' AND name ILIKE '%domestic%';

UPDATE outlets SET phone = '0811-1559-8899'
  WHERE name ILIKE '%terminal 3%' AND (name ILIKE '%boarding%' OR name ILIKE '%gate%');

UPDATE outlets SET phone = '0811-1788-645'
  WHERE name ILIKE '%lokatara%' OR (name ILIKE '%terminal 3%' AND name ILIKE '%lokatara%');

UPDATE outlets SET phone = '0811-1498-109'
  WHERE name ILIKE '%terminal 2%';

UPDATE outlets SET phone = '0811-9601-0801'
  WHERE name ILIKE '%bintaro%';

UPDATE outlets SET phone = '0811-1028-020'
  WHERE name ILIKE '%living world%' OR name ILIKE '%alam sutera%';

-- ============================================================
-- NORTH JAKARTA
-- ============================================================
UPDATE outlets SET phone = '0811-1788-102'
  WHERE name ILIKE '%sunter%';

UPDATE outlets SET phone = '0811-9788-107'
  WHERE name ILIKE '%kelapa gading%' OR name ILIKE '%mkg%';

UPDATE outlets SET phone = '0811-1438-108'
  WHERE name ILIKE '%central market%' OR name ILIKE '%pik%' OR name ILIKE '%pantai indah kapuk%';

UPDATE outlets SET phone = '0811-1748-104'
  WHERE name ILIKE '%pluit%';

-- ============================================================
-- WEST JAKARTA
-- ============================================================
UPDATE outlets SET phone = '0811-1286-847'
  WHERE name ILIKE '%pesanggrahan%' OR name ILIKE '%ranch market%pesanggrahan%';

UPDATE outlets SET phone = '0823-1146-9371'
  WHERE (name ILIKE '%lippo%puri%' OR name ILIKE '%lippo mall puri%') AND name ILIKE '%foodhall%';

UPDATE outlets SET phone = '0811-8988-105'
  WHERE (name ILIKE '%lippo%puri%' OR name ILIKE '%lippo mall puri%') AND (name ILIKE '%lg%' OR name ILIKE '%lower%');

UPDATE outlets SET phone = '0811-1478-107'
  WHERE name ILIKE '%central park%';

UPDATE outlets SET phone = '0811-8000-2031'
  WHERE name ILIKE '%puri indah%';

-- ============================================================
-- CENTRAL JAKARTA
-- ============================================================
UPDATE outlets SET phone = '0811-1788-104'
  WHERE name ILIKE '%grand indonesia%' AND name ILIKE '%east%';

UPDATE outlets SET phone = '0811-1718-103'
  WHERE name ILIKE '%grand indonesia%' AND name ILIKE '%west%';

UPDATE outlets SET phone = '0811-1788-142'
  WHERE name ILIKE '%plaza indonesia%' AND (name ILIKE '%lg%' OR name ILIKE '%lower%' OR name ILIKE '%ground%');

UPDATE outlets SET phone = '0811-1201-6518'
  WHERE name ILIKE '%plaza indonesia%' AND (name ILIKE '%level 4%' OR name ILIKE '%lv4%' OR name ILIKE '%4th%');

UPDATE outlets SET phone = '0811-1788-644'
  WHERE name ILIKE '%plaza senayan%';

UPDATE outlets SET phone = '0811-1000-2496'
  WHERE name ILIKE '%senayan park%';

UPDATE outlets SET phone = '0811-1078-147'
  WHERE name ILIKE '%senayan city%';

UPDATE outlets SET phone = '0811-8882-2104'
  WHERE name ILIKE '%k mall%' OR name ILIKE '%menara jakarta%';

-- ============================================================
-- SOUTH JAKARTA
-- ============================================================
UPDATE outlets SET phone = '0811-1286-846'
  WHERE name ILIKE '%pondok indah%2%' OR (name ILIKE '%pim%2%') OR (name ILIKE '%pim 2%');

UPDATE outlets SET phone = '0811-1001-6393'
  WHERE name ILIKE '%pacific place%';

UPDATE outlets SET phone = '0811-1788-106'
  WHERE name ILIKE '%kota kasablanka%' OR name ILIKE '%kokas%';

UPDATE outlets SET phone = '0811-1002-0061'
  WHERE name ILIKE '%gandaria%';

UPDATE outlets SET phone = '0811-8887-6690'
  WHERE name ILIKE '%blok m%' OR name ILIKE '%hellopie%blok%';

UPDATE outlets SET phone = '0811-1201-6508'
  WHERE name ILIKE '%pondok indah%3%' OR name ILIKE '%pim%3%' OR name ILIKE '%pim 3%';

-- ============================================================
-- Verifikasi hasil
-- ============================================================
SELECT id, name, phone FROM outlets ORDER BY name;
