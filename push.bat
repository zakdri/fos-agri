in@echo off
cd /d "%~dp0"
git add .
git commit -m "update"
git push
echo.
echo Done! Site updated at https://zakdri.github.io/fos-agri/
pause
