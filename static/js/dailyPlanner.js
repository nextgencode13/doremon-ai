/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
function _todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function _timeSlots() {
  const slots = [];
  for (let h = 6; h <= 23; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

function _renderTaskList(container, items, label) {
  container.innerHTML = `<div style="font-size:0.75em;color:var(--color-muted);font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${label}</div>`;
  if (!items.length) {
    container.innerHTML += `<div style="color:var(--color-muted);font-size:0.85em;padding:8px 0;">Nothing scheduled</div>`;
    return;
  }
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'admin-card';
    div.style.cssText = 'margin:0 0 8px;padding:10px 12px;';
    const time = item.scheduled_time || item.due_date || '';
    div.innerHTML = `
      <div style="font-size:0.85em;font-weight:600;margin-bottom:2px;">${item.name || item.title}</div>
      ${time ? `<div style="font-size:0.75em;color:var(--color-muted);">${time}</div>` : ''}
    `;
    container.appendChild(div);
  }
}

const dailyPlannerModule = {
  async open() {
    const m = document.getElementById('daily-planner-modal');
    if (!m) return;
    m.classList.remove('hidden');
    await this.load();
  },

  close() {
    document.getElementById('daily-planner-modal')?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById('daily-planner-modal');
    return m && !m.classList.contains('hidden');
  },

  async load() {
    const m = document.getElementById('daily-planner-modal');
    if (!m) return;

    m.querySelector('#planner-date-label').textContent = _todayLabel();

    try {
      const res = await fetch('/api/tasks/today');
      if (!res.ok) throw new Error('failed');
      const { tasks, notes } = await res.json();

      _renderTaskList(m.querySelector('#planner-tasks-col'), tasks, 'Scheduled Tasks');
      _renderTaskList(m.querySelector('#planner-notes-col'), notes, 'Due Today');

      // "Plan my day" button wires into active chat
      m.querySelector('#planner-plan-btn').onclick = () => {
        const allItems = [...tasks, ...notes];
        const summary = allItems.map(i => `- ${i.name || i.title}`).join('\n');
        const msg = `Here's what I have today:\n${summary || 'Nothing scheduled yet.'}\n\nPlease help me plan my day — suggest a time-blocked schedule.`;
        const input = document.getElementById('user-input');
        if (input) {
          input.value = msg;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
          this.close();
        }
      };
    } catch (e) {
      console.error('Daily planner load failed:', e);
    }
  },

  init() {
    const m = document.getElementById('daily-planner-modal');
    if (!m) return;
    document.getElementById('close-planner-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });
  },
};

export default dailyPlannerModule;
