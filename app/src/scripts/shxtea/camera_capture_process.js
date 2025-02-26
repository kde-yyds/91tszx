const cv = require('opencv4nodejs')
const fs = require('fs')
const path = require('path')

let tempPath = undefined

let capturedFileCounter = 0
function generateCapturedFilePath(prefix, dotExt) {
    capturedFileCounter++
    let filePath = path.join(tempPath, prefix + "_" + process.pid.toString(36) + "_" + Date.now().toString(36) + "_" + capturedFileCounter.toString(36) + "_" + Math.random().toString(36).substring(2) + dotExt)
    return filePath
}

function angle(pt1, pt2, pt0) {
    let dx1 = pt1.x - pt0.x
    let dy1 = pt1.y - pt0.y
    let dx2 = pt2.x - pt0.x
    let dy2 = pt2.y - pt0.y
    return (dx1*dx2 + dy1*dy2) / Math.sqrt((dx1*dx1 + dy1*dy1)*(dx2*dx2 + dy2*dy2) + 1e-10)
}

function checkRect(buffer) {
    let src = buffer[buffer.length-1]
    let rows = src.rows
    let cols = src.cols

    let mat = src

    mat = mat.bgrToGray()
    //cv.imshowWait("gray", mat)

    //cv.imshowWait("src", mat)
    mat = cv.medianBlur(mat, 9)
    //cv.imshowWait("medianBlur", mat)

    let factor = 480/cols
    if (factor < 1) {
        mat = mat.rescale(factor)
        let rows = mat.rows
        let cols = mat.cols
    }
    //cv.imshowWait("rescale", mat)

    //let matRGB = src
    //if (factor < 1) {
    //    matRGB = matRGB.rescale(factor)
    //    let rows = matRGB.rows
    //    let cols = matRGB.cols
    //}
    
    //mat = mat.dilate(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3,3)))
    //cv.imshowWait("dilate-1", mat)
    mat = mat.canny(150, 200)
    //cv.imshowWait("canny", mat)
    //mat = mat.dilate(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3,3)))

    let contours = mat.findContours(cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE)
    if (contours.length > 0) {
        let largeContuors = contours.sort((c0, c1) => c1.area - c0.area)[0];
        //matRGB.drawContours([largeContuors.getPoints()], -1, new cv.Vec3(0, 0, 255), 1)
        //cv.imshowWait("drawContours", matRGB)
        
        let approx = largeContuors.approxPolyDPContour(largeContuors.arcLength(true)*0.02, true)
        //console.log(approx)
        //console.log(approx.getPoints())

        if (approx.getPoints().length == 4 && Math.abs(approx.area) > 1000 && approx.isConvex) {
            if (true) {
                let points = approx.getPoints()

                let maxCosine = 0
                for (let j = 2; j < 5; j++) {
                    let cosine = Math.abs(angle(points[j%4], points[j-2], points[j-1]))
                    maxCosine = Math.max(maxCosine, cosine)
                }
                //console.log("maxCosine: ", maxCosine)
                if (maxCosine < 0.3) {
                    return true
                }

            } else {
                let rect = approx.minAreaRect()
                let rectArea = rect.size.width *rect.size.height
                let rate = (Math.abs(rectArea - approx.area) / rectArea)
                //console.log("rate: ", rate)
                if (rate < 0.12) {
                    //src.drawContours([largeContuors.getPoints()], -1, new cv.Vec3(0, 0, 180), 1)
                    //cv.imshowWait("hello", src)
                    return true
                }
            }
        } else {
            //console.log("contours: points.length != 4 or area <= 1000 or isConvex == false, " + "points.length == " + approx.getPoints().length)
        }
    } else {
        //console.log("contours.length == 0")
    }

    //cv.imshowWait("hello", src)
    return false
}

function checkStable(buffer) {
    //console.time("checkStable")
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
    //console.timeEnd("checkStable")
    return stable
}

// checkStable2只比较首、中、尾三张（为了性能考虑）
function checkStable2(buffer) {
    //console.time("checkStable2")
    const threshold = 10

    let stable = true
    let lastMat = buffer[buffer.length-1]
    lastMat = lastMat.bgrToGray()

    for (;;) {
        let mat = buffer[0]
        mat = mat.bgrToGray()
        let diff = mat.absdiff(lastMat)
        let m = diff.mean()
        let m0 = m.at(0)
        //console.log("m0: ", m0)
        if (m0 > threshold) {
            stable = false
            break
        }

        if (buffer.length > 2) {
            let mat = buffer[(buffer.length-1)/2]
            mat = mat.bgrToGray()
            let diff = mat.absdiff(lastMat)
            let m = diff.mean()
            let m0 = m.at(0)
            //console.log("m0: ", m0)
            if (m0 > threshold) {
                stable = false
                break
            }
        }

        break
    }

    //console.log("stable: ", stable)
    //console.timeEnd("checkStable2")
    return stable
}

