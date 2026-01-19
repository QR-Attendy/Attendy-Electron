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