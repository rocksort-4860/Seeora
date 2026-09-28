@echo off
setlocal
chcp 936 >nul
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install Node.js LTS from nodejs.org first.
  pause
  exit /b 1
)
npx eas-cli --version >nul 2>nul
if errorlevel 1 (
  npm install -g eas-cli
)
npx eas-cli whoami >nul 2>nul
if errorlevel 1 (
  npx eas-cli login
)
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
echo Done. Check App Store Connect TestFlight.
pause
