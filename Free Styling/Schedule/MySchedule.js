const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let events = JSON.parse(localStorage.getItem("scheduleEvents")) || [];
let currentOpenDay = null;
let typingTimer;

// ==========================================
// 🎨 THEME SYSTEM
// ==========================================
const THEMES = {
  cyberpunk: {
    name: 'Cyberpunk',
    primary: '#38bdf8',
    secondary: '#a855f7',
    background: '#030712',
    surface: '#0f172a',
    text: '#f8fafc',
    accent: '#34d399'
  },
  minimal: {
    name: 'Minimal',
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    accent: '#10b981'
  },
  ocean: {
    name: 'Ocean',
    primary: '#0ea5e9',
    secondary: '#06b6d4',
    background: '#0c1929',
    surface: '#1e293b',
    text: '#e2e8f0',
    accent: '#14b8a6'
  },
  sunset: {
    name: 'Sunset',
    primary: '#f97316',
    secondary: '#ec4899',
    background: '#1a1a2e',
    surface: '#16213e',
    text: '#f8fafc',
    accent: '#fbbf24'
  },
  forest: {
    name: 'Forest',
    primary: '#22c55e',
    secondary: '#14b8a6',
    background: '#0a1810',
    surface: '#1a2e23',
    text: '#e2e8f0',
    accent: '#84cc16'
  },
  midnight: {
    name: 'Midnight',
    primary: '#818cf8',
    secondary: '#c084fc',
    background: '#0f0f1e',
    surface: '#1a1a2e',
    text: '#f8fafc',
    accent: '#f472b6'
  }
};

let currentTheme = localStorage.getItem('currentTheme') || 'cyberpunk';

function applyTheme(themeName) {
  const theme = THEMES[themeName];
  if (!theme) return;

  currentTheme = themeName;
  localStorage.setItem('currentTheme', themeName);

  const root = document.documentElement;
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-secondary', theme.secondary);
  root.style.setProperty('--theme-background', theme.background);
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-text', theme.text);
  root.style.setProperty('--theme-accent', theme.accent);

  updateThemeSelector();
}

function updateThemeSelector() {
  const scheduleSelector = document.getElementById('schedule-theme-selector');
  const lessonsSelector = document.getElementById('lessons-theme-selector');
  const globalSelector = document.getElementById('globalThemeSelector');
  if (scheduleSelector) {
    scheduleSelector.value = currentTheme;
  }
  if (lessonsSelector) {
    lessonsSelector.value = currentTheme;
  }
  if (globalSelector) {
    globalSelector.value = currentTheme;
  }
}

// ==========================================
// 🔔 NOTIFICATION SYSTEM
// ==========================================
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body, icon = '📅') {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body: body,
      icon: icon,
      badge: icon,
      tag: 'schedule-notification',
      requireInteraction: false,
      silent: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  }
}

function checkUpcomingEvents() {
  const { currentHHMM } = getTimeMetrics();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  events.forEach(event => {
    if (event.completed || !event.reminderEnabled) return;

    const [eventHour, eventMin] = event.start.split(':').map(Number);
    const eventMinutes = eventHour * 60 + eventMin;
    const reminderMinutes = event.reminderMinutes || 15;

    if (eventMinutes - currentMinutes === reminderMinutes &&
        !event.reminderShown &&
        event.day === getTodayName()) {
      event.reminderShown = true;
      saveEvents();

      sendNotification(
        `⏰ Reminder: ${event.title}`,
        `Starts in ${reminderMinutes} minutes (${event.start})`,
        '⏰'
      );
    }
  });
}

// Check reminders every minute
setInterval(checkUpcomingEvents, 60000);

// ==========================================
// ↩️ UNDO/REDO SYSTEM
// ==========================================
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STEPS = 20;

function saveStateForUndo() {
  undoStack.push(JSON.stringify(events));
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }
  redoStack = [];
  updateUndoRedoButtons();
}

function undo() {
  if (undoStack.length === 0) return;

  redoStack.push(JSON.stringify(events));
  events = JSON.parse(undoStack.pop());
  saveEvents();
  renderSchedule();
  updateUndoRedoButtons();
  showToast('Undo successful', 'info');
}

function redo() {
  if (redoStack.length === 0) return;

  undoStack.push(JSON.stringify(events));
  events = JSON.parse(redoStack.pop());
  saveEvents();
  renderSchedule();
  updateUndoRedoButtons();
  showToast('Redo successful', 'info');
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');

  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// ==========================================
// 🔔 TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==========================================
// 📊 ANALYTICS ENGINE
// ==========================================
function getAnalytics() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const weekEvents = events.filter(e => new Date(e.day) >= weekStart);
  const monthEvents = events.filter(e => new Date(e.day) >= monthStart);

  const categoryBreakdown = {};
  events.forEach(event => {
    const cat = event.category || 'study';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
  });

  const totalStudyTime = events
    .filter(e => !e.completed)
    .reduce((total, e) => {
      const [startH, startM] = e.start.split(':').map(Number);
      const [endH, endM] = e.end.split(':').map(Number);
      return total + ((endH * 60 + endM) - (startH * 60 + startM));
    }, 0);

  const productiveHours = {};
  events.forEach(event => {
    const hour = parseInt(event.start.split(':')[0]);
    productiveHours[hour] = (productiveHours[hour] || 0) + 1;
  });

  return {
    totalEvents: events.length,
    completedEvents: events.filter(e => e.completed).length,
    weekEvents: weekEvents.length,
    monthEvents: monthEvents.length,
    categoryBreakdown,
    totalStudyTime,
    completionRate: events.length > 0 ? (events.filter(e => e.completed).length / events.length * 100) : 0,
    productiveHours,
    averageEventsPerDay: events.length / 7
  };
}

// ==========================================
// 🎯 SMART SUGGESTIONS ENGINE
// ==========================================
function getOptimalStudyTimes() {
  const productiveHours = {};
  events.forEach(event => {
    if (event.completed) return;
    const hour = parseInt(event.start.split(':')[0]);
    const [startH, startM] = event.start.split(':').map(Number);
    const [endH, endM] = event.end.split(':').map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM);

    if (!productiveHours[hour]) {
      productiveHours[hour] = { count: 0, totalDuration: 0 };
    }
    productiveHours[hour].count++;
    productiveHours[hour].totalDuration += duration;
  });

  const sorted = Object.entries(productiveHours)
    .sort((a, b) => b[1].totalDuration - a[1].totalDuration)
    .slice(0, 3)
    .map(([hour]) => `${hour}:00 - ${parseInt(hour) + 1}:00`);

  return sorted;
}

function detectSchedulingConflicts() {
  const conflicts = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (events[i].day === events[j].day && eventsOverlap(events[i], events[j])) {
        conflicts.push({
          event1: events[i],
          event2: events[j],
          suggestion: `Consider moving "${events[j].title}" to avoid overlap with "${events[i].title}"`
        });
      }
    }
  }

  return conflicts;
}
function selectEventColor(element, colorKey) {
  document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
}

// ==========================================
// 🔄 RECURRING EVENTS ENGINE
// ==========================================
function generateRecurringEvents(baseEvent) {
  const events = [];
  const { frequency, interval, endDate } = baseEvent.recurrence || {};

  if (!frequency) return [baseEvent];

  const startDate = new Date(baseEvent.day);
  const end = endDate ? new Date(endDate) : new Date(startDate);
  end.setMonth(end.getMonth() + 3); // Max 3 months ahead

  let currentDate = new Date(startDate);
  let count = 0;
  const maxOccurrences = 50; // Safety limit

  while (currentDate <= end && count < maxOccurrences) {
    if (currentDate >= startDate) {
      const recurringEvent = {
        ...baseEvent,
        id: `${baseEvent.id}_${count}`,
        day: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        originalEventId: baseEvent.id,
        isRecurring: true
      };
      events.push(recurringEvent);
    }

    // Advance date based on frequency
    switch (frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + (interval || 1));
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7 * (interval || 1));
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + (interval || 1));
        break;
    }

    count++;
  }

  return events;
}

// ==========================================
// 🖱️ DRAG AND DROP SYSTEM
// ==========================================
let draggedEvent = null;

function initDragAndDrop() {
  document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('draggable-event')) {
      draggedEvent = e.target.dataset.eventId;
      e.target.style.opacity = '0.5';
    }
  });

  document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('draggable-event')) {
      e.target.style.opacity = '1';
      draggedEvent = null;
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dayBox = e.target.closest('.day');
    if (dayBox) {
      dayBox.style.borderColor = 'var(--theme-primary)';
    }
  });

  document.addEventListener('dragleave', (e) => {
    const dayBox = e.target.closest('.day');
    if (dayBox) {
      dayBox.style.borderColor = '';
    }
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const dayBox = e.target.closest('.day');
    if (dayBox && draggedEvent) {
      const newDay = dayBox.querySelector('h3').textContent.replace('⭐️', '').trim();
      const event = events.find(ev => ev.id == draggedEvent);
      if (event) {
        saveStateForUndo();
        event.day = newDay;
        saveEvents();
        renderSchedule();
        showToast(`Event moved to ${newDay}`, 'success');
      }
      dayBox.style.borderColor = '';
    }
  });
}
// ==========================================
// 📱 PWA & OFFLINE SUPPORT
// ==========================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // Create inline service worker
    const swCode = `
      self.addEventListener('install', (e) => {
        self.skipWaiting();
      });

      self.addEventListener('activate', (e) => {
        e.waitUntil(self.clients.claim());
      });

      self.addEventListener('fetch', (e) => {
        if (e.request.mode === 'navigate') {
          e.respondWith(
            fetch(e.request).catch(() => caches.match('/'))
          );
        }
      });
    `;

    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);

    navigator.serviceWorker.register(swUrl)
      .then(() => showToast('Offline mode enabled', 'success'))
      .catch(() => console.log('PWA not supported'));
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  requestNotificationPermission();
  initDragAndDrop();
  applyTheme(currentTheme);
  registerServiceWorker();
  checkUpcomingEvents();

  // Request notification permission on first user interaction
  document.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, { once: true });
});

function saveEvents() {
  localStorage.setItem("scheduleEvents", JSON.stringify(events));
  updateDashboardLiveSession();
  updateDashboardStats();
}

const DEFAULT_DASH_TODOS = [
  { id: "todo_1", text: "Open today's lesson page", done: false },
  { id: "todo_2", text: "Add one study block", done: false },
  { id: "todo_3", text: "Check off completed tasks", done: false }
];

let dashTodos = JSON.parse(localStorage.getItem("dashTodos") || "null") || DEFAULT_DASH_TODOS;

function saveDashTodos() {
  localStorage.setItem("dashTodos", JSON.stringify(dashTodos));
}

function getTodayEventsSorted(includeCompleted = true) {
  const todayName = getTodayName();
  return events
    .filter(event => event.day === todayName && (includeCompleted || !event.completed))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function getSessionSnapshot() {
  const { todayName, currentHHMM } = getTimeMetrics();
  const todayEvents = events
    .filter(event => event.day === todayName)
    .sort((a, b) => a.start.localeCompare(b.start));

  const current = todayEvents.find(event =>
    !event.completed && currentHHMM >= event.start && currentHHMM <= event.end
  );

  const next = todayEvents.find(event =>
    !event.completed && event.start > currentHHMM
  );

  return { todayName, currentHHMM, todayEvents, current, next };
}

function validateTaskTimes(startTime, endTime, day, excludeId = null) {
  const issues = [];

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    issues.push({ type: "error", message: "End time must be after start time." });
  }

  const candidate = { start: startTime, end: endTime };
  const conflicts = events.filter(event =>
    event.day === day &&
    event.id !== excludeId &&
    eventsOverlap(candidate, event)
  );

  if (conflicts.length > 0) {
    issues.push({
      type: "warn",
      message: `Overlaps with: ${conflicts.map(event => event.title).join(", ")}`
    });
  }

  return issues;
}

function updateModalFormFeedback(day) {
  const feedback = document.getElementById("modal-form-feedback");
  const startHour = document.getElementById("startHour");
  const startMin = document.getElementById("startMin");
  const endHour = document.getElementById("endHour");
  const endMin = document.getElementById("endMin");

  if (!feedback || !startHour || !startMin || !endHour || !endMin) return;

  const startTime = `${startHour.value}:${startMin.value}`;
  const endTime = `${endHour.value}:${endMin.value}`;
  const issues = validateTaskTimes(startTime, endTime, day);

  if (issues.length === 0) {
    feedback.innerHTML = "";
    return;
  }

  feedback.innerHTML = issues.map(issue =>
    `<p class="form-feedback-${issue.type}">${issue.message}</p>`
  ).join("");
}

function bindModalFormValidation(day) {
  updateModalFormFeedback(day);
}

const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const WHEEL_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
let wheelScrollTimer = null;

