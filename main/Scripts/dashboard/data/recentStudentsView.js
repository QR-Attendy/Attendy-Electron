import attendanceStore from './attendanceStore.js';

let _lastFingerprint = '';

export function renderRecentStudents(section = null, limit = 10) {
  const tbody = document.getElementById('recent-students-tbody');
  if (!tbody) return;
  // request a very large recent window so we effectively show all recent rows
  let rows = attendanceStore.getRecent ? attendanceStore.getRecent(1000000) : [];
  if (section && section !== 'all') {
    const secLower = String(section || '').toLowerCase();
    rows = rows.filter(r => {
      const sec = (r.student_section || r.section || r.section_name || '').toString().trim().toLowerCase();
      return sec === secLower;
    });
  }
  const parts = rows.map(r => `${r.id}|${r.student_fullname || ''}|${r.time_in || r.timestamp || ''}`);
  const fp = parts.join('\n');
  if (fp === _lastFingerprint) return;
  _lastFingerprint = fp;

  const html = rows.map(r => {
    const fullname = r.student_fullname || r.student_username || '';
    const section = r.student_section || '';
    const ts = r.time_in || r.timestamp || '';
    const timeDisplay = ts ? new Date(ts).toLocaleString() : '';
    return `<tr data-id="${r.id}"><td>${fullname}</td><td>${timeDisplay}</td><td>${section}</td></tr>`;
  }).join('');
  tbody.innerHTML = html;
}

export default { renderRecentStudents };
