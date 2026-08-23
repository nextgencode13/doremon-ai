/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// static/js/anywhereDoor.js
//
// Anywhere Door 🚪 — a gallery of all the Doraemon specialists. Pick one and
// "step in" to a dedicated chat with only that character (their full portrait
// shown beside the conversation). The heavy lifting — find-or-create the
// persistent character room and switch to it — lives in presets.js
// (enterCharacterRoom), which reuses the existing persistent-chat machinery.

import presetsModule from './presets.js';
import { showToast } from './ui.js';

const MODAL_ID = 'anywhere-door-modal';

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _crew() {
  const list = presetsModule.PROMPT_TEMPLATES || [];
  return list.filter(t => t.crew);
}

// Large portrait with emoji fallback (bigger than the Gadget Pocket card).
function _portraitHtml(id, emoji) {
  const src = presetsModule.crewPortrait ? presetsModule.crewPortrait(id) : `/static/portraits/${id}.png`;
  return `
    <div class="door-portrait">
      <img class="door-portrait-img" src="${_esc(src)}" alt="${_esc(id)}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <span class="door-portrait-emoji" style="display:none;">${_esc(emoji || '✨')}</span>
    </div>`;
}

function _enter(id, cardEl) {
  // 1.4 — Portal card activation flash before entering the room
  if (cardEl) {
    cardEl.classList.add('door-card-activating');
    setTimeout(() => {
      presetsModule.enterCharacterRoom(id, { showToast }).then(ok => {
        if (ok) anywhereDoorModule.close();
        else showToast('Could not open the room — try again');
      });
    }, 380);
  } else {
    presetsModule.enterCharacterRoom(id, { showToast }).then(ok => {
      if (ok) anywhereDoorModule.close();
      else showToast('Could not open the room — try again');
    });
  }
}

function _render() {
  const grid = document.getElementById('door-card-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const c of _crew()) {
    const accent = c.accent || '#cc785c';
    const chips = (c.goodAt || [])
      .map(g => `<span class="door-chip">${_esc(g)}</span>`).join('');
    const card = document.createElement('div');
    card.className = 'door-card';
    card.style.setProperty('--accent', accent);
    card.innerHTML = `
      ${_portraitHtml(c.id, c.avatar)}
      <div class="door-name">${_esc(c.name)}</div>
      <div class="door-tagline">${_esc(c.tagline || '')}</div>
      <div class="door-chips">${chips}</div>
      <button type="button" class="door-step-btn" data-char="${_esc(c.id)}">Step in &rarr;</button>
    `;
    card.querySelector('.door-step-btn').addEventListener('click', () => _enter(c.id, card));
    grid.appendChild(card);
  }
}

const anywhereDoorModule = {
  open() {
    const m = document.getElementById(MODAL_ID);
    if (!m) return;
    _render();
    m.classList.remove('hidden');
  },

  close() {
    document.getElementById(MODAL_ID)?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById(MODAL_ID);
    return m && !m.classList.contains('hidden');
  },

  // Programmatic entry used by the /room slash command.
  enter(id) { _enter(id, null); },

  init() {
    const m = document.getElementById(MODAL_ID);
    if (!m) return;
    document.getElementById('close-anywhere-door-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });
  },
};

export default anywhereDoorModule;
