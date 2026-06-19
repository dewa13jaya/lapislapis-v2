-- Tambah kolom actual_delivery_date & original_delivery_date ke tabel orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_delivery_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reschedule_notes text;

-- Isi original_delivery_date dari delivery_date yang sudah ada
UPDATE orders SET original_delivery_date = delivery_date WHERE original_delivery_date IS NULL;

-- Verifikasi
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name IN ('actual_delivery_date','original_delivery_date','reschedule_notes');
