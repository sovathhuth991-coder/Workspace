const focusTimerState = {
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  running: false,
  intervalId: null,
  modeLabel: 'Focus Session',
  activePresetMinutes: 25
};

const FOCUS_TIMER_RING_RADIUS = 54;
const FOCUS_TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * FOCUS_TIMER_RING_RADIUS;

function formatTimerDisplay(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function syncFocusTimerPresetButtons() {
  document.querySelectorAll('.timer-preset').forEach(button => {
    const minutes = Number(button.dataset.minutes);
    button.classList.toggle('active', minutes === focusTimerState.activePresetMinutes);
  });
}

function updateFocusTimerDisplay() {
  const display = document.getElementById('focusTimerDisplay');
  const modeLabel = document.getElementById('focusTimerMode');
  const startBtn = document.getElementById('focusTimerStartBtn');
  const ring = document.getElementById('focusTimerRing');
  const panel = document.getElementById('focusTimerPanel');
  const progressRatio = focusTimerState.totalSeconds > 0
    ? focusTimerState.remainingSeconds / focusTimerState.totalSeconds
    : 0;

  if (display) display.textContent = formatTimerDisplay(focusTimerState.remainingSeconds);
  if (modeLabel) modeLabel.textContent = focusTimerState.modeLabel;
  if (startBtn) {
    startBtn.textContent = focusTimerState.running ? 'Pause' : 'Start';
    startBtn.setAttribute('aria-pressed', focusTimerState.running ? 'true' : 'false');
  }
  if (ring) {
    ring.style.strokeDashoffset = `${FOCUS_TIMER_RING_CIRCUMFERENCE * (1 - progressRatio)}`;
  }
  if (panel) {
    panel.classList.toggle('timer-running', focusTimerState.running);
    panel.classList.toggle('timer-finished', !focusTimerState.running && focusTimerState.remainingSeconds === 0);
  }

  syncFocusTimerPresetButtons();
}

function updateFocusTimerTaskLink() {
  const taskLabel = document.getElementById('focusTimerTask');
  if (!taskLabel) return;

  const { current, next } = getSessionSnapshot();
  const linked = current || next;

  if (linked) {
    taskLabel.textContent = `Linked to: ${linked.title} (${linked.start}–${linked.end})`;
  } else {
    taskLabel.textContent = 'Linked to: nothing scheduled now';
  }
}

function setFocusTimerMode(minutes, label) {
  pauseFocusTimer();
  focusTimerState.modeLabel = label;
  focusTimerState.activePresetMinutes = minutes;
  focusTimerState.totalSeconds = minutes * 60;
  focusTimerState.remainingSeconds = minutes * 60;
  updateFocusTimerDisplay();
}

function toggleFocusTimer() {
  if (focusTimerState.running) {
    pauseFocusTimer();
  } else {
    startFocusTimer();
  }
}

function startFocusTimer() {
  if (focusTimerState.intervalId) return;
  if (focusTimerState.remainingSeconds <= 0) {
    focusTimerState.remainingSeconds = focusTimerState.totalSeconds;
  }

  focusTimerState.running = true;
  focusTimerState.intervalId = setInterval(() => {
    focusTimerState.remainingSeconds -= 1;
    updateFocusTimerDisplay();

    if (focusTimerState.remainingSeconds <= 0) {
      focusTimerState.remainingSeconds = 0;
      pauseFocusTimer();
      notifyFocusTimerComplete();
    }
  }, 1000);

  updateFocusTimerDisplay();
}

function pauseFocusTimer() {
  focusTimerState.running = false;
  if (focusTimerState.intervalId) {
    clearInterval(focusTimerState.intervalId);
    focusTimerState.intervalId = null;
  }
  updateFocusTimerDisplay();
}

function resetFocusTimer() {
  pauseFocusTimer();
  focusTimerState.remainingSeconds = focusTimerState.totalSeconds;
  updateFocusTimerDisplay();
}

function notifyFocusTimerComplete() {
  const panel = document.getElementById('focusTimerPanel');
  if (panel) {
    panel.classList.add('timer-complete-flash');
    setTimeout(() => panel.classList.remove('timer-complete-flash'), 1200);
  }

  if (typeof document.hidden !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus timer finished', { body: focusTimerState.modeLabel });
  }
}

const DEFAULT_DASH_TODOS = [
  { id: 'todo_1', text: "Open today's lesson page", done: false },
  { id: 'todo_2', text: 'Add one study block', done: false },
  { id: 'todo_3', text: 'Check off completed tasks', done: false }
];

let dashTodos = JSON.parse(localStorage.getItem('dashTodos') || 'null') || DEFAULT_DASH_TODOS;

function saveDashTodos() {
  localStorage.setItem('dashTodos', JSON.stringify(dashTodos));
}

function renderDashTodos() {
  const containers = document.querySelectorAll('#dashStrikeList, #todoStrikeList');
  containers.forEach(container => {
    if (!container) return;
    container.innerHTML = dashTodos.map(todo => `
      <li>
        <label class="strike-item">
          <input type="checkbox" data-todo-id="${todo.id}" ${todo.done ? 'checked' : ''} onchange="toggleDashTodo('${todo.id}')">
          <span class="checkmark"></span>
          <span class="task-text">${todo.text}</span>
        </label>
      </li>
    `).join('');
  });
}

function toggleDashTodo(todoId) {
  dashTodos = dashTodos.map(todo => todo.id === todoId ? { ...todo, done: !todo.done } : todo);
  saveDashTodos();
  updateDashProgress();
}

function addDashTodo() {
  const text = prompt('New dashboard task:');
  if (!text || !text.trim()) return;
  dashTodos.push({ id: `todo_${Date.now()}`, text: text.trim(), done: false });
  saveDashTodos();
  renderDashTodos();
  updateDashProgress();
}

function updateDashboardStats() {
  const lessonFolderStat = document.getElementById('statLessonFolders');
  const todayTasksStat = document.getElementById('statTodayTasks');
  const libraryStat = document.getElementById('statLibraryItems');
  const todayEvents = getTodayEventsSorted();

  if (lessonFolderStat && typeof hubState !== 'undefined') {
    lessonFolderStat.textContent = String(hubState.folders.length);
  }
  if (todayTasksStat) todayTasksStat.textContent = String(todayEvents.length);
  if (libraryStat) libraryStat.textContent = String(libraryItems.length);
}

function updateDashboardLiveSession() {
  const { current, next, todayEvents } = getSessionSnapshot();
  const sessionTime = document.getElementById('dashSessionTime');
  const sessionTitle = document.getElementById('dashSessionTitle');
  const sessionTag = document.getElementById('dashSessionTag');
  const dashNext = document.getElementById('dashNextSession');

  if (current) {
    if (sessionTime) sessionTime.textContent = `${current.start} – ${current.end}`;
    if (sessionTitle) sessionTitle.textContent = current.title;
    if (sessionTag) {
      sessionTag.textContent = (current.category || 'study').toUpperCase();
      sessionTag.className = `session-tag badge-${current.category || 'study'}`;
    }
  } else if (todayEvents.length === 0) {
    if (sessionTime) sessionTime.textContent = 'Today';
    if (sessionTitle) sessionTitle.textContent = 'No tasks scheduled yet';
    if (sessionTag) {
      sessionTag.textContent = 'Add a block';
      sessionTag.className = 'session-tag';
    }
  } else if (next) {
    if (sessionTime) sessionTime.textContent = 'Now';
    if (sessionTitle) sessionTitle.textContent = 'Between sessions';
    if (sessionTag) {
      sessionTag.textContent = 'Free time';
      sessionTag.className = 'session-tag';
    }
  } else {
    if (sessionTime) sessionTime.textContent = 'Done';
    if (sessionTitle) sessionTitle.textContent = 'All tasks complete for today';
    if (sessionTag) {
      sessionTag.textContent = 'Great work';
      sessionTag.className = 'session-tag';
    }
  }

  if (dashNext) {
    if (next) {
      dashNext.textContent = `${next.start} — ${next.title}`;
    } else if (current) {
      dashNext.textContent = 'Nothing else queued after this block';
    } else if (todayEvents.length === 0) {
      dashNext.textContent = 'Open Weekly Schedule to plan your day';
    } else {
      dashNext.textContent = 'Enjoy the rest of your day';
    }
  }

  updateQuickJumpLinks();
  updateFocusTimerTaskLink();
  updateDashboardStats();
  updateDashProgress(false);
}

function updateQuickJumpLinks() {
  const recentLessons = document.getElementById('dashRecentLessons');
  const recentLibs = document.getElementById('dashRecentLibs');
  const activePage = hubState?.pages?.[hubState?.activePageId];

  if (recentLessons && activePage) {
    recentLessons.innerHTML = `<span style="color:#e2e8f0;font-size:0.9rem">📄 ${activePage.title}</span>`;
  } else if (recentLessons) {
    recentLessons.innerHTML = `<span style="color:#475569;font-size:0.85rem">No open lesson</span>`;
  }

  if (recentLibs && libraryItems.length > 0) {
    const recent = libraryItems.slice(-3).reverse();
    recentLibs.innerHTML = recent.map(item => `<a href="${item.url}" target="_blank" style="color:#38bdf8;text-decoration:none;font-size:0.8rem;display:block;padding:2px 0">🔗 ${item.title}</a>`).join('');
  } else if (recentLibs) {
    recentLibs.innerHTML = `<span style="color:#475569;font-size:0.85rem">No bookmarks yet</span>`;
  }
}

function initDashboardEngine() {
  const dateDisplay = document.getElementById('dashGreetingDate');
  if (dateDisplay) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const systemDate = new Date().toLocaleDateString('en-US', options);
    const greeting = getTimeGreeting();
    dateDisplay.textContent = `${greeting}! Today is ${systemDate}.`;
  }

  renderDashTodos();
  initFocusTimer();
  updateDashboardLiveSession();
  updateAnalyticsDisplay();
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function initFocusTimer() {
  const panel = document.getElementById('focusTimerPanel');
  const startBtn = document.getElementById('focusTimerStartBtn');
  const resetBtn = document.getElementById('focusTimerResetBtn');
  const ring = document.getElementById('focusTimerRing');

  if (ring) {
    ring.style.strokeDasharray = `${FOCUS_TIMER_RING_CIRCUMFERENCE}`;
    ring.style.strokeDashoffset = '0';
  }

  startBtn?.addEventListener('click', toggleFocusTimer);
  resetBtn?.addEventListener('click', resetFocusTimer);

  document.querySelectorAll('.timer-preset').forEach(button => {
    button.addEventListener('click', () => {
      setFocusTimerMode(Number(button.dataset.minutes), button.dataset.label);
    });
  });

  panel?.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === 'open-today') {
      openDayDiagram(getTodayName());
    }
  });

  window.toggleFocusTimer = toggleFocusTimer;
  window.resetFocusTimer = resetFocusTimer;
  window.setFocusTimerMode = setFocusTimerMode;

  updateFocusTimerDisplay();
  updateFocusTimerTaskLink();
}

