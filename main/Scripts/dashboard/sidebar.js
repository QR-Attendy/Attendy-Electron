const toggleButton = document.getElementById('toggle-btn')
const sidebar = document.getElementById('side-bar')
const sub = document.querySelector('.sub');
const sub2 = document.querySelector('.sub2');
const QRcontainer = document.querySelector('#QR-main');

document.querySelector('#scan-QR').addEventListener('click', () => {
  const scannerContainer = document.querySelector('.scanner-container');
  if (scannerContainer) {
    scannerContainer.classList.toggle('activate');
  }
});

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

function toggleSidebar() {
  sidebar.classList.toggle('close')
  toggleButton.classList.toggle('rotate')
  sub.classList.toggle('hide-text')
  sub2.classList.toggle('hide-text')

  closeAllSubMenus()
  updateQRcontainerVisibility()
}

function toggleSubMenu(button) {

  if (!button.nextElementSibling.classList.contains('show')) {
    closeAllSubMenus()
  }

  button.nextElementSibling.classList.toggle('show')
  button.classList.toggle('rotate')

  if (sidebar.classList.contains('close')) {
    sidebar.classList.toggle('close')
    toggleButton.classList.toggle('rotate')
    sub.classList.toggle('hide-text')
    sub2.classList.toggle('hide-text')

  }
  updateQRcontainerVisibility()
}

function closeAllSubMenus() {
  Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
    ul.classList.remove('show')
    ul.previousElementSibling.classList.remove('rotate')
  })
  updateQRcontainerVisibility()
}

// Ensure initial visibility is correct on load
updateQRcontainerVisibility()

function setActiveNav() {
  const hash = window.location.hash || '#dashboard'

  // remove existing active classes
  Array.from(sidebar.querySelectorAll('li.active')).forEach(li => li.classList.remove('active'))

  // try to find an anchor matching the hash
  const targetAnchor = sidebar.querySelector(`a[href="${hash}"]`)
  if (targetAnchor) {
    const li = targetAnchor.closest('li')
    if (li) li.classList.add('active')

    // if this anchor is inside a sub-menu, also open the sub-menu and mark its parent li active
    const subMenu = targetAnchor.closest('.sub-menu')
    if (subMenu) {
      subMenu.classList.add('show')
      const parentButton = subMenu.previousElementSibling
      if (parentButton) parentButton.classList.add('rotate')
      const parentLi = parentButton ? parentButton.closest('li') : null
      if (parentLi) parentLi.classList.add('active')
    } else {
      // close other sub-menus if a top-level link is active
      closeAllSubMenus()
    }
  } else {
    // If we didn't find a matching anchor, just ensure submenus closed
    closeAllSubMenus()
  }
}

window.addEventListener('hashchange', () => {
  setActiveNav()
})

// initialize active state on load
setActiveNav()

// When user clicks Settings, collapse the sidebar for focus on settings
try {
  const settingsLink = sidebar.querySelector('a[href="#settings"]');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      // close sidebar UI
      if (!sidebar.classList.contains('close')) sidebar.classList.add('close')
      if (!toggleButton.classList.contains('rotate')) toggleButton.classList.add('rotate')
      if (sub) sub.classList.add('hide-text')
      if (sub2) sub2.classList.add('hide-text')
      closeAllSubMenus()
      updateQRcontainerVisibility()
    })
  }
} catch (e) { console.warn('settings collapse binding failed', e) }

// probably slap this here too (QR panel)
document.querySelector('#show-QR').addEventListener('click', () => {
  document.querySelector('.Show-QR-panel').classList.toggle('active');
  document.querySelector('.Show-QR-container').classList.toggle('active');

});

document.querySelector('#cls-Show-QR-Panel').addEventListener('click', () => {
  document.querySelector('.Show-QR-panel').classList.toggle('active');
  document.querySelector('.Show-QR-container').classList.toggle('active');

});