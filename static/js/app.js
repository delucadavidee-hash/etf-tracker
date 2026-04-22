// ── STATE ────────────────────────────────────────────────────
const state = {
  user: null,
  currentPage: 'dashboard',
  portfolioHistory: [],
  charts: {},
  etfList: [],
  etfSearchDebounce: null,
  mcChart: null,
  backtestChart: null,
  modelAllocChart: null,
  etfPriceChart: null,
};

const EUR = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const PCT = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const NUM = (n) => new Intl.NumberFormat('it-IT').format(n);
const COLORS = ['#0A2540','#1E5AA0','#B8860B','#5A7A9A','#0F7B3F','#6BA3E8','#8A5A00','#86EFAC'];

// ── AUTH ─────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { alert('Inserisci un\'email'); return; }
  const res = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password: 'demo' }) });
  const data = await res.json();
  if (data.success) {
    state.user = data.user;
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('user-avatar').textContent = data.user.name[0].toUpperCase();
    document.getElementById('am-name').textContent = data.user.name;
    document.getElementById('am-email').textContent = data.user.email;
    document.getElementById('settings-name').value = data.user.name;
    document.getElementById('settings-email').value = data.user.email;
    initApp();
  }
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
  state.user = null;
}

// ── NAVIGATION ───────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');
  state.currentPage = page;
  closeAvatarMenu();
  if (page === 'search' && state.etfList.length === 0) loadETFs();
  if (page === 'models') loadModels();
  if (page === 'simulations') { loadBacktest(); }
  if (page === 'alerts') loadAlerts();
  if (page === 'community') loadCommunity();
  if (page === 'academy') loadAcademy();
}

// ── AVATAR MENU ───────────────────────────────────────────────
function toggleAvatarMenu() {
  document.getElementById('avatar-menu').classList.toggle('hidden');
}
function closeAvatarMenu() {
  document.getElementById('avatar-menu').classList.add('hidden');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.avatar-wrap')) closeAvatarMenu();
});

// ── INIT ─────────────────────────────────────────────────────
async function initApp() {
  await loadDashboard();
}

async function loadDashboard() {
  // KPIs
  const s = await fetch('/api/portfolio/summary').then(r => r.json());
  document.getElementById('kpi-total').textContent = EUR(s.totalValue);
  const dayEl = document.getElementById('kpi-day');
  dayEl.textContent = `${PCT(s.dayChangePercent)} oggi (${EUR(s.dayChange)})`;
  dayEl.className = 'kpi-sub ' + (s.dayChange >= 0 ? 'green' : 'red');
  document.getElementById('kpi-invested').textContent = EUR(s.invested);
  const plEl = document.getElementById('kpi-pl');
  plEl.textContent = EUR(s.pl);
  plEl.className = 'kpi-value ' + (s.pl >= 0 ? 'green' : 'red');
  const plpEl = document.getElementById('kpi-plp');
  plpEl.textContent = PCT(s.plPercent);
  plpEl.className = 'kpi-sub ' + (s.plPercent >= 0 ? 'green' : 'red');

  // Portfolio chart
  const hist = await fetch('/api/portfolio/history').then(r => r.json());
  state.portfolioHistory = hist;
  renderPortfolioChart(hist.slice(-12));

  // Holdings
  const holdings = await fetch('/api/portfolio/holdings').then(r => r.json());
  renderHoldings(holdings);

  // Allocations
  const asset = await fetch('/api/portfolio/allocation/asset').then(r => r.json());
  renderDonut('alloc-chart', asset, 'alloc-legend');
  const geo = await fetch('/api/portfolio/allocation/geo').then(r => r.json());
  renderDonut('geo-chart', geo, 'geo-legend', COLORS.slice(2));

  // Correlation
  const corr = await fetch('/api/portfolio/correlation').then(r => r.json());
  renderCorrelation(corr);
}

