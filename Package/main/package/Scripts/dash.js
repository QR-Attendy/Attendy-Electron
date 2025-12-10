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
document.getElementById("logoutBtn").addEventListener("click", (e) => {
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

(async () => {
  const user = await window.attendyAPI.getSession();
  if (!user) location.reload(); // fallback

  // Display user full name, username, and email
  // email part will come soon if we have a server to connect email and send some kind of verification
  //if ther is no email display it as Unknown
  // the fact that its almost optional for users to have an email unless working on a company/School to save attendance records and retrieve on the cloud on their personal server
  document.querySelector('#fullname').innerText = user.fullname;
  document.querySelector('#username').innerText = "@" + user.username;
  document.querySelector('#email').innerText = user.email || "Unregistered User";
  document.querySelector('#fullname2').innerText = user.fullname;
  document.querySelector('#username2').innerText = "@" + user.username;
  document.querySelector('#email2').innerText = user.email || "Unregistered User";

  document.getElementById('welcome').innerText = user.fullname;

  const qr = await window.attendyAPI.generateQR(user);
  document.getElementById("qr-image").src = `data:image/png;base64,${qr.qr_base64}`;

  // Apply role-based UI visibility
  try {
    applyRoleUI(user.role);
  } catch (e) {
    console.warn('applyRoleUI error', e);
  }

  // store current user and wire navigation buttons
  try {
    currentUser = user;
    // if student, compute monthly stats
    if (currentUser && (currentUser.role || '').toString().toLowerCase() === 'student') {
      updateStudentMonthlyStats(currentUser).catch(e => console.warn('monthly stats failed', e));
    }
    // render analysis chart depending on role
    if (currentUser) {
      const roleLower = (currentUser.role || '').toString().toLowerCase();
      if (roleLower === 'teacher') updateTeacherMonthlyAnalysis().catch(e => console.warn('teacher analysis failed', e));
      else updateStudentMonthlyAnalysis(currentUser).catch(e => console.warn('student analysis failed', e));
    }
    const dashBtn = document.getElementById('dashboard');
    const attendBtn = document.getElementById('attendance');
    const teacherBtn = document.getElementById('teachers');

    // Helper to set active navigation button styling
    function setActiveNav(btnEl) {
      try {
        document.querySelectorAll('.boto-Nav').forEach(n => n.classList.remove('on-page'));
        if (btnEl && btnEl.classList) btnEl.classList.add('on-page');
      } catch (e) { /* ignore */ }
    }

    function showDashboardView() {
      // restore role-based stats and attendance table visibility
      applyRoleUI(currentUser.role);
      // ensure calendar hidden
      const cal = document.querySelector('.calendar-container'); if (cal) cal.style.display = 'none';
      // hide analysis container on dashboard
      const analysisHide = document.querySelector('.analysis-container'); if (analysisHide) analysisHide.style.display = 'none';
      // make sure attendance table container visibility follows role
      const att = document.querySelector('.attendance-table-container');
      if (att) att.style.display = (currentUser.role && currentUser.role.toLowerCase() === 'teacher') ? 'flex' : 'none';
      // show greeting when on dashboard
      const greet = document.querySelector('.dashGreet'); if (greet) greet.style.display = '';
    }

    function showAttendanceCalendarView() {
      // hide stats
      document.querySelectorAll('.user-stat-student, .user-stat-teacher').forEach(el => el.style.display = 'none');
      // hide attendance table
      const att = document.querySelector('.attendance-table-container'); if (att) att.style.display = 'none';
      const teachers = document.querySelectorAll('.teacher-container'); teachers.forEach(t => t.style.display = 'none');

      // show calendar container
      const cal = document.querySelector('.calendar-container'); if (cal) cal.style.display = 'flex';
      // show analysis container when calendar is open
      const analysis = document.querySelector('.analysis-container'); if (analysis) analysis.style.display = 'flex';

      // hide greeting when calendar is open
      const greet = document.querySelector('.dashGreet'); if (greet) greet.style.display = 'none';

      // refresh analysis to reflect current role (teacher vs student)
      try {
        const roleLower = (currentUser && currentUser.role || '').toString().toLowerCase();
        if (roleLower === 'teacher') updateTeacherMonthlyAnalysis().catch(e => console.warn('teacher analysis failed', e));
        else updateStudentMonthlyAnalysis(currentUser).catch(e => console.warn('student analysis failed', e));
      } catch (e) { /* ignore */ }

      document.querySelector('.sub-dashboard-container').style.justifyContent = 'flex-start';
    }
    function showTeacherView() {
      // hide stats and other containers
      try {
        document.querySelectorAll('.user-stat-student, .user-stat-teacher').forEach(el => el.style.display = 'none');
        const att = document.querySelector('.attendance-table-container'); if (att) att.style.display = 'none';
        const cal = document.querySelector('.calendar-container'); if (cal) cal.style.display = 'none';
        const teachers = document.querySelectorAll('.teacher-container'); teachers.forEach(t => t.style.display = 'flex');
        const analysis = document.querySelector('.analysis-container'); if (analysis) analysis.style.display = 'none';
        const greet = document.querySelector('.dashGreet'); if (greet) greet.style.display = 'none';
        document.querySelector('.sub-dashboard-container').style.justifyContent = 'flex-start';
      } catch (e) { console.warn('showTeacherView failed', e); }
    }
    if (dashBtn) dashBtn.addEventListener('click', (e) => { e.preventDefault(); setActiveNav(dashBtn); showDashboardView(); });
    if (attendBtn) attendBtn.addEventListener('click', (e) => { e.preventDefault(); setActiveNav(attendBtn); showAttendanceCalendarView(); });
    if (teacherBtn) {
      teacherBtn.addEventListener('click', (e) => { e.preventDefault(); setActiveNav(teacherBtn); showTeacherView(); });
    }
    // wire register button if present (will be added to DOM)
    try {
      const reg = document.getElementById('register-now-btn');
      //None for now its not available yet
    } catch (e) { /* ignore */ }
  } catch (e) {
    console.warn('Navigation binding failed', e);
  }


})();

//This part is for the user to open up their profile with the QR Code and info
document.querySelector("#theUser").addEventListener("click", openInfo);
document.querySelector('#close-USER').addEventListener("click", closeInfo);
async function openInfo() {
  const userCheck = document.querySelector('#theUser-hover');
  // the button yes
  userCheck.classList.add('on-click');
}

// Utility: aggregate attendance rows into monthly counts per status for a year
function aggregateMonthlyCounts(rows, year, filterFn) {
  // months 0..11
  const months = Array.from({ length: 12 }, () => ({ Present: 0, Late: 0, Excused: 0, Absent: 0 }));
  function parseTS(ts) {
    if (!ts) return null;
    let d = new Date(ts);
    if (isNaN(d.getTime())) {
      if (typeof ts === 'number') d = new Date(ts * 1000);
      else if (!isNaN(parseInt(ts))) d = new Date(parseInt(ts) * 1000);
    }
    return isNaN(d.getTime()) ? null : d;
  }
  rows.forEach(r => {
    try {
      if (filterFn && !filterFn(r)) return;
      const ts = parseTS(r.time_in || r.timestamp || '');
      if (!ts) return;
      if (ts.getFullYear() !== year) return;
      const m = ts.getMonth();
      const s = (r.status || '').toString().toLowerCase();
      if (s.includes('present')) months[m].Present++;
      else if (s.includes('late')) months[m].Late++;
      else if (s.includes('excuse')) months[m].Excused++;
      else if (s.includes('absent')) months[m].Absent++;
    } catch (e) { /* ignore per-row errors */ }
  });
  return months;
}

// render a simple multiline SVG chart for four series into #analysis-chart
function renderMonthlySvg(monthsData, highlightMonth) {
  const container = document.getElementById('analysis-chart');
  const legend = document.getElementById('analysis-legend');
  if (!container || !legend) return;
  // prepare arrays
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const series = {
    Present: monthsData.map(m => m.Present),
    Late: monthsData.map(m => m.Late),
    Excused: monthsData.map(m => m.Excused),
    Absent: monthsData.map(m => m.Absent)
  };
  const colors = { Present: '#2ca02c', Late: '#ff7f0e', Excused: '#1f77b4', Absent: '#d62728' };
  // compute max
  const allVals = [].concat(...Object.values(series));
  const maxVal = Math.max(1, ...allVals);

  const w = Math.max(600, container.clientWidth || 600);
  const h = 160;
  const pad = { l: 32, r: 12, t: 12, b: 24 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  function toX(i) { return pad.l + (i / 11) * innerW; }
  function toY(v) { return pad.t + innerH - (v / maxVal) * innerH; }

  // build paths
  const paths = Object.keys(series).map(name => {
    const arr = series[name];
    const d = arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(v).toFixed(2)}`).join(' ');
    return { name, d, color: colors[name] };
  });

  // build svg
  let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  // grid lines
  for (let gy = 0; gy <= 4; gy++) {
    const y = pad.t + (gy / 4) * innerH;
    svg += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
  }
  // x labels
  labels.forEach((lab, i) => {
    svg += `<text x="${toX(i)}" y="${h - 4}" font-size="10" text-anchor="middle" fill="#444">${lab}</text>`;
  });
  // paths
  paths.forEach(p => {
    svg += `<path d="${p.d}" fill="none" stroke="${p.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  // points (add data attributes for tooltips)
  Object.keys(series).forEach(name => {
    const arr = series[name];
    const color = colors[name];
    arr.forEach((v, i) => {
      const cls = `analysis-point series-${name.toLowerCase()} month-${i}`;
      const rsz = (typeof highlightMonth !== 'undefined' && highlightMonth === i) ? 5 : 3;
      svg += `<circle class="${cls}" data-series="${name}" data-month="${i}" data-value="${v}" cx="${toX(i)}" cy="${toY(v)}" r="${rsz}" fill="${color}" stroke="#fff" stroke-width="0.5"/>`;
    });
  });

  svg += `</svg>`;
  container.innerHTML = svg;

  // save last data for export
  try { window._lastAnalysisMonthsData = monthsData; } catch (e) { /* ignore */ }

  // attach tooltip handlers
  let tooltip = document.getElementById('analysis-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'analysis-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.background = 'rgba(0,0,0,0.8)';
    tooltip.style.color = '#fff';
    tooltip.style.padding = '6px 8px';
    tooltip.style.fontSize = '12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.zIndex = 9999;
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
  }
  container.querySelectorAll('.analysis-point').forEach(pt => {
    pt.addEventListener('mouseenter', (ev) => {
      const series = pt.getAttribute('data-series');
      const month = parseInt(pt.getAttribute('data-month'), 10);
      const val = pt.getAttribute('data-value');
      tooltip.innerText = `${series} ${labels[month]}: ${val}`;
      tooltip.style.display = 'block';
    });
    pt.addEventListener('mousemove', (ev) => {
      tooltip.style.left = (ev.clientX + 12) + 'px';
      tooltip.style.top = (ev.clientY + 12) + 'px';
    });
    pt.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });

  // legend
  legend.innerHTML = Object.keys(series).map(k => `<span class="legend-item"><strong style="color:${colors[k]}">●</strong> ${k}: ${series[k].reduce((a, b) => a + b, 0)}</span>`).join(' ');
}

// Teacher analysis: aggregate over all students for current year
async function updateTeacherMonthlyAnalysis() {
  try {
    const res = await fetch('http://localhost:5005/get_attendance');
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const cy = (new Date()).getFullYear();
    // exclude teacher rows
    const months = aggregateMonthlyCounts(rows, cy, (r) => {
      const role = (r.role || '').toString().toLowerCase();
      return role !== 'teacher';
    });
    renderMonthlySvg(months);
    // show day breakdown based on currently selected date table rows
    updateAnalysisFromTable();
  } catch (e) {
    console.warn('updateTeacherMonthlyAnalysis failed', e);
  }
}

// Student analysis: only for specific user
async function updateStudentMonthlyAnalysis(user) {
  try {
    if (!user || !user.username) return;
    const res = await fetch('http://localhost:5005/get_attendance');
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const cy = (new Date()).getFullYear();
    const normalize = (s) => (s || '').toString().replace(/^@/, '').toLowerCase().trim();
    const uname = normalize(user.username);
    const months = aggregateMonthlyCounts(rows, cy, (r) => normalize(r.student_username || r.username || '') === uname);
    renderMonthlySvg(months);
    updateAnalysisFromTable();
  } catch (e) {
    console.warn('updateStudentMonthlyAnalysis failed', e);
  }
}

// Update analysis breakdown using current `#calendar-attendance-table` tbody rows
function updateAnalysisFromTable() {
  const tbody = document.querySelector('#calendar-attendance-table tbody');
  const breakdownEl = document.getElementById('analysis-day-breakdown');
  if (!tbody || !breakdownEl) return;
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.querySelector('td[colspan]'));
  let present = 0, late = 0, excused = 0, absent = 0;
  rows.forEach(r => {
    try {
      const cells = r.querySelectorAll('td');
      const status = (cells[4] && cells[4].innerText) ? cells[4].innerText.toString().toLowerCase() : '';
      if (status.includes('present')) present++;
      else if (status.includes('late')) late++;
      else if (status.includes('excuse')) excused++;
      else if (status.includes('absent')) absent++;
    } catch (e) { /* ignore */ }
  });
  breakdownEl.innerText = `Day counts — Present: ${present}, Late: ${late}, Excused: ${excused}, Absent: ${absent}`;
}

// Update analysis for the calendar-visible month and optionally highlight a specific selected date's month
async function updateAnalysisForVisibleMonth(month, year, selectedIso) {
  try {
    const res = await fetch('http://localhost:5005/get_attendance');
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const months = aggregateMonthlyCounts(rows, year, (r) => {
      const role = (r.role || '').toString().toLowerCase();
      return role !== 'teacher';
    });
    renderMonthlySvg(months, month);
  } catch (e) { console.warn('updateAnalysisForVisibleMonth failed', e); }
}

// Wire export button for analysis chart
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('analysis-export-btn');
  if (btn) btn.addEventListener('click', () => {
    try {
      const months = window._lastAnalysisMonthsData || [];
      if (!months.length) return alert('No analysis data to export');
      const data = months.map((m, idx) => ({ Month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][idx], Present: m.Present, Late: m.Late, Excused: m.Excused, Absent: m.Absent }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Analysis');
      XLSX.writeFile(wb, `analysis-${(new Date()).getFullYear()}.xlsx`);
    } catch (e) { console.error('analysis export failed', e); alert('Export failed'); }
  });
});
async function closeInfo() {
  const userCheck = document.querySelector('#theUser-hover');
  // the button yes
  userCheck.classList.remove('on-click');
  // stop scanner when overlay is closed
  ensureScannerState();
}


const ActiveCam = document.querySelector('#camera-active');
const ActiveQR = document.querySelector('#QR-active');

const qrContainer = document.querySelector('.user-info');
const camContainer = document.querySelector('.CAMERA-container');

ActiveCam.addEventListener('click', () => {
  camContainer.classList.add('active');
  qrContainer.classList.remove('active');

  ActiveCam.classList.remove('active');
  ActiveQR.classList.add('active');
  // start scanner if overlay is open and camera container visible
  ensureScannerState();
});

ActiveQR.addEventListener('click', () => {
  camContainer.classList.remove('active');
  qrContainer.classList.add('active');

  ActiveCam.classList.add('active');
  ActiveQR.classList.remove('active');
  // stop scanner when camera view is hidden
  ensureScannerState();
});

//Holy shit
function updateStatus(id, status) {
  window.attendyAPI.updateAttendance(id, status).then(() => loadTable());
}

function loadTable() {

  fetch("http://localhost:5005/get_attendance")
    .then(res => res.json())
    .then(data => {
      const tbody = document.querySelector("#attendance-table tbody");
      tbody.innerHTML = "";

      // Display today's date for attendance summary
      try {
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        document.querySelectorAll('#date-time-attendance-table, #date-of-attendance').forEach(el => { if (el) el.innerText = dateStr; });
      } catch (e) { /* ignore */ }

      // helper: robustly parse timestamps
      function parseTS(ts) {
        if (!ts) return null;
        let d = new Date(ts);
        if (isNaN(d.getTime())) {
          if (typeof ts === 'number') d = new Date(ts * 1000);
          else if (!isNaN(parseInt(ts))) d = new Date(parseInt(ts) * 1000);
        }
        return isNaN(d.getTime()) ? null : d;
      }

      // filter to today's records only so main attendance table auto-empties at midnight
      const today = new Date();
      const ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();
      const todays = Array.isArray(data) ? data.filter(r => {
        const ts = r.time_in || r.timestamp || r.scanned_at || r.created_at || '';
        const d = parseTS(ts);
        if (!d) return false;
        return d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td;
      }) : [];

      // Populate classmates panel for students (show other students active today)
      try {
        const panel = document.getElementById('classmates-panel');
        const content = document.getElementById('classmates-content');
        if (panel && content) {
          const roleLower = (currentUser && (currentUser.role || '')).toString().toLowerCase();
          if (roleLower === 'student') {
            panel.style.display = 'block';
            const normalize = s => (s || '').toString().replace(/^@/, '').toLowerCase().trim();
            const myU = normalize(currentUser.username || '');
            const others = (Array.isArray(todays) ? todays : []).filter(r => normalize(r.student_username || r.username || '') !== myU);
            if (!others.length) {
              content.innerHTML = "<div style='padding:10px; color:#666'>There are no student's active right now</div>";
            } else {
              // build simple list
              const listHtml = others.map(r => {
                const name = r.student_fullname || r.fullname || r.name || '';
                const section = r.student_section || r.section || r.student_username || r.username || '';
                const sts = r.status || '';
                const tin = (r.time_in || r.timestamp) ? new Date(r.time_in || r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return `<div style="display:flex; justify-content:space-between; padding:6px 4px; border-bottom:1px solid #f1f1f1;"><div><strong>${name}</strong><div style='font-size:12px;color:#666'>${section}</div></div><div style='text-align:right'><div style='font-size:13px'>${sts}</div><div style='font-size:11px;color:#999'>${tin}</div></div></div>`;
              }).join('');
              content.innerHTML = listHtml;
            }
          } else {
            panel.style.display = 'none';
          }
        }
      } catch (e) { console.warn('classmates panel update failed', e); }

      // Compute today's summary counts for statuses
      try {
        let presentCount = 0, lateCount = 0, excusedCount = 0, absentCount = 0;
        todays.forEach(r => {
          const s = (r.status || '').toString().toLowerCase();
          if (s.includes('present')) presentCount++;
          else if (s.includes('late')) lateCount++;
          else if (s.includes('excuse') || s.includes('excused')) excusedCount++;
          else if (s.includes('absent')) absentCount++;
        });
        document.querySelectorAll('#present-statT').forEach(el => { el.innerText = presentCount; });
        document.querySelectorAll('#late-statT').forEach(el => { el.innerText = lateCount; });
        document.querySelectorAll('#excuse-statT').forEach(el => { el.innerText = excusedCount; });
        document.querySelectorAll('#absent-statT').forEach(el => { el.innerText = absentCount; });
      } catch (e) { console.warn('Failed to compute attendance summary', e); }

      // helper to find section (preferred) otherwise fall back to username
      function findSection(r) { return r.student_section || r.section || r.student_username || r.username || r.user || r.u || ''; }

      // helper to format timestamp to friendly date+time for main table
      function formatTimestamp(ts) {
        const d = parseTS(ts);
        if (!d) return '';
        const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        return d.toLocaleString(undefined, options);
      }

      // render only today's rows into the main attendance table
      if (!todays.length) {
        tbody.innerHTML = `
    <tr>
      <td colspan="7" style="
        text-align: center;
        padding: 15px;
        color: #000000ff;
        font-style: italic;
      ">
        No attendance recorded for today.
      </td>
    </tr>`;
      } else {
        todays.forEach(row => {
          const fullname = row.student_fullname || row.fullname || row.name || '';
          const username = findSection(row);
          const timeIn = row.time_in || row.timestamp || row.scanned_at || row.created_at || '';
          const timeOut = row.time_out || '';
          const timestamp = formatTimestamp(timeIn);
          const formattedOut = formatTimestamp(timeOut);
          const status = row.status || '';

          tbody.innerHTML += `
          <tr>
            <td><input type="checkbox" class="row-select" data-id="${row.id}"></td>
            <td><button class="trash-btn" data-id="${row.id}" title="Delete row">🗑️</button></td>
            <td>${fullname}</td>
            <td>${username}</td>
            <td>
              <select class="times-select">
                <option class="option-time">Time In: ${timestamp}</option>
                <option class="option-time">Time Out: ${formattedOut || 'Not set'}</option>
              </select>
            </td>
            <td>${status}</td>
            <td>
              <select onchange="updateStatus(${row.id}, this.value)">
                <option ${status === "Present" ? "selected" : ""}>Present</option>
                <option ${status === "Late" ? "selected" : ""}>Late</option>
                <option ${status === "Excused" ? "selected" : ""}>Excused</option>
                <option ${status === "Absent" ? "selected" : ""}>Absent</option>
              </select>
            </td>
          </tr>`;
        });

        // wire buttons and controls for today's rows (re-use existing wiring)
        setTimeout(() => {
          document.querySelectorAll('.trash-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const id = btn.getAttribute('data-id');
              if (!id) return;
              if (!confirm('Delete this attendance row? This cannot be undone.')) return;
              try {
                const res = await window.attendyAPI.deleteAttendanceRow(Number(id));
                if (res && res.ok) await loadTable();
                else alert('Delete failed');
              } catch (err) {
                console.error('Failed to delete row', err);
                alert('Delete failed');
              }
            });
          });

          const dl = document.getElementById('download-xlsx-btn');
          if (dl) dl.disabled = !(Array.isArray(todays) && todays.length > 0);
          const applyBtn = document.getElementById('apply-timeout-btn');
          if (applyBtn) applyBtn.disabled = !(Array.isArray(todays) && todays.length > 0);
          const dlIMG = document.getElementById('download-image-btn');
          if (dlIMG) dlIMG.disabled = !(Array.isArray(todays) && todays.length > 0);

          const selectAll = document.getElementById('select-all-rows');
          if (selectAll) {
            selectAll.checked = false;
            selectAll.addEventListener('change', (ev) => {
              const checked = ev.target.checked;
              document.querySelectorAll('.row-select').forEach(cb => cb.checked = checked);
            });
          }

        }, 50);
      }

    }).catch(e => console.error('Failed to load attendance', e));

}

