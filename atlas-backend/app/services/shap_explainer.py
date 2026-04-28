# ─── Service: SHAP Explainer ──────────────────────────────
# Generates per-feature SHAP values for model predictions.
# Uses a TreeExplainer backed by the same Isolation Forest.
# ──────────────────────────────────────────────────────────

import os
import logging
import joblib
import numpy as np

logger = logging.getLogger(__name__)

_EXPLAINER_PATH = os.path.join(os.path.dirname(__file__), "../../models/shap_explainer.pkl")
_MODEL_PATH     = os.path.join(os.path.dirname(__file__), "../../models/anomaly_model.pkl")
_SCALER_PATH    = os.path.join(os.path.dirname(__file__), "../../models/scaler.pkl")

_explainer = None
_scaler = None

FEATURE_NAMES = [
    'MI_dir_L5_weight', 'MI_dir_L5_mean', 'MI_dir_L5_variance',
    'MI_dir_L3_weight', 'MI_dir_L3_mean', 'MI_dir_L3_variance',
    'MI_dir_L1_weight', 'MI_dir_L1_mean', 'MI_dir_L1_variance',
    'H_L5_weight', 'H_L5_mean', 'H_L5_variance'
]

def _load_explainer():
    global _explainer, _scaler
    if _explainer is None or _scaler is None:
        try:
            import shap
            
            # Load scaler first
            scaler_path = os.path.abspath(_SCALER_PATH)
            if not os.path.exists(scaler_path):
                raise FileNotFoundError(f"Scaler not found at {scaler_path}")
            _scaler = joblib.load(scaler_path)

            # Prefer pre-saved explainer for speed
            exp_path = os.path.abspath(_EXPLAINER_PATH)
            if os.path.exists(exp_path):
                _explainer = joblib.load(exp_path)
                logger.info("✅ SHAP explainer loaded from %s", exp_path)
            else:
                # Build explainer on-the-fly from the IF model
                model_path = os.path.abspath(_MODEL_PATH)
                if not os.path.exists(model_path):
                    raise FileNotFoundError("Neither SHAP explainer nor Custom Model found.")
                model = joblib.load(model_path)
                _explainer = shap.TreeExplainer(model)
                joblib.dump(_explainer, exp_path)
                logger.info("✅ SHAP explainer built and saved to %s", exp_path)
        except ImportError:
            logger.warning("⚠️  SHAP library not installed — explanations disabled")
            _explainer = None
    return _explainer, _scaler


def explain(features: dict) -> dict:
    """
    Return a dict of {feature_name: shap_value} for the given feature dict.
    Falls back to an empty dict if SHAP library / model is unavailable.
    """
    explainer, scaler = _load_explainer()
    if explainer is None or scaler is None:
        return {}

    try:
        import shap
        X_raw = np.array([[features.get(f, 0.0) for f in FEATURE_NAMES]])
        X_scaled = scaler.transform(X_raw)

        shap_values = explainer.shap_values(X_scaled)
        
        # TreeExplainer on IF returns shape (n_samples, n_features)
        if hasattr(shap_values, "__len__"):
            values = shap_values[0] if len(shap_values) > 0 else shap_values
        else:
            values = shap_values

        return {
            name: float(round(val, 6))
            for name, val in zip(FEATURE_NAMES, values)
        }
    except Exception as exc:
        logger.warning("SHAP explain error: %s", exc)
        return {}