function buildWheelItems(values) {
  const padding = `<div class="wheel-item wheel-spacer" aria-hidden="true"></div>`.repeat(2);
  const items = values.map(value => `<div class="wheel-item" data-value="${value}">${value}</div>`).join("");
  return `${padding}${items}${padding}`;
}

function buildTimeWheelGroup(prefix, label, defaultHour, defaultMinute) {
  return `
    <div class="time-field-block">
      <label>${label}</label>
      <div class="time-wheel-group" data-time-prefix="${prefix}">
        <input type="hidden" id="${prefix}Hour" value="${defaultHour}">
        <input type="hidden" id="${prefix}Min" value="${defaultMinute}">
        <div class="wheel-picker">
          <div class="wheel-selection-bar" aria-hidden="true"></div>
          <div class="wheel-columns">
            <div class="wheel-column">
              <div class="wheel-scroll" data-wheel-type="hour">${buildWheelItems(WHEEL_HOURS)}</div>
            </div>
            <div class="wheel-separator">:</div>
            <div class="wheel-column">
              <div class="wheel-scroll" data-wheel-type="min">${buildWheelItems(WHEEL_MINUTES)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getDefaultWheelTimes() {
  const now = new Date();
  const startHour = String(now.getHours()).padStart(2, "0");
  const startMin = String(now.getMinutes()).padStart(2, "0");
  const endHour = String((now.getHours() + 1) % 24).padStart(2, "0");
  return { startHour, startMin, endHour, endMin: startMin };
}

function getWheelItems(scrollEl) {
  return Array.from(scrollEl.querySelectorAll(".wheel-item:not(.wheel-spacer)"));
}

function scrollWheelToIndex(scrollEl, index, smooth = false) {
  const items = getWheelItems(scrollEl);
  const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
  scrollEl.scrollTo({
    top: clampedIndex * WHEEL_ITEM_HEIGHT,
    behavior: smooth ? "smooth" : "auto"
  });
  return items[clampedIndex];
}

function syncWheelColumn(scrollEl, group, smooth = false) {
  const type = scrollEl.dataset.wheelType;
  const prefix = group.dataset.timePrefix;
  const hiddenInput = document.getElementById(type === "hour" ? `${prefix}Hour` : `${prefix}Min`);
  if (!hiddenInput) return;

  const items = getWheelItems(scrollEl);
  if (items.length === 0) return;

  const activeIndex = Math.max(0, Math.min(Math.round(scrollEl.scrollTop / WHEEL_ITEM_HEIGHT), items.length - 1));
  scrollWheelToIndex(scrollEl, activeIndex, smooth);

  items.forEach((item, index) => {
    item.classList.toggle("is-active", index === activeIndex);
  });

  hiddenInput.value = items[activeIndex].dataset.value;

  const form = document.getElementById("modalScheduleForm");
  const day = form?.dataset.plannerDay || currentOpenDay;
  if (day) updateModalFormFeedback(day);
}

function setTimeWheelValues(prefix, hour, minute) {
  const hourInput = document.getElementById(`${prefix}Hour`);
  const minInput = document.getElementById(`${prefix}Min`);
  const group = document.querySelector(`.time-wheel-group[data-time-prefix="${prefix}"]`);

  if (hourInput) hourInput.value = hour;
  if (minInput) minInput.value = minute;
  if (!group) return;

  group.querySelectorAll(".wheel-scroll").forEach(scrollEl => {
    const type = scrollEl.dataset.wheelType;
    const targetValue = type === "hour" ? hour : minute;
    const items = getWheelItems(scrollEl);
    const targetIndex = items.findIndex(item => item.dataset.value === targetValue);
    if (targetIndex >= 0) scrollWheelToIndex(scrollEl, targetIndex, false);
    syncWheelColumn(scrollEl, group, false);
  });
}

function initTimeWheelPickers(day) {
  const defaults = getDefaultWheelTimes();

  document.querySelectorAll(".time-wheel-group").forEach(group => {
    const prefix = group.dataset.timePrefix;
    const hourInput = document.getElementById(`${prefix}Hour`);
    const minInput = document.getElementById(`${prefix}Min`);

    setTimeWheelValues(
      prefix,
      hourInput?.value || (prefix === "end" ? defaults.endHour : defaults.startHour),
      minInput?.value || (prefix === "end" ? defaults.endMin : defaults.startMin)
    );

    group.querySelectorAll(".wheel-scroll").forEach(scrollEl => {
      if (scrollEl.dataset.wheelBound === "1") return;
      scrollEl.dataset.wheelBound = "1";

      scrollEl.addEventListener("scroll", () => {
        clearTimeout(wheelScrollTimer);
        wheelScrollTimer = setTimeout(() => syncWheelColumn(scrollEl, group, true), 80);
      }, { passive: true });

      getWheelItems(scrollEl).forEach((item, index) => {
        item.addEventListener("click", () => {
          scrollWheelToIndex(scrollEl, index, true);
          syncWheelColumn(scrollEl, group, false);
        });
      });
    });
  });

  bindModalFormValidation(day);
}

function debouncedSaveAndRenderSchedule() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    saveEvents();
    renderSchedule();
  }, 500);
}

function captureFocusedEditable() {
  const active = document.activeElement;
  if (!active) return null;
  if (!active.classList.contains('editable-time') && !active.classList.contains('editable-content')) return null;
  const row = active.closest('.notion-row-node');
  if (!row) return null;
  const index = Number(row.dataset.index);
  return {
    index,
    isTime: active.classList.contains('editable-time')
  };
}

function restoreFocusedEditable(state) {
  if (!state) return;
  const selector = `#live-ledger-output .notion-row-node[data-index="${state.index}"] .${state.isTime ? 'editable-time' : 'editable-content'}`;
  const target = document.querySelector(selector);
  if (!target) return;
  target.focus();
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function debouncedRenderLedger() {
  clearTimeout(typingTimer);
  const focusState = captureFocusedEditable();
  typingTimer = setTimeout(() => {
    renderCurriculumLedger();
    restoreFocusedEditable(focusState);
  }, 800);
}

function saveInlineTextOnBlur(index, keyField, activeValue) {
  syncInlineText(index, keyField, activeValue);
  renderCurriculumLedger();
}

function getTimeMetrics() {
  const now = new Date();
  const todayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentHHMM = now.toTimeString().split(' ')[0].substring(0, 5);
  return { todayName, currentHHMM, currentDayIndex: days.indexOf(todayName) };
}

function getTodayName() {
  return getTimeMetrics().todayName;
}

function getAdjacentDay(day, offset) {
  const index = days.indexOf(day);
  if (index === -1) return day;
  return days[(index + offset + days.length) % days.length];
}

function getDayEventCount(day) {
  return events.filter(event => event.day === day).length;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function eventsOverlap(firstEvent, secondEvent) {
  const firstStart = timeToMinutes(firstEvent.start);
  const firstEnd = timeToMinutes(firstEvent.end);
  const secondStart = timeToMinutes(secondEvent.start);
  const secondEnd = timeToMinutes(secondEvent.end);

  const firstEndPoint = firstEnd > firstStart ? firstEnd : firstStart + 1;
  const secondEndPoint = secondEnd > secondStart ? secondEnd : secondStart + 1;

  return firstStart < secondEndPoint && secondStart < firstEndPoint;
}

function getOverlapMap(dayEvents) {
  const overlapMap = new Map();

  for (let i = 0; i < dayEvents.length; i++) {
    for (let j = i + 1; j < dayEvents.length; j++) {
      if (!eventsOverlap(dayEvents[i], dayEvents[j])) continue;

      if (!overlapMap.has(dayEvents[i].id)) overlapMap.set(dayEvents[i].id, []);
      if (!overlapMap.has(dayEvents[j].id)) overlapMap.set(dayEvents[j].id, []);

      overlapMap.get(dayEvents[i].id).push(dayEvents[j].title);
      overlapMap.get(dayEvents[j].id).push(dayEvents[i].title);
    }
  }

  return overlapMap;
}

function dayHasTimeOverlaps(dayEvents) {
  for (let i = 0; i < dayEvents.length; i++) {
    for (let j = i + 1; j < dayEvents.length; j++) {
      if (eventsOverlap(dayEvents[i], dayEvents[j])) return true;
    }
  }
  return false;
}

function autoCompletePastEvents() {
  const { todayName, currentHHMM, currentDayIndex } = getTimeMetrics();
  const nowMinutes = timeToMinutes(currentHHMM);
  let changed = false;

  events = events.map(event => {
    if (event.completed) return event;

    const eventDayIndex = days.indexOf(event.day);

    if (eventDayIndex !== -1 && eventDayIndex < currentDayIndex) {
      changed = true;
      return { ...event, completed: true };
    }

    if (event.day === todayName && nowMinutes >= timeToMinutes(event.end)) {
      changed = true;
      return { ...event, completed: true };
    }

    return event;
  });

  if (changed) saveEvents();
  return changed;
}

const plannerSwipeState = {
  startX: 0,
  startY: 0,
  tracking: false
};

function attachPlannerSwipeHandlers(modal) {
  if (modal.dataset.swipeBound === '1') return;
  modal.dataset.swipeBound = '1';

  modal.addEventListener('touchstart', (e) => {
    if (modal.style.display !== 'flex' || e.touches.length !== 1) return;
    plannerSwipeState.startX = e.touches[0].clientX;
    plannerSwipeState.startY = e.touches[0].clientY;
    plannerSwipeState.tracking = true;
  }, { passive: true });

  modal.addEventListener('touchend', (e) => {
    if (!plannerSwipeState.tracking || !currentOpenDay) return;
    plannerSwipeState.tracking = false;

    const deltaX = e.changedTouches[0].clientX - plannerSwipeState.startX;
    const deltaY = e.changedTouches[0].clientY - plannerSwipeState.startY;
    const minSwipeDistance = 60;

    if (Math.abs(deltaX) < minSwipeDistance || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;

    if (deltaX > 0) {
      openDayDiagram(getAdjacentDay(currentOpenDay, -1));
    } else {
      openDayDiagram(getAdjacentDay(currentOpenDay, 1));
    }
  }, { passive: true });
}

function buildPlannerDayNav(day) {
  const { todayName } = getTimeMetrics();
  const prevDay = getAdjacentDay(day, -1);
  const nextDay = getAdjacentDay(day, 1);

  const pills = days.map(d => {
    const count = getDayEventCount(d);
    const isActive = d === day;
    const isToday = d === todayName;
    return `
      <button type="button"
        class="day-nav-pill ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}"
        onclick="openDayDiagram('${d}')"
        aria-label="${d}, ${count} task${count === 1 ? '' : 's'}"
        aria-current="${isActive ? 'true' : 'false'}">
        <span class="pill-name">${d.slice(0, 3)}</span>
        ${count > 0 ? `<span class="pill-count">${count}</span>` : ''}
      </button>
    `;
  }).join('');

  return `
    <div class="planner-nav-bar">
      <div class="planner-nav-controls">
        <button type="button" class="day-nav-arrow" onclick="openDayDiagram('${prevDay}')" aria-label="Previous day, ${prevDay}">
          <span class="arrow-icon">←</span>
          <span class="arrow-label">${prevDay}</span>
        </button>
        <button type="button" class="day-nav-today" onclick="openDayDiagram('${todayName}')" ${day === todayName ? 'disabled' : ''}>Jump to Today</button>
        <button type="button" class="day-nav-arrow" onclick="openDayDiagram('${nextDay}')" aria-label="Next day, ${nextDay}">
          <span class="arrow-label">${nextDay}</span>
          <span class="arrow-icon">→</span>
        </button>
      </div>
      <div class="day-nav-strip" role="tablist" aria-label="Week days">${pills}</div>
      <p class="planner-nav-hint">Use ← → arrow keys to switch days · Esc to close</p>
      <p class="planner-nav-hint planner-nav-hint-mobile">Swipe left or right to change days</p>
    </div>
  `;
}

function handlePlannerKeydown(e) {
  const modal = document.getElementById('diagramModal');
  if (!modal || modal.style.display !== 'flex' || !currentOpenDay) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeDayDiagram();
    return;
  }

  const active = document.activeElement;
  const isEditing = active && modal.contains(active) && (
    active.tagName === 'INPUT' ||
    active.tagName === 'TEXTAREA' ||
    active.tagName === 'SELECT' ||
    active.isContentEditable
  );
  if (isEditing) return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    openDayDiagram(getAdjacentDay(currentOpenDay, -1));
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    openDayDiagram(getAdjacentDay(currentOpenDay, 1));
  }
}

function ensurePlannerModalShell() {
  let modal = document.getElementById('diagramModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'diagramModal';
  modal.className = 'diagram-modal';
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDayDiagram();
  });
  document.body.appendChild(modal);
  document.addEventListener('keydown', handlePlannerKeydown);
  attachPlannerSwipeHandlers(modal);
  return modal;
}

