# Plan Dikasirin — Multi-Store POS

## Info Project
- **Nama**: dikasirin
- **Status**: Terpisah dari `kasir-app` (project baru)
- **Stack**: Node.js + Express + SQLite + Vanilla JS + JWT + bcrypt
- **Model**: Freemium (Free / Premium) + Admin Approval
- **Target Rilis**: 4 minggu
- **Deploy**: Docker + docker-compose

---

## Struktur Folder

```
dikasirin/
├── package.json
├── .env
├── Dockerfile
├── docker-compose.yml
├── README.md
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── seed.js
│   ├── db/
│   │   ├── schema.sql
│   │   └── connection.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── premium.js
│   └── routes/
│       ├── auth.js
│       ├── admin.js
│       ├── products.js
│       ├── transactions.js
│       ├── stock.js
│       └── settings.js
└── public/
    ├── index.html              # Landing page
    ├── login.html
    ├── register.html
    ├── dashboard.html          # POS (setelah login)
    ├── admin.html
    ├── premium/
    │   ├── produk.html
    │   ├── stok.html
    │   └── laporan.html
    ├── css/
    │   ├── style.css
    │   └── landing.css
    └── js/
        ├── api.js
        ├── app.js
        ├── i18n.js
        ├── pos.js
        ├── admin.js
        └── premium/
            ├── produk.js
            ├── stok.js
            └── laporan.js
```

---

## Database Schema

```sql
-- Stores
CREATE TABLE stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    store_name TEXT NOT NULL,
    store_address TEXT,
    store_phone TEXT,
    initial_capital INTEGER DEFAULT 0,
    plan TEXT DEFAULT 'free',           -- 'free' | 'premium'
    status TEXT DEFAULT 'pending',      -- 'pending' | 'active' | 'suspended'
    role TEXT DEFAULT 'store',          -- 'store' | 'superadmin'
    created_at TEXT DEFAULT (datetime('now'))
);

-- Default Products (managed by admin, copied to new stores)
CREATE TABLE default_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    purchase_price INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (date('now'))
);

-- Products (per store)
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,             -- Harga Jual
    purchase_price INTEGER DEFAULT 0,   -- Harga Beli
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (date('now'))
);

-- Transactions
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    code TEXT UNIQUE NOT NULL,
    items TEXT NOT NULL,                -- JSON [{name, price, purchase_price, qty, discount, subtotal}]
    subtotal INTEGER NOT NULL,
    total_discount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    total_modal INTEGER DEFAULT 0,      -- Total harga beli untuk laba kotor
    payment_method TEXT NOT NULL,
    amount_paid INTEGER NOT NULL,
    change_amount INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Stock Movements
CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL,                 -- 'in' | 'out' | 'adjust'
    reason TEXT,
    qty INTEGER NOT NULL,
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Settings
CREATE TABLE settings (
    store_id INTEGER PRIMARY KEY REFERENCES stores(id),
    low_stock_threshold INTEGER DEFAULT 5
);
```

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/auth/register` | - | Register store baru (plan=free, status=pending) |
| POST | `/api/auth/login` | - | Login, return JWT |
| GET | `/api/auth/me` | JWT | Current user info |

### Admin (superadmin only)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/stores` | Daftar semua store |
| PUT | `/api/admin/stores/:id/approve` | Approve pending store (copy default_products) |
| PUT | `/api/admin/stores/:id/upgrade` | Upgrade ke premium |
| PUT | `/api/admin/stores/:id/suspend` | Suspend store |
| GET | `/api/admin/default-products` | Daftar produk default |
| POST | `/api/admin/default-products` | Tambah produk default |
| PUT | `/api/admin/default-products/:id` | Edit produk default |
| DELETE | `/api/admin/default-products/:id` | Hapus produk default |

### Products (JWT required)
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/products` | All | Daftar produk store sendiri (+ filter/search) |
| POST | `/api/products` | All | Tambah produk |
| PUT | `/api/products/:id` | All | Edit produk |
| DELETE | `/api/products/:id` | All | Hapus produk |

### Transactions (JWT required)
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| POST | `/api/transactions` | All | Checkout (dengan limit check 50/hari untuk free) |
| GET | `/api/transactions` | All | Daftar transaksi |
| GET | `/api/transactions/daily-summary` | All | Ringkasan hari ini (omset, diskon, modal, laba) |
| GET | `/api/transactions/monthly-summary` | Premium | Ringkasan bulanan + chart data |
| GET | `/api/transactions/top-products` | Premium | Top produk by revenue/profit |

### Stock (JWT required)
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/stock-movements` | All | Riwayat mutasi (free: hanya penjualan otomatis) |
| POST | `/api/stock-movements/adjust` | Premium | Manual adjust stok (in/out/adjust) |

