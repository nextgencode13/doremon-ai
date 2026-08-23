/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// static/js/gadgetPocket.js
//
// Gadget Pocket — Doraemon's 4-D pocket. A playful launcher that lets the user
// summon a specialist character persona (Nobita, Shizuka, Gian, …) for a given
// kind of work. Each "Call" simply activates that character via the existing
// preset system (presetsModule.activateCharacter) — no new chat mechanism.

import presetsModule from './presets.js';
import { showToast } from './ui.js';

const MODAL_ID = 'gadgets-modal';

// ── Phase 6 localStorage keys ─────────────────────────────────────
const _LAST_CALLED_KEY  = 'odysseus-last-called-v1';   // P-5
const _CALL_HISTORY_KEY = 'odysseus-call-history-v1';  // G-8 / E-5
const _NICKNAMES_KEY    = 'odysseus-char-nicknames';   // P-1
const _BADGES_KEY       = 'odysseus-badges-v1';        // G-5
const _WEEKLY_SEEN_KEY  = 'odysseus-weekly-spotlight-seen'; // G-9
const _BDAY_SEEN_KEY    = 'odysseus-bday-seen-v1';     // E-7 (read here for display)

// Playful one-liners shown in the toast when a character is summoned.
const _CALL_LINES = {
  nobita:   "🧸 Nobita's here — let's figure it out together!",
  shizuka:  "🎀 Shizuka's here — let's make it lovely.",
  gian:     "💪 Gian's here — let's get it DONE!",
  suneo:    "🦊 Suneo's here — I know just the move.",
  dekisugi: "🎓 Dekisugi's here — let's get it exactly right.",
  dorami:   "🌸 Dorami's here — I'll keep us organized!",
  sensei:   "👓 Sensei's here — let's hold it to the standard.",
  jaiko:    "🎨 Jaiko's here — time to create something!",
  doraemon: "🔵 Doraemon's here — I've got just the gadget!",
  tamako:   "👩‍🍳 Tamako's here — enough excuses, let's work!",
  nobisuke: "👔 Nobisuke's here — I believe in you!",
  gianmom:  "👊 Gian's Mom is here — NO slacking!",
  sewashi:  "🚀 Sewashi's here — let's think ahead!",
  suneomom: "💅 Suneo's Mom is here — let's make this impressive!",
  minidora: "🤖 Mini-Dora's here — quick help incoming!",
};

function _crew() {
  const list = presetsModule.PROMPT_TEMPLATES || [];
  return list.filter(t => t.crew);
}

function _focusChatInput() {
  const input = document.getElementById('message');
  if (input) input.focus();
}

// ── P-1: Nickname helpers ─────────────────────────────────────────
function _getNicknames() {
  try { return JSON.parse(localStorage.getItem(_NICKNAMES_KEY) || '{}'); } catch { return {}; }
}
function _setNickname(id, name) {
  try {
    const n = _getNicknames();
    if (name) n[id] = name; else delete n[id];
    localStorage.setItem(_NICKNAMES_KEY, JSON.stringify(n));
  } catch {}
}
function _displayName(c) {
  const nicks = _getNicknames();
  return nicks[c.id] || c.name;
}

// ── P-5: Last called helpers ──────────────────────────────────────
function _getLastCalled() {
  try { return JSON.parse(localStorage.getItem(_LAST_CALLED_KEY) || '{}'); } catch { return {}; }
}
function _setLastCalled(id) {
  try {
    const lc = _getLastCalled();
    lc[id] = new Date().toISOString();
    localStorage.setItem(_LAST_CALLED_KEY, JSON.stringify(lc));
  } catch {}
}
function _lastCalledLabel(id) {
  const lc = _getLastCalled();
  if (!lc[id]) return 'Never called';
  const diff = Date.now() - new Date(lc[id]).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2)   return 'Called just now';
  if (mins < 60)  return `Called ${mins}m ago`;
  if (hrs < 24)   return `Called ${hrs}h ago`;
  if (days === 1) return 'Called yesterday';
  return `Called ${days} days ago`;
}

// ── G-8 / E-5: Call history ring buffer ──────────────────────────
function _getCallHistory() {
  try { return JSON.parse(localStorage.getItem(_CALL_HISTORY_KEY) || '{"entries":[]}'); } catch { return { entries: [] }; }
}
function _pushCallHistory(id) {
  try {
    const h = _getCallHistory();
    h.entries.push({ charId: id, ts: Date.now() });
    if (h.entries.length > 50) h.entries = h.entries.slice(-50);
    localStorage.setItem(_CALL_HISTORY_KEY, JSON.stringify(h));
  } catch {}
}

