# ─── Service: Anomaly Detector ────────────────────────────
# Wraps the trained Isolation Forest model.
# Loaded once at startup via FastAPI lifespan; accessed here
# through a module-level singleton.
# ──────────────────────────────────────────────────────────

import os
import logging
import joblib
import numpy as np

logger = logging.getLogger(__name__)

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "../../models/anomaly_model.pkl")
_SCALER_PATH = os.path.join(os.path.dirname(__file__), "../../models/scaler.pkl")
_model = None
_scaler = None

def _load_model():
    global _model, _scaler
    if _model is None or _scaler is None:
        model_path = os.path.abspath(_MODEL_PATH)
        scaler_path = os.path.abspath(_SCALER_PATH)
        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            raise FileNotFoundError(f"Model or scaler not found at {model_path} / {scaler_path}")
        _model = joblib.load(model_path)
        _scaler = joblib.load(scaler_path)
        logger.info("✅ Custom Isolation Forest model & Scaler loaded from %s", model_path)
    return _model, _scaler


def detect(features: dict) -> float:
    """
    Run the Isolation Forest on a feature dict.

    Args:
        features: dict with 12 features (MI_dir_L5_weight, etc)

    Returns:
        anomaly_score (float): Raw IF decision score.
                               Negative = more anomalous.
    """
    model, scaler = _load_model()
    # Ensure features are in the exact order the scaler expects
    feature_order = [
         'MI_dir_L5_weight', 'MI_dir_L5_mean', 'MI_dir_L5_variance',
         'MI_dir_L3_weight', 'MI_dir_L3_mean', 'MI_dir_L3_variance',
         'MI_dir_L1_weight', 'MI_dir_L1_mean', 'MI_dir_L1_variance',
         'H_L5_weight', 'H_L5_mean', 'H_L5_variance'
    ]
    X_raw = np.array([[features.get(f, 0.0) for f in feature_order]])
    X_scaled = scaler.transform(X_raw)
    
    score = model.decision_function(X_scaled)[0]
    return float(score)
