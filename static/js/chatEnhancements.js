/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// static/js/chatEnhancements.js
// Phase 5 message-level enhancements — purely additive, zero risk to existing features.
// Injected via MutationObserver on #chat-history; never modifies existing DOM machinery.

(function () {
  'use strict';

  const _STARRED_KEY   = 'odysseus-starred-msgs-v1';
  const _PINNED_KEY    = 'odysseus-pinned-msgs-v1';
  const _REACTIONS_KEY = 'odysseus-reactions-v1';
  const _LABELS_KEY    = 'odysseus-chat-labels-v1';

  // ── Utilities ─────────────────────────────────────────────────

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _id(el) {
    if (!el._enhId) el._enhId = 'msg-' + Math.random().toString(36).slice(2);
    return el._enhId;
  }

  function _getStarred() {
    try { return JSON.parse(localStorage.getItem(_STARRED_KEY) || '[]'); } catch { return []; }
  }
  function _setStarred(arr) {
    try { localStorage.setItem(_STARRED_KEY, JSON.stringify(arr)); } catch {}
  }
  function _getPinned() {
    try { return JSON.parse(localStorage.getItem(_PINNED_KEY) || '[]'); } catch { return []; }
  }
  function _setPinned(arr) {
    try { localStorage.setItem(_PINNED_KEY, JSON.stringify(arr)); } catch {}
  }
  function _getReactions() {
    try { return JSON.parse(localStorage.getItem(_REACTIONS_KEY) || '{}'); } catch { return {}; }
  }
  function _setReactions(obj) {
    try { localStorage.setItem(_REACTIONS_KEY, JSON.stringify(obj)); } catch {}
  }

  function _getText(msgEl) {
    const body = msgEl.querySelector('.body');
    return body ? body.textContent.trim() : '';
  }

  // ── CH-1: Message reactions ───────────────────────────────────

  const REACTION_EMOJIS = ['👍','❤️','🔥','💡','😂'];

  function _toggleReaction(msgEl, emoji) {
    const id = _id(msgEl);
    const reactions = _getReactions();
    if (!reactions[id]) reactions[id] = {};
    reactions[id][emoji] = !reactions[id][emoji];
    if (!reactions[id][emoji]) delete reactions[id][emoji];
    _setReactions(reactions);
    _renderReactions(msgEl);
  }

  function _renderReactions(msgEl) {
    const id = _id(msgEl);
    const reactions = _getReactions();
    const msgReactions = reactions[id] || {};
    let bar = msgEl.querySelector('.msg-reaction-bar');
    if (!bar) return;
    bar.innerHTML = '';
    REACTION_EMOJIS.forEach(e => {
      const active = !!msgReactions[e];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'msg-react-btn' + (active ? ' active' : '');
      btn.title = e;
      btn.textContent = e;
      btn.addEventListener('click', (ev) => { ev.stopPropagation(); _toggleReaction(msgEl, e); });
      bar.appendChild(btn);
    });
  }

  // ── CH-2: Pin messages ────────────────────────────────────────

  function _togglePin(msgEl) {
    const id = _id(msgEl);
    const text = _getText(msgEl);
    const pinned = _getPinned();
    const idx = pinned.findIndex(p => p.id === id);
    if (idx === -1) {
      pinned.push({ id, text: text.slice(0, 400), time: Date.now() });
      _setPinned(pinned);
      _showToast('📌 Message pinned');
    } else {
      pinned.splice(idx, 1);
      _setPinned(pinned);
      _showToast('📌 Message unpinned');
    }
    _updatePinBtn(msgEl);
    _renderPinnedPanel();
  }

  function _updatePinBtn(msgEl) {
    const id = _id(msgEl);
    const pinned = _getPinned();
    const isPinned = pinned.some(p => p.id === id);
    const btn = msgEl.querySelector('.msg-pin-btn');
    if (btn) {
      btn.title = isPinned ? 'Unpin message' : 'Pin message';
      btn.classList.toggle('active', isPinned);
      btn.textContent = isPinned ? '📌' : '📍';
    }
  }

  function _renderPinnedPanel() {
    const panel = document.getElementById('pinned-messages-panel');
    if (!panel) return;
    const pinned = _getPinned();
    if (!pinned.length) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    const list = panel.querySelector('.pinned-list') || panel;
    list.innerHTML = '<div class="pinned-panel-title">📌 Pinned Messages (' + pinned.length + ')</div>' +
      pinned.map(p =>
        '<div class="pinned-item">' +
        '<div class="pinned-text">' + _esc(p.text.slice(0, 120)) + (p.text.length > 120 ? '…' : '') + '</div>' +
        '<div class="pinned-time">' + new Date(p.time).toLocaleDateString() + '</div>' +
        '</div>'
      ).join('');
  }

  // ── W-2: Star messages ────────────────────────────────────────

  function _toggleStar(msgEl) {
    const id = _id(msgEl);
    const text = _getText(msgEl);
    const starred = _getStarred();
    const idx = starred.findIndex(s => s.id === id);
    if (idx === -1) {
      starred.push({ id, text: text.slice(0, 400), time: Date.now() });
      _setStarred(starred);
      _showToast('⭐ Message starred');
    } else {
      starred.splice(idx, 1);
      _setStarred(starred);
      _showToast('⭐ Message unstarred');
    }
    _updateStarBtn(msgEl);
  }

  function _updateStarBtn(msgEl) {
    const id = _id(msgEl);
    const starred = _getStarred();
    const isStarred = starred.some(s => s.id === id);
    const btn = msgEl.querySelector('.msg-star-btn');
    if (btn) {
      btn.title = isStarred ? 'Unstar message' : 'Star message';
      btn.classList.toggle('active', isStarred);
      btn.textContent = isStarred ? '⭐' : '☆';
    }
  }

  // ── E-2: Copy as Notion block ────────────────────────────────

  function _copyNotion(msgEl) {
    const text = _getText(msgEl);
    // Notion-flavored markdown: preserve line breaks, code blocks
    const notion = text.replace(/^/gm, '');
    navigator.clipboard.writeText(notion).then(() => {
      _showToast('📋 Copied as Notion block');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = notion;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      _showToast('📋 Copied to clipboard');
    });
  }

  // ── T-4: Retry button (shown on error messages) ──────────────

  function _retryMessage(msgEl) {
    const prevUser = msgEl.previousElementSibling;
    if (!prevUser) { _showToast('No message to retry'); return; }
    const body = prevUser.querySelector('.body');
    const text = body ? body.textContent.trim() : '';
    if (!text) { _showToast('No message to retry'); return; }
    const msgInput = document.getElementById('message');
    const form = document.getElementById('chat-form');
    if (!msgInput || !form) return;
    msgInput.value = text;
    msgInput.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })), 50);
    _showToast('↩️ Retrying…');
  }

  // ── Message enhancement injection ────────────────────────────

  function _enhanceMessage(msgEl) {
    // Skip if already enhanced or if it's a slash command reply
    if (msgEl._enhanced || msgEl.classList.contains('msg-user')) return;
    if (msgEl.querySelector('.msg-enhancements')) return;
    msgEl._enhanced = true;

    const isAI = msgEl.classList.contains('msg-ai');
    const isError = msgEl.classList.contains('msg-error') ||
                    (msgEl.querySelector('.body') && msgEl.querySelector('.body').textContent.includes('Error:'));

    // Container for our injected buttons
    const enhWrap = document.createElement('div');
    enhWrap.className = 'msg-enhancements';

    if (isAI) {
      // Reaction bar
      const reactionBar = document.createElement('div');
      reactionBar.className = 'msg-reaction-bar';
      enhWrap.appendChild(reactionBar);
      _renderReactions(msgEl);

      // Action buttons row
      const actionsRow = document.createElement('div');
      actionsRow.className = 'msg-extra-actions';

      // ⭐ Star
      const starBtn = document.createElement('button');
      starBtn.type = 'button';
      starBtn.className = 'msg-star-btn msg-extra-btn';
      starBtn.title = 'Star message';
      starBtn.textContent = '☆';
      starBtn.addEventListener('click', (e) => { e.stopPropagation(); _toggleStar(msgEl); });
      actionsRow.appendChild(starBtn);
      _updateStarBtn(msgEl);

      // 📍 Pin
      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'msg-pin-btn msg-extra-btn';
      pinBtn.title = 'Pin message';
      pinBtn.textContent = '📍';
      pinBtn.addEventListener('click', (e) => { e.stopPropagation(); _togglePin(msgEl); });
      actionsRow.appendChild(pinBtn);
      _updatePinBtn(msgEl);

      // 📋 Notion copy
      const notionBtn = document.createElement('button');
      notionBtn.type = 'button';
      notionBtn.className = 'msg-notion-btn msg-extra-btn';
      notionBtn.title = 'Copy as Notion block';
      notionBtn.textContent = '📋';
      notionBtn.addEventListener('click', (e) => { e.stopPropagation(); _copyNotion(msgEl); });
      actionsRow.appendChild(notionBtn);

      enhWrap.appendChild(actionsRow);
      // U-1: Quick-reply chips
      _addQuickReplies(msgEl);
    }

    if (isError) {
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'msg-retry-btn';
      retryBtn.textContent = '↩️ Retry';
      retryBtn.addEventListener('click', (e) => { e.stopPropagation(); _retryMessage(msgEl); });
      enhWrap.appendChild(retryBtn);
    }

    if (enhWrap.children.length > 0) {
      msgEl.appendChild(enhWrap);
    }
  }

  // ── T-1: Streaming token ticker ───────────────────────────────

  let _tickerInterval = null;
  let _lastTickerEl = null;

  function _updateTicker() {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    const msgs = chatHistory.querySelectorAll('.msg-ai');
    const last = msgs[msgs.length - 1];
    if (!last) return;
    const body = last.querySelector('.body');
    if (!body) return;
    // Only show ticker when spinner is active (streaming)
    const isStreaming = !!document.querySelector('.spinner-active, .msg-typing, .streaming-cursor');
    if (!isStreaming) {
      if (_lastTickerEl) { _lastTickerEl.remove(); _lastTickerEl = null; }
      return;
    }
    const charCount = body.textContent.length;
    if (!_lastTickerEl || _lastTickerEl.parentElement !== last) {
      if (_lastTickerEl) _lastTickerEl.remove();
      _lastTickerEl = document.createElement('div');
      _lastTickerEl.className = 'stream-ticker';
      last.appendChild(_lastTickerEl);
    }
    _lastTickerEl.textContent = `${charCount} chars`;
  }

  // ── CH-6: In-chat Ctrl+F search ──────────────────────────────

  let _searchBar = null;
  let _searchHighlights = [];

  function _clearHighlights() {
    _searchHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) parent.replaceChild(document.createTextNode(el.textContent), el);
    });
    _searchHighlights = [];
  }

  function _doSearch(query) {
    _clearHighlights();
    if (!query) return;
    const bodies = document.querySelectorAll('#chat-history .msg .body');
    const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    bodies.forEach(body => {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);
      textNodes.forEach(tn => {
        const text = tn.textContent;
        if (!re.test(text)) return;
        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0, m;
        while ((m = re.exec(text)) !== null) {
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const mark = document.createElement('mark');
          mark.className = 'chat-search-highlight';
          mark.textContent = m[0];
          frag.appendChild(mark);
          _searchHighlights.push(mark);
          last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
      });
    });
    if (_searchHighlights.length) _searchHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (_searchBar) {
      const counter = _searchBar.querySelector('.search-count');
      if (counter) counter.textContent = _searchHighlights.length ? `${_searchHighlights.length} match${_searchHighlights.length !== 1 ? 'es' : ''}` : 'No matches';
    }
  }

  function _openSearchBar() {
    if (_searchBar) { _searchBar.querySelector('input').focus(); return; }
    _searchBar = document.createElement('div');
    _searchBar.id = 'chat-search-bar';
    _searchBar.className = 'chat-search-bar';
    _searchBar.innerHTML =
      '<input type="text" class="chat-search-input" placeholder="Search in chat…" autocomplete="off" />' +
      '<span class="search-count"></span>' +
      '<button type="button" class="chat-search-close">✕</button>';
    const inp = _searchBar.querySelector('input');
    _searchBar.querySelector('.chat-search-close').addEventListener('click', _closeSearchBar);
    inp.addEventListener('input', () => _doSearch(inp.value.trim()));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _closeSearchBar();
    });
    document.body.appendChild(_searchBar);
    inp.focus();
  }

  function _closeSearchBar() {
    _clearHighlights();
    if (_searchBar) { _searchBar.remove(); _searchBar = null; }
  }

  // ── CH-4: Auto-title conversations ───────────────────────────

  let _autoTitleDone = false;

  function _tryAutoTitle() {
    if (_autoTitleDone) return;
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    const userMsgs = chatHistory.querySelectorAll('.msg-user');
    const aiMsgs   = chatHistory.querySelectorAll('.msg-ai');
    if (userMsgs.length < 1 || aiMsgs.length < 1) return;
    // Only auto-title if the sidebar session still shows "New Chat"
    const activeSession = document.querySelector('#sidebar .list-item.active .item-name, #sidebar .active .session-name');
    if (!activeSession) return;
    const currentTitle = activeSession.textContent.trim();
    if (currentTitle && currentTitle !== 'New Chat' && currentTitle !== 'Untitled') return;
    _autoTitleDone = true;
    // Generate title from first user message
    const firstUser = userMsgs[0];
    const body = firstUser.querySelector('.body');
    const text = body ? body.textContent.trim() : '';
    if (!text) return;
    // Simple title: first 5-7 words
    const words = text.split(/\s+/).slice(0, 6).join(' ');
    const title = words.length < text.length ? words + '…' : words;
    activeSession.textContent = title;
    activeSession.title = text.slice(0, 200);
  }

  // ── Streak sidebar display ────────────────────────────────────

  function _renderStreakBadge() {
    const el = document.getElementById('sidebar-streak-badge');
    if (!el) return;
    try {
      const data = JSON.parse(localStorage.getItem('odysseus-streak-v1') || '{}');
      const count = data.count || 0;
      const today = new Date().toDateString();
      if (data.lastDate !== today && data.lastDate !== new Date(Date.now() - 86400000).toDateString()) {
        el.textContent = '';
        return;
      }
      el.textContent = count > 1 ? `🔥 ${count} days` : '';
    } catch {}
  }

  // ── W-1: Conversation labels (sidebar) ───────────────────────

  function _initLabels() {
    const btn = document.getElementById('chat-label-btn');
    if (!btn || btn._labelWired) return;
    btn._labelWired = true;
    btn.addEventListener('click', () => {
      const panel = document.getElementById('chat-label-panel');
      if (panel) panel.classList.toggle('hidden');
    });
  }

  // ── W-3: Templates button ────────────────────────────────────

  function _initTemplatesBtn() {
    const btn = document.getElementById('templates-quick-btn');
    if (!btn || btn._tplWired) return;
    btn._tplWired = true;
    btn.addEventListener('click', () => {
      const msgInput = document.getElementById('message');
      if (msgInput) {
        msgInput.value = '/template';
        msgInput.dispatchEvent(new Event('input', { bubbles: true }));
        msgInput.focus();
      }
    });
  }

  // ── G-2: Sidebar daily challenge banner ──────────────────────

  function _renderSidebarDailyChallenge() {
    const el = document.getElementById('sidebar-daily-challenge');
    if (!el) return;
    const today = new Date();
    const stored = localStorage.getItem('odysseus-sidebar-challenge-seen');
    if (stored === today.toDateString()) return;
    const msgInput = document.getElementById('message');
    if (!msgInput) return;
    // Show a subtle "Today's challenge" hint — uses injected HTML
    el.title = 'Click to see today\'s challenge';
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      msgInput.value = '/daily-challenge';
      msgInput.dispatchEvent(new Event('input', { bubbles: true }));
      const form = document.getElementById('chat-form');
      if (form) setTimeout(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })), 50);
      localStorage.setItem('odysseus-sidebar-challenge-seen', today.toDateString());
    }, { once: true });
  }

  // ── U-1: Quick-reply chips after AI messages ──────────────────

  const _QUICK_REPLIES = [
    'Tell me more →',
    'Give an example →',
    'Simplify this →',
  ];

  function _addQuickReplies(msgEl) {
    if (msgEl.querySelector('.quick-reply-chips')) return;
    const wrap = document.createElement('div');
    wrap.className = 'quick-reply-chips';
    const msgInput = document.getElementById('message');
    const form = document.getElementById('chat-form');
    _QUICK_REPLIES.forEach(text => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-reply-chip';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        if (!msgInput) return;
        msgInput.value = text.replace(' →', '');
        msgInput.dispatchEvent(new Event('input', { bubbles: true }));
        msgInput.focus();
        wrap.remove();
        if (form) setTimeout(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })), 50);
      });
      wrap.appendChild(btn);
    });
    msgEl.appendChild(wrap);
  }

  // ── Toast helper ──────────────────────────────────────────────

  function _showToast(msg) {
    if (window.showToast) { window.showToast(msg); return; }
    const t = document.createElement('div');
    t.className = 'odysseus-toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:#222;color:#fff;padding:8px 16px;border-radius:8px;z-index:9999;font-size:0.85rem;' +
      'pointer-events:none;opacity:0;transition:opacity 0.2s;';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 2200);
  }

  // ── MutationObserver wiring ───────────────────────────────────

  function _init() {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;

    // Enhance existing messages
    chatHistory.querySelectorAll('.msg').forEach(_enhanceMessage);

    // Watch for new messages
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mut => {
        mut.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.classList.contains('msg')) _enhanceMessage(node);
          node.querySelectorAll && node.querySelectorAll('.msg').forEach(_enhanceMessage);
        });
        // Watch for .msg-error class being added to existing elements
        if (mut.type === 'attributes' && mut.target.classList.contains('msg-error')) {
          _enhanceMessage(mut.target);
        }
      });
      _tryAutoTitle();
    });
    observer.observe(chatHistory, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // Ctrl+F in-chat search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const inInput = document.activeElement &&
          (document.activeElement.id === 'message' || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (!inInput) {
          e.preventDefault();
          _openSearchBar();
        }
      }
    });

    // Streaming token ticker — poll every 500ms
    _tickerInterval = setInterval(_updateTicker, 500);

    // Init optional sidebar features
    _renderPinnedPanel();
    _renderStreakBadge();
    _renderSidebarDailyChallenge();
    _initLabels();
    _initTemplatesBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
