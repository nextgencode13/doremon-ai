/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
let _charts = {};

function _destroyCharts() {
  for (const key of Object.keys(_charts)) {
    try { _charts[key].destroy(); } catch (_) {}
  }
  _charts = {};
}

function _renderHeatmap(svgEl, activity) {
  svgEl.innerHTML = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeks = 52;
  const cellSize = 10;
  const gap = 2;
  const cols = weeks;
  const w = cols * (cellSize + gap);
  const h = 7 * (cellSize + gap);
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.setAttribute('width', w);
  svgEl.setAttribute('height', h);
  svgEl.style.maxWidth = '100%';

  const maxVal = Math.max(1, ...Object.values(activity));

  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  let col = 0, row = start.getDay();
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const count = activity[dateStr] || 0;
    const intensity = count / maxVal;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', col * (cellSize + gap));
    rect.setAttribute('y', row * (cellSize + gap));
    rect.setAttribute('width', cellSize);
    rect.setAttribute('height', cellSize);
    rect.setAttribute('rx', 2);
    rect.setAttribute('fill', count > 0 ? `rgba(0,170,255,${0.2 + intensity * 0.8})` : 'transparent');
    rect.setAttribute('stroke', 'var(--border)');
    rect.setAttribute('stroke-width', '0.5');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${dateStr}: ${count} message${count !== 1 ? 's' : ''}`;
    rect.appendChild(title);
    svgEl.appendChild(rect);

    row++;
    if (row >= 7) { row = 0; col++; }
  }
}

function _ensureChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
  s.onload = cb;
  document.head.appendChild(s);
}

function _renderCharts(m, summary, models) {
  _ensureChartJs(() => {
    // Model usage bar chart
    const modelCanvas = m.querySelector('#analytics-model-chart');
    if (modelCanvas && models.models.length > 0) {
      if (_charts.model) _charts.model.destroy();
      _charts.model = new Chart(modelCanvas, {
        type: 'bar',
        data: {
          labels: models.models.slice(0, 7).map(m => m.model.split('/').pop()),
          datasets: [{
            label: 'Messages',
            data: models.models.slice(0, 7).map(m => m.count),
            backgroundColor: 'rgba(0,170,255,0.6)',
            borderColor: 'rgba(0,170,255,1)',
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'var(--color-muted)' }, grid: { color: 'var(--border)' } },
            y: { ticks: { color: 'var(--fg)', font: { size: 11 } }, grid: { display: false } },
          },
        },
      });
    }

    // Task completion donut
    const taskCanvas = m.querySelector('#analytics-task-chart');
    if (taskCanvas && summary.total_tasks > 0) {
      if (_charts.task) _charts.task.destroy();
      _charts.task = new Chart(taskCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'Active'],
          datasets: [{
            data: [summary.completed_tasks, summary.total_tasks - summary.completed_tasks],
            backgroundColor: ['rgba(80,250,123,0.7)', 'rgba(255,255,255,0.1)'],
            borderColor: ['#50fa7b', 'var(--border)'],
            borderWidth: 1,
          }],
        },
        options: {
          cutout: '70%',
          responsive: true,
          plugins: { legend: { labels: { color: 'var(--fg)', font: { size: 11 } } } },
        },
      });
    }
  });
}

const analyticsModule = {
  _range: 90,

  async open() {
    const m = document.getElementById('analytics-modal');
    if (!m) return;
    m.classList.remove('hidden');
    await this.load();
  },

  close() {
    _destroyCharts();
    document.getElementById('analytics-modal')?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById('analytics-modal');
    return m && !m.classList.contains('hidden');
  },

  async load() {
    const m = document.getElementById('analytics-modal');
    if (!m) return;

    try {
      const [summaryRes, activityRes, modelsRes] = await Promise.all([
        fetch('/api/analytics/summary'),
        fetch(`/api/analytics/activity?days=${this._range}`),
        fetch('/api/analytics/models'),
      ]);
      const summary = await summaryRes.json();
      const { activity } = await activityRes.json();
      const models = await modelsRes.json();

      // Summary stats
      m.querySelector('#analytics-total-chats').textContent = summary.total_sessions ?? 0;
      m.querySelector('#analytics-total-messages').textContent = summary.total_messages ?? 0;
      m.querySelector('#analytics-active-days').textContent = summary.active_days ?? 0;
      m.querySelector('#analytics-task-rate').textContent = (summary.task_completion_rate ?? 0) + '%';

      // Heatmap
      _renderHeatmap(m.querySelector('#analytics-heatmap'), activity);

      _renderCharts(m, summary, models);
    } catch (e) { console.error('Analytics load failed:', e); }
  },

  async exportCsv() {
    window.location.href = '/api/analytics/export';
  },

  init() {
    const m = document.getElementById('analytics-modal');
    if (!m) return;
    document.getElementById('close-analytics-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });
    m.querySelector('#analytics-export-btn')?.addEventListener('click', () => this.exportCsv());

    m.querySelectorAll('.analytics-range-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this._range = parseInt(btn.dataset.days);
        m.querySelectorAll('.analytics-range-btn').forEach(b => {
          b.style.background = b === btn ? 'var(--color-accent,#00aaff)' : 'transparent';
          b.style.color = b === btn ? '#fff' : 'var(--fg)';
          b.style.borderColor = b === btn ? 'transparent' : 'var(--border)';
        });
        await this.load();
      });
    });
  },
};

export default analyticsModule;
