/**
 * app.js — Core Application Module
 * Shared utilities, formatting, toast notifications, navigation helpers
 */

const App = (() => {
    // ===================== INITIALIZATION =====================

    function init() {
        Storage.initData();
        Storage.seedDummyData();
        highlightCurrentNav();
        updateDateTime();
        setInterval(updateDateTime, 60000);
    }

    function updateDateTime() {
        const el = document.getElementById('current-datetime');
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }) + ' — ' + now.toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit'
            });
        }
    }

    function highlightCurrentNav() {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === path || (path === '' && href === 'index.html')) {
                link.classList.add('active');
            }
        });
    }

    // ===================== FORMATTING =====================

    function formatCurrency(amount) {
        return 'Rp ' + Number(amount).toLocaleString('id-ID');
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    }

    function formatDateTime(dateStr) {
        return new Date(dateStr).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    function formatDateShort(dateStr) {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short',
        });
    }

    // ===================== TOAST NOTIFICATIONS =====================

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => toast.classList.add('show'));

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===================== CONFIRMATION DIALOG =====================

    function showConfirm(message) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirm-modal');
            if (!modal) {
                resolve(window.confirm(message));
                return;
            }

            modal.querySelector('.confirm-message').textContent = message;
            modal.classList.add('active');

            const yesBtn = modal.querySelector('.confirm-yes');
            const noBtn = modal.querySelector('.confirm-no');

            const cleanup = () => {
                modal.classList.remove('active');
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
            };

            const onYes = () => { cleanup(); resolve(true); };
            const onNo = () => { cleanup(); resolve(false); };

            yesBtn.addEventListener('click', onYes);
            noBtn.addEventListener('click', onNo);
        });
    }

    // ===================== PRODUCT CATEGORY COLORS =====================

    const categoryColors = {
        'Sembako': '#4CAF50',
        'Minuman': '#2196F3',
        'Lainnya': '#FF9800',
    };

    function getCategoryColor(category) {
        return categoryColors[category] || '#9E9E9E';
    }

    function getCategoryEmoji(category) {
        const emojis = {
            'Sembako': '🏪',
            'Minuman': '🥤',
            'Lainnya': '📦',
        };
        return emojis[category] || '📦';
    }

    // ===================== PAYMENT METHODS =====================

    const paymentMethods = [
        { id: 'tunai', label: 'Tunai', icon: '💵' },
        { id: 'kartu', label: 'Kartu Debit/Kredit', icon: '💳' },
        { id: 'ewallet', label: 'E-Wallet', icon: '📱' },
        { id: 'qris', label: 'QRIS', icon: '📷' },
    ];

    // ===================== MODAL HELPERS =====================

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Close modal on overlay click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => {
                m.classList.remove('active');
            });
            document.body.style.overflow = '';
        }
    });

    // ===================== QUANTITY HELPER =====================

    function createQuantityControl(min = 0, max = 9999) {
        return `
            <div class="qty-control">
                <button class="qty-btn qty-minus" data-action="minus">−</button>
                <input type="number" class="qty-input" min="${min}" max="${max}" value="1">
                <button class="qty-btn qty-plus" data-action="plus">+</button>
            </div>
        `;
    }

    // ===================== EXPORT HELPERS =====================

    function triggerPrint(elementId) {
        const content = document.getElementById(elementId);
        if (!content) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Struk Belanja</title>
                <style>
                    body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 10px; }
                    .receipt { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 10px 0; }
                    .receipt-header { text-align: center; margin-bottom: 10px; }
                    .receipt-header h2 { margin: 0; font-size: 16px; }
                    .receipt-header p { margin: 2px 0; font-size: 11px; }
                    .receipt-divider { border-top: 1px dashed #999; margin: 8px 0; }
                    .receipt-item { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
                    .receipt-total { font-weight: bold; font-size: 14px; }
                    .receipt-footer { text-align: center; margin-top: 10px; font-size: 11px; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                ${content.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    return {
        init,
        updateDateTime,
        // Formatting
        formatCurrency,
        formatDate,
        formatDateTime,
        formatDateShort,
        // Notifications
        showToast,
        showConfirm,
        // UI Helpers
        getCategoryColor,
        getCategoryEmoji,
        paymentMethods,
        openModal,
        closeModal,
        createQuantityControl,
        triggerPrint,
    };
})();

// Initialize app when DOM ready
document.addEventListener('DOMContentLoaded', App.init);
