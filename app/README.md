## jf - 听说在线机房版     
## stu - 听说在线学生客户端     
## tea - 听说在线老师客户端     
## platform - 善学 平台页面     
## shxtea - 善学老师端

#

#

# 简单方法  npm install后 把node_modules 解压覆盖

## Install opencv4nodejs

### 1. node 版本 14.21.0

### 2. 安装环境

#### 2.1 node-gyp

npm install -g node-gyp

#### 2.2 windows-build-tools

npm install --global --production windows-build-tools

#### 2.3 如果 windows-build-tools 一直无法完成（可能是 visual studio 下载问题） 则需要单独安装 visual studio 与 python

我安装的是
Python311 与 visual studio2017 BuildTools

### 3. set OPENCV4NODEJS_DISABLE_AUTOBUILD

设置环境变量， 设置环境变量后续操作不要切换窗口， 在同一窗口中执行

```bash
# linux and osx:
export OPENCV4NODEJS_DISABLE_AUTOBUILD=1
# on windows cmd:
set OPENCV4NODEJS_DISABLE_AUTOBUILD=1
# on windows powershell:
$env:OPENCV4NODEJS_DISABLE_AUTOBUILD=1
```

### 4. 安装 opencv

安装好后需要环境变量-系统变量中 新增三个变量 内容为 opencv 的安装目录
OPENCV_INCLUDE_DIR
OPENCV_BIN_DIR
OPENCV_LIB_DIR

eg:
OPENCV_INCLUDE_DIR
G:\opencv\opencv\build_origin\include

OPENCV_BIN_DIR
G:\opencv\opencv\build_origin\x64\vc15\bin

OPENCV_LIB_DIR
G:\opencv\opencv\build_origin\x64\vc15\lib

### 4. 安装 opencv4nodejs

```shell
npm install --save opencv4nodejs
```

### 5. 设置 opencv4nodejs 环境变量

同 3 两个变量
OPENCV4NODEJS_INCLUDES
OPENCV4NODEJS_LIBRARIES

example in Windows cmd:

```
set OPENCV4NODEJS_INCLUDES=G:/opencv/opencv/build_origin/include
set OPENCV4NODEJS_LIBRARIES=G:/opencv/opencv/build_origin/x64/vc15/lib/opencv_world450
```

### 6.第一次运行（例如 electron-forge start）会将 opencv4nodejs 打包

### 7.node_modules压缩包解压覆盖 （opencv4nodejs 里有opencv的库 可以使用户不用安装opencv）
