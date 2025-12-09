//This file will expose 99% of the unforgiven sins we might commit in the renderer process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  windowControl: (action) => ipcRenderer.send('window-control', action),
});

contextBridge.exposeInMainWorld("attendyAPI", {
  // Session Management
  saveSession: (user) => ipcRenderer.invoke("save-session", user),
  getSession: () => ipcRenderer.invoke("get-session"),
  logout: () => ipcRenderer.invoke("logout"),
  openDashboard: () => ipcRenderer.send("open-dashboard"),
  // User setting/etc. Management
  opensetting: () => ipcRenderer.send("setting"),
  opensupport: () => ipcRenderer.send("support"),
  sendSupportMessage: (message) => ipcRenderer.invoke("send-support-message", message),


  // will Create user then we shiball the QR Generator at the dashboard
  async createUser(fullname, username, role) {
    const res = await fetch("http://localhost:5005/create_user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fullname, username, role })
    });

    return await res.json(); // returns user + QR base64
  },

  //QR Generation - automatic if user exists 
  async generateQR(data) {
    const res = await fetch("http://localhost:5005/generate_qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data) // fullname, username, role
    });

    return await res.json(); // returns { ok:true, data_url:"..." }
  },
  //this part will most likely blown up the Attendy Engine if not coded properly
  recordAttendance: (userData) => //specifically record ur balls lol.
    fetch("http://localhost:5005/record_attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    }).then(res => res.json()),

  // Bulk set time_out for attendance rows (ids: array, time_out: ISO string)
  setTimeoutForRows: (ids, time_out) =>
    fetch("http://localhost:5005/set_timeouts_bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, time_out })
    }).then(res => res.json()),

  // Set time_out for a single attendance row and optionally change status
  setTimeoutForRow: (id, time_out, status) =>
    fetch("http://localhost:5005/set_timeout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, time_out, status })
    }).then(res => res.json()),

  // Delete local user and associated records (testing cleanup)
  deleteUser: (username) =>
    fetch("http://localhost:5005/delete_user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    }).then(res => res.json()),

  // Delete a single attendance row by id
  deleteAttendanceRow: (id) =>
    fetch("http://localhost:5005/delete_attendance_row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    }).then(res => res.json()),

  updateAttendance: (id, status) => //update ur attendance status if you committed a sin?
    fetch("http://localhost:5005/update_attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    }).then(res => res.json()),
});
