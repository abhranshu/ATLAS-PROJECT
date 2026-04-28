@echo off
color 0c
echo ------------------------------------------
echo PREPARING ATLAS VIRTUAL EXPLOIT...
echo ------------------------------------------
cd atlas-backend
call venv\Scripts\activate.bat
python scripts\simulate_attack.py
pause
