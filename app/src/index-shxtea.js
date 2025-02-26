const {
  app,
  BrowserWindow,
  Menu,
  screen,
  ipcMain,
  dialog,
} = require('electron')
let win = null
let closeDialogTxt = '是否退出系统'

// app.setName('驰声听说在线自适应学习平台')
Menu.setApplicationMenu(null)

app.commandLine.appendSwitch('ignore-certificate-errors')

{
  // 设置CameraCapture ipcMain监听
  const {
    openCameraCapture,
    closeCameraCapture,
  } = require('./scripts/shxtea/camera_capture_1.js')

  ipcMain.handle('CameraCapture:openCameraCapture', async (event, options) => {
    let needCallback = true
    event.sender.once('destroyed', () => {
      needCallback = false
    })
    let cameraCaptureId = openCameraCapture(options, (msg) => {
      if (needCallback) {
        event.sender.send(
          'CameraCapture:capturedCallback',
          cameraCaptureId,
          msg
        )
      }
    })
    return cameraCaptureId
  })

  ipcMain.handle(
    'CameraCapture:closeCameraCapture',
    async (event, cameraCaptureId) => {
      closeCameraCapture(cameraCaptureId)
    }
  )

  ipcMain.handle('setCloseDialog', async (event, bl) => {
    closeDialogTxt = bl ?'退出本次高拍仪批改？\n退出后已批改学生记录将不会被保存。' : '是否退出系统'
  })
}

function createWindow() {
  const _bounds = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    title: '善学老师客户端',
    icon: __dirname + '/shxtea_small.ico',
    ..._bounds,
    // resizable: false,
    webPreferences: {
      partition: String(+new Date()),
      enableRemoteModule: true, // 默认是关闭的
      nodeIntegration: true, // 为了在渲染进程中使用 Node.js API
      preload: __dirname + '/scripts/shxtea/preload.js',
    },
  })

  win.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault()
  })
  // win.loadURL('https://shxteav2.91ustudy.com/login')
  // win.loadURL('https://shxtea.91ustudy.com/login') // 正式环境 善学 老师端
  // win.loadURL('https://preshxtea.91ustudy.com/login') // 灰度环境 善学 老师端
  win.loadURL('https://ysxnteaf.chivoxapp.com/login') // 测试环境 善学 老师端
  // win.webContents.openDevTools()
  win.on('close', (e) => {
      e.preventDefault()
      dialog
        .showMessageBox({
          type: 'info',
          title: '温馨提示',
          message: closeDialogTxt,
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
