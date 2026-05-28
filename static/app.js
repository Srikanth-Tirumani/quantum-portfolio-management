/* ═══════════════════════════════════════════════════════════════
   Quantum Portfolio Management — Dashboard JavaScript
   Handles API calls, Chart.js rendering, navigation, and sector filtering
   ═══════════════════════════════════════════════════════════════ */

// ── Chart.js Global Config ───────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

const COLORS = {
    purple: '#8b5cf6', blue: '#3b82f6', cyan: '#06b6d4',
    green: '#10b981', orange: '#f59e0b', red: '#ef4444', pink: '#ec4899',
    palette: ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'],
    sectors: {
        Technology: '#8b5cf6',
        Finance:    '#3b82f6',
        Healthcare: '#10b981',
        Energy:     '#f59e0b',
        Consumer:   '#ec4899',
        Industrial: '#06b6d4'
    }
};

let charts = {};
let allStocksData = {};   // full dataset: { ticker: stockObj }
let activeSector   = 'All';
let searchQuery    = '';

// ── Navigation ───────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const section = item.dataset.section;
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');

        const titles = {
            dashboard: 'Dashboard Overview',
            market:    'Live Market Data',
            portfolio: 'Portfolio Analysis',
            quantum:   'Quantum AI Engine',
            comparison:'Classical vs Quantum'
        };
        document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';
        document.getElementById('sidebar').classList.remove('open');
    });
});

document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('btnRefresh').addEventListener('click', () => {
    loadAllData();
});

// ── Sector Tab Wiring ────────────────────────────────────────
document.querySelectorAll('.sector-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.sector-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeSector = tab.dataset.sector;
        applyFilters();
    });
});

// ── Search Wiring ────────────────────────────────────────────
const searchInput = document.getElementById('stockSearch');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.toLowerCase().trim();
        applyFilters();
    });
}

// ── API Fetcher ──────────────────────────────────────────────
async function fetchAPI(endpoint) {
    try {
        const res = await fetch(`/api/${endpoint}`);
        return await res.json();
    } catch (err) {
        console.error(`API Error (${endpoint}):`, err);
        return null;
    }
}