// Compute monthly statistics for the logged-in student (unique days, latest status wins)
async function updateStudentMonthlyStats(user) {
  try {
    if (!user || !user.username) return;
    const role = (user.role || '').toString().toLowerCase();
    if (role !== 'student') return;

    const res = await fetch('http://localhost:5005/get_attendance');
    const rows = await res.json();
    if (!Array.isArray(rows)) return;

    // normalize username
    const normalize = (s) => (s || '').toString().replace(/^@/, '').toLowerCase().trim();
    const myU = normalize(user.username);

    const now = new Date();
    const cy = now.getFullYear(), cm = now.getMonth();

    // map dateStr -> { ts: Date, status }
    const perDay = {};

    function parseTS(ts) {
      if (!ts) return null;
      let d = new Date(ts);
      if (isNaN(d.getTime())) {
        if (typeof ts === 'number') d = new Date(ts * 1000);
        else if (!isNaN(parseInt(ts))) d = new Date(parseInt(ts) * 1000);
      }
      return isNaN(d.getTime()) ? null : d;
    }

    rows.forEach(r => {
      const uname = normalize(r.student_username || r.username || '');
      if (uname !== myU) return;
      const ts = parseTS(r.time_in || r.timestamp || '');
      if (!ts) return;
      if (ts.getFullYear() !== cy || ts.getMonth() !== cm) return;
      const dayKey = ts.toISOString().slice(0, 10);
      const existing = perDay[dayKey];
      if (!existing || ts.getTime() > existing.ts.getTime()) {
        perDay[dayKey] = { ts, status: (r.status || '').toString() };
      }
    });

    let present = 0, late = 0, excused = 0, absent = 0;
    Object.values(perDay).forEach(v => {
      const s = (v.status || '').toString().toLowerCase();
      if (s.includes('present')) present++;
      else if (s.includes('late')) late++;
      else if (s.includes('excuse')) excused++;
      else if (s.includes('absent')) absent++;
    });

    document.querySelectorAll('#present-stat').forEach(el => el.innerText = present);
    document.querySelectorAll('#late-stat').forEach(el => el.innerText = late);
    document.querySelectorAll('#excuse-stat').forEach(el => el.innerText = excused);
    document.querySelectorAll('#absent-stat').forEach(el => el.innerText = absent);
    // populate student quick card (streak + last-scan)
    try { populateStudentQuick(user, rows); } catch (e) { /* ignore */ }
  } catch (e) {
    console.warn('updateStudentMonthlyStats error', e);
  }
}

