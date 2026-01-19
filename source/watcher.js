// For development only
// Uncomment the following codes to enable auto refresh on file changes

import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';

export function watchRenderer(paths) {
  const watcher = chokidar.watch(paths, { ignoreInitial: true });

  watcher.on('change', () => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.reloadIgnoringCache();
    });
  });
}
