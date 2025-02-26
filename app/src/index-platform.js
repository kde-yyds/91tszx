const { app, BrowserWindow, Menu, screen, ipcMain } = require('electron')
let win = null

// app.setName('驰声听说在线自适应学习平台')
Menu.setApplicationMenu(null)

app.commandLine.appendSwitch('ignore-certificate-errors')

function createWindow() {
  const _bounds = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    title: '善学平台',
    icon: __dirname + '/icon.ico',
    ..._bounds,
    // resizable: false,
    webPreferences: {
      contextIsolation: true,
      enableRemoteModule: true, // 默认是关闭的
      nodeIntegration: true, // 为了在渲染进程中使用 Node.js API
      preload: __dirname + '/scripts/reload.js',
    },
  })

  win.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault()
  })
  // 登录页面url参数
  win.loadURL('https://shxtea.91ustudy.com/static/page/platform.html') // 正式环境 善学 平台页面
  win.webContents.openDevTools()

  ipcMain.on('reload', (event, arg) => {
    win.webContents.reload()
  })
  ipcMain.on('openDevtools', (event, arg) => {
    win.webContents.openDevTools()
  })
}

if (require('electron-squirrel-startup')) return app.quit()

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时,将会聚焦到myWindow这个窗口
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      }
      win.focus()
    }
  })

  app.whenReady().then(createWindow)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}
