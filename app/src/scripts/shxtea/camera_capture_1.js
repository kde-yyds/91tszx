const { utilityProcess, app } = require('electron')
const path = require('path')

const tempPath = app.getPath('temp')

const idMap = {}
let idCounter = 0

function generateId() {
    idCounter++
    return Date.now().toString(36) + "." + idCounter.toString(36) + Math.random().toString(36).substring(1)
}

function openCameraCapture(options, callback) {
    let id = generateId()
    const child = utilityProcess.fork(path.join(__dirname, "camera_capture_process.js"))
    idMap[id] = child

    child.once('exit', code=>{
        delete idMap[id]
        if (callback) {
            callback({type: 'exit'})
        }
    })
    child.on('message', msg=> {
        if (callback) {
            callback(msg)
        }
    })

    options._tempPath = tempPath
    child.postMessage({type: "start", data: options})
    return id
}

function closeCameraCapture(id) {
    const child = idMap[id]
    if (child) {
        child.postMessage({type:"exit"})
    }
}

exports.openCameraCapture = openCameraCapture
exports.closeCameraCapture = closeCameraCapture

