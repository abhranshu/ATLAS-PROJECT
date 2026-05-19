# ATLAS-TDI — Adaptive Trust & Drift Intelligence for IoT Networks
## Comprehensive Project Report

---

### 1. Project Overview & Importance
**ATLAS-TDI** is a comprehensive Security Operations Center (SOC) dashboard designed specifically for Internet of Things (IoT) networks. As IoT networks grow rapidly and devices become increasingly interconnected, identifying malicious behavior—such as compromised sensors, DDoS packet storms, or unauthorized protocol usage—becomes extremely difficult. 

The importance of this project lies in its ability to automatically monitor and analyze the behavior of all connected IoT devices in real-time. By applying machine learning to telemetry data, ATLAS-TDI intelligently detects anomalies (or "drift" in normal behavior) and calculates a real-time "Trust Score" for every device. This allows security analysts to immediately spot malicious devices, understand exactly *why* they were flagged, and quickly take action to isolate them from the network before they cause substantial harm.

---

### 2. Machine Learning Model Used
The core intelligence of ATLAS-TDI is powered by an **Isolation Forest** machine learning algorithm, combined with **SHAP** (SHapley Additive exPlanations) for explainability.

**a) Isolation Forest (Anomaly Detection)**
- **Why it's used**: Isolation Forest is highly effective for identifying anomalies in high-dimensional datasets. Instead of profiling normal data, it explicitly identifies anomalies by "isolating" data points that are few and different.
- **Features Analysed**: The model monitors telemetry metrics from the IoT devices:
  - `packet_count`: Number of packets sent/received.
  - `protocol`: Transport protocol used (e.g., MQTT, CoAP, HTTPS).
  - `entropy`: Randomness of the payload (high entropy often signifies encrypted or malicious payloads).
  - `ip_diversity`: How many distinct IP addresses a device is communicating with.
- **Behavior**: Normal IoT devices typically exhibit highly predictable behavior (e.g., a thermostat sending a small packet via MQTT every 5 minutes). Anomalous behavior (like a packet burst or high IP diversity) causes the Isolation Forest to output negative anomaly scores, flagging an "Incident".

**b) SHAP (Model Explainability)**
- **Why it's used**: In cybersecurity, black-box ML models are problematic because analysts need to know *why* an alert fired to take proper action. 
- **Behavior**: A `TreeExplainer` from the SHAP library breaks down the Isolation Forest's decision to show exactly which feature contributed to the anomaly (e.g., "This device was flagged primarily because `ip_diversity` was 90, whereas it normally is < 5").

---

### 3. Project Workflow & Architecture

The project follows a modern, decoupled client-server architecture:

#### A. Frontend (React + Vite + TypeScript)
Located in `atlas-app/`, the frontend serves as the interactive interface for SOC analysts.
- **Routing & Views**: Provides specialized pages like `/inventory` (all IoT devices), `/trust` (overall network trust metrics), `/incidents` (security alerts), and `/network` (topology map).
- **API Communication**: Uses `axios` with an interceptor to automatically attach JWT tokens (stored in `localStorage`) for authenticated requests.
- **Resilience**: The frontend is designed to consume real data, but gracefully falls back to mock data if the backend server is down.

#### B. Backend (Python + FastAPI)
Located in `atlas-backend/`, the backend processes the logic, handles the database, and exposes REST endpoints.
- **API Endpoints**: Fast and asynchronous endpoints process requests. For example:
  - `GET /api/devices`: Fetches inventory with pagination and search.
  - `GET /api/devices/:id/trust-analysis`: Fetches the live SHAP/Anomaly stats for a specific device.
  - `POST /api/devices/:id/isolate`: Allows an admin to block an offending device.
- **Machine Learning Integration**: Once the Isolation forest is trained (`train_model.py`), the pickled models (`.pkl`) are loaded into the FastAPI app to serve live predictions.
- **Database**: Connects to a robust **PostgreSQL** database via SQLAlchemy to store persistent configurations, historical incident logs, and device metadata. It automatically seeds tables and dummy IoT devices upon first launch.

#### C. Typical Incident Workflow
1. **Telemetry Generation**: IoT devices naturally generate traffic telemetry (currently simulated by the backend or synthetic datasets).
2. **Analysis**: The backend feeds the data points through the loaded `isolation_forest.pkl` model.
3. **Detection**: If the decision function returns an anomaly, the backend creates an Incident Log in the PostgreSQL database and recalculates the device's Trust Score negatively.
4. **Dashboard Alert**: The React dashboard pulls the incident via `GET /api/incidents` and displays a high-severity alert to the admin.
5. **Investigation**: The analyst clicks the device to view the single-device trust analysis (`SingleDeviceTrustAnalysis.tsx`), reviewing the SHAP explainer graphs to see exactly what triggered the anomaly.
6. **Remediation**: The analyst triggers an "Isolate" action directly from the GUI, which sends a POST request to the backend to logically disconnect the device from the simulated network.

---

### 4. Technical Stack Summary
*   **Database**: PostgreSQL (relational state storage) + Redis (optional caching)
*   **Backend framework**: Python 3.9+, FastAPI, Uvicorn, SQLAlchemy
*   **Machine Learning**: Scikit-Learn (Isolation Forest), SHAP, Joblib, Numpy
*   **Frontend framework**: React, Vite, TypeScript, modern CSS (Layouts, Sidebars, Topbars)
*   **Authentication**: JWT (JSON Web Tokens)

---

### 5. System Structure / Directory Tree

Below is the overarching structure of the repository, demonstrating the separation of concerns between the user interface, backend logic, and utility scripts:

