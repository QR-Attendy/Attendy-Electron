import attendanceStore from './attendanceStore.js';
import { renderAttendanceSections } from './todayAttendanceSectionView.js';

let _lastFingerprint = '';
let _eventsAttached = false;
let _subscribed = false;

function _buildRowHtml(r) {
  const fullname = r.student_fullname || r.student_username || '';
  const status = r.status || '';
  const timestamp = r.time_in || r.timestamp || '';
  const formattedOut = r.time_out ? new Date(r.time_out).toLocaleString() : '';
  return `
    <tr data-id="${r.id}">
      <td><input type="checkbox" class="row-select" data-id="${r.id}"></td>
      <td><button class="trash-btn" data-id="${r.id}" title="Delete row">🗑️</button></td>
      <td>${fullname}</td>
      <td>
        <select class="times-select">
          <option class="option-time">Time In: ${timestamp ? new Date(timestamp).toLocaleString() : 'Unknown'}</option>
          <option class="option-time">Time Out: ${formattedOut || 'Not set'}</option>
        </select>
      </td>
      <td>
        <select class="status-select">
          <option value="Present" ${status === 'Present' ? 'selected' : ''}>Present</option>
          <option value="Late" ${status === 'Late' ? 'selected' : ''}>Late</option>
          <option value="Excused" ${status === 'Excused' ? 'selected' : ''}>Excused</option>
          <option value="Absent" ${status === 'Absent' ? 'selected' : ''}>Absent</option>
        </select>
      </td>
    </tr>
  `;
}

function _attachEvents(tbody) {
  if (_eventsAttached) return;
  _eventsAttached = true;

  // delegated click for delete
  tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest && ev.target.closest('.trash-btn');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-id'));
    if (!id) return;
    try {
      await attendanceStore.deleteRow(id);
      // remove row immediately for instant feedback
      try {
        const tr = document.querySelector(`tr[data-id="${id}"]`);
        if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
      } catch (e) { }
      // store will emit change; controller will re-render lists
      try { renderTodayAttendance(); } catch (e) { }
      try { renderAttendanceSections(); } catch (e) { }
    } catch (e) {
      console.warn('delete failed', e);
    }
  });

  // delegated change for status selects
  tbody.addEventListener('change', async (ev) => {
    const sel = ev.target.closest && ev.target.closest('.status-select') || (ev.target.classList && ev.target.classList.contains('status-select') && ev.target);
    if (!sel) return;
    const tr = sel.closest('tr');
    if (!tr) return;
    const id = Number(tr.getAttribute('data-id'));
    const newStatus = sel.value;
    try {
      await attendanceStore.updateStatus(id, newStatus);
      // update status text cell
      const stEl = tr.querySelector('.status-text');
      if (stEl) stEl.textContent = newStatus;
      // update counts
      const counts = attendanceStore.getTodayCounts();
      const elTotal = document.getElementById('student-total');
      const elPresent = document.getElementById('student-present');
      const elAbsent = document.getElementById('student-absent');
      const elLate = document.getElementById('student-late');
      if (elTotal) elTotal.textContent = String(counts.total);
      if (elPresent) elPresent.textContent = String(counts.present);
      if (elAbsent) elAbsent.textContent = String(counts.absent);
      if (elLate) elLate.textContent = String(counts.late);
      // update per-section counts as well
      try { renderAttendanceSections(); } catch (e) { }
    } catch (e) {
      console.warn('status update failed', e);
    }
  });
}

// subscribe to store changes to ensure view stays in sync
try {
  if (!_subscribed && attendanceStore && typeof attendanceStore.subscribe === 'function') {
    attendanceStore.subscribe(() => {
      try { renderTodayAttendance(); } catch (e) { }
      try { renderAttendanceSections(); } catch (e) { }
    });
    _subscribed = true;
  }
} catch (e) { }

export function renderTodayAttendance() {
  const tbody = document.getElementById('attendance-tbody');
  if (!tbody) return;
  const rows = attendanceStore.getTodayRows();

  // compute cheap fingerprint for rows
  const parts = rows.map(r => `${r.id}|${(r.status || '')}|${r.timestamp || r.time_in || ''}|${r.time_out || ''}`);
  const fp = parts.join('\n');
  if (fp === _lastFingerprint) return; // nothing changed
  _lastFingerprint = fp;

  _attachEvents(tbody);

  // build html once and replace
  const html = rows.map(r => _buildRowHtml(r)).join('');
  tbody.innerHTML = html;

  // update counters
  try {
    const counts = attendanceStore.getTodayCounts();
    const elTotal = document.getElementById('student-total');
    const elPresent = document.getElementById('student-present');
    const elAbsent = document.getElementById('student-absent');
    const elLate = document.getElementById('student-late');
    if (elTotal) elTotal.textContent = String(counts.total);
    if (elPresent) elPresent.textContent = String(counts.present);
    if (elAbsent) elAbsent.textContent = String(counts.absent);
    if (elLate) elLate.textContent = String(counts.late);
  } catch (e) {
    console.warn('update counters failed', e);
  }
}