// ── G-5: Badges ───────────────────────────────────────────────────
const _BADGE_DEFS = [
  { id: 'first-contact',  emoji: '🌱', label: 'First Contact',   check: (stats) => Object.values(stats).some(v => v >= 1) },
  { id: 'nobita-friend',  emoji: '🤝', label: 'Friend of Nobita', check: (stats) => (stats.nobita || 0) >= 5 },
  { id: 'on-fire',        emoji: '🔥', label: 'On Fire',          check: (_, streak) => streak >= 5 },
  { id: 'crew-explorer',  emoji: '🎯', label: 'Crew Explorer',    check: (stats) => Object.keys(stats).filter(k => stats[k] > 0).length >= 5 },
  { id: 'crew-master',    emoji: '🏅', label: 'Crew Master',      check: (stats) => Object.keys(stats).filter(k => stats[k] > 0).length >= 15 },
  { id: 'loyal-friend',   emoji: '⭐', label: 'Loyal Friend',     check: (stats) => Object.values(stats).some(v => v >= 25) },
  { id: 'century-club',   emoji: '🎉', label: 'Century Club',     check: (stats) => Object.values(stats).reduce((s, n) => s + n, 0) >= 100 },
  { id: 'note-taker',     emoji: '📝', label: 'Note Taker',       check: (_, __, notes) => Object.values(notes).filter(v => v && v.trim()).length >= 3 },
  { id: 'debate-lover',   emoji: '🌟', label: 'Debate Lover',     check: (_, __, ___, debateCount) => debateCount >= 5 },
  { id: 'power-user',     emoji: '🚀', label: 'Power User',       check: (_, __, ___, ____, cmdCount) => cmdCount >= 10 },
];

function _getEarnedBadges() {
  try { return JSON.parse(localStorage.getItem(_BADGES_KEY) || '[]'); } catch { return []; }
}

function _checkAndAwardBadges(stats) {
  try {
    const earned = new Set(_getEarnedBadges());
    const streakData = JSON.parse(localStorage.getItem('odysseus-streak-v1') || '{}');
    const streak = streakData.count || 0;
    const notes = JSON.parse(localStorage.getItem('odysseus-crew-notes-v1') || '{}');
    const debateCount = parseInt(localStorage.getItem('odysseus-debate-count-v1') || '0', 10);
    const cmdCount = parseInt(localStorage.getItem('odysseus-cmd-count-v1') || '0', 10);
    const newBadges = [];
    for (const def of _BADGE_DEFS) {
      if (!earned.has(def.id) && def.check(stats, streak, notes, debateCount, cmdCount)) {
        earned.add(def.id);
        newBadges.push(def);
      }
    }
    if (newBadges.length) {
      localStorage.setItem(_BADGES_KEY, JSON.stringify([...earned]));
      newBadges.forEach(b => showToast(`${b.emoji} Badge unlocked: ${b.label}!`, { duration: 4000 }));
    }
  } catch {}
}

// ── E-5: Crossover event ──────────────────────────────────────────
function _checkCrossover(id) {
  try {
    const crew = presetsModule.PROMPT_TEMPLATES || [];
    const caller = crew.find(c => c.id === id);
    if (!caller || !caller.pairsWith) return;
    const partner = crew.find(c => c.name === caller.pairsWith || c.id === caller.pairsWith);
    if (!partner) return;
    const history = _getCallHistory();
    const today = new Date().toDateString();
    const calledToday = history.entries.filter(e => new Date(e.ts).toDateString() === today).map(e => e.charId);
    if (calledToday.includes(partner.id)) {
      const crossoverKey = `odysseus-crossover-${id}-${partner.id}-${today}`;
      const altKey       = `odysseus-crossover-${partner.id}-${id}-${today}`;
      if (!localStorage.getItem(crossoverKey) && !localStorage.getItem(altKey)) {
        localStorage.setItem(crossoverKey, '1');
        showToast(`⚡ Dynamic duo! ${caller.avatar || ''} ${_displayName(caller)} + ${partner.avatar || ''} ${_displayName(partner)} are both on the case!`, { duration: 5000 });
      }
    }
  } catch {}
}

