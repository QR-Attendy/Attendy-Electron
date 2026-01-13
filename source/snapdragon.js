import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import Store from "electron-store";
import { execFile } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const store = new Store();

let PyAttendy;

let startedWin;
let dashboardWin;
let settingsWin;
let supportWin;

// -------------------------------------
// Backend Launchers
// -------------------------------------
function AttendyEngine() {
  if (isDev) {
    // during development — spawn the Python script directly
    PyAttendy = spawn('python', [path.join(__dirname, '../main/pyAttendy/attendy_engine.py')]);
  } else {
    // in production / packaged mode — run bundled Python executable
    const exePath = path.join(process.resourcesPath, 'atom', 'attendy_engine.exe');
    PyAttendy = execFile(exePath);
  }

  PyAttendy.stdout.on("data", data =>
    console.log("Python log -", data.toString())
  );

  PyAttendy.stderr.on("data", data =>
    console.error("Python log -", data.toString())
  );

  console.log("Flask Attendy Edition backend started!!");
}

// -------------------------------------
// Controllers
// -------------------------------------
ipcMain.on("window-control", (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  switch (action) {
    case "minimize": win.minimize(); break;
    case "maximize": win.isMaximized() ? win.unmaximize() : win.maximize(); break;
    case "close": win.close(); break;
    default: console.warn("Unknown action:", action);
  }

  if (win.isMaximized()) win.send("window-control-signal");
});
// -------------------------------------
// WINDOWS
//-------------------------------------
//Started Windows
function startedWindow() {
  startedWin = new BrowserWindow({
    resizable: false,
    width: 500,
    height: 650,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "../source/load.js"),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  startedWin.loadFile(path.join(__dirname, "../main/start.html"));

  startedWin.once('ready-to-show', () => {
    startedWin.show();
  });

  startedWin.on("closed", () => {
    startedWin = null;
  });

}
//Dashboard Window
function dashboardWindow() {
  dashboardWin = new BrowserWindow({
    width: 900,
    height: 900,
    minHeight: 650,
    minWidth: 850,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "../source/load.js"),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  dashboardWin.loadFile(path.join(__dirname, "../main/dash.html"));

  dashboardWin.once('ready-to-show', () => {
    dashboardWin.show();
  });
  dashboardWin.on("closed", () => {
    dashboardWin = null;
  });
}

// -------------------------------------
// APP BOOT
// -------------------------------------
app.whenReady().then(() => {
  AttendyEngine();

  const currentUser = store.get("currentUser");
  currentUser ? dashboardWindow() : startedWindow();
});

// -------------------------------------
// Session IPC
// -------------------------------------
ipcMain.handle("save-session", (_, user) => {
  store.set("currentUser", user);
});

ipcMain.handle("get-session", () => {
  return store.get("currentUser");
});

ipcMain.handle("logout", () => {
  store.delete("currentUser");

  if (dashboardWin) dashboardWin.close();
  startedWindow();
});

ipcMain.on("open-dashboard", () => {
  if (startedWin) startedWin.close();
  dashboardWindow();
});

ipcMain.on("setting", () => {
  settingWindow()
  if (settingsWin) {
    settingsWin.focus();
    return;
  }
});

ipcMain.on("support", () => {
  supportWindow()
  if (supportWin) {
    supportWin.focus();
    return;
  }
});

// -------------------------------------
// Cleanup on quit
// -------------------------------------
app.on("before-quit", () => {
  if (PyAttendy) PyAttendy.kill();
});
