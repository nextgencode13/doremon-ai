/**
 * Copyright (c) 2026 Doremon AI
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
const STORAGE_KEY = 'doremon_pomodoro';

const DEFAULT = { workMin: 25, breakMin: 5, sessions: 4 };

let _state = null; // loaded lazily
let _interval = null;

function _loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function _saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
}

function _freshState(cfg = {}) {
  return {
    workMin: cfg.workMin ?? DEFAULT.workMin,
    breakMin: cfg.breakMin ?? DEFAULT.breakMin,
    targetSessions: cfg.targetSessions ?? DEFAULT.sessions,
    phase: 'work',       // 'work' | 'break'
    secondsLeft: (cfg.workMin ?? DEFAULT.workMin) * 60,
    running: false,
    sessionsDone: 0,
    focusTask: '',
    log: [],             // [{task, sessions, date}]
  };
}

function _getState() {
  if (!_state) {
    const saved = _loadState();
    _state = saved ?? _freshState();
  }
  return _state;
}

function _badge() { return document.getElementById('pomodoro-badge'); }
function _modal() { return document.getElementById('pomodoro-modal'); }

function _fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function _updateBadge() {
  const b = _badge();
  if (!b) return;
  const st = _getState();
  if (st.running || st.secondsLeft < st[st.phase === 'work' ? 'workMin' : 'breakMin'] * 60) {
    b.classList.remove('hidden');
    const icon = st.phase === 'work' ? '🍅' : '☕';
    b.textContent = `${icon} ${_fmt(st.secondsLeft)}`;
    b.title = st.phase === 'work' ? 'Pomodoro — click to manage' : 'Break time!';
  } else {
    b.classList.add('hidden');
  }
}

function _updateModal() {
  const m = _modal();
  if (!m || m.classList.contains('hidden')) return;
  const st = _getState();

  const setVal = (id, v) => { const el = m.querySelector(`#${id}`); if (el) el.value = v; };
  const setText = (id, v) => { const el = m.querySelector(`#${id}`); if (el) el.textContent = v; };

  setVal('pom-work-min', st.workMin);
  setVal('pom-break-min', st.breakMin);
  setVal('pom-target-sessions', st.targetSessions);
  setVal('pom-focus-task', st.focusTask || '');

  const timeEl = m.querySelector('#pom-timer-display');
  if (timeEl) {
    timeEl.textContent = _fmt(st.secondsLeft);
    timeEl.className = `pom-timer-display pom-phase-${st.phase}`;
  }

  setText('pom-phase-label', st.phase === 'work' ? '🍅 Work' : '☕ Break');
  setText('pom-session-count', `Session ${st.sessionsDone + 1} / ${st.targetSessions}`);

  const startBtn = m.querySelector('#pom-start-btn');
  if (startBtn) startBtn.textContent = st.running ? 'Pause' : 'Start';
}

function _tick() {
  const st = _getState();
  if (!st.running) return;

  st.secondsLeft -= 1;

  if (st.secondsLeft <= 0) {
    if (st.phase === 'work') {
      st.sessionsDone += 1;
      if (st.sessionsDone >= st.targetSessions) {
        // All sessions done
        st.running = false;
        st.phase = 'work';
        st.secondsLeft = st.workMin * 60;
        st.log.push({ task: st.focusTask, sessions: st.sessionsDone, date: new Date().toISOString().slice(0, 10) });
        st.sessionsDone = 0;
        _notify('All Pomodoros done! Great work 🎉', st.focusTask || 'You completed your focus session.');
        _stopInterval();
      } else {
        // Start break
        st.phase = 'break';
        st.secondsLeft = st.breakMin * 60;
        _notify('Break time! ☕', 'Take a short break, then get back to it.');
      }
    } else {
      // Break done → next work
      st.phase = 'work';
      st.secondsLeft = st.workMin * 60;
      _notify('Back to work! 🍅', 'Break\'s over. You got this!');
    }
  }

  _saveState(st);
  _updateBadge();
  _updateModal();
}

function _startInterval() {
  if (_interval) return;
  _interval = setInterval(_tick, 1000);
}

function _stopInterval() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

function _notify(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/static/icons/doraemon-ai.png' });
  }
}

function _requestNotifPermission() {
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

const pomodoroModule = {
  init() {
    _requestNotifPermission();
    _updateBadge();

    const badge = _badge();
    if (badge) badge.addEventListener('click', () => this.openModal());

    const m = _modal();
    if (!m) return;

    m.querySelector('#close-pom-modal')?.addEventListener('click', () => this.closeModal());
    m.addEventListener('click', (e) => { if (e.target === m) this.closeModal(); });

    m.querySelector('#pom-start-btn')?.addEventListener('click', () => this.toggle());
    m.querySelector('#pom-reset-btn')?.addEventListener('click', () => this.reset());

    m.querySelector('#pom-focus-task')?.addEventListener('input', (e) => {
      _getState().focusTask = e.target.value;
      _saveState(_getState());
    });

    const applySettings = () => {
      const st = _getState();
      const workVal = parseInt(m.querySelector('#pom-work-min')?.value) || DEFAULT.workMin;
      const breakVal = parseInt(m.querySelector('#pom-break-min')?.value) || DEFAULT.breakMin;
      const sessVal = parseInt(m.querySelector('#pom-target-sessions')?.value) || DEFAULT.sessions;
      const changed = workVal !== st.workMin || breakVal !== st.breakMin || sessVal !== st.targetSessions;
      if (changed && !st.running) {
        st.workMin = workVal;
        st.breakMin = breakVal;
        st.targetSessions = sessVal;
        if (st.phase === 'work') st.secondsLeft = workVal * 60;
        else st.secondsLeft = breakVal * 60;
        _saveState(st);
        _updateBadge();
        _updateModal();
      }
    };
    ['pom-work-min', 'pom-break-min', 'pom-target-sessions'].forEach(id => {
      m.querySelector(`#${id}`)?.addEventListener('change', applySettings);
    });

    m.querySelector('#pom-focus-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('focus-mode');
    });

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
  },

  openModal() {
    const m = _modal();
    if (!m) return;
    m.classList.remove('hidden');
    _updateModal();
  },

  closeModal() {
    const m = _modal();
    if (m) m.classList.add('hidden');
  },

  toggle() {
    const st = _getState();
    if (st.running) {
      st.running = false;
      _stopInterval();
    } else {
      st.running = true;
      _startInterval();
    }
    _saveState(st);
    _updateBadge();
    _updateModal();
  },

  reset() {
    _stopInterval();
    const st = _getState();
    const fresh = _freshState({ workMin: st.workMin, breakMin: st.breakMin, targetSessions: st.targetSessions });
    fresh.focusTask = st.focusTask;
    fresh.log = st.log;
    _state = fresh;
    _saveState(_state);
    _updateBadge();
    _updateModal();
  },

  isOpen() {
    const m = _modal();
    return m && !m.classList.contains('hidden');
  },
};

export default pomodoroModule;
