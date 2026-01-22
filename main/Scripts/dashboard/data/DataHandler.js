
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
      const fullname = (tr.children[2] && tr.children[2].textContent || '').trim();
      // times cell contains a select with two options
      let timeIn = '';
      let timeOut = '';
      try {
        const sel = tr.querySelector('.times-select');
        if (sel) {
          const opt0 = sel.options[0] && sel.options[0].textContent || '';
          const opt1 = sel.options[1] && sel.options[1].textContent || '';
          timeIn = opt0.replace(/^\s*Time In:\s*/i, '').trim();
          timeOut = opt1.replace(/^\s*Time Out:\s*/i, '').trim();
        }
      } catch (e) { }
      const statusEl = tr.querySelector('.status-select');
      const status = statusEl ? statusEl.value : (tr.children[4] && tr.children[4].textContent || '').trim();
      rows.push({ id, fullname, timeIn, timeOut, status });
    }
    return rows;
  }

  async function downloadAsXlsx(data, filename = 'attendance.xlsx') {
    if (typeof XLSX === 'undefined') {
      console.error('XLSX library not found');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
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

  document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-sheet');
    const deleteBtn = document.getElementById('delete');
    const applyTimeoutBtn = document.getElementById('apply-timeout-btn');
    const selectAll = document.getElementById('select-all-rows');

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
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = ids.length ? `attendance-selected-${ts}.xlsx` : `attendance-all-${ts}.xlsx`;
        await downloadAsXlsx(data, filename);
      });
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

    // Time setter panel (replacement for prompt-based time edits)
    const timeSetterPanel = document.querySelector('.time-setter-panel');
    const timeoutSetterInput = document.getElementById('timeout-time-setter');
    const timeinSetterInput = document.getElementById('timein-time-setter');
    const applyTimeoutRcBtn = document.getElementById('apply-timeout-btn-rc');
    const applyTimeinRcBtn = document.getElementById('apply-timein-btn-rc');

    function showTimeSetter(action, ids, defaultTime) {
      if (!timeSetterPanel) return;
      timeSetterPanel.style.display = 'block';
      
      timeSetterPanel.dataset.action = action;
      timeSetterPanel.dataset.ids = Array.isArray(ids) ? ids.join(',') : (ids || '');
      if ((action === 'set-timeout' || action === 'apply-timeout') && timeoutSetterInput) {
        timeoutSetterInput.value = defaultTime || '';
      }
      if ((action === 'set-timein' || action === 'apply-timein') && timeinSetterInput) {
        timeinSetterInput.value = defaultTime || '';
      }
    }

    function hideTimeSetter() {
      if (!timeSetterPanel) return;
      timeSetterPanel.style.display = 'none';

      delete timeSetterPanel.dataset.action;
      delete timeSetterPanel.dataset.ids;
    }

    // apply-timeout from right-click panel
    if (applyTimeoutRcBtn) {
      applyTimeoutRcBtn.addEventListener('click', async () => {
        if (!timeSetterPanel) return;
        const ids = (timeSetterPanel.dataset.ids || '').split(',').map(Number).filter(Boolean);
        if (!ids.length) { alert('No rows selected'); return; }
        const val = timeoutSetterInput ? timeoutSetterInput.value : null;
        if (!val) { alert('Select a time first'); return; }
        const [hh, mm] = val.split(':').map(Number);
        const d = new Date();
        d.setHours(hh || 0, mm || 0, 0, 0);
        const iso = d.toISOString();
        try {
          if (window.attendyAPI && typeof window.attendyAPI.setTimeoutForRows === 'function') {
            await window.attendyAPI.setTimeoutForRows(ids, iso);
          }
          try {
            const mod = await import('./attendanceStore.js');
            const store = mod.default;
            if (typeof store.setTimeoutForRows === 'function') {
              await store.setTimeoutForRows(ids, iso);
            }
          } catch (e) { /* ignore */ }
        } catch (e) {
          console.error('apply timeout (rc) failed', e);
          alert('Failed to apply timeout');
        } finally {
          hideTimeSetter();
        }
      });
    }

    // apply-timein from right-click panel
    if (applyTimeinRcBtn) {
      applyTimeinRcBtn.addEventListener('click', async () => {
        if (!timeSetterPanel) return;
        const ids = (timeSetterPanel.dataset.ids || '').split(',').map(Number).filter(Boolean);
        if (!ids.length) { alert('No rows selected'); return; }
        const val = timeinSetterInput ? timeinSetterInput.value : null;
        if (!val) { alert('Select a time first'); return; }
        const [hh, mm] = val.split(':').map(Number);
        const d = new Date();
        d.setHours(hh || 0, mm || 0, 0, 0);
        const iso = d.toISOString();
        try {
          try {
            const mod = await import('./attendanceStore.js');
            const store = mod.default;
            if (ids.length === 1 && typeof store.setTimeInForRow === 'function') {
              await store.setTimeInForRow(ids[0], iso);
            } else if (ids.length && typeof store.setTimeInForRow === 'function') {
              for (const id of ids) await store.setTimeInForRow(id, iso);
            }
          } catch (e) { /* ignore */ }
        } catch (e) {
          console.error('apply timein (rc) failed', e);
          alert('Failed to apply time in');
        } finally {
          hideTimeSetter();
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (!ids.length) {
          alert('Select rows to delete');
          return;
        }
        if (!confirm(`Delete ${ids.length} selected row(s)? This cannot be undone.`)) return;
        try {
          const mod = await import('./attendanceStore.js');
          const store = mod.default;
          for (const id of ids) {
            await store.deleteRow(id);
          }
        } catch (e) {
          console.error('delete action failed', e);
          alert('Delete failed');
        }
      });
    }

    if (applyTimeoutBtn) {
      applyTimeoutBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (!ids.length) {
          alert('Select rows to apply timeout');
          return;
        }
        const timeInput = document.getElementById('timeout-time');
        if (!timeInput || !timeInput.value) {
          // if there's a dedicated panel, open it for bulk apply
          if (typeof showTimeSetter === 'function' && timeSetterPanel) {
            showTimeSetter('apply-timeout', ids);
            return;
          }
          alert('Please select a time first');
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
            alert('Timeout API not available');
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
          alert('Failed to apply timeout');
        }
      });
    }

    // Right-click menu handling for table rows
    const rMenu = document.getElementById('R-clk-menu');
    function hideRMenu() {
      if (!rMenu) return;
      rMenu.style.display = 'none';
      rMenu.innerHTML = '';
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
        html += makeBtn('Set Time Out', 'set-timeout');
        html += makeBtn('Set Time In', 'set-timein');
        html += makeBtn('Check Info', 'info');
      } else if (tbodyId === 'attendance-tbody' && id) {
        html += makeBtn('Edit', 'edit');
        html += makeBtn('Delete', 'delete');
        html += makeBtn('Set Time Out', 'set-timeout');
        html += makeBtn('Set Time In', 'set-timein');
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
              if (!confirm('Delete this row? This cannot be undone.')) return;
              if (id) await store.deleteRow(id);
              return;
            }
            if (cls.includes('info')) {
              // show quick info
              const text = storeRow ? JSON.stringify(storeRow, null, 2) : (tr ? tr.textContent : 'No info');
              alert(text);
              return;
            }
            if (cls.includes('set-status')) {
              const status = prompt('Enter status (Present/Late/Excused/Absent):  ');
              if (!status) return;
              if (id) await store.updateStatus(id, status);
              return;
            }
            if (cls.includes('set-timeout')) {
              document.querySelector('.time-setter-in-panel').style.display = 'none';
              document.querySelector('.time-setter-out-panel').style.display = 'block';
              try {
                const existing = tr && tr.querySelector && tr.querySelector('.times-select');
                let defaultTime = '';
                if (existing) {
                  const opt = existing.options && existing.options[1] && existing.options[1].textContent || '';
                  defaultTime = opt.replace(/^[^0-9]*/, '').trim();
                }
                showTimeSetter('set-timeout', id ? [id] : [], defaultTime);
              } catch (e) { /* ignore */ }
              return;
            }
            if (cls.includes('set-timein')) {
              document.querySelector('.time-setter-in-panel').style.display = 'block';
              document.querySelector('.time-setter-out-panel').style.display = 'none';
              try {
                const existing = tr && tr.querySelector && tr.querySelector('.times-select');
                let defaultTime = '';
                if (existing) {
                  const opt = existing.options && existing.options[0] && existing.options[0].textContent || '';
                  defaultTime = opt.replace(/^[^0-9]*/, '').trim();
                }
                showTimeSetter('set-timein', id ? [id] : [], defaultTime);
              } catch (e) { /* ignore */ }
              return;
            }
            if (cls.includes('edit')) {
              // basic edit: change fullname via prompt
              const current = tr && tr.children[2] ? tr.children[2].textContent.trim() : '';
              const name = prompt('Edit fullname:', current);
              if (!name) return;
              // naive DOM update for immediate feedback
              try { if (tr && tr.children[2]) tr.children[2].textContent = name; } catch (e) { }
              // update cached store if available
              if (id) {
                try {
                  const mod2 = await import('./attendanceStore.js');
                  const store2 = mod2.default;
                  // try to update in cache directly
                  const rows = store2.getTodayRows().concat(store2.getRecent ? store2.getRecent(200) : []);
                  const row = rows.find(r => Number(r.id) === id);
                  if (row) { row.student_fullname = name; if (typeof store2._internals === 'function') { store2._internals(); } }
                } catch (e) { /* ignore */ }
              }
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

    // hide on any click outside
    document.addEventListener('click', (ev) => {
      if (!rMenu) return;
      if (ev.target.closest && ev.target.closest('#R-clk-menu')) return;
      hideRMenu();
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') hideRMenu();
    });
  });
})();