// ── 4.1 Crew Usage Stats ──────────────────────────────────────────
const _STATS_KEY    = 'odysseus-crew-stats-v1';
const _STREAK_KEY   = 'odysseus-streak-v1';
const _MILESTONES   = [10, 25, 50, 100];

// G-4 — update day streak
function _updateStreak() {
  try {
    const today = new Date().toDateString();
    const stored = JSON.parse(localStorage.getItem(_STREAK_KEY) || '{}');
    if (stored.lastDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const count = stored.lastDate === yesterday ? (stored.count || 0) + 1 : 1;
    localStorage.setItem(_STREAK_KEY, JSON.stringify({ lastDate: today, count }));
    if (count > 1) {
      // Show streak sidebar badge update
      const el = document.getElementById('sidebar-streak-count');
      if (el) el.textContent = count;
    }
  } catch {}
}

function _trackCall(id) {
  try {
    const stats = JSON.parse(localStorage.getItem(_STATS_KEY) || '{}');
    stats[id] = (stats[id] || 0) + 1;
    localStorage.setItem(_STATS_KEY, JSON.stringify(stats));
    // 4.3 Easter egg — milestone celebration
    const total = Object.values(stats).reduce((s, n) => s + n, 0);
    const hit = _MILESTONES.find(m => total === m);
    if (hit) showToast(`🎉 ${hit} crew calls! The whole team has your back.`, { duration: 4000 });
    // G-1 — bond level up notification
    const count = stats[id];
    const bondThresholds = [1, 5, 10, 25, 50];
    const bondNames = ['Acquaintance','Friend','Buddy','Partner','Best Friend'];
    const idx = bondThresholds.indexOf(count);
    if (idx !== -1) showToast(`🌟 Bond level up! ${id} is now your ${bondNames[idx]}`, { duration: 3500 });
    // G-4 — update streak
    _updateStreak();
    // P-5 — last called timestamp
    _setLastCalled(id);
    // G-8 — push to call history ring buffer
    _pushCallHistory(id);
    // E-5 — crossover event check
    _checkCrossover(id);
    // G-5 — badge check
    _checkAndAwardBadges(stats);
    // Track total command count for Power User badge
    try {
      const cc = parseInt(localStorage.getItem('odysseus-cmd-count-v1') || '0', 10);
      localStorage.setItem('odysseus-cmd-count-v1', String(cc + 1));
    } catch {}
  } catch {}
}
export function getCrewStats() {
  try { return JSON.parse(localStorage.getItem(_STATS_KEY) || '{}'); } catch { return {}; }
}

// ── 5.1 Per-Character Notes ───────────────────────────────────────
const _NOTES_KEY = 'odysseus-crew-notes-v1';
function _getNotes() {
  try { return JSON.parse(localStorage.getItem(_NOTES_KEY) || '{}'); } catch { return {}; }
}

// ── 5.2 Favorite Character Pin ────────────────────────────────────
const _FAV_KEY = 'odysseus-crew-favorite-v1';
function _getFav()       { return localStorage.getItem(_FAV_KEY) || ''; }
function _setFav(id)     { localStorage.setItem(_FAV_KEY, id); }
function _clearFav()     { localStorage.removeItem(_FAV_KEY); }
function _toggleFav(id)  { _getFav() === id ? _clearFav() : _setFav(id); }

// ── U-3: Conversation starters on character activation ────────────
function _showConversationStarters(c) {
  const starters = (c.tryAsking || []).slice(0, 3);
  if (!starters.length) return;
  const existing = document.getElementById('crew-starters-wrap');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'crew-starters-wrap';
  wrap.className = 'crew-starters-wrap';
  wrap.innerHTML = `<div class="crew-starters-label">Try asking ${_esc(c.name)}…</div>` +
    starters.map(q => `<button type="button" class="crew-starter-chip">${_esc(q)}</button>`).join('');
  const msgInput = document.getElementById('message');
  const form = document.getElementById('chat-form');
  if (msgInput) {
    wrap.querySelectorAll('.crew-starter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        msgInput.value = btn.textContent;
        msgInput.dispatchEvent(new Event('input', { bubbles: true }));
        msgInput.focus();
        wrap.remove();
      });
    });
    // Remove starters on first message submit
    if (form) {
      form.addEventListener('submit', () => wrap.remove(), { once: true });
    }
    const chatHistory = document.getElementById('chat-history');
    const insertTarget = chatHistory ? chatHistory.nextElementSibling : msgInput.parentElement;
    if (insertTarget) insertTarget.parentElement.insertBefore(wrap, insertTarget);
    else msgInput.parentElement.insertBefore(wrap, msgInput);
  }
}