function renderSchedule() {
  autoCompletePastEvents();

  const calendar = document.getElementById("calendar");
  if (!calendar) return;
  calendar.innerHTML = "";

  const { todayName, currentHHMM, currentDayIndex } = getTimeMetrics();

  days.forEach((day, index) => {
    const dayBox = document.createElement("div");
    dayBox.className = "day";
    if (day === todayName) dayBox.classList.add("today-highlight");

    dayBox.setAttribute("onclick", `openDayDiagram('${day}')`);

    dayBox.addEventListener("contextmenu", function(e) {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e, day);
    });

    const dayEvents = events.filter(event => event.day === day);
    const eventCount = dayEvents.length;
    const hasOverlaps = dayHasTimeOverlaps(dayEvents);

    let progressPercent = 0;
    if (index < currentDayIndex) {
      progressPercent = 100;
    } else if (eventCount > 0) {
      const completed = dayEvents.filter(ev => ev.completed === true).length;
      progressPercent = Math.round((completed / eventCount) * 100);
    }

    dayBox.innerHTML = `
      <h3>${day} ${day === todayName ? '⭐️' : ''}</h3>
      <div class="day-summary">
        <span class="pulse-dot"></span>
        ${eventCount} ${eventCount === 1 ? 'Task' : 'Tasks'} Scheduled
        ${hasOverlaps ? '<span class="day-overlap-flag">⚠ Time conflict</span>' : ''}
      </div>
      <div class="mini-preview-list">
        ${dayEvents.slice(0, 3).map(ev => {
          const catClass = ev.category || 'study';
          const doneClass = ev.completed ? 'mini-done' : '';
          return `<div class="mini-dot color-${catClass} ${doneClass}">▪️ ${ev.title}</div>`;
        }).join('')}
        ${eventCount > 3 ? '<div class="mini-dot extra">...and more</div>' : ''}
      </div>
      <div class="progress-track">
        <div class="progress-bar" style="width: ${progressPercent}%"></div>
      </div>
    `;

    calendar.appendChild(dayBox);
  });
}

// --- OPEN DAY PANEL ---
function openDayDiagram(day) {
  if (!days.includes(day)) return;

  autoCompletePastEvents();

  currentOpenDay = day;
  const modal = ensurePlannerModalShell();

  const { todayName, currentHHMM } = getTimeMetrics();
  const dayEvents = events
    .filter(event => event.day === day)
    .sort((a, b) => a.start.localeCompare(b.start));

  const defaultTimes = getDefaultWheelTimes();
  const taskSummary = `${dayEvents.length} task${dayEvents.length === 1 ? '' : 's'}`;
  const overlapMap = getOverlapMap(dayEvents);
  const conflictingTaskCount = overlapMap.size;

  let diagramHTML = `
    <div class="modal-content">
      <div class="modal-header-bar">
        <span class="modal-task-summary">${taskSummary}</span>
        <button type="button" class="close-btn" onclick="closeDayDiagram()" aria-label="Close planner">&times;</button>
      </div>
      <div class="modal-title-block">
        <h2>📝 ${day} Planner${day === todayName ? ' <span class="today-badge">Today</span>' : ''}</h2>
        ${buildPlannerDayNav(day)}
      </div>

      <div class="modal-layout">
        <div class="modal-form-zone">
          <form id="modalScheduleForm" data-planner-day="${day}" onsubmit="handleModalSubmit(event, '${day}')">
            <h3>Add New Task</h3>

            <div class="preset-row">
              <button type="button" class="preset-btn study-preset" onclick="injectPreset('study')">⚡ Quick 1H Study</button>
              <button type="button" class="preset-btn break-preset" onclick="injectPreset('break')">☕ Quick 15M Break</button>
            </div>

            <label>Task / Subject Name</label>
            <input id="title" required placeholder="Math Study, History Essay, etc..." />

            <label>Task Category</label>
            <select id="category">
              <option value="study">📘 Study / Revision</option>
              <option value="assignment">📝 Homework / Assignment</option>
              <option value="class">🏫 Class / Lecture</option>
              <option value="break">☕ Break / Free Time</option>
            </select>

            <label>Helpful Link (Optional)</label>
            <input id="link" type="url" placeholder="Google Drive, Zoom links..." />

            <div class="time-picker-row time-wheel-row">
              ${buildTimeWheelGroup("start", "Start Time", defaultTimes.startHour, defaultTimes.startMin)}
              ${buildTimeWheelGroup("end", "End Time", defaultTimes.endHour, defaultTimes.endMin)}
            </div>

            <label>Reminders / Quick Notes</label>
            <textarea id="notes" rows="3" placeholder="Write reminders or homework details here..."></textarea>

            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 15px; padding-top: 15px; border-top: 1px solid #1e293b;">
              <div style="flex: 1; min-width: 140px;">
                <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; display: block;">🔔 Reminder</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" id="reminderEnabled" style="width: auto;" checked>
                  <select id="reminderMinutes" style="flex: 1; padding: 6px 8px; background: #030712; border: 1px solid #1e293b; border-radius: 4px; color: #f8fafc; font-size: 0.8rem;">
                    <option value="5">5 min before</option>
                    <option value="10">10 min before</option>
                    <option value="15" selected>15 min before</option>
                    <option value="30">30 min before</option>
                    <option value="60">1 hour before</option>
                  </select>
                </div>
              </div>
              <div style="flex: 1; min-width: 140px;">
                <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; display: block;">🔄 Repeat</label>
                <select id="recurrenceFrequency" style="width: 100%; padding: 6px 8px; background: #030712; border: 1px solid #1e293b; border-radius: 4px; color: #f8fafc; font-size: 0.8rem;">
                  <option value="">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div style="margin-top: 15px;">
              <label style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; display: block;">🎨 Event Color</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <div class="color-option selected" data-color="default" onclick="selectEventColor(this, 'default')" style="width: 28px; height: 28px; border-radius: 50%; background: #38bdf8; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 1px #38bdf8;"></div>
                <div class="color-option" data-color="custom1" onclick="selectEventColor(this, 'custom1')" style="width: 28px; height: 28px; border-radius: 50%; background: #ef4444; cursor: pointer; border: 2px solid transparent;"></div>
                <div class="color-option" data-color="custom2" onclick="selectEventColor(this, 'custom2')" style="width: 28px; height: 28px; border-radius: 50%; background: #ec4899; cursor: pointer; border: 2px solid transparent;"></div>
                <div class="color-option" data-color="custom3" onclick="selectEventColor(this, 'custom3')" style="width: 28px; height: 28px; border-radius: 50%; background: #8b5cf6; cursor: pointer; border: 2px solid transparent;"></div>
                <div class="color-option" data-color="custom4" onclick="selectEventColor(this, 'custom4')" style="width: 28px; height: 28px; border-radius: 50%; background: #14b8a6; cursor: pointer; border: 2px solid transparent;"></div>
                <div class="color-option" data-color="custom5" onclick="selectEventColor(this, 'custom5')" style="width: 28px; height: 28px; border-radius: 50%; background: #f97316; cursor: pointer; border: 2px solid transparent;"></div>
              </div>
            </div>

            <div id="modal-form-feedback" class="modal-form-feedback" aria-live="polite"></div>

            <button type="submit">Save Task</button>
          </form>
        </div>

        <div class="modal-timeline-zone">
          ${conflictingTaskCount > 0 ? `
            <div class="overlap-alert-banner" role="status">
              <span class="overlap-alert-icon">⚠</span>
              <span>${conflictingTaskCount} task${conflictingTaskCount === 1 ? '' : 's'} overlap on this day — adjust times to resolve conflicts.</span>
            </div>
          ` : ''}
          <div class="timeline-container">
            <div class="timeline-line"></div>
  `;

  if (dayEvents.length === 0) {
    diagramHTML += `
      <div class="empty-state">
        <p>Your schedule is clean! No tasks added for this day yet.</p>
      </div>
    `;
  } else {
    dayEvents.forEach(ev => {
      const catClass = ev.category || 'study';
      let isActive = (day === todayName && currentHHMM >= ev.start && currentHHMM <= ev.end);
      let isCompleted = ev.completed === true;
      const overlappingTitles = overlapMap.get(ev.id) || [];
      const hasOverlap = overlappingTitles.length > 0;
      const overlapLabel = [...new Set(overlappingTitles)].join(', ');

      const titleDisplay = ev.link
        ? `<a href="${ev.link}" target="_blank" class="event-link">${ev.title}</a>`
        : ev.title;

      diagramHTML += `
        <div class="timeline-node ${isActive ? 'node-active-pulse' : ''} ${isCompleted ? 'task-done-overlay' : ''} ${hasOverlap ? 'time-overlap' : ''}">
          <div class="node-pulse cat-${catClass} ${hasOverlap ? 'overlap-pulse' : ''}"></div>
          <div class="node-data edge-${catClass} ${isActive ? 'active-border' : ''} ${hasOverlap ? 'overlap-border' : ''}">
            <div class="node-header-row">
              <span class="node-time">⏱️ ${ev.start} - ${ev.end}</span>
              <span class="badge-row">
                ${hasOverlap ? '<span class="badge badge-overlap">OVERLAP</span>' : ''}
                <span class="badge badge-${catClass}">${catClass.toUpperCase()}</span>
              </span>
            </div>
            <h3 class="task-title-text">${isCompleted ? '✅ ' : ''}${titleDisplay}</h3>
            ${hasOverlap ? `<p class="overlap-warning">Conflicts with: ${overlapLabel}</p>` : ''}
            ${ev.notes ? `<p class="node-notes">${ev.notes}</p>` : ''}

            <div class="node-action-footer">
              <button class="node-check-btn" onclick="toggleTaskComplete(${ev.id}, '${day}')">
                ${isCompleted ? '🔄 Mark Active' : '🏁 Complete'}
              </button>
              <button class="node-del-btn" onclick="deleteEvent(${ev.id}); openDayDiagram('${day}');">Remove</button>
            </div>
          </div>
        </div>
      `;
    });
  }

  diagramHTML += `</div></div></div></div>`;
  modal.innerHTML = diagramHTML;
  modal.style.display = "flex";
  modal.scrollTop = 0;
  initTimeWheelPickers(day);
}

// --- DYNAMIC PRESET INJECTOR ENGINE ---
window.injectPreset = function(type) {
  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, "0");
  const currentMin = String(now.getMinutes()).padStart(2, "0");

  setTimeWheelValues("start", currentHour, currentMin);

  if (type === "study") {
    document.getElementById("title").value = "Subject Core Review 🧠";
    document.getElementById("category").value = "study";
    const endH = String((now.getHours() + 1) % 24).padStart(2, "0");
    setTimeWheelValues("end", endH, currentMin);
  } else if (type === "break") {
    document.getElementById("title").value = "Mind Reset Cycle ☕";
    document.getElementById("category").value = "break";

    let endM = now.getMinutes() + 15;
    let endH = now.getHours();
    if (endM >= 60) {
      endM = endM % 60;
      endH = (endH + 1) % 24;
    }
    setTimeWheelValues(
      "end",
      String(endH).padStart(2, "0"),
      String(endM).padStart(2, "0")
    );
  }

  const form = document.getElementById("modalScheduleForm");
  const day = form?.dataset.plannerDay || currentOpenDay;
  if (day) updateModalFormFeedback(day);
};

function handleModalSubmit(e, day) {
  e.preventDefault();

  const startTime = document.getElementById("startHour").value + ":" + document.getElementById("startMin").value;
  const endTime = document.getElementById("endHour").value + ":" + document.getElementById("endMin").value;
  const validationIssues = validateTaskTimes(startTime, endTime, day);
  const blockingIssues = validationIssues.filter(issue => issue.type === "error");

  if (blockingIssues.length > 0) {
    updateModalFormFeedback(day);
    return;
  }

  const reminderEnabled = document.getElementById("reminderEnabled")?.checked || false;
  const reminderMinutes = parseInt(document.getElementById("reminderMinutes")?.value) || 15;
  const recurrenceFrequency = document.getElementById("recurrenceFrequency")?.value || "";
  const recurrenceEndDate = document.getElementById("recurrenceEndDate")?.value || null;
  const selectedColorEl = document.querySelector('.color-option.selected');
  const eventColor = selectedColorEl?.dataset?.color || "default";

  const newEvent = {
    id: Date.now(),
    title: document.getElementById("title").value,
    category: document.getElementById("category").value,
    link: document.getElementById("link").value,
    day: day,
    start: startTime,
    end: endTime,
    notes: document.getElementById("notes").value,
    completed: false,
    reminderEnabled,
    reminderMinutes,
    reminderShown: false,
    color: eventColor,
    recurrence: recurrenceFrequency ? {
      frequency: recurrenceFrequency,
      endDate: recurrenceEndDate
    } : null
  };

  events.push(newEvent);
  saveEvents();
  renderSchedule();
  updateAnalyticsDisplay();
  openDayDiagram(day);
  showToast('Task added successfully', 'success');
}