```text
atlas/
├── atlas-app/                    ← Frontend React Application (Vite + TS)
│   ├── src/
│   │   ├── config/               ← API and Environment configurations
│   │   ├── services/             ← Axios clients and API endpoint wrappers
│   │   ├── types/                ← TypeScript interfaces and types
│   │   ├── components/           ← Reusable UI components (Sidebar, Topbar, Layout)
│   │   └── pages/                ← Main application views:
│   │       ├── SOCDashboard.tsx  ← Main dashboard view
│   │       ├── IoTInventory.tsx  ← List of all connected devices
│   │       ├── TrustAnalysis.tsx ← Trust intelligence metrics
│   │       ├── IncidentLogs.tsx  ← Historical anomaly and incident tracking
│   │       └── NetworkMap.tsx    ← Visual network topology map
│   ├── package.json
│   └── vite.config.ts
│
├── atlas-backend/                ← Backend FastAPI Application (Python)
│   ├── app/
│   │   ├── main.py               ← FastAPI application entry point
│   │   ├── config.py             ← Environment variable loading
│   │   ├── database.py           ← PostgreSQL connection and SQLAlchemy setup
│   │   ├── mock_data.py          ← Mock telemetry generation scripts
│   │   ├── routers/              ← API route definitions (e.g., /devices, /incidents)
│   │   ├── services/             ← Business logic and database queries
│   │   ├── models/               ← SQLAlchemy ORM database models
│   │   ├── ml/                   ← Saved Machine Learning models (.pkl)
│   │   ├── utils/                ← Helper functions
│   │   └── middleware/           ← JWT authentication and request interception
│   ├── scripts/
│   │   └── train_model.py        ← Script to train Isolation Forest and SHAP explainer
│   ├── requirements.txt          ← Python dependencies
│   └── .env                      ← Backend environment variables
│
├── stitch/                       ← Static design assets and HTML mockups
├── backend.bat                   ← Helper script to launch the FastAPI backend on Windows
├── simulate_attack.bat           ← Helper script to simulate malicious IoT behavior
├── start.md                      ← Setup guide
├── README.md                     ← Main project documentation
└── wholeprojectreport.md         ← Comprehensive project report (this file)
```

---

### 6. How the Code is Working (Execution Flow)

The execution flow involves several layers working in tandem to detect and present anomalies:
1. **Telemetry Generation**: Simulated by `mock_data.py`, synthetic telemetry for each connected device is generated (e.g. packet counts, entropies) on regular intervals.
2. **API Interception**: The FastAPI backend routes (`routers/`) receive this incoming data. 
3. **Machine Learning Pipeline (`ml/`)**: The telemetry is passed as a NumPy array to the pre-loaded `isolation_forest.pkl` model. 
   - The model computes an anomaly score using `model.decision_function()`. 
   - If the score dips below 0, it is flagged as an anomaly.
   - The SHAP explainer calculates feature importance, breaking down *why* the anomaly was triggered.
4. **Database Commit**: If an anomaly is detected, an `Incident` entry is created using SQLAlchemy, and the `Device` table is updated to reflect a lowered `trust_score` and a `BREACH` status. 
5. **Frontend Rendering**: The React application repeatedly fetches the network status (`/api/devices` and `/api/incidents`) via Axios clients. When it spots the newly created incident, the `SOCDashboard.tsx` prominently flags the device, allowing the human operator to review the SHAP statistics and potentially issue a command to physically isolate the device (`is_isolated = True`).

---

### 7. Database Used & Schema

The application uses **PostgreSQL** for persistent relational data storage (along with SQLAlchemy as the Object-Relational Mapper in Python).

**Core Schema Overview**:
*   **`devices` table**: Tracks every IoT device on the network.
    *   Key columns: `id` (UUID), `name`, `type` (sensor, gateway, etc.), `ip_address`, `status` (STABLE, BREACH, OFFLINE), `trust_score` (Float, 0-100), `is_isolated` (Boolean).
*   **`incidents` table**: Tracks security events and anomalies detected by the ML models.
    *   Key columns: `id` (UUID), `title`, `description`, `severity` (critical, warning, etc.), `device_id` (Foreign Key mapping back to the `devices` table), `resolved` (Boolean).
*   **`servers` table / `trust_events` table**: Supplemental tables tracking the parent server clusters and granular chronological changes in device trust metrics respectively.
*   **`users` table**: Stores operator credentials and roles for dashboard JWT authentication.

---

### 8. Machine Learning Model Accuracy

The core model is an **Isolation Forest**, which is an **unsupervised** machine learning algorithm. Because it operates on unlabelled data to find outliers, traditional supervised metrics like "Accuracy", "Precision", or "Recall" are not calculated natively during training.

However, its performance relies on the **`contamination`** parameter defined during training (`scripts/train_model.py`). 
*   The model was trained on 10,000 synthetic IoT data points with a defined **contamination rate of 0.05 (5%)**.
*   This configures the algorithm to expect that roughly 5% of all traffic on the network represents malicious or anomalous behavior (e.g. packet storms, weird protocols).
*   **Evaluation Check**: During the sanity checks in the training pipeline, the model consistently assigns positive scores (normal behavior) to standard traffic and strictly negative scores (anomalies) to the simulated packet burst / high-entropy traffic, indicating a robust internal separation of normal vs. abnormal telemetry.







1. ML Model used in the project (for detection): The project uses an Isolation Forest algorithm (an unsupervised machine learning model) to detect anomalies in IoT network telemetry. It is also paired with a SHAP TreeExplainer to provide Explainable AI (XAI) insights into why a specific device was flagged as anomalous.

2. ML Model used for attacking the IoT devices: There is no ML model used to perform the attacks. Instead, the project uses statistical distribution generators (NumPy) to artificially simulate the behavior of attacks (like sudden packet bursts, high entropy, or unknown protocols) in the training data, which mimics traditional botnet malware like Mirai or BASHLITE.