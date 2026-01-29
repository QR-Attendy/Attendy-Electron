// Attendance table actions: download, delete, apply timeout, select-all
(function () {
  function getSelectedIds() {
    const checked = Array.from(document.querySelectorAll('#attendance-tbody .row-select:checked'));
    return checked.map(cb => Number(cb.getAttribute('data-id'))).filter(Boolean);
  }

  function collectRowsData(ids) {
    const rows = [];
    const trs = ids && ids.length ? Array.from(document.querySelectorAll('#attendance-tbody tr')).filter(tr => ids.includes(Number(tr.getAttribute('data-id')))) : Array.from(document.querySelectorAll('#attendance-tbody tr'));
    for (const tr of trs) {
      const id = Number(tr.getAttribute('data-id')) || '';

      // Determine fullname cell robustly (different view builders use slightly different td structures)
      let fullname = '';
      try {
        const tds = Array.from(tr.querySelectorAll('td'));
        for (const td of tds) {
          // skip checkbox cell
          if (td.querySelector('.row-select')) continue;
          // skip meta/avatar cell
          if (td.classList && td.classList.contains('meta-cell')) continue;
          // skip times cell (may contain .times-select or label like "IN:" or "OUT:")
          if (td.querySelector('.times-select')) continue;
          const txt = (td.textContent || '').trim();
          if (/\bIN[: ]|OUT[: ]|Time In[: ]|Time Out[: ]/i.test(txt)) continue;
          // skip status select cell
          if (td.querySelector('.status-select')) continue;
          if (txt) { fullname = txt; break; }
        }
        // fallback to known index positions
        if (!fullname) {
          if (tr.children[2] && tr.children[2].textContent) fullname = tr.children[2].textContent.trim();
          else if (tr.children[1] && tr.children[1].textContent) fullname = tr.children[1].textContent.trim();
        }
      } catch (e) { fullname = (tr.children[2] && tr.children[2].textContent || '').trim(); }

      // times: try .times-select first, otherwise parse IN/OUT lines
      let timeIn = '';
      let timeOut = '';
      try {
        const sel = tr.querySelector('.times-select');
        if (sel) {
          const opt0 = sel.options[0] && sel.options[0].textContent || '';
          const opt1 = sel.options[1] && sel.options[1].textContent || '';
          timeIn = opt0.replace(/^\s*Time In:\s*/i, '').trim();
          timeOut = opt1.replace(/^\s*Time Out:\s*/i, '').trim();
        } else {
          // parse text content for lines like "IN: 9:15:51AM" and "OUT: 9:30:00AM"
          const txt = (tr.textContent || '').replace(/\s+/g, ' ');
          const mIn = txt.match(/IN[: ]\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);
          const mOut = txt.match(/OUT[: ]\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);
          if (mIn) timeIn = mIn[1].replace(/\s+/g, '');
          if (mOut) timeOut = mOut[1].replace(/\s+/g, '');
        }
      } catch (e) { /* ignore */ }

      const statusEl = tr.querySelector('.status-select');
      const status = statusEl ? statusEl.value : (tr.querySelector('.status-text') && tr.querySelector('.status-text').textContent || (tr.children[tr.children.length - 1] && tr.children[tr.children.length - 1].textContent) || '').trim();

      // username: prefer data-username attribute, then .username-cell text, otherwise blank
      let username = '';
      try {
        if (tr.dataset && tr.dataset.username) username = String(tr.dataset.username).trim();
        else if (tr.querySelector('.username-cell')) username = String(tr.querySelector('.username-cell').textContent || '').trim();
        else username = '';
      } catch (e) { username = ''; }

      // section: prefer data-section attribute, then .section-cell text, otherwise empty
      let section = '';
      try {
        if (tr.dataset && tr.dataset.section) section = String(tr.dataset.section).trim();
        else if (tr.querySelector('.section-cell')) section = String(tr.querySelector('.section-cell').textContent || '').trim();
        else section = '';
      } catch (e) { section = '' }

      rows.push({ id, fullname, username, section, timeIn, timeOut, status });
    }
    return rows;
  }

  async function downloadAsXlsx(data, filename = 'attendance.xlsx') {
    if (typeof XLSX === 'undefined') {
      console.error('XLSX library not found');
      return;
    }
    // remove internal-only fields (like id) before exporting; include username and section
    const exportKeys = ['fullname', 'username', 'section', 'timeIn', 'timeOut', 'status'];
    const newData = (Array.isArray(data) ? data : []).map(row => {
      const out = {};
      for (const k of exportKeys) {
        if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
        else out[k] = '';
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(newData, { header: exportKeys });
    // replace header labels with nicer display names
    const headerRow = ['Full Name', 'Username', 'Section', 'Time In', 'Time Out', 'Status'];
    XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A1' });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    function s2ab(s) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    }
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // collector for arbitrary tbody (calendar date view export)
  function collectRowsDataFor(tbodySelector, ids) {
    const rows = [];
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return rows;
    const trs = ids && ids.length ? Array.from(tbody.querySelectorAll('tr')).filter(tr => ids.includes(Number(tr.getAttribute('data-id')))) : Array.from(tbody.querySelectorAll('tr'));
    for (const tr of trs) {
      const id = Number(tr.getAttribute('data-id')) || '';
      let fullname = '';
      try {
        const tds = Array.from(tr.querySelectorAll('td'));
        for (const td of tds) {
          const txt = (td.textContent || '').trim();
          if (txt && !/IN[: ]|OUT[: ]|Time In[: ]|Time Out[: ]/i.test(txt)) { fullname = txt; break; }
        }
        if (!fullname) fullname = (tr.children[0] && tr.children[0].textContent) ? tr.children[0].textContent.trim() : '';
      } catch (e) { fullname = (tr.children[0] && tr.children[0].textContent) ? tr.children[0].textContent.trim() : ''; }

      let timeIn = '';
      let timeOut = '';
      try {
        const timeCell = tr.querySelector('.time-cell') || tr.children[tr.children.length - 1];
        const timeText = timeCell ? (timeCell.textContent || '').trim() : '';
        const mIn = timeText.match(/IN[:\s]*([0-9:\sAPMapm]+)/i);
        const mOut = timeText.match(/OUT[:\s]*([0-9:\sAPMapm]+)/i);
        if (mIn) timeIn = mIn[1].trim();
        if (mOut) timeOut = mOut[1].trim();
        if (!timeIn && !timeOut && timeText) {
          const parts = timeText.split(/\s*[\/\-,]\s*/).map(s => s.trim()).filter(Boolean);
          if (parts.length === 2) { timeIn = parts[0]; timeOut = parts[1]; }
          else if (parts.length === 1) { timeIn = parts[0]; }
        }
      } catch (e) { timeIn = ''; timeOut = ''; }

      const statusEl = tr.querySelector('.status-select');
      const status = statusEl ? statusEl.value : (tr.querySelector('.status-text') && tr.querySelector('.status-text').textContent || '').trim();

      // username: prefer data-username or .username-cell
      let username = '';
      try {
        if (tr.dataset && tr.dataset.username) username = String(tr.dataset.username).trim();
        else if (tr.querySelector('.username-cell')) username = String(tr.querySelector('.username-cell').textContent || '').trim();
        else username = '';
      } catch (e) { username = ''; }

      let section = '';
      try { section = tr.dataset && tr.dataset.section ? String(tr.dataset.section).trim() : (tr.querySelector('.section-cell') ? (tr.querySelector('.section-cell').textContent || '').trim() : ''); } catch (e) { section = ''; }
      rows.push({ id, fullname, username, section, timeIn, timeOut, status });
    }
    return rows;
  }

  document.addEventListener('DOMContentLoaded', () => {
    // populate the attendance table date with today's date (MM-DD-YYYY)
    try {
      const el = document.getElementById('date-time-attendance-table');
      if (el) {
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yy = String(d.getFullYear());
        el.textContent = `${mm}-${dd}-${yy}`;
      }
    } catch (e) { /* ignore if element missing */ }
    const downloadBtn = document.getElementById('download-sheet');
    const downloadSpecBtn = document.getElementById('download-sheet-specDate');
    const deleteBtn = document.getElementById('delete');
    const applyTimeoutBtn = document.getElementById('apply-timeout-btn');
    const selectAll = document.getElementById('select-all-rows');

    // deletion notice panel controls (replaces confirm() dialogs)
    const deletionPanel = document.querySelector('.deletion-notice-panel');
    const deletionCancelBtn = document.getElementById('deletion-cancel-btn');
    const deletionConfirmBtn = document.getElementById('deletion-confirm-btn');
    let pendingDelete = null; // { ids: [], handler: async(ids)=>{} }

    // universal notice panel (replaces alert())
    const noticePanel = document.querySelector('.notice-panel');
    const noticeHeader = document.getElementById('headerNotice');
    const noticeMessage = document.getElementById('PmessageNotice');
    const noticeOkBtn = document.getElementById('ok-btn');

    function showNotice(header, message) {
      try {
        if (!noticePanel) {
          // fallback to alert if notice panel not present
          if (message) alert((header ? header + ': ' : '') + message);
          else alert(header || 'Notice');
          return;
        }
        noticeHeader.textContent = header || '';
        noticeMessage.textContent = message || '';
        noticePanel.style.display = 'flex';
        // ensure ok button clears the panel
        const hide = () => { noticePanel.style.display = 'none'; };
        if (noticeOkBtn) {
          // remove previous handler by cloning
          const newBtn = noticeOkBtn.cloneNode(true);
          noticeOkBtn.parentNode.replaceChild(newBtn, noticeOkBtn);
          newBtn.addEventListener('click', hide);
        }
      } catch (e) {
        // Uncomment if made changes to styling or strucutre of your Html/CSS Files.
        // try { alert((header ? header + ': ' : '') + (message || '')); } catch (ee) { /* ignore */ }
      }
    }

    function showDeletionNotice(ids, handler) {
      if (!deletionPanel) return;
      pendingDelete = { ids: Array.isArray(ids) ? ids.slice() : (ids ? [ids] : []), handler };
      deletionPanel.style.display = 'flex';
      deletionPanel.dataset.ids = (pendingDelete.ids || []).join(',');
    }

    function hideDeletionNotice() {
      if (!deletionPanel) return;
      deletionPanel.style.display = 'none';
      deletionPanel.dataset.ids = '';
      pendingDelete = null;
    }

    if (deletionCancelBtn) deletionCancelBtn.addEventListener('click', hideDeletionNotice);
    if (deletionConfirmBtn) {
      deletionConfirmBtn.addEventListener('click', async () => {
        if (!pendingDelete || !pendingDelete.handler) { hideDeletionNotice(); return; }
        const ids = pendingDelete.ids || [];
        try {
          await pendingDelete.handler(ids);
        } catch (e) {
          console.error('delete handler failed', e);
          showNotice('Delete failed', 'An error occurred while deleting entries');
        } finally {
          hideDeletionNotice();
        }
      });
    }

    // clicking outside card closes the panel
    if (deletionPanel) {
      deletionPanel.addEventListener('click', (ev) => {
        if (ev.target === deletionPanel) hideDeletionNotice();
      });
    }
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') hideDeletionNotice();
    });

    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        const checked = !!selectAll.checked;
        const boxes = document.querySelectorAll('#attendance-tbody .row-select');
        boxes.forEach(b => { b.checked = checked; });
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        const data = collectRowsData(ids);
        // prefer user-specified filename from input if provided
        const fnameInput = document.getElementById('file-name-input');
        let base = '';
        if (fnameInput && fnameInput.value && String(fnameInput.value).trim()) {
          base = String(fnameInput.value).trim();
        } else {
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          base = ids.length ? `attendance-selected-${ts}` : `attendance-all-${ts}`;
        }
        const filename = base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
        await downloadAsXlsx(data, filename);
      });
    }

    // calendar download (Attendance for selected date)
    if (downloadSpecBtn) {
      downloadSpecBtn.addEventListener('click', async () => {
        // collect only visible rows from the calendar-specific tbody (respecting search/section filters)
        const visibleTrs = Array.from(document.querySelectorAll('#attendance-specDate-tbody tr')).filter(tr => (tr.style.display || '') !== 'none');
        const ids = visibleTrs.map(tr => Number(tr.getAttribute('data-id'))).filter(Boolean);
        const data = collectRowsDataFor('#attendance-specDate-tbody', ids);
        // determine filename: prefer user-specified input, otherwise calendar date or today
        const fnameInput = document.getElementById('file-name-input');
        let filename = '';
        if (fnameInput && fnameInput.value && String(fnameInput.value).trim()) {
          filename = String(fnameInput.value).trim();
        } else {
          // prefer calendarAttendance last selected key (YYYY-MM-DD)
          let base = '';
          try {
            const getKey = (window.calendarAttendance && typeof window.calendarAttendance.getLastSelectedDateKey === 'function') ? window.calendarAttendance.getLastSelectedDateKey : null;
            const key = getKey ? getKey() : null;
            if (key && typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
              const parts = key.split('-'); // [YYYY,MM,DD]
              base = `attendance as of (${parts[1]}-${parts[2]}-${parts[0]})`;
            }
          } catch (e) { /* ignore */ }
          if (!base) {
            const labelEl = document.getElementById('specific-day-attendance');
            if (labelEl && labelEl.textContent) {
              const dd = new Date(labelEl.textContent);
              if (!isNaN(dd.getTime())) {
                const mm = String(dd.getMonth() + 1).padStart(2, '0');
                const dday = String(dd.getDate()).padStart(2, '0');
                const yy = String(dd.getFullYear());
                base = `attendance as of (${mm}-${dday}-${yy})`;
              }
            }
          }
          if (!base) base = `attendance as of (${new Date().toISOString().slice(0, 10)})`;
          filename = base;
        }
        filename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
        await downloadAsXlsx(data, filename);
      });
    }

    // Import from Excel button
    const importBtn = document.getElementById('import-attendance-btn');
    if (importBtn) {
      importBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        // create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.csv';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) { document.body.removeChild(input); return; }
          try {
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const data = e.target.result;
                const wb = XLSX.read(data, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

                // normalize header keys map (lowercase no-spaces)
                function normalizeKey(k) { return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

                // determine existing entries to avoid duplicates
                let existing = [];
                try {
                  const mod = await import('./attendanceStore.js');
                  const store = mod.default;
                  if (store && typeof store.getTodayRows === 'function') existing = store.getTodayRows();
                } catch (e) { /* fallback to DOM */ }

                const existingKeys = new Set();
                // store may contain richer records; add both username-based and name+section-based keys
                for (const r of (existing || [])) {
                  const uname = String(r.student_username || r.username || '').trim().toLowerCase();
                  const name = String(r.student_fullname || r.student_name || r.fullname || r.name || '').trim().toLowerCase();
                  const sec = String(r.student_section || r.section || '').trim().toLowerCase();
                  if (uname) existingKeys.add('u:' + uname);
                  if (name) existingKeys.add('n:' + name + '|' + sec);
                }

                // if store didn't yield keys, collect from DOM rows and add same key forms
                if (!existingKeys.size) {
                  const trs = Array.from(document.querySelectorAll('#attendance-tbody tr[data-id]'));
                  for (const tr of trs) {
                    const uname = String((tr.dataset && tr.dataset.username) || '').trim().toLowerCase();
                    const fname = String((tr.children[2] && tr.children[2].textContent) || '').trim().toLowerCase();
                    const sec = String((tr.dataset && tr.dataset.section) || (tr.querySelector('.section-cell') && tr.querySelector('.section-cell').textContent) || '').trim().toLowerCase();
                    if (uname) existingKeys.add('u:' + uname);
                    if (fname) existingKeys.add('n:' + fname + '|' + sec);
                  }
                }

                let imported = 0, skipped = 0;
                for (const row of rows) {
                  // map possible header names
                  const mapped = {};
                  for (const k of Object.keys(row)) {
                    const nk = normalizeKey(k);
                    const v = row[k];
                    if (['fullname', 'name', 'studentfullname', 'student_fullname'].includes(nk)) mapped.student_fullname = String(v).trim();
                    else if (['username', 'user', 'studentusername', 'student_username'].includes(nk)) mapped.student_username = String(v).trim();
                    else if (['section', 'studentsection', 'student_section'].includes(nk)) mapped.section = String(v).trim();
                    else if (['status'].includes(nk)) mapped.status = String(v).trim() || 'Present';
                    else if (['timein', 'timeinout', 'timein_time', 'time_in'].includes(nk)) mapped.time_in = String(v).trim();
                    else if (['timeout', 'time_out', 'time_out_time', 'timeo', 'time_outt'].includes(nk)) mapped.time_out = String(v).trim();
                    else {
                      // try to catch columns with spaces like 'time in'
                      if (nk.includes('timein')) mapped.time_in = String(v).trim();
                      if (nk.includes('timeout')) mapped.time_out = String(v).trim();
                    }
                  }

                  // build dedupe checks: prefer username match, otherwise fullname+section
                  const unameCheck = String(mapped.student_username || mapped.username || '').trim().toLowerCase();
                  const nameCheck = String(mapped.student_fullname || mapped.fullname || mapped.name || '').trim().toLowerCase();
                  const secCheck = String(mapped.section || '').trim().toLowerCase();
                  const userKey = unameCheck ? ('u:' + unameCheck) : null;
                  const nameKey = nameCheck ? ('n:' + nameCheck + '|' + secCheck) : null;
                  let isDup = false;
                  if (userKey && existingKeys.has(userKey)) isDup = true;
                  else if (nameKey && existingKeys.has(nameKey)) isDup = true;
                  if (isDup) { skipped++; continue; }

                  // build payload for server
                  const payload = {
                    fullname: mapped.student_fullname || mapped.student_fullname || '',
                    username: mapped.student_username || '',
                    section: mapped.section || '',
                    role: 'student',
                    status: mapped.status || 'Present'
                  };
                  // normalize times to ISO
                  try {
                    if (mapped.time_in) {
                      const hhmm = parseTimeToHHMM(mapped.time_in);
                      if (hhmm) {
                        const [hh, mm] = hhmm.split(':').map(Number);
                        const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
                        payload.time_in = d.toISOString();
                      } else {
                        const d2 = new Date(mapped.time_in);
                        if (!isNaN(d2.getTime())) payload.time_in = d2.toISOString();
                      }
                    }
                    if (mapped.time_out) {
                      const hhmm2 = parseTimeToHHMM(mapped.time_out);
                      if (hhmm2) {
                        const [hh2, mm2] = hhmm2.split(':').map(Number);
                        const d3 = new Date(); d3.setHours(hh2 || 0, mm2 || 0, 0, 0);
                        payload.time_out = d3.toISOString();
                      } else {
                        const d3b = new Date(mapped.time_out);
                        if (!isNaN(d3b.getTime())) payload.time_out = d3b.toISOString();
                      }
                    }
                  } catch (e) { /* ignore time parse errors */ }

                  // Ensure Time In is set to current time (today) regardless of imported value
                  try {
                    payload.time_in = new Date().toISOString();
                  } catch (e) { /* ignore */ }

                  // persist via preload API (recordAttendance)
                  try {
                    if (window.attendyAPI && typeof window.attendyAPI.recordAttendance === 'function') {
                      await window.attendyAPI.recordAttendance(payload);
                      imported++;
                      if (userKey) existingKeys.add(userKey);
                      if (nameKey) existingKeys.add(nameKey);
                    } else {
                      // fallback: append to DOM directly
                      try {
                        const viewMod = await import('./todayAttendanceView.js');
                        const rowObj = { id: Date.now() % 1000000, student_fullname: payload.fullname, student_username: payload.username, section: payload.section, status: payload.status, time_in: payload.time_in || new Date().toISOString() };
                        if (viewMod && typeof viewMod.buildRowHtml === 'function') {
                          const tbody = document.getElementById('attendance-tbody');
                          tbody.insertAdjacentHTML('beforeend', viewMod.buildRowHtml(rowObj));
                        }
                        imported++;
                        if (userKey) existingKeys.add(userKey);
                        if (nameKey) existingKeys.add(nameKey);
                      } catch (e) { skipped++; }
                    }
                  } catch (e) { skipped++; }
                }

                // refresh canonical store and views so tables update automatically
                try {
                  const mod2 = await import('./attendanceStore.js');
                  const store2 = mod2.default;
                  if (store2 && typeof store2.refreshAttendance === 'function') await store2.refreshAttendance();
                } catch (e) { /* ignore */ }
                try { const t = await import('./todayAttendanceView.js'); if (t && typeof t.renderTodayAttendance === 'function') t.renderTodayAttendance(); } catch (e) { }
                try { const r = await import('./recentStudentsView.js'); if (r && typeof r.renderRecentStudents === 'function') r.renderRecentStudents(); } catch (e) { }
                try { const m = await import('./mostPresentView.js'); if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent(); } catch (e) { }
                try { const s = await import('./todayAttendanceSectionView.js'); if (s && typeof s.renderAttendanceSections === 'function') s.renderAttendanceSections(); } catch (e) { }

                // update section selects (populate from store) if available
                try { const dc = await import('./dashboardController.js'); if (dc && typeof dc.populateSectionSelects === 'function') dc.populateSectionSelects(); } catch (e) { }

                // refresh calendar view if present
                try {
                  if (window.calendarAttendance) {
                    if (typeof window.calendarAttendance.refreshAll === 'function') await window.calendarAttendance.refreshAll();
                    try {
                      const lastKey = (typeof window.calendarAttendance.getLastSelectedDateKey === 'function') ? window.calendarAttendance.getLastSelectedDateKey() : window.calendarAttendance._lastSelectedKey;
                      if (typeof window.calendarAttendance.renderSelectedDateAttendance === 'function') window.calendarAttendance.renderSelectedDateAttendance(lastKey || new Date());
                    } catch (e) { /* ignore */ }
                  }
                } catch (e) { /* ignore */ }

                // ensure download buttons reflect new rows
                try { if (typeof updateDownloadState === 'function') updateDownloadState(); } catch (e) { }
                try { if (typeof updateDownloadSpecState === 'function') updateDownloadSpecState(); } catch (e) { }

                showNotice('Import complete', `Imported ${imported} rows. Skipped ${skipped} duplicates/errors.`);
                try { const pnl = document.querySelector('.importORexport-panel'); if (pnl) { pnl.style.display = 'none'; pnl.classList.remove('active'); } } catch (e) { /* ignore */ }
              } catch (e) {
                console.error('import parse failed', e);
                showNotice('Import failed', 'Failed to parse the selected file');
              }
              document.body.removeChild(input);
            };
            reader.readAsArrayBuffer(file);
          } catch (e) {
            console.error('file read failed', e);
            showNotice('Import failed', 'Failed to read selected file');
            document.body.removeChild(input);
          }
        });
        input.click();
      });
    }

    // Wire the Import/Export panel open/close (the panel already exists in dash.html)
    const importExportToggle = document.getElementById('importORexport');
    const importPanel = document.querySelector('.importORexport-panel');
    const importCancelClose = () => { if (importPanel) { importPanel.style.display = 'none'; importPanel.classList.remove('active'); } };
    if (importExportToggle && importPanel) {
      importExportToggle.addEventListener('click', (ev) => {
        ev.preventDefault();
        // prefill filename input with calendar date if available
        try {
          const fnameInput = document.getElementById('file-name-input');
          if (fnameInput) {
            let base = '';
            const getKey = (window.calendarAttendance && typeof window.calendarAttendance.getLastSelectedDateKey === 'function') ? window.calendarAttendance.getLastSelectedDateKey : null;
            const key = getKey ? getKey() : null;
            if (key && typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
              const parts = key.split('-'); // [YYYY,MM,DD]
              base = `attendance as of (${parts[1]}-${parts[2]}-${parts[0]})`;
            } else {
              const d = new Date();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const yy = String(d.getFullYear());
              base = `attendance as of (${mm}-${dd}-${yy})`;
            }
            fnameInput.value = base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
          }
        } catch (e) { /* ignore */ }
        importPanel.style.display = 'flex';
        importPanel.classList.add('active');
      });
      // clicking overlay closes panel
      importPanel.addEventListener('click', (ev) => { if (ev.target === importPanel) importCancelClose(); });
      // ensure there is an automatic close when pressing Escape
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') importCancelClose(); });
    }

    // disable download button when table is empty
    function updateDownloadState() {
      const tbody = document.getElementById('attendance-tbody');
      if (!downloadBtn) return;
      const hasRows = tbody && tbody.querySelectorAll('tr').length > 0;
      downloadBtn.disabled = !hasRows;
    }

    // watch for DOM changes in the attendance tbody so the button state stays accurate
    const tbodyEl = document.getElementById('attendance-tbody');
    if (tbodyEl) {
      const mo = new MutationObserver(() => updateDownloadState());
      mo.observe(tbodyEl, { childList: true, subtree: false });
    }
    // initial state
    updateDownloadState();

    // --- Calendar download state & search for #attendance-specDate-tbody ---
    function updateDownloadSpecState() {
      const tbody = document.getElementById('attendance-specDate-tbody');
      if (!downloadSpecBtn) return;
      // consider only visible rows (search/section filters may hide rows via inline style)
      let hasVisible = false;
      if (tbody) {
        const trs = Array.from(tbody.querySelectorAll('tr'));
        hasVisible = trs.some(tr => (tr.style.display || '') !== 'none');
      }
      downloadSpecBtn.disabled = !hasVisible;
    }
    const tbodySpecEl = document.getElementById('attendance-specDate-tbody');
    if (tbodySpecEl) {
      const moSpec = new MutationObserver(() => updateDownloadSpecState());
      moSpec.observe(tbodySpecEl, { childList: true, subtree: false });
    }
    updateDownloadSpecState();

    (function setupSpecDateSearch() {
      const searchInput = document.querySelector('.list-student-calendar-container .search-input');
      const searchForm = searchInput && searchInput.closest('form');
      const specTbody = document.getElementById('attendance-specDate-tbody');
      const sectionSelect = document.querySelector('select.select-box-specDate') || document.querySelector('select[name="section-attendance-specDate"]');
      if (!searchInput || !specTbody) return;

      function normalize(s) { return String(s || '').toLowerCase().trim(); }

      function filterSpecRows(q) {
        const term = normalize(q);
        const tokens = term ? term.split(/\s+/).filter(Boolean) : [];
        const selectedSection = (sectionSelect && String(sectionSelect.value || 'all').toLowerCase()) || 'all';
        specTbody.querySelectorAll('tr').forEach(tr => {
          const fullname = normalize((tr.children[0] && tr.children[0].textContent) || '');
          let section = '';
          const secCell = tr.querySelector('.section-cell');
          if (secCell) section = normalize(secCell.textContent);
          else if (tr.dataset && tr.dataset.section) section = normalize(tr.dataset.section);
          else section = normalize(tr.textContent);

          // token match
          const tokenOk = tokens.length ? tokens.every(tok => fullname.includes(tok) || section.includes(tok)) : true;
          // section match (if specific section selected)
          const sectionOk = (!selectedSection || selectedSection === 'all') ? true : (section === selectedSection);
          const ok = tokenOk && sectionOk;
          tr.style.display = ok ? '' : 'none';
        });
      }

      searchInput.addEventListener('input', (e) => { filterSpecRows(e.target.value); updateDownloadSpecState(); });
      if (searchForm) searchForm.addEventListener('submit', (ev) => { ev.preventDefault(); filterSpecRows(searchInput.value); });

      // populate section select based on sections present in this tbody
      function updateSectionOptions() {
        if (!sectionSelect) return;
        const trs = Array.from(specTbody.querySelectorAll('tr'));
        const set = new Set();
        for (const tr of trs) {
          let section = '';
          const secCell = tr.querySelector('.section-cell');
          if (secCell) section = (secCell.textContent || '').trim();
          else if (tr.dataset && tr.dataset.section) section = String(tr.dataset.section).trim();
          else if (tr.children && tr.children[1] && tr.children[1].textContent) section = String(tr.children[1].textContent).trim();
          if (section) set.add(section);
        }
        const prev = String(sectionSelect.value || 'all');
        // rebuild options
        sectionSelect.innerHTML = '';
        const allOpt = document.createElement('option'); allOpt.value = 'all'; allOpt.textContent = 'All Sections';
        sectionSelect.appendChild(allOpt);
        Array.from(set).sort().forEach(sec => {
          const opt = document.createElement('option'); opt.value = sec; opt.textContent = sec; sectionSelect.appendChild(opt);
        });
        // restore previous if still present
        try { sectionSelect.value = prev; } catch (e) { sectionSelect.value = 'all'; }
      }

      if (sectionSelect) {
        sectionSelect.addEventListener('change', (ev) => { filterSpecRows(searchInput.value); updateDownloadSpecState(); });
      }

      const moS = new MutationObserver(() => { updateSectionOptions(); if (searchInput.value) filterSpecRows(searchInput.value); updateDownloadSpecState(); });
      moS.observe(specTbody, { childList: true, subtree: false });
      // initial population
      try { updateSectionOptions(); } catch (e) { /* ignore */ }
    })();

    // --- ATTENDANCE SEARCH (for #attendance-tbody) ---
    (function setupAttendanceSearch() {
      const searchInput = document.querySelector('.attendance-table-container .search-input');
      const searchForm = searchInput && searchInput.closest('form');
      // reuse tbodyEl if already declared above
      const attendanceTbody = (typeof tbodyEl !== 'undefined' && tbodyEl) ? tbodyEl : document.getElementById('attendance-tbody');
      if (!searchInput || !attendanceTbody) return;

      function normalize(s) { return String(s || '').toLowerCase().trim(); }

      function filterAttendanceRows(q) {
        const term = normalize(q);
        if (!term) {
          attendanceTbody.querySelectorAll('tr').forEach(tr => tr.style.display = '');
          return;
        }
        const tokens = term.split(/\s+/).filter(Boolean);
        attendanceTbody.querySelectorAll('tr').forEach(tr => {
          const fullname = normalize((tr.children[2] && tr.children[2].textContent) || '');
          // try explicit section cell (.section-cell) or data-section attribute or fallback to whole row text
          let section = '';
          const secCell = tr.querySelector('.section-cell');
          if (secCell) section = normalize(secCell.textContent);
          else if (tr.dataset && tr.dataset.section) section = normalize(tr.dataset.section);
          else section = normalize(tr.textContent);

          // match if every token is found in fullname OR section (substring)
          const ok = tokens.every(tok => fullname.includes(tok) || section.includes(tok));
          tr.style.display = ok ? '' : 'none';
        });
      }

      // live filter on input
      searchInput.addEventListener('input', (e) => filterAttendanceRows(e.target.value));

      // prevent form submit default (search via input)
      if (searchForm) searchForm.addEventListener('submit', (ev) => { ev.preventDefault(); filterAttendanceRows(searchInput.value); });

      // reapply filter when rows change
      if (attendanceTbody) {
        const moSearch = new MutationObserver(() => {
          if (searchInput.value) filterAttendanceRows(searchInput.value);
        });
        moSearch.observe(attendanceTbody, { childList: true, subtree: false });
      }
    })();

    // Edit panel wiring (replaces standalone time-setter UI)
    const editPanel = document.querySelector('.edit-student-panel');
    const editForm = document.getElementById('edit-student-form');
    const editFullname = document.getElementById('edit-student-fullname');
    const editUsername = document.getElementById('edit-student-username');
    const editTimeIn = document.getElementById('edit-student-time-in');
    const editTimeOut = document.getElementById('edit-student-time-out');
    const editSection = document.getElementById('edit-student-section');
    const editSectionSelect = document.querySelector('select[name="section-attendance-edit"]') || document.querySelector('.select-box-edit');
    const cancelEditBtn = document.getElementById('cancel-edit-student');

    function hhmmToDisplay(hhmm) {
      if (!hhmm) return '';
      try {
        const [hh, mm] = String(hhmm).split(':').map(Number);
        const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s+/g, '');
      } catch (e) { return hhmm; }
    }

    function getFullnameFromRow(tr) {
      try {
        const tds = Array.from(tr.querySelectorAll('td'));
        let fullname = '';
        for (const td of tds) {
          if (td.querySelector && td.querySelector('.row-select')) continue;
          if (td.classList && td.classList.contains('meta-cell')) continue;
          if (td.querySelector && td.querySelector('.times-select')) continue;
          if (td.querySelector && td.querySelector('.status-select')) continue;
          const txt = (td.textContent || '').trim();
          if (/\bIN[: ]|OUT[: ]|Time In[: ]|Time Out[: ]/i.test(txt)) continue;
          if (txt) { fullname = txt; break; }
        }
        if (!fullname) {
          if (tr.children[2] && tr.children[2].textContent) fullname = tr.children[2].textContent.trim();
          else if (tr.children[1] && tr.children[1].textContent) fullname = tr.children[1].textContent.trim();
        }
        return fullname;
      } catch (e) { return (tr.children[2] && tr.children[2].textContent || '').trim(); }
    }

    function parseTimeToHHMM(raw) {
      if (!raw) return '';
      const s = String(raw).trim();
      // ISO date
      const iso = Date.parse(s);
      if (!isNaN(iso) && /T/.test(s)) {
        const d = new Date(iso);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      }
      // matches like 9:16:01AM or 09:16 AM or 12:47:00PM
      const m = s.match(/([0-9]{1,2}):([0-9]{2})(?::[0-9]{2})?\s*(AM|PM)?/i);
      if (m) {
        let hh = parseInt(m[1], 10);
        const mm = String(parseInt(m[2], 10)).padStart(2, '0');
        const ampm = (m[3] || '').toUpperCase();
        if (ampm === 'AM') {
          if (hh === 12) hh = 0;
        } else if (ampm === 'PM') {
          if (hh < 12) hh += 12;
        }
        return `${String(hh).padStart(2, '0')}:${mm}`;
      }
      // fallback: try Date parse
      const d2 = new Date(s);
      if (!isNaN(d2.getTime())) {
        return `${String(d2.getHours()).padStart(2, '0')}:${String(d2.getMinutes()).padStart(2, '0')}`;
      }
      return '';
    }

    async function showEditPanel(trOrId) {
      if (!editPanel) return;
      let tr = null;
      let id = null;
      if (typeof trOrId === 'number' || typeof trOrId === 'string') {
        id = Number(trOrId);
        tr = document.querySelector(`#attendance-tbody tr[data-id="${id}"]`) || document.querySelector(`#recent-students-tbody tr[data-id="${id}"]`);
      } else if (trOrId && trOrId.getAttribute) {
        tr = trOrId; id = Number(tr.getAttribute('data-id'));
      }

      if (tr) {
        const fullname = getFullnameFromRow(tr) || '';
        const timesEl = tr.querySelector('.times-select');
        let tIn = '', tOut = '';
        if (timesEl) {
          tIn = (timesEl.options[0] && timesEl.options[0].textContent || '').replace(/^Time In:\s*/i, '').trim();
          tOut = (timesEl.options[1] && timesEl.options[1].textContent || '').replace(/^Time Out:\s*/i, '').trim();
        } else {
          const txt = (tr.textContent || '').replace(/\s+/g, ' ');
          const mIn = txt.match(/IN[: ]\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);
          const mOut = txt.match(/OUT[: ]\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);
          if (mIn) tIn = mIn[1].replace(/\s+/g, '');
          if (mOut) tOut = mOut[1].replace(/\s+/g, '');
        }
        const username = (tr.dataset && tr.dataset.username) || '';
        const section = (tr.dataset && tr.dataset.section) || (tr.querySelector('.section-cell') && tr.querySelector('.section-cell').textContent.trim()) || '';
        if (editFullname) editFullname.value = fullname || '';
        if (editUsername) editUsername.value = username || '';
        if (editTimeIn) editTimeIn.value = parseTimeToHHMM(tIn) || '';
        if (editTimeOut) editTimeOut.value = parseTimeToHHMM(tOut) || '';
        // ensure section selects are populated first (controller exposes helper)
        if (editSectionSelect && (!editSectionSelect.options || editSectionSelect.options.length === 0)) {
          try {
            const ctrl = await import('./dashboardController.js');
            if (ctrl && typeof ctrl.populateSectionSelects === 'function') await ctrl.populateSectionSelects();
          } catch (e) { /* ignore */ }
        }

        // set section select if present, otherwise set section input
        if (editSectionSelect) {
          const secNormalized = String(section || '').trim();
          let matched = null;
          if (secNormalized) {
            matched = Array.from(editSectionSelect.options).find(o => {
              const txt = (o.textContent || '').trim();
              if (txt && txt.toLowerCase() === secNormalized.toLowerCase()) return true;
              const valDecoded = (o.value || '').replace(/&quot;/g, '"').trim();
              if (valDecoded && valDecoded.toLowerCase() === secNormalized.toLowerCase()) return true;
              return false;
            });
          }
          if (matched) {
            editSectionSelect.value = matched.value;
            if (editSection) { editSection.style.display = 'none'; editSection.required = false; }
            // ensure UI reflects the change
            try { updateEditSectionFieldVisibility(); } catch (e) { /* ignore */ }
          } else if (!secNormalized) {
            // no section on row: choose 'new' so user can enter one
            if (Array.from(editSectionSelect.options).some(o => o.value === 'new')) editSectionSelect.value = 'new';
            if (editSection) { editSection.style.display = 'block'; editSection.required = true; editSection.value = ''; }
          } else {
            // section exists on row but not in options: add it and select
            try {
              const opt = document.createElement('option');
              opt.value = secNormalized.replace(/\"/g, '&quot;');
              opt.textContent = secNormalized;
              editSectionSelect.appendChild(opt);
              editSectionSelect.value = opt.value;
              if (editSection) { editSection.style.display = 'none'; editSection.required = false; }
              try { updateEditSectionFieldVisibility(); } catch (e) { /* ignore */ }
            } catch (e) {
              // fallback to showing free-text
              if (Array.from(editSectionSelect.options).some(o => o.value === 'new')) editSectionSelect.value = 'new';
              if (editSection) { editSection.style.display = 'block'; editSection.required = true; editSection.value = section || ''; }
            }
          }
        } else {
          if (editSection) editSection.value = section || '';
        }
      } else {
        // clear fields
        if (editFullname) editFullname.value = '';
        if (editUsername) editUsername.value = '';
        if (editSection) editSection.value = '';
        if (editTimeIn) editTimeIn.value = '';
        if (editTimeOut) editTimeOut.value = '';
      }

      editPanel.dataset.editId = id || '';
      editPanel.style.display = 'flex';
      editPanel.classList.add('active');
      if (editFullname) editFullname.focus();
    }

    function hideEditPanel() {
      if (!editPanel) return;
      editPanel.style.display = 'none';
      editPanel.classList.remove('active');
      delete editPanel.dataset.editId;
    }

    if (editForm) {
      editForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const id = Number(editPanel && editPanel.dataset && editPanel.dataset.editId) || null;
        const fullname = editFullname ? editFullname.value.trim() : '';
        const username = editUsername ? editUsername.value.trim() : '';
        // resolve section: prefer select (unless 'new'), otherwise free-text input
        let section = '';
        try {
          if (editSectionSelect) {
            const val = String(editSectionSelect.value || '').trim();
            if (val && val !== 'new') {
              section = val.replace(/&quot;/g, '"');
            } else if (editSection) {
              section = String(editSection.value || '').trim();
            }
          } else if (editSection) {
            section = String(editSection.value || '').trim();
          }
        } catch (e) { section = (editSection && editSection.value) ? String(editSection.value).trim() : ''; }
        const tIn = editTimeIn ? editTimeIn.value : '';
        const tOut = editTimeOut ? editTimeOut.value : '';

        // attempt to update canonical store first
        try {
          const mod = await import('./attendanceStore.js');
          const store = mod.default;
          if (store) {
            // Build update payload with common field names
            const payload = {
              student_fullname: fullname || undefined,
              student_username: username || undefined,
              section: section || undefined,
              student_section: section || undefined
            };
            if (id && typeof store.updateRow === 'function') {
              try { await store.updateRow(id, payload); } catch (e) { /* ignore */ }
            } else if (id) {
              // best-effort: mutate cached row
              try {
                const rows = (store.getTodayRows ? store.getTodayRows() : []).concat(store.getRecent ? store.getRecent(200) : []);
                const row = rows.find(r => Number(r.id) === id);
                if (row) {
                  if (fullname) row.student_fullname = fullname;
                  if (username) row.student_username = username;
                  if (section) { row.section = section; row.student_section = section; }
                  if (typeof store._internals === 'function') store._internals();
                }
              } catch (e) { /* ignore */ }
            }

            // persist to backend via API if available (best-effort)
            try {
              // include time fields (ISO) when calling backend
              const serverPayload = Object.assign({}, payload);
              if (id) serverPayload.id = id;
              if (tIn) {
                const [hh1, mm1] = String(tIn).split(':').map(Number);
                const d1 = new Date(); d1.setHours(hh1 || 0, mm1 || 0, 0, 0);
                serverPayload.time_in = d1.toISOString();
              }
              if (tOut) {
                const [hh2, mm2] = String(tOut).split(':').map(Number);
                const d2 = new Date(); d2.setHours(hh2 || 0, mm2 || 0, 0, 0);
                serverPayload.time_out = d2.toISOString();
              }

              // Use preload API only — do NOT call localhost directly from renderer.
              if (window.attendyAPI) {
                if (typeof window.attendyAPI.updateAttendanceRow === 'function') {
                  try { await window.attendyAPI.updateAttendanceRow(id, serverPayload); } catch (e) { /* ignore */ }
                } else if (typeof window.attendyAPI.editAttendance === 'function') {
                  try { await window.attendyAPI.editAttendance(id, serverPayload); } catch (e) { /* ignore */ }
                } else {
                  console.warn('attendyAPI has no edit handler; skipping backend edit to avoid exposing localhost from renderer');
                }
              } else {
                console.warn('attendyAPI not available; skipping backend edit to avoid exposing localhost from renderer');
              }
            } catch (e) { /* ignore */ }

            // time updates
            if (id && tIn) {
              const [hh, mm] = String(tIn).split(':').map(Number);
              const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
              const iso = d.toISOString();
              if (typeof store.setTimeInForRow === 'function') await store.setTimeInForRow(id, iso);
            }
            if (id && tOut) {
              const [hh, mm] = String(tOut).split(':').map(Number);
              const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
              const iso = d.toISOString();
              if (typeof store.setTimeoutForRows === 'function') await store.setTimeoutForRows([id], iso);
            }
          }
        } catch (e) { /* ignore store errors */ }

        // update DOM immediate feedback
        try {
          if (id) {
            const tr = document.querySelector(`#attendance-tbody tr[data-id="${id}"]`);
            if (tr) {
              // locate fullname cell robustly
              try {
                const tds = Array.from(tr.querySelectorAll('td'));
                let fullnameTd = null;
                for (const td of tds) {
                  if (td.querySelector && td.querySelector('.row-select')) continue;
                  if (td.classList && td.classList.contains('meta-cell')) continue;
                  if (td.querySelector && td.querySelector('.times-select')) continue;
                  if (td.querySelector && td.querySelector('.status-select')) continue;
                  fullnameTd = td; break;
                }
                if (!fullnameTd) {
                  // fallback to child index 1
                  fullnameTd = tr.children[1] || null;
                }
                if (fullname && fullnameTd) fullnameTd.textContent = fullname;
              } catch (e) { /* ignore */ }

              // update dataset attrs
              if (section) tr.dataset.section = section;
              if (username) tr.dataset.username = username;

              // update times cell
              const sel = tr.querySelector('.times-select');
              if (sel) {
                if (sel.options[0]) sel.options[0].textContent = `Time In: ${tIn ? hhmmToDisplay(tIn) : 'Not Set'}`;
                if (sel.options[1]) sel.options[1].textContent = `Time Out: ${tOut ? hhmmToDisplay(tOut) : 'Not Set'}`;
              } else {
                // try to find a td that contains IN: or OUT: text and replace its innerHTML
                try {
                  const tds = Array.from(tr.querySelectorAll('td'));
                  const timesTd = tds.find(td => /IN[: ]|OUT[: ]/i.test(td.textContent || ''));
                  if (timesTd) timesTd.innerHTML = `IN: ${tIn ? hhmmToDisplay(tIn) : 'Not Set'} <br> OUT: ${tOut ? hhmmToDisplay(tOut) : 'Not Set'}`;
                } catch (e) { /* ignore */ }
              }
            }
          }
        } catch (e) { /* ignore DOM update errors */ }

        // refresh relevant views
        try { const t = await import('./todayAttendanceView.js'); if (t && typeof t.renderTodayAttendance === 'function') t.renderTodayAttendance(); } catch (e) { }
        try { const r = await import('./recentStudentsView.js'); if (r && typeof r.renderRecentStudents === 'function') r.renderRecentStudents(); } catch (e) { }
        try { const m = await import('./mostPresentView.js'); if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent(); } catch (e) { }
        try { const s = await import('./todayAttendanceSectionView.js'); if (s && typeof s.renderAttendanceSections === 'function') s.renderAttendanceSections(); } catch (e) { }

        // ensure selects and counts update to reflect changed/added section
        try { const ctrl = await import('./dashboardController.js'); if (ctrl && typeof ctrl.populateSectionSelects === 'function') await ctrl.populateSectionSelects(); } catch (e) { /* ignore */ }

        hideEditPanel();
      });
    }

    if (cancelEditBtn && editPanel) cancelEditBtn.addEventListener('click', (ev) => { ev.preventDefault(); hideEditPanel(); });

    if (editPanel) {
      editPanel.addEventListener('click', (ev) => { if (ev.target === editPanel) hideEditPanel(); });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hideEditPanel(); });
    }

    // manage visibility of the edit section free-text input when select changes
    function updateEditSectionFieldVisibility() {
      if (!editSectionSelect || !editSection) return;
      const val = String(editSectionSelect.value || '').trim();
      if (val === 'new') {
        editSection.style.display = 'block';
        editSection.required = true;
      } else {
        editSection.style.display = 'none';
        editSection.required = false;
      }
    }
    if (editSectionSelect) {
      editSectionSelect.addEventListener('change', updateEditSectionFieldVisibility);
      // initial visibility
      try { updateEditSectionFieldVisibility(); } catch (e) { /* ignore */ }
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (!ids.length) {
          showNotice('Select rows', 'Select rows to delete');
          return;
        }
        // show deletion panel and perform deletion on confirm
        showDeletionNotice(ids, async (idsToDelete) => {
          // attempt server-side delete, remove DOM rows and update local store
          for (const id of idsToDelete) {
            try {
              // try server API first (if available)
              if (window.attendyAPI && typeof window.attendyAPI.deleteAttendanceRow === 'function') {
                try { await window.attendyAPI.deleteAttendanceRow(id); } catch (e) { /* ignore server error but continue */ }
              }
            } catch (e) { /* ignore */ }

            // remove row from DOM immediately
            try {
              const tr = document.querySelector(`#attendance-tbody tr[data-id="${id}"]`);
              if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
            } catch (e) { /* ignore */ }

            // update attendanceStore if present
            try {
              const mod = await import('./attendanceStore.js');
              const store = mod.default;
              if (typeof store.deleteRow === 'function') {
                try { await store.deleteRow(id); } catch (e) { /* ignore */ }
              }
            } catch (e) { /* ignore */ }
          }

          // ensure store is in sync with backend
          try {
            const mod2 = await import('./attendanceStore.js');
            const store2 = mod2.default;
            if (typeof store2.refreshAttendance === 'function') {
              await store2.refreshAttendance();
            }
          } catch (e) { /* ignore */ }

          // refresh download state and any search filters
          try { updateDownloadState(); } catch (e) { /* ignore */ }
          const searchInput = document.querySelector('.attendance-table-container .search-input');
          if (searchInput && searchInput.value) {
            try { searchInput.dispatchEvent(new Event('input')); } catch (e) { /* ignore */ }
          }
        });
      });
    }

    if (applyTimeoutBtn) {
      applyTimeoutBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (!ids.length) {
          showNotice('Select rows', 'Select rows to apply timeout');
          return;
        }
        const timeInput = document.getElementById('timeout-time');
        if (!timeInput || !timeInput.value) {
          // Always show a notice when no time is selected from the toolbar.
          // The time-setter panel should only be opened explicitly from the
          // context menu / right-click flows.
          showNotice('Select a time', 'Please select a time first');
          return;
        }
        // build ISO string for today with selected hh:mm
        const [hh, mm] = timeInput.value.split(':').map(Number);
        const d = new Date();
        d.setHours(hh, mm, 0, 0);
        const iso = d.toISOString();
        try {
          if (!window.attendyAPI || typeof window.attendyAPI.setTimeoutForRows !== 'function') {
            console.error('attendyAPI.setTimeoutForRows not available');
            showNotice('Timeout API', 'Timeout API not available');
            return;
          }
          await window.attendyAPI.setTimeoutForRows(ids, iso);
          // update local store cache so UI updates immediately
          try {
            const mod = await import('./attendanceStore.js');
            const store = mod.default;
            if (typeof store.setTimeoutForRows === 'function') {
              await store.setTimeoutForRows(ids, iso);
            } else {
              // fallback to refresh if available
              try { await store.refreshAttendance(); } catch (e) { /* ignore */ }
            }
          } catch (e) { /* ignore */ }
        } catch (e) {
          console.error('apply timeout failed', e);
          showNotice('Failed', 'Failed to apply timeout');
        }
      });
    }

    // ---------------------------
    // Add Student -> inject row into #attendance-tbody
    // ---------------------------
    (function setupAddStudent() {
      const addForm = document.getElementById('add-student-form');
      const cancelAddBtn = document.getElementById('cancel-add-student');
      const addPanel = document.querySelector('.add-student-panel');
      const tbody = document.getElementById('attendance-tbody');

      // compute starting id from existing rows or timestamp
      let nextGeneratedId = (() => {
        try {
          const ids = Array.from(document.querySelectorAll('#attendance-tbody tr[data-id]')).map(tr => Number(tr.getAttribute('data-id')) || 0);
          const m = ids.length ? Math.max(...ids) : 0;
          return m > 0 ? m + 1 : Date.now() % 1000000;
        } catch (e) { return Date.now() % 1000000; }
      })();

      function sanitize(s) { return String(s || '').trim(); }

      function createAttendanceRow({ id, fullname, username, section, timeIn = '', timeOut = '', status = 'Present' }) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', id);
        tr.dataset.section = section || '';
        if (username) tr.dataset.username = username;

        // checkbox cell (col 1)
        const tdChk = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'row-select';
        cb.setAttribute('data-id', id);
        tdChk.appendChild(cb);

        // placeholder / meta cell (col 2) - keep empty so fullname remains at index 2
        const tdMeta = document.createElement('td');
        tdMeta.className = 'meta-cell';
        tdMeta.innerHTML = ''; // reserved for icon/avatar if needed

        // fullname cell (index 2 used by search)
        const tdFull = document.createElement('td');
        tdFull.textContent = fullname || '';

        // times cell (index 3)
        const tdTimes = document.createElement('td');
        const selTimes = document.createElement('select');
        selTimes.className = 'times-select';
        const optIn = document.createElement('option');
        optIn.textContent = `Time In: ${timeIn || ''}`;
        const optOut = document.createElement('option');
        optOut.textContent = `Time Out: ${timeOut || ''}`;
        selTimes.appendChild(optIn);
        selTimes.appendChild(optOut);
        tdTimes.appendChild(selTimes);

        // status cell (index 4)
        const tdStatus = document.createElement('td');
        const selStatus = document.createElement('select');
        selStatus.className = 'status-select';
        ['Present', 'Late', 'Absent', 'Excused'].forEach(st => {
          const o = document.createElement('option');
          o.value = st;
          o.textContent = st;
          if (st === status) o.selected = true;
          selStatus.appendChild(o);
        });
        tdStatus.appendChild(selStatus);

        tr.appendChild(tdChk);
        tr.appendChild(tdMeta);
        tr.appendChild(tdFull);
        tr.appendChild(tdTimes);
        tr.appendChild(tdStatus);

        return tr;
      }

      // show panel helper
      function showAddPanel() {
        if (!addPanel) return;
        addPanel.style.display = 'flex';
        addPanel.classList.add('active');
        // ensure section field visibility matches current select state
        try { updateSectionFieldVisibility(); } catch (e) { /* ignore */ }
        const fn = document.getElementById('student-fullname');
        if (fn) fn.focus();
      }
      function hideAddPanel() {
        if (!addPanel) return;
        addPanel.style.display = 'none';
        addPanel.classList.remove('active');
      }

      // attach open button (the "add Student" button)
      const addStudentBtn = document.getElementById('add-student');
      if (addStudentBtn && addPanel) {
        addStudentBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          showAddPanel();
        });
      }

      // helper: ensure all relevant tables update after a new row is added
      async function ensureTablesUpdate(rowObj) {
        // Preferred: update canonical store (so controller + subscribed views re-render)
        try {
          const mod = await import('./attendanceStore.js');
          const store = mod.default;
          if (store) {
            if (typeof store.addRow === 'function') {
              try { await store.addRow(rowObj); } catch (e) { /* ignore */ }
            }
            if (typeof store.refreshAttendance === 'function') {
              try { await store.refreshAttendance(); } catch (e) { /* ignore */ }
            }
            // now trigger view renders that read from the store
            try {
              const t = await import('./todayAttendanceView.js');
              if (t && typeof t.renderTodayAttendance === 'function') t.renderTodayAttendance();
            } catch (e) { /* ignore */ }
            try {
              const r = await import('./recentStudentsView.js');
              if (r && typeof r.renderRecentStudents === 'function') r.renderRecentStudents();
            } catch (e) { /* ignore */ }
            try {
              const m = await import('./mostPresentView.js');
              if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent();
            } catch (e) { /* ignore */ }
            try {
              const s = await import('./todayAttendanceSectionView.js');
              if (s && typeof s.renderAttendanceSections === 'function') s.renderAttendanceSections();
            } catch (e) { /* ignore */ }

            // refresh calendar-specific view if present
            try {
              if (window.calendarAttendance && typeof window.calendarAttendance.renderSelectedDateAttendance === 'function') {
                window.calendarAttendance.renderSelectedDateAttendance(new Date());
              }
            } catch (e) { /* ignore */ }

            // ensure section <select> elements reflect latest store data
            try {
              const ctrl = await import('./dashboardController.js');
              if (ctrl && typeof ctrl.populateSectionSelects === 'function') ctrl.populateSectionSelects();
            } catch (e) { /* ignore */ }

            return;
          }
        } catch (e) { /* ignore store import errors */ }

        // Fallback: update DOM tables directly when store / views unavailable
        try {
          const viewMod = await import('./todayAttendanceView.js');
          const html = (viewMod && typeof viewMod.buildRowHtml === 'function') ? viewMod.buildRowHtml(rowObj) : null;
          const tbody = document.getElementById('attendance-tbody');
          if (html && tbody) tbody.insertAdjacentHTML('beforeend', html);
          else if (tbody) {
            const tr = createAttendanceRow({
              id: rowObj.id,
              fullname: rowObj.student_fullname || rowObj.fullname || '',
              section: rowObj.section || ''
            });
            tbody.appendChild(tr);
          }

          // update section table (attendance-section-tbody) - increment/create section row
          const secTbody = document.getElementById('attendance-section-tbody');
          if (secTbody && rowObj.section) {
            const sec = String(rowObj.section).trim();
            let secRow = Array.from(secTbody.querySelectorAll('tr')).find(r => (r.dataset && r.dataset.section || '').toLowerCase() === sec.toLowerCase() || (r.children[0] && r.children[0].textContent.trim().toLowerCase() === sec.toLowerCase()));
            if (!secRow) {
              secRow = document.createElement('tr');
              secRow.dataset.section = sec;
              const tdSec = document.createElement('td');
              tdSec.textContent = sec;
              const tdCount = document.createElement('td');
              tdCount.textContent = '1';
              secRow.appendChild(tdSec);
              secRow.appendChild(tdCount);
              secTbody.appendChild(secRow);
            } else {
              try {
                const cntCell = secRow.children[1];
                const cnt = Number(cntCell && cntCell.textContent) || 0;
                if (cntCell) cntCell.textContent = String(cnt + 1);
              } catch (e) { /* ignore */ }
            }
          }

          // update recent students table (prepend)
          try {
            const recentTbody = document.getElementById('recent-students-tbody');
            if (recentTbody) {
              const tr = document.createElement('tr');
              tr.setAttribute('data-id', rowObj.id);
              const tdName = document.createElement('td'); tdName.textContent = rowObj.student_fullname || rowObj.fullname || '';
              const tdTime = document.createElement('td'); tdTime.textContent = new Date(rowObj.time_in || rowObj.timestamp || Date.now()).toLocaleString();
              const tdSec = document.createElement('td'); tdSec.textContent = rowObj.section || '';
              tr.appendChild(tdName); tr.appendChild(tdTime); tr.appendChild(tdSec);
              // insert at start
              if (recentTbody.firstChild) recentTbody.insertBefore(tr, recentTbody.firstChild);
              else recentTbody.appendChild(tr);
            }
          } catch (e) { /* ignore */ }

          // update most-present - best-effort: refresh if function present
          try {
            const mp = await import('./mostPresentView.js');
            if (mp && typeof mp.renderMostPresent === 'function') mp.renderMostPresent();
          } catch (e) { /* ignore */ }

          // update calendar-specific tbody if present
          try {
            const specTbody = document.getElementById('attendance-specDate-tbody');
            if (specTbody) {
              const tr = document.createElement('tr');
              tr.setAttribute('data-id', rowObj.id);
              const tdName = document.createElement('td'); tdName.textContent = rowObj.student_fullname || rowObj.fullname || '';
              const tdSec = document.createElement('td'); tdSec.textContent = rowObj.section || '';
              const tdStatus = document.createElement('td'); tdStatus.textContent = rowObj.status || '';
              const tdTime = document.createElement('td'); tdTime.textContent = new Date(rowObj.time_in || rowObj.timestamp || Date.now()).toLocaleString();
              tr.appendChild(tdName); tr.appendChild(tdSec); tr.appendChild(tdStatus); tr.appendChild(tdTime);
              if (specTbody.firstChild) specTbody.insertBefore(tr, specTbody.firstChild);
              else specTbody.appendChild(tr);
            }
          } catch (e) { /* ignore */ }
        } catch (e) {
          console.warn('ensureTablesUpdate fallback failed', e);
        }
      }

      // Section selection for Add Student panel: toggle student-section input visibility
      const sectionSelectAdd = document.querySelector('select[name="section-attendance-add"]') || document.querySelector('.select-box-add');
      const sectionInput = document.getElementById('student-section');
      const sectionLabel = document.querySelector('label[for="student-section"]');

      function updateSectionFieldVisibility() {
        if (!sectionSelectAdd || !sectionInput) return;
        const val = String(sectionSelectAdd.value || '').trim();
        if (val === 'new') {
          if (sectionLabel) sectionLabel.style.display = 'block';
          sectionInput.style.display = 'block';
          sectionInput.required = true;
          sectionInput.value = '';
        } else {
          if (sectionLabel) sectionLabel.style.display = 'none';
          sectionInput.style.display = 'none';
          // set the hidden input value to the selected option's display text (so form still submits a section)
          const optText = (sectionSelectAdd.options && sectionSelectAdd.selectedIndex >= 0) ? sectionSelectAdd.options[sectionSelectAdd.selectedIndex].text : val;
          sectionInput.value = optText || val;
          sectionInput.required = false;
        }
      }

      if (sectionSelectAdd) {
        sectionSelectAdd.addEventListener('change', () => updateSectionFieldVisibility());
      }

      // ensure initial visibility reflects current selection when opening the panel
      updateSectionFieldVisibility();

      if (addForm && tbody) {
        addForm.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const fnEl = document.getElementById('student-fullname');
          const unEl = document.getElementById('student-username');
          const secEl = document.getElementById('student-section');
          const fullname = sanitize(fnEl && fnEl.value);
          const username = sanitize(unEl && unEl.value);
          const section = sanitize(secEl && secEl.value);
          if (!fullname || !username || !section) {
            showNotice('Missing fields', 'Please fill fullname, username and section');
            return;
          }

          // Prepare minimal attendance payload
          // include role by default to satisfy backend expectations
          const payload = { fullname, username, section, role: 'student', status: 'Present', time_in: new Date().toISOString() };

          // Try to persist via attendyAPI.recordAttendance first.
          let savedOnServer = false;
          let returnedId = null;
          let serverRow = null;
          try {
            if (window.attendyAPI && typeof window.attendyAPI.recordAttendance === 'function') {
              const res = await window.attendyAPI.recordAttendance(payload);
              // handle common response shapes
              const row = (res && (res.data || res.row)) ? (res.data || res.row) : res;
              serverRow = row || null;
              returnedId = row && (row.id || row._id || row.user_id || row.attendance_id) ? (row.id || row._id || row.user_id || row.attendance_id) : (res && res.id ? res.id : null);
              savedOnServer = true;
            }
          } catch (e) {
            console.warn('recordAttendance failed; falling back to local-only add', e);
            savedOnServer = false;
            returnedId = null;
            serverRow = null;
          }

          // If server saved, refresh attendance store (preferred) so all views update from canonical source.
          if (savedOnServer) {
            try {
              const mod = await import('./attendanceStore.js');
              const store = mod.default;
              if (store) {
                if (typeof store.refreshAttendance === 'function') {
                  try {
                    const res = await store.refreshAttendance();
                    if (res && res.changed === true) {
                      // store refreshed - manually trigger renders because refreshAttendance does not emit change
                      try { const t = await import('./todayAttendanceView.js'); if (t && typeof t.renderTodayAttendance === 'function') t.renderTodayAttendance(); } catch (e) { /* ignore */ }
                      try { const r = await import('./recentStudentsView.js'); if (r && typeof r.renderRecentStudents === 'function') r.renderRecentStudents(); } catch (e) { /* ignore */ }
                      try { const m = await import('./mostPresentView.js'); if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent(); } catch (e) { /* ignore */ }
                      try { const s = await import('./todayAttendanceSectionView.js'); if (s && typeof s.renderAttendanceSections === 'function') s.renderAttendanceSections(); } catch (e) { /* ignore */ }
                      try { if (window.calendarAttendance && typeof window.calendarAttendance.renderSelectedDateAttendance === 'function') window.calendarAttendance.renderSelectedDateAttendance(new Date()); } catch (e) { /* ignore */ }

                      // ensure section selects update
                      try {
                        const ctrl = await import('./dashboardController.js');
                        if (ctrl && typeof ctrl.populateSectionSelects === 'function') ctrl.populateSectionSelects();
                      } catch (e) { /* ignore */ }

                      addForm.reset();
                      try { updateSectionFieldVisibility(); } catch (e) { }
                      hideAddPanel();
                      try { updateDownloadState(); } catch (e) { /* ignore */ }
                      const searchInput = document.querySelector('.attendance-table-container .search-input');
                      if (searchInput && searchInput.value) {
                        try { searchInput.dispatchEvent(new Event('input')); } catch (e) { /* ignore */ }
                      }
                      return;
                    }
                    // if refresh did not report changes, fall through to try adding the server row to cache
                  } catch (e) { /* ignore refresh errors and fall through */ }
                }

                // if we have the server row, insert it into the local store so subscribers trigger
                if (serverRow && typeof store.addRow === 'function') {
                  try { await store.addRow(serverRow); } catch (e) { /* ignore */ }
                  // force view renders as a safety-net
                  try { const t = await import('./todayAttendanceView.js'); if (t && typeof t.renderTodayAttendance === 'function') t.renderTodayAttendance(); } catch (e) { }
                  try { const r = await import('./recentStudentsView.js'); if (r && typeof r.renderRecentStudents === 'function') r.renderRecentStudents(); } catch (e) { }
                  try { const m = await import('./mostPresentView.js'); if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent(); } catch (e) { }
                  try { const s = await import('./todayAttendanceSectionView.js'); if (s && typeof s.renderAttendanceSections === 'function') s.renderAttendanceSections(); } catch (e) { }

                  // ensure section selects update after manual render
                  try {
                    const ctrl = await import('./dashboardController.js');
                    if (ctrl && typeof ctrl.populateSectionSelects === 'function') ctrl.populateSectionSelects();
                  } catch (e) { /* ignore */ }

                  addForm.reset();
                  try { updateSectionFieldVisibility(); } catch (e) { }
                  hideAddPanel();
                  try { updateDownloadState(); } catch (e) { /* ignore */ }
                  const searchInput = document.querySelector('.attendance-table-container .search-input');
                  if (searchInput && searchInput.value) {
                    try { searchInput.dispatchEvent(new Event('input')); } catch (e) { /* ignore */ }
                  }
                  return;
                }
              }
            } catch (e) {
              // if store not available, fall back to appending a row locally using returnedId
              console.warn('attendanceStore.refreshAttendance failed', e);
            }
          }

          // Fallback: no backend or store not present — append a local row and attempt best-effort store update
          const id = returnedId || nextGeneratedId++;

          // try to reuse today's view row builder for consistent markup
          try {
            const viewMod = await import('./todayAttendanceView.js');
            const rowObj = {
              id,
              student_fullname: fullname,
              student_username: username,
              section,
              status: 'Present',
              time_in: new Date().toISOString()
            };
            if (viewMod && typeof viewMod.buildRowHtml === 'function') {
              tbody.insertAdjacentHTML('beforeend', viewMod.buildRowHtml(rowObj));
            } else {
              const tr = createAttendanceRow({ id, fullname, section });
              tbody.appendChild(tr);
            }

            // ensure other tables / store are updated
            try { await ensureTablesUpdate(rowObj); } catch (e) { /* ignore */ }
          } catch (e) {
            // fallback to DOM builder if view import fails
            const tr = createAttendanceRow({ id, fullname, section });
            tbody.appendChild(tr);
            try { await ensureTablesUpdate({ id, student_fullname: fullname, student_username: username, section, status: 'Present', time_in: new Date().toISOString() }); } catch (e) { /* ignore */ }
          }

          // reset form and hide panel
          addForm.reset();
          try { updateSectionFieldVisibility(); } catch (e) { }
          hideAddPanel();

          // attempt to update local store cache if available
          try {
            const mod2 = await import('./attendanceStore.js');
            const store2 = mod2.default;
            if (typeof store2.addRow === 'function') {
              try { await store2.addRow({ id, student_fullname: fullname, section, status: 'Present', time_in: new Date().toISOString() }); } catch (e) { /* ignore */ }
            } else if (typeof store2.refreshAttendance === 'function') {
              try { await store2.refreshAttendance(); } catch (e) { /* ignore */ }
            }
          } catch (e) { /* ignore */ }

          // ensure download state / search re-apply
          try { updateDownloadState(); } catch (e) { /* ignore */ }
          const searchInput = document.querySelector('.attendance-table-container .search-input');
          if (searchInput && searchInput.value) {
            try { searchInput.dispatchEvent(new Event('input')); } catch (e) { /* ignore */ }
          }
        }, { passive: false });
      }

      if (cancelAddBtn && addPanel) {
        cancelAddBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          hideAddPanel();
        });
      }

      // clicking on overlay (outside the card) closes panel
      if (addPanel) {
        addPanel.addEventListener('click', (ev) => {
          if (ev.target === addPanel) hideAddPanel();
        });
      }
      // escape closes panel
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') hideAddPanel();
      });
    })();

    // Right-click menu handling for table rows
    const rMenu = document.getElementById('R-clk-menu');
    // remember the row id that was toggled/opened by the context menu
    let lastContextRowId = null;
    // right-clicking a row should also toggle its selection checkbox
    const attendanceTbodyEl = document.getElementById('attendance-tbody');
    if (attendanceTbodyEl) {
      attendanceTbodyEl.addEventListener('contextmenu', (ev) => {
        try {
          const tr = ev.target && ev.target.closest ? ev.target.closest('tr') : null;
          if (!tr) return;
          const cb = tr.querySelector && tr.querySelector('.row-select');
          if (!cb) return;
          const newId = Number(tr.getAttribute('data-id')) || null;
          // if another row was previously context-selected, uncheck it first
          try {
            if (lastContextRowId && lastContextRowId !== newId) {
              const prevCb = document.querySelector(`#attendance-tbody .row-select[data-id="${lastContextRowId}"]`);
              if (prevCb) {
                prevCb.checked = false;
                try { prevCb.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignore */ }
              }
            }
          } catch (e) { /* ignore */ }

          // ensure current checkbox is checked (do NOT uncheck when right-clicking the same row)
          try {
            const wasChecked = !!cb.checked;
            if (!wasChecked) {
              cb.checked = true;
              try { cb.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignore */ }
            }
            // remember which row was toggled/selected by the context menu (keep set even if already checked)
            try { lastContextRowId = newId; } catch (e) { lastContextRowId = null; }
          } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
      });
    }
    function hideRMenu(opts = {}) {
      if (!rMenu) return;
      // if caller indicates this was an outside click, uncheck the previously toggled row
      try {
        if (opts.uncheckContextRow && lastContextRowId) {
          const cb = document.querySelector(`#attendance-tbody .row-select[data-id="${lastContextRowId}"]`);
          if (cb) {
            cb.checked = false;
            try { cb.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignore */ }
          }
        }
      } catch (e) { /* ignore */ }
      rMenu.style.display = 'none';
      rMenu.innerHTML = '';
      lastContextRowId = null;
    }


    function posMenu(x, y) {
      if (!rMenu) return;
      rMenu.style.left = x + 'px';
      rMenu.style.top = y + 'px';
      rMenu.style.display = 'block';
    }

    async function buildMenuFor(tbodyId, tr) {
      if (!rMenu || !tr) return;
      const id = Number(tr.getAttribute('data-id')) || null;
      // fetch store row if available
      let storeRow = null;
      try {
        const mod = await import('./attendanceStore.js');
        const store = mod.default;
        if (id && typeof store._internals === 'function') {
          // try to read cache via public methods
          const rows = store.getTodayRows().concat(store.getRecent ? store.getRecent(50) : []);
          storeRow = rows.find(r => Number(r.id) === id) || null;
        }
      } catch (e) { /* ignore */ }

      const makeBtn = (txt, cls) => `<button class="rcm-btn ${cls}">${txt}</button>`;
      let html = '';

      if (tbodyId === 'new-added-students' && id) {
        html += makeBtn('Delete', 'delete');
        html += makeBtn('Check Info', 'info');
      } else if (tbodyId === 'attendance-specDate-tbody' && id) {
        html += makeBtn('Delete', 'delete');
        html += makeBtn('Set Status', 'set-status');
        html += makeBtn('Edit', 'edit');
        html += makeBtn('Check Info', 'info');
      } else if (tbodyId === 'attendance-tbody' && id) {
        html += makeBtn('Edit', 'edit');
        html += makeBtn('Delete', 'delete');
        html += makeBtn('Check Info', 'info');
      } else if (tbodyId === 'recent-students-tbody' && id) {
        // recent students list: minimal options
        html += makeBtn('Delete', 'delete');
        html += makeBtn('Check Info', 'info');
      } else if (!html && id) {
        // fallback for other tbodies that contain row data
        html += makeBtn('Delete', 'delete');
        html += makeBtn('Check Info', 'info');
      }

      if (!html) {
        rMenu.innerHTML = '';
        return false;
      }

      rMenu.innerHTML = html;

      // attach listeners
      rMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          const cls = btn.className || '';
          hideRMenu();
          try {
            const mod = await import('./attendanceStore.js');
            const store = mod.default;
            if (cls.includes('delete')) {
              // replace confirm dialog with deletion panel
              showDeletionNotice(id ? [id] : [], async (idsToDelete) => {
                if (!idsToDelete.length) return;
                if (id) await store.deleteRow(idsToDelete[0]);
              });
              return;
            }
            if (cls.includes('info')) {
              // show quick info
              const text = storeRow ? JSON.stringify(storeRow, null, 2) : (tr ? tr.textContent : 'No info');
              showNotice('Row Info', text);
              return;
            }
            if (cls.includes('set-status')) {
              const status = prompt('Enter status (Present/Late/Excused/Absent):  ');
              if (!status) return;
              if (id) await store.updateStatus(id, status);
              return;
            }
            if (cls.includes('set-timeout')) {
              try {
                const existing = tr && tr.querySelector && tr.querySelector('.times-select');
                let defaultTime = '';
                if (existing) {
                  const opt = existing.options && existing.options[1] && existing.options[1].textContent || '';
                  defaultTime = opt.replace(/^[^0-9]*/, '').trim();
                }
                showEditPanel(tr);
                if (typeof editTimeOut !== 'undefined' && editTimeOut) { editTimeOut.value = defaultTime || ''; editTimeOut.focus(); }
              } catch (e) { /* ignore */ }
              return;
            }
            if (cls.includes('set-timein')) {
              try {
                const existing = tr && tr.querySelector && tr.querySelector('.times-select');
                let defaultTime = '';
                if (existing) {
                  const opt = existing.options && existing.options[0] && existing.options[0].textContent || '';
                  defaultTime = opt.replace(/^[^0-9]*/, '').trim();
                }
                showEditPanel(tr);
                if (typeof editTimeIn !== 'undefined' && editTimeIn) { editTimeIn.value = defaultTime || ''; editTimeIn.focus(); }
              } catch (e) { /* ignore */ }
              return;
            }
            if (cls.includes('edit')) {
              // open full edit panel instead of prompt
              try { showEditPanel(tr); } catch (e) { /* ignore */ }
              return;
            }
          } catch (e) {
            console.error('right-click action failed', e);
          }
        });
      });
      return true;
    }

    // global contextmenu handler - delegate to rows
    document.addEventListener('contextmenu', (ev) => {
      const tr = ev.target.closest && ev.target.closest('tr');
      if (!tr) { hideRMenu(); return; }
      const tbody = tr.closest && tr.closest('tbody');
      if (!tbody) { hideRMenu(); return; }
      const tbid = tbody.id;
      ev.preventDefault();
      buildMenuFor(tbid, tr).then((show) => {
        if (show) posMenu(ev.pageX, ev.pageY);
        else hideRMenu();
      }).catch(() => hideRMenu());
    });

    // hide on any click outside; if hiding due to outside click, uncheck the context-row
    document.addEventListener('click', (ev) => {
      if (!rMenu) return;
      if (ev.target.closest && ev.target.closest('#R-clk-menu')) return;
      hideRMenu({ uncheckContextRow: true });
    });

    // Update student counts when a section is selected
    async function updateCountsForSelectedSection() {
      try {
        const sel = document.querySelector('select[name="section-attendance"], select.select-box');
        const totalEl = document.getElementById('student-total');
        const presentEl = document.getElementById('student-present');
        const absentEl = document.getElementById('student-absent');
        const lateEl = document.getElementById('student-late');
        if (!totalEl || !presentEl || !absentEl || !lateEl) return;
        const value = sel ? (sel.value || 'all') : 'all';

        // get today's rows from store
        let rows = [];
        try {
          const mod = await import('./attendanceStore.js');
          const store = mod.default;
          if (store && typeof store.getTodayRows === 'function') rows = store.getTodayRows();
        } catch (e) {
          // ignore
        }

        // filter rows by section and compute latest per student
        const seen = new Map();
        for (const r of rows) {
          const sec = (r.student_section || r.section || r.section_name || '').toString().trim();
          if (value !== 'all' && sec.toLowerCase() !== String(value).toLowerCase()) continue;
          const key = ((r.student_username || r.student_fullname) || '').toString().trim().toLowerCase();
          if (!key) continue;
          if (!seen.has(key)) seen.set(key, r); // rows are newest-first in store
        }

        const counts = { total: seen.size, present: 0, absent: 0, late: 0 };
        for (const r of seen.values()) {
          const s = (r.status || '').toString().toLowerCase();
          if (s === 'present') counts.present += 1;
          else if (s === 'late') counts.late += 1;
          else if (s === 'absent') counts.absent += 1;
        }

        totalEl.textContent = String(counts.total);
        presentEl.textContent = String(counts.present);
        absentEl.textContent = String(counts.absent);
        lateEl.textContent = String(counts.late);
      } catch (e) { /* ignore */ }
    }

    // Attach change handlers and subscribe to store updates
    (function attachSectionHandlers() {
      try {
        const selects = Array.from(document.querySelectorAll('select[name="section-attendance"], select.select-box'));
        for (const sel of selects) {
          sel.addEventListener('change', () => {
            const v = sel.value || 'all';
            updateCountsForSelectedSection().catch(() => { });
            // re-render filtered lists
            import('./recentStudentsView.js').then(m => { if (m && typeof m.renderRecentStudents === 'function') m.renderRecentStudents(v).catch?.(() => { }); }).catch(() => { });
            import('./mostPresentView.js').then(m => { if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent(v).catch?.(() => { }); }).catch(() => { });
          });
        }
        // initial compute + render
        updateCountsForSelectedSection().catch(() => { });
        const curSel = (selects[0] && selects[0].value) ? selects[0].value : 'all';
        import('./recentStudentsView.js').then(m => { if (m && typeof m.renderRecentStudents === 'function') m.renderRecentStudents(curSel).catch?.(() => { }); }).catch(() => { });
        import('./mostPresentView.js').then(m => { if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent(curSel).catch?.(() => { }); }).catch(() => { });
        // subscribe to store changes
        import('./attendanceStore.js').then(mod => {
          const store = mod.default;
          if (store && typeof store.subscribe === 'function') {
            try { store.subscribe(() => { updateCountsForSelectedSection().catch(() => { }); const sel = selects[0] && selects[0].value || 'all'; import('./recentStudentsView.js').then(m => { if (m && typeof m.renderRecentStudents === 'function') m.renderRecentStudents(sel).catch?.(() => { }); }).catch(() => { }); import('./mostPresentView.js').then(m => { if (m && typeof m.renderMostPresent === 'function') m.renderMostPresent(sel).catch?.(() => { }); }).catch(() => { }); }); } catch (e) { /* ignore */ }
          }
        }).catch(() => { });
      } catch (e) { /* ignore */ }
    })();

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') hideRMenu();
    });
  });
})();
