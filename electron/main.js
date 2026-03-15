const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

app.setName('FocusBoard')

// isDev can be read before app.ready via app.isPackaged
const isDev = !app.isPackaged

// ── Data directory — shared between dev and packaged so the same JSON file
//    is used regardless of how you launch the app.
const sharedDataDir = path.join(app.getPath('appData'), 'FocusBoard')
const dataFile = path.join(sharedDataDir, 'focusboard-data.json')

// ── Chromium cache (GPU shaders, network cache, etc.) — kept SEPARATE per
//    mode so dev and packaged can run at the same time without the
//    "Unable to move the cache: Access is denied" GPU disk-cache error.
if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), 'FocusBoard-dev'))
}

if (!fs.existsSync(sharedDataDir)) {
  fs.mkdirSync(sharedDataDir, { recursive: true })
}

function createWindow() {
  // Resolve icon — .ico/.png supported; SVG is not a valid window icon
  const iconCandidates = [
    path.join(__dirname, '../public/icon.ico'),
    path.join(__dirname, '../public/icon.png'),
  ]
  const icon = iconCandidates.find(fs.existsSync)

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f13',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Remove menu bar
  win.setMenuBarVisibility(false)
}

// IPC handlers for file-based persistence
ipcMain.handle('store:read', () => {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8')
      return JSON.parse(raw)
    }
    return null
  } catch (err) {
    console.error('Failed to read data file:', err)
    return null
  }
})

ipcMain.handle('store:write', (_event, data) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to write data file:', err)
    return false
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
