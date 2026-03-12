const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

// Force consistent app name BEFORE any getPath() call so that both
// `npm run dev` and the packaged .exe write to the same folder:
//   Windows: %APPDATA%\Roaming\FocusBoard\
app.setName('FocusBoard')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Data file path — always %APPDATA%\Roaming\FocusBoard\focusboard-data.json
const dataDir  = app.getPath('userData')
const dataFile = path.join(dataDir, 'focusboard-data.json')

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
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