function toggleTaskComplete(id, day) {
  events = events.map(ev => {
    if (ev.id === id) ev.completed = !ev.completed;
    return ev;
  });
  saveEvents();
  renderSchedule();
  openDayDiagram(day);
}

function closeDayDiagram() {
  const modal = document.getElementById("diagramModal");
  if (modal) modal.style.display = "none";
  currentOpenDay = null;
}

// --- BACKUP SYSTEMS ---
function buildBackupPayload() {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    scheduleEvents: events,
    hubState: hubState,
    dashTodos: dashTodos,
    collapsedFolders: collapsedFolders,
    myTasks: myTasks,
    libraryItems: libraryItems
  };
}

function applyImportedBackup(parsedData) {
  if (Array.isArray(parsedData)) {
    events = parsedData;
    return;
  }

  if (!parsedData || typeof parsedData !== "object") {
    throw new Error("Invalid backup format");
  }

  if (Array.isArray(parsedData.scheduleEvents)) {
    events = parsedData.scheduleEvents;
  } else {
    throw new Error("Missing schedule data");
  }

  if (parsedData.hubState) hubState = parsedData.hubState;
  if (Array.isArray(parsedData.dashTodos)) dashTodos = parsedData.dashTodos;
  if (parsedData.collapsedFolders) collapsedFolders = parsedData.collapsedFolders;
  if (Array.isArray(parsedData.myTasks)) myTasks = parsedData.myTasks;
  if (Array.isArray(parsedData.libraryItems)) libraryItems = parsedData.libraryItems;
}

function exportBackup() {
  saveHubState();
  saveDashTodos();
  saveMyTasks();
  saveLibraryItems();

  const payload = buildBackupPayload();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `workspace_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importBackup(e) {
  const fileReader = new FileReader();
  fileReader.onload = function(event) {
    try {
      const parsedData = JSON.parse(event.target.result);
      applyImportedBackup(parsedData);
      saveEvents();
      saveHubState();
      saveDashTodos();
      saveMyTasks();
      saveLibraryItems();
      renderSchedule();
      renderDashTodos();
      refreshWorkspace();
      renderMyTasks();
      renderLibrary();
      updateDashboardLiveSession();
      alert("Workspace backup loaded successfully.");
    } catch (err) {
      alert("Error reading backup file.");
    } finally {
      e.target.value = "";
    }
  };
  fileReader.readAsText(e.target.files[0]);
}

// --- CONTEXT RIGHT CLICK MENU ---
let activeRightClickDay = "";
function showContextMenu(e, day) {
  activeRightClickDay = day;
  let menu = document.getElementById("customContextMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "customContextMenu";
    menu.className = "custom-menu";
    document.body.appendChild(menu);
  }
  menu.innerHTML = `<div onclick="deleteEntireDay()">❌ Clear All Tasks for ${day}</div>`;
  menu.style.top = `${e.pageY}px`;
  menu.style.left = `${e.pageX}px`;
  menu.style.display = "block";
}

document.addEventListener("click", () => {
  const menu = document.getElementById("customContextMenu");
  if (menu) menu.style.display = "none";
});

function deleteEntireDay() {
  if (confirm(`Clear your entire schedule for ${activeRightClickDay}?`)) {
    events = events.filter(event => event.day !== activeRightClickDay);
    saveEvents();
    renderSchedule();
    closeDayDiagram();
  }
}

function deleteEvent(id) {
  events = events.filter(event => event.id !== id);
  saveEvents();
  renderSchedule();
}
function setTextPreviewColor(colorKey) {
  const preview = document.querySelector('.text-color-preview');
  if (preview) {
    preview.dataset.color = colorKey;
    preview.className = `text-color-preview ${colorKey}`;
  } else {
    console.log('setTextPreviewColor:', colorKey);
  }
}

// Global clock tick to refresh highlights & progress bars
setInterval(() => {
  renderSchedule();
  updateDashboardLiveSession();

  // If a day modal is currently open, avoid rebuilding it while the user may be typing
  if (currentOpenDay) {
    const modal = document.getElementById('diagramModal');
    if (modal) {
      const active = document.activeElement;
      const isEditingInModal = modal.contains(active) && (
        (active.tagName === 'INPUT') ||
        (active.tagName === 'TEXTAREA') ||
        active.isContentEditable
      );

      // Only rebuild the modal if the user is NOT actively editing inside it
      if (!isEditingInModal) {
        openDayDiagram(currentOpenDay);
      }
    } else {
      // modal doesn't exist currently — safe to open/rebuild
      openDayDiagram(currentOpenDay);
    }
  }
}, 300000);

setInterval(() => {
  if (autoCompletePastEvents()) {
    renderSchedule();
    if (currentOpenDay) {
      const modal = document.getElementById("diagramModal");
      const active = document.activeElement;
      const isEditingInModal = modal && modal.contains(active) && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable
      );
      if (!isEditingInModal) openDayDiagram(currentOpenDay);
    }
  }
  updateDashboardLiveSession();
}, 60000);

renderSchedule();

// ==========================================
// 🌌 REACTIVE NETWORK CANVAS LOOP WITH IMPACT RIPPLES
// ==========================================
const canvas = document.getElementById('lineCanvas');
if (canvas) {
const ctx = canvas.getContext('2d');

let particlesArray = [];
let ripplesArray = [];
const numberOfParticles = 40;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', function() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

class Particle {
  constructor(x, y, isSpark = false) {
    this.x = x || Math.random() * canvas.width;
    this.y = y || Math.random() * canvas.height;
    this.size = isSpark ? Math.random() * 3 + 1.5 : Math.random() * 2 + 1;
    this.speedX = isSpark ? Math.random() * 4 - 2 : Math.random() * 0.4 - 0.2;
    this.speedY = isSpark ? Math.random() * 4 - 2 : Math.random() * 0.4 - 0.2;
    this.isSpark = isSpark;
    this.life = isSpark ? 1.0 : 100;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.isSpark) {
      this.life -= 0.02;
    } else {
      if (this.x > canvas.width || this.x < 0) this.speedX = -this.speedX;
      if (this.y > canvas.height || this.y < 0) this.speedY = -this.speedY;
    }
  }
  draw() {
    ctx.fillStyle = this.isSpark
      ? `rgba(56, 189, 248, ${this.life})`
      : 'rgba(168, 85, 247, 0.3)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class ImpactRipple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 1;
    this.maxRadius = Math.random() * 60 + 50;
    this.opacity = 0.5;
  }
  update() {
    this.radius += 2.5;
    this.opacity -= 0.012;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(168, 85, 247, ${this.opacity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.closePath();
  }
}

function initParticles() {
  particlesArray = [];
  for (let i = 0; i < numberOfParticles; i++) {
    particlesArray.push(new Particle());
  }
}

window.addEventListener('click', function(e) {
  ripplesArray.push(new ImpactRipple(e.clientX, e.clientY));
  for(let i = 0; i < 12; i++) {
    particlesArray.push(new Particle(e.clientX, e.clientY, true));
  }
});

function handleParticlesAndRipples() {
  for (let r = 0; r < ripplesArray.length; r++) {
    ripplesArray[r].update();
    ripplesArray[r].draw();
    if (ripplesArray[r].opacity <= 0) {
      ripplesArray.splice(r, 1);
      r--;
    }
  }

  for (let i = 0; i < particlesArray.length; i++) {
    particlesArray[i].update();
    particlesArray[i].draw();

    if (particlesArray[i].isSpark && particlesArray[i].life <= 0) {
      particlesArray.splice(i, 1);
      i--;
      continue;
    }

    for (let j = i; j < particlesArray.length; j++) {
      if (particlesArray[i].isSpark || particlesArray[j].isSpark) continue;

      const dx = particlesArray[i].x - particlesArray[j].x;
      const dy = particlesArray[i].y - particlesArray[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 120) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.12 - (distance/120) * 0.12})`;
        ctx.lineWidth = 0.7;
        ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
        ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
        ctx.stroke();
        ctx.closePath();
      }
    }
  }
}

function animateBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  handleParticlesAndRipples();
  requestAnimationFrame(animateBackground);
}

initParticles();
animateBackground();
}

// ==========================================
// 🎵 BACKGROUND MUSIC ENGINE
// ==========================================
const musicAudio = document.getElementById("musicAudioEngine");
const musicBtn = document.getElementById("musicPlayBtn");
const musicStatus = document.getElementById("musicStatus");

function toggleMusicSound() {
  if (!musicAudio) return;

  if (musicAudio.paused) {
    musicAudio.play()
      .then(() => {
        musicBtn.innerText = "⏸️ Pause";
        musicBtn.classList.add("active");
        if (musicStatus) musicStatus.textContent = "Now playing...";
      })
      .catch(err => {
        console.log("Audio waiting for manual interaction click.");
        if (musicStatus) musicStatus.textContent = "Click to start";
      });
  } else {
    musicAudio.pause();
    musicBtn.innerText = "▶ Play";
    musicBtn.classList.remove("active");
    if (musicStatus) musicStatus.textContent = "Paused";
  }
}

function changeMusicVolume(volumeValue) {
  if (musicAudio) {
    musicAudio.volume = volumeValue;
  }
}

let musicMuted = false;

function toggleMusicMute() {
  if (!musicAudio) return;
  musicMuted = !musicMuted;
  musicAudio.muted = musicMuted;
  const btn = document.getElementById("musicMuteBtn");
  if (btn) btn.textContent = musicMuted ? "🔇" : "🔊";
  if (musicStatus) musicStatus.textContent = musicMuted ? "Muted" : (musicAudio.paused ? "Paused" : "Now playing...");
}

// Mixer Folding Drawer Action
function toggleLofiConsole() {
  const widget = document.getElementById("lofiWidget");
  const btn = document.getElementById("lofiToggleBtn");

  if (widget.classList.contains("minimized")) {
    widget.classList.remove("minimized");
    btn.innerText = "➖";
  } else {
    widget.classList.add("minimized");
    btn.innerText = "🎛️ Open Mixer";
  }
}

// ==========================================
// 🎯 COLLAPSIBLE SIDEBAR TOGGLE
// ==========================================
function toggleHubSidebar() {
  const sidebar = document.getElementById('hubSidebar');
  if (!sidebar) return;

  sidebar.classList.toggle('collapsed');

  // Save state to localStorage
  const isCollapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
}