function updateDashProgress(saveFromDom = true) {
  if (saveFromDom) {
    document.querySelectorAll("input[type='checkbox'][data-todo-id]").forEach(box => {
      const todoId = box.dataset.todoId;
      const todo = dashTodos.find(item => item.id === todoId);
      if (todo) todo.done = box.checked;
    });
    saveDashTodos();
  }

  const todayEvents = getTodayEventsSorted();
  const todoDoneCount = dashTodos.filter(todo => todo.done).length;
  const todoTotal = dashTodos.length;

  let computedPercentage = 0;
  let statLabel = `${todoDoneCount} / ${todoTotal}`;

  if (todayEvents.length > 0) {
    const scheduleDone = todayEvents.filter(event => event.completed).length;
    computedPercentage = Math.round((scheduleDone / todayEvents.length) * 100);
    statLabel = `${scheduleDone} / ${todayEvents.length} today`;
  } else if (todoTotal > 0) {
    computedPercentage = Math.round((todoDoneCount / todoTotal) * 100);
  }

  const fillBar = document.getElementById('dashProgressBar');
  const percentLabel = document.getElementById('dashProgressPercent');
  const dynamicNodeCounter = document.getElementById('statTasksDone');
  const todoCountEl = document.getElementById('todoCount');
  const todoDoneEl = document.getElementById('todoDoneCount');
  const todoPercentEl = document.getElementById('todoPercent');

  if (fillBar) fillBar.style.width = `${computedPercentage}%`;
  if (percentLabel) percentLabel.textContent = `${computedPercentage}%`;
  if (dynamicNodeCounter) dynamicNodeCounter.textContent = statLabel;
  if (todoCountEl) todoCountEl.textContent = String(todoTotal);
  if (todoDoneEl) todoDoneEl.textContent = String(todoDoneCount);
  if (todoPercentEl) todoPercentEl.textContent = `${computedPercentage}%`;
}