// ── PORTFOLIO CHART ───────────────────────────────────────────
function renderPortfolioChart(data) {
  const ctx = document.getElementById('portfolio-chart');
  if (state.charts.portfolio) state.charts.portfolio.destroy();
  state.charts.portfolio = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [
        { label: 'Portafoglio', data: data.map(d => d.portfolio), borderColor: '#0F7B3F', backgroundColor: 'rgba(15,123,63,0.08)', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0 },
        { label: 'Benchmark', data: data.map(d => d.benchmark), borderColor: '#1E5AA0', borderWidth: 1.5, borderDash: [4,3], fill: false, tension: 0.4, pointRadius: 0 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${EUR(ctx.raw)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
        y: { ticks: { callback: v => `€${(v/1000).toFixed(0)}k`, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
      }
    }
  });
}

function setTimeframe(months, btn) {
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPortfolioChart(state.portfolioHistory.slice(-months));
}

// ── DONUT ─────────────────────────────────────────────────────
function renderDonut(canvasId, data, legendId, colors = COLORS) {
  const ctx = document.getElementById(canvasId);
  const id = canvasId.replace('-','_');
  if (state.charts[id]) state.charts[id].destroy();
  state.charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.name),
      datasets: [{ data: data.map(d => d.value), backgroundColor: data.map((d,i) => d.color || colors[i % colors.length]), borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}%` } } }, cutout: '62%' }
  });
  const legend = document.getElementById(legendId);
  legend.innerHTML = data.map((d,i) => `<div class="legend-item"><div class="legend-dot" style="background:${d.color||colors[i%colors.length]}"></div><span>${d.name} (${d.value}%)</span></div>`).join('');
}

// ── HOLDINGS ─────────────────────────────────────────────────
function renderHoldings(holdings) {
  const tbody = document.getElementById('holdings-body');
  tbody.innerHTML = holdings.map(h => {
    const plClass = h.pl >= 0 ? 'green' : 'red';
    return `<tr>
      <td><span class="ticker-badge">${h.ticker}</span></td>
      <td>${h.name}</td>
      <td>${h.qty}</td>
      <td>${EUR(h.price)}</td>
      <td><strong>${EUR(h.value)}</strong></td>
      <td>${h.weight}%</td>
      <td class="${plClass}">${EUR(h.pl)} (${PCT(h.plPct)})</td>
      <td>${h.ter}%</td>
    </tr>`;
  }).join('');
}

// ── CORRELATION MATRIX ────────────────────────────────────────
function renderCorrelation(matrix) {
  const tickers = matrix.map(r => r.etf);
  function getCorrColor(v) {
    if (v >= 0.8) return '#fee2e2';
    if (v >= 0.5) return '#fef9c3';
    if (v >= 0.2) return '#f0fdf4';
    return '#eff6ff';
  }
  let html = '<table class="corr-table"><thead><tr><th></th>';
  tickers.forEach(t => { html += `<th>${t}</th>`; });
  html += '</tr></thead><tbody>';
  matrix.forEach(row => {
    html += `<tr><th>${row.etf}</th>`;
    tickers.forEach(t => {
      const v = row[t];
      html += `<td style="background:${getCorrColor(v)}">${v.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('corr-matrix').innerHTML = html;
}

// ── ETF SEARCH ────────────────────────────────────────────────
async function loadETFs() {
  const res = await fetch('/api/etfs');
  state.etfList = await res.json();
  renderETFTable(state.etfList);
}

function searchETFs() {
  clearTimeout(state.etfSearchDebounce);
  state.etfSearchDebounce = setTimeout(async () => {
    const q = document.getElementById('etf-search').value;
    const asset = document.getElementById('etf-filter-asset').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (asset) params.set('asset', asset);
    const res = await fetch('/api/etfs?' + params);
    const list = await res.json();
    renderETFTable(list);
  }, 250);
}

function renderETFTable(list) {
  const tbody = document.getElementById('etf-results');
  tbody.innerHTML = list.map(e => {
    const chgClass = e.chg1d >= 0 ? 'green' : 'red';
    const stars = '★'.repeat(e.rating) + '☆'.repeat(5 - e.rating);
    return `<tr class="clickable" onclick="showETFDetail('${e.ticker}')">
      <td><span class="ticker-badge">${e.ticker}</span></td>
      <td>${e.name}</td>
      <td>${e.issuer}</td>
      <td>${e.ter}%</td>
      <td>${NUM(e.aum)}</td>
      <td>${EUR(e.price)}</td>
      <td class="${chgClass}">${PCT(e.chg1d)}</td>
      <td class="${e.chg1y >= 0 ? 'green' : 'red'}">${PCT(e.chg1y)}</td>
      <td class="stars">${stars}</td>
    </tr>`;
  }).join('');
}

async function showETFDetail(ticker) {
  navigate('etf-detail');
  document.getElementById('main-nav').querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const data = await fetch(`/api/etfs/${ticker}`).then(r => r.json());
  const chgClass = data.chg1d >= 0 ? 'green' : 'red';
  document.getElementById('etf-detail-content').innerHTML = `
    <div class="etf-detail-header">
      <h2><span class="ticker-badge" style="font-size:18px;padding:4px 12px">${data.ticker}</span> ${data.name}</h2>
      <p style="margin-top:6px;color:#4B5768">${data.issuer} · ${data.asset} · ${data.region}</p>
      <p style="font-size:24px;font-weight:700;color:#0A2540;margin-top:10px">${EUR(data.price)} <span class="${chgClass}" style="font-size:14px">${PCT(data.chg1d)} oggi</span></p>
    </div>
    <div class="chart-card">
      <div class="etf-meta-grid">
        <div class="etf-meta-item"><div class="etf-meta-label">TER</div><div class="etf-meta-value">${data.ter}%</div></div>
        <div class="etf-meta-item"><div class="etf-meta-label">AUM</div><div class="etf-meta-value">€${NUM(data.aum)}M</div></div>
        <div class="etf-meta-item"><div class="etf-meta-label">1 Anno</div><div class="etf-meta-value ${data.chg1y>=0?'green':'red'}">${PCT(data.chg1y)}</div></div>
        <div class="etf-meta-item"><div class="etf-meta-label">5 Anni</div><div class="etf-meta-value ${data.chg5y>=0?'green':'red'}">${PCT(data.chg5y)}</div></div>
        <div class="etf-meta-item"><div class="etf-meta-label">Replicazione</div><div class="etf-meta-value">${data.replication}</div></div>
        <div class="etf-meta-item"><div class="etf-meta-label">Distribuzione</div><div class="etf-meta-value">${data.distribution}</div></div>
        <div class="etf-meta-item"><div class="etf-meta-label">Domicilio</div><div class="etf-meta-value">${data.domicile}</div></div>
        <div class="etf-meta-item"><div class="etf-meta-label">ISIN</div><div class="etf-meta-value" style="font-size:12px">${data.isin}</div></div>
      </div>
    </div>`;

  // Price chart
  const card = document.getElementById('etf-chart-card');
  card.style.display = 'block';
  if (state.etfPriceChart) state.etfPriceChart.destroy();
  state.etfPriceChart = new Chart(document.getElementById('etf-price-chart'), {
    type: 'line',
    data: {
      labels: data.priceHistory.map(d => d.month),
      datasets: [{ label: ticker, data: data.priceHistory.map(d => d.price), borderColor: '#0A2540', backgroundColor: 'rgba(10,37,64,0.07)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => EUR(c.raw) } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { ticks: { callback: v => EUR(v) } } } }
  });
}

// ── MODELS ───────────────────────────────────────────────────
async function loadModels() {
  const models = await fetch('/api/models').then(r => r.json());
  const riskClass = { 1: 'risk-1', 2: 'risk-2', 3: 'risk-3', 4: 'risk-4' };
  document.getElementById('models-grid').innerHTML = models.map(m => `
    <div class="model-card" onclick="showModelDetail('${m.id}')">
      <span class="risk-pill ${riskClass[m.riskLevel]||'risk-3'}">${m.risk}</span>
      <h3>${m.name}</h3>
      <p class="model-author">di ${m.author}</p>
      <p class="model-philosophy">${m.philosophy}</p>
      <div class="model-stats">
        <div class="model-stat"><div class="val green">+${m.cagr}%</div><div class="lbl">CAGR</div></div>
        <div class="model-stat"><div class="val red">${m.maxDD}%</div><div class="lbl">Max DD</div></div>
        <div class="model-stat"><div class="val">${m.sharpe}</div><div class="lbl">Sharpe</div></div>
      </div>
    </div>`).join('');
}

async function showModelDetail(id) {
  const model = await fetch(`/api/models`).then(r => r.json()).then(list => list.find(m => m.id === id));
  if (!model) return;
  navigate('model-detail');
  document.getElementById('main-nav').querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('model-detail-content').innerHTML = `
    <div class="chart-card">
      <h2 style="font-size:22px;font-weight:700;color:#0A2540;margin-bottom:6px">${model.name}</h2>
      <p style="color:#8A94A6;margin-bottom:12px">di ${model.author}</p>
      <p style="color:#4B5768;line-height:1.6;margin-bottom:16px">${model.philosophy}</p>
      <div class="model-stats" style="gap:24px">
        <div class="model-stat"><div class="val green" style="font-size:20px">+${model.cagr}%</div><div class="lbl">CAGR storico</div></div>
        <div class="model-stat"><div class="val red" style="font-size:20px">${model.maxDD}%</div><div class="lbl">Max drawdown</div></div>
        <div class="model-stat"><div class="val" style="font-size:20px">${model.sharpe}</div><div class="lbl">Sharpe ratio</div></div>
      </div>
    </div>`;

  const card = document.getElementById('model-chart-card');
  card.style.display = 'block';
  if (state.modelAllocChart) state.modelAllocChart.destroy();
  state.modelAllocChart = new Chart(document.getElementById('model-alloc-chart'), {
    type: 'doughnut',
    data: {
      labels: model.allocation.map(a => `${a.name} (${a.value}%)`),
      datasets: [{ data: model.allocation.map(a => a.value), backgroundColor: model.allocation.map(a => a.color), borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 12 }, padding: 12 } } }, cutout: '55%' }
  });
}

// ── SIMULATIONS ───────────────────────────────────────────────
async function loadBacktest() {
  const data = await fetch('/api/backtest').then(r => r.json());
  if (state.backtestChart) state.backtestChart.destroy();
  state.backtestChart = new Chart(document.getElementById('backtest-chart'), {
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [
        { label: 'Il mio portafoglio', data: data.map(d => d.myPortfolio), borderColor: '#0F7B3F', borderWidth: 2.5, fill: false, tension: 0.4, pointRadius: 0 },
        { label: 'All-Weather', data: data.map(d => d.allWeather), borderColor: '#1E5AA0', borderWidth: 2, borderDash: [4,3], fill: false, tension: 0.4, pointRadius: 0 },
        { label: 'Benchmark', data: data.map(d => d.benchmark), borderColor: '#B8860B', borderWidth: 1.5, borderDash: [2,4], fill: false, tension: 0.4, pointRadius: 0 },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font: { size: 12 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${EUR(c.raw)}` } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }, y: { ticks: { callback: v => `€${(v/1000).toFixed(0)}k` } } } }
  });
}

async function runMonteCarlo() {
  const body = {
    capital: parseFloat(document.getElementById('sim-capital').value),
    monthly: parseFloat(document.getElementById('sim-monthly').value),
    years: parseInt(document.getElementById('sim-years').value),
    cagr: parseFloat(document.getElementById('sim-cagr').value),
    vol: parseFloat(document.getElementById('sim-vol').value),
  };
  const res = await fetch('/api/simulation/montecarlo', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  const labels = data.p50.map((_, i) => i === 0 ? 'Oggi' : (i % 12 === 0 ? `Anno ${i/12}` : ''));
  if (state.mcChart) state.mcChart.destroy();
  state.mcChart = new Chart(document.getElementById('mc-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Ottimista (90°)', data: data.p90, borderColor: '#0F7B3F', backgroundColor: 'rgba(15,123,63,0.08)', fill: '+1', borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
        { label: 'Mediano (50°)', data: data.p50, borderColor: '#0A2540', fill: false, borderWidth: 2.5, pointRadius: 0, tension: 0.4 },
        { label: 'Pessimista (10°)', data: data.p10, borderColor: '#B42318', backgroundColor: 'rgba(180,35,24,0.06)', fill: false, borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font: { size: 12 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${EUR(c.raw)}` } } }, scales: { x: { grid: { display: false }, ticks: { callback: (v, i) => labels[i] || '', maxTicksLimit: body.years + 1 } }, y: { ticks: { callback: v => v >= 1000000 ? `€${(v/1000000).toFixed(1)}M` : `€${(v/1000).toFixed(0)}k` } } } }
  });
  const last = data.p50.length - 1;
  document.getElementById('mc-p10').textContent = EUR(data.p10[last]);
  document.getElementById('mc-p50').textContent = EUR(data.p50[last]);
  document.getElementById('mc-p90').textContent = EUR(data.p90[last]);
  document.getElementById('mc-results').classList.remove('hidden');
}

// ── ALERTS ───────────────────────────────────────────────────
async function loadAlerts() {
  const alerts = await fetch('/api/alerts').then(r => r.json());
  const icons = { down: '📉', up: '📈', calendar: '📅' };
  document.getElementById('alerts-list').innerHTML = alerts.map(a => `
    <div class="alert-item">
      <div class="alert-icon">${icons[a.type] || '🔔'}</div>
      <div class="alert-body">
        <h4>${a.etf}</h4>
        <p>${a.message}</p>
        <p class="alert-time">${a.time}</p>
      </div>
      <span class="alert-status ${a.active ? 'on' : 'off'}">${a.active ? 'Attivo' : 'Inattivo'}</span>
    </div>`).join('');
}

// ── COMMUNITY ─────────────────────────────────────────────────
async function loadCommunity() {
  const posts = await fetch('/api/community').then(r => r.json());
  document.getElementById('community-list').innerHTML = posts.map(p => `
    <div class="post-card">
      <div class="post-header">
        <div class="post-avatar">${p.avatar}</div>
        <div><div class="post-user">${p.user}</div><div class="post-time">${p.time}</div></div>
      </div>
      <p class="post-content">${p.content}</p>
      <div class="post-actions">
        <button class="post-action">❤️ ${p.likes}</button>
        <button class="post-action">💬 ${p.comments}</button>
        <button class="post-action">↗️ Condividi</button>
      </div>
    </div>`).join('');
}

// ── ACADEMY ───────────────────────────────────────────────────
async function loadAcademy() {
  const courses = await fetch('/api/academy').then(r => r.json());
  document.getElementById('academy-list').innerHTML = courses.map(c => `
    <div class="course-card">
      <span class="course-level level-${c.level}">${c.level}</span>
      <h4>${c.title}</h4>
      <div class="course-meta"><span>📖 ${c.lessons} lezioni</span><span>⏱ ${c.duration}</span></div>
    </div>`).join('');
}
