// calendarAttendance.js
// Data-layer for calendar attendance. Responsible for fetching and exposing
// attendance records keyed by local date (YYYY-MM-DD) and safe date helpers.
/* Module-style calendarAttendance for import */
const _byDate = new Map(); // dateKey -> Array<record>
let _loaded = false;
const _subs = new Set();

function _parseDateFlexible(str) {
  if (!str) return null;
  const d1 = new Date(str);
  if (!Number.isNaN(d1.getTime())) return d1;
  const m = str.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{2,4})(?:[ ,T]+([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?)?/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const hh = Number(m[4] || 0);
    const mm = Number(m[5] || 0);
    const ss = Number(m[6] || 0);
    const d = new Date(year, month - 1, day, hh, mm, ss);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const iso = str.replace(/\s+/g, 'T');
  const d2 = new Date(iso);
  if (!Number.isNaN(d2.getTime())) return d2;
  return null;
}

function toDateKey(input) {
  const d = input instanceof Date ? input : (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) ? (function (s) { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); })(input) : _parseDateFlexible(input));
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(dateKey) {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function _indexRows(rows) {
  _byDate.clear();
  for (const r of rows) {
    const ts = r.timestamp || r.time_in || r.time || r.datetime || null;
    const d = ts ? _parseDateFlexible(ts) : null;
    const key = d ? toDateKey(d) : null;
    if (!key) continue;
    if (!_byDate.has(key)) _byDate.set(key, []);
    _byDate.get(key).push(r);
  }
  _loaded = true;
}

async function refreshAll() {
  if (typeof window !== 'undefined' && window.attendyAPI && typeof window.attendyAPI.getAttendance === 'function') {
    try {
      const rows = await window.attendyAPI.getAttendance();
      if (Array.isArray(rows)) {
        _indexRows(rows);
        _emitChange();
        return true;
      }
    } catch (e) { console.warn('calendarAttendance.refreshAll attendyAPI failed', e); }
  }
  try {
    const resp = await fetch('/api/attendance');
    if (!resp.ok) return false;
    const rows = await resp.json();
    if (Array.isArray(rows)) {
      _indexRows(rows);
      _emitChange();
      return true;
    }
  } catch (e) { console.warn('calendarAttendance.refreshAll fetch failed', e); }
  return false;
}

async function ensureLoaded() {
  if (_loaded) return true;
  return await refreshAll();
}

function getAttendanceByDate(inputDate) {
  return new Promise(async (resolve) => {
    await ensureLoaded();
    const key = toDateKey(inputDate);
    if (!key) return resolve([]);
    const arr = _byDate.get(key) || [];
    resolve(arr.slice());
  });
}

function getAttendanceByMonth(year, month /* 1-12 */) {
  const results = {};
  const prefix = `${String(year)}-${String(month).padStart(2, '0')}`;
  for (const [k, v] of _byDate.entries()) {
    if (k.startsWith(prefix)) results[k] = v.slice();
  }
  return results;
}

function getTodayAttendance() {
  return getAttendanceByDate(new Date());
}

function setRecordsForDate(dateKey, records) {
  if (!dateKey) return;
  _byDate.set(dateKey, Array.isArray(records) ? records.slice() : []);
  _emitChange();
}

function subscribe(cb) {
  if (typeof cb !== 'function') return () => { };
  _subs.add(cb);
  return () => _subs.delete(cb);
}

function _emitChange() {
  for (const cb of Array.from(_subs)) {
    try { cb(); } catch (e) { console.warn('subscriber error', e); }
  }
}

const calendarAttendance = {
  toDateKey,
  parseDateKey,
  refreshAll,
  ensureLoaded,
  getAttendanceByDate,
  getAttendanceByMonth,
  getTodayAttendance,
  setRecordsForDate,
  subscribe,
  // last selected date key (YYYY-MM-DD) - updated when renderSelectedDateAttendance runs
  _lastSelectedKey: null,
  getLastSelectedDateKey() { return this._lastSelectedKey; }
};

// expose for legacy/global usage
if (typeof window !== 'undefined') window.calendarAttendance = calendarAttendance;

// --- UI helper moved from controller: render per-date attendance and hook calendar events
function _escapeHtml(s) { return (s === null || s === undefined) ? '' : String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function renderSelectedDateAttendance(dateInput) {
  try {
    const tbody = document.getElementById('attendance-specDate-tbody');
    const label = document.getElementById('specific-day-attendance');
    if (!tbody || !label) return;
    const records = await calendarAttendance.getAttendanceByDate(dateInput);
    const key = calendarAttendance.toDateKey(dateInput);
    // remember last selected key so other parts can re-render the same date on data updates
    try { calendarAttendance._lastSelectedKey = key; } catch (e) { /* ignore */ }
    const d = calendarAttendance.parseDateKey ? calendarAttendance.parseDateKey(key) : new Date(key);
    label.textContent = d ? d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : key;
    tbody.innerHTML = '';
    if (!records || records.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'No records for this date';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      for (const r of records) {
        const tr = document.createElement('tr');
        // expose id on row if available so other UI handlers can use it
        if (r && (r.id || r._id || r.row_id)) {
          const rid = r.id || r._id || r.row_id;
          try { tr.setAttribute('data-id', String(rid)); } catch (e) { }
        }
        const fullname = r.student_fullname || r.fullname || r.name || '';
        const section = r.section || r.student_section || '';
        const status = r.status || '';
        const time = r.timestamp || r.time_in || r.time || '';
        tr.innerHTML = `<td></td><td>${_escapeHtml(fullname)}</td><td>${_escapeHtml(section)}</td><td>${_escapeHtml(status)} ${_escapeHtml(time)}</td>`;
        tbody.appendChild(tr);
      }
    }
    // render graph if available
    if (window.calendarGraph && typeof window.calendarGraph.renderForDate === 'function') {
      window.calendarGraph.renderForDate(key, records);
    }
  } catch (e) { console.warn('calendarAttendance.renderSelectedDateAttendance failed', e); }
}

// attach helper to exported/global object
calendarAttendance.renderSelectedDateAttendance = renderSelectedDateAttendance;

// hook calendar selection events
if (typeof window !== 'undefined') {
  window.addEventListener('calendar-date-selected', (ev) => {
    const date = ev && ev.detail && ev.detail.date;
    if (date) renderSelectedDateAttendance(date);
  });
}
