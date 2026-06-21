/**
 * pos.js — Point of Sale Logic
 * Mengelola transaksi kasir: keranjang, diskon, pembayaran, struk
 */

const POS = (() => {
    let cart = []; // { productId, name, price, qty, discount, subtotal }

    // ===================== INITIALIZATION =====================

    function init() {
        renderProducts();
        renderCategoryFilter();
        bindEvents();
        checkLowStock();
    }

    function checkLowStock() {
        const lowStock = Storage.getLowStockProducts();
        const badge = document.getElementById('low-stock-alert');
        const count = document.getElementById('low-stock-count');
        if (lowStock.length > 0 && badge && count) {
            badge.style.display = 'block';
            count.textContent = lowStock.length;
        }
    }

    // ===================== PRODUCT RENDERING =====================

    function renderProducts(searchTerm = '', category = '') {
        const products = Storage.getProducts();
        const grid = document.getElementById('product-grid');
        const emptyState = document.getElementById('empty-products');

        let filtered = products;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.id.toLowerCase().includes(term)
            );
        }

        if (category) {
            filtered = filtered.filter(p => p.category === category);
        }

        if (filtered.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        grid.innerHTML = filtered.map(p => {
            const color = App.getCategoryColor(p.category);
            const emoji = App.getCategoryEmoji(p.category);
            const isLowStock = p.stock <= 5;
            const isOutOfStock = p.stock === 0;

            return `
                <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''} ${isLowStock ? 'low-stock' : ''}"
                     data-id="${p.id}" onclick="POS.addToCart('${p.id}')">
                    <div class="product-card-header" style="background: ${color}20">
                        <span class="product-emoji">${emoji}</span>
                        <span class="product-badge" style="background: ${color}">${p.category}</span>
                    </div>
                    <div class="product-card-body">
                        <h4 class="product-name">${p.name}</h4>
                        <p class="product-price">${App.formatCurrency(p.price)}</p>
                    </div>
                    <div class="product-card-footer">
                        <span class="product-stock ${isLowStock ? 'stock-warning' : ''}">
                            ${isOutOfStock ? '❌ Habis' : '📦 Stok: ' + p.stock}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderCategoryFilter() {
        const select = document.getElementById('filter-category');
        const categories = Storage.getCategories();

        select.innerHTML = '<option value="">Semua Kategori</option>';
        categories.forEach(cat => {
            const emoji = App.getCategoryEmoji(cat);
            select.innerHTML += `<option value="${cat}">${emoji} ${cat}</option>`;
        });
    }

    // ===================== EVENT BINDINGS =====================

    function bindEvents() {
        // Search
        const searchInput = document.getElementById('search-product');
        searchInput.addEventListener('input', () => {
            const term = searchInput.value;
            const category = document.getElementById('filter-category').value;
            renderProducts(term, category);
        });

        // Category filter
        document.getElementById('filter-category').addEventListener('change', () => {
            const term = searchInput.value;
            const category = document.getElementById('filter-category').value;
            renderProducts(term, category);
        });

        // New transaction
        document.getElementById('btn-new-transaction').addEventListener('click', resetCart);

        // Cart count click — review popup
        document.getElementById('cart-count').addEventListener('click', () => {
            if (cart.length > 0) showReviewModal();
        });

        // Discount toggle
        document.getElementById('btn-toggle-discount').addEventListener('click', () => {
            const input = document.getElementById('discount-amount');
            const isVisible = input.style.display !== 'none';
            input.style.display = isVisible ? 'none' : 'inline-block';
            if (!isVisible) input.focus();
        });

        // Discount input
        document.getElementById('discount-amount').addEventListener('input', () => {
            updateCartTotals();
        });

        // Payment methods
        document.querySelectorAll('input[name="payment"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const isCash = radio.value === 'tunai';
                document.getElementById('cash-payment').style.display = isCash ? 'block' : 'none';
                document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('active'));
                radio.closest('.payment-option').classList.add('active');
                updateCheckoutButton();
            });
        });

        // Amount paid
        document.getElementById('amount-paid').addEventListener('input', () => {
            calculateChange();
            updateCheckoutButton();
        });

        // Quick amounts
        document.querySelectorAll('.btn-quick-amount').forEach(btn => {
            btn.addEventListener('click', () => {
                const total = getTotalAfterDiscount();
                const amount = btn.dataset.amount;
                const input = document.getElementById('amount-paid');

                if (amount === 'exact') {
                    input.value = total;
                } else {
                    input.value = parseInt(amount);
                }
                calculateChange();
                updateCheckoutButton();
            });
        });

        // Checkout
        document.getElementById('btn-checkout').addEventListener('click', processCheckout);

        // Print receipt
        document.getElementById('btn-print-receipt').addEventListener('click', () => {
            App.triggerPrint('receipt-content');
        });

        // Close receipt modal
        document.getElementById('btn-close-receipt').addEventListener('click', () => {
            App.closeModal('payment-modal');
            resetCart();
        });
    }

    // ===================== CART MANAGEMENT =====================

    function addToCart(productId) {
        const product = Storage.getProductById(productId);
        if (!product) return;

        if (product.stock <= 0) {
            App.showToast('Stok produk habis!', 'error');
            return;
        }

        const existing = cart.find(item => item.productId === productId);
        const currentQty = existing ? existing.qty : 0;

        if (currentQty >= product.stock) {
            App.showToast(`Stok ${product.name} hanya tersisa ${product.stock}!`, 'warning');
            return;
        }

        if (existing) {
            existing.qty++;
            existing.subtotal = existing.qty * existing.price - existing.discount;
        } else {
            cart.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                purchasePrice: product.purchase_price || 0,
                qty: 1,
                discount: 0,
                subtotal: product.price,
            });
        }

        renderCart();
        App.showToast(`${product.name} ditambahkan`, 'success');
    }

    function removeFromCart(index) {
        const item = cart[index];
        if (!item) return;
        cart.splice(index, 1);
        renderCart();
    }

    function updateCartQty(index, newQty) {
        const item = cart[index];
        if (!item) return;

        const product = Storage.getProductById(item.productId);
        newQty = parseInt(newQty);

        if (isNaN(newQty) || newQty < 1) {
            removeFromCart(index);
            return;
        }

        if (product && newQty > product.stock) {
            App.showToast(`Stok hanya tersisa ${product.stock}!`, 'warning');
            newQty = product.stock;
        }

        item.qty = newQty;
        item.subtotal = item.qty * item.price - item.discount;
        renderCart();
    }

    function updateItemDiscount(index, discount) {
        const item = cart[index];
        if (!item) return;

        discount = parseInt(discount) || 0;
        const maxDiscount = item.qty * item.price;
        if (discount > maxDiscount) discount = maxDiscount;
        if (discount < 0) discount = 0;

        item.discount = discount;
        item.subtotal = item.qty * item.price - item.discount;
        renderCart();
    }

    function resetCart() {
        cart = [];
        document.getElementById('discount-amount').value = 0;
        document.getElementById('discount-amount').style.display = 'none';
        document.getElementById('amount-paid').value = '';
        document.getElementById('change-display').style.display = 'none';
        renderCart();
    }

    // ===================== CART RENDERING =====================

    function renderCart() {
        const container = document.getElementById('cart-items');
        const emptyCart = document.getElementById('empty-cart');
        const summary = document.getElementById('cart-summary');
        const paymentSection = document.getElementById('payment-section');
        const cartCount = document.getElementById('cart-count');

        if (cart.length === 0) {
            container.innerHTML = `
                <div id="empty-cart" class="empty-cart">
                    <span>🛒</span>
                    <p>Keranjang kosong</p>
                    <small>Klik produk untuk menambahkan</small>
                </div>`;
            summary.style.display = 'none';
            paymentSection.style.display = 'none';
            cartCount.textContent = '0 item';
            return;
        }

        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
        cartCount.textContent = `${totalItems} item`;

        container.innerHTML = cart.map((item, i) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">${App.formatCurrency(item.price)}</span>
                </div>
                <div class="cart-item-actions">
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="POS.updateCartQty(${i}, ${item.qty - 1})">−</button>
                        <input type="number" value="${item.qty}" min="1" 
                               onchange="POS.updateCartQty(${i}, this.value)"
                               onclick="this.select()">
                        <button class="qty-btn" onclick="POS.updateCartQty(${i}, ${item.qty + 1})">+</button>
                    </div>
                    <div class="cart-item-disc">
                        <input type="number" value="${item.discount}" min="0" placeholder="Disc Rp"
                               onchange="POS.updateItemDiscount(${i}, this.value)"
                               title="Diskon per item (Rp)" style="width:80px;">
                    </div>
                    <div class="cart-item-subtotal">${App.formatCurrency(item.subtotal)}</div>
                    <button class="btn-remove" onclick="POS.removeFromCart(${i})" title="Hapus">🗑️</button>
                </div>
            </div>
        `).join('');

        updateCartTotals();

        summary.style.display = 'block';
        paymentSection.style.display = 'block';
    }

    function updateCartTotals() {
        const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
        const itemDiscounts = cart.reduce((sum, item) => sum + item.discount, 0);
        const globalDiscount = parseInt(document.getElementById('discount-amount').value) || 0;
        const totalDiscount = itemDiscounts + globalDiscount;
        const total = Math.max(0, subtotal - totalDiscount);

        document.getElementById('cart-subtotal').textContent = App.formatCurrency(subtotal);
        document.getElementById('cart-discount').textContent = '- ' + App.formatCurrency(totalDiscount);
        document.getElementById('cart-total').textContent = App.formatCurrency(total);

        calculateChange();
        updateCheckoutButton();
    }

    function getTotalAfterDiscount() {
        const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
        const itemDiscounts = cart.reduce((sum, item) => sum + item.discount, 0);
        const globalDiscount = parseInt(document.getElementById('discount-amount').value) || 0;
        return Math.max(0, subtotal - itemDiscounts - globalDiscount);
    }

    // ===================== PAYMENT =====================

    function calculateChange() {
        const total = getTotalAfterDiscount();
        const paid = parseInt(document.getElementById('amount-paid').value) || 0;
        const changeDisplay = document.getElementById('change-display');
        const changeAmount = document.getElementById('change-amount');

        if (paid > 0) {
            changeDisplay.style.display = 'flex';
            const change = paid - total;
            changeAmount.textContent = App.formatCurrency(Math.max(0, change));
            changeAmount.className = 'change-amount' + (change < 0 ? ' insufficient' : '');
        } else {
            changeDisplay.style.display = 'none';
        }
    }

    function updateCheckoutButton() {
        const btn = document.getElementById('btn-checkout');
        const total = getTotalAfterDiscount();
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;

        if (cart.length === 0 || total <= 0) {
            btn.disabled = true;
            return;
        }

        if (paymentMethod === 'tunai') {
            const paid = parseInt(document.getElementById('amount-paid').value) || 0;
            btn.disabled = paid < total;
        } else {
            btn.disabled = false;
        }
    }

    function processCheckout() {
        if (cart.length === 0) return;

        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'tunai';
        const total = getTotalAfterDiscount();
        let amountPaid = total;

        if (paymentMethod === 'tunai') {
            amountPaid = parseInt(document.getElementById('amount-paid').value) || 0;
            if (amountPaid < total) {
                App.showToast('Uang bayar kurang!', 'error');
                return;
            }
        }

        const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
        const totalDiscount = subtotal - total;

        // Build transaction object
        const transaction = {
            items: cart.map(item => ({
                productId: item.productId,
                name: item.name,
                qty: item.qty,
                price: item.price,
                purchase_price: item.purchasePrice || 0,
                discount: item.discount,
                subtotal: item.subtotal,
            })),
            subtotal,
            totalDiscount,
            total,
            paymentMethod,
            amountPaid,
            change: Math.max(0, amountPaid - total),
        };

        // Save transaction & update stock
        const saved = Storage.addTransaction(transaction);

        // Update stock for each item
        cart.forEach(item => {
            Storage.updateStock(item.productId, item.qty);
        });

        // Show receipt
        showReceipt(saved);
        App.showToast('Transaksi berhasil!', 'success');
    }

    // ===================== RECEIPT =====================

    function showReceipt(transaction) {
        const settings = Storage.getSettings();
        const receiptEl = document.getElementById('receipt-content');

        const itemRows = transaction.items.map(item => `
            <div class="receipt-item">
                <span>${item.name} x${item.qty}</span>
                <span>${App.formatCurrency(item.subtotal)}</span>
            </div>
        `).join('');

        const methodLabels = {
            tunai: 'Tunai',
            kartu: 'Kartu Debit/Kredit',
            ewallet: 'E-Wallet',
            qris: 'QRIS',
        };

        receiptEl.innerHTML = `
            <div class="receipt">
                <div class="receipt-header">
                    <h2>${settings.storeName}</h2>
                    <p>${settings.storeAddress}</p>
                    <p>${settings.storePhone}</p>
                </div>
                <div class="receipt-divider"></div>
                <p>No: <strong>${transaction.id}</strong></p>
                <p>${App.formatDateTime(transaction.date)}</p>
                <div class="receipt-divider"></div>
                ${itemRows}
                <div class="receipt-divider"></div>
                <div class="receipt-item">
                    <span>Subtotal</span>
                    <span>${App.formatCurrency(transaction.subtotal)}</span>
                </div>
                <div class="receipt-item">
                    <span>Diskon</span>
                    <span>- ${App.formatCurrency(transaction.totalDiscount)}</span>
                </div>
                <div class="receipt-item receipt-total">
                    <span>TOTAL</span>
                    <span>${App.formatCurrency(transaction.total)}</span>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-item">
                    <span>${methodLabels[transaction.paymentMethod] || transaction.paymentMethod}</span>
                    <span>${App.formatCurrency(transaction.amountPaid)}</span>
                </div>
                <div class="receipt-item">
                    <span>Kembalian</span>
                    <span>${App.formatCurrency(transaction.change)}</span>
                </div>
                <div class="receipt-footer">
                    <p>Terima kasih atas kunjungan Anda!</p>
                    <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
                </div>
            </div>
        `;

        App.openModal('payment-modal');
    }

    // ===================== REVIEW MODAL =====================

    function showReviewModal() {
        const body = document.getElementById('review-modal-body');

        const rows = cart.map((item, i) => `
            <div class="review-item">
                <div class="review-item-header">
                    <span class="review-item-name">${item.name}</span>
                    <span class="review-item-price">${App.formatCurrency(item.price)}</span>
                </div>
                <div class="review-item-details">
                    <span class="review-item-qty">Jumlah: <strong>${item.qty}</strong></span>
                    ${item.discount > 0 ? `<span class="review-item-disc">Diskon: <strong>-${App.formatCurrency(item.discount)}</strong></span>` : ''}
                    <span class="review-item-subtotal">Subtotal: <strong>${App.formatCurrency(item.subtotal)}</strong></span>
                </div>
            </div>
        `).join('');

        const total = getTotalAfterDiscount();

        body.innerHTML = `
            <div class="review-list">${rows}</div>
            <div class="review-total">
                <span>TOTAL</span>
                <span>${App.formatCurrency(total)}</span>
            </div>
        `;

        App.openModal('review-modal');
    }

    // ===================== PUBLIC API =====================

    return {
        init,
        addToCart,
        removeFromCart,
        updateCartQty,
        updateItemDiscount,
    };
})();

// Initialize POS when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    POS.init();
});
