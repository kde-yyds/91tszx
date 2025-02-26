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

// 打开默认浏览器并跳转
contextBridge.exposeInMainWorld('electron_', {
  link2browser: (url) => {
    shell.openExternal(url)
  },
})
