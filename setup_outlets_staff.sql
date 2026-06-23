-- ============================================================
-- LAPISLAPIS — Setup Outlet & Assignment Sales Staff
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- Jalankan STEP 1, 2, 3 secara berurutan
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- STEP 1: INSERT OUTLETS BARU
-- Nama outlet sesuai website lapislapis.co.id
-- Skip jika sudah ada (berdasarkan nama)
-- ════════════════════════════════════════════════════════════

INSERT INTO outlets (id, name, pic_name, pic_phone, phone, address, notes, jam_operasional)
SELECT
  'OTL' || upper(substring(md5(random()::text || o.name), 1, 7)),
  o.name, o.pic, o.pic_phone, '', '', '', ''
FROM (VALUES
  -- ── SYIFA — Bandara Soekarno-Hatta ──────────────────────
  ('Soetta Domestic Terminal 3',          'Syifa', '+62 812-1113-4125'),
  ('Soetta International Terminal 3 Gate','Syifa', '+62 812-1113-4125'),
  ('Soetta International Terminal 3 Lok', 'Syifa', '+62 812-1113-4125'),
  ('Soetta International Terminal 2F',    'Syifa', '+62 812-1113-4125'),

  -- ── AMY ─────────────────────────────────────────────────
  ('Living World Alam Sutera',   'Amy', '+62 878-8989-8640'),
  ('Bintaro Xchange Mall 2',     'Amy', '+62 878-8989-8640'),
  ('Pondok Indah Mall 2',        'Amy', '+62 878-8989-8640'),
  ('Pondok Indah Mall 3',        'Amy', '+62 878-8989-8640'),
  ('Gandaria City',              'Amy', '+62 878-8989-8640'),
  ('Hellopie Plaza Blok M',      'Amy', '+62 878-8989-8640'),

  -- ── FAUZI ───────────────────────────────────────────────
  ('Pacific Place',              'Fauzi', '+62 813-8545-3617'),
  ('Kota Kasablanka',            'Fauzi', '+62 813-8545-3617'),
  ('Plaza Senayan',              'Fauzi', '+62 813-8545-3617'),
  ('Senayan City',               'Fauzi', '+62 813-8545-3617'),
  ('Senayan Park',               'Fauzi', '+62 813-8545-3617'),
  ('Lippo Mall Puri Foodhall',   'Fauzi', '+62 813-8545-3617'),
  ('Lippo Mall Puri LG',         'Fauzi', '+62 813-8545-3617'),
  ('Puri Indah Mall 2',          'Fauzi', '+62 813-8545-3617'),
  ('Pesanggrahan',               'Fauzi', '+62 813-8545-3617'),

  -- ── OKTA ────────────────────────────────────────────────
  ('Mall Kelapa Gading 3',       'Okta', '+62 813-1600-0420'),
  ('Sunter',                     'Okta', '+62 813-1600-0420'),
  ('K Mall Menara Jakarta',      'Okta', '+62 813-1600-0420'),
  ('Pluit',                      'Okta', '+62 813-1600-0420'),
  ('Central Market PIK 2',       'Okta', '+62 813-1600-0420'),
  ('Central Park',               'Okta', '+62 813-1600-0420'),

  -- ── EDY ─────────────────────────────────────────────────
  ('Grand Indonesia West Mall',  'Edy', '+62 812-9019-4599'),
  ('Grand Indonesia East Mall',  'Edy', '+62 812-9019-4599'),
  ('Plaza Indonesia LG',         'Edy', '+62 812-9019-4599'),
  ('Plaza Indonesia Level 4',    'Edy', '+62 812-9019-4599')

) AS o(name, pic, pic_phone)
WHERE NOT EXISTS (
  SELECT 1 FROM outlets WHERE lower(outlets.name) = lower(o.name)
);


-- ════════════════════════════════════════════════════════════
-- STEP 2: BUAT AKUN STAFF YANG BELUM ADA
-- PIN default: 1234 (minta staff ganti setelah login pertama)
-- Role: sales
-- ════════════════════════════════════════════════════════════

INSERT INTO users_profile (id, name, role, pin, phone, is_active, outlet_ids)
SELECT
  'USR' || upper(substring(md5(random()::text || s.name), 1, 6)),
  s.name, 'sales', '1234', s.phone, true, '{}'
FROM (VALUES
  ('Amy',   '+62 878-8989-8640'),
  ('Fauzi', '+62 813-8545-3617'),
  ('Okta',  '+62 813-1600-0420'),
  ('Edy',   '+62 812-9019-4599'),
  ('Syifa', '+62 812-1113-4125')
) AS s(name, phone)
WHERE NOT EXISTS (
  SELECT 1 FROM users_profile WHERE lower(users_profile.name) = lower(s.name)
);


-- ════════════════════════════════════════════════════════════
-- STEP 3: ASSIGN OUTLET KE STAFF
-- Jalankan SETELAH Step 1 & 2
-- ════════════════════════════════════════════════════════════

-- Amy
UPDATE users_profile
SET outlet_ids = (
  SELECT array_agg(id ORDER BY name)
  FROM outlets
  WHERE lower(name) IN (
    'living world alam sutera', 'bintaro xchange mall 2',
    'pondok indah mall 2', 'pondok indah mall 3',
    'gandaria city', 'hellopie plaza blok m'
  )
)
WHERE lower(name) = 'amy';

-- Fauzi
UPDATE users_profile
SET outlet_ids = (
  SELECT array_agg(id ORDER BY name)
  FROM outlets
  WHERE lower(name) IN (
    'pacific place', 'kota kasablanka', 'plaza senayan',
    'senayan city', 'senayan park',
    'lippo mall puri foodhall', 'lippo mall puri lg',
    'puri indah mall 2', 'pesanggrahan'
  )
)
WHERE lower(name) = 'fauzi';

-- Okta
UPDATE users_profile
SET outlet_ids = (
  SELECT array_agg(id ORDER BY name)
  FROM outlets
  WHERE lower(name) IN (
    'mall kelapa gading 3', 'sunter', 'k mall menara jakarta',
    'pluit', 'central market pik 2', 'central park'
  )
)
WHERE lower(name) = 'okta';

-- Edy
UPDATE users_profile
SET outlet_ids = (
  SELECT array_agg(id ORDER BY name)
  FROM outlets
  WHERE lower(name) IN (
    'grand indonesia west mall', 'grand indonesia east mall',
    'plaza indonesia lg', 'plaza indonesia level 4'
  )
)
WHERE lower(name) = 'edy';

-- Syifa
UPDATE users_profile
SET outlet_ids = (
  SELECT array_agg(id ORDER BY name)
  FROM outlets
  WHERE lower(name) IN (
    'soetta domestic terminal 3', 'soetta international terminal 3 gate',
    'soetta international terminal 3 lok', 'soetta international terminal 2f'
  )
)
WHERE lower(name) = 'syifa';


-- ════════════════════════════════════════════════════════════
-- VERIFIKASI — Jalankan untuk cek hasil
-- ════════════════════════════════════════════════════════════

-- Cek semua outlet baru:
-- SELECT name, pic_name, pic_phone FROM outlets ORDER BY pic_name, name;

-- Cek staff + jumlah outlet yang di-assign:
-- SELECT name, role, phone, array_length(outlet_ids, 1) as jumlah_outlet
-- FROM users_profile WHERE role = 'sales' ORDER BY name;