// Initialize sidebar state on load
function initHubSidebarState() {
  const sidebar = document.getElementById('hubSidebar');
  if (!sidebar) return;

  const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (wasCollapsed) {
    sidebar.classList.add('collapsed');
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', initHubSidebarState);

// ==========================================
// 🧭 WORKSPACE TAB ARCHITECTURE SWITCH
// ==========================================
function switchView(targetViewId) {
  const views = document.querySelectorAll('.hub-view');
  views.forEach(view => view.classList.remove('active'));

  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  const targetView = document.getElementById(targetViewId);
  if (!targetView) return;
  targetView.classList.add('active');

  const clickedButton = Array.from(buttons).find(btn => btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(targetViewId));
  if (clickedButton) clickedButton.classList.add('active');

  // Refresh specific views when switched to
  if (targetViewId === 'calendar-view') renderCalendarMonth();
  if (targetViewId === 'mytasks-view') renderMyTasks();
  if (targetViewId === 'library-view') renderLibrary();
  if (targetViewId === 'lessons-view') refreshWorkspace();
}
// ==========================================
// 🧭 DRAGGABLE LO-FI WIDGET LOGIC
// ==========================================
const lofiWidget = document.querySelector('.lofi-widget');
const lofiHeader = document.querySelector('.lofi-header');

if (lofiWidget && lofiHeader) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  lofiHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('.lofi-toggle-btn') || e.target.closest('button')) return;

    isDragging = true;

    offsetX = e.clientX - lofiWidget.getBoundingClientRect().left;
    offsetY = e.clientY - lofiWidget.getBoundingClientRect().top;

    lofiWidget.style.bottom = 'auto';
    lofiWidget.style.right = 'auto';

    lofiWidget.style.opacity = '0.85';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;

    const maxX = window.innerWidth - lofiWidget.offsetWidth;
    const maxY = window.innerHeight - lofiWidget.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    lofiWidget.style.left = `${x}px`;
    lofiWidget.style.top = `${y}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      lofiWidget.style.opacity = '1';
    }
  });
}
// ==========================================
// 🧭 WORKSPACE VIEW ENGINE INTERFACES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const hubViews = document.querySelectorAll('.hub-view');
  const viewTitle = document.getElementById('current-view-title');

  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      const targetViewId = item.getAttribute('data-target');
      hubViews.forEach(view => {
        if (view.id === targetViewId) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });

      if (viewTitle) {
        const textOnly = item.textContent.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '');
        viewTitle.textContent = textOnly.trim();
      }
    });
  });
});
// ==========================================
// 📚 NOTION-STYLE LESSON CORE ENGINE
// ==========================================
const DEFAULT_HUB_STATE = {
  folders: [
    { id: "folder_codes", title: "Codes", pageIds: [] },
    { id: "folder_teachers", title: "Teachers Codes", pageIds: [] },
    { id: "folder_fun", title: "Fun Codes", pageIds: [] }
  ],
  pages: {},
  activePageId: null
};

function loadHubState() {
  try {
    const stored = localStorage.getItem("hubState");
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.warn("Could not load saved lessons.", err);
  }
  return JSON.parse(JSON.stringify(DEFAULT_HUB_STATE));
}

let hubState = loadHubState();
let collapsedFolders = JSON.parse(localStorage.getItem("collapsedFolders") || "{}");

function saveHubState() {
  localStorage.setItem("hubState", JSON.stringify(hubState));
  updateDashboardStats();
}

function saveCollapsedFolders() {
  localStorage.setItem("collapsedFolders", JSON.stringify(collapsedFolders));
}

document.addEventListener("DOMContentLoaded", () => {
    refreshWorkspace();
});

function refreshWorkspace() {
    saveHubState();
    renderTreeSidebar();
    renderFolderDropdowns();
    renderCurriculumLedger();
}

function renderTreeSidebar() {
    const treeContainer = document.getElementById("dynamic-lesson-tree");
    if (!treeContainer) return;

    treeContainer.innerHTML = "";

    if (hubState.folders.length === 0) {
        treeContainer.innerHTML = `<div style="color:#64748b; font-size:0.85rem; padding:10px;">No structures available. Create a folder below to begin.</div>`;
        return;
    }

    hubState.folders.forEach(folder => {
        const isCollapsed = collapsedFolders[folder.id];
        const folderNode = document.createElement("div");
        folderNode.className = `lesson-folder ${!isCollapsed ? 'expanded' : ''}`;

        const trigger = document.createElement("div");
        trigger.className = "folder-trigger";
        trigger.innerHTML = `
            <span class="folder-arrow" style="display:inline-block; transition: transform 0.2s; ${!isCollapsed ? 'transform:rotate(90deg);' : ''}">▶</span>
            <span class="folder-icon">📁</span>
            <span class="folder-title" style="font-weight:600;">${folder.title}</span>
        `;
        trigger.onclick = () => {
            collapsedFolders[folder.id] = !collapsedFolders[folder.id];
            saveCollapsedFolders();
            refreshWorkspace();
        };

        const contentArea = document.createElement("div");
        contentArea.className = "folder-content";
        contentArea.style.display = !isCollapsed ? "flex" : "none";

        folder.pageIds.forEach(pageId => {
            const pageData = hubState.pages[pageId];
            if (!pageData) return;

            const leafNode = document.createElement("div");
            leafNode.className = `lesson-leaf-node ${hubState.activePageId === pageId ? 'active' : ''}`;
            leafNode.innerHTML = `
                <span class="leaf-icon">📄</span>
                <span class="leaf-title">${pageData.title}</span>
            `;
            leafNode.onclick = () => {
              hubState.activePageId = pageId;
              refreshWorkspace();

              const sidebar = document.querySelector('aside.sidebar-panel');
              if (sidebar) {
                sidebar.classList.remove('mobile-open', 'open', 'active', 'sidebar-open');
              }

              try { document.body.style.overflowY = 'auto'; } catch (e) {}
            };
            contentArea.appendChild(leafNode);
        });

        if (folder.pageIds.length === 0) {
            const emptyNotice = document.createElement("div");
            emptyNotice.style = "padding: 4px 12px; color: #475569; font-size: 0.8rem; font-style: italic;";
            emptyNotice.textContent = "Empty Folder";
            contentArea.appendChild(emptyNotice);
        }

        folderNode.appendChild(trigger);
        folderNode.appendChild(contentArea);
        treeContainer.appendChild(folderNode);
    });
}

function renderFolderDropdowns() {
    const selector = document.getElementById("target-folder-select");
    if (!selector) return;

    selector.innerHTML = "";
    hubState.folders.forEach(folder => {
        const opt = document.createElement("option");
        opt.value = folder.id;
        opt.textContent = folder.title;
        selector.appendChild(opt);
    });
}

function renderCurriculumLedger() {
  const output = document.getElementById("live-ledger-output");
  const headline = document.getElementById("active-page-headline");
  output.innerHTML = "";

  const activePage = hubState.pages[hubState.activePageId];
  if (!activePage) {
    if (headline) headline.textContent = "Select a page from the tree view to open a workspace";
    return;
  }

  if (headline) headline.textContent = activePage.title;

  if (activePage.blocks.length === 0) {
    output.innerHTML = `<div id="empty-workspace-tip" style="color:#475569; font-size:0.9rem; padding: 12px; font-style:italic; user-select:none;">Empty document canvas. Click "+ Add a line" below or start typing.</div>`;
    return;
  }

  activePage.blocks.forEach((block, index) => {
    const rowHTML = createRowDOMTemplate(index, block.time, block.content);
    output.appendChild(rowHTML);
  });
}

// FIX 1: Use property assignment (oninput/onblur/onkeydown) instead of addEventListener.
// This ensures reindexDOMRows() can cleanly replace handlers with updated indices,
// preventing stale-closure duplicates that saved content to the wrong block.
function createRowDOMTemplate(index, timeValue, contentValue) {
  const row = document.createElement("div");
  row.className = "notion-row-node";
  row.setAttribute("data-index", index);

  row.innerHTML = `
    <div class="editable-time" role="textbox" contenteditable="plaintext-only" spellcheck="false">${timeValue}</div>
    <div class="editable-divider">:</div>
    <div class="editable-content" role="textbox" contenteditable="plaintext-only" spellcheck="false">${contentValue}</div>
  `;

  const timeElement = row.querySelector(".editable-time");
  const contentElement = row.querySelector(".editable-content");

  timeElement.oninput = () => debouncedRenderLedger();
  timeElement.onblur = () => saveInlineTextOnBlur(index, 'time', timeElement.innerText.trim());

  contentElement.oninput = () => debouncedRenderLedger();
  contentElement.onblur = () => saveInlineTextOnBlur(index, 'content', contentElement.innerText);
  contentElement.onkeydown = (e) => handleInlineKeyboardEvents(e, index, row);

  return row;
}

function syncInlineText(index, keyField, activeValue) {
  const activePage = hubState.pages[hubState.activePageId];
  if (activePage && activePage.blocks[index]) {
    activePage.blocks[index][keyField] = activeValue;
    saveHubState();
  }
}

function handleInlineKeyboardEvents(event, index, currentRowElement) {
  const activePage = hubState.pages[hubState.activePageId];
  if (!activePage) return;

  if (event.key === "Enter") {
    event.preventDefault();

    const nextIndex = index + 1;
    const nextBlankBlock = { time: "00:00 AM", content: "", type: "bullet" };

    activePage.blocks.splice(nextIndex, 0, nextBlankBlock);
    saveHubState();

    const newRowNode = createRowDOMTemplate(nextIndex, nextBlankBlock.time, nextBlankBlock.content);
    currentRowElement.parentNode.insertBefore(newRowNode, currentRowElement.nextSibling);

    reindexDOMRows();

    setTimeout(() => {
      const nextInputField = newRowNode.querySelector(".editable-content");
      if (nextInputField) nextInputField.focus();
    }, 10);
  }

  if (event.key === "Backspace" && event.target.innerText.trim() === "") {
    event.preventDefault();

    activePage.blocks.splice(index, 1);
    saveHubState();

    const previousRowElement = currentRowElement.previousElementSibling;
    currentRowElement.remove();

    reindexDOMRows();

    if (previousRowElement) {
      setTimeout(() => {
        const fallbackField = previousRowElement.querySelector(".editable-content");
        if (fallbackField) {
          fallbackField.focus();

          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(fallbackField);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, 10);
    }

    if (activePage.blocks.length === 0) {
      saveHubState();
      renderCurriculumLedger();
    }
  }
}

function reindexDOMRows() {
  const allRows = document.querySelectorAll("#live-ledger-output .notion-row-node");
  allRows.forEach((row, newIdx) => {
    row.setAttribute("data-index", newIdx);

    const timeElement = row.querySelector(".editable-time");
    const contentElement = row.querySelector(".editable-content");

    timeElement.oninput = () => debouncedRenderLedger();
    timeElement.onblur = () => saveInlineTextOnBlur(newIdx, 'time', timeElement.innerText.trim());
    contentElement.oninput = () => debouncedRenderLedger();
    contentElement.onblur = () => saveInlineTextOnBlur(newIdx, 'content', contentElement.innerText);
    contentElement.onkeydown = (e) => handleInlineKeyboardEvents(e, newIdx, row);
  });
}

/* Sidebar toggle utilities ----------------------------------------------- */
function restoreSidebarCollapsedState() {
  const prev = sessionStorage.getItem('sidebar_collapsed');
  const sidebar = document.getElementById('app-sidebar');
  const main = document.querySelector('.main-workspace-content');
  const isCollapsed = prev === '1';

  if (!sidebar) return;
  sidebar.classList.toggle('collapsed', isCollapsed);
  if (main) main.classList.toggle('expanded-main', isCollapsed);
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  updateLessonMenuToggleLabel(isCollapsed);
}

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;

  const main = document.querySelector('.main-workspace-content');
  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');

  if (main) main.classList.toggle('expanded-main', isCollapsed);
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  sessionStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
  updateLessonMenuToggleLabel(isCollapsed);
}

function createSidebarToggleButton() {
  return;
}

function createSidebarHandle() {
  return;
}

function updateLessonMenuToggleLabel(isCollapsed) {
  const btn = document.getElementById('toggle-creator-btn');
  if (btn) btn.textContent = isCollapsed ? 'Show Lesson Menu' : 'Hide Lesson Menu';
}

document.addEventListener('DOMContentLoaded', () => {
  restoreSidebarCollapsedState();
  createSidebarHandle();
  createSidebarToggleButton();
});

function addNewInlineBlockToEnd() {
  const activePage = hubState.pages[hubState.activePageId];
  if (!activePage) {
    alert("Please select a valid page node tree file first!");
    return;
  }

  activePage.blocks.push({ time: "12:00 PM", content: "", type: "bullet" });
  refreshWorkspace();

  setTimeout(() => {
    const structuralRows = activePage.blocks.length - 1;
    const lastRowInput = document.querySelector(`[data-index="${structuralRows}"] .editable-content`);
    if (lastRowInput) lastRowInput.focus();
  }, 5);
}

function handleCreateFolder() {
    const input = document.getElementById("new-folder-title");
    if (!input) return;

    const title = input.value.trim();
    if (!title) return;

    const newId = `folder_${Date.now()}`;
    hubState.folders.push({ id: newId, title, pageIds: [] });
    input.value = "";
    refreshWorkspace();
}

function handleCreatePage() {
    const folderSelector = document.getElementById("target-folder-select");
    const input = document.getElementById("new-page-title");
    if (!folderSelector || !input) return;

    const targetFolderId = folderSelector.value;
    const pageTitle = input.value.trim();
    if (!targetFolderId || !pageTitle) return;

    const newPageId = `page_${Date.now()}`;
    hubState.pages[newPageId] = {
        title: pageTitle,
        blocks: []
    };

    const targetFolder = hubState.folders.find(f => f.id === targetFolderId);
    if (targetFolder) {
        targetFolder.pageIds.push(newPageId);
    }

    hubState.activePageId = newPageId;
    input.value = "";
    refreshWorkspace();
}

function handleInsertBlock() {
    const activePage = hubState.pages[hubState.activePageId];
    if (!activePage) {
        alert("Please select or build a lesson page module first!");
        return;
    }

    const timeInput = document.getElementById("node-time-input");
    const contentInput = document.getElementById("node-content-input");
    const typeSelect = document.getElementById("node-type-select");
    if (!timeInput || !contentInput || !typeSelect) return;

    const time = timeInput.value.trim();
    const content = contentInput.value.trim();
    const type = typeSelect.value;
    if (!time || !content) return;

    activePage.blocks.push({ time, content, type });
    timeInput.value = "";
    contentInput.value = "";
    refreshWorkspace();
}

let isDraggingSelection = false;

document.addEventListener("DOMContentLoaded", () => {
    initNotionInteractions();
});

function initNotionInteractions() {
    document.addEventListener("mousedown", (e) => {
        const rowNode = e.target.closest(".notion-row-node");
        if (rowNode) {
            isDraggingSelection = true;
            toggleNodeSelection(rowNode, e.shiftKey);
        } else if (!e.target.closest("#notion-action-menu")) {
            clearAllSelections();
        }
    });

    document.addEventListener("mouseover", (e) => {
        if (isDraggingSelection) {
            const rowNode = e.target.closest(".notion-row-node");
            if (rowNode) {
                rowNode.classList.add("is-selected");
                evaluateMenuVisibility();
            }
        }
    });

    document.addEventListener("mouseup", () => {
        isDraggingSelection = false;
    });
}

function toggleNodeSelection(node, isShiftKey) {
    if (!isShiftKey && !isDraggingSelection) {
        const trackingList = document.querySelectorAll(".notion-row-node.is-selected");
        trackingList.forEach(item => { if(item !== node) item.classList.remove("is-selected"); });
    }
    node.classList.toggle("is-selected");
    evaluateMenuVisibility();
}

// FIX 2: Added null guards so selecting rows doesn't crash when the
// #notion-action-menu / #selected-count-badge elements are missing from the DOM.
function evaluateMenuVisibility() {
    const activeSelections = document.querySelectorAll(".notion-row-node.is-selected");
    const popupMenu = document.getElementById("notion-action-menu");
    const countBadge = document.getElementById("selected-count-badge");

    if (!popupMenu || !countBadge) return;

    if (activeSelections.length > 0) {
        countBadge.textContent = `${activeSelections.length} node${activeSelections.length > 1 ? 's' : ''} selected`;
        popupMenu.classList.add("visible");
    } else {
        popupMenu.classList.remove("visible");
    }
}

function clearAllSelections() {
    document.querySelectorAll(".notion-row-node.is-selected").forEach(node => {
        node.classList.remove("is-selected");
    });
    evaluateMenuVisibility();
}

// FIX 3: Sync hubState.blocks on delete/duplicate so changes survive re-renders.
// Previously only DOM nodes were modified; the next renderCurriculumLedger call
// rebuilt the page from stale hubState, silently undoing all edits.
function executeMultiAction(actionType) {
    const targets = document.querySelectorAll(".notion-row-node.is-selected");
    if (targets.length === 0) return;

    const activePage = hubState.pages[hubState.activePageId];
    if (!activePage) return;

    const selectedIndices = Array.from(targets).map(node => Number(node.dataset.index));
    // Sort descending so splice operations don't shift remaining indices mid-loop
    const sortedDesc = [...selectedIndices].sort((a, b) => b - a);

    if (actionType === 'delete') {
        sortedDesc.forEach(idx => activePage.blocks.splice(idx, 1));
    } else if (actionType === 'duplicate') {
        sortedDesc.forEach(idx => {
            const blockCopy = { ...activePage.blocks[idx] };
            activePage.blocks.splice(idx + 1, 0, blockCopy);
        });
    }

    clearAllSelections();
    saveHubState();
    renderCurriculumLedger();
}

// ========================================================
//     CORE INTERACTIVE SYSTEM DASHBOARD PROTOCOLS
// ========================================================

const focusTimerState = {
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  running: false,
  intervalId: null,
  modeLabel: "Focus Session",
  activePresetMinutes: 25
};

const FOCUS_TIMER_RING_RADIUS = 54;
const FOCUS_TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * FOCUS_TIMER_RING_RADIUS;

function formatTimerDisplay(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function syncFocusTimerPresetButtons() {
  document.querySelectorAll(".timer-preset").forEach(button => {
    const minutes = Number(button.dataset.minutes);
    button.classList.toggle("active", minutes === focusTimerState.activePresetMinutes);
  });
}

function updateFocusTimerDisplay() {
  const display = document.getElementById("focusTimerDisplay");
  const modeLabel = document.getElementById("focusTimerMode");
  const startBtn = document.getElementById("focusTimerStartBtn");
  const ring = document.getElementById("focusTimerRing");
  const panel = document.getElementById("focusTimerPanel");
  const progressRatio = focusTimerState.totalSeconds > 0
    ? focusTimerState.remainingSeconds / focusTimerState.totalSeconds
    : 0;

  if (display) display.textContent = formatTimerDisplay(focusTimerState.remainingSeconds);
  if (modeLabel) modeLabel.textContent = focusTimerState.modeLabel;
  if (startBtn) {
    startBtn.textContent = focusTimerState.running ? "Pause" : "Start";
    startBtn.setAttribute("aria-pressed", focusTimerState.running ? "true" : "false");
  }
  if (ring) {
    ring.style.strokeDashoffset = `${FOCUS_TIMER_RING_CIRCUMFERENCE * (1 - progressRatio)}`;
  }
  if (panel) {
    panel.classList.toggle("timer-running", focusTimerState.running);
    panel.classList.toggle("timer-finished", !focusTimerState.running && focusTimerState.remainingSeconds === 0);
  }

  syncFocusTimerPresetButtons();
}

function updateFocusTimerTaskLink() {
  const taskLabel = document.getElementById("focusTimerTask");
  if (!taskLabel) return;

  const { current, next } = getSessionSnapshot();
  const linked = current || next;

  if (linked) {
    taskLabel.textContent = `Linked to: ${linked.title} (${linked.start}–${linked.end})`;
  } else {
    taskLabel.textContent = "Linked to: nothing scheduled now";
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
  const panel = document.getElementById("focusTimerPanel");
  if (panel) {
    panel.classList.add("timer-complete-flash");
    setTimeout(() => panel.classList.remove("timer-complete-flash"), 1200);
  }

  if (typeof document.hidden !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
    new Notification("Focus timer finished", { body: focusTimerState.modeLabel });
  }
}

function initFocusTimer() {
  const panel = document.getElementById("focusTimerPanel");
  const startBtn = document.getElementById("focusTimerStartBtn");
  const resetBtn = document.getElementById("focusTimerResetBtn");
  const ring = document.getElementById("focusTimerRing");

  if (ring) {
    ring.style.strokeDasharray = `${FOCUS_TIMER_RING_CIRCUMFERENCE}`;
    ring.style.strokeDashoffset = "0";
  }

  startBtn?.addEventListener("click", toggleFocusTimer);
  resetBtn?.addEventListener("click", resetFocusTimer);

  document.querySelectorAll(".timer-preset").forEach(button => {
    button.addEventListener("click", () => {
      setFocusTimerMode(Number(button.dataset.minutes), button.dataset.label);
    });
  });

  panel?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === "open-today") {
      openDayDiagram(getTodayName());
    }
  });

  window.toggleFocusTimer = toggleFocusTimer;
  window.resetFocusTimer = resetFocusTimer;
  window.setFocusTimerMode = setFocusTimerMode;

  updateFocusTimerDisplay();
  updateFocusTimerTaskLink();
}

function renderDashTodos() {
  const containers = document.querySelectorAll("#dashStrikeList, #todoStrikeList");
  containers.forEach(container => {
    if (!container) return;

    container.innerHTML = dashTodos.map(todo => `
      <li>
        <label class="strike-item">
          <input type="checkbox" data-todo-id="${todo.id}" ${todo.done ? "checked" : ""} onchange="toggleDashTodo('${todo.id}')">
          <span class="checkmark"></span>
          <span class="task-text">${todo.text}</span>
        </label>
      </li>
    `).join("");
  });
}

function toggleDashTodo(todoId) {
  dashTodos = dashTodos.map(todo =>
    todo.id === todoId ? { ...todo, done: !todo.done } : todo
  );
  saveDashTodos();
  updateDashProgress();
}

function addDashTodo() {
  const text = prompt("New dashboard task:");
  if (!text || !text.trim()) return;

  dashTodos.push({
    id: `todo_${Date.now()}`,
    text: text.trim(),
    done: false
  });

  saveDashTodos();
  renderDashTodos();
  updateDashProgress();
}

function updateDashboardStats() {
  const lessonFolderStat = document.getElementById("statLessonFolders");
  const todayTasksStat = document.getElementById("statTodayTasks");
  const libraryStat = document.getElementById("statLibraryItems");
  const todayEvents = getTodayEventsSorted();

  if (lessonFolderStat && typeof hubState !== "undefined") {
    lessonFolderStat.textContent = String(hubState.folders.length);
  }
  if (todayTasksStat) todayTasksStat.textContent = String(todayEvents.length);
  if (libraryStat) libraryStat.textContent = String(libraryItems.length);
}

function updateDashboardLiveSession() {
  const { current, next, todayEvents } = getSessionSnapshot();

  const sessionTime = document.getElementById("dashSessionTime");
  const sessionTitle = document.getElementById("dashSessionTitle");
  const sessionTag = document.getElementById("dashSessionTag");
  const dashNext = document.getElementById("dashNextSession");

  if (current) {
    if (sessionTime) sessionTime.textContent = `${current.start} – ${current.end}`;
    if (sessionTitle) sessionTitle.textContent = current.title;
    if (sessionTag) {
      sessionTag.textContent = (current.category || "study").toUpperCase();
      sessionTag.className = `session-tag badge-${current.category || "study"}`;
    }
  } else if (todayEvents.length === 0) {
    if (sessionTime) sessionTime.textContent = "Today";
    if (sessionTitle) sessionTitle.textContent = "No tasks scheduled yet";
    if (sessionTag) {
      sessionTag.textContent = "Add a block";
      sessionTag.className = "session-tag";
    }
  } else if (next) {
    if (sessionTime) sessionTime.textContent = "Now";
    if (sessionTitle) sessionTitle.textContent = "Between sessions";
    if (sessionTag) {
      sessionTag.textContent = "Free time";
      sessionTag.className = "session-tag";
    }
  } else {
    if (sessionTime) sessionTime.textContent = "Done";
    if (sessionTitle) sessionTitle.textContent = "All tasks complete for today";
    if (sessionTag) {
      sessionTag.textContent = "Great work";
      sessionTag.className = "session-tag";
    }
  }

  if (dashNext) {
    if (next) {
      dashNext.textContent = `${next.start} — ${next.title}`;
    } else if (current) {
      dashNext.textContent = "Nothing else queued after this block";
    } else if (todayEvents.length === 0) {
      dashNext.textContent = "Open Weekly Schedule to plan your day";
    } else {
      dashNext.textContent = "Enjoy the rest of your day";
    }
  }

  updateQuickJumpLinks();
  updateFocusTimerTaskLink();
  updateDashboardStats();
  updateDashProgress(false);
}

function updateQuickJumpLinks() {
  const recentLessons = document.getElementById("dashRecentLessons");
  const recentLibs = document.getElementById("dashRecentLibs");

  const activePage = hubState?.pages?.[hubState?.activePageId];
  if (recentLessons && activePage) {
    recentLessons.innerHTML = `<span style="color:#e2e8f0;font-size:0.9rem">📄 ${activePage.title}</span>`;
  } else if (recentLessons) {
    recentLessons.innerHTML = `<span style="color:#475569;font-size:0.85rem">No open lesson</span>`;
  }

  if (recentLibs && libraryItems.length > 0) {
    const recent = libraryItems.slice(-3).reverse();
    recentLibs.innerHTML = recent.map(item =>
      `<a href="${item.url}" target="_blank" style="color:#38bdf8;text-decoration:none;font-size:0.8rem;display:block;padding:2px 0">🔗 ${item.title}</a>`
    ).join("");
  } else if (recentLibs) {
    recentLibs.innerHTML = `<span style="color:#475569;font-size:0.85rem">No bookmarks yet</span>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
    initDashboardEngine();
});

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function initDashboardEngine() {
    const dateDisplay = document.getElementById("dashGreetingDate");
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

function updateAnalyticsDisplay() {
    const analytics = getAnalytics();

    const totalEl = document.getElementById("analyticsTotalEvents");
    const completionEl = document.getElementById("analyticsCompletionRate");
    const weekEl = document.getElementById("analyticsWeekEvents");
    const studyTimeEl = document.getElementById("analyticsStudyTime");
    const optimalEl = document.getElementById("analyticsOptimalTimes");
    const conflictsEl = document.getElementById("analyticsConflicts");

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
        optimalEl.textContent = optimalTimes.length > 0
            ? optimalTimes.join(', ')
            : 'Not enough data yet';
    }

    if (conflictsEl) {
        const conflicts = detectSchedulingConflicts();
        if (conflicts.length > 0) {
            conflictsEl.innerHTML = conflicts.slice(0, 3).map(c =>
                `<div style="margin-bottom:8px;padding:8px;background:rgba(251,146,60,0.1);border-left:3px solid #fb923c;border-radius:4px;">
                    <strong>${c.event1.title}</strong> overlaps with <strong>${c.event2.title}</strong><br>
                    <small style="color:#94a3b8;">${c.suggestion}</small>
                </div>`
            ).join('');
        } else {
            conflictsEl.textContent = '✓ No conflicts detected';
        }
    }
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

    const fillBar = document.getElementById("dashProgressBar");
    const percentLabel = document.getElementById("dashProgressPercent");
    const dynamicNodeCounter = document.getElementById("statTasksDone");
    const todoCountEl = document.getElementById("todoCount");
    const todoDoneEl = document.getElementById("todoDoneCount");
    const todoPercentEl = document.getElementById("todoPercent");

    if (fillBar) fillBar.style.width = `${computedPercentage}%`;
    if (percentLabel) percentLabel.textContent = `${computedPercentage}%`;
    if (dynamicNodeCounter) dynamicNodeCounter.textContent = statLabel;
    if (todoCountEl) todoCountEl.textContent = String(todoTotal);
    if (todoDoneEl) todoDoneEl.textContent = String(todoDoneCount);
    if (todoPercentEl) todoPercentEl.textContent = `${computedPercentage}%`;
}

