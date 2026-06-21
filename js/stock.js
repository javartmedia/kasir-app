/**
 * stock.js — Manajemen Stok Logic
 * Kartu stok: stok masuk, keluar, penyesuaian, riwayat pergerakan
 */

const Stock = (() => {
    let currentAction = 'in'; // 'in' | 'out' | 'adjust'

    const REASONS = {
        in: ['Pembelian Baru', 'Retur dari Customer', 'Hasil Produksi', 'Stok Opname'],
        out: ['Rusak/Expired', 'Hilang', 'Sample/Giveaway', 'Pemakaian Internal', 'Retur ke Supplier'],
        adjust: ['Stok Opname', 'Koreksi Data', 'Selisih Hitung'],
    };

    // ===================== INIT =====================

    function init() {
        renderStockTable();
        renderHistoryTable();
        renderStats();
        bindEvents();
    }

    function bindEvents() {
        // Action buttons
        document.getElementById('btn-stock-in').addEventListener('click', () => openForm('in'));
        document.getElementById('btn-stock-out').addEventListener('click', () => openForm('out'));
        document.getElementById('btn-adjust').addEventListener('click', () => openForm('adjust'));

        // Export
        document.getElementById('btn-export-stock').addEventListener('click', () => {
            Storage.exportStockMovementsCSV();
            App.showToast('Kartu stok berhasil di-export!', 'success');
        });

        // Form submit
        document.getElementById('stock-form').addEventListener('submit', handleFormSubmit);

        // Product change in form (update hint)
        document.getElementById('form-product').addEventListener('change', updateQtyHint);

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Search current stock
        document.getElementById('search-stock').addEventListener('input', renderStockTable);
        document.getElementById('filter-stock-status').addEventListener('change', renderStockTable);

        // Search history
        document.getElementById('search-history').addEventListener('input', renderHistoryTable);
        document.getElementById('filter-movement-type').addEventListener('change', renderHistoryTable);
    }

    function switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
        document.getElementById('tab-' + tabName).classList.add('active');
    }

    // ===================== STATS =====================

    function renderStats() {
        const products = Storage.getProducts();
        const movements = Storage.getStockMovements();
        const totalStock = products.reduce((s, p) => s + p.stock, 0);
        const stockValue = products.reduce((s, p) => s + (p.stock * p.price), 0);
        const modalValue = products.reduce((s, p) => s + (p.stock * (p.purchase_price || 0)), 0);
        const lowStock = Storage.getLowStockProducts().length;
        const outOfStock = products.filter(p => p.stock === 0).length;

        document.getElementById('stat-total-stock').textContent = totalStock;
        document.getElementById('stat-stock-value').textContent = App.formatCurrency(stockValue);
        document.getElementById('stat-modal-value').textContent = App.formatCurrency(modalValue);
        document.getElementById('stat-low-stock').textContent = lowStock;
        document.getElementById('stat-out-of-stock').textContent = outOfStock;
        document.getElementById('stat-movements').textContent = movements.length;
    }

    // ===================== STOCK TABLE =====================

    function renderStockTable() {
        const searchTerm = document.getElementById('search-stock').value.toLowerCase();
        const statusFilter = document.getElementById('filter-stock-status').value;

        let products = Storage.getProducts();

        if (searchTerm) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.id.toLowerCase().includes(searchTerm)
            );
        }

        if (statusFilter === 'available') {
            products = products.filter(p => p.stock > 5);
        } else if (statusFilter === 'low') {
            products = products.filter(p => p.stock > 0 && p.stock <= 5);
        } else if (statusFilter === 'empty') {
            products = products.filter(p => p.stock === 0);
        }

        const tbody = document.getElementById('stock-tbody');

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Tidak ada produk</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => {
            const emoji = App.getCategoryEmoji(p.category);
            const pp = p.purchase_price || 0;
            let statusBadge, statusClass;
            if (p.stock === 0) {
                statusBadge = '❌ Habis';
                statusClass = 'stock-empty';
            } else if (p.stock <= 5) {
                statusBadge = '⚠️ Rendah';
                statusClass = 'stock-low';
            } else {
                statusBadge = '✅ Tersedia';
                statusClass = 'stock-ok';
            }

            return `
                <tr>
                    <td><code>${p.id}</code></td>
                    <td>
                        <div class="product-cell">
                            <span class="product-cell-emoji">${emoji}</span>
                            <span class="product-cell-name">${p.name}</span>
                        </div>
                    </td>
                    <td>${p.category}</td>
                    <td class="text-right">${App.formatCurrency(pp)}</td>
                    <td class="text-center"><strong style="font-size:1.1rem">${p.stock}</strong></td>
                    <td class="text-center"><span class="stock-badge ${statusClass}">${statusBadge}</span></td>
                    <td class="text-right">${App.formatCurrency(p.stock * pp)}</td>
                    <td class="text-right">${App.formatCurrency(p.stock * p.price)}</td>
                    <td class="text-center">
                        <div class="action-buttons">
                            <button class="btn-icon" title="Stok Masuk" onclick="Stock.quickAdjust('${p.id}','in')">📥</button>
                            <button class="btn-icon" title="Stok Keluar" onclick="Stock.quickAdjust('${p.id}','out')">📤</button>
                            <button class="btn-icon" title="Penyesuaian" onclick="Stock.quickAdjust('${p.id}','adjust')">⚖️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ===================== HISTORY TABLE =====================

    function renderHistoryTable() {
        const searchTerm = document.getElementById('search-history').value.toLowerCase();
        const typeFilter = document.getElementById('filter-movement-type').value;

        let movements = Storage.getStockMovements()
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (searchTerm) {
            movements = movements.filter(m =>
                m.productName.toLowerCase().includes(searchTerm) ||
                m.productId.toLowerCase().includes(searchTerm) ||
                (m.reason && m.reason.toLowerCase().includes(searchTerm))
            );
        }

        if (typeFilter) {
            movements = movements.filter(m => m.type === typeFilter);
        }

        const tbody = document.getElementById('history-tbody');

        if (movements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada riwayat pergerakan stok</td></tr>';
            return;
        }

        const typeLabels = {
            in: '<span class="badge" style="background:#e8f5e9;color:#00a843">📥 Masuk</span>',
            out: '<span class="badge" style="background:#ffebee;color:#e53935">📤 Keluar</span>',
            adjust: '<span class="badge" style="background:#fff3e0;color:#ff9800">⚖️ Penyesuaian</span>',
        };

        tbody.innerHTML = movements.map(m => {
            const sign = m.type === 'in' ? '+' : m.type === 'out' ? '-' : '±';
            const qtyColor = m.type === 'in' ? '#00a843' : m.type === 'out' ? '#e53935' : '#ff9800';
            return `
                <tr>
                    <td class="text-sm">${App.formatDateTime(m.date)}</td>
                    <td>
                        <div class="product-cell">
                            <span class="product-cell-name">${m.productName}</span>
                            <small class="text-muted">${m.productId}</small>
                        </div>
                    </td>
                    <td>${typeLabels[m.type] || m.type}</td>
                    <td>${m.reason || '-'}</td>
                    <td class="text-center" style="color:${qtyColor};font-weight:700">${sign} ${m.qty}</td>
                    <td class="text-center">${m.stockBefore !== undefined ? m.stockBefore : '-'}</td>
                    <td class="text-center"><strong>${m.stockAfter !== undefined ? m.stockAfter : '-'}</strong></td>
                    <td class="text-sm">${m.note || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    // ===================== FORM =====================

    function openForm(action) {
        currentAction = action;

        const titles = { in: '📥 Stok Masuk', out: '📤 Stok Keluar', adjust: '⚖️ Penyesuaian Stok' };
        const qtyLabels = {
            in: 'Jumlah Masuk *',
            out: 'Jumlah Keluar *',
            adjust: 'Stok Baru (Target) *',
        };
        const qtyHints = {
            in: 'Berapa banyak stok yang masuk',
            out: 'Berapa banyak stok yang keluar',
            adjust: 'Atur stok menjadi nilai ini (stok opname)',
        };

        document.getElementById('modal-title').textContent = titles[action];
        document.getElementById('qty-label').textContent = qtyLabels[action];
        document.getElementById('qty-hint').textContent = qtyHints[action];

        // Populate products
        const productSelect = document.getElementById('form-product');
        const products = Storage.getProducts();
        productSelect.innerHTML = '<option value="">Pilih Produk</option>' +
            products.map(p => `<option value="${p.id}">${p.emoji || ''} ${p.name} (Stok: ${p.stock})</option>`).join('');

        // Populate reasons
        const reasonSelect = document.getElementById('form-reason');
        reasonSelect.innerHTML = '<option value="">— Pilih Alasan —</option>' +
            (REASONS[action] || []).map(r => `<option value="${r}">${r}</option>`).join('');

        // Reset form
        document.getElementById('stock-form').reset();
        document.getElementById('form-reason-custom').value = '';

        App.openModal('stock-modal');
    }

    function quickAdjust(productId, action) {
        openForm(action);
        document.getElementById('form-product').value = productId;
        updateQtyHint();
    }

    function updateQtyHint() {
        const productId = document.getElementById('form-product').value;
        const product = Storage.getProductById(productId);
        const hint = document.getElementById('qty-hint');
        if (product) {
            if (currentAction === 'adjust') {
                hint.textContent = 'Stok saat ini: ' + product.stock + ' — masukkan nilai stok baru';
            } else {
                hint.textContent = 'Stok saat ini: ' + product.stock;
            }
        } else {
            const baseHints = {
                in: 'Berapa banyak stok yang masuk',
                out: 'Berapa banyak stok yang keluar',
                adjust: 'Atur stok menjadi nilai ini (stok opname)',
            };
            hint.textContent = baseHints[currentAction];
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        const productId = document.getElementById('form-product').value;
        let reason = document.getElementById('form-reason').value;
        const customReason = document.getElementById('form-reason-custom').value.trim();
        const qty = document.getElementById('form-qty').value;
        const note = document.getElementById('form-note').value.trim();

        if (customReason) reason = customReason;

        if (!productId) {
            App.showToast('Pilih produk dulu!', 'error');
            return;
        }

        if (!qty || qty <= 0) {
            App.showToast('Jumlah harus lebih dari 0!', 'error');
            return;
        }

        const result = Storage.adjustStock(productId, currentAction, qty, reason, note);

        if (!result.success) {
            App.showToast(result.message, 'error');
            return;
        }

        const successMsgs = {
            in: 'Stok masuk berhasil ditambahkan!',
            out: 'Stok keluar berhasil dicatat!',
            adjust: 'Stok berhasil disesuaikan!',
        };
        App.showToast(successMsgs[currentAction], 'success');

        App.closeModal('stock-modal');
        renderStockTable();
        renderHistoryTable();
        renderStats();
    }

    return {
        init: init,
        quickAdjust: quickAdjust,
    };
})();

document.addEventListener('DOMContentLoaded', Stock.init);
