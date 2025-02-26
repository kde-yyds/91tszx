const { app, BrowserWindow, Menu, screen } = require('electron')
let win = null

// app.setName('驰声听说在线自适应学习平台')
// Menu.setApplicationMenu(null)

function createWindow() {
  const _bounds = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    title: '驰声听说在线自适应学习平台',
    icon: __dirname + '/icon.ico',
    ..._bounds,
    // resizable: false,
    webPreferences: {
      enableRemoteModule: true, // 默认是关闭的
      nodeIntegration: true, // 为了在渲染进程中使用 Node.js API
      preload: __dirname + '/scripts/reload.js',
    },
  })

  win.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault()
  })
  // win.loadURL('https://prezy.91tszx.com/login') // 灰度
  // win.loadURL('https://prezy2.91tszx.com/login') // 灰度2
  win.loadURL('https://kmzyfcloud.chivox.com/login') // 测试环境
  // win.loadURL('https://91tszx.com/login') // 正式环境
  // win.webContents.openDevTools()
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