// Compute student's attendance streak (consecutive days with records up to today)
function populateStudentQuick(user, rows) {
  if (!user) return;
  const normalize = (s) => (s || '').toString().replace(/^@/, '').toLowerCase().trim();
  const myU = normalize(user.username);
  const allRows = Array.isArray(rows) ? rows : [];
  // Build per-day latest record for this student across all rows
  const perDay = {}; // iso -> { ts: Date, status: string }
  let lastTs = null;
  allRows.forEach(r => {
    const uname = normalize(r.student_username || r.username || '');
    if (uname !== myU) return;
    const tsRaw = r.time_in || r.timestamp || r.scanned_at || r.created_at || '';
    if (!tsRaw) return;
    const d = new Date(tsRaw);
    if (isNaN(d.getTime())) return;
    const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
    const existing = perDay[iso];
    const status = (r.status || '').toString();
    if (!existing || d.getTime() > existing.ts.getTime()) {
      perDay[iso] = { ts: d, status };
    }
    if (!lastTs || d.getTime() > lastTs.getTime()) lastTs = d;
  });

  // Count streak: consecutive days up to today where day's latest status includes 'present'
  let streak = 0;
  const today = new Date();
  function isoOf(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10); }
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (true) {
    const iso = isoOf(cursor);
    const rec = perDay[iso];
    if (rec && (rec.status || '').toString().toLowerCase().includes('present')) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }

  const streakEl = document.getElementById('stu-streak');
  const lastEl = document.getElementById('stu-last-scan');
  if (streakEl) streakEl.innerText = String(streak);
  if (lastEl) lastEl.innerText = lastTs ? lastTs.toLocaleString() : '—';

  // wire Quick Reflect button
  const reflectBtn = document.getElementById('stu-reflect-btn');
  const reflectNote = document.getElementById('stu-reflect-note');
  if (reflectBtn) {
    reflectBtn.onclick = () => {
      const key = `stu_reflect_${myU}`;
      const prev = localStorage.getItem(key) || '';
      const note = prompt('Quick reflect note (private):', prev);
      if (note === null) return; // cancelled
      localStorage.setItem(key, note);
      if (reflectNote) { reflectNote.style.display = note ? 'block' : 'none'; reflectNote.innerText = note || ''; }
    };
  }
  if (reflectNote) {
    const key = `stu_reflect_${myU}`;
    const saved = localStorage.getItem(key) || '';
    if (saved) { reflectNote.style.display = 'block'; reflectNote.innerText = saved; }
    else { reflectNote.style.display = 'none'; reflectNote.innerText = ''; }
  }

  // Render 7-day sparkline (last 7 days including today)
  try {
    const spark = document.getElementById('stu-sparkline');
    if (spark) {
      const colors = { Present: '#2ca02c', Late: '#ff7f0e', Excused: '#1f77b4', Absent: '#d62728', None: '#cfcfcf' };
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const iso = isoOf(d);
        const rec = perDay[iso];
        const status = rec ? (rec.status || '').toString() : '';
        let key = 'None';
        if (status.toLowerCase().includes('present')) key = 'Present';
        else if (status.toLowerCase().includes('late')) key = 'Late';
        else if (status.toLowerCase().includes('excuse')) key = 'Excused';
        else if (status.toLowerCase().includes('absent')) key = 'Absent';
        days.push({ iso, status: status || 'No record', key });
      }
      // draw simple rects
      const w = 160, h = 26, pad = 4; const cellW = Math.floor((w - pad * 2) / 7) - 4; const cellH = 16;
      let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
      days.forEach((d, idx) => {
        const x = pad + idx * (cellW + 4);
        const y = 6;
        const col = colors[d.key] || colors.None;
        svg += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3" fill="${col}" data-iso="${d.iso}" data-status="${d.status}" class="stu-spark-rect"/>`;
      });
      svg += `</svg>`;
      spark.outerHTML = svg; // replace element with constructed svg
      // add tooltip handlers
      setTimeout(() => {
        document.querySelectorAll('.stu-spark-rect').forEach(r => {
          r.addEventListener('mouseenter', (e) => {
            const iso = r.getAttribute('data-iso');
            const status = r.getAttribute('data-status');
            let tt = document.getElementById('stu-spark-tooltip');
            if (!tt) { tt = document.createElement('div'); tt.id = 'stu-spark-tooltip'; tt.style.position = 'fixed'; tt.style.background = 'rgba(0,0,0,0.8)'; tt.style.color = '#fff'; tt.style.padding = '6px 8px'; tt.style.borderRadius = '4px'; tt.style.fontSize = '12px'; tt.style.zIndex = 9999; document.body.appendChild(tt); }
            tt.innerText = `${iso}: ${status}`;
            tt.style.display = 'block';
          });
          r.addEventListener('mousemove', (e) => {
            const tt = document.getElementById('stu-spark-tooltip');
            if (tt) { tt.style.left = (e.clientX + 12) + 'px'; tt.style.top = (e.clientY + 12) + 'px'; }
          });
          r.addEventListener('mouseleave', () => { const tt = document.getElementById('stu-spark-tooltip'); if (tt) tt.style.display = 'none'; });
        });
      }, 10);
    }
  } catch (e) { console.warn('sparkline render failed', e); }
}

