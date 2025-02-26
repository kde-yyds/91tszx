const { app, BrowserWindow, Menu, screen, ipcMain, dialog } = require('electron')
let win = null

// app.setName('驰声听说在线自适应学习平台')
Menu.setApplicationMenu(null)

app.commandLine.appendSwitch('ignore-certificate-errors')

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
  // 登录页面url参数 exetype  没有表示机房版 1表示客户端版tszx
  win.loadURL('https://zy.inside.chivoxapp.com/login')
  // win.loadURL('https://prezy.91tszx.com/login') // 灰度
  // win.loadURL('https://yszyf.chivoxapp.com/login') // 测试环境
  // win.loadURL('https://91tszx.com/login') // 正式环境  机房版
  // win.webContents.openDevTools()

  ipcMain.on('reload', (event, arg) => {
    win.webContents.reload()
  })
  ipcMain.on('openDevtools', (event, arg) => {
    win.webContents.openDevTools()
  })
  win.on('close', (e) => {
    e.preventDefault()
    dialog
      .showMessageBox({
        type: 'info',
        title: '提醒',
        message: '确定关闭客户端吗？',
        buttons: ['确认', '取消'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((index) => {
        if (index.response === 0) {
          win = null
          app.exit()
        } else {
          e.preventDefault()
        }
      })
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
