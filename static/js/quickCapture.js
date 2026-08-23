/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
const URL_RE = /^https?:\/\//i;

function _detectType(text) {
  if (URL_RE.test(text.trim())) return 'link';
  if (text.trimStart().startsWith('[ ]') || text.trimStart().startsWith('[]')) return 'checklist';
  return 'note';
}

function _typeLabel(t) {
  return { link: '🔗 Link', checklist: '✅ Task', note: '📝 Note' }[t] ?? 'Note';
}

const quickCaptureModule = {
  init() {
    const modal = document.getElementById('quick-capture-modal');
    const input = document.getElementById('qc-input');
    const toast = document.getElementById('qc-toast');
    const typeEl = document.getElementById('qc-type-indicator');
    if (!modal) return;

    document.getElementById('close-qc-modal')?.addEventListener('click', () => this.close());
    modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });

    input?.addEventListener('input', () => {
      const t = _detectType(input.value);
      if (typeEl) typeEl.textContent = _typeLabel(t);
    });

    input?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await this.save(input.value);
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });
  },

  open() {
    const modal = document.getElementById('quick-capture-modal');
    const input = document.getElementById('qc-input');
    const toast = document.getElementById('qc-toast');
    const typeEl = document.getElementById('qc-type-indicator');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (input) { input.value = ''; input.focus(); }
    if (toast) toast.style.display = 'none';
    if (typeEl) typeEl.textContent = '📝 Note';
  },

  close() {
    document.getElementById('quick-capture-modal')?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById('quick-capture-modal');
    return m && !m.classList.contains('hidden');
  },

  async save(text) {
    const trimmed = text?.trim();
    if (!trimmed) return;

    const type = _detectType(trimmed);
    const body = {
      title: type === 'link' ? trimmed.slice(0, 80) : '',
      content: type === 'link' ? '' : trimmed,
      note_type: type === 'checklist' ? 'checklist' : 'note',
      label: 'inbox',
      source: 'user',
    };

    if (type === 'checklist') {
      body.items = JSON.stringify([{ text: trimmed.replace(/^\[[ x]?\]\s*/i, '').trim(), done: false }]);
      body.content = '';
    }

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');

      const toast = document.getElementById('qc-toast');
      const input = document.getElementById('qc-input');
      if (input) input.value = '';
      if (toast) { toast.style.display = 'block'; setTimeout(() => { toast.style.display = 'none'; this.close(); }, 900); }
    } catch (err) {
      console.error('Quick capture save failed:', err);
    }
  },
};

export default quickCaptureModule;