loadTable();

// schedule midnight refresh so the main table clears at 00:00 automatically
function scheduleMidnightRefresh() {
  try {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2); // a couple seconds after midnight
    const ms = next.getTime() - now.getTime();
    setTimeout(() => {
      try { loadTable(); } catch (e) { console.warn('midnight reload failed', e); }
      // reschedule
      scheduleMidnightRefresh();
    }, ms);
  } catch (e) { /* ignore */ }
}

scheduleMidnightRefresh();

// Create download and delete controls for attendance table (if not present)
function ensureAttendanceControls() {
  const table = document.getElementById('attendance-table');
  if (!table) return;
  if (document.getElementById('attendance-controls')) return; // already added

  const controls = document.querySelector('#button-downlaod');

  const downloadBtn = document.querySelector('#download-xlsx-btn');
  downloadBtn.addEventListener('click', downloadAttendanceXLSX);
  const downloadBtnIMG = document.querySelector('#download-image-btn');
  downloadBtnIMG.addEventListener('click', downloadAttendanceIMAGE);

  // Wire Apply Time Out button
  const applyBtn = document.getElementById('apply-timeout-btn');
  const timeoutInput = document.getElementById('timeout-time');
  if (applyBtn) {
    applyBtn.addEventListener('click', async (ev) => {
      try {
        // gather selected row ids
        const checked = Array.from(document.querySelectorAll('.row-select')).filter(cb => cb.checked);
        if (!checked.length) return alert('Please select one or more rows first.');
        if (!timeoutInput || !timeoutInput.value) return alert('Please choose a time to set as Time Out.');

        // parse time input (HH:MM or HH:MM:SS)
        const parts = timeoutInput.value.split(':').map(p => parseInt(p, 10));
        const now = new Date();
        const outDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0] || 0, parts[1] || 0, parts[2] || 0);
        const iso = outDate.toISOString();

        const ids = checked.map(cb => Number(cb.getAttribute('data-id'))).filter(Boolean);
        if (!ids.length) return alert('No valid rows selected.');

        // call preload API to set timeouts in bulk
        const res = await window.attendyAPI.setTimeoutForRows(ids, iso);
        if (res && res.ok) {
          await loadTable();
        } else {
          console.error('setTimeoutForRows failed', res);
          alert('Failed to apply Time Out.');
        }
      } catch (e) {
        console.error('apply-timeout error', e);
        alert('Error applying timeout');
      }
    });
  }
}

