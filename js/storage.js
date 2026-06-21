/**
 * storage.js — Modul Penyimpanan Data
 * Mengelola data produk & transaksi via localStorage
 * Mendukung export/import CSV
 */

const Storage = (() => {
    const KEYS = {
        PRODUCTS: 'kasir_products',
        TRANSACTIONS: 'kasir_transactions',
        SETTINGS: 'kasir_settings',
    };

    // ===================== GENERIC HELPERS =====================

    function _get(key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    }

    function _set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function _generateId(prefix) {
        const now = new Date();
        const datePart = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const items = _get(KEYS.TRANSACTIONS);
        const todayCount = items.filter(t => t.id.includes(datePart)).length;
        const seq = String(todayCount + 1).padStart(3, '0');
        return `${prefix}-${datePart}-${seq}`;
    }

    function _generateProductId() {
        const items = _get(KEYS.PRODUCTS);
        const num = items.length + 1;
        return 'PRD' + String(num).padStart(3, '0');
    }

    // ===================== PRODUCTS =====================

    function getProducts() {
        return _get(KEYS.PRODUCTS);
    }

    function getProductById(id) {
        return getProducts().find(p => p.id === id) || null;
    }

    function addProduct(product) {
        const products = getProducts();
        product.id = _generateProductId();
        product.createdAt = new Date().toISOString().split('T')[0];
        products.push(product);
        _set(KEYS.PRODUCTS, products);
        return product;
    }

    function updateProduct(id, updates) {
        const products = getProducts();
        const index = products.findIndex(p => p.id === id);
        if (index === -1) return null;
        products[index] = { ...products[index], ...updates };
        _set(KEYS.PRODUCTS, products);
        return products[index];
    }

    function deleteProduct(id) {
        const products = getProducts();
        const filtered = products.filter(p => p.id !== id);
        if (filtered.length === products.length) return false;
        _set(KEYS.PRODUCTS, filtered);
        return true;
    }

    function updateStock(productId, qtySold) {
        const product = getProductById(productId);
        if (!product) return false;
        if (product.stock < qtySold) return false;
        return updateProduct(productId, { stock: product.stock - qtySold });
    }

    function restoreStock(productId, qty) {
        const product = getProductById(productId);
        if (!product) return false;
        return updateProduct(productId, { stock: product.stock + qty });
    }

    function getLowStockProducts(threshold = 5) {
        return getProducts().filter(p => p.stock <= threshold);
    }

    function getCategories() {
        const products = getProducts();
        return [...new Set(products.map(p => p.category))].sort();
    }

    // ===================== TRANSACTIONS =====================

    function getTransactions() {
        return _get(KEYS.TRANSACTIONS);
    }

    function addTransaction(transaction) {
        const transactions = getTransactions();
        transaction.id = _generateId('TRX');
        transaction.date = new Date().toISOString();
        transactions.push(transaction);
        _set(KEYS.TRANSACTIONS, transactions);
        return transaction;
    }

    function deleteTransaction(id) {
        const transactions = getTransactions();
        const filtered = transactions.filter(t => t.id !== id);
        if (filtered.length === transactions.length) return false;
        _set(KEYS.TRANSACTIONS, filtered);
        return true;
    }

    function getTransactionsByMonth(year, month) {
        return getTransactions().filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }

    function getTransactionsByDate(dateStr) {
        return getTransactions().filter(t => {
            return t.date.startsWith(dateStr);
        });
    }

    function getMonthlySummary(year, month) {
        const transactions = getTransactionsByMonth(year, month);
        let totalRevenue = 0;
        let totalDiscount = 0;
        let totalItems = 0;
        const productSales = {};

        transactions.forEach(t => {
            totalRevenue += t.total;
            totalDiscount += t.totalDiscount || 0;
            t.items.forEach(item => {
                totalItems += item.qty;
                if (!productSales[item.name]) {
                    productSales[item.name] = { qty: 0, revenue: 0 };
                }
                productSales[item.name].qty += item.qty;
                productSales[item.name].revenue += item.subtotal;
            });
        });

        const dailySales = {};
        transactions.forEach(t => {
            const day = new Date(t.date).getDate();
            if (!dailySales[day]) dailySales[day] = 0;
            dailySales[day] += t.total;
        });

        const topProducts = Object.entries(productSales)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return {
            totalTransactions: transactions.length,
            totalRevenue,
            totalDiscount,
            totalItems,
            averagePerTransaction: transactions.length > 0
                ? Math.round(totalRevenue / transactions.length) : 0,
            dailySales,
            productSales,
            topProducts,
            transactions,
        };
    }

    // ===================== CSV EXPORT =====================

    function exportProductsCSV() {
        const products = getProducts();
        if (products.length === 0) return;

        const headers = ['ID', 'Nama Produk', 'Kategori', 'Harga', 'Stok', 'Tanggal Dibuat'];
        const rows = products.map(p => [
            p.id, p.name, p.category, p.price, p.stock, p.createdAt
        ]);

        downloadCSV(headers, rows, 'produk_' + _getDateStamp() + '.csv');
    }

    function exportTransactionsCSV(year, month) {
        const summary = getMonthlySummary(year, month);
        if (summary.transactions.length === 0) return;

        const headers = ['No Transaksi', 'Tanggal', 'Item', 'Subtotal', 'Diskon', 'Total', 'Metode Bayar', 'Dibayar', 'Kembalian'];
        const rows = summary.transactions.map(t => [
            t.id,
            new Date(t.date).toLocaleString('id-ID'),
            t.items.map(i => `${i.name} x${i.qty}`).join('; '),
            t.subtotal,
            t.totalDiscount || 0,
            t.total,
            t.paymentMethod,
            t.amountPaid,
            t.change,
        ]);

        const monthStr = String(month + 1).padStart(2, '0');
        downloadCSV(headers, rows, `laporan_${year}${monthStr}.csv`);
    }

    function exportSummaryCSV(year, month) {
        const summary = getMonthlySummary(year, month);

        const headers = ['Periode', 'Total Transaksi', 'Total Omzet', 'Total Diskon', 'Total Item', 'Rata-rata/Transaksi'];
        const rows = [[
            `${year}-${String(month + 1).padStart(2, '0')}`,
            summary.totalTransactions,
            summary.totalRevenue,
            summary.totalDiscount,
            summary.totalItems,
            summary.averagePerTransaction,
        ]];

        const monthStr = String(month + 1).padStart(2, '0');
        downloadCSV(headers, rows, `ringkasan_${year}${monthStr}.csv`);
    }

    function downloadCSV(headers, rows, filename) {
        // BOM for UTF-8 Excel compatibility
        let csv = '\uFEFF';
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => {
                const str = String(cell);
                // Escape quotes & wrap if contains comma/newline
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            }).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ===================== CSV IMPORT =====================

    function importProductsCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(l => l.trim());
                    if (lines.length < 2) {
                        reject('File CSV kosong atau tidak valid');
                        return;
                    }

                    const products = getProducts();
                    let imported = 0;
                    let updated = 0;

                    // Skip header
                    for (let i = 1; i < lines.length; i++) {
                        const cols = _parseCSVLine(lines[i]);
                        if (cols.length < 4) continue;

                        const id = cols[0]?.trim() || '';
                        const name = cols[1]?.trim() || '';
                        const category = cols[2]?.trim() || 'Lainnya';
                        const price = parseInt(cols[3]) || 0;
                        const stock = parseInt(cols[4]) || 0;
                        const createdAt = cols[5]?.trim() || new Date().toISOString().split('T')[0];

                        if (!name) continue;

                        const existingIndex = products.findIndex(p => p.id === id);
                        if (existingIndex !== -1) {
                            products[existingIndex] = { ...products[existingIndex], name, category, price, stock };
                            updated++;
                        } else {
                            products.push({
                                id: id || _generateProductIdStatic(products.length + imported),
                                name, category, price, stock, createdAt,
                            });
                            imported++;
                        }
                    }

                    _set(KEYS.PRODUCTS, products);
                    resolve({ imported, updated });
                } catch (err) {
                    reject('Gagal membaca file CSV: ' + err.message);
                }
            };
            reader.onerror = () => reject('Gagal membaca file');
            reader.readAsText(file);
        });
    }

    function _generateProductIdStatic(num) {
        return 'PRD' + String(num).padStart(3, '0');
    }

    function _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current.trim());
        return result;
    }

    // ===================== UTILITY =====================

    function _getDateStamp() {
        const now = new Date();
        return now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
    }

    function initData() {
        // Initialize with empty arrays if not exist
        if (!localStorage.getItem(KEYS.PRODUCTS)) {
            _set(KEYS.PRODUCTS, []);
        }
        if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
            _set(KEYS.TRANSACTIONS, []);
        }
        if (!localStorage.getItem(KEYS.SETTINGS)) {
            _set(KEYS.SETTINGS, {
                storeName: 'Toko KasirKu',
                storeAddress: 'Jl. Contoh No. 123',
                storePhone: '0812-3456-7890',
                lowStockThreshold: 5,
            });
        }
    }

    function getSettings() {
        const raw = localStorage.getItem(KEYS.SETTINGS);
        return raw ? JSON.parse(raw) : {
            storeName: 'Toko KasirKu',
            storeAddress: 'Jl. Contoh No. 123',
            storePhone: '0812-3456-7890',
            lowStockThreshold: 5,
        };
    }

    function updateSettings(settings) {
        _set(KEYS.SETTINGS, settings);
    }

    function clearAllData() {
        localStorage.removeItem(KEYS.PRODUCTS);
        localStorage.removeItem(KEYS.TRANSACTIONS);
        initData();
    }

    function seedDummyData() {
        const products = getProducts();
        if (products.length > 0) return; // Already has data

        const dummyProducts = [
            { name: 'Nasi Goreng Spesial', category: 'Makanan', price: 18000, stock: 50 },
            { name: 'Nasi Ayam Bakar', category: 'Makanan', price: 22000, stock: 35 },
            { name: 'Mie Goreng', category: 'Makanan', price: 15000, stock: 40 },
            { name: 'Sate Ayam (10 tusuk)', category: 'Makanan', price: 25000, stock: 25 },
            { name: 'Gado-Gado', category: 'Makanan', price: 15000, stock: 30 },
            { name: 'Bakso Mangkok', category: 'Makanan', price: 12000, stock: 45 },
            { name: 'Soto Ayam', category: 'Makanan', price: 14000, stock: 35 },
            { name: 'Ayam Geprek', category: 'Makanan', price: 16000, stock: 30 },
            { name: 'Es Teh Manis', category: 'Minuman', price: 5000, stock: 100 },
            { name: 'Es Jeruk', category: 'Minuman', price: 6000, stock: 80 },
            { name: 'Kopi Susu', category: 'Minuman', price: 8000, stock: 60 },
            { name: 'Jus Alpukat', category: 'Minuman', price: 12000, stock: 40 },
            { name: 'Jus Mangga', category: 'Minuman', price: 10000, stock: 35 },
            { name: 'Air Mineral', category: 'Minuman', price: 4000, stock: 200 },
            { name: 'Teh Hangat', category: 'Minuman', price: 4000, stock: 90 },
            { name: 'Kerupuk', category: 'Lainnya', price: 3000, stock: 150 },
            { name: 'Tissue', category: 'Lainnya', price: 2000, stock: 200 },
            { name: 'Bungkus Take Away', category: 'Lainnya', price: 1000, stock: 300 },
        ];

        dummyProducts.forEach(p => addProduct(p));
    }

    return {
        initData,
        // Products
        getProducts,
        getProductById,
        addProduct,
        updateProduct,
        deleteProduct,
        updateStock,
        restoreStock,
        getLowStockProducts,
        getCategories,
        // Transactions
        getTransactions,
        addTransaction,
        deleteTransaction,
        getTransactionsByMonth,
        getTransactionsByDate,
        getMonthlySummary,
        // CSV
        exportProductsCSV,
        exportTransactionsCSV,
        exportSummaryCSV,
        importProductsCSV,
        // Settings & Utils
        getSettings,
        updateSettings,
        clearAllData,
        seedDummyData,
    };
})();
