# 🛒 KasirKu — Sistem Kasir Modern

Sistem kasir (Point of Sale) berbasis web yang dilengkapi dengan rekapan bulanan lengkap. Dibangun menggunakan HTML, CSS, dan JavaScript murni tanpa framework.

## 📋 Fitur

### 💰 Halaman Kasir (Point of Sale)
- Pencarian produk (search bar)
- Grid tampilan produk dengan emoji kategori
- Keranjang belanja interaktif (tambah, ubah jumlah, hapus)
- Diskon per item dan diskon total transaksi
- 4 metode pembayaran: Tunai, Kartu, E-Wallet, QRIS
- Hitung kembalian otomatis
- Tombol uang pas & quick amount
- Cetak struk belanja
- Nomor transaksi otomatis (format: TRX-YYYYMMDD-XXX)
- Peringatan stok rendah di sidebar

### 📦 Manajemen Produk
- CRUD produk (Tambah, Edit, Hapus)
- Kategori produk: Makanan, Minuman, Lainnya + custom
- Stok produk dengan badge peringatan stok rendah/habis
- Statistik: total produk, kategori, stok rendah, stok habis
- Pencarian & filter (kategori, status stok)
- Export produk ke CSV
- Import produk dari CSV
- 18 produk contoh (dummy data) tersedia otomatis

### 📊 Rekapan Bulanan
- Filter laporan berdasarkan bulan & tahun
- 5 kartu ringkasan: total omzet, transaksi, rata-rata, item terjual, total diskon
- Grafik penjualan harian (bar chart Canvas)
- Grafik produk terlaris (donut chart Canvas)
- Top 5 produk terlaris dengan progress bar
- Tabel detail semua transaksi per bulan
- Export transaksi ke CSV
- Export ringkasan ke CSV

## 🏗️ Struktur Proyek

```
kasir-app/
├── index.html          # Halaman kasir (POS)
├── products.html       # Manajemen produk
├── reports.html        # Rekapan bulanan
├── css/
│   └── style.css       # Stylesheet (semua halaman)
├── js/
│   ├── storage.js      # Modul penyimpanan (localStorage + CSV)
│   ├── app.js          # Core app (utilities, format, toast, modal)
│   ├── pos.js          # Logic halaman kasir
│   ├── products.js     # Logic manajemen produk
│   └── reports.js      # Logic rekapan bulanan & grafik
└── README.md           # Dokumentasi ini
```

## 🚀 Cara Menjalankan

### Opsi 1: Langsung buka di browser
Cukup buka file `index.html` di browser (Chrome, Firefox, Edge).

### Opsi 2: Menggunakan HTTP Server (recommended)
```bash
# Menggunakan Python
cd kasir-app
python -m http.server 8080

# Atau menggunakan Node.js (npx)
cd kasir-app
npx serve .
```

Lalu buka `http://localhost:8080` di browser.

## 💾 Data & Penyimpanan

- Semua data disimpan di **localStorage** browser
- Data tersimpan selama browser tidak di-clear
- Bisa **export** ke CSV kapan saja untuk backup
- Bisa **import** dari CSV untuk restore data

### Format CSV Export
**Produk:** ID, Nama, Kategori, Harga, Stok, Tanggal Dibuat
**Transaksi:** No Transaksi, Tanggal, Item, Subtotal, Diskon, Total, Metode Bayar, Dibayar, Kembalian
**Ringkasan:** Periode, Total Transaksi, Total Omzet, Total Diskon, Total Item, Rata-rata/Transaksi

## 🎨 Desain

- Tema warna: **Navy Blue** + **Green Accent**
- Sidebar navigasi tetap
- Responsive layout (desktop, tablet)
- Toast notification untuk feedback
- Modal dialog untuk konfirmasi
- Animasi & transisi smooth

## 📌 Catatan

- Dibangun tanpa framework/library eksternal
- Semua grafik menggunakan Canvas API native
- Kompatibel dengan Chrome, Firefox, Edge (modern browsers)
- Data contoh (18 produk makanan/minuman) akan otomatis dimuat saat pertama kali dibuka

---

**KasirKu** © 2026 — Sistem Kasir Modern
