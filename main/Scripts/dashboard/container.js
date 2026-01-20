const optionsCustom = document.querySelector('.acting-options');

function actingSelect() {
  optionsCustom.classList.toggle('show');
}

const settingContainer = document.querySelector('.settings-container');
const calendarContainer = document.querySelector('.calendar-container');
const attendanceContainer = document.querySelector('.student-attendance-container');
const statisticsContainer = document.querySelector('.student-statistics-container');
const dashboardContainer = document.querySelector('.dashboard-container');

function closeAll() {
  if (settingContainer) settingContainer.classList.add('closed');
  if (calendarContainer) calendarContainer.classList.add('closed');
  if (attendanceContainer) attendanceContainer.classList.add('closed');
  if (statisticsContainer) statisticsContainer.classList.add('closed');
  if (dashboardContainer) dashboardContainer.classList.add('closed');
}

function showContainerForHash(hash) {
  closeAll();
  switch ((hash || '').toString().toLowerCase()) {
    case '#settings':
      if (settingContainer) settingContainer.classList.remove('closed');
      break;
    case '#calendar':
      if (calendarContainer) calendarContainer.classList.remove('closed');
      break;
    case '#attendance':
      if (attendanceContainer) attendanceContainer.classList.remove('closed');
      break;
    case '#statistics':
      if (statisticsContainer) statisticsContainer.classList.remove('closed');
      break;
    case '#dashboard':
    default:
      if (dashboardContainer) dashboardContainer.classList.remove('closed');
      break;
  }
}

// respond to hash changes (keeps behavior consistent with sidebar.js)
window.addEventListener('hashchange', () => {
  showContainerForHash(window.location.hash);
});

// initialize on load
document.addEventListener('DOMContentLoaded', () => {
  showContainerForHash(window.location.hash || '#dashboard');
});

// Make profile-info buttons navigate to settings and close sidebar
document.addEventListener('DOMContentLoaded', () => {
  const navToSettings = (e) => {
    e?.preventDefault();
    // update hash to trigger existing handlers
    window.location.hash = '#settings';
    // ensure settings container shows immediately
    try { showContainerForHash('#settings'); } catch (e) { }
    // close sidebar and hide labels
    const sidebar = document.getElementById('side-bar');
    const toggleButton = document.getElementById('toggle-btn');
    const sub = document.querySelector('.sub');
    const sub2 = document.querySelector('.sub2');
    if (sidebar && !sidebar.classList.contains('close')) sidebar.classList.add('close');
    if (toggleButton && !toggleButton.classList.contains('rotate')) toggleButton.classList.add('rotate');
    if (sub) sub.classList.add('hide-text');
    if (sub2) sub2.classList.add('hide-text');
    // close any opened sub-menus
    if (sidebar) {
      Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
        ul.classList.remove('show');
        if (ul.previousElementSibling) ul.previousElementSibling.classList.remove('rotate');
      });
    }
    // update active nav if available
    if (typeof setActiveNav === 'function') setActiveNav();
  };

  document.querySelectorAll('#opn-pf-info').forEach(btn => {
    btn.addEventListener('click', navToSettings);
  });
});

// Notification panel toggle
const ntfPanel = document.getElementById('ntf-panel');
const ntfList = document.getElementById('ntf-list');
const noNtf = document.getElementById('no-ntf');

function updateNtfMessage() {
  if (!ntfPanel) return;
  // determine if there are any notification items
  const list = ntfList || ntfPanel.querySelector('#ntf-list');
  const no = noNtf || ntfPanel.querySelector('#no-ntf');
  if (!list || !no) return;
  if (list.children.length === 0) {
    no.style.display = 'block';
  } else {
    no.style.display = 'none';
  }
}

function ntfPanelPos(el) {
  if (!ntfPanel) return;
  const ntfIcon = el || document.querySelector('.notification-btn');
  if (!ntfIcon) return;
  const rect = ntfIcon.getBoundingClientRect();
  const x = rect.left + window.scrollX - ntfPanel.offsetWidth + rect.width;
  const y = rect.top + window.scrollY + rect.height + 10; // 10px offset below icon
  ntfPanel.style.left = x + 'px';
  ntfPanel.style.top = y + 'px';
  ntfPanel.style.display = 'block';
}

// attach handler to all notification buttons (supports multiple instances)
const ntfButtons = document.querySelectorAll('.notification-btn');
if (ntfButtons && ntfButtons.length) {
  ntfButtons.forEach(btn => {
    btn.addEventListener('click', function (e) {
      if (ntfPanel) ntfPanel.classList.toggle('show');
      // update fallback message visibility
      try { updateNtfMessage(); } catch (err) { }
      // position panel relative to the clicked button
      try { ntfPanelPos(btn); } catch (err) { }
    });
  });
} else {
  // fallback for single element with id (legacy)
  const single = document.getElementById('notification');
  if (single) {
    single.addEventListener('click', function () {
      if (ntfPanel) ntfPanel.classList.toggle('show');
      try { updateNtfMessage(); } catch (err) { }
      try { ntfPanelPos(single); } catch (err) { }
    });
  }
}

// ensure fallback message correct on load
document.addEventListener('DOMContentLoaded', () => {
  try { updateNtfMessage(); } catch (err) { }
});

