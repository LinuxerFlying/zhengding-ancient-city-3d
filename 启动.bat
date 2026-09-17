@echo off
chcp 65001 >nul
title 畅游正定古城 3D
cd /d "%~dp0"

REM 若尚未安装依赖，则安装
if not exist "node_modules\three" (
  echo 首次启动，正在安装依赖，请稍候...
  call npm install
)

REM 重新打包（保证双击 index.html 也可直接运行）
echo 正在打包...
call npx --yes esbuild@0.20.2 js/main.js --bundle --format=iife --target=es2020 --outfile=dist/app.js

REM 启动本地服务并打开浏览器
start "" http://127.0.0.1:5173/
node server.cjs
pause
