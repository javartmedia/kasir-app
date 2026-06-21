/**
 * products.js — Manajemen Produk Logic
 * CRUD produk, filter, import/export CSV
 */

const Products = (() => {
    let editingId = null;

    // ===================== INITIALIZATION =====================

    function init() {
        console.log('Products.init called');
        renderTable();
        renderStats();
        renderCategoryFilter();
        bindEvents();
        console.log('Products.init done');
    }

    function bindEvents() {
        console.log('bindEvents called');
        // Add product
        const btn = document.getElementById('btn-add-product');
        console.log('btn-add-product:', btn);
        if (btn) {
            btn.addEventListener('click', openForm);
            console.log('event listener added');
        } else {
            console.error('btn-add-product NOT FOUND!');
        }

        // Form submit
        document.getElementById('product-form').addEventListener('submit', handleFormSubmit);

        // Search
        document.getElementById('search-products').addEventListener('input', () => {
            renderTable();
        });

        // Category filter
        document.getElementById('filter-category').addEventListener('change', renderTable);

        // Stock filter
        document.getElementById('filter-stock').addEventListener('change', renderTable);

        // Export CSV
        document.getElementById('btn-export-csv').addEventListener('click', () => {
            Storage.exportProductsCSV();
            App.showToast('Produk berhasil di-export!', 'success');
        });

        // Import CSV
        document.getElementById('import-csv').addEventListener('change', handleImportCSV);

        // Custom category toggle
        document.getElementById('form-category').addEventListener('change', (e) => {
            const customInput = document.getElementById('form-custom-category');
            if (e.target.value === 'Lainnya') {
                customInput.focus();
            }
        });
    }

    // ===================== RENDERING =====================

    function renderTable() {
        const searchTerm = document.getElementById('search-products').value.toLowerCase();
        const categoryFilter = document.getElementById('filter-category').value;
        const stockFilter = document.getElementById('filter-stock').value;

        let products = Storage.getProducts();

        // Apply filters
        if (searchTerm) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.id.toLowerCase().includes(searchTerm)
            );
        }

        if (categoryFilter) {
            products = products.filter(p => p.category === categoryFilter);
        }

        if (stockFilter === 'available') {
            products = products.filter(p => p.stock > 5);
        } else if (stockFilter === 'low') {
            products = products.filter(p => p.stock > 0 && p.stock <= 5);
        } else if (stockFilter === 'empty') {
            products = products.filter(p => p.stock === 0);
        }

        const tbody = document.getElementById('products-tbody');
        const emptyState = document.getElementById('empty-state');
        const tableContainer = document.querySelector('.table-container');

        if (products.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        tableContainer.style.display = 'block';
        emptyState.style.display = 'none';

        tbody.innerHTML = products.map(p => {
            const color = App.getCategoryColor(p.category);
            const emoji = App.getCategoryEmoji(p.category);
            const stockClass = p.stock === 0 ? 'stock-empty' : p.stock <= 5 ? 'stock-low' : 'stock-ok';

            return `
                <tr>
                    <td><code>${p.id}</code></td>
                    <td>
                        <div class="product-cell">
                            <span class="product-cell-emoji">${emoji}</span>
                            <span class="product-cell-name">${p.name}</span>
                        </div>
                    </td>
                    <td>
                        <span class="badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40">
                            ${p.category}
                        </span>
                    </td>
                    <td class="text-right">${App.formatCurrency(p.price)}</td>
                    <td class="text-center">
                        <span class="stock-badge ${stockClass}">${p.stock}</span>
                    </td>
                    <td class="text-center">${App.formatDate(p.createdAt)}</td>
                    <td class="text-center">
                        <div class="action-buttons">
                            <button class="btn-icon btn-edit" onclick="Products.openForm('${p.id}')" title="Edit">
                                ✏️
                            </button>
                            <button class="btn-icon btn-delete" onclick="Products.handleDelete('${p.id}')" title="Hapus">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderStats() {
        const products = Storage.getProducts();
        const categories = Storage.getCategories();
        const lowStock = Storage.getLowStockProducts();
        const outOfStock = products.filter(p => p.stock === 0);

        document.getElementById('stat-total-products').textContent = products.length;
        document.getElementById('stat-categories').textContent = categories.length;
        document.getElementById('stat-low-stock').textContent = lowStock.length;
        document.getElementById('stat-out-of-stock').textContent = outOfStock.length;
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

    // ===================== FORM HANDLING =====================

    function openForm(productId = null) {
        console.log('openForm called', productId);
        editingId = productId;
        const form = document.getElementById('product-form');
        const title = document.getElementById('modal-title');
        const idField = document.getElementById('form-product-id');

        console.log('form:', form, 'title:', title, 'idField:', idField);
        form.reset();

        if (productId) {
            const product = Storage.getProductById(productId);
            if (!product) return;

            title.textContent = 'Edit Produk';
            idField.value = product.id;
            document.getElementById('form-name').value = product.name;
            document.getElementById('form-category').value = product.category === 'Lainnya' ? 'Lainnya' : product.category;
            document.getElementById('form-price').value = product.price;
            document.getElementById('form-stock').value = product.stock;

            // If category doesn't match standard options, set custom
            const standardCats = ['Sembako', 'Minuman', 'Lainnya'];
            if (!standardCats.includes(product.category)) {
                document.getElementById('form-category').value = 'Lainnya';
                document.getElementById('form-custom-category').value = product.category;
            }
        } else {
            title.textContent = 'Tambah Produk Baru';
            idField.value = '';
        }

        const modal = document.getElementById('product-modal');
        console.log('product-modal element:', modal);
        if (modal) {
            App.openModal('product-modal');
            console.log('modal classList after open:', modal.className);
        } else {
            console.error('product-modal NOT FOUND!');
        }
        document.getElementById('form-name').focus();
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        const name = document.getElementById('form-name').value.trim();
        let category = document.getElementById('form-category').value;
        const customCategory = document.getElementById('form-custom-category').value.trim();
        const price = parseInt(document.getElementById('form-price').value) || 0;
        const stock = parseInt(document.getElementById('form-stock').value) || 0;

        // Use custom category if provided
        if (customCategory) {
            category = customCategory;
        }

        if (!name) {
            App.showToast('Nama produk harus diisi!', 'error');
            return;
        }
        if (!category) {
            App.showToast('Kategori harus dipilih!', 'error');
            return;
        }
        if (price <= 0) {
            App.showToast('Harga harus lebih dari 0!', 'error');
            return;
        }
        if (stock < 0) {
            App.showToast('Stok tidak boleh negatif!', 'error');
            return;
        }

        if (editingId) {
            Storage.updateProduct(editingId, { name, category, price, stock });
            App.showToast('Produk berhasil diupdate!', 'success');
        } else {
            Storage.addProduct({ name, category, price, stock });
            App.showToast('Produk berhasil ditambahkan!', 'success');
        }

        App.closeModal('product-modal');
        editingId = null;
        renderTable();
        renderStats();
        renderCategoryFilter();
    }

    async function handleDelete(productId) {
        const product = Storage.getProductById(productId);
        if (!product) return;

        const confirmed = await App.showConfirm(
            `Apakah Anda yakin ingin menghapus produk "${product.name}"?`
        );

        if (confirmed) {
            Storage.deleteProduct(productId);
            App.showToast('Produk berhasil dihapus!', 'success');
            renderTable();
            renderStats();
            renderCategoryFilter();
        }
    }

    // ===================== CSV IMPORT =====================

    async function handleImportCSV(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const result = await Storage.importProductsCSV(file);
            App.showToast(
                `Import berhasil! ${result.imported} baru, ${result.updated} diperbarui.`,
                'success'
            );
            renderTable();
            renderStats();
            renderCategoryFilter();
        } catch (err) {
            App.showToast(err, 'error');
        }

        // Reset file input
        e.target.value = '';
    }

    // ===================== PUBLIC API =====================

    return {
        init,
        openForm,
        handleDelete,
    };
})();

document.addEventListener('DOMContentLoaded', Products.init);