function toggleFolder(folderTriggerElement) {
    const parentFolder = folderTriggerElement.parentElement;
    parentFolder.classList.toggle("expanded");
}

function toggleCreatorPanel() {
  const panel = document.getElementById("collapsible-builder-panel");
  const btn = document.getElementById("toggle-creator-btn");

  if (!panel) return;

  panel.classList.toggle("hidden-drawer");

  if (panel.classList.contains("hidden-drawer")) {
    if (btn) {
      btn.textContent = "🔧 Show Workspace Builder Tools";
      btn.style.borderStyle = "dashed";
    }
  } else {
    if (btn) {
      btn.textContent = "🔒 Hide Workspace Builder Tools";
      btn.style.borderStyle = "solid";
    }
  }
}

// ========================================================
//     📅 CALENDAR MONTH VIEW
// ========================================================
let calendarMonthOffset = 0;
let calendarSelectedDate = null;

function renderCalendarMonth() {
  const titleEl = document.getElementById("calendarMonthTitle");
  const gridEl = document.getElementById("calendarMonthGrid");
  if (!titleEl || !gridEl) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + calendarMonthOffset;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  titleEl.textContent = `${monthNames[month]} ${year}`;

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = dayHeaders.map(d => `<div class="cal-day-header">${d}</div>`).join("");

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    html += `<div class="cal-day other-month"><span class="day-number">${dayNum}</span></div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const isSelected = calendarSelectedDate === dateStr;
    const dayName = new Date(year, month, d).toLocaleDateString('en-US', { weekday: 'long' });

    // Get events for this date
    const dayEvents = events.filter(ev => ev.day === dayName);
    const hasEvents = dayEvents.length > 0;

    html += `<div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectCalendarDate('${dateStr}', '${dayName}')">
      <span class="day-number">${d}</span>
      ${hasEvents ? `<div class="day-dots">${dayEvents.slice(0, 4).map(ev => `<span class="day-dot ${ev.category || 'study'}"></span>`).join('')}</div>` : ''}
    </div>`;
  }

  // Next month padding
  const totalCells = startDayOfWeek + daysInMonth;
  const remainingCells = 7 - (totalCells % 7);
  if (remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      html += `<div class="cal-day other-month"><span class="day-number">${d}</span></div>`;
    }
  }

  gridEl.innerHTML = html;

  // Show events for selected date
  if (calendarSelectedDate) {
    const parts = calendarSelectedDate.split("-");
    const selDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const selDayName = selDate.toLocaleDateString('en-US', { weekday: 'long' });
    showCalendarDayEvents(selDayName, calendarSelectedDate);
  }
}

function changeMonth(delta) {
  calendarMonthOffset += delta;
  renderCalendarMonth();
}

function selectCalendarDate(dateStr, dayName) {
  calendarSelectedDate = dateStr;
  renderCalendarMonth();
  showCalendarDayEvents(dayName, dateStr);
}

function showCalendarDayEvents(dayName, dateStr) {
  const dateLabel = document.getElementById("calendarSelectedDate");
  const eventsList = document.getElementById("calendarEventsList");
  if (!dateLabel || !eventsList) return;

  const displayDate = new Date(dateStr + "T12:00:00");
  dateLabel.textContent = displayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const dayEvents = events
    .filter(ev => ev.day === dayName)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (dayEvents.length === 0) {
    eventsList.innerHTML = '<p class="empty-state">No events scheduled for this day</p>';
    return;
  }

  eventsList.innerHTML = dayEvents.map(ev => `
    <div class="calendar-event-item">
      <span class="event-time">${ev.start} - ${ev.end}</span>
      <span class="event-title">${ev.completed ? '✅ ' : ''}${ev.title}</span>
      <span class="event-cat badge-${ev.category || 'study'}">${(ev.category || 'study').toUpperCase()}</span>
    </div>
  `).join("");
}

// ========================================================
//     📋 MY TASKS VIEW
// ========================================================
let myTasks = JSON.parse(localStorage.getItem("myTasks") || "[]");
let activeTaskCategory = "all";

function saveMyTasks() {
  localStorage.setItem("myTasks", JSON.stringify(myTasks));
  updateTaskCategoryCounts();
  updateDashboardStats();
}

function updateTaskCategoryCounts() {
  const categories = ["all", "codes", "teachers", "fun", "general"];
  categories.forEach(cat => {
    const el = document.getElementById(`cat-count-${cat}`);
    if (!el) return;
    const count = cat === "all" ? myTasks.length : myTasks.filter(t => t.category === cat).length;
    el.textContent = count;
  });
}

function switchTaskCategory(category) {
  activeTaskCategory = category;
  document.querySelectorAll(".task-category").forEach(el => {
    el.classList.toggle("active", el.dataset.cat === category);
  });
  renderMyTasks();
}

function renderMyTasks() {
  const container = document.getElementById("tasksListContainer");
  if (!container) return;

  const filtered = activeTaskCategory === "all"
    ? myTasks
    : myTasks.filter(t => t.category === activeTaskCategory);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="text-align:center;padding:40px;">No tasks in this category. Add one above!</div>`;
    return;
  }

  container.innerHTML = filtered.map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}">
      <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} onchange="toggleMyTask('${task.id}')" />
      <div class="task-info">
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span class="task-cat-badge">${task.category}</span>
          <span class="task-priority ${task.priority}">${task.priority}</span>
          ${task.due ? `<span>📅 ${task.due}</span>` : ''}
        </div>
      </div>
      <button class="task-delete-btn" onclick="deleteMyTask('${task.id}')">✕</button>
    </div>
  `).join("");

  updateTaskCategoryCounts();
}

function addMyTask() {
  const input = document.getElementById("new-task-input");
  const category = document.getElementById("new-task-category");
  const priority = document.getElementById("new-task-priority");
  const due = document.getElementById("new-task-due");

  if (!input || !input.value.trim()) return;

  myTasks.push({
    id: `mytask_${Date.now()}`,
    title: input.value.trim(),
    category: category.value,
    priority: priority.value,
    due: due.value || null,
    completed: false,
    createdAt: new Date().toISOString()
  });

  input.value = "";
  due.value = "";
  saveMyTasks();
  renderMyTasks();
}

function toggleMyTask(id) {
  myTasks = myTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  saveMyTasks();
  renderMyTasks();
}

function deleteMyTask(id) {
  myTasks = myTasks.filter(t => t.id !== id);
  saveMyTasks();
  renderMyTasks();
}

function exportTasksBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(myTasks, null, 2));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = `my_tasks_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function importTasksBackup(e) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data)) {
        myTasks = data;
        saveMyTasks();
        renderMyTasks();
        alert("Tasks imported successfully.");
      }
    } catch(err) {
      alert("Error importing tasks.");
    }
    e.target.value = "";
  };
  reader.readAsText(e.target.files[0]);
}

