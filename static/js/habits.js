/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
let _habits = [];
let _activeHabitId = null;
let _logs = {};      // habitId → [{date, completed}]
let _streaks = {};   // habitId → {current, longest, total}

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _dateRange(weeks = 52) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function _renderHeatmap(svgEl, logs, color) {
  svgEl.innerHTML = '';
  const dates = _dateRange(52);
  const doneSet = new Set((logs || []).filter(l => l.completed).map(l => l.date));

  const cellSize = 11;
  const gap = 2;
  const cols = Math.ceil(dates.length / 7);
  const w = cols * (cellSize + gap);
  const h = 7 * (cellSize + gap);
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.setAttribute('width', w);
  svgEl.setAttribute('height', h);
  svgEl.style.maxWidth = '100%';

  let colIdx = 0, rowIdx = new Date(dates[0]).getDay(); // start at correct weekday
  for (const dateStr of dates) {
    const done = doneSet.has(dateStr);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', colIdx * (cellSize + gap));
    rect.setAttribute('y', rowIdx * (cellSize + gap));
    rect.setAttribute('width', cellSize);
    rect.setAttribute('height', cellSize);
    rect.setAttribute('rx', 2);
    rect.setAttribute('fill', done ? color : 'color-mix(in srgb,' + color + ' 10%, transparent)');
    rect.setAttribute('stroke', done ? color : 'var(--border)');
    rect.setAttribute('stroke-width', '0.5');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${dateStr} — ${done ? '✓ Done' : 'Not logged'}`;
    rect.appendChild(title);

    rect.style.cursor = 'pointer';
    rect.dataset.date = dateStr;
    svgEl.appendChild(rect);

    rowIdx++;
    if (rowIdx >= 7) { rowIdx = 0; colIdx++; }
  }
}

async function _loadHabit(habitId) {
  if (!_logs[habitId]) {
    const res = await fetch(`/api/habits/${habitId}/logs`);
    if (res.ok) {
      const data = await res.json();
      _logs[habitId] = data.logs || [];
    }
  }
  if (!_streaks[habitId]) {
    const res = await fetch(`/api/habits/${habitId}/streak`);
    if (res.ok) {
      _streaks[habitId] = await res.json();
    }
  }
}

function _renderPanel(m) {
  const habit = _habits.find(h => h.id === _activeHabitId);
  if (!habit) return;

  const logs = _logs[_activeHabitId] || [];
  const streak = _streaks[_activeHabitId] || { current: 0, longest: 0, total: 0 };

  const svg = m.querySelector('#habit-heatmap-svg');
  if (svg) _renderHeatmap(svg, logs, habit.color || '#4CAF50');

  // Wire cell click → toggle
  svg?.querySelectorAll('rect[data-date]').forEach(rect => {
    rect.addEventListener('click', async () => {
      const dateStr = rect.dataset.date;
      const res = await fetch(`/api/habits/${_activeHabitId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      if (res.ok) {
        const { completed } = await res.json();
        const existing = _logs[_activeHabitId] || [];
        const idx = existing.findIndex(l => l.date === dateStr);
        if (idx >= 0) existing.splice(idx, 1);
        else existing.push({ date: dateStr, completed });
        _logs[_activeHabitId] = existing;
        delete _streaks[_activeHabitId];
        await _loadHabit(_activeHabitId);
        _renderPanel(m);
      }
    });
  });

  m.querySelector('#habit-streak-current').textContent = streak.current;
  m.querySelector('#habit-streak-longest').textContent = streak.longest;
  m.querySelector('#habit-streak-total').textContent = streak.total;
  m.querySelector('#habit-panel-title').textContent = habit.icon + ' ' + habit.name;
}

function _renderTabs(m) {
  const container = m.querySelector('#habit-tabs');
  if (!container) return;
  container.innerHTML = '';
  for (const h of _habits) {
    const btn = document.createElement('button');
    btn.textContent = h.icon + ' ' + h.name;
    btn.style.cssText = `padding:5px 12px;border-radius:6px;border:1px solid ${h.id === _activeHabitId ? h.color : 'var(--border)'};background:${h.id === _activeHabitId ? h.color + '33' : 'transparent'};color:var(--fg);cursor:pointer;font-size:0.82em;`;
    btn.onclick = async () => {
      _activeHabitId = h.id;
      await _loadHabit(h.id);
      _renderTabs(m);
      _renderPanel(m);
    };
    container.appendChild(btn);
  }
}

const habitsModule = {
  async open() {
    const m = document.getElementById('habits-modal');
    if (!m) return;
    m.classList.remove('hidden');
    await this.load();
  },

  close() {
    document.getElementById('habits-modal')?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById('habits-modal');
    return m && !m.classList.contains('hidden');
  },

  async load() {
    const m = document.getElementById('habits-modal');
    if (!m) return;
    try {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('failed');
      const { habits } = await res.json();
      _habits = habits;
      if (_habits.length && !_habits.find(h => h.id === _activeHabitId)) {
        _activeHabitId = _habits[0].id;
      }
      if (_activeHabitId) await _loadHabit(_activeHabitId);
      _renderTabs(m);
      _renderPanel(m);
    } catch (e) { console.error('Habits load failed:', e); }
  },

  async createHabit() {
    const m = document.getElementById('habits-modal');
    const name = m?.querySelector('#new-habit-name')?.value?.trim();
    const color = m?.querySelector('#new-habit-color')?.value || '#4CAF50';
    const icon = m?.querySelector('#new-habit-icon')?.value?.trim() || '✓';
    if (!name) return;
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, icon }),
    });
    if (res.ok) {
      m.querySelector('#new-habit-name').value = '';
      await this.load();
    }
  },

  init() {
    const m = document.getElementById('habits-modal');
    if (!m) return;
    document.getElementById('close-habits-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });
    m.querySelector('#new-habit-save-btn')?.addEventListener('click', () => this.createHabit());
  },
};

export default habitsModule;
