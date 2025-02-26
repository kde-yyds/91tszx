const cv = require('opencv4nodejs')
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const tempPath = app.getPath('temp')

let tempCaptureFileCounter = 0
function generateTempCaptureFilePath(prefix, dotExt) {
    tempCaptureFileCounter++
    let filePath = path.join(tempPath, prefix + "_" + Date.now().toString(36) + "_" + tempCaptureFileCounter.toString(36) + "_" + Math.random().toString(36).substring(2) + dotExt)
    return filePath
}

function checkRect(buffer) {
    let src = buffer[buffer.length-1]
    let rows = src.rows
    let cols = src.cols

    let mat = src
    mat = cv.medianBlur(mat, 9)
    mat = mat.bgrToGray()

    let k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5,5))
    mat = mat.dilate(k)
    mat = mat.canny(150, 200)
    mat = mat.dilate(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3,3)))

    let contours = mat.findContours(cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE)
    if (contours.length > 0) {
        let largeContuors = contours.sort((c0, c1) => c1.area - c0.area)[0];
        //src.drawContours([largeContuors.getPoints()], -1, new cv.Vec3(0, 0, 180), 1)
        
        let approx = largeContuors.approxPolyDPContour(largeContuors.arcLength(true)*0.02, true)
        //console.log(approx)
        //console.log(approx.getPoints())

        if (approx.getPoints().length == 4 && Math.abs(approx.area) > 1000 && approx.isConvex) {
            let rect = approx.boundingRect()
            let rectArea = rect.width *rect.height
            let rate = (Math.abs(rectArea - approx.area) / rectArea)
            console.log("rate: ", rate)
            if (rate < 0.2) {
                src.drawContours([largeContuors.getPoints()], -1, new cv.Vec3(0, 0, 180), 1)
                //cv.imshowWait("hello", src)
                return true
            }
        }
    }

    //cv.imshowWait("hello", src)
    return false
}

function checkStable(buffer) {
    const threshold = 10

    let stable = true
    let lastMat = buffer[buffer.length-1]
    lastMat = lastMat.bgrToGray()
    for (let i = 0; /*i < buffer.length*/ i < 1; i++) {
        let mat = buffer[i]
        mat = mat.bgrToGray()
        //console.log(mat)
        let diff = mat.absdiff(lastMat)
        let m = diff.mean()
        let m0 = m.at(0)
        //console.log("m0: ", m0)
        if (m0 > threshold) {
            stable = false
            break
        }
    }
    //console.log("stable: ", stable)
    return stable
}

function stableAndHasRect(buffer) {
    if (!checkRect(buffer)) {
        return false
    }
    return checkStable(buffer)
}

let GlobalMaps = {}
let GlobalIdCounter = 0

function generateCameraCaptureId() {
    GlobalIdCounter++
    return Date.now().toString(36) + Math.random().toString(36).substring(1) + "." + GlobalIdCounter.toString(36)
}

class CameraCapture2 {
    constructor(id, options, callback) {
        this._id = id
        this._callback = callback
        this._closing = false
        this._cap = undefined
        this._intervalId = undefined

        GlobalMaps[id] = this
        this._start(options)
    }

    _start(options) {
        console.log(options)
        let detectInterval = options.detectInterval
        let checkDuration = detectInterval
        let minKeepPaperTime = options.minKeepPaperTime
        let continuousMode = options.continuousMode 
        
        let cap = new cv.VideoCapture(options.videoUrl)
        let fps = cap.get(cv.CAP_PROP_FPS)
        let bufferSize = Math.ceil(checkDuration * fps / 1000)
        console.log("fps = ", fps)
        console.log("bufferSize = ", bufferSize)
        this._cap = cap

        let buffer = []
        let readFunc = () => {
            if (this._closing) {
                return
            }

            if (this._cap) {
                this._cap.readAsync().then((mat)=> {
                    if (mat.empty) {
                        this._emit(new Error("CameraCapture read empty"), undefined)
                        return
                    }
    
                    let len = buffer.push(mat)
                    if (len > bufferSize) {
                        buffer.shift()
                    }
    
                    readFunc()
                }).catch(err=> {
                    this._emit(err, undefined)
                })
            }
        }
        readFunc()

        let state = "wait_paper"   // wait_paper <-> keep_paper -> captured -> wait_paper
        let keepCounter = 0

        let that = this

        this._intervalId = setInterval(() => {
            if (buffer.length < bufferSize) {
                return
            }

            if (state == 'wait_paper') {
                if (stableAndHasRect(buffer)) {
                    state = "keep_paper"
                    keepCounter = 0
                }
            } else if (state == "keep_paper") {
                if (!stableAndHasRect(buffer)) {
                    state = "wait_paper"
                } else {
                    keepCounter++
                    if (keepCounter*detectInterval >= minKeepPaperTime) {
                        let lastMat = buffer[buffer.length-1]
                        const saveFile = generateTempCaptureFilePath("captured", ".png")
                        cv.imwriteAsync(saveFile, lastMat).then(()=>{
                            fs.readFile(saveFile, (err, data) => {
                                if (err) {
                                    // TODO  emitError
                                } else {
                                    let b64 = "data:image/png;base64," + data.toString('base64')
                                    console.log("emit b64")
                                    that._emit(undefined, {
                                        msg: "captured",
                                        base64: b64,
                                    })
                                }
                            })
                        }).catch(err=>{
                            // TODO emitError
                        })
                        state = "captured"
                    }
                }
            } else if (state == "captured") {
                if (continuousMode) {
                    if (!stableAndHasRect(buffer)) {
                        state = "wait_paper"
                    }
                } else {
                    this.close()
                }
            }

        }, detectInterval)
    }

    close() {
        if (!this._closing) {
            this._closing = true

            let id = this.id
            delete GlobalMaps[id]

            if (this._cap) {
                this._cap.release()
                this._cap = undefined
            }

            if (this._intervalId) {
                clearInterval(this._intervalId)
                this._intervalId = undefined
            }
        }
    }

    _emit(err, data) {
        if (this._callback) {
            if (!this._closing) {
                this._callback(err, data)
            }
        }

        if (err) {
            this.close()
        }
    }
}

function startCameraCapture(options, callback) {
    let id = generateCameraCaptureId()
    let cap = new CameraCapture2(id, options, callback)
    return id
}

function closeCameraCapture(id) {
    let cap = GlobalMaps[id]
    if (cap) {
        cap.close()
    }
}

exports.startCameraCapture = startCameraCapture
exports.closeCameraCapture = closeCameraCapture