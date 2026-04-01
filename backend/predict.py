"""
NeoDetect — Prediction Module
=================================
Exports:
  predict_pain(input_features: dict) -> dict
      Single-epoch current-pain detection with SHAP explanation.

  forecast_pain(history: list[dict]) -> dict
      Future-pain risk using a rolling window of recent epochs.
"""

import joblib
import json
import pandas as pd
import numpy as np
import shap
import xgboost as xgb

# ═══════════════════════════════════════════════════════════════════════════════
# Load current-pain detector
# ═══════════════════════════════════════════════════════════════════════════════
_saved    = joblib.load("pain_model.pkl")
_model    = _saved["model"]
_features = _saved["features"]

_booster = xgb.Booster()
_booster.load_model("shap_booster.json")

with open("shap_meta.json") as f:
    _meta = json.load(f)

_explainer      = shap.TreeExplainer(_booster)
_expected_value = float(_meta["expected_value"])

# ═══════════════════════════════════════════════════════════════════════════════
# Load forecaster  (graceful fallback if not yet trained)
# ═══════════════════════════════════════════════════════════════════════════════
_forecast_available = False
_forecast_model     = None
_forecast_features  = []
_forecast_window    = 4
_forecast_horizon   = 5
_forecast_base      = []

try:
    _fsaved             = joblib.load("forecast_model.pkl")
    _forecast_model     = _fsaved["model"]
    _forecast_features  = _fsaved["features"]
    _forecast_window    = _fsaved["window"]
    _forecast_horizon   = _fsaved["horizon"]
    _forecast_base      = _fsaved["base_features"]
    _forecast_available = True
    print("✅ Forecast model loaded")
except FileNotFoundError:
    print("⚠️  forecast_model.pkl not found — forecasting disabled.")

# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════
def _sv_class1(sv):
    if isinstance(sv, list):
        return sv[1]
    if isinstance(sv, np.ndarray):
        if sv.ndim == 3:
            return sv[:, :, 1]
        if sv.ndim == 2 and sv.shape[1] == 2:
            return sv[:, 1]
    return sv


# ═══════════════════════════════════════════════════════════════════════════════
# predict_pain — unchanged public API
# ═══════════════════════════════════════════════════════════════════════════════
def predict_pain(input_features: dict) -> dict:
    df         = pd.DataFrame([input_features], columns=_features)
    prediction = _model.predict(df)[0]
    probability = _model.predict_proba(df)[0][1]

    sv  = _sv_class1(_explainer.shap_values(df))
    sv0 = sv[0]

    ranked = sorted(zip(_features, sv0), key=lambda x: abs(x[1]), reverse=True)

    reasons = []
    for name, val in ranked[:3]:
        clean = name.replace("_", " ")
        reasons.append(
            f"{clean} ↑ (+{val:.3f})" if val > 0 else f"{clean} ↓ ({val:.3f})"
        )

    if int(prediction) == 1:
        summary = f"Pain likely due to: {reasons[0]}, {reasons[1]}, and {reasons[2]}."
    else:
        summary = f"No pain — signals normal. Key suppressors: {reasons[0]}, {reasons[1]}, and {reasons[2]}."

    pain_pushers     = [n for n, v in zip(_features, sv0) if v > 0]
    pain_suppressors = [n for n, v in zip(_features, sv0) if v < 0]
    detail = (
        f"{len(pain_pushers)} of 7 features elevated pain probability "
        f"({', '.join([p.replace('_', ' ') for p in pain_pushers[:2]])}...). "
        f"{len(pain_suppressors)} features suppressed it."
    )

    return {
        "prediction":  int(prediction),
        "confidence":  round(float(probability) * 100, 2),
        "status":      "⚠️ PAIN DETECTED" if prediction == 1 else "✅ NO PAIN",
        "shap_values": {n: round(float(v), 4) for n, v in zip(_features, sv0)},
        "shap_reason": summary,
        "shap_detail": detail,
        "shap_top3": [
            {
                "feature":   n.replace("_", " "),
                "shap":      round(float(v), 4),
                "direction": "↑ increases pain" if v > 0 else "↓ decreases pain",
            }
            for n, v in ranked[:3]
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# forecast_pain  (NEW)
# ═══════════════════════════════════════════════════════════════════════════════
def forecast_pain(history: list[dict]) -> dict:
    """
    Predict whether the baby is likely to be in pain ~30 seconds from now.

    Parameters
    ----------
    history : list of dicts
        Recent signal epochs, most-recent LAST.
        Each dict must contain the 7 base feature keys.
        Must have at least `_forecast_window` entries.

    Returns
    -------
    dict with keys:
        available       bool   — False if model not loaded or history too short
        forecast_prob   float  — 0-100 probability of pain in ~30 s
        forecast_label  int    — 1 = high risk, 0 = low risk
        risk_level      str    — "HIGH" | "MODERATE" | "LOW"
        message         str    — human-readable summary
        horizon_epochs  int    — how many epochs ahead was predicted
        window_used     int    — how many history epochs were used
    """
    if not _forecast_available:
        return {
            "available": False,
            "forecast_prob": None,
            "forecast_label": None,
            "risk_level": "UNKNOWN",
            "message": "Forecast model not loaded.",
            "horizon_epochs": None,
            "window_used": None,
        }

    if len(history) < _forecast_window:
        return {
            "available": False,
            "forecast_prob": None,
            "forecast_label": None,
            "risk_level": "UNKNOWN",
            "message": f"Need {_forecast_window} epochs of history — only {len(history)} available.",
            "horizon_epochs": _forecast_horizon,
            "window_used": len(history),
        }

    # Take the most-recent `_forecast_window` epochs
    recent = history[-_forecast_window:]

    # Build the flat windowed feature vector
    offsets = list(range(-(_forecast_window - 1), 1))   # e.g. [-3,-2,-1,0]
    row = []
    for offset in offsets:
        src = offset + (_forecast_window - 1)            # index into `recent`
        epoch = recent[src]
        for feat in _forecast_base:
            row.append(float(epoch.get(feat, 0.0)))

    X = pd.DataFrame([row], columns=_forecast_features)
    prob  = float(_forecast_model.predict_proba(X)[0][1])
    label = int(_forecast_model.predict(X)[0])

    # Risk tier
    if prob >= 0.70:
        risk = "HIGH"
        msg  = f"High likelihood of pain in ~{_forecast_horizon * 6}s. Consider intervention."
    elif prob >= 0.45:
        risk = "MODERATE"
        msg  = f"Moderate pain risk in ~{_forecast_horizon * 6}s. Continue monitoring closely."
    else:
        risk = "LOW"
        msg  = f"Low pain risk in the next ~{_forecast_horizon * 6}s."

    return {
        "available":       True,
        "forecast_prob":   round(prob * 100, 2),
        "forecast_label":  label,
        "risk_level":      risk,
        "message":         msg,
        "horizon_epochs":  _forecast_horizon,
        "window_used":     _forecast_window,
    }