// ── Load All Data ────────────────────────────────────────────
async function loadAllData() {
    const [summary, bySector, portfolio, quantum] = await Promise.all([
        fetchAPI('summary'),
        fetchAPI('stocks/by-sector'),
        fetchAPI('portfolio'),
        fetchAPI('quantum')
    ]);

    if (summary)   renderSummary(summary);
    if (bySector) {
        allStocksData = bySector.all_stocks || {};
        renderStockGrid(allStocksData);
        renderMarketBreadth(allStocksData);
    }
    if (portfolio) renderPortfolio(portfolio);
    if (quantum)   renderQuantum(quantum);

    // Update market clock
    const now = new Date();
    document.getElementById('marketStatus').textContent =
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Apply Sector + Search Filter ────────────────────────────
function applyFilters() {
    if (!allStocksData || Object.keys(allStocksData).length === 0) return;

    let filtered = {};
    Object.entries(allStocksData).forEach(([ticker, stock]) => {
        if (stock.error) return;

        const matchesSector = activeSector === 'All' || stock.sector === activeSector;
        const matchesSearch = !searchQuery ||
            ticker.toLowerCase().includes(searchQuery) ||
            (stock.name || '').toLowerCase().includes(searchQuery);

        if (matchesSector && matchesSearch) {
            filtered[ticker] = stock;
        }
    });

    renderStockGrid(filtered, true);

    // Update chart label
    const labelEl = document.getElementById('chartSectorLabel');
    if (labelEl) labelEl.textContent = activeSector === 'All' ? 'All Sectors' : activeSector;
}

// ── Render Summary ───────────────────────────────────────────
function renderSummary(data) {
    document.getElementById('totalAssets').textContent = data.total_assets || 25;
    document.getElementById('modelStatus').textContent = data.model_status || 'Trained';
    document.getElementById('quantumAdvantage').textContent = data.quantum_advantage || '+12.4%';

    const avgEl = document.getElementById('avgChange');
    avgEl.textContent = (data.avg_change >= 0 ? '+' : '') + data.avg_change + '%';
    avgEl.style.color = data.avg_change >= 0 ? COLORS.green : COLORS.red;

    // Sector breakdown chart on Dashboard
    if (data.sector_counts) {
        renderSectorBreakdown(data.sector_counts, data.sector_colors || COLORS.sectors);
    }
}

// ── Render Market Breadth ────────────────────────────────────
function renderMarketBreadth(data) {
    let gainers = 0, losers = 0;
    Object.values(data).forEach(s => {
        if (s.error) return;
        if (s.change >= 0) gainers++; else losers++;
    });
    const total = gainers + losers;

    const gEl = document.getElementById('breadthGainers');
    const lEl = document.getElementById('breadthLosers');
    const fEl = document.getElementById('breadthFill');

    if (gEl) gEl.textContent = `↑ ${gainers} Gainers`;
    if (lEl) lEl.textContent = `↓ ${losers} Losers`;
    if (fEl) fEl.style.width = total > 0 ? `${(gainers / total) * 100}%` : '50%';
}

// ── Render Stocks Grid ───────────────────────────────────────
function renderStockGrid(data, filtered = false) {
    const grid = document.getElementById('stocksGrid');
    grid.innerHTML = '';

    const entries = Object.entries(data).filter(([, s]) => !s.error);
    if (entries.length === 0) {
        grid.innerHTML = '<p style="color:#94a3b8;padding:2rem;">No stocks match your filter.</p>';
        return;
    }

    const allDates = [];
    const allSeries = [];

    entries.forEach(([ticker, stock]) => {
        const changeClass = stock.change >= 0 ? 'positive' : 'negative';
        const changeSign  = stock.change >= 0 ? '+' : '';
        const sectorColor = COLORS.sectors[stock.sector] || '#94a3b8';
        const vol = stock.volume ? (stock.volume / 1e6).toFixed(2) + 'M' : 'N/A';

        grid.innerHTML += `
            <div class="stock-card" data-ticker="${ticker}" data-sector="${stock.sector || ''}">
                <div class="stock-header">
                    <div>
                        <span class="stock-ticker">${ticker}</span>
                        <span class="stock-name">${stock.name || ticker}</span>
                    </div>
                    <span class="stock-change ${changeClass}">${changeSign}${stock.change}%</span>
                </div>
                <span class="sector-badge" style="background:${sectorColor}22;color:${sectorColor};border:1px solid ${sectorColor}44">${stock.sector || 'N/A'}</span>
                <div class="stock-price">$${stock.price.toLocaleString()}</div>
                <div class="stock-meta">
                    <div class="stock-meta-item">
                        <span class="stock-meta-label">52W High</span>
                        <span class="stock-meta-value">$${stock.high_52w}</span>
                    </div>
                    <div class="stock-meta-item">
                        <span class="stock-meta-label">52W Low</span>
                        <span class="stock-meta-value">$${stock.low_52w}</span>
                    </div>
                    <div class="stock-meta-item">
                        <span class="stock-meta-label">Sharpe</span>
                        <span class="stock-meta-value">${stock.sharpe}</span>
                    </div>
                    <div class="stock-meta-item">
                        <span class="stock-meta-label">Volatility</span>
                        <span class="stock-meta-value">${stock.volatility}%</span>
                    </div>
                    <div class="stock-meta-item">
                        <span class="stock-meta-label">Volume</span>
                        <span class="stock-meta-value">${vol}</span>
                    </div>
                    <div class="stock-meta-item">
                        <span class="stock-meta-label">Avg Return</span>
                        <span class="stock-meta-value">${stock.avg_return}%</span>
                    </div>
                </div>
            </div>
        `;

        if (stock.history) {
            if (allDates.length === 0) allDates.push(...stock.history.dates);
            allSeries.push({ ticker, sector: stock.sector, prices: stock.history.prices });
        }
    });

    renderPriceHistoryChart(allDates, allSeries);
}

// ── Price History Chart ──────────────────────────────────────
function renderPriceHistoryChart(dates, series) {
    if (charts.priceHistory) charts.priceHistory.destroy();

    const labels = dates.map(d => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Max 10 series for readability
    const visibleSeries = series.slice(0, 10);

    charts.priceHistory = new Chart(document.getElementById('priceHistoryChart'), {
        type: 'line',
        data: {
            labels,
            datasets: visibleSeries.map((s, i) => ({
                label: s.ticker,
                data: s.prices,
                borderColor: COLORS.sectors[s.sector] || COLORS.palette[i % COLORS.palette.length],
                backgroundColor: (COLORS.sectors[s.sector] || COLORS.palette[i % COLORS.palette.length]) + '12',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 10 } } },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => '$' + v } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

// ── Sector Breakdown Chart (Dashboard) ──────────────────────
function renderSectorBreakdown(sectorCounts, sectorColors) {
    if (charts.sectorBreakdown) charts.sectorBreakdown.destroy();

    const labels = Object.keys(sectorCounts);
    const counts  = Object.values(sectorCounts);
    const colors  = labels.map(l => sectorColors[l] || '#94a3b8');

    charts.sectorBreakdown = new Chart(document.getElementById('sectorBreakdownChart'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 12, boxWidth: 14 } },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed} stocks` } }
            }
        }
    });

    // Sector legend on dashboard
    const legendEl = document.getElementById('sectorLegend');
    if (legendEl) {
        const SECTOR_TICKERS = {
            Technology: ['AAPL','MSFT','GOOGL','AMZN','NVDA','META'],
            Finance:    ['JPM','BAC','GS','V','MS'],
            Healthcare: ['JNJ','PFE','UNH','ABBV'],
            Energy:     ['XOM','CVX','COP','SLB'],
            Consumer:   ['WMT','MCD','KO'],
            Industrial: ['CAT','BA','GE']
        };
        legendEl.innerHTML = labels.map(l => `
            <div class="sector-legend-item">
                <div class="sector-legend-dot" style="background:${sectorColors[l]}"></div>
                <div class="sector-legend-info">
                    <span class="sector-legend-name">${l}</span>
                    <span class="sector-legend-tickers">${(SECTOR_TICKERS[l] || []).join(' · ')}</span>
                </div>
                <span class="sector-legend-count">${sectorCounts[l]}</span>
            </div>
        `).join('');
    }
}

// ── Render Portfolio ─────────────────────────────────────────
function renderPortfolio(data) {
    if (data.error) return;

    const eq  = data.equal_portfolio;
    const opt = data.optimized_portfolio;

    document.getElementById('equalMetrics').innerHTML = `
        <div class="metric"><span class="metric-label">Annual Return</span><span class="metric-value" style="color:${eq.return >= 0 ? COLORS.green : COLORS.red}">${(eq.return).toFixed(2)}%</span></div>
        <div class="metric"><span class="metric-label">Risk (Volatility)</span><span class="metric-value">${(eq.risk).toFixed(2)}%</span></div>
        <div class="metric"><span class="metric-label">Sharpe Ratio</span><span class="metric-value">${(eq.sharpe).toFixed(2)}</span></div>
    `;
    document.getElementById('optimizedMetrics').innerHTML = `
        <div class="metric"><span class="metric-label">Annual Return</span><span class="metric-value" style="color:${opt.return >= 0 ? COLORS.green : COLORS.red}">${(opt.return).toFixed(2)}%</span></div>
        <div class="metric"><span class="metric-label">Risk (Volatility)</span><span class="metric-value">${(opt.risk).toFixed(2)}%</span></div>
        <div class="metric"><span class="metric-label">Sharpe Ratio</span><span class="metric-value">${(opt.sharpe).toFixed(2)}</span></div>
    `;

    // Sector Weight Chart
    if (data.sector_weights && charts.sectorWeight !== undefined || true) {
        if (charts.sectorWeight) charts.sectorWeight.destroy();
        const swLabels = Object.keys(data.sector_weights || {});
        const swValues = Object.values(data.sector_weights || {});
        const swColors = swLabels.map(l => data.sector_colors?.[l] || COLORS.sectors[l] || '#94a3b8');
        charts.sectorWeight = new Chart(document.getElementById('sectorWeightChart'), {
            type: 'bar',
            data: {
                labels: swLabels,
                datasets: [{
                    label: 'Optimized Weight (%)',
                    data: swValues,
                    backgroundColor: swColors.map(c => c + 'bb'),
                    borderColor: swColors,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => v + '%' } }
                }
            }
        });
    }

    // Weight distribution doughnut (all 25 tickers)
    if (charts.weight) charts.weight.destroy();
    const tickers = data.tickers || [];
    const tickerColors = tickers.map(t => {
        const sector = (data.stock_table || []).find(s => s.ticker === t)?.sector || 'Other';
        return COLORS.sectors[sector] || '#94a3b8';
    });
    charts.weight = new Chart(document.getElementById('weightChart'), {
        type: 'doughnut',
        data: {
            labels: tickers,
            datasets: [{
                data: data.optimized_weights,
                backgroundColor: tickerColors.map(c => c + '99'),
                borderColor: tickerColors,
                borderWidth: 1,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 6, boxWidth: 10, font: { size: 10 } } },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}%` } }
            }
        }
    });

    // Correlation grid
    renderCorrelation(data.correlation);

    // Cumulative returns
    if (charts.cumulative) charts.cumulative.destroy();
    const cumLabels = data.cumulative.dates.map(d => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    charts.cumulative = new Chart(document.getElementById('cumulativeChart'), {
        type: 'line',
        data: {
            labels: cumLabels,
            datasets: [{
                label: 'Portfolio Cumulative Return',
                data: data.cumulative.values,
                borderColor: COLORS.purple,
                backgroundColor: COLORS.purple + '20',
                borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' } }
            }
        }
    });

    // Weight Table
    renderWeightTable(data.stock_table || []);

    // Dashboard allocation chart
    if (charts.dashAllocation) charts.dashAllocation.destroy();
    charts.dashAllocation = new Chart(document.getElementById('dashAllocationChart'), {
        type: 'polarArea',
        data: {
            labels: tickers.slice(0, 10),
            datasets: [{
                data: (data.optimized_weights || []).slice(0, 10),
                backgroundColor: tickerColors.slice(0, 10).map(c => c + '80'),
                borderColor: tickerColors.slice(0, 10),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { padding: 8, font: { size: 10 } } } },
            scales: { r: { display: false } }
        }
    });
}

// ── Weight Table ─────────────────────────────────────────────
function renderWeightTable(stockTable) {
    const tbody = document.getElementById('weightTableBody');
    if (!tbody || !stockTable.length) return;
    tbody.innerHTML = stockTable.map(row => {
        const delta = (row.opt_weight - row.equal_weight).toFixed(1);
        const deltaColor = delta >= 0 ? COLORS.green : COLORS.red;
        const sc = COLORS.sectors[row.sector] || '#94a3b8';
        return `
            <tr>
                <td><strong style="color:#e2e8f0;font-family:'JetBrains Mono',monospace">${row.ticker}</strong></td>
                <td><span class="sector-badge" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${row.sector}</span></td>
                <td>${row.equal_weight}%</td>
                <td><strong>${row.opt_weight}%</strong></td>
                <td style="color:${deltaColor};font-weight:600">${delta >= 0 ? '+' : ''}${delta}%</td>
            </tr>
        `;
    }).join('');
}

// ── Correlation Grid ─────────────────────────────────────────
function renderCorrelation(corrData) {
    if (!corrData) return;
    const grid = document.getElementById('correlationGrid');
    grid.innerHTML = '';
    
    // Auto layout for columns based on fixed left column and repeating columns
    grid.style.gridTemplateColumns = `50px repeat(${corrData.labels.length}, minmax(40px, 1fr))`;

    // Top-left corner
    grid.innerHTML += '<div class="corr-label corr-corner"></div>';
    
    // Top headers
    corrData.labels.forEach(l => {
        grid.innerHTML += `<div class="corr-label corr-label-top">${l}</div>`;
    });

    // Matrix rows
    corrData.matrix.forEach((row, i) => {
        // Left header
        grid.innerHTML += `<div class="corr-label corr-label-left">${corrData.labels[i]}</div>`;
        
        row.forEach((val, j) => {
            const intensity = Math.abs(val);
            
            // Using the requested purple formatting
            const alpha = val === 1 ? 1 : (intensity * 0.5) + 0.1;
            
            let textVal = val.toFixed(2);
            if (val === 1) textVal = '1';
            else textVal = textVal.replace('0.', '.').replace('-0.', '-.');
            
            if (textVal === '.00' || textVal === '-.00') textVal = '0';

            const bg = `rgba(109, 40, 217, ${alpha})`; // Purplish bg matching image
            grid.innerHTML += `<div class="corr-cell" style="background:${bg};">${textVal}</div>`;
        });
    });
}

// ── Render Quantum ───────────────────────────────────────────
function renderQuantum(data) {
    document.getElementById('qQubits').textContent   = data.quantum_circuit.n_qubits;
    document.getElementById('qLayers').textContent   = data.quantum_circuit.n_layers;
    document.getElementById('qGates').textContent    = data.quantum_circuit.gate_count;
    document.getElementById('qParams').textContent   = data.quantum_circuit.parameters;
    document.getElementById('qEntangle').textContent = data.quantum_circuit.entanglement;

    if (charts.training) charts.training.destroy();
    charts.training = new Chart(document.getElementById('trainingChart'), {
        type: 'line',
        data: {
            labels: data.training.epochs,
            datasets: [
                { label: 'Classical PPO', data: data.training.classical_rewards,
                  borderColor: COLORS.blue,  backgroundColor: COLORS.blue  + '15',
                  borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 },
                { label: 'Quantum VQC',  data: data.training.quantum_rewards,
                  borderColor: COLORS.purple, backgroundColor: COLORS.purple + '15',
                  borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { title: { display: true, text: 'Epoch' }, grid: { display: false } },
                y: { title: { display: true, text: 'Cumulative Reward' }, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
        }
    });

    if (charts.dashPerformance) charts.dashPerformance.destroy();
    charts.dashPerformance = new Chart(document.getElementById('dashPerformanceChart'), {
        type: 'line',
        data: {
            labels: data.backtest.days,
            datasets: [
                { label: 'Classical PPO', data: data.backtest.classical_value,
                  borderColor: COLORS.blue,   backgroundColor: COLORS.blue   + '10',
                  borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 },
                { label: 'Quantum VQC',  data: data.backtest.quantum_value,
                  borderColor: COLORS.purple, backgroundColor: COLORS.purple + '10',
                  borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { title: { display: true, text: 'Trading Days' }, grid: { display: false }, ticks: { maxTicksLimit: 10 } },
                y: { title: { display: true, text: 'Portfolio Value ($)' }, grid: { color: 'rgba(255,255,255,0.04)' },
                     ticks: { callback: v => '$' + v.toLocaleString() } }
            }
        }
    });

    renderComparison(data.comparison);

    if (charts.backtest) charts.backtest.destroy();
    charts.backtest = new Chart(document.getElementById('backtestChart'), {
        type: 'line',
        data: {
            labels: data.backtest.days,
            datasets: [
                { label: 'Classical PPO', data: data.backtest.classical_value,
                  borderColor: COLORS.blue,   backgroundColor: COLORS.blue   + '10',
                  borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0 },
                { label: 'Quantum VQC',  data: data.backtest.quantum_value,
                  borderColor: COLORS.purple, backgroundColor: COLORS.purple + '10',
                  borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { title: { display: true, text: 'Trading Days (Test Set)' }, grid: { display: false }, ticks: { maxTicksLimit: 10 } },
                y: { title: { display: true, text: 'Portfolio Value ($)' }, grid: { color: 'rgba(255,255,255,0.04)' },
                     ticks: { callback: v => '$' + v.toLocaleString() } }
            }
        }
    });
}

function renderComparison(comp) {
    const tbody = document.querySelector('#comparisonTable tbody');
    tbody.innerHTML = '';

    comp.metrics.forEach((metric, i) => {
        const cv = comp.classical[i];
        const qv = comp.quantum[i];
        let winner;
        if (metric === 'Max Drawdown') {
            winner = cv > qv ? 'Classical' : 'Quantum';
        } else if (metric === 'Volatility') {
            winner = cv < qv ? 'Classical' : 'Quantum';
        } else {
            winner = cv > qv ? 'Classical' : 'Quantum';
        }

        const winnerClass = winner === 'Quantum' ? 'winner-quantum' : 'winner-classical';
        const winnerIcon  = winner === 'Quantum' ? '⚛️' : '🤖';

        tbody.innerHTML += `
            <tr>
                <td style="font-weight:600">${metric}</td>
                <td class="classical-col">${cv}${metric.includes('Rate') || metric.includes('Return') || metric.includes('Volatility') || metric.includes('Drawdown') ? '%' : ''}</td>
                <td class="quantum-col">${qv}${metric.includes('Rate') || metric.includes('Return') || metric.includes('Volatility') || metric.includes('Drawdown') ? '%' : ''}</td>
                <td><span class="winner-badge ${winnerClass}">${winnerIcon} ${winner}</span></td>
            </tr>
        `;
    });
}

// ── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setInterval(loadAllData, 5 * 60 * 1000);
});