### Settings (JWT required)
| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| GET | `/api/settings` | All | Ambil settings store |
| PUT | `/api/settings` | Premium | Update settings |

---

## Free vs Premium

| Fitur | Free | Premium |
|-------|------|---------|
| POS (cart, checkout, receipt) | ✅ | ✅ |
| CRUD Produk (harga jual + beli) | ✅ Unlimited | ✅ Unlimited |
| Stok (lihat stok + riwayat penjualan) | ✅ | ✅ |
| Ringkasan Harian (omset + laba) | ✅ | ✅ |
| Kartu Stok (adjust manual) | ❌ | ✅ |
| Laporan + Chart | ❌ | ✅ |
| Export CSV | ❌ | ✅ |
| Batas Transaksi | **50/hari** | Unlimited |
| Modal Awal (register) | ✅ | ✅ |

---

## Halaman & URL

| URL | File | Fungsi | Bahasa |
|-----|------|--------|--------|
| `/` | `index.html` | Landing page | EN/ID |
| `/login` | `login.html` | Login | EN/ID |
| `/register` | `register.html` | Daftar toko baru | EN/ID |
| `/dashboard` | `dashboard.html` | POS utama (setelah login) | EN/ID |
| `/admin` | `admin.html` | Panel super admin | ID |
| `/premium/produk` | `premium/produk.html` | Manajemen produk | ID |
| `/premium/stok` | `premium/stok.html` | Kartu stok | ID |
| `/premium/laporan` | `premium/laporan.html` | Laporan + chart | ID |

---

## i18n (English / Indonesian)

- File: `public/js/i18n.js`
- Deteksi otomatis dari browser
- Simpan pilihan di localStorage
- Render via atribut `data-i18n="key"`
- Landing page: EN default, bisa ganti ke ID
- App pages: ID default

---

## Landing Page Sections

1. **Navbar** — Logo + Fitur/Harga + Login + Daftar + 🌐 EN|ID
2. **Hero** — Tagline + CTA "Mulai Gratis" + screenshot dashboard
3. **Features** — Grid fitur utama (POS, Produk, Stok, Laporan)
4. **Pricing** — Free vs Premium comparison table
5. **CTA** — "Mulai Gratis — Tanpa Kartu Kredit"
6. **Footer** — © dikasirin 2026, kontak

---

## Alur Register -> Aktif

```
User daftar → status=pending, plan=free
     ↓
Super Admin login ke /admin
     ↓
Lihat daftar pending → Approve
     ↓
System: copy default_products → products (dengan store_id user)
     ↓
User login → status=active → bisa pakai POS
```

---

## Timeline — 4 Minggu

### Minggu 1 — Backend Foundation
- Init project, Express server, SQLite schema + connection
- Auth routes (register, login, me)
- Admin routes (approve, upgrade, suspend, default products CRUD)
- Products API (CRUD, filter)
- Transactions API (create with limit check, list, daily-summary)
- Stock API (movements list + adjust)
- Settings API

### Minggu 2 — Frontend Core
- api.js (fetch wrapper, JWT)
- app.js (auth guard, sidebar)
- i18n.js (translations EN/ID)
- Landing page (index.html + landing.css)
- Login + Register pages
- Admin page (store list, approve, upgrade, default products)
- Dashboard (POS) layout

### Minggu 3 — Premium Pages
- Pos.js (cart, checkout, receipt, ringkasan harian)
- Produk page (CRUD table, filter, CSV)
- Stok page (kartu stok, adjust)
- Laporan page (summary, chart, top products, filter period)

### Minggu 4 — Polish & Deploy
- Loading states, empty states, error handling
- Upgrade prompts (banner, sidebar lock)
- Responsive design
- Screenshot mockup untuk landing page
- Dockerfile + docker-compose
- README dokumentasi
- End-to-end testing + bug fixing

---

## Catatan

- POS pindah dari index.html → dashboard.html
- index.html jadi landing page publik
- Landing page mockup: screenshot asli (diambil minggu 4 setelah app jadi)
- Harga beli (purchase_price) wajib diisi agar laba kotor akurat
- Omset Bersih = total - diskon
- Laba Kotor = omset bersih - total_modal (Σ purchase_price × qty)
- Modal awal (initial_capital) dicatat di register, untuk referensi ROI
- Free user: CRUD produk unlimited, transaksi max 50/hari
- Premium user: unlimited semua