// checkStable3 - 将图像二值化后比较
// 只比较首、中、尾三张（为了性能考虑）
function checkStable3(buffer) {
    //console.time("checkStable3")
    const threshold = 10

    let stable = true
    let lastMat = buffer[buffer.length-1]
    lastMat = lastMat.bgrToGray()
    //cv.imshowWait("last", lastMat)
    lastMat = lastMat.threshold(127, 255, cv.THRESH_OTSU)
    //cv.imshowWait("last-threshold", lastMat)

    for (;;) {
        let mat = buffer[0]
        mat = mat.bgrToGray()
        mat = mat.threshold(127, 255, cv.THRESH_OTSU)
        let diff = mat.absdiff(lastMat)
        let m = diff.mean()
        let m0 = m.at(0)
        //console.log("1-m0: ", m0)
        if (m0 > threshold) {
            //console.log("1-m0: ", m0)
            stable = false
            break
        }

        if (buffer.length > 2) {
            let mat = buffer[(buffer.length-1)/2]
            mat = mat.bgrToGray()
            mat = mat.threshold(127, 255, cv.THRESH_OTSU)
            let diff = mat.absdiff(lastMat)
            let m = diff.mean()
            let m0 = m.at(0)
            //console.log("2-m0: ", m0)
            if (m0 > threshold) {
                //console.log("2-m0: ", m0)
                stable = false
                break
            }
        }

        break
    }

    //console.log("stable: ", stable)
    //console.timeEnd("checkStable3")
    return stable
}

function stableAndHasRect(buffer, curveEpsilon) {
    if (!checkRect(buffer, curveEpsilon)) {
        //console.log("checkRect false")
        return false
    }
    //console.log("checkRect true")
    return checkStable3(buffer)
}

function start(options) {
    console.log("options: ", options)
    let {videoUrl, detectInterval, minKeepPaperTime, curveEpsilon, continuousMode, _tempPath} = options
    if (!detectInterval) { detectInterval = 200; }
    if (detectInterval > 600) { detectInterval = 600; }
    if (!minKeepPaperTime) { minKeepPaperTime = 600; }
    if (!curveEpsilon) { curveEpsilon = 0.02; }
    
    let checkDuration = detectInterval
    tempPath = _tempPath
    
    let cap = new cv.VideoCapture(videoUrl)
    let fps = cap.get(cv.CAP_PROP_FPS)
    let bufferSize = Math.ceil(checkDuration * fps / 1000)
    if (bufferSize < 2) { bufferSize = 2 }
    console.log(`fps: ${fps}, bufferSize: ${bufferSize}`)
    
    let buffer = []

    const readNext = () => {
        cap.readAsync().then((mat)=> {
            if (mat.empty) {
                process.parentPort.postMessage({
                    type: 'err',
                    data: "CameraCapture read empty"  
                })
                process.exit(-1)
            }

            let len = buffer.push(mat)
            if (len > bufferSize) {
                buffer.shift()
            }

            readNext()
        }).catch(err=> {
            process.parentPort.postMessage({
                type: 'err',
                data: err.toString()
            })
            process.exit(-1)
        })
    }

    readNext()

    let state = "wait_paper"   // wait_paper <-> keep_paper -> captured -> wait_paper
    let keepCounter = 0
    let emitedNoStablePaper = false

    const detectFunc = () => {
        if (buffer.length < bufferSize) {
            return
        }

        if (state == 'wait_paper') {
            // TODO 清空最后一次纸张稳定时的画面
            if (stableAndHasRect(buffer, curveEpsilon)) {
                // TODO 保存最后一次纸张稳定时的画面
                state = "keep_paper"
                keepCounter = 0
            }

            if (!emitedNoStablePaper) {
                emitedNoStablePaper = true

                let idx = 3
                if (idx > buffer.length-1) {
                    idx = buffer.length-1
                }
                let unstableMat = buffer[idx]
                const saveFile = generateCapturedFilePath("no_stable_paper", ".jpg")

                cv.imwriteAsync(saveFile, unstableMat).then(()=>{
                    fs.readFile(saveFile, (err, data) => {
                        if (err) {
                            process.parentPort.postMessage({
                                type: 'err',
                                data: err.toString()  
                            })
                        } else {
                            let b64 = "data:image/jpg;base64," + data.toString('base64')
                            process.parentPort.postMessage({
                                type: "no_stable_paper",
                                data: b64,
                            })
                        }

                        fs.rm(saveFile, ()=>{})
                    })
                }).catch(err=>{
                    process.parentPort.postMessage({
                        type: 'err',
                        data: err.toString()  
                    })
                })
            }

        } else if (state == "keep_paper") {
            if (!stableAndHasRect(buffer, curveEpsilon)) {
                state = "wait_paper"
            } else {
                // TODO 还要与最后一次纸张稳定时的画面再比较，做差值比较看是否变化就行了

                keepCounter++
                if (keepCounter*detectInterval >= minKeepPaperTime) {
                    console.log("captured")
                    let lastMat = buffer[buffer.length-1]
                    const saveFile = generateCapturedFilePath("captured", ".jpg")
                    cv.imwriteAsync(saveFile, lastMat).then(()=>{
                        fs.readFile(saveFile, (err, data) => {
                            if (err) {
                                process.parentPort.postMessage({
                                    type: 'err',
                                    data: err.toString()  
                                })
                            } else {
                                let b64 = "data:image/jpg;base64," + data.toString('base64')
                                process.parentPort.postMessage({
                                    type: "captured",
                                    data: b64,
                                })
                            }

                            fs.rm(saveFile, ()=>{})
                        })
                    }).catch(err=>{
                        process.parentPort.postMessage({
                            type: 'err',
                            data: err.toString()  
                        })
                    })

                    state = "captured"
                }
            }
        } else if (state == "captured") {
            if (continuousMode) {
                if (!stableAndHasRect(buffer, curveEpsilon)) {
                    emitedNoStablePaper = false
                    state = "wait_paper"
                }
            } else {
                process.exit(0)
            }
        }
    }

    setInterval(detectFunc, detectInterval)
}

let started = false

process.parentPort.on('message', (event) => {
    if (event.data.type == "start") {
        if (!started) {
            started = true
            start(event.data.data)
        }
    } else if (event.data.type == "exit") {
        process.exit(0)
    }
})


