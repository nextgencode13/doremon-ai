/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
let _currentNoteId = null;
let _saveTimer = null;
let _calendarEntries = {};

function _formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _scheduledSave(noteId, content) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(() => {});
  }, 2000);
}

async function _loadEntry(dateStr) {
  const m = document.getElementById('journal-modal');
  if (!m) return;

  const isToday = dateStr === _todayStr();
  const endpoint = isToday ? '/api/notes/journal/today' : null;

  // For past dates, look up from calendar entries
  if (!isToday && _calendarEntries[dateStr]) {
    const res = await fetch(`/api/notes/${_calendarEntries[dateStr]}`);
    if (res.ok) {
      const note = await res.json();
      _currentNoteId = note.id;
      m.querySelector('#journal-date-label').textContent = _formatDateLabel(dateStr);
      m.querySelector('#journal-editor').value = note.content || '';
      m.querySelector('#journal-save-indicator').textContent = '';
      return;
    }
  }

  if (!endpoint) {
    m.querySelector('#journal-editor').value = '';
    m.querySelector('#journal-date-label').textContent = _formatDateLabel(dateStr) + ' (no entry)';
    _currentNoteId = null;
    return;
  }

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('failed');
    const note = await res.json();
    _currentNoteId = note.id;
    m.querySelector('#journal-date-label').textContent = _formatDateLabel(dateStr);
    m.querySelector('#journal-editor').value = note.content || '';
    m.querySelector('#journal-save-indicator').textContent = '';
    // Update calendar dots
    _calendarEntries[dateStr] = note.id;
  } catch (e) {
    console.error('Journal load failed:', e);
  }
}

async function _loadCalendar() {
  try {
    const res = await fetch('/api/notes/journal/calendar');
    if (!res.ok) return;
    const { entries } = await res.json();
    _calendarEntries = entries || {};
  } catch (_) {}
}

const journalModule = {
  _currentDate: _todayStr(),

  async open() {
    const m = document.getElementById('journal-modal');
    if (!m) return;
    m.classList.remove('hidden');
    this._currentDate = _todayStr();
    await _loadCalendar();
    await _loadEntry(this._currentDate);
  },

  close() {
    document.getElementById('journal-modal')?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById('journal-modal');
    return m && !m.classList.contains('hidden');
  },

  navigate(deltaDays) {
    const d = new Date(this._currentDate + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate > _todayStr()) return; // can't go to future
    this._currentDate = newDate;
    _loadEntry(this._currentDate);
  },

  async getAIPrompt() {
    const m = document.getElementById('journal-modal');
    if (!m) return;
    const btn = m.querySelector('#journal-prompt-btn');
    if (btn) btn.textContent = '…';
    try {
      const res = await fetch('/api/notes/journal/prompt', { method: 'POST' });
      if (res.ok) {
        const { prompt } = await res.json();
        const editor = m.querySelector('#journal-editor');
        if (editor) {
          editor.value = (editor.value ? editor.value + '\n\n' : '') + prompt + '\n';
          editor.focus();
          if (_currentNoteId) _scheduledSave(_currentNoteId, editor.value);
        }
      }
    } catch (_) {}
    if (btn) btn.textContent = '💡 Get a prompt';
  },

  downloadMarkdown() {
    const m = document.getElementById('journal-modal');
    if (!m) return;
    const content = m.querySelector('#journal-editor')?.value || '';
    const dateStr = this._currentDate;
    const blob = new Blob([`# Journal — ${dateStr}\n\n${content}`], { type: 'text/markdown' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `journal-${dateStr}.md`,
    });
    a.click();
  },

  init() {
    const m = document.getElementById('journal-modal');
    if (!m) return;

    document.getElementById('close-journal-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });

    m.querySelector('#journal-prev-btn')?.addEventListener('click', () => this.navigate(-1));
    m.querySelector('#journal-next-btn')?.addEventListener('click', () => this.navigate(1));
    m.querySelector('#journal-today-btn')?.addEventListener('click', () => {
      this._currentDate = _todayStr();
      _loadEntry(this._currentDate);
    });
    m.querySelector('#journal-prompt-btn')?.addEventListener('click', () => this.getAIPrompt());
    m.querySelector('#journal-download-btn')?.addEventListener('click', () => this.downloadMarkdown());

    m.querySelector('#journal-editor')?.addEventListener('input', e => {
      if (_currentNoteId) {
        m.querySelector('#journal-save-indicator').textContent = 'Saving…';
        _scheduledSave(_currentNoteId, e.target.value);
        setTimeout(() => {
          const ind = m.querySelector('#journal-save-indicator');
          if (ind && ind.textContent === 'Saving…') ind.textContent = '✓ Saved';
        }, 2500);
      }
    });
  },
};

export default journalModule;
