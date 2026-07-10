// ==========================================
// CONSTANTS & STATE
// ==========================================
const MAX_UNDO_STEPS = 20;
let undoStack = [];
let redoStack = [];
let draggedEvent = null;
let typingTimer;

// ==========================================
// DRAG AND DROP SYSTEM
// ==========================================
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
// ↩️ UNDO/REDO SYSTEM
// ==========================================
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
// 🖱️ WHEEL PICKER HELPERS
// ==========================================
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

// ==========================================
// 📋 FORM VALIDATION
// ==========================================
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

// ==========================================
// 🔄 AUTO-COMPLETE PAST EVENTS
// ==========================================
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

// ==========================================
// 📱 PLANNER NAVIGATION
// ==========================================
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

// ==========================================
// 🖼️ CONTEXT MENU
// ==========================================
let activeRightClickDay = "";

function showContextMenu(e, day) {
  activeRightClickDay = day;
  let menu = document.getElementById("customContextMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "customContextMenu";
    menu.className = "custom-menu";
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
  }
  menu.innerHTML = `<div role="menuitem" onclick="deleteEntireDay()">❌ Clear All Tasks for ${day}</div>`;
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
    showToast(`Cleared all tasks for ${activeRightClickDay}`, 'warning');
  }
}

function deleteEvent(id) {
  events = events.filter(event => event.id !== id);
  saveEvents();
  renderSchedule();
  showToast('Task deleted', 'info');
}

// ==========================================
// 📝 DYNAMIC PRESET INJECTOR
// ==========================================
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

// ==========================================
// ✅ TASK COMPLETION TOGGLE
// ==========================================
function toggleTaskComplete(id, day) {
  events = events.map(ev => {
    if (ev.id === id) ev.completed = !ev.completed;
    return ev;
  });
  saveEvents();
  renderSchedule();
  openDayDiagram(day);
  const task = events.find(ev => ev.id === id);
  showToast(task.completed ? 'Task completed! 🎉' : 'Task marked as active', 'info');
}

// ==========================================
// 📅 SCHEDULE RENDERER
// ==========================================
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
    dayBox.setAttribute('role', 'button');
    dayBox.setAttribute('tabindex', '0');

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
        <span class="pulse-dot" aria-hidden="true"></span>
        ${eventCount} ${eventCount === 1 ? 'Task' : 'Tasks'} Scheduled
        ${hasOverlaps ? '<span class="day-overlap-flag" role="alert">⚠ Time conflict</span>' : ''}
      </div>
      <div class="mini-preview-list">
        ${dayEvents.slice(0, 3).map(ev => {
          const catClass = ev.category || 'study';
          const doneClass = ev.completed ? 'mini-done' : '';
          return `<div class="mini-dot color-${catClass} ${doneClass}">▪️ ${ev.title}</div>`;
        }).join('')}
        ${eventCount > 3 ? '<div class="mini-dot extra">...and more</div>' : ''}
      </div>
      <div class="progress-track" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" style="width: ${progressPercent}%"></div>
      </div>
    `;

    calendar.appendChild(dayBox);
  });
}

// ==========================================
// 📂 OPEN DAY PANEL
// ==========================================
let currentOpenDay = null;

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

            <label for="title">Task / Subject Name</label>
            <input id="title" required placeholder="Math Study, History Essay, etc..." />

            <label for="category">Task Category</label>
            <select id="category">
              <option value="study">📘 Study / Revision</option>
              <option value="assignment">📝 Homework / Assignment</option>
              <option value="class">🏫 Class / Lecture</option>
              <option value="break">☕ Break / Free Time</option>
            </select>

            <label for="link">Helpful Link (Optional)</label>
            <input id="link" type="url" placeholder="Google Drive, Zoom links..." />

            <div class="time-picker-row time-wheel-row">
              ${buildTimeWheelGroup("start", "Start Time", defaultTimes.startHour, defaultTimes.startMin)}
              ${buildTimeWheelGroup("end", "End Time", defaultTimes.endHour, defaultTimes.endMin)}
            </div>

            <label for="notes">Reminders / Quick Notes</label>
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
                <div class="color-option selected" data-color="default" onclick="selectEventColor(this)" style="width: 28px; height: 28px; border-radius: 50%; background: #38bdf8; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 1px #38bdf8;" role="button" tabindex="0" aria-label="Default color"></div>
                <div class="color-option" data-color="custom1" onclick="selectEventColor(this)" style="width: 28px; height: 28px; border-radius: 50%; background: #ef4444; cursor: pointer; border: 2px solid transparent;" role="button" tabindex="0" aria-label="Red color"></div>
                <div class="color-option" data-color="custom2" onclick="selectEventColor(this)" style="width: 28px; height: 28px; border-radius: 50%; background: #ec4899; cursor: pointer; border: 2px solid transparent;" role="button" tabindex="0" aria-label="Pink color"></div>
                <div class="color-option" data-color="custom3" onclick="selectEventColor(this)" style="width: 28px; height: 28px; border-radius: 50%; background: #8b5cf6; cursor: pointer; border: 2px solid transparent;" role="button" tabindex="0" aria-label="Purple color"></div>
                <div class="color-option" data-color="custom4" onclick="selectEventColor(this)" style="width: 28px; height: 28px; border-radius: 50%; background: #14b8a6; cursor: pointer; border: 2px solid transparent;" role="button" tabindex="0" aria-label="Teal color"></div>
                <div class="color-option" data-color="custom5" onclick="selectEventColor(this)" style="width: 28px; height: 28px; border-radius: 50%; background: #f97316; cursor: pointer; border: 2px solid transparent;" role="button" tabindex="0" aria-label="Orange color"></div>
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
        ? `<a href="${ev.link}" target="_blank" class="event-link" rel="noopener noreferrer">${ev.title}</a>`
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

// ==========================================
// 📤 FORM SUBMIT HANDLER
// ==========================================
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
      endDate: null
    } : null
  };

  events.push(newEvent);
  saveEvents();
  renderSchedule();
  updateAnalyticsDisplay();
  openDayDiagram(day);
  showToast('Task added successfully', 'success');
}

// ==========================================
// ❌ CLOSE DAY DIAGRAM
// ==========================================
function closeDayDiagram() {
  const modal = document.getElementById("diagramModal");
  if (modal) modal.style.display = "none";
  currentOpenDay = null;
}

// ==========================================
// 🚀 INITIALIZATION
// ==========================================
renderSchedule();
