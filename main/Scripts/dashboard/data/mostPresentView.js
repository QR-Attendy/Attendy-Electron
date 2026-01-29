import attendanceStore from './attendanceStore.js';

let _lastFingerprint = '';

export function renderMostPresent(section = null, limit = 10) {
  const tbody = document.getElementById('most-present-tbody');
  if (!tbody) return;
  // request the full aggregated list (no artificial renderer-side limit)
  const list = attendanceStore.getMostPresent ? attendanceStore.getMostPresent(Number.MAX_SAFE_INTEGER) : [];

  // if section filter provided, build a map of student key -> section from recent/today rows
  let allowedKeys = null;
  if (section && section !== 'all') {
    allowedKeys = new Set();
    const recent = attendanceStore.getRecent ? attendanceStore.getRecent(500) : [];
    const today = attendanceStore.getTodayRows ? attendanceStore.getTodayRows() : [];
    const allRows = recent.concat(today);
    const secLower = String(section || '').toLowerCase();
    for (const r of allRows) {
      const sec = (r.student_section || r.section || r.section_name || '').toString().trim().toLowerCase();
      if (sec === secLower) {
        const key = ((r.student_username || r.student_fullname) || '').toString().trim().toLowerCase();
        if (key) allowedKeys.add(key);
      }
    }
  }

  // apply section filter if present
  let filtered = (allowedKeys) ? list.filter(it => allowedKeys.has(it.key)) : list;

  // Ensure manually-added / newly-seen students (from today/recent rows) are included
  // if they match the section filter but are not yet in the most-present aggregation.
  const existingKeys = new Set(filtered.map(it => (it.key || '').toString().trim().toLowerCase()));
  const recent = attendanceStore.getRecent ? attendanceStore.getRecent(5000) : [];
  const today = attendanceStore.getTodayRows ? attendanceStore.getTodayRows() : [];
  const combined = recent.concat(today);
  for (const r of combined) {
    const key = ((r.student_username || r.student_fullname) || '').toString().trim().toLowerCase();
    if (!key) continue;
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (existingKeys.has(key)) continue;
    // only include if the row indicates present/late (treat 'late' as present)
    const s = (r.status || '').toString().toLowerCase();
    if (s === 'present' || s === 'late') {
      const name = r.student_fullname || r.student_username || key;
      filtered.push({ key, name, days: 1 });
      existingKeys.add(key);
    }
  }

  // sort by days desc and keep all results (no renderer-side limit)
  filtered.sort((a, b) => (b.days || 0) - (a.days || 0));

  // normalize fingerprint source using full filtered list
  const parts = filtered.map(it => `${(it.key || '').toString().trim().toLowerCase()}|${it.days}`);
  const fp = parts.join('\n');
  if (fp === _lastFingerprint) return;
  _lastFingerprint = fp;

  const html = filtered.map(item => `<tr data-student-key="${item.key}"><td>${item.name}</td><td>${item.days}</td></tr>`).join('');
  tbody.innerHTML = html;
}

export default { renderMostPresent };