// ========================================================
//     📚 LIBRARY VIEW
// ========================================================
let libraryItems = JSON.parse(localStorage.getItem("libraryItems") || "[]");

function saveLibraryItems() {
  localStorage.setItem("libraryItems", JSON.stringify(libraryItems));
  updateDashboardStats();
}

function renderLibrary() {
  const grid = document.getElementById("libraryItemsGrid");
  const search = document.getElementById("library-search");
  const filter = document.getElementById("library-category-filter");
  if (!grid) return;

  const searchTerm = (search?.value || "").toLowerCase();
  const filterCat = filter?.value || "all";

  const filtered = libraryItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm) ||
      item.url.toLowerCase().includes(searchTerm) ||
      (item.tags || "").toLowerCase().includes(searchTerm);
    const matchesCat = filterCat === "all" || item.category === filterCat;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="text-align:center;padding:40px;grid-column:1/-1;">No library items found. Add your first bookmark above!</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="library-item-card">
      <div class="lib-title">${item.title}</div>
      <a href="${item.url}" target="_blank" class="lib-url">${item.url}</a>
      ${item.tags ? `<div class="lib-tags">${item.tags.split(",").map(t => `<span class="lib-tag">${t.trim()}</span>`).join("")}</div>` : ''}
      <div class="lib-footer">
        <span class="lib-cat ${item.category}">${item.category}</span>
        <button class="lib-delete" onclick="deleteLibraryItem('${item.id}')">✕</button>
      </div>
    </div>
  `).join("");
}

function addLibraryItem() {
  const title = document.getElementById("library-title");
  const url = document.getElementById("library-url");
  const category = document.getElementById("library-category");
  const tags = document.getElementById("library-tags");

  if (!title?.value?.trim() || !url?.value?.trim()) return;

  libraryItems.push({
    id: `lib_${Date.now()}`,
    title: title.value.trim(),
    url: url.value.trim(),
    category: category.value,
    tags: tags?.value?.trim() || "",
    createdAt: new Date().toISOString()
  });

  title.value = "";
  url.value = "";
  tags.value = "";
  saveLibraryItems();
  renderLibrary();
}

function deleteLibraryItem(id) {
  libraryItems = libraryItems.filter(item => item.id !== id);
  saveLibraryItems();
  renderLibrary();
}

function exportLibraryBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(libraryItems, null, 2));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = `library_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function importLibraryBackup(e) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data)) {
        libraryItems = data;
        saveLibraryItems();
        renderLibrary();
        alert("Library imported successfully.");
      }
    } catch(err) {
      alert("Error importing library.");
    }
    e.target.value = "";
  };
  reader.readAsText(e.target.files[0]);
}

// ==========================================
// 🖼️ CUSTOM WIDGETS SYSTEM
// ==========================================
let customWidgets = JSON.parse(localStorage.getItem('customWidgets') || '[]');

function saveCustomWidgets() {
  localStorage.setItem('customWidgets', JSON.stringify(customWidgets));
}

function closeWidgetModal() {
  document.getElementById('widgetModal').style.display = 'none';
}

function updateWidgetFormFields() {
  const type = document.getElementById('widgetType').value;
  const container = document.getElementById('widgetDynamicFields');
  let html = '';

  switch(type) {
    case 'notes':
      html = `
        <div class="widget-form-group">
          <label>Initial Note Content</label>
          <textarea id="widgetNoteContent" placeholder="Write your notes here...">${''}</textarea>
        </div>
      `;
      break;
    case 'links':
      html = `
        <div class="widget-form-group">
          <label>Links (one per line: Title | URL)</label>
          <textarea id="widgetLinksData" rows="4" placeholder="Google | https://google.com&#10;YouTube | https://youtube.com"></textarea>
        </div>
      `;
      break;
    case 'stats':
      html = `
        <div class="widget-form-group">
          <label>Stats (one per line: Label | Value)</label>
          <textarea id="widgetStatsData" rows="4" placeholder="Study Hours | 25&#10;Tasks Done | 15&#10;Focus Sessions | 8"></textarea>
        </div>
      `;
      break;
    case 'timer':
      html = `
        <div class="widget-form-group">
          <label>Timer Duration (minutes)</label>
          <input type="number" id="widgetTimerMinutes" value="25" min="1" max="120" />
        </div>
      `;
      break;
    case 'quote':
      html = `
        <div class="widget-form-group">
          <label>Quote Text</label>
          <textarea id="widgetQuoteText" rows="3" placeholder="Enter your motivational quote...">The only way to do great work is to love what you do.</textarea>
        </div>
        <div class="widget-form-group">
          <label>Author</label>
          <input type="text" id="widgetQuoteAuthor" placeholder="Steve Jobs" value="Steve Jobs" />
        </div>
      `;
      break;
    case 'weather':
      html = `
        <div class="widget-form-group">
          <label>Location</label>
          <input type="text" id="widgetWeatherLocation" placeholder="Phnom Penh" value="Phnom Penh" />
        </div>
        <p style="font-size:0.75rem;color:#64748b;margin-top:4px;">Weather data is simulated for demo purposes</p>
      `;
      break;
  }

  container.innerHTML = html;
}
function renderWidgets() {
  const grid = document.getElementById('dashWidgetsGrid');
  if (!grid) return;

  if (customWidgets.length === 0) {
    grid.innerHTML = '<p style="color:#475569;font-style:italic;grid-column:1/-1;text-align:center;padding:40px;">No widgets yet. Click "+ Add Widget" to create your first widget.</p>';
    return;
  }

  grid.innerHTML = customWidgets.map(widget => {
    let content = '';
    const typeClass = `widget-${widget.type}`;

    switch(widget.type) {
      case 'notes':
        content = `<textarea placeholder="Write your notes..." onchange="updateWidgetContent('${widget.id}', this.value)">${widget.content || ''}</textarea>`;
        break;
      case 'links':
        content = '<div class="widget-links">' +
          (widget.links || []).map(link =>
            `<a href="${link.url}" target="_blank" class="widget-link-item">🔗 ${link.name}</a>`
          ).join('') +
          '</div>';
        break;
      case 'stats':
        content = '<div class="widget-stats">' +
          (widget.stats || []).map(stat =>
            `<div class="widget-stat-item">
              <span class="widget-stat-label">${stat.label}</span>
              <span class="widget-stat-value">${stat.value}</span>
            </div>`
          ).join('') +
          '</div>';
        break;
      case 'timer':
        const minutes = Math.floor(widget.remainingSeconds / 60);
        const seconds = widget.remainingSeconds % 60;
        const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        content = `
          <div class="widget-timer">
            <div class="widget-timer-display" id="timer-${widget.id}">${timeDisplay}</div>
            <div class="widget-timer-controls">
              <button class="widget-timer-btn" onclick="toggleWidgetTimer('${widget.id}')">${widget.timerRunning ? 'Pause' : 'Start'}</button>
              <button class="widget-timer-btn" onclick="resetWidgetTimer('${widget.id}')">Reset</button>
            </div>
          </div>
        `;
        break;
      case 'quote':
        content = `
          <div class="widget-quote">
            "${widget.quoteText || 'No quote set'}"
            ${widget.quoteAuthor ? `<div class="widget-quote-author">— ${widget.quoteAuthor}</div>` : ''}
          </div>
        `;
        break;
      case 'weather':
        content = `
          <div class="widget-weather">
            <div class="widget-weather-icon">${widget.icon || '🌤️'}</div>
            <div class="widget-weather-temp">${widget.temp || 28}°C</div>
            <div class="widget-weather-desc">${widget.condition || 'Sunny'} · ${widget.location || 'Unknown'}</div>
          </div>
        `;
        break;
    }

    return `
      <div class="widget-card ${typeClass}">
        <div class="widget-header">
          <div class="widget-title">${widget.title}</div>
          <div class="widget-actions">
            <button class="widget-btn delete" onclick="deleteWidget('${widget.id}')" title="Delete widget">✕</button>
          </div>
        </div>
        <div class="widget-content">${content}</div>
      </div>
    `;
  }).join('');
}

function updateWidgetContent(widgetId, newContent) {
  const widget = customWidgets.find(w => w.id === widgetId);
  if (widget && widget.type === 'notes') {
    widget.content = newContent;
    saveCustomWidgets();
  }
}

function toggleWidgetTimer(widgetId) {
  const widget = customWidgets.find(w => w.id === widgetId);
  if (!widget || widget.type !== 'timer') return;

  widget.timerRunning = !widget.timerRunning;

  if (widget.timerRunning) {
    widget.timerInterval = setInterval(() => {
      if (widget.remainingSeconds > 0) {
        widget.remainingSeconds--;
        updateTimerDisplay(widget);
      } else {
        clearInterval(widget.timerInterval);
        widget.timerRunning = false;
        widget.remainingSeconds = widget.minutes * 60;
        showToast('Timer finished!', 'success');
        renderWidgets();
      }
    }, 1000);
  } else {
    clearInterval(widget.timerInterval);
  }

  saveCustomWidgets();
  renderWidgets();
}

function resetWidgetTimer(widgetId) {
  const widget = customWidgets.find(w => w.id === widgetId);
  if (!widget || widget.type !== 'timer') return;

  if (widget.timerInterval) clearInterval(widget.timerInterval);
  widget.timerRunning = false;
  widget.remainingSeconds = widget.minutes * 60;
  saveCustomWidgets();
  renderWidgets();
}

function updateTimerDisplay(widget) {
  const display = document.getElementById(`timer-${widget.id}`);
  if (!display) return;

  const minutes = Math.floor(widget.remainingSeconds / 60);
  const seconds = widget.remainingSeconds % 60;
  display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Initialize widgets on load
document.addEventListener('DOMContentLoaded', () => {
  renderWidgets();
});

// ==========================================
// 🔥 ARLECCHINO-STYLE FLAME BACKGROUND
// ==========================================
const flameCanvas = document.getElementById('flameCanvas');
const flameCtx = flameCanvas.getContext('2d');
let flameParticles = [];
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

function resizeFlameCanvas() {
  flameCanvas.width = window.innerWidth;
  flameCanvas.height = window.innerHeight;
}
resizeFlameCanvas();
window.addEventListener('resize', resizeFlameCanvas);

document.addEventListener('mousemove', (e) => {
  targetMouseX = e.clientX;
  targetMouseY = e.clientY;
});

class FlameParticle {
  constructor() {
    this.reset();
  }

  reset() {
    // Spawn from bottom of screen with some randomness
    this.x = Math.random() * flameCanvas.width;
    this.y = flameCanvas.height + Math.random() * 100;
    this.size = Math.random() * 4 + 2;
    this.speedY = Math.random() * 3 + 1.5;
    this.speedX = (Math.random() - 0.5) * 1;
    this.life = 1;
    this.decay = Math.random() * 0.012 + 0.005;
    // Vibrant fire palette: yellow -> orange -> red
    const colorType = Math.random();
    if (colorType < 0.3) {
      // Bright yellow/white core
      this.color = `hsla(45, 100%, 70%, `;
      this.size = Math.random() * 3 + 2;
    } else if (colorType < 0.7) {
      // Orange flames
      this.color = `hsla(25, 100%, 55%, `;
      this.size = Math.random() * 4 + 2;
    } else {
      // Red/crimson flames
      this.color = `hsla(5, 100%, 50%, `;
      this.size = Math.random() * 5 + 3;
    }
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.15 + 0.05;
    this.flickerSpeed = Math.random() * 0.2 + 0.1;
    this.flickerOffset = Math.random() * Math.PI * 2;
    // Add turbulence for more dynamic movement
    this.turbulence = Math.random() * 0.5;
    this.turbulenceOffset = Math.random() * Math.PI * 2;
  }

  update() {
    // Smooth mouse follow
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Move upward with flickering speed
    this.flickerOffset += this.flickerSpeed;
    const flicker = Math.sin(this.flickerOffset) * 0.5 + 0.5;
    this.y -= this.speedY * (0.8 + flicker * 0.4);

    // Add turbulence for more natural fire movement
    this.turbulenceOffset += 0.1;
    const turbulenceX = Math.sin(this.turbulenceOffset) * this.turbulence;
    const turbulenceY = Math.cos(this.turbulenceOffset * 1.3) * this.turbulence * 0.5;

    // Wobble effect with turbulence
    this.wobble += this.wobbleSpeed;
    this.x += this.speedX + Math.sin(this.wobble) * 0.8 + turbulenceX;
    this.y += turbulenceY;

    // Mouse interaction - particles are attracted to mouse
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 150) {
      const force = (150 - dist) / 150;
      this.x += dx * force * 0.03;
      this.y += dy * force * 0.03;
    }

    // Decay life
    this.life -= this.decay;

    // Reset if dead or off screen
    if (this.life <= 0 || this.y < -50) {
      this.reset();
    }
  }

  draw() {
    const alpha = this.life * 0.8;
    const glowSize = this.size * 4;

    // Create glowing effect with enhanced brightness
    const gradient = flameCtx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, glowSize
    );
    gradient.addColorStop(0, this.color + Math.min(alpha * 1.2, 1) + ')');
    gradient.addColorStop(0.2, this.color + (alpha * 0.9) + ')');
    gradient.addColorStop(0.5, this.color + (alpha * 0.5) + ')');
    gradient.addColorStop(0.8, this.color + (alpha * 0.1) + ')');
    gradient.addColorStop(1, this.color + '0)');

    flameCtx.fillStyle = gradient;
    flameCtx.beginPath();
    flameCtx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
    flameCtx.fill();

    // Add bright core with white-hot center
    if (this.life > 0.3) {
      const coreGradient = flameCtx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size
      );
      const coreIntensity = Math.min(alpha * 1.5, 1);
      coreGradient.addColorStop(0, `rgba(255, 255, 255, ${coreIntensity})`);
      coreGradient.addColorStop(0.3, `rgba(255, 255, 200, ${coreIntensity * 0.8})`);
      coreGradient.addColorStop(0.6, `rgba(255, 220, 100, ${coreIntensity * 0.4})`);
      coreGradient.addColorStop(1, `rgba(255, 150, 50, 0)`);

      flameCtx.fillStyle = coreGradient;
      flameCtx.beginPath();
      flameCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      flameCtx.fill();
    }
  }
}

// Initialize particles
for (let i = 0; i < 200; i++) {
  const particle = new FlameParticle();
  particle.y = Math.random() * flameCanvas.height; // Spread initially
  flameParticles.push(particle);
}

function animateFlames() {
  // Semi-transparent clear for trail effect
  flameCtx.fillStyle = 'rgba(3, 7, 18, 0.15)';
  flameCtx.fillRect(0, 0, flameCanvas.width, flameCanvas.height);

  // Draw multiple flickering light sources at bottom
  const time = Date.now() * 0.001;

  // Main fire glow at bottom center - enhanced with multiple flicker frequencies
  const mainGlow = flameCtx.createRadialGradient(
    flameCanvas.width / 2, flameCanvas.height, 0,
    flameCanvas.width / 2, flameCanvas.height - 150, 300
  );
  const flicker1 = 0.25 + Math.sin(time * 3) * 0.06 + Math.sin(time * 7) * 0.04 + Math.cos(time * 11) * 0.02;
  mainGlow.addColorStop(0, `rgba(255, 180, 80, ${flicker1})`);
  mainGlow.addColorStop(0.3, `rgba(255, 140, 50, ${flicker1 * 0.7})`);
  mainGlow.addColorStop(0.6, `rgba(255, 100, 30, ${flicker1 * 0.4})`);
  mainGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');

  flameCtx.fillStyle = mainGlow;
  flameCtx.fillRect(0, flameCanvas.height - 300, flameCanvas.width, 300);

  // Secondary flickering lights - more dynamic
  for (let i = 0; i < 4; i++) {
    const x = flameCanvas.width * (0.15 + i * 0.25);
    const flicker2 = 0.2 + Math.sin(time * (4 + i)) * 0.1 + Math.cos(time * (6 + i)) * 0.06 + Math.sin(time * (9 + i)) * 0.03;
    const secondaryGlow = flameCtx.createRadialGradient(
      x, flameCanvas.height, 0,
      x, flameCanvas.height - 120, 180
    );
    secondaryGlow.addColorStop(0, `rgba(255, 220, 120, ${flicker2})`);
    secondaryGlow.addColorStop(0.3, `rgba(255, 160, 70, ${flicker2 * 0.6})`);
    secondaryGlow.addColorStop(0.6, `rgba(255, 100, 40, ${flicker2 * 0.3})`);
    secondaryGlow.addColorStop(1, 'rgba(255, 60, 10, 0)');

    flameCtx.fillStyle = secondaryGlow;
    flameCtx.fillRect(x - 180, flameCanvas.height - 250, 360, 250);
  }

  // Update and draw particles
  flameParticles.forEach(particle => {
    particle.update();
    particle.draw();
  });

  // Add more frequent ember sparks with varying sizes and flickering
  const sparkCount = Math.floor(Math.random() * 4) + 3;
  for (let i = 0; i < sparkCount; i++) {
    const sparkX = Math.random() * flameCanvas.width;
    const sparkY = flameCanvas.height - Math.random() * 180;
    const sparkSize = Math.random() * 2.5 + 0.5;
    const sparkAlpha = Math.random() * 0.9 + 0.1;
    const sparkFlicker = Math.sin(time * 10 + i) * 0.3 + 0.7;

    // Flickering spark color with variation
    const sparkHue = 25 + Math.random() * 25; // Wider orange-yellow range
    flameCtx.fillStyle = `hsla(${sparkHue}, 100%, 65%, ${sparkAlpha * sparkFlicker})`;
    flameCtx.beginPath();
    flameCtx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
    flameCtx.fill();

    // Add glow to larger sparks
    if (sparkSize > 1.5) {
      const sparkGlow = flameCtx.createRadialGradient(
        sparkX, sparkY, 0,
        sparkX, sparkY, sparkSize * 3
      );
      sparkGlow.addColorStop(0, `hsla(${sparkHue}, 100%, 70%, ${sparkAlpha * 0.5})`);
      sparkGlow.addColorStop(1, `hsla(${sparkHue}, 100%, 50%, 0)`);
      flameCtx.fillStyle = sparkGlow;
      flameCtx.beginPath();
      flameCtx.arc(sparkX, sparkY, sparkSize * 3, 0, Math.PI * 2);
      flameCtx.fill();
    }
  }

  requestAnimationFrame(animateFlames);
}

animateFlames();
