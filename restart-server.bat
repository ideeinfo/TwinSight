@echo off
echo Stopping process on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Killing PID: %%a
    taskkill /F /PID %%a
)
echo.
echo Port 3001 is now free
echo.
echo Starting server...
cd server
npm run dev
