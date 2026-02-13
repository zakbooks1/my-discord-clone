const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Mini Discord",
    icon: __dirname + '/icon.ico', // You can add an icon later
    webPreferences: {
      nodeIntegration: false
    }
  });

  // CHANGE THIS to your actual Render URL
  win.loadURL('https://my-discord-clone-1.onrender.com'); 
  
  // Remove the top menu bar (File, Edit, etc.)
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});