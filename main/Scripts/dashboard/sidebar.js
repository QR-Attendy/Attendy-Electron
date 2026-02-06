// Run sidebar logic for both teacher-main and student-main
const MAIN_IDS = ['teacher-main', 'student-main'];

function initSidebar(sidebar) {
  const mainEl = sidebar.closest('main');
  const toggleButton = sidebar.querySelector('#toggle-btn');
  const sub = sidebar.querySelector('.sub');
  const sub2 = sidebar.querySelector('.sub2');
  const QRcontainer = sidebar.querySelector('#QR-main');

  function updateQRcontainerVisibility() {
    const hasShownSub = sidebar.querySelector('.show') !== null;
    const isSidebarClosed = sidebar.classList.contains('close');
    if (QRcontainer) {
      if (hasShownSub || isSidebarClosed) {
        QRcontainer.classList.toggle('hide-container', true);
      } else {
        QRcontainer.classList.toggle('hide-container', false);
      }
    }
  }

  function closeAllSubMenus() {
    Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
      ul.classList.remove('show');
      if (ul.previousElementSibling) ul.previousElementSibling.classList.remove('rotate');
    });
    updateQRcontainerVisibility();
  }

  function toggleSidebar() {
    sidebar.classList.toggle('close');
    if (toggleButton) toggleButton.classList.toggle('rotate');
    if (sub) sub.classList.toggle('hide-text');
    if (sub2) sub2.classList.toggle('hide-text');
    closeAllSubMenus();
  }

  function toggleSubMenu(button) {
    const next = button.nextElementSibling;
    if (!next || !next.classList.contains('show')) {
      closeAllSubMenus();
    }
    if (next) next.classList.toggle('show');
    button.classList.toggle('rotate');
    if (sidebar.classList.contains('close')) {
      sidebar.classList.toggle('close');
      if (toggleButton) toggleButton.classList.toggle('rotate');
      if (sub) sub.classList.toggle('hide-text');
      if (sub2) sub2.classList.toggle('hide-text');
    }
    updateQRcontainerVisibility();
  }

  if (toggleButton) toggleButton.addEventListener('click', toggleSidebar);

  sidebar.querySelectorAll('.dropdown-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleSubMenu(btn));
  });

  const scanBtn = sidebar.querySelector('#scan-QR');
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      const scannerContainer = document.querySelector('.scanner-container');
      if (scannerContainer) scannerContainer.classList.toggle('activate');
    });
  }

  updateQRcontainerVisibility();

  const settingsLink = sidebar.querySelector('a[href="#settings"]');
  if (settingsLink) {
    settingsLink.addEventListener('click', () => {
      if (!sidebar.classList.contains('close')) sidebar.classList.add('close');
      if (toggleButton && !toggleButton.classList.contains('rotate')) toggleButton.classList.add('rotate');
      if (sub) sub.classList.add('hide-text');
      if (sub2) sub2.classList.add('hide-text');
      closeAllSubMenus();
      updateQRcontainerVisibility();
    });
  }

  const showQRBtn = sidebar.querySelector('#show-QR');
  if (showQRBtn) {
    showQRBtn.addEventListener('click', () => {
      const panel = mainEl.querySelector('.Show-QR-panel');
      const container = mainEl.querySelector('.Show-QR-container');
      if (panel) panel.classList.toggle('active');
      if (container) container.classList.toggle('active');
    });
  }

  const clsQRBtn = mainEl.querySelector('#cls-Show-QR-Panel');
  if (clsQRBtn) {
    clsQRBtn.addEventListener('click', () => {
      const panel = mainEl.querySelector('.Show-QR-panel');
      const container = mainEl.querySelector('.Show-QR-container');
      if (panel) panel.classList.toggle('active');
      if (container) container.classList.toggle('active');
    });
  }
}

// Initialize sidebar for each main (teacher-main, student-main)
document.querySelectorAll(MAIN_IDS.map(id => '#' + id).join(', ')).forEach(mainEl => {
  const sidebar = mainEl.querySelector('nav');
  if (sidebar) initSidebar(sidebar);
});

function setActiveNav() {
  const hash = window.location.hash || '#dashboard';

  document.querySelectorAll(MAIN_IDS.map(id => '#' + id).join(', ')).forEach(mainEl => {
    const sidebar = mainEl.querySelector('nav');
    if (!sidebar) return;

    Array.from(sidebar.querySelectorAll('li.active')).forEach(li => li.classList.remove('active'));

    const targetAnchor = sidebar.querySelector(`a[href="${hash}"]`);
    if (targetAnchor) {
      const li = targetAnchor.closest('li');
      if (li) li.classList.add('active');

      const subMenu = targetAnchor.closest('.sub-menu');
      if (subMenu) {
        subMenu.classList.add('show');
        const parentButton = subMenu.previousElementSibling;
        if (parentButton) parentButton.classList.add('rotate');
        const parentLi = parentButton ? parentButton.closest('li') : null;
        if (parentLi) parentLi.classList.add('active');
      } else {
        Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
          ul.classList.remove('show');
          if (ul.previousElementSibling) ul.previousElementSibling.classList.remove('rotate');
        });
      }
    } else {
      Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
        ul.classList.remove('show');
        if (ul.previousElementSibling) ul.previousElementSibling.classList.remove('rotate');
      });
    }
  });
}

window.addEventListener('hashchange', () => {
  setActiveNav();
  updateQRcontainerVisibility();
});

setActiveNav();

// Ensure QR container visibility updates when nav/hash changes (initial run)
updateQRcontainerVisibility();

// Also update visibility when any sidebar nav link is clicked (some navigation may not change hash)
document.querySelectorAll('nav a[href^="#"]').forEach(a => {
  a.addEventListener('click', () => {
    // small timeout to allow any other click handlers to run first
    setTimeout(() => updateQRcontainerVisibility(), 10);
  });
});

// Global for container.js: update QR panel visibility in both sidebars
function updateQRcontainerVisibility() {
  document.querySelectorAll(MAIN_IDS.map(id => '#' + id).join(', ')).forEach(mainEl => {
    const sidebar = mainEl.querySelector('nav');
    if (!sidebar) return;
    const QRcontainer = sidebar.querySelector('#QR-main');
    const hasShownSub = sidebar.querySelector('.show') !== null;
    const isSidebarClosed = sidebar.classList.contains('close');
    if (QRcontainer) {
      QRcontainer.classList.toggle('hide-container', hasShownSub || isSidebarClosed);
    }
  });
}
