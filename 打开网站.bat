@echo off
chcp 936 >nul
rem ============================================================
rem  日本語ラボ · 简易启动器
rem  双击本文件：启动本地静态服务器，并自动用默认浏览器打开网站。
rem  关掉这个黑窗口 = 停止服务器。
rem  没装 Python 时，会自动改为打开在线版（GitHub Pages）。
rem ============================================================
setlocal
cd /d "%~dp0"
title 日本語ラボ - 本地预览

rem --- 找一个可用的 Python（优先 py -3，其次 python） ---
set "PYCMD="
py -3 -c "import sys" >nul 2>nul && set "PYCMD=py -3"
if not defined PYCMD (
  python -c "import sys" >nul 2>nul && set "PYCMD=python"
)
if not defined PYCMD goto :online

echo.
echo   正在启动本地服务器，浏览器会自动打开...
echo   （端口被占用会自动往后找一个；关掉本窗口即停止）
echo.
%PYCMD% tools\serve.py --open
goto :end

:online
echo.
echo   没有找到 Python，改为打开在线版：
echo   https://free7912.github.io/nihongo-lab/
echo.
start "" "https://free7912.github.io/nihongo-lab/"
echo   按任意键关闭本窗口...
pause >nul

:end
endlocal
