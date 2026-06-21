/**
 * storage.js - Modul Penyimpanan Data
 * Mengelola data produk, transaksi & kartu stok via localStorage
 * Mendukung export/import CSV
 */

const Storage = (() => {
    const KEYS = {
        PRODUCTS: 'kasir_products',
        TRANSACTIONS: 'kasir_transactions',
        STOCK_MOVEMENTS: 'kasir_stock_movements',
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
        return prefix + '-' + datePart + '-' + seq;
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

        if (product.stock > 0) {
            addStockMovement({
                productId: product.id,
                productName: product.name,
                type: 'in',
                reason: 'Stok Awal',
                qty: product.stock,
                note: 'Produk baru ditambahkan',
                stockBefore: 0,
                stockAfter: product.stock,
            });
        }
        return product;
    }

    function updateProduct(id, updates) {
        const products = getProducts();
        const index = products.findIndex(p => p.id === id);
        if (index === -1) return null;
        products[index] = Object.assign({}, products[index], updates);
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

    function getLowStockProducts(threshold) {
        threshold = threshold || 5;
        return getProducts().filter(p => p.stock <= threshold);
    }

    function getCategories() {
        const products = getProducts();
        return [...new Set(products.map(p => p.category))].sort();
    }

    // ===================== STOCK MOVEMENTS (Kartu Stok) =====================

    function getStockMovements() {
        return _get(KEYS.STOCK_MOVEMENTS);
    }

    function addStockMovement(movement) {
        const movements = getStockMovements();
        movement.id = 'STK' + Date.now() + Math.floor(Math.random() * 1000);
        movement.date = new Date().toISOString();
        movements.push(movement);
        _set(KEYS.STOCK_MOVEMENTS, movements);
        return movement;
    }

    function getStockMovementsByProduct(productId) {
        return getStockMovements()
            .filter(m => m.productId === productId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    function deleteStockMovement(id) {
        const movements = getStockMovements();
        const filtered = movements.filter(m => m.id !== id);
        if (filtered.length === movements.length) return false;
        _set(KEYS.STOCK_MOVEMENTS, filtered);
        return true;
    }

    function adjustStock(productId, type, qty, reason, note) {
        note = note || '';
        const product = getProductById(productId);
        if (!product) return { success: false, message: 'Produk tidak ditemukan' };

        qty = parseInt(qty);
        if (isNaN(qty) || qty < 0) return { success: false, message: 'Jumlah tidak valid' };

        let newStock = product.stock;
        let movementQty = qty;
        const stockBefore = product.stock;

        if (type === 'in') {
            newStock = product.stock + qty;
        } else if (type === 'out') {
            if (qty > product.stock) {
                return { success: false, message: 'Stok tidak cukup. Tersedia: ' + product.stock };
            }
            newStock = product.stock - qty;
        } else if (type === 'adjust') {
            movementQty = qty - product.stock;
            newStock = qty;
        } else {
            return { success: false, message: 'Tipe tidak valid' };
        }

        updateProduct(productId, { stock: newStock });
        addStockMovement({
            productId: productId,
            productName: product.name,
            type: type,
            reason: reason || (type === 'in' ? 'Stok Masuk' : type === 'out' ? 'Stok Keluar' : 'Penyesuaian'),
            qty: Math.abs(movementQty),
            note: note,
            stockBefore: stockBefore,
            stockAfter: newStock,
        });

        return { success: true, newStock: newStock };
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

        transaction.items.forEach(item => {
            const product = getProductById(item.productId);
            if (product) {
                addStockMovement({
                    productId: item.productId,
                    productName: item.name,
                    type: 'out',
                    reason: 'Penjualan',
                    qty: item.qty,
                    note: 'Transaksi ' + transaction.id,
                    stockBefore: product.stock + item.qty,
                    stockAfter: product.stock,
                });
            }
        });

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
        return getTransactions().filter(t => t.date.startsWith(dateStr));
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
            .map(([name, data]) => Object.assign({ name: name }, data))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return {
            totalTransactions: transactions.length,
            totalRevenue: totalRevenue,
            totalDiscount: totalDiscount,
            totalItems: totalItems,
            averagePerTransaction: transactions.length > 0
                ? Math.round(totalRevenue / transactions.length) : 0,
            dailySales: dailySales,
            productSales: productSales,
            topProducts: topProducts,
            transactions: transactions,
        };
    }

    // ===================== CSV EXPORT =====================

    function exportProductsCSV() {
        const products = getProducts();
        if (products.length === 0) return;

        const headers = ['ID', 'Nama Produk', 'Kategori', 'Harga', 'Stok', 'Tanggal Dibuat'];
        const rows = products.map(p => [p.id, p.name, p.category, p.price, p.stock, p.createdAt]);

        downloadCSV(headers, rows, 'produk_' + _getDateStamp() + '.csv');
    }

    function exportTransactionsCSV(year, month) {
        const summary = getMonthlySummary(year, month);
        if (summary.transactions.length === 0) return;

        const headers = ['No Transaksi', 'Tanggal', 'Item', 'Subtotal', 'Diskon', 'Total', 'Metode Bayar', 'Dibayar', 'Kembalian'];
        const rows = summary.transactions.map(t => [
            t.id,
            new Date(t.date).toLocaleString('id-ID'),
            t.items.map(i => i.name + ' x' + i.qty).join('; '),
            t.subtotal,
            t.totalDiscount || 0,
            t.total,
            t.paymentMethod,
            t.amountPaid,
            t.change,
        ]);

        const monthStr = String(month + 1).padStart(2, '0');
        downloadCSV(headers, rows, 'laporan_' + year + monthStr + '.csv');
    }

    function exportSummaryCSV(year, month) {
        const summary = getMonthlySummary(year, month);

        const headers = ['Periode', 'Total Transaksi', 'Total Omzet', 'Total Diskon', 'Total Item', 'Rata-rata/Transaksi'];
        const rows = [[
            year + '-' + String(month + 1).padStart(2, '0'),
            summary.totalTransactions,
            summary.totalRevenue,
            summary.totalDiscount,
            summary.totalItems,
            summary.averagePerTransaction,
        ]];

        const monthStr = String(month + 1).padStart(2, '0');
        downloadCSV(headers, rows, 'ringkasan_' + year + monthStr + '.csv');
    }

    function exportStockMovementsCSV() {
        const movements = getStockMovements();
        if (movements.length === 0) return;

        const headers = ['Tanggal', 'ID Produk', 'Nama Produk', 'Tipe', 'Alasan', 'Jumlah', 'Stok Sebelum', 'Stok Sesudah', 'Catatan'];
        const rows = movements.map(m => [
            new Date(m.date).toLocaleString('id-ID'),
            m.productId,
            m.productName,
            m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian',
            m.reason,
            m.qty,
            m.stockBefore !== undefined ? m.stockBefore : '',
            m.stockAfter !== undefined ? m.stockAfter : '',
            m.note || '',
        ]);

        downloadCSV(headers, rows, 'kartu_stok_' + _getDateStamp() + '.csv');
    }

    function downloadCSV(headers, rows, filename) {
        let csv = '\uFEFF';
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => {
                const str = String(cell);
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

                    for (let i = 1; i < lines.length; i++) {
                        const cols = _parseCSVLine(lines[i]);
                        if (cols.length < 4) continue;

                        const id = cols[0] ? cols[0].trim() : '';
                        const name = cols[1] ? cols[1].trim() : '';
                        const category = cols[2] ? cols[2].trim() : 'Lainnya';
                        const price = parseInt(cols[3]) || 0;
                        const stock = parseInt(cols[4]) || 0;
                        const createdAt = cols[5] ? cols[5].trim() : new Date().toISOString().split('T')[0];

                        if (!name) continue;

                        const existingIndex = products.findIndex(p => p.id === id);
                        if (existingIndex !== -1) {
                            products[existingIndex] = Object.assign({}, products[existingIndex], { name, category, price, stock });
                            updated++;
                        } else {
                            products.push({
                                id: id || _generateProductIdStatic(products.length + imported),
                                name: name, category: category, price: price, stock: stock, createdAt: createdAt,
                            });
                            imported++;
                        }
                    }

                    _set(KEYS.PRODUCTS, products);
                    resolve({ imported: imported, updated: updated });
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
        if (!localStorage.getItem(KEYS.PRODUCTS)) {
            _set(KEYS.PRODUCTS, []);
        }
        if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
            _set(KEYS.TRANSACTIONS, []);
        }
        if (!localStorage.getItem(KEYS.STOCK_MOVEMENTS)) {
            _set(KEYS.STOCK_MOVEMENTS, []);
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
        localStorage.removeItem(KEYS.STOCK_MOVEMENTS);
        initData();
    }

    function seedDummyData() {
        const products = getProducts();
        if (products.length > 0) return;

        const dummyProducts = [
            { name: 'Beras Premium 5kg', category: 'Sembako', price: 65000, stock: 50 },
            { name: 'Gula Pasir 1kg', category: 'Sembako', price: 14000, stock: 80 },
            { name: 'Minyak Goreng 1L', category: 'Sembako', price: 18000, stock: 60 },
            { name: 'Telur Ayam 1kg', category: 'Sembako', price: 28000, stock: 40 },
            { name: 'Tepung Terigu 1kg', category: 'Sembako', price: 12000, stock: 45 },
            { name: 'Garam Halus 500g', category: 'Sembako', price: 5000, stock: 70 },
            { name: 'Kecap Manis 600ml', category: 'Sembako', price: 15000, stock: 55 },
            { name: 'Sabun Mandi', category: 'Sembako', price: 8000, stock: 90 },
            { name: 'Air Mineral 600ml', category: 'Minuman', price: 3000, stock: 200 },
            { name: 'Teh Botol 500ml', category: 'Minuman', price: 5000, stock: 100 },
            { name: 'Kopi Sachet', category: 'Minuman', price: 2000, stock: 150 },
            { name: 'Susu Kental Manis', category: 'Minuman', price: 10000, stock: 70 },
            { name: 'Minuman Ringan 250ml', category: 'Minuman', price: 6000, stock: 85 },
            { name: 'Jus Kemasan 250ml', category: 'Minuman', price: 7000, stock: 60 },
            { name: 'Susu UHT 1L', category: 'Minuman', price: 16000, stock: 40 },
            { name: 'Mie Instan', category: 'Lainnya', price: 3500, stock: 200 },
            { name: 'Biskuit 200g', category: 'Lainnya', price: 10000, stock: 75 },
            { name: 'Korek Api', category: 'Lainnya', price: 2000, stock: 100 },
        ];

        dummyProducts.forEach(p => addProduct(p));
    }

    return {
        initData: initData,
        getProducts: getProducts,
        getProductById: getProductById,
        addProduct: addProduct,
        updateProduct: updateProduct,
        deleteProduct: deleteProduct,
        updateStock: updateStock,
        restoreStock: restoreStock,
        getLowStockProducts: getLowStockProducts,
        getCategories: getCategories,
        getStockMovements: getStockMovements,
        getStockMovementsByProduct: getStockMovementsByProduct,
        addStockMovement: addStockMovement,
        deleteStockMovement: deleteStockMovement,
        adjustStock: adjustStock,
        exportStockMovementsCSV: exportStockMovementsCSV,
        getTransactions: getTransactions,
        addTransaction: addTransaction,
        deleteTransaction: deleteTransaction,
        getTransactionsByMonth: getTransactionsByMonth,
        getTransactionsByDate: getTransactionsByDate,
        getMonthlySummary: getMonthlySummary,
        exportProductsCSV: exportProductsCSV,
        exportTransactionsCSV: exportTransactionsCSV,
        exportSummaryCSV: exportSummaryCSV,
        importProductsCSV: importProductsCSV,
        getSettings: getSettings,
        updateSettings: updateSettings,
        clearAllData: clearAllData,
        seedDummyData: seedDummyData,
    };
})();
