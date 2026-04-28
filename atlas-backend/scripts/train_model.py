"""
scripts/train_model.py
──────────────────────
Trains the Isolation Forest on synthetic IoT telemetry data,
then saves both the model and a SHAP TreeExplainer to disk.

Run from the atlas-backend/ directory ONCE before starting the server:
    python scripts/train_model.py
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
import joblib
from sklearn.ensemble import IsolationForest

ML_DIR = os.path.join(os.path.dirname(__file__), "../app/ml")
os.makedirs(ML_DIR, exist_ok=True)

MODEL_PATH     = os.path.join(ML_DIR, "isolation_forest.pkl")
EXPLAINER_PATH = os.path.join(ML_DIR, "shap_explainer.pkl")

FEATURES = ["packet_count", "protocol", "entropy", "ip_diversity"]

# ─── 1. Generate synthetic training data ──────────────────
np.random.seed(42)
n_normal  = 9500
n_anomaly = 500

# Normal IoT traffic behaviour
normal = np.column_stack([
    np.random.normal(loc=200,  scale=50,   size=n_normal),   # packet_count
    np.random.randint(0, 3,                size=n_normal),    # protocol (0=mqtt,1=coap,2=https)
    np.random.normal(loc=3.5,  scale=0.8,  size=n_normal),   # entropy
    np.random.randint(1, 5,                size=n_normal),    # ip_diversity
])

# Anomalous: packet storms, unknown protocols, high entropy, many IPs
anomaly = np.column_stack([
    np.random.normal(loc=2000, scale=500,  size=n_anomaly),  # packet burst
    np.full(n_anomaly, 4),                                    # unknown protocol
    np.random.uniform(6.5, 8.0,            size=n_anomaly),  # high entropy
    np.random.randint(20, 100,             size=n_anomaly),   # many distinct IPs
])

X_train = np.vstack([normal, anomaly])

# ─── 2. Train Isolation Forest ────────────────────────────
print("🏋️  Training Isolation Forest…")
model = IsolationForest(
    n_estimators=200,
    contamination=0.05,   # ~5% expected anomalies
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train)
print(f"   ✅ Trained on {len(X_train):,} samples")

# ─── 3. Save model ────────────────────────────────────────
joblib.dump(model, MODEL_PATH)
print(f"   💾 Model saved → {MODEL_PATH}")

# ─── 4. Build & save SHAP explainer ──────────────────────
try:
    import shap
    print("🔍 Building SHAP TreeExplainer…")
    explainer = shap.TreeExplainer(model)
    joblib.dump(explainer, EXPLAINER_PATH)
    print(f"   💾 SHAP explainer saved → {EXPLAINER_PATH}")
except ImportError:
    print("⚠️  SHAP not installed — skipping explainer (pip install shap)")

# ─── 5. Quick sanity check ───────────────────────────────
print("\n📊 Sanity check on 5 normal vs 5 anomalous samples:")
test_normal  = normal[:5]
test_anomaly = anomaly[:5]
n_scores = model.decision_function(test_normal)
a_scores = model.decision_function(test_anomaly)
print(f"   Normal  scores (expect >0):   {np.round(n_scores, 3)}")
print(f"   Anomaly scores (expect <0):   {np.round(a_scores, 3)}")

print("\n✅ Training complete! You can now start the server.")
