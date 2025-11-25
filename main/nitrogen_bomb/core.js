const { app, BrowserWindow, ipcMain, globalShortcut, ipcRenderer } = require("electron");

//path finder specifically for main folder since we use a custom 
const path = require('path');


// FOR WINDOWS 
let startedMain;
let dashboardMain;

// If the Tool is under Development
const Dev = process.env.NODE_ENV !== 'development';
const electronReload = require('electron-reload');
electronReload(__dirname); // Watches the current directory for changes 

//============================================//
// App behaviors

//If the app is ready then the Started Windows will launch 
// This will change later (Function if The user is Already signed or created a profile then automatically proceed to dashboard window)
app.whenReady().then(() => {
  dashboardWindow();
});


// 'activate' event (mostly used on macOS):
// Triggered when the user reopens the app from the Dock.
// Electron apps should recreate a window if all windows are closed.
// This ensures the app behaves like a normal macOS application. 
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    dashboardWindow()
  }
})

//+++++ FOR TITLE BAR BEHAVIOR BASED ON NITROGEN ENGINE +++++//
// IPC (Inter-Process Communication) handlers for window control

ipcMain.on('window-control', (event, action) => {
  // get the BrowserWindow that sent the IPC
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  switch (action) {
    case 'minimize':
      win.minimize();
      break;
    case 'maximize':
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      break;
    case 'close':
      win.close();
      break;
    default:
      console.warn('Unknown window action:', action);
  }

  if (win.isMaximized()) win.send('window-control-signal');

});
//============================================//

//====================================================================//
//For Creating windows'


function startedWindow() {
  startedMain = new BrowserWindow({
    title: 'attendy tst',
    width: 500,
    height: 650,
    titleBarStyle: 'hidden', //Hide default window frame
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../nitrogen_bomb/preload.js"),
      contextIsolation: true,
      nodeIntegration: false

    }
  });

  //Development here
  if (Dev) {
    startedMain.webContents.openDevTools();
  }
  // End of Development here

  //load the Main file
  startedMain.loadFile(path.join(__dirname, '../package/started.html'));

  // Event handler for when the main window is closed
  startedMain.on("closed", () => {
    startedMain = null;
  });
}

function dashboardWindow() {
  dashboardMain = new BrowserWindow({
    titleBarStyle: 'hidden', //Hide default window frame
    width: 900,
    height: 900,
    minHeight: 750,
    minWidth: 900,
    webPreferences: {
      preload: path.join(__dirname, "../nitrogen_bomb/preload.js"), // Load preload script
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  dashboardMain.loadFile(path.join(__dirname, '../package/dashboard/index.html'));
  // Load your second HTML file

  //Development here
  if (Dev) {
    dashboardMain.webContents.openDevTools();
  }
  // End of Development here

  // Close the main window after the second window is created
  if (startedMain) {
    startedMain.close();
    startedMain = null; // Clear the reference
  }
}
//====================================================================//