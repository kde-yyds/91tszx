const { remote, ipcRenderer, contextBridge, shell } = require('electron')

// console.log(electron)
window.onkeydown = function (evt) {
  // F5
  if (evt.keyCode === 116) {
    ipcRenderer.send('reload')
    // remote.getCurrentWindow().reload()
  }
  // F12
  if (evt.keyCode === 123) {
    ipcRenderer.send('openDevtools')
    // remote.getCurrentWebContents().openDevTools()
  }
}

contextBridge.exposeInMainWorld('electron_', {
  // 打开默认浏览器并跳转
  link2browser: (url) => {
    shell.openExternal(url)
  },
  // 设置关闭时是否要弹窗
  setCloseDialog: (bl) => {
    ipcRenderer.invoke('setCloseDialog', bl)
  },
})

ipcRenderer.on(
  'CameraCapture:capturedCallback',
  (event, cameraCaptureId, msg) => {
    if (window.CameraCapture_capturedCallbacks) {
      if (msg.type == 'exit') {
        delete window.CameraCapture_capturedCallbacks[cameraCaptureId]
      } else {
        const callback = window.CameraCapture_capturedCallbacks[cameraCaptureId]
        if (callback) {
          let errCb = undefined
          let msgCb = undefined
          if (msg.type == 'err') {
            errCb = msg.data ?? ''
          } else {
            msgCb = msg
          }
          callback(errCb, msgCb)
        }
      }
    }
  }
)

contextBridge.exposeInMainWorld('CameraCapture', {
  open: async (options, callback) => {
    if (!window.CameraCapture_capturedCallbacks) {
      window.CameraCapture_capturedCallbacks = {}
    }
    let cameraCaptureId = await ipcRenderer.invoke(
      'CameraCapture:openCameraCapture',
      options
    )
    window.CameraCapture_capturedCallbacks[cameraCaptureId] = callback
    return cameraCaptureId
  },

  close: (cameraCaptureId) => {
    if (window.CameraCapture_capturedCallbacks) {
      delete window.CameraCapture_capturedCallbacks[cameraCaptureId]
      ipcRenderer.invoke('CameraCapture:closeCameraCapture', cameraCaptureId)
    }
  },
})
