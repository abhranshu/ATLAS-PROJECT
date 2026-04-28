@echo off
echo Starting Atlas Backend...

:: Navigate to the backend directory
cd atlas-backend

:: Activate the virtual environment
call venv\Scripts\activate.bat

:: Start the FastAPI server
echo Running FastAPI Server on Port 8000...
uvicorn app.main:app --reload --port 8000

pause