function updateAnalyticsDisplay() {
  const analytics = getAnalytics();
  const totalEl = document.getElementById('analyticsTotalEvents');
  const completionEl = document.getElementById('analyticsCompletionRate');
  const weekEl = document.getElementById('analyticsWeekEvents');
  const studyTimeEl = document.getElementById('analyticsStudyTime');
  const optimalEl = document.getElementById('analyticsOptimalTimes');
  const conflictsEl = document.getElementById('analyticsConflicts');

  if (totalEl) totalEl.textContent = analytics.totalEvents;
  if (completionEl) completionEl.textContent = `${Math.round(analytics.completionRate)}%`;
  if (weekEl) weekEl.textContent = analytics.weekEvents;
  if (studyTimeEl) {
    const hours = Math.floor(analytics.totalStudyTime / 60);
    const mins = analytics.totalStudyTime % 60;
    studyTimeEl.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  if (optimalEl) {
    const optimalTimes = getOptimalStudyTimes();
    optimalEl.textContent = optimalTimes.length > 0 ? optimalTimes.join(', ') : 'Not enough data yet';
  }

  if (conflictsEl) {
    const conflicts = detectSchedulingConflicts();
    if (conflicts.length > 0) {
      conflictsEl.innerHTML = conflicts.slice(0, 3).map(c => `<div style="margin-bottom:8px;padding:8px;background:rgba(251,146,60,0.1);border-left:3px solid #fb923c;border-radius:4px;"><strong>${c.event1.title}</strong> overlaps with <strong>${c.event2.title}</strong><br><small style="color:#94a3b8;">${c.suggestion}</small></div>`).join('');
    } else {
      conflictsEl.textContent = '✓ No conflicts detected';
    }
  }
}

function initDashboard() {
  renderDashTodos();
  updateDashProgress(false);
}

window.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  initFocusTimer();
  updateDashboardLiveSession();
  updateAnalyticsDisplay();
});
