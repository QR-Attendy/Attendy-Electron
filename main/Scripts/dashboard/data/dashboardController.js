import attendanceStore from './attendanceStore.js';
import { renderTodayAttendance } from './todayAttendanceView.js';
import { renderRecentStudents } from './recentStudentsView.js';
import { renderMostPresent } from './mostPresentView.js';
import { renderAttendanceSections } from './todayAttendanceSectionView.js';

let _controllerInProgress = false;
let _intervalId = null;
let _options = {};

// populate section select boxes from attendance store (sections present in today's rows or recent rows)
async function populateSectionSelects() {
  try {
    const selects = Array.from(document.querySelectorAll('select[name="section-attendance"], select.section-attendance, select.select-box, select[name="section-attendance-add"], select.select-box-add, select[name="section-attendance-edit"], select.select-box-edit'));
    if (!selects || !selects.length) return;
    const rowsToday = (attendanceStore && typeof attendanceStore.getTodayRows === 'function') ? attendanceStore.getTodayRows() : [];
    const recentRows = (attendanceStore && typeof attendanceStore.getRecent === 'function') ? attendanceStore.getRecent(200) : [];
    const all = rowsToday.concat(recentRows);
    const set = new Set();
    for (const r of all) {
      const sec = (r.student_section || r.section || r.section_name || r.section_attendance || '').toString().trim();
      if (sec) set.add(sec);
    }

    // If no sections found in store-derived rows, try fetching full attendance list from preload API
    if (set.size === 0 && typeof window !== 'undefined' && window.attendyAPI) {
      try {
        let rows = [];
        if (typeof window.attendyAPI.getAttendance === 'function') {
          rows = await window.attendyAPI.getAttendance();
        }
        if (Array.isArray(rows) && rows.length) {
          for (const r of rows) {
            const sec = (r.student_section || r.section || r.section_name || r.section_attendance || '').toString().trim();
            if (sec) set.add(sec);
          }
        }
      } catch (e) {
        console.warn('populateSectionSelects: failed to fetch attendance via API', e);
      }
    }

    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    // Build options for general selects (with 'All Sections') and for add-panel selects (with 'New Section')
    const generalHtml = ["<option value=\"all\">All Sections</option>"];
    for (const s of list) {
      const v = String(s).replace(/\"/g, '&quot;');
      generalHtml.push(`<option value="${v}">${s}</option>`);
    }
    const addHtml = ["<option value=\"new\">New Section</option>"];
    for (const s of list) {
      const v = String(s).replace(/\"/g, '&quot;');
      addHtml.push(`<option value="${v}">${s}</option>`);
    }

    for (const sel of selects) {
      // preserve current value if still present
      const cur = sel.value;
      try {
        if (sel.name === 'section-attendance-add' || (sel.classList && sel.classList.contains('select-box-add')) || sel.name === 'section-attendance-edit' || (sel.classList && sel.classList.contains('select-box-edit'))) {
          // add/selects for add/edit panels allow choosing existing or creating new
          sel.innerHTML = addHtml.join('');
        } else {
          sel.innerHTML = generalHtml.join('');
        }
        if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
      } catch (e) { /* ignore DOM errors */ }
    }
  } catch (e) { console.warn('populateSectionSelects failed', e); }
}

async function _refreshAndRender() {
  if (_controllerInProgress) return;
  if (typeof document !== 'undefined' && document.hidden) return; // paused while hidden
  try { console.log('dashboardController: _refreshAndRender start'); } catch (e) { }
  _controllerInProgress = true;
  try {
    const res = await attendanceStore.refreshAttendance();
    try { console.log('dashboardController: refreshAttendance result', res && res.changed); } catch (e) { }
    // only render if data changed according to store fingerprint
    if (!res || res.changed !== true) return;
    try { console.log('dashboardController: data changed -> rendering views'); } catch (e) { }
    try { renderTodayAttendance(); } catch (e) { console.warn('renderTodayAttendance failed', e); }
    try { renderRecentStudents(); } catch (e) { console.warn('renderRecentStudents failed', e); }
    try { renderMostPresent(); } catch (e) { console.warn('renderMostPresent failed', e); }
    try { renderAttendanceSections(); } catch (e) { console.warn('renderAttendanceSections failed', e); }
  } finally {
    _controllerInProgress = false;
  }
}

// public init - set interval and run immediate
export function initDashboardController(options = {}) {
  _options = options || {};
  const minInterval = 15000; // require at least 15s per spec
  const attendanceInterval = Math.max(minInterval, Number(options.attendanceIntervalMs) || minInterval);

  if (_intervalId) return; // already initialized

  try { console.log('dashboardController: initDashboardController called, interval=', attendanceInterval); } catch (e) { }

  // initial immediate refresh if visible
  // render from any cached store data immediately to avoid blank UI while fetching
  try {
    // small defer to allow DOM to finish layout, but render promptly
    window.requestAnimationFrame(() => {
      try { renderTodayAttendance(); } catch (e) { /* ignore */ }
      try { renderRecentStudents(); } catch (e) { /* ignore */ }
      try { renderMostPresent(); } catch (e) { /* ignore */ }
      try { renderAttendanceSections(); } catch (e) { /* ignore */ }
      try { populateSectionSelects(); } catch (e) { /* ignore */ }
      try { if (window.calendarAttendance && typeof window.calendarAttendance.renderSelectedDateAttendance === 'function') window.calendarAttendance.renderSelectedDateAttendance(new Date()); } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }

  if (!(typeof document !== 'undefined' && document.hidden)) _refreshAndRender();

  _intervalId = setInterval(_refreshAndRender, attendanceInterval);

  // subscribe to local store changes (delete/update/add) so UI lists update immediately
  try {
    if (typeof attendanceStore.subscribe === 'function') {
      attendanceStore.subscribe(() => {
        try { console.log('dashboardController: store change subscriber invoked'); } catch (e) { }
        try { populateSectionSelects(); } catch (e) { /* ignore */ }
        if (typeof document !== 'undefined' && document.hidden) return;
        // avoid overlapping render with an in-progress refresh
        if (_controllerInProgress) {
          setTimeout(() => {
            if (!_controllerInProgress) {
              try { renderTodayAttendance(); } catch (e) { console.warn(e); }
              try { renderRecentStudents(); } catch (e) { console.warn(e); }
              try { renderMostPresent(); } catch (e) { console.warn(e); }
              try { populateSectionSelects(); } catch (e) { /* ignore */ }
              // also re-render the calendar's selected-date view if present
              try {
                if (window.calendarAttendance && typeof window.calendarAttendance.renderSelectedDateAttendance === 'function') {
                  const lastKey = (typeof window.calendarAttendance.getLastSelectedDateKey === 'function') ? window.calendarAttendance.getLastSelectedDateKey() : window.calendarAttendance._lastSelectedKey;
                  if (typeof window.calendarAttendance.refreshAll === 'function') {
                    // refresh calendar index from source, then render
                    window.calendarAttendance.refreshAll().then(() => {
                      try { window.calendarAttendance.renderSelectedDateAttendance(lastKey || new Date()); } catch (e) { }
                    }).catch(() => { try { window.calendarAttendance.renderSelectedDateAttendance(lastKey || new Date()); } catch (e) { } });
                  } else {
                    try { window.calendarAttendance.renderSelectedDateAttendance(lastKey || new Date()); } catch (e) { }
                  }
                }
              } catch (e) { /* ignore */ }
            }
          }, 50);
          return;
        }
        try { renderTodayAttendance(); } catch (e) { console.warn(e); }
        try { renderRecentStudents(); } catch (e) { console.warn(e); }
        try { renderMostPresent(); } catch (e) { console.warn(e); }
        // keep the calendar-selected date view in sync too
        try {
          if (window.calendarAttendance && typeof window.calendarAttendance.renderSelectedDateAttendance === 'function') {
            const lastKey = (typeof window.calendarAttendance.getLastSelectedDateKey === 'function') ? window.calendarAttendance.getLastSelectedDateKey() : window.calendarAttendance._lastSelectedKey;
            if (typeof window.calendarAttendance.refreshAll === 'function') {
              window.calendarAttendance.refreshAll().then(() => {
                try { window.calendarAttendance.renderSelectedDateAttendance(lastKey || new Date()); } catch (e) { }
              }).catch(() => { try { window.calendarAttendance.renderSelectedDateAttendance(lastKey || new Date()); } catch (e) { } });
            } else {
              try { window.calendarAttendance.renderSelectedDateAttendance(lastKey || new Date()); } catch (e) { }
            }
          }
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { console.warn('subscribe failed', e); }

  // pause/resume when visibility changes
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
      } else {
        if (!_intervalId) {
          _intervalId = setInterval(_refreshAndRender, attendanceInterval);
          // kick immediate refresh when becoming visible
          _refreshAndRender();
        }
      }
    });
  }

  // renderSelectedDateAttendance now provided by calendarAttendance (global)
}

// auto-init when loaded as module in browser
if (typeof window !== 'undefined') {
  if (!window._dashboardControllerInitialized) {
    window._dashboardControllerInitialized = true;
    // small defer to let DOM be ready
    window.addEventListener('DOMContentLoaded', () => {
      initDashboardController();
    });
  }
}

export { populateSectionSelects };

export default { initDashboardController };