async function downloadAttendanceIMAGE() {
  const Table = document.querySelector('#attendance-table');
  htmlToImage.toPng(Table, {
    cacheBust: false,
    backgroundColor: "#ffffff"
  })
    .then(dataUrl => {
      const link = document.createElement("a");
      link.download = "form.png";
      link.href = dataUrl;
      link.click();
    })
    .catch(err => {
      console.error("Failed to export PNG:", err);
    });
}

async function downloadAttendanceXLSX() {
  try {
    const res = await fetch('http://localhost:5005/get_attendance');
    const rows = await res.json();
    if (!Array.isArray(rows)) return;

    if (!rows.length) {
      alert('No attendance records to export.');
      return;
    }

    function fmtTime(ts) {
      if (!ts) return '';
      try {
        let d = new Date(ts);
        if (isNaN(d.getTime())) {
          if (typeof ts === 'number') d = new Date(ts * 1000);
          else if (!isNaN(parseInt(ts))) d = new Date(parseInt(ts) * 1000);
        }
        if (isNaN(d.getTime())) return String(ts);
        // use user's locale, short date + time
        return d.toLocaleString();
      } catch (e) {
        return String(ts);
      }
    }

    const data = rows.map(r => ({
      Fullname: r.student_fullname || r.fullname || r.name || '',
      Section: r.student_section || r.section || r.student_username || r.username || '',
      "Time In": fmtTime(r.time_in || r.timestamp || ''),
      "Time Out": fmtTime(r.time_out || ''),
      Status: r.status || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    // writeFile will trigger a download in the browser/electron renderer
    XLSX.writeFile(wb, 'attendance.xlsx');
  } catch (e) {
    console.error('Failed to export XLSX', e);
    alert('Export failed');
  }
}

// disable download when no rows; loadTable will toggle this button

// ensure controls exist after initial load
ensureAttendanceControls();

// Calendar helpers: load attendance for a given date and render present students
async function loadAttendanceForDateString(dateStr) {
  if (!dateStr) return;
  try {
    const res = await fetch('http://localhost:5005/get_attendance');
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const target = new Date(dateStr);
    const ty = target.getFullYear(), tm = target.getMonth(), td = target.getDate();
    // include any attendance record that has a time_in (or timestamp) on the selected date
    const filtered = rows.filter(r => {
      const ts = r.time_in || r.timestamp || r.scanned_at || r.created_at || '';
      if (!ts) return false;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td;
    });
    const tbody = document.querySelector('#calendar-attendance-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:12px; color:#666">No students recorded for this date.</td></tr>';
      return;
    }
    filtered.forEach(r => {
      const name = r.student_fullname || r.fullname || r.name || '';
      const sectionVal = r.student_section || r.section || r.student_username || r.username || '';
      const fmt = (ts) => {
        try {
          const d = new Date(ts);
          if (isNaN(d.getTime())) return String(ts);
          // only show time portion for calendar view
          return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        } catch (e) { return String(ts); }
      };
      const tin = fmt(r.time_in || r.timestamp || '');
      const tout = fmt(r.time_out || '');
      // add a status-aware class to the row for possible styling
      const statusRaw = (r.status || '').toString();
      const statusClass = statusRaw.replace(/[^a-z0-9]+/ig, '-').toLowerCase() || 'unknown';
      tbody.innerHTML += `<tr class="status-${statusClass}"><td>${name}</td><td>${sectionVal}</td><td>${tin}</td><td>${tout}</td><td>${statusRaw}</td></tr>`;
    });
  } catch (e) {
    console.error('Failed to load attendance for date', e);
  }
}

// Export calendar date as XLSX
async function downloadCalendarXLSX(dateStr) {
  if (!dateStr) return;
  try {
    const res = await fetch('http://localhost:5005/get_attendance');
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const pad = (n) => String(n).padStart(2, '0');
    const target = new Date(dateStr);
    const ty = target.getFullYear(), tm = target.getMonth(), td = target.getDate();
    const filtered = rows.filter(r => {
      const ts = r.time_in || r.timestamp || r.scanned_at || r.created_at || '';
      if (!ts) return false;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td;
    });

    if (!filtered.length) { alert('No records for selected date'); return; }

    function fmtTime(ts) {
      if (!ts) return '';
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      } catch (e) { return String(ts); }
    }

    const data = filtered.map(r => ({
      Fullname: r.student_fullname || r.fullname || r.name || '',
      Section: r.student_section || r.section || r.student_username || r.username || '',
      'Time In': fmtTime(r.time_in || r.timestamp || ''),
      'Time Out': fmtTime(r.time_out || ''),
      Status: r.status || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const filename = `attendance-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (e) {
    console.error('Failed to export calendar XLSX', e);
    alert('Export failed');
  }
}

// Wire calendar controls after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Calendar elements
  const prevBtn = document.getElementById('calendar-prev');
  const nextBtn = document.getElementById('calendar-next');
  const monthLabel = document.getElementById('calendar-month-label');
  const grid = document.getElementById('calendar-grid');
  const downloadBtn = document.getElementById('calendar-download-btn');
  const downloadBtnIMG = document.getElementById('download-image-btn');


  let selectedDateISO = null;
  let currentMonth = (new Date()).getMonth();
  let currentYear = (new Date()).getFullYear();

  function pad(n) { return String(n).padStart(2, '0'); }

  // Fetch attendance once to compute which days have data
  async function fetchAttendance() {
    try {
      const res = await fetch('http://localhost:5005/get_attendance');
      return res.ok ? await res.json() : [];
    } catch (e) { return []; }
  }

  async function renderCalendar(month, year) {
    if (!grid || !monthLabel) return;
    monthLabel.innerText = new Date(year, month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
    grid.innerHTML = '';

    const all = await fetchAttendance();
    const hasDate = new Set();
    all.forEach(r => {
      const ts = r.time_in || r.timestamp || r.scanned_at || r.created_at || '';
      const d = ts ? new Date(ts) : null;
      if (d && !isNaN(d.getTime())) {
        hasDate.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      }
    });

    const firstDay = new Date(year, month, 1).getDay();
    const start = new Date(year, month, 1 - firstDay);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const cell = document.createElement('div');
      cell.className = 'day-cell' + (d.getMonth() !== month ? ' inactive' : '');
      if (iso === selectedDateISO) cell.classList.add('selected');
      if (hasDate.has(iso)) cell.classList.add('has-data');
      cell.setAttribute('data-date', iso);
      cell.innerHTML = `<span class="date-num">${d.getDate()}</span><span class="dot">${hasDate.has(iso) ? '•' : ''}</span>`;
      if (d.getMonth() === month) {
        cell.addEventListener('click', () => {
          selectedDateISO = iso;
          document.querySelectorAll('.calendar-grid .day-cell').forEach(n => n.classList.remove('selected'));
          cell.classList.add('selected');
          loadAttendanceForDateString(iso);
          if (downloadBtn) downloadBtn.disabled = false;
          if (downloadBtnIMG) downloadBtnIMG.disabled = false;

        });
      }
      grid.appendChild(cell);
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar(currentMonth, currentYear); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(currentMonth, currentYear); });

  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      if (!selectedDateISO) return alert('Select a date on the calendar first');
      await downloadCalendarXLSX(selectedDateISO);
    });
  }

  // initial render
  renderCalendar(currentMonth, currentYear);

  // Listen for theme/settings changes from other windows and refresh if needed
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('attendy_channel');
      bc.addEventListener('message', (ev) => {
        try {
          const msg = ev.data || {};
          if (msg.type === 'theme-changed' || msg.type === 'settings-closed') {
            if (document && document.location && (document.location.pathname || '').includes('dashboard.html')) {
              location.reload();
            } else {
              if (window.attendyTheme && window.attendyTheme.applyTheme) {
                window.attendyTheme.applyTheme(window.attendyTheme.getTheme && window.attendyTheme.getTheme());
              }
            }
          }
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* ignore */ }

});

// Scanner state variables and helpers
let html5QrCode = null;
let currentCameraId = null;
let isScannerRunning = false;
let lastScanned = null;

async function startScanner() {
  if (isScannerRunning) return;
  if (typeof Html5Qrcode === 'undefined') {
    console.warn('Html5Qrcode library not loaded yet.');
    return;
  }
  try {
    if (!html5QrCode) html5QrCode = new Html5Qrcode('reader');
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length) {
      // prefer previously selected camera id if available
      const availableIds = devices.map(d => d.id);
      if (currentCameraId && availableIds.includes(currentCameraId)) {
        // keep currentCameraId
      } else {
        currentCameraId = devices[0].id;
      }
      await html5QrCode.start(
        currentCameraId,
        { fps: 10, qrbox: 250 },
        async qrCodeMessage => {
          const el = document.getElementById('scan-result');

          // Try to parse JSON payload first
          let parsed = null;
          try {
            parsed = JSON.parse(qrCodeMessage);
          } catch (e) {
            parsed = null;
          }

          // If parsed object exists, require fullname and username
          if (parsed && typeof parsed === 'object') {
            const fullname = parsed.fullname || parsed.name || null;
            const username = parsed.username || parsed.user || null;
            const role = parsed.role || null;

            if (!fullname || !username) {
              if (el) el.innerText = 'Ignored: QR missing fullname or username.';
              return;
            }

            // If scanned user's role is teacher, ignore and notify
            if (role && role.toString().toLowerCase() === 'teacher') {
              if (el) el.innerText = `${fullname} is a teacher — scan ignored.`;
              return;
            }

            const section = parsed.section || parsed.student_section || null;
            const scannedId = username || qrCodeMessage;
            if (lastScanned === scannedId) return; // ignore quick duplicates
            lastScanned = scannedId;
            setTimeout(() => { if (lastScanned === scannedId) lastScanned = null; }, 3000);

            // Prevent duplicate fullname reuse for the same calendar date only.
            // Allow the same fullname if the previous record is from a different day.
            try {
              const res = await fetch('http://localhost:5005/get_attendance');
              const rows = await res.json();
              if (Array.isArray(rows)) {
                const now = new Date();
                const ty = now.getFullYear(), tm = now.getMonth(), td = now.getDate();
                const existsToday = rows.some(r => {
                  const n = (r.student_fullname || r.fullname || r.name || '').toString().trim().toLowerCase();
                  if (!n || n !== fullname.toString().trim().toLowerCase()) return false;
                  const ts = r.time_in || r.timestamp || r.scanned_at || r.created_at || '';
                  if (!ts) return false;
                  let d = new Date(ts);
                  if (isNaN(d.getTime())) {
                    if (typeof ts === 'number') d = new Date(ts * 1000);
                    else if (!isNaN(parseInt(ts))) d = new Date(parseInt(ts) * 1000);
                  }
                  if (isNaN(d.getTime())) return false;
                  return d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td;
                });
                if (existsToday) {
                  if (el) el.innerText = `Ignored: fullname '${fullname}' already exists.`;
                  return;
                }
              }
            } catch (e) {
              console.warn('Failed to validate duplicate fullname', e);
            }

            // Show friendly message instead of raw JSON
            if (el) el.innerText = `${fullname} has been scanned`;

            // include time_in at scan moment
            const time_in = new Date().toISOString();

            try {
              await window.attendyAPI.recordAttendance({ fullname, username, role, section, time_in });
              loadTable();
            } catch (err) {
              console.error('Failed to record attendance:', err);
              if (el) el.innerText = 'Error: failed to record attendance';
            }
            return;
          }

          // Not JSON: detect URLs/links and ignore them
          const isUrl = /^(https?:\/\/)/i.test(qrCodeMessage) || /\.[a-z]{2,}(\/|$)/i.test(qrCodeMessage);
          if (isUrl) {
            if (el) el.innerText = 'Ignored: external link detected.';
            return;
          }

          // Otherwise ignore unsupported payloads
          if (el) el.innerText = 'Ignored: unsupported QR payload.';
        },
        errorMessage => {
          // ignore
        }
      );
      isScannerRunning = true;
    }
  } catch (e) {
    console.error('Failed to start scanner:', e);
  }
}

function stopScanner() {
  if (!isScannerRunning || !html5QrCode) return;
  html5QrCode.stop().then(() => {
    isScannerRunning = false;
  }).catch(err => {
    console.error('Failed to stop scanner:', err);
  });
}

function ensureScannerState() {
  const overlay = document.querySelector('#theUser-hover');
  const overlayOpen = overlay && overlay.classList.contains('on-click');
  const camActive = camContainer && camContainer.classList.contains('active');
  if (overlayOpen && camActive) {
    startScanner();
  } else {
    stopScanner();
  }
}
// Camera UI helpers
function populateCameraList() {
  const select = document.getElementById('camera-select');
  if (!select) return;
  select.innerHTML = '';
  if (typeof Html5Qrcode === 'undefined') return;
  Html5Qrcode.getCameras().then(devices => {
    devices.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev.id;
      opt.text = dev.label || dev.id;
      select.appendChild(opt);
    });
    // pick first by default
    if (devices.length) {
      select.value = devices[0].id;
      currentCameraId = devices[0].id;
    }
  }).catch(err => console.error('Failed to list cameras:', err));
}

// No manual start/stop UI: scanning is automatic based on overlay and camera view

// Wire up camera controls once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Html5Qrcode === 'undefined') {
    // still populate when available; library is loaded before dash.js in index
    console.warn('Html5Qrcode library not available at DOMContentLoaded.');
  }

  populateCameraList();

  const select = document.getElementById('camera-select');
  if (select) {
    select.addEventListener('change', (e) => {
      currentCameraId = e.target.value;
      if (isScannerRunning) {
        // restart with new camera
        stopScanner();
        // small delay to ensure camera release
        setTimeout(() => startScanner(), 350);
      }
    });
  }

  // Ensure scanner state when overlay visibility changes
  const observer = new MutationObserver(() => ensureScannerState());
  const overlay = document.querySelector('#theUser-hover');
  if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });

  // initial camera list populated; scanner will auto-start when overlay/camera become active
});

// Role-based UI helper
function applyRoleUI(role) {
  const r = (role || '').toString().toLowerCase();
  const isTeacher = r === 'teacher';

  // boto-NavRole: show to teachers only
  document.querySelectorAll('.boto-NavRole').forEach(el => {
    el.style.display = isTeacher ? 'block' : 'none';
  });

  // teacher-container: visible only for teachers
  // keep teacher panel hidden by default; shown via navigation when requested
  document.querySelectorAll('.teacher-container').forEach(el => { el.style.display = 'none'; });

  // user-stat: visible for students, hidden for teachers
  document.querySelectorAll('.user-stat-student').forEach(el => {
    el.style.display = isTeacher ? 'none' : 'flex';
    document.querySelector('.user-stat-teacher').style.display = isTeacher ? 'flex' : 'none';
  });

  // attendance-table: visible for teachers only
  const attendance = document.querySelector('.attendance-table-container');
  if (attendance) attendance.style.display = isTeacher ? 'flex' : 'none';

  // hide attendance navigation link for students
  try {
    const attendanceNav = document.getElementById('attendance');
    if (attendanceNav) attendanceNav.style.display = isTeacher ? '' : 'none';
  } catch (e) { /* ignore */ }

  // show student quick-card only for students
  try {
    const studentCard = document.getElementById('student-quick-card');
    if (studentCard) studentCard.style.display = isTeacher ? 'none' : 'block';
  } catch (e) { /* ignore */ }

  // QR/CAMER activation: camera visible IF teacher IF NOT then QR visible
  if (isTeacher) {
    camContainer.classList.add('active');
    qrContainer.classList.remove('active');
    ActiveQR.classList.add('active');
    ActiveCam.classList.remove('active');
  } else {
    camContainer.classList.remove('active');
    qrContainer.classList.add('active');
    ActiveQR.classList.remove('active');
    ActiveCam.classList.add('active');
  }
}

document.getElementById('setting').addEventListener('click', () => {
  window.attendyAPI.opensetting();
});

document.getElementById('support').addEventListener('click', () => {
  window.attendyAPI.opensupport();
});
