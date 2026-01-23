const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, 'img/icon-512.png'),
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // Optional, good for security
        },
        backgroundColor: '#0a0a0f', // Match app theme
        autoHideMenuBar: true // Modern look
    });

    mainWindow.loadFile('index.html');

    // Optional: Open DevTools in dev mode
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
