# LAPISLAPIS — Production & Sales System
## Dokumentasi Proyek untuk Future Development

---

## 1. RINGKASAN PROYEK

**Nama sistem:** LapisLapis Production & Sales System  
**Versi:** 2.0.0  
**Fungsi:** Manajemen stok produksi, order penjualan, surat jalan, dan laporan untuk toko LapisLapis.

---

## 2. STACK TEKNOLOGI

| Komponen | Teknologi | Versi |
|---|---|---|
| Frontend | React | 18.2.0 |
| Build tool | Create React App | 5.0.1 |
| Database & Auth | Supabase (PostgreSQL) | ^2.39.0 |
| Deploy | Vercel | - |
| Export Excel | xlsx | ^0.18.5 |
| Export PDF | jsPDF + autotable | ^2.5.1 |

Tidak ada backend server terpisah — semua query langsung ke Supabase dari browser (client-side).

---

## 3. LOKASI & AKSES PROYEK

### Repository GitHub
```
https://github.com/dewa13jaya/lapislapis-v2
Branch utama: main
```
Push ke `main` → Vercel otomatis build & deploy.

### Vercel (Production)
Deploy otomatis dari GitHub. Cek URL production di:
```
https://vercel.com/dashboard
```
Login dengan akun GitHub `dewa13jaya`.

### Folder Lokal
```
~/Downloads/lapislapis-v2/
```

---

## 4. DATABASE — SUPABASE

### Koneksi
```
Project URL : https://vamjnhyqolespeubjsuv.supabase.co
Anon Key   : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (lihat src/supabase.js)
Dashboard  : https://supabase.com/dashboard/project/vamjnhyqolespeubjsuv
```

### Tabel-tabel utama

| Tabel | Fungsi |
|---|---|
| `products` | Master produk (nama, kategori, satuan, harga, stok minimum) |
| `outlets` | Master outlet (nama, alamat, phone, PIC, jam operasional) |
| `users_profile` | Data staff (nama, PIN, role, phone, outlet_ids) |
| `stock_in` | Riwayat stok masuk produksi |
| `stock_out` | Riwayat stok keluar (defect, sample, konversi) |
| `batches` | Tracking batch produksi |
| `returns` | Retur dari outlet |
| `orders` | Order penjualan ke outlet |
| `order_items` | Detail item per order |
| `activity_log` | Log semua aktivitas pengguna |

### Kolom penting yang ditambahkan (migration)

```sql
-- Kolom phone di outlets (untuk no. telp outlet di Surat Jalan)
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS phone TEXT;

-- Kolom phone di users_profile (untuk no. HP pemesan di Surat Jalan)
ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS phone TEXT;
```

File migration lengkap ada di folder proyek:
- `update_outlet_phones.sql` — update no. telp semua outlet dari website
- `migration_staff_phone.sql` — tambah kolom phone ke users_profile
- `migration_date_tracking.sql` — tracking tanggal
- `lapislapis_outlets.sql` — seed data outlet awal
- `lapislapis_products.sql` — seed data produk awal

---

## 5. STRUKTUR FOLDER

```
lapislapis-v2/
├── src/
│   ├── App.js                  ← Root app, fetch semua data, routing tab
│   ├── supabase.js             ← Koneksi Supabase (URL + anon key)
│   ├── utils.js                ← Helper: uid(), today(), fmtDate(), useIsMobile()
│   ├── printSJ.js              ← Generate & print Surat Jalan (HTML popup)
│   ├── context/
│   │   └── AuthContext.js      ← Login state & session management
│   ├── components/
│   │   ├── UI.js               ← Komponen reusable: Btn, FieldGroup, Toast, dll
│   │   └── Header.js           ← Navigasi tab atas
│   └── pages/
│       ├── LoginPage.js        ← Halaman login (nama + PIN)
│       ├── Dashboard.js        ← Dashboard ringkasan
│       ├── StockManager.js     ← Manajemen stok (input, ringkasan, stok by rasa)
│       ├── OrderManager.js     ← Manajemen order penjualan
│       ├── SuratJalan.js       ← Cetak surat jalan
│       ├── Reports.js          ← Laporan & export Excel/PDF
│       ├── OtherPages.js       ← Staff, Outlet, Product manager + Activity Log
│       └── ProductionDetail.js ← Detail produksi
├── public/
│   └── index.html
├── build/                      ← Hasil build (di-deploy ke Vercel)
├── vercel.json                 ← Config Vercel (buildCommand, outputDirectory)
├── package.json
└── DOKUMENTASI.md              ← File ini
```

---

## 6. ROLE & HAK AKSES

| Role | Akses |
|---|---|
| `admin` | Semua fitur + tambah/hapus produk & outlet |
| `kepala_produksi` | Input stok, konversi, lihat semua |
| `produksi` | Input stok masuk & keluar |
| `kepala_sales` | Buat & kelola order, lihat laporan |
| `sales` | Buat order (hanya outlet yang ditugaskan) |

Login menggunakan **nama** (starts-with, case-insensitive) + **PIN 4 digit**.

---

## 7. FITUR UTAMA

### Stok
- Input stok masuk (normal & **mass input grid** seperti Stok by Rasa)
- **WA Import** — paste recap WhatsApp, otomatis isi grid
- Stok keluar (defect, sample, dll)
- Retur dari outlet
- Konversi ukuran (Loyang → Half → Quarter → Slice)
- Ringkasan stok per periode dengan export WA
- **Stok by Rasa** — pivot tabel variant × ukuran, dengan export WA

### Order
- Buat order per outlet
- Status: pending → confirmed → packed → delivered/partial_delivered/rejected
- Sales hanya bisa order untuk outlet yang ditugaskan

### Surat Jalan
- **Sementara** (status packed) — Qty Pesan + Qty Kirim
- **Final** (status delivered) — + Qty Reject + Alasan
- Tercetak: No. Telp Outlet, Nama Pemesan, No. HP Pemesan, Tgl Pesan

### Laporan
- Export Excel & PDF per periode

---

## 8. CARA DEVELOPMENT LOKAL

```bash
cd ~/Downloads/lapislapis-v2
npm start          # jalankan di localhost:3000
```

### Deploy ke production
```bash
git add [file yang diubah]
git commit -m "deskripsi perubahan"
git push           # Vercel otomatis build & deploy dari GitHub main
```

### Kalau perlu build manual
```bash
npm run build      # output ke folder build/
```

---

## 9. VARIANT SORT ORDER (penting!)

Urutan variant di Mass Input, Stok by Rasa, dan WA Report mengikuti konstanta `VARIANT_KEYWORDS` di `StockManager.js`:

**Lapis Legit:** Original → Spekulaas → Cheese → Almond → Choco → Pandan → Prune → Green Tea → Coffee → Mocca → Cempedak → Durian → Fruit

**Lapis Surabaya:** Sur (base) → Rainbow → Choco → Mix Choco → Mix → Pandan Mix → Pandan Ovo → Mocca → Pandan Cheese

**Cookies:** Kastangel → Nastar Premium → Nastar Durian → Nastar → Queker → S.Keju → L.Kucing → Blue/Straw → Chocodark → Semprit → Hazel → Che Alm → Chocosoft → Kue Kacang → Cookies Legit → Coconut → Snow

**Gift Box:** Tidak ditampilkan di Stok by Rasa, Mass Input, dan WA Stok by Rasa.

---

## 10. CATATAN PENTING

- **Tidak ada auth Supabase** — login custom via PIN di tabel `users_profile`. Anon key cukup untuk semua operasi.
- **Realtime** — perubahan data dari user lain langsung update otomatis via Supabase Realtime (postgres_changes).
- **currentStock** dihitung di frontend setiap render: `stockIn + retur - stockOut - orderDelivered`.
- **Surat Jalan** dicetak di browser popup (window.open), bukan file PDF.
- Kalau ada outlet/staff baru, **no. HP harus diisi manual** di menu Master Outlet / Manajemen Staff.
