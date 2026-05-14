'use strict';

const el = id => document.getElementById(id);

let chart, candleSeries, volumeSeries;
let currentDividends = [];
let activeMonths = 12;

// ── Init chart ──────────────────────────────────────────────────────────────
function initChart() {
  chart = LightweightCharts.createChart(el('chart'), {
    layout: {
      background: { color: '#161b22' },
      textColor: '#d1d4dc',
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    },
    grid: {
      vertLines: { color: '#1e2330' },
      horzLines: { color: '#1e2330' },
    },
    rightPriceScale: { borderColor: '#2a2e39' },
    timeScale: {
      borderColor: '#2a2e39',
      timeVisible: true,
      fixLeftEdge: true,
      fixRightEdge: true,
    },
    crosshair: {
      vertLine: { color: '#4a4f5e', labelBackgroundColor: '#1c2230' },
      horzLine: { color: '#4a4f5e', labelBackgroundColor: '#1c2230' },
    },
    handleScroll: true,
    handleScale: true,
  });

  // Korean convention: red = up, blue = down
  candleSeries = chart.addCandlestickSeries({
    upColor: '#ef4444',
    downColor: '#1d4ed8',
    wickUpColor: '#ef4444',
    wickDownColor: '#1d4ed8',
    borderVisible: false,
  });

  volumeSeries = chart.addHistogramSeries({
    color: '#334155',
    priceFormat: { type: 'volume' },
    priceScaleId: '',
  });
  volumeSeries.priceScale().applyOptions({
    scaleMargins: { top: 0.82, bottom: 0 },
  });

  // Crosshair move → dividend tooltip
  chart.subscribeCrosshairMove(handleCrosshair);

  // Responsive
  new ResizeObserver(() => {
    chart.applyOptions({ width: el('chart').clientWidth });
  }).observe(el('chart'));
}

// ── Data loading ─────────────────────────────────────────────────────────────
function dateRange(months) {
  const end = new Date();
  const start = new Date();
  if (months === 0) {
    start.setFullYear(start.getFullYear() - 20);
  } else {
    start.setMonth(start.getMonth() - months);
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function loadChart(months) {
  activeMonths = months;
  showLoading(true);

  const { start, end } = dateRange(months);

  try {
    const res = await fetch(`/api/chart?start=${start}&end=${end}`);
    if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
    const data = await res.json();

    renderCandles(data.candles);
    renderVolume(data.candles);
    renderMarkers(data.dividends);
    renderHeader(data);
    renderTable(data.dividends, data.last_close);

    currentDividends = data.dividends;
  } catch (err) {
    showToast('데이터를 불러올 수 없습니다: ' + err.message);
  } finally {
    showLoading(false);
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderCandles(candles) {
  const mapped = candles.map(c => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  candleSeries.setData(mapped);
}

function renderVolume(candles) {
  const mapped = candles.map(c => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? '#7f1d1d' : '#1e3a5f',
  }));
  volumeSeries.setData(mapped);
}

function renderMarkers(dividends) {
  const markers = dividends.map(d => ({
    time: d.date,
    position: 'belowBar',
    color: '#22c55e',
    shape: 'arrowUp',
    text: `${d.amount.toLocaleString()}원`,
  }));
  candleSeries.setMarkers(markers);
}

function renderHeader(data) {
  el('etf-name').textContent = data.name;
  el('ticker').textContent = data.ticker;
  el('last-close').textContent = data.last_close
    ? data.last_close.toLocaleString('ko-KR') + '원'
    : '—';
  el('ttm-yield').textContent = data.ttm_yield != null
    ? data.ttm_yield.toFixed(2) + '%'
    : '—';
}

function renderTable(dividends, lastClose) {
  const tbody = el('div-tbody');
  if (!dividends.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty">분배금 데이터 없음</td></tr>';
    return;
  }

  const reversed = [...dividends].reverse();
  tbody.innerHTML = reversed.map(d => {
    const annualYield = lastClose > 0
      ? ((d.amount * 12) / lastClose * 100).toFixed(2) + '%'
      : '—';
    return `<tr>
      <td>${d.date}</td>
      <td>${d.amount.toLocaleString()}</td>
      <td class="yield-cell">${annualYield}</td>
    </tr>`;
  }).join('');
}

// ── Crosshair tooltip ────────────────────────────────────────────────────────
const divMap = {};

function buildDivMap(dividends) {
  Object.keys(divMap).forEach(k => delete divMap[k]);
  dividends.forEach(d => { divMap[d.date] = d.amount; });
}

function handleCrosshair(param) {
  const tooltip = el('tooltip');
  if (!param.time || !param.point) {
    tooltip.classList.add('hidden');
    return;
  }

  const dateStr = typeof param.time === 'string'
    ? param.time
    : new Date(param.time * 1000).toISOString().slice(0, 10);

  const amount = divMap[dateStr];
  if (!amount) {
    tooltip.classList.add('hidden');
    return;
  }

  const priceData = param.seriesData.get(candleSeries);
  const close = priceData ? priceData.close : null;
  const yieldStr = close ? ((amount * 12) / close * 100).toFixed(2) + '%' : '—';

  tooltip.innerHTML = `
    <div class="tooltip-title">분배금 지급일</div>
    <div class="tooltip-row"><span class="tooltip-label">날짜</span><span>${dateStr}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">분배금</span><span>${amount.toLocaleString()}원</span></div>
    <div class="tooltip-row"><span class="tooltip-label">연환산</span><span style="color:#22c55e">${yieldStr}</span></div>
  `;

  const chartBox = el('chart').getBoundingClientRect();
  const wrapBox = el('chart').parentElement.getBoundingClientRect();
  const x = param.point.x + 16;
  const y = param.point.y - 10;
  const tipW = 160;
  const adjustedX = x + tipW > el('chart').clientWidth ? x - tipW - 32 : x;

  tooltip.style.left = adjustedX + 'px';
  tooltip.style.top = y + 'px';
  tooltip.classList.remove('hidden');
}

// ── Toolbar ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const months = parseInt(btn.dataset.months, 10);
    loadChart(months).then(() => {
      buildDivMap(currentDividends);
    });
  });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 4000);
}

function showLoading(show) {
  el('loading').classList.toggle('hidden', !show);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
initChart();
loadChart(activeMonths).then(() => {
  buildDivMap(currentDividends);
});
