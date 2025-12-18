@echo off
chcp 65001 >nul
echo ========================================
echo    Tandem Server 一键启动脚本
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [信息] Node.js 版本:
node --version
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [信息] 首次运行，正在安装依赖包...
    echo [信息] 这可能需要几分钟，请稍候...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo.
    echo [成功] 依赖安装完成！
    echo.
) else (
    echo [信息] 依赖包已安装
    echo.
)

REM 检查 .env 文件是否存在
if not exist ".env" (
    echo [警告] 未找到 .env 配置文件
    echo [提示] 请根据 README.md 创建 .env 文件并配置数据库连接
    echo.
)

echo [信息] 正在启动服务器...
echo [提示] 按 Ctrl+C 可停止服务器
echo ========================================
echo.

npm start

pause
