/*
 Attendy base on Website and WebApp lol
Develop by BELDAD-Ace on Github with the team group 1 for PR2

all rights reserved 2025
*/

const timerOut = 1500;
const start = 3;
const loaderDash = document.querySelector('.loading-interface-dash');

// Show loader on cold start only (skip on page reload / Ctrl+R)
document.addEventListener('DOMContentLoaded', () => {
  try {
    const shownKey = 'attendy_loader_shown';
    // sessionStorage persists for the window/tab and is cleared when the window is closed.
    if (!sessionStorage.getItem(shownKey)) {
      // show loader for configured `start` seconds then hide
      loaderin();
      setTimeout(() => {
        loaderout();
        try { sessionStorage.setItem(shownKey, '1'); } catch (e) { /* ignore */ }
      }, start * 1000);
    }
  } catch (e) {
    console.warn('Loader session logic failed', e);
  }
});

(async () => {
  const user = await window.attendyAPI.getSession();
  if (!user) location.reload(); // fallback

  // Display user full name, username, and email
  // email part will come soon if we have a server to connect email and send some kind of verification
  //if ther is no email display it as Unknown
  // the fact that its almost optional for users to have an email unless working on a company/School to save attendance records and retrieve on the cloud on their personal server
  document.querySelectorAll('#fullname, #fullname2, #fullname3, #fullname4')
    .forEach(el => el.innerText = user.fullname || "Unknown Name");

  document.querySelectorAll('#username, #username2, #username3, #username4')
    .forEach(el => el.innerText = "@" + user.username || "@" + "Unknown");

  document.querySelectorAll('#email, #email2, #email3, #email4')
    .forEach(el => el.innerText = user.email || "Unregistered User");


  const qr = await window.attendyAPI.generateQR(user);
  document.querySelectorAll("#qr-image").forEach(el => el.src = `data:image/png;base64,${qr.qr_base64}`);



})();


async function loaderin() {
  loaderDash.style.opacity = '1';
  loaderDash.style.zIndex = '3';
}
async function loaderout() {
  loaderDash.style.opacity = '0';
  loaderDash.style.zIndex = '1';
}

let currentUser = null;


// Show confirm modal when user clicks logout
document.getElementById("sign-out").addEventListener("click", (e) => {
  e.preventDefault();
  showConfirmDelete();
});

// Modal controls
function showConfirmDelete() {
  const modal = document.getElementById('confirm-sign-out-modal');
  if (!modal) return;
  modal.style.display = 'flex';
}

function hideConfirmDelete() {
  const modal = document.getElementById('confirm-sign-out-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

// wire modal buttons
document.addEventListener('DOMContentLoaded', () => {
  const noBtn = document.getElementById('confirm-sign-out-no');
  const yesBtn = document.getElementById('confirm-sign-out-yes');
  const modal = document.getElementById('confirm-sign-out-modal');
  if (noBtn) noBtn.addEventListener('click', () => hideConfirmDelete());
  if (yesBtn) yesBtn.addEventListener('click', async () => {
    // perform deletion and logout

    hideConfirmDelete();
    loaderin();
    await new Promise(resolve => setTimeout(resolve, timerOut));

    await performDeleteAndLogout();
  });
  // click outside to cancel
  if (modal) modal.addEventListener('click', (ev) => {
    if (ev.target === modal) hideConfirmDelete();
  });
});

async function performDeleteAndLogout() {
  try {
    const user = await window.attendyAPI.getSession();
    if (user && user.username) {
      try {
        await window.attendyAPI.deleteUser(user.username);
        // deleteUser already removes associated attendance rows on the server
      } catch (e) {
        console.warn('deleteUser failed', e);
      }
    }
  } catch (e) {
    console.warn('Could not get session for delete on logout', e);
  }
  // refresh the attendance table so the UI reflects the deletion
  try {
    if (typeof loadTable === 'function') {
      await loadTable();
      // small pause so the user can see the cleared table before logout
      await new Promise(res => setTimeout(res, 350));
    }
  } catch (e) {
    console.warn('Could not refresh table after delete', e);
  }

  await window.attendyAPI.logout();
}