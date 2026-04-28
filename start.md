Here is a comprehensive, step-by-step guide to setting up and running the complete Atlas IoT SOC Dashboard from scratch on a new Windows machine.

Phase 1: System Prerequisites
Before starting, ensure you have the required runtime environments installed:

Python (Backend): Download and install Python 3.9+. Crucial: During the installation wizard, ensure you check the box that says "Add Python to PATH".
Node.js (Frontend): Download and install Node.js v18+. This will also install npm.
PostgreSQL (Database): Download and install PostgreSQL. During installation, you will be asked to set a password for the default postgres user. Remember this password.
(Note: Redis is also used by the backend for caching, but it is purely optional. If it's not installed, the application gracefully disables caching and continues to work normally).

Phase 2: Database Configuration
Open the pgAdmin application (which comes installed with PostgreSQL).
Right-click on your server cluster and select Create > Database.
Name the database atlas_db and save.
Go to your project folder: atlas\atlas-backend\.env and open it in a text editor.
Update the DATABASE_URL with the password you set during the PostgreSQL installation.
env
# Format: postgresql://<username>:<password>@localhost:5432/atlas_db
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/atlas_db
Phase 3: Backend Setup (FastAPI)
The backend handles the ML algorithms, database routing, and API endpoints.

Open a terminal (PowerShell or Command Prompt) and navigate to the backend folder:
cmd
cd C:\path\to\atlas\atlas-backend
Create a virtual environment (this creates an isolated environment for Python packages):
cmd
python -m venv venv
Activate the virtual environment:
cmd
.\venv\Scripts\activate
(If you get a permission error in PowerShell, run Set-ExecutionPolicy Unrestricted -Scope CurrentUser first).
Install all the required Python libraries:
cmd
pip install -r requirements.txt
Generate the Machine Learning Models: The anomaly detection and SHAP explainers require .pkl models to function. Run the training script:
cmd
python scripts\train_model.py
Start the Backend Server:
cmd
uvicorn app.main:app --reload --port 8000
(Alternatively, you can just double click the backend.bat file in the root directory). Note: When the backend starts up for the first time, it will automatically connect to PostgreSQL, create all the necessary database tables, and insert dummy IoT devices.
Phase 4: Frontend Setup (React/Vite)
The frontend handles the visual dashboard and interactive UI.

Open a new terminal window (keep your backend running in the previous one).
Navigate to the frontend folder:
cmd
cd C:\path\to\atlas\atlas-app
Install the Node package dependencies:
cmd
npm install
Start the frontend development server:
cmd
npm run dev
Phase 5: Access the Dashboard
Look at the output in your frontend terminal. It will give you a local URL (usually http://localhost:5173).
Open that URL in your web browser.
You should now see the fully functional Atlas dashboard successfully communicating with your local Python backend and PostgreSQL database!