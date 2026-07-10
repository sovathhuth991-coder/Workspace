// Shared helpers extracted from MySchedule.js for cleaner organization.

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
      body,
      icon,
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

function showToast(message, type = 'info', duration = 3000) {
  // Sanitize message to prevent XSS
  const sanitizedMessage = String(message).replace(/[<>]/g, '');

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icons[type] || 'ℹ';

  const msgSpan = document.createElement('span');
  msgSpan.textContent = sanitizedMessage;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
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

  return Object.entries(productiveHours)
    .sort((a, b) => b[1].totalDuration - a[1].totalDuration)
    .slice(0, 3)
    .map(([hour]) => `${hour}:00 - ${parseInt(hour) + 1}:00`);
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

function selectEventColor(element) {
  document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
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

  const current = todayEvents.find(event => !event.completed && currentHHMM >= event.start && currentHHMM <= event.end);
  const next = todayEvents.find(event => !event.completed && event.start > currentHHMM);

  return { todayName, currentHHMM, todayEvents, current, next };
}

function saveEvents() {
  localStorage.setItem('scheduleEvents', JSON.stringify(events));
  if (typeof updateDashboardLiveSession === 'function') updateDashboardLiveSession();
  if (typeof updateDashboardStats === 'function') updateDashboardStats();
}
