const { exit } = require('node:process')
const {Worker, isMainThread, parentPort, workerData} = require('node:worker_threads')

if (isMainThread) {

    class CameraCapture {
        constructor(options) {
            this._worker = undefined
            this._evMsg = undefined
            this._evErr = undefined
            this._errEmited = false
            this._terminating = false

            const worker = new Worker(__filename, {
                workerData: options,
            })
            this._worker = worker

            worker.on('message', (data) => {
                if (!this._terminating) {
                    if (this._evMsg) {
                        this._evMsg(data)
                    }  else {
                        // nothing
                    }
                }
            })

            worker.on('messageerror', (err) => {
                if (!this._terminating) {
                    if (this._evErr) {
                        this._evErr(err)
                    } else {
                        // nothing
                    }
                }
            })
            worker.on('error', (err)=> {
                if (!this._terminating) {
                    if (this._evErr) {
                        this._errEmited = true
                        this._evErr(err)
                    } else {
                        // nothing
                    }
                }
            })
            worker.on('exit', (code)=> {
                console.log(`CameraCapture exit ${code}`)
                if (!this._terminating) {
                    if (code != 0) {
                        if (this._evErr && !this._errEmited) {
                            this._evErr(new Error(`CameraCapture's Worker stopped with exit code ${code}`))
                        } else {
                            // nothing
                        }
                    }
                }
            })
        }

        on(ev, callback) {
            if (ev == 'msg') {
                this._evMsg = callback
            } else if (ev == "err") {
                this._evErr = callback
            }
        }

        terminate() {
            this._terminating = true
            return this._worker.terminate()
        }
    }

    function startCameraCapture(options) {
        const capture = new CameraCapture(options)
        return capture
    }

    module.exports = {
        startCameraCapture: startCameraCapture
    }
} else {
    let options = workerData
    console.log(options)
    let videoUrl = options.videoUrl
    let detectInterval = options.detectInterval
    let checkDuration = detectInterval
    let minKeepPaperTime = options.minKeepPaperTime
    let continuousMode = options.continuousMode 
    
    const cv = require('opencv4nodejs');
    let cap = new cv.VideoCapture(videoUrl)
    let fps = cap.get(cv.CAP_PROP_FPS)
    let bufferSize = Math.ceil(checkDuration * fps / 1000)
    console.log("fps = ", fps)
    console.log("bufferSize = ", bufferSize)

    let buffer = []

    function readFunc() {
        cap.readAsync().then((mat)=> {
            //console.log("read")
            if (mat.empty) {
                throw new Error("CameraCapture read empty")
            }

            let len = buffer.push(mat)
            if (len > bufferSize) {
                buffer.shift()
            }

            readFunc()
        }).catch(err=> {
            throw err
        })
    }
    readFunc()

    function checkRect() {
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
            //src.drawContours([largeContuors.getPoints()], -1, new cv.Vec3(0, 0, 180), 2)
            
            let approx = largeContuors.approxPolyDPContour(largeContuors.arcLength(true)*0.02, true)
            console.log(approx)
            console.log(approx.getPoints())

            if (approx.getPoints().length == 4 && Math.abs(approx.area) > 1000 && approx.isConvex) {
                let rect = approx.boundingRect()
                let rectArea = rect.width *rect.height
                let rate = (Math.abs(rectArea - approx.area) / rectArea)
                console.log("rate: ", rate)
                if (rate < 0.2) {
                    src.drawContours([largeContuors.getPoints()], -1, new cv.Vec3(0, 0, 180), 2)
                    //cv.imshowWait("hello", src)
                    return true
                }
            }
        }

        //cv.imshowWait("hello", src)
        return false
    }

    function checkStable() {
        const threshold = 10

        let stable = true
        let lastMat = buffer[buffer.length-1]
        lastMat = lastMat.bgrToGray()
        for (let i = 0; i < buffer.length; i++) {
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

    function stableAndHasRect() {
        if (!checkRect()) {
            return false
        }
        return checkStable()
    }

    let state = "wait_paper"   // wait_paper <-> keep_paper -> captured -> wait_paper
    let keepCounter = 0

    setInterval(() => {
        if (buffer.length < bufferSize) {
            return
        }

        if (state == 'wait_paper') {
            if (stableAndHasRect()) {
                state = "keep_paper"
                keepCounter = 0
            }
        } else if (state == "keep_paper") {
            if (!stableAndHasRect()) {
                state = "wait_paper"
            } else {
                keepCounter++
                if (keepCounter*detectInterval >= minKeepPaperTime) {
                    let lastMat = buffer[buffer.length-1]
                    let imgPng = cv.imencode('.png', lastMat)
                    //let b64 = "data:image/png;base64," + imgPng.toString('base64url')
                    parentPort.postMessage({
                        msg: "captured",
                        //base64: b64,
                        base64: "abc",
                    })
                    state = "captured"
                }
            }
        } else if (state == "captured") {
            if (continuousMode) {
                if (!stableAndHasRect()) {
                    state = "wait_paper"
                }
            } else {
                exit(0)
            }
        }

    }, detectInterval)
}


