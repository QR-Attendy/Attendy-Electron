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
  // keep QR panel visibility in sync with current container/sidebar state
  try {
    if (typeof updateQRcontainerVisibility === 'function') updateQRcontainerVisibility();
  } catch (e) { /* ignore if helper not available */ }
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
    // ensure QR visibility updates after collapsing sidebar
    try {
      if (typeof updateQRcontainerVisibility === 'function') updateQRcontainerVisibility();
    } catch (e) { /* ignore */ }
  };

  document.querySelectorAll('#opn-pf-info').forEach(btn => {
    btn.addEventListener('click', navToSettings);
  });
});



// Notification panel logic
document.addEventListener('DOMContentLoaded', () => {
  const ntfPanel = document.getElementById('ntf-panel');
  const ntfList = document.getElementById('ntf-list');
  const noNtf = document.getElementById('no-ntf');
  const notificationBtns = Array.from(document.querySelectorAll('.notification-btn'));

  if (!ntfPanel || !ntfList || !noNtf) return;

  // update visibility of "no notifications" text
  function updateNtfVisibility() {
    const hasNotifications = Array.from(ntfList.children).some(n => n.nodeType === 1 && n.textContent.trim() !== '');
    noNtf.style.display = hasNotifications ? 'none' : 'block';
  }

  // position panel directly under button
  function positionPanelUnderButton(btn) {
    if (!btn) return;

    const btnRect = btn.getBoundingClientRect();
    const panelWidth = ntfPanel.offsetWidth;
    const panelHeight = ntfPanel.offsetHeight;

    let left = btnRect.left + window.scrollX;
    let top = btnRect.bottom + window.scrollY + 8; // 8px gap

    // keep panel within viewport horizontally
    const viewportRight = window.scrollX + window.innerWidth;
    if (left + panelWidth > viewportRight - 8) {
      left = Math.max(window.scrollX + 8, viewportRight - panelWidth - 8);
    }

    // if panel would go below viewport, try placing above the button
    const viewportBottom = window.scrollY + window.innerHeight;
    if (top + panelHeight > viewportBottom - 8) {
      const altTop = btnRect.top + window.scrollY - panelHeight - 8;
      if (altTop > window.scrollY + 8) top = altTop;
    }

    ntfPanel.style.left = `${Math.round(left)}px`;
    ntfPanel.style.top = `${Math.round(top)}px`;
  }

  // toggle panel show/hide, optionally anchored to btn
  function toggleNtfPanel(anchorBtn) {
    const isShown = ntfPanel.classList.contains('show')
    if (isShown) {
      ntfPanel.classList.remove('show');
    } else {
      updateNtfVisibility();
      positionPanelUnderButton(anchorBtn);
      ntfPanel.classList.add('show');
      // focus for keyboard handling
      ntfPanel.setAttribute('tabindex', '-1');
      ntfPanel.focus();
    }
  }

  // attach to all notification buttons
  notificationBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNtfPanel(e.currentTarget);
    });
  });

  // clicking inside panel should not close it
  ntfPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // click outside closes panel
  document.addEventListener('click', () => {
    if (ntfPanel.classList.contains('show')) ntfPanel.classList.remove('show');
  });

  // close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ntfPanel.classList.contains('show')) {
      ntfPanel.classList.remove('show');
    }
  });

  // reposition if viewport changes while open
  window.addEventListener('resize', () => {
    if (ntfPanel.style.display === 'block') {
      // try to find the currently active button (one that was last used)
      const activeBtn = document.querySelector('.notification-btn[aria-pressed="true"]') || document.querySelector('.notification-btn');
      positionPanelUnderButton(activeBtn);
    }
  });
  window.addEventListener('scroll', () => {
    if (ntfPanel.classList.contains('show')) {
      const activeBtn = document.querySelector('.notification-btn[aria-pressed="true"]') || document.querySelector('.notification-btn');
      positionPanelUnderButton(activeBtn);
    }
  }, { passive: true });

  // observe changes to notification list and update message visibility
  const mo = new MutationObserver(() => updateNtfVisibility());
  mo.observe(ntfList, { childList: true, subtree: false });

  // initial state
  ntfPanel.classList.remove('show');
  updateNtfVisibility();
});



