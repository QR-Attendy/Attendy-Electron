/*
QR Attendy base on Website and WebApp lol
Develop by BELDAD-Ace on Github with the team group 1 for PR2

all rights reserved 2025

*/ 




//Script for Getting started
const started = document.querySelector('#start');

started.addEventListener('click', () => {

  document.querySelector('.main-title').style.display = 'none';
  document.querySelector('.body-started').style.display = 'block';
});

//Hopeless on falling in love

document.querySelector('#letsgo').addEventListener("click", start);

async function start() {
  event.preventDefault();
  const fullname = document.getElementById("fullname").value.trim();
  const username = document.getElementById("username").value.trim();
  const role = document.getElementById("role").value;


  if (!fullname || !username) {
    document.getElementById("warning-error").textContent = "Please fill in all required fields.";
    return;
  }

  const timer = 1000;
  // const loading = document.querySelector('.loading-interface');

  // loading.style.opacity = '1';
  // loading.style.zIndex = '100';

  await new Promise(resolve => setTimeout(resolve, timer));


  try {
    const user = await window.attendyAPI.createUser(fullname, username, role);

    await window.attendyAPI.saveSession(user);

    window.attendyAPI.openDashboard();
  } catch (error) {
    alert("Error creating user: " + error.message);
  }
}
