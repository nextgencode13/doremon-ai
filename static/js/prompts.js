/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
let _prompts = [];
let _activeTag = '';

async function _load() {
  try {
    const res = await fetch('/api/prompts');
    if (!res.ok) return;
    const data = await res.json();
    _prompts = data.prompts || [];
  } catch (e) { console.error('Prompts load failed:', e); }
}

function _tagsFromPrompts(prompts) {
  const set = new Set();
  for (const p of prompts) {
    (p.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => set.add(t));
  }
  return [...set].sort();
}

function _filterPrompts(prompts, tag) {
  if (!tag) return prompts;
  return prompts.filter(p => (p.tags || '').split(',').map(t => t.trim()).includes(tag));
}

function _varNames(body) {
  const matches = body.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

function _injectPrompt(body) {
  const vars = _varNames(body);
  if (vars.length === 0) {
    _pasteToChat(body);
    return;
  }
  // Show fill dialog
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:24px;min-width:320px;max-width:90vw;';
  box.innerHTML = `
    <h4 style="margin:0 0 16px;font-size:1em;">Fill variables</h4>
    ${vars.map(v => `
      <div style="margin-bottom:12px;">
        <label style="font-size:0.8em;color:var(--color-muted);display:block;margin-bottom:4px;">{{${v}}}</label>
        <input type="text" data-var="${v}" placeholder="${v}" style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--fg);font-size:0.9em;box-sizing:border-box;">
      </div>
    `).join('')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
      <button id="pf-cancel" style="padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;">Cancel</button>
      <button id="pf-inject" class="btn-primary" style="padding:6px 14px;">Inject</button>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.querySelector('[data-var]')?.focus();

  box.querySelector('#pf-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  box.querySelector('#pf-inject').onclick = () => {
    let filled = body;
    box.querySelectorAll('[data-var]').forEach(input => {
      filled = filled.replaceAll(`{{${input.dataset.var}}}`, input.value);
    });
    overlay.remove();
    _pasteToChat(filled);
  };
}

function _pasteToChat(text) {
  const input = document.getElementById('user-input');
  if (!input) return;
  input.value = (input.value ? input.value + '\n' : '') + text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  // Close the prompt modal
  promptsModule.close();
}

function _renderCards(container, prompts) {
  container.innerHTML = '';
  if (prompts.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--color-muted);padding:32px 16px;font-size:0.9em;">No prompts yet. Add one below!</div>';
    return;
  }
  for (const p of prompts) {
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.style.cssText = 'margin:0;cursor:default;transition:border-color 0.15s;';
    const tagChips = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean)
      .map(t => `<span style="font-size:0.7em;padding:2px 7px;border-radius:10px;background:color-mix(in srgb,var(--color-accent) 15%,transparent);color:var(--color-accent);">${t}</span>`)
      .join('');
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.title}</div>
          <div style="font-size:0.82em;color:var(--color-muted);white-space:pre-wrap;max-height:56px;overflow:hidden;">${p.body.slice(0, 120)}${p.body.length > 120 ? '…' : ''}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">${tagChips}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
          <button class="prompt-inject-btn" data-id="${p.id}" title="Inject into chat" style="padding:4px 10px;border-radius:6px;border:none;background:var(--color-accent, #00aaff);color:#fff;cursor:pointer;font-size:0.8em;">Inject</button>
          <button class="prompt-copy-btn" data-id="${p.id}" title="Copy to clipboard" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;font-size:0.8em;">Copy</button>
          <button class="prompt-delete-btn" data-id="${p.id}" title="Delete" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;font-size:0.8em;">Delete</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

function _renderTagFilters(container, tags) {
  container.innerHTML = '';
  const mkBtn = (label, value) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `padding:3px 10px;border-radius:10px;border:1px solid var(--border);background:${_activeTag === value ? 'var(--color-accent,#00aaff)' : 'transparent'};color:${_activeTag === value ? '#fff' : 'var(--fg)'};cursor:pointer;font-size:0.78em;`;
    b.onclick = () => {
      _activeTag = value;
      promptsModule.render();
    };
    return b;
  };
  container.appendChild(mkBtn('All', ''));
  for (const t of tags) container.appendChild(mkBtn(t, t));
}

const promptsModule = {
  async open() {
    const m = document.getElementById('prompts-modal');
    if (!m) return;
    m.classList.remove('hidden');
    await _load();
    this.render();
  },

  close() {
    document.getElementById('prompts-modal')?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById('prompts-modal');
    return m && !m.classList.contains('hidden');
  },

  render() {
    const m = document.getElementById('prompts-modal');
    if (!m) return;
    const q = m.querySelector('#prompt-search')?.value?.toLowerCase() || '';
    let filtered = _filterPrompts(_prompts, _activeTag);
    if (q) filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));

    _renderTagFilters(m.querySelector('#prompt-tag-filters'), _tagsFromPrompts(_prompts));
    _renderCards(m.querySelector('#prompt-card-list'), filtered);

    // Wire inject/delete buttons
    m.querySelectorAll('.prompt-inject-btn').forEach(btn => {
      btn.onclick = async () => {
        const p = _prompts.find(x => x.id === btn.dataset.id);
        if (!p) return;
        await fetch(`/api/prompts/${p.id}/use`, { method: 'POST' }).catch(() => {});
        p.use_count = (p.use_count || 0) + 1;
        _injectPrompt(p.body);
      };
    });
    m.querySelectorAll('.prompt-copy-btn').forEach(btn => {
      btn.onclick = async () => {
        const p = _prompts.find(x => x.id === btn.dataset.id);
        if (!p) return;
        try {
          await navigator.clipboard.writeText(p.body);
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.color = 'var(--green, #50fa7b)';
          btn.style.borderColor = 'var(--green, #50fa7b)';
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.color = '';
            btn.style.borderColor = '';
          }, 1500);
        } catch { }
      };
    });
    m.querySelectorAll('.prompt-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this prompt?')) return;
        await fetch(`/api/prompts/${btn.dataset.id}`, { method: 'DELETE' });
        _prompts = _prompts.filter(p => p.id !== btn.dataset.id);
        this.render();
      };
    });
  },

  async save() {
    const m = document.getElementById('prompts-modal');
    if (!m) return;
    const title = m.querySelector('#new-prompt-title')?.value?.trim();
    const body = m.querySelector('#new-prompt-body')?.value?.trim();
    const tags = m.querySelector('#new-prompt-tags')?.value?.trim();
    if (!body) return;
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'Untitled Prompt', body, tags }),
    });
    if (res.ok) {
      const p = await res.json();
      _prompts.unshift(p);
      m.querySelector('#new-prompt-title').value = '';
      m.querySelector('#new-prompt-body').value = '';
      m.querySelector('#new-prompt-tags').value = '';
      this.render();
    }
  },

  async exportAll() {
    const res = await fetch('/api/prompts/export');
    if (!res.ok) return;
    const { export: content } = await res.json();
    const blob = new Blob([content], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'prompts.json' });
    a.click();
  },

  async importFile(file) {
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { alert('Invalid JSON file'); return; }
    const res = await fetch('/api/prompts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { imported } = await res.json();
      alert(`Imported ${imported} prompt(s)`);
      await _load();
      this.render();
    }
  },

  init() {
    const m = document.getElementById('prompts-modal');
    if (!m) return;
    document.getElementById('close-prompts-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });

    // Draggable
    const content = m.querySelector('.modal-content');
    const header = m.querySelector('.modal-header');
    if (content && header) {
      header.style.cursor = 'grab';
      let dragging = false, ox = 0, oy = 0;
      header.addEventListener('mousedown', e => {
        if (e.target.closest('button')) return;
        dragging = true;
        content.style.position = 'fixed';
        content.style.margin = '0';
        const r = content.getBoundingClientRect();
        content.style.left = r.left + 'px';
        content.style.top = r.top + 'px';
        ox = e.clientX - r.left;
        oy = e.clientY - r.top;
        header.style.cursor = 'grabbing';
        e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        content.style.left = Math.max(0, Math.min(window.innerWidth - content.offsetWidth, e.clientX - ox)) + 'px';
        content.style.top = Math.max(0, Math.min(window.innerHeight - content.offsetHeight, e.clientY - oy)) + 'px';
      });
      document.addEventListener('mouseup', () => {
        dragging = false;
        header.style.cursor = 'grab';
      });
    }
    m.querySelector('#prompt-search')?.addEventListener('input', () => this.render());
    m.querySelector('#new-prompt-save-btn')?.addEventListener('click', () => this.save());
    m.querySelector('#prompt-export-btn')?.addEventListener('click', () => this.exportAll());
    const importInput = m.querySelector('#prompt-import-file');
    m.querySelector('#prompt-import-btn')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', e => { if (e.target.files[0]) this.importFile(e.target.files[0]); });
    m.querySelector('#new-prompt-body')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); this.save(); }
    });
  },
};

export default promptsModule;
