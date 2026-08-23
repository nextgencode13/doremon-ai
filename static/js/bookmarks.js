/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
let _bookmarks = [];
let _filter = { q: '', tag: '', view: 'all' };

function _tagsFromBookmarks(bookmarks) {
  const set = new Set();
  for (const b of bookmarks) {
    (b.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => set.add(t));
  }
  return [...set].sort();
}

function _applyFilter(bookmarks) {
  let list = bookmarks;
  if (_filter.view === 'unread') list = list.filter(b => !b.is_read);
  if (_filter.view === 'pinned') list = list.filter(b => b.pinned);
  if (_filter.tag) list = list.filter(b => (b.tags || '').split(',').map(t => t.trim()).includes(_filter.tag));
  if (_filter.q) {
    const ql = _filter.q.toLowerCase();
    list = list.filter(b => (b.title || '').toLowerCase().includes(ql) || (b.url || '').toLowerCase().includes(ql) || (b.description || '').toLowerCase().includes(ql));
  }
  return list;
}

function _domain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function _renderCards(container, bookmarks) {
  container.innerHTML = '';
  if (!bookmarks.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--color-muted);padding:32px;font-size:0.9em;">No bookmarks yet. Add a URL above!</div>';
    return;
  }
  for (const b of bookmarks) {
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.style.cssText = 'margin:0;';
    const tags = (b.tags || '').split(',').map(t => t.trim()).filter(Boolean)
      .map(t => `<span style="font-size:0.7em;padding:2px 7px;border-radius:10px;background:color-mix(in srgb,var(--color-accent) 12%,transparent);color:var(--color-accent);">${t}</span>`)
      .join('');
    const favicon = b.favicon_url
      ? `<img src="${b.favicon_url}" width="16" height="16" style="border-radius:3px;flex-shrink:0;" onerror="this.style.display='none'">`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.4;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="padding-top:2px;">${favicon}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <a href="${b.url}" target="_blank" rel="noopener" style="font-weight:600;font-size:0.9em;color:var(--fg);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${b.url}">${b.title || b.url}</a>
            ${b.pinned ? '<span title="Pinned" style="font-size:0.8em;">📌</span>' : ''}
          </div>
          <div style="font-size:0.75em;color:var(--color-muted);margin-bottom:5px;">${_domain(b.url)}</div>
          ${b.description ? `<div style="font-size:0.8em;color:var(--color-muted);margin-bottom:5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${b.description}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${tags}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
          <button class="bm-read-btn" data-id="${b.id}" data-read="${b.is_read}" title="${b.is_read ? 'Mark unread' : 'Mark read'}" style="padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:${b.is_read ? 'transparent' : 'color-mix(in srgb,var(--green) 20%,transparent)'};color:var(--fg);cursor:pointer;font-size:0.75em;">${b.is_read ? 'Unread' : '✓ Read'}</button>
          <button class="bm-pin-btn" data-id="${b.id}" data-pinned="${b.pinned}" title="${b.pinned ? 'Unpin' : 'Pin'}" style="padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;font-size:0.75em;">${b.pinned ? 'Unpin' : '📌 Pin'}</button>
          <button class="bm-delete-btn" data-id="${b.id}" title="Delete" style="padding:3px 8px;border-radius:5px;border:1px solid color-mix(in srgb,var(--red) 40%,transparent);background:transparent;color:var(--red);cursor:pointer;font-size:0.75em;">Delete</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

function _renderTagFilters(container) {
  container.innerHTML = '';
  const tags = _tagsFromBookmarks(_bookmarks);
  const mkBtn = (label, value) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `padding:3px 10px;border-radius:10px;border:1px solid var(--border);background:${_filter.tag === value ? 'var(--color-accent,#00aaff)' : 'transparent'};color:${_filter.tag === value ? '#fff' : 'var(--fg)'};cursor:pointer;font-size:0.78em;`;
    b.onclick = () => { _filter.tag = _filter.tag === value ? '' : value; bookmarksModule.render(); };
    return b;
  };
  container.appendChild(mkBtn('All tags', ''));
  for (const t of tags) container.appendChild(mkBtn(t, t));
}

const bookmarksModule = {
  async open() {
    const m = document.getElementById('bookmarks-modal');
    if (!m) return;
    m.classList.remove('hidden');
    await this.load();
  },

  close() {
    document.getElementById('bookmarks-modal')?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById('bookmarks-modal');
    return m && !m.classList.contains('hidden');
  },

  async load() {
    try {
      const res = await fetch('/api/bookmarks');
      if (!res.ok) return;
      const { bookmarks } = await res.json();
      _bookmarks = bookmarks;
      this.render();
    } catch (e) { console.error('Bookmarks load failed:', e); }
  },

  render() {
    const m = document.getElementById('bookmarks-modal');
    if (!m) return;
    _renderTagFilters(m.querySelector('#bm-tag-filters'));
    _renderCards(m.querySelector('#bm-card-list'), _applyFilter(_bookmarks));

    // Wire action buttons
    m.querySelectorAll('.bm-read-btn').forEach(btn => {
      btn.onclick = async () => {
        const isRead = btn.dataset.read === 'true';
        const res = await fetch(`/api/bookmarks/${btn.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: !isRead }),
        });
        if (res.ok) {
          const bm = _bookmarks.find(b => b.id === btn.dataset.id);
          if (bm) bm.is_read = !isRead;
          this.render();
        }
      };
    });
    m.querySelectorAll('.bm-pin-btn').forEach(btn => {
      btn.onclick = async () => {
        const pinned = btn.dataset.pinned === 'true';
        const res = await fetch(`/api/bookmarks/${btn.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinned: !pinned }),
        });
        if (res.ok) {
          const bm = _bookmarks.find(b => b.id === btn.dataset.id);
          if (bm) bm.pinned = !pinned;
          this.render();
        }
      };
    });
    m.querySelectorAll('.bm-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this bookmark?')) return;
        await fetch(`/api/bookmarks/${btn.dataset.id}`, { method: 'DELETE' });
        _bookmarks = _bookmarks.filter(b => b.id !== btn.dataset.id);
        this.render();
      };
    });
  },

  async addUrl(url) {
    if (!url) return;
    // Fetch meta server-side
    let meta = { title: '', description: '', favicon_url: null };
    try {
      const r = await fetch('/api/bookmarks/fetch-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (r.ok) meta = await r.json();
    } catch (_) {}

    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...meta }),
    });
    if (res.ok) {
      const bm = await res.json();
      _bookmarks.unshift(bm);
      this.render();
    }
  },

  init() {
    const m = document.getElementById('bookmarks-modal');
    if (!m) return;
    document.getElementById('close-bookmarks-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });

    m.querySelector('#bm-search')?.addEventListener('input', e => {
      _filter.q = e.target.value;
      this.render();
    });

    m.querySelectorAll('.bm-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _filter.view = btn.dataset.view;
        m.querySelectorAll('.bm-view-btn').forEach(b => {
          b.style.background = b === btn ? 'var(--color-accent,#00aaff)' : 'transparent';
          b.style.color = b === btn ? '#fff' : 'var(--fg)';
          b.style.borderColor = b === btn ? 'transparent' : 'var(--border)';
        });
        this.render();
      });
    });

    m.querySelector('#bm-add-btn')?.addEventListener('click', async () => {
      const input = m.querySelector('#bm-url-input');
      const url = input?.value?.trim();
      if (!url) return;
      input.value = '';
      input.disabled = true;
      await this.addUrl(url);
      input.disabled = false;
    });

    m.querySelector('#bm-url-input')?.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        m.querySelector('#bm-add-btn')?.click();
      }
    });
  },
};

export default bookmarksModule;
