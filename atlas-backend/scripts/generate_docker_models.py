"""
Generate synthetic ML artifacts for Docker / local dev.

The runtime services expect these files under atlas-backend/models/:
  - anomaly_model.pkl
  - scaler.pkl
  - shap_explainer.pkl
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

MODEL_DIR = os.path.join(os.path.dirname(__file__), "../models")
os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH = os.path.join(MODEL_DIR, "anomaly_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
EXPLAINER_PATH = os.path.join(MODEL_DIR, "shap_explainer.pkl")

FEATURE_COUNT = 12

np.random.seed(42)
n_normal = 9500
n_anomaly = 500

normal = np.random.normal(loc=0.5, scale=0.15, size=(n_normal, FEATURE_COUNT))
anomaly = np.random.normal(loc=0.9, scale=0.2, size=(n_anomaly, FEATURE_COUNT))
X_train = np.vstack([normal, anomaly])

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_train)

model = IsolationForest(
    n_estimators=200,
    contamination=0.05,
    random_state=42,
    n_jobs=-1,
)
model.fit(X_scaled)

joblib.dump(model, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)
print(f"Saved model  -> {MODEL_PATH}")
print(f"Saved scaler -> {SCALER_PATH}")

try:
    import shap

    explainer = shap.TreeExplainer(model)
    joblib.dump(explainer, EXPLAINER_PATH)
    print(f"Saved SHAP   -> {EXPLAINER_PATH}")
except ImportError:
    print("SHAP not installed — skipping explainer")

print("Docker ML artifacts ready.")
