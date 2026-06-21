/**
 * reports.js — Rekapan Bulanan Logic
 * Laporan penjualan, grafik, top produk, export CSV
 */

const Reports = (() => {
    let currentYear, currentMonth;
    let currentSummary = null;

    const MONTH_NAMES = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const CHART_COLORS = [
        '#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0',
        '#00BCD4', '#FF5722', '#795548', '#607D8B', '#3F51B5',
        '#CDDC39', '#FFEB3B',
    ];

    // ===================== INITIALIZATION =====================

    function init() {
        setDefaultPeriod();
        populateYears();
        bindEvents();
    }

    function setDefaultPeriod() {
        const now = new Date();
        currentMonth = now.getMonth();
        currentYear = now.getFullYear();

        document.getElementById('filter-month').value = currentMonth;
    }

    function populateYears() {
        const select = document.getElementById('filter-year');
        const now = new Date();
        const startYear = now.getFullYear() - 2;

        select.innerHTML = '';
        for (let y = startYear; y <= now.getFullYear() + 1; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            if (y === currentYear) option.selected = true;
            select.appendChild(option);
        }
    }

    function bindEvents() {
        document.getElementById('btn-generate').addEventListener('click', generateReport);

        document.getElementById('btn-export-transactions').addEventListener('click', () => {
            if (currentSummary && currentSummary.transactions.length > 0) {
                Storage.exportTransactionsCSV(currentYear, currentMonth);
                App.showToast('Transaksi berhasil di-export!', 'success');
            } else {
                App.showToast('Tidak ada data untuk di-export', 'warning');
            }
        });

        document.getElementById('btn-export-summary').addEventListener('click', () => {
            if (currentSummary && currentSummary.totalTransactions > 0) {
                Storage.exportSummaryCSV(currentYear, currentMonth);
                App.showToast('Ringkasan berhasil di-export!', 'success');
            } else {
                App.showToast('Tidak ada data untuk di-export', 'warning');
            }
        });
    }

    // ===================== REPORT GENERATION =====================

    function generateReport() {
        currentYear = parseInt(document.getElementById('filter-year').value);
        currentMonth = parseInt(document.getElementById('filter-month').value);

        currentSummary = Storage.getMonthlySummary(currentYear, currentMonth);

        renderSummaryCards();
        renderDailyChart();
        renderTopProductsChart();
        renderTopProductsList();
        renderTransactionsTable();

        if (currentSummary.totalTransactions === 0) {
            document.getElementById('empty-report').style.display = 'flex';
            document.getElementById('charts-section').style.display = 'none';
            document.getElementById('top-products-section').style.display = 'none';
        } else {
            document.getElementById('empty-report').style.display = 'none';
            document.getElementById('charts-section').style.display = 'grid';
            document.getElementById('top-products-section').style.display = 'block';
        }
    }

    // ===================== SUMMARY CARDS =====================

    function renderSummaryCards() {
        document.getElementById('summary-revenue').textContent =
            App.formatCurrency(currentSummary.totalRevenue);
        document.getElementById('summary-transactions').textContent =
            currentSummary.totalTransactions;
        document.getElementById('summary-average').textContent =
            App.formatCurrency(currentSummary.averagePerTransaction);
        document.getElementById('summary-items').textContent =
            currentSummary.totalItems;
        document.getElementById('summary-discount').textContent =
            App.formatCurrency(currentSummary.totalDiscount);
    }

    // ===================== CHARTS =====================

    function renderDailyChart() {
        const canvas = document.getElementById('daily-chart');
        const ctx = canvas.getContext('2d');
        const emptyMsg = document.getElementById('daily-chart-empty');
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Collect daily data
        const dailyData = [];
        let hasData = false;
        for (let d = 1; d <= daysInMonth; d++) {
            const value = currentSummary.dailySales[d] || 0;
            dailyData.push(value);
            if (value > 0) hasData = true;
        }

        if (!hasData) {
            canvas.style.display = 'none';
            emptyMsg.style.display = 'block';
            return;
        }

        canvas.style.display = 'block';
        emptyMsg.style.display = 'none';

        // Chart dimensions
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 20, right: 20, bottom: 40, left: 70 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const maxValue = Math.max(...dailyData, 1);

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';

        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            const value = maxValue - (maxValue / gridLines) * i;

            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            ctx.fillText(formatShortCurrency(value), padding.left - 5, y + 3);
        }

        // Draw bars
        const barWidth = Math.max(2, (chartWidth / daysInMonth) - 2);

        for (let d = 0; d < dailyData.length; d++) {
            const value = dailyData[d];
            const x = padding.left + (chartWidth / daysInMonth) * d + 1;
            const barHeight = (value / maxValue) * chartHeight;
            const y = padding.top + chartHeight - barHeight;

            // Bar color
            ctx.fillStyle = value > 0 ? '#4CAF50' : '#e8e8e8';
            ctx.fillRect(x, y, barWidth, barHeight);

            // Day label (show every few days)
            if ((d + 1) % 5 === 0 || d === 0) {
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.font = '9px sans-serif';
                ctx.fillText(d + 1, x + barWidth / 2, height - padding.bottom + 15);
            }
        }

        // X-axis label
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.font = '11px sans-serif';
        ctx.fillText('Hari', width / 2, height - 2);
    }

    function renderTopProductsChart() {
        const canvas = document.getElementById('top-products-chart');
        const ctx = canvas.getContext('2d');
        const emptyMsg = document.getElementById('top-chart-empty');

        const entries = Object.entries(currentSummary.productSales)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 6);

        if (entries.length === 0) {
            canvas.style.display = 'none';
            emptyMsg.style.display = 'block';
            return;
        }

        canvas.style.display = 'block';
        emptyMsg.style.display = 'none';

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Pie chart
        const totalRevenue = entries.reduce((sum, [, data]) => sum + data.revenue, 0);
        const centerX = width * 0.35;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        let startAngle = -Math.PI / 2;

        entries.forEach(([name, data], i) => {
            const sliceAngle = (data.revenue / totalRevenue) * 2 * Math.PI;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
            ctx.fill();

            startAngle += sliceAngle;
        });

        // Inner circle for donut effect
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Center text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Omzet', centerX, centerY - 5);
        ctx.font = '11px sans-serif';
        ctx.fillText(formatShortCurrency(totalRevenue), centerX, centerY + 12);

        // Legend (right side)
        const legendX = width * 0.65;
        let legendY = 30;

        entries.forEach(([name, data], i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            const percentage = ((data.revenue / totalRevenue) * 100).toFixed(1);

            // Color box
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, 12, 12);

            // Text
            ctx.fillStyle = '#333';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'left';
            const displayName = name.length > 18 ? name.substring(0, 18) + '…' : name;
            ctx.fillText(displayName, legendX + 18, legendY + 10);

            // Percentage
            ctx.fillStyle = '#888';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${percentage}%`, legendX + 18, legendY + 22);

            legendY += 38;
        });
    }

    function formatShortCurrency(amount) {
        if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'jt';
        if (amount >= 1000) return (amount / 1000).toFixed(0) + 'rb';
        return amount.toString();
    }

    // ===================== TOP PRODUCTS LIST =====================

    function renderTopProductsList() {
        const container = document.getElementById('top-products-list');

        if (currentSummary.topProducts.length === 0) {
            container.innerHTML = '<p class="text-muted">Belum ada data produk terlaris</p>';
            return;
        }

        const maxRevenue = currentSummary.topProducts[0]?.revenue || 1;

        container.innerHTML = currentSummary.topProducts.map((product, i) => {
            const percentage = (product.revenue / maxRevenue) * 100;
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

            return `
                <div class="top-product-item">
                    <span class="top-rank">${medals[i] || (i + 1)}</span>
                    <div class="top-product-info">
                        <span class="top-product-name">${product.name}</span>
                        <span class="top-product-detail">
                            ${product.qty} terjual · ${App.formatCurrency(product.revenue)}
                        </span>
                        <div class="top-product-bar">
                            <div class="top-product-bar-fill" style="width: ${percentage}%; background: ${CHART_COLORS[i]}"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===================== TRANSACTIONS TABLE =====================

    function renderTransactionsTable() {
        const tbody = document.getElementById('transactions-tbody');

        if (currentSummary.transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted">
                        Tidak ada transaksi untuk periode ini
                    </td>
                </tr>`;
            return;
        }

        const methodLabels = {
            tunai: '💵 Tunai',
            kartu: '💳 Kartu',
            ewallet: '📱 E-Wallet',
            qris: '📷 QRIS',
        };

        // Sort by date descending
        const sorted = [...currentSummary.transactions].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        tbody.innerHTML = sorted.map(t => {
            const itemsSummary = t.items.map(i => `${i.name} x${i.qty}`).join(', ');
            const methodLabel = methodLabels[t.paymentMethod] || t.paymentMethod;

            return `
                <tr>
                    <td><code>${t.id}</code></td>
                    <td>${App.formatDateTime(t.date)}</td>
                    <td class="text-sm">${itemsSummary}</td>
                    <td class="text-right">${App.formatCurrency(t.subtotal)}</td>
                    <td class="text-right text-danger">- ${App.formatCurrency(t.totalDiscount || 0)}</td>
                    <td class="text-right font-bold">${App.formatCurrency(t.total)}</td>
                    <td>${methodLabel}</td>
                    <td class="text-right">${App.formatCurrency(t.amountPaid)}</td>
                    <td class="text-right">${App.formatCurrency(t.change)}</td>
                </tr>
            `;
        }).join('');
    }

    // ===================== PUBLIC API =====================

    return {
        init,
        generateReport,
    };
})();

document.addEventListener('DOMContentLoaded', Reports.init);