/** Summon a character, close the pocket, and cheer. */
function _call(id) {
  _trackCall(id);
  presetsModule.activateCharacter(id).then(ok => {
    if (!ok) { showToast('Could not summon — try again'); return; }
    gadgetPocketModule.close();
    _focusChatInput();
    // P-4: Mood-aware greeting based on bond level
    const stats = getCrewStats();
    const callCount = stats[id] || 0;
    const bondLvl = callCount >= 50 ? 5 : callCount >= 25 ? 4 : callCount >= 10 ? 3 : callCount >= 5 ? 2 : callCount >= 1 ? 1 : 0;
    let greeting = _CALL_LINES[id] || '🛎️ Ready to help!';
    if (bondLvl >= 4) greeting = greeting.replace('!', ` — welcome back! (${callCount} calls together)`);
    else if (bondLvl === 0) greeting = greeting.replace('!', ' — nice to meet you!');
    showToast(greeting);
    // U-3: Conversation starters
    const crew = _crew();
    const c = crew.find(m => m.id === id);
    if (c) _showConversationStarters(c);
  });
}

/** Return to the default Doremon AI assistant. */
function _backToDoraemon() {
  if (presetsModule.deactivateCharacter) presetsModule.deactivateCharacter();
  gadgetPocketModule.close();
  _focusChatInput();
  showToast('🔵 Back to Doraemon');
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Avatar HTML: portrait <img> with the emoji as a graceful fallback. The image
// lives at /static/portraits/<id>.png; if it isn't there yet, onerror hides the
// img and reveals the emoji span — so the card looks exactly like before.
function _avatarHtml(id, emoji) {
  const src = presetsModule.crewPortrait ? presetsModule.crewPortrait(id) : `/static/portraits/${id}.png`;
  return `
    <div class="gadget-avatar">
      <img class="gadget-portrait" src="${_esc(src)}" alt="${_esc(id)}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <span class="gadget-emoji" style="display:none;">${_esc(emoji || '✨')}</span>
    </div>`;
}

function _renderGadgetOfDay(grid) {
  const crew = _crew();
  if (!crew.length) return;
  const today = new Date().toDateString();
  const lastSeen = localStorage.getItem('odysseus-gotd-seen');
  if (lastSeen === today) return;
  const pick = crew[new Date().getDay() % crew.length];
  if (!pick) return;
  const existing = document.getElementById('gadget-gotd-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'gadget-gotd-banner';
  banner.className = 'gadget-gotd-banner';
  banner.style.setProperty('--accent', pick.accent || '#cc785c');
  banner.innerHTML = `
    <div class="gadget-gotd-inner">
      <span class="gadget-gotd-star">⭐</span>
      <div class="gadget-gotd-text">
        <div class="gadget-gotd-label">Gadget of the Day</div>
        <div class="gadget-gotd-name">${_esc(pick.avatar || '')} ${_esc(pick.name)}</div>
        <div class="gadget-gotd-tip">${_esc(pick.tagline || '')}</div>
      </div>
      <button type="button" class="gadget-gotd-btn" data-char="${_esc(pick.id)}">Try ${_esc(pick.name)} →</button>
    </div>
  `;
  banner.querySelector('.gadget-gotd-btn').addEventListener('click', () => {
    localStorage.setItem('odysseus-gotd-seen', today);
    _call(pick.id);
  });
  grid.parentElement.insertBefore(banner, grid);
}

// ── G-6: Crew leaderboard ─────────────────────────────────────────
function _renderLeaderboard(container) {
  const stats = getCrewStats();
  const crew = _crew();
  const sorted = crew
    .map(c => ({ ...c, count: stats[c.id] || 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (!sorted.length) return;
  const existing = container.querySelector('.gadget-leaderboard');
  if (existing) existing.remove();
  const lb = document.createElement('div');
  lb.className = 'gadget-leaderboard';
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  lb.innerHTML = '<div class="gadget-lb-title">🏆 Your Top Crew</div>' +
    sorted.map((c, i) => {
      const nick = _getNicknames()[c.id] || c.name;
      return `<div class="gadget-lb-row">
        <span class="gadget-lb-medal">${medals[i]}</span>
        <span class="gadget-lb-avatar">${c.avatar || ''}</span>
        <span class="gadget-lb-name">${_esc(nick)}</span>
        <span class="gadget-lb-count">${c.count} call${c.count !== 1 ? 's' : ''}</span>
      </div>`;
    }).join('');
  const grid = container.querySelector('#gadget-card-grid');
  if (grid) container.insertBefore(lb, grid);
}

// ── G-9: Weekly spotlight ─────────────────────────────────────────
function _renderWeeklySpotlight(container) {
  const crew = _crew();
  if (!crew.length) return;
  const today = new Date();
  // Week number (ISO-ish: days since epoch / 7)
  const weekNum = Math.floor(today.getTime() / (7 * 86400000));
  const pick = crew[weekNum % crew.length];
  if (!pick) return;
  // One dismissal per ISO week
  const isoWeek = `${today.getFullYear()}-W${String(Math.floor((today.getDate() + 6) / 7)).padStart(2,'0')}`;
  const seenKey = _WEEKLY_SEEN_KEY + '-' + isoWeek;
  if (localStorage.getItem(seenKey)) return;
  const existing = container.querySelector('.gadget-weekly-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.className = 'gadget-weekly-banner';
  banner.style.setProperty('--accent', pick.accent || '#cc785c');
  banner.innerHTML = `
    <div class="gadget-weekly-inner">
      <span class="gadget-weekly-emoji">⭐</span>
      <div class="gadget-weekly-text">
        <div class="gadget-weekly-label">This week's spotlight</div>
        <div class="gadget-weekly-name">${_esc(pick.avatar || '')} ${_esc(_getNicknames()[pick.id] || pick.name)}</div>
        <div class="gadget-weekly-tip">${_esc((pick.goodAt || []).slice(0,2).join(' · ') || pick.tagline || '')}</div>
      </div>
      <button type="button" class="gadget-weekly-call" data-char="${_esc(pick.id)}">Try →</button>
      <button type="button" class="gadget-weekly-dismiss" title="Dismiss">✕</button>
    </div>`;
  banner.querySelector('.gadget-weekly-call').addEventListener('click', () => _call(pick.id));
  banner.querySelector('.gadget-weekly-dismiss').addEventListener('click', () => {
    localStorage.setItem(seenKey, '1');
    banner.remove();
  });
  const grid = container.querySelector('#gadget-card-grid');
  if (grid) container.insertBefore(banner, grid);
}

function _render() {
  const grid = document.getElementById('gadget-card-grid');
  if (!grid) return;
  grid.innerHTML = '';
  _renderGadgetOfDay(grid);

  const modal = document.getElementById(MODAL_ID);
  const modalBody = modal ? modal.querySelector('.modal-body') : null;

  // G-6: Crew leaderboard (above card grid in modal body)
  if (modalBody) _renderLeaderboard(modalBody);
  // G-9: Weekly spotlight
  if (modalBody) _renderWeeklySpotlight(modalBody);

  // U-5: Filter bar
  _renderFilterBar(grid);

  const favId = _getFav();
  const stats = getCrewStats();
  const notes = _getNotes();
  const nicks = _getNicknames();
  const lastCalled = _getLastCalled();

  // Pinned character floats to top
  const crew = _crew().slice().sort((a, b) => (b.id === favId ? 1 : 0) - (a.id === favId ? 1 : 0));

  for (const c of crew) {
    const accent = c.accent || '#cc785c';
    const displayN = nicks[c.id] || c.name;
    const chips = (c.goodAt || [])
      .map(g => `<span class="gadget-chip">${_esc(g)}</span>`).join('');
    const pairsHtml = c.pairsWith
      ? `<div class="gadget-pairs-with"><span style="display:inline-block;background:#e0f0ff;color:#0066cc;font-weight:800;padding:2px 6px;border-radius:4px;font-size:0.78rem;">🤝 Works great with</span> <strong style="display:inline-block;background:#ffe066;color:#111;font-weight:800;padding:2px 8px;border-radius:4px;">${_esc(c.pairsWith)}</strong></div>` : '';
    const isFav = favId === c.id;
    const callCount = stats[c.id] || 0;
    const statLabel = callCount > 0 ? `<div class="gadget-stat-label">Called ${callCount} time${callCount !== 1 ? 's' : ''}</div>` : '';
    // G-1 Bond level stars
    const bondLvl = callCount >= 50 ? 5 : callCount >= 25 ? 4 : callCount >= 10 ? 3 : callCount >= 5 ? 2 : callCount >= 1 ? 1 : 0;
    const bondHtml = bondLvl > 0
      ? `<div class="gadget-bond-stars" title="Bond level ${bondLvl}/5">` +
        '★'.repeat(bondLvl) + `<span style="opacity:0.25">${'☆'.repeat(5-bondLvl)}</span></div>`
      : '';
    // P-5: Last called label
    const lastCalledHtml = `<div class="gadget-last-called">${_esc(_lastCalledLabel(c.id))}</div>`;
    const favBadge = `<div class="gadget-fav-badge">⭐ Favorite</div>`;
    const note = notes[c.id] || '';
    const noteBadge = note ? `<span class="gadget-note-badge" title="Note attached">📝</span>` : '';

    // Back face: vibe + bestFor + tryAsking + notes
    const bestForHtml = (c.bestFor || []).slice(0, 3).map(b => `<div class="gadget-back-item">${_esc(b)}</div>`).join('');
    const tryHtml = (c.tryAsking || []).slice(0, 3).map(q => `<div class="gadget-back-try">"${_esc(q)}"</div>`).join('');

    const card = document.createElement('div');
    card.className = 'gadget-card' + (isFav ? ' gadget-card-pinned' : '');
    card.style.setProperty('--accent', accent);
    // Store searchable text for U-5 filter
    card.dataset.search = (displayN + ' ' + (c.goodAt || []).join(' ')).toLowerCase();
    card.innerHTML = `
      <div class="gadget-card-inner">
        <div class="gadget-card-face gadget-card-front">
          ${noteBadge}
          <button type="button" class="gadget-fav-btn${isFav ? ' active' : ''}" title="${isFav ? 'Unpin favorite' : 'Pin as favorite'}">${isFav ? '⭐' : '☆'}</button>
          ${_avatarHtml(c.id, c.avatar)}
          <div class="gadget-card-body">
            ${favBadge}
            <div class="gadget-name gadget-name-editable" title="Double-click to rename" data-charid="${_esc(c.id)}">${_esc(displayN)}</div>
            ${bondHtml}
            ${lastCalledHtml}
            <div class="gadget-tagline">${_esc(c.tagline || '')}</div>
            ${statLabel}
            <div class="gadget-chips">${chips}</div>
            ${pairsHtml}
          </div>
          <button type="button" class="gadget-call-btn" data-char="${_esc(c.id)}">Call ${_esc(displayN)}</button>
          <span class="gadget-flip-hint">tap to flip ↻</span>
        </div>
        <div class="gadget-card-face gadget-card-back">
          <div class="gadget-back-header">
            <span class="gadget-back-avatar">${_esc(c.avatar || '✨')}</span>
            <span class="gadget-back-name">${_esc(displayN)}</span>
          </div>
          ${c.vibe ? `<div class="gadget-back-vibe">${_esc(c.vibe)}</div>` : ''}
          ${bestForHtml ? `<div class="gadget-back-section">Best for</div>${bestForHtml}` : ''}
          ${tryHtml ? `<div class="gadget-back-section">Try asking</div>${tryHtml}` : ''}
          <div class="gadget-back-section">My notes</div>
          <textarea class="gadget-note-input" placeholder="Notes about ${_esc(displayN)}..." data-charid="${_esc(c.id)}">${_esc(note)}</textarea>
          <button type="button" class="gadget-call-btn gadget-back-call" data-char="${_esc(c.id)}">Call ${_esc(displayN)} →</button>
        </div>
      </div>
    `;

    // 3.4 — Flip on card click (not on buttons/textarea/name edit)
    const inner = card.querySelector('.gadget-card-inner');
    inner.addEventListener('click', e => {
      if (e.target.closest('button') || e.target.closest('textarea') || e.target.closest('.gadget-name-editable')) return;
      inner.classList.toggle('flipped');
    });
    card.querySelectorAll('.gadget-call-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _call(c.id); });
    });
    card.querySelector('.gadget-fav-btn').addEventListener('click', e => {
      e.stopPropagation();
      _toggleFav(c.id);
      _render();
      _updateSidebarFav();
    });

    // P-1: Double-click name to edit nickname
    const nameEl = card.querySelector('.gadget-name-editable');
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      const current = nicks[c.id] || c.name;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'gadget-nickname-input';
      input.value = current;
      input.maxLength = 24;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const save = () => {
        const val = input.value.trim();
        _setNickname(c.id, val === c.name ? '' : val);
        _render();
      };
      input.addEventListener('blur', save);
      input.addEventListener('keydown', e2 => {
        if (e2.key === 'Enter') { e2.preventDefault(); save(); }
        if (e2.key === 'Escape') { input.replaceWith(nameEl); }
      });
    });

    grid.appendChild(card);
  }

  // "Back to Doraemon" reset card.
  const reset = document.createElement('div');
  reset.className = 'gadget-card gadget-card-reset';
  reset.dataset.search = 'doraemon default reset';
  reset.style.setProperty('--accent', '#00a0e9');
  reset.innerHTML = `
    ${_avatarHtml('doraemon', '🔵')}
    <div class="gadget-card-body">
      <div class="gadget-name">Doraemon</div>
      <div class="gadget-tagline">The all-rounder — back to default</div>
      <div class="gadget-chips"><span class="gadget-chip">General help</span></div>
    </div>
    <button type="button" class="gadget-call-btn" id="gadget-reset-btn">Back to Doraemon</button>
  `;
  reset.querySelector('#gadget-reset-btn').addEventListener('click', _backToDoraemon);
  grid.appendChild(reset);
}

// ── U-5: Gadget Pocket filter bar ────────────────────────────────
function _renderFilterBar(grid) {
  const existing = document.getElementById('gadget-filter-bar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'gadget-filter-bar';
  bar.className = 'gadget-filter-bar';
  bar.innerHTML = '<input type="text" id="gadget-filter-input" class="gadget-filter-input" placeholder="🔍 Filter by name or skill…" autocomplete="off" />';
  grid.parentElement.insertBefore(bar, grid);
  bar.querySelector('input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    grid.querySelectorAll('.gadget-card').forEach(card => {
      const search = card.dataset.search || '';
      card.style.display = (!q || search.includes(q)) ? '' : 'none';
    });
  });
}

// ── 5.2 Sidebar favorite shortcut ─────────────────────────────────
function _updateSidebarFav() {
  const container = document.getElementById('sidebar-fav-crew-wrap');
  if (!container) return;
  const favId = _getFav();
  if (!favId) { container.innerHTML = ''; return; }
  const tpl = (_crew()).find(c => c.id === favId);
  if (!tpl) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <div class="sidebar-fav-crew" title="Call ${_esc(tpl.name)} (your favorite)">
      <span class="sidebar-fav-crew-avatar">${_esc(tpl.avatar || '⭐')}</span>
      <span class="sidebar-fav-crew-name">${_esc(tpl.name)}</span>
      <span class="sidebar-fav-crew-hint">Favorite</span>
    </div>`;
  container.querySelector('.sidebar-fav-crew').addEventListener('click', () => _call(tpl.id));
}

const gadgetPocketModule = {
  open() {
    const m = document.getElementById(MODAL_ID);
    if (!m) return;
    _render();
    // 5.1 — Notes event delegation (wired once per modal body)
    const body = m.querySelector('.modal-body');
    if (body && !body._notesWired) {
      body._notesWired = true;
      body.addEventListener('input', e => {
        const ta = e.target.closest('.gadget-note-input');
        if (!ta) return;
        const charId = ta.dataset.charid;
        if (!charId) return;
        try {
          const stored = JSON.parse(localStorage.getItem(_NOTES_KEY) || '{}');
          stored[charId] = ta.value;
          localStorage.setItem(_NOTES_KEY, JSON.stringify(stored));
        } catch {}
      });
    }
    // 4.5 — First-time onboarding banner
    if (body && !localStorage.getItem('odysseus-crew-onboarding-v1') && !body.querySelector('.gadget-onboarding-banner')) {
      const banner = document.createElement('div');
      banner.className = 'gadget-onboarding-banner';
      banner.innerHTML = `
        <div class="gadget-onboarding-icon">👋</div>
        <div class="gadget-onboarding-body">
          <div class="gadget-onboarding-title">Meet the Crew!</div>
          <div class="gadget-onboarding-text">15 specialist AI personas, each tuned for a different kind of work.<br>Call one → they become your AI for this conversation.</div>
          <button type="button" class="gadget-onboarding-dismiss">Got it! →</button>
        </div>`;
      banner.querySelector('.gadget-onboarding-dismiss').addEventListener('click', () => {
        localStorage.setItem('odysseus-crew-onboarding-v1', '1');
        banner.classList.add('dismissing');
        setTimeout(() => banner.remove(), 260);
      });
      body.insertBefore(banner, body.firstChild);
    }
    m.classList.remove('hidden');
  },

  close() {
    document.getElementById(MODAL_ID)?.classList.add('hidden');
  },

  isOpen() {
    const m = document.getElementById(MODAL_ID);
    return m && !m.classList.contains('hidden');
  },

  // Programmatic summon used by slash commands (/nobita …).
  call(id) { _call(id); },
  backToDefault() { _backToDoraemon(); },

  // ── U-2: Sidebar character spotlight ─────────────────────────────
  _renderSidebarSpotlight() {
    const section = document.getElementById('doraemon-section');
    if (!section) return;
    const existing = document.getElementById('sidebar-crew-spotlight');
    if (existing) existing.remove();
    const crew = _crew();
    if (!crew.length) return;
    // Rotate daily by day-of-year
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const pick = crew[dayOfYear % crew.length];
    if (!pick) return;
    const el = document.createElement('div');
    el.id = 'sidebar-crew-spotlight';
    el.className = 'sidebar-crew-spotlight';
    el.title = `Today's spotlight: ${pick.name}`;
    el.innerHTML = `<span class="spotlight-emoji">${_esc(pick.avatar || '⭐')}</span>
      <span class="spotlight-text"><strong>${_esc(_getNicknames()[pick.id] || pick.name)}</strong><br>
      <span class="spotlight-sub">${_esc((pick.goodAt || []).slice(0,2).join(', ') || 'All-around helper')}</span></span>
      <button type="button" class="spotlight-call-btn">Call →</button>`;
    el.querySelector('.spotlight-call-btn').addEventListener('click', () => _call(pick.id));
    section.appendChild(el);
  },

  init() {
    const m = document.getElementById(MODAL_ID);
    if (!m) return;
    document.getElementById('close-gadgets-modal')?.addEventListener('click', () => this.close());
    m.addEventListener('click', e => { if (e.target === m) this.close(); });
    _updateSidebarFav();
    // G-4 — update streak on each page load
    _updateStreak();
    // Restore persistent body classes (bubble style, bg pattern, text size, high contrast, reduced motion)
    const bubbleStyle = localStorage.getItem('odysseus-bubble-style-v1');
    if (bubbleStyle) document.body.classList.add('bubble-' + bubbleStyle);
    const bgPattern = localStorage.getItem('odysseus-bg-pattern-v1');
    if (bgPattern && bgPattern !== 'plain') document.body.classList.add('bg-' + bgPattern);
    const textSize = localStorage.getItem('odysseus-text-size-v1');
    const sizeMap = { small: '13px', medium: '15px', large: '17px' };
    if (textSize && sizeMap[textSize]) {
      document.documentElement.style.setProperty('--chat-font-size', sizeMap[textSize]);
      document.body.classList.add('text-' + textSize);
    }
    if (localStorage.getItem('odysseus-high-contrast-v1')) document.body.classList.add('high-contrast');
    if (localStorage.getItem('odysseus-reduced-motion-v1')) document.body.classList.add('reduced-motion');
    // U-4 — Alt+G opens the Gadget Pocket
    document.addEventListener('keydown', e => {
      if (e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        gadgetPocketModule.isOpen() ? gadgetPocketModule.close() : gadgetPocketModule.open();
      }
    });
    // 4.3 Easter egg — Konami code opens the pocket with a special toast
    const _KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let _konamiIdx = 0;
    document.addEventListener('keydown', e => {
      if (e.key === _KONAMI[_konamiIdx]) {
        _konamiIdx++;
        if (_konamiIdx === _KONAMI.length) {
          _konamiIdx = 0;
          gadgetPocketModule.open();
          showToast('🔵 Doraemon\'s secret pocket is open!', { duration: 3500 });
        }
      } else {
        _konamiIdx = 0;
      }
    });
    // U-2 — sidebar daily spotlight
    this._renderSidebarSpotlight();
  },
  getStats() { return getCrewStats(); },
  updateSidebarFav() { _updateSidebarFav(); },
  getCallHistory() { return _getCallHistory(); },
  getNicknames() { return _getNicknames(); },
  getEarnedBadges() { return _getEarnedBadges(); },
  getBadgeDefs() { return _BADGE_DEFS; },
  displayName(c) { return _displayName(c); },
  crew() { return _crew(); },
};

export default gadgetPocketModule;
