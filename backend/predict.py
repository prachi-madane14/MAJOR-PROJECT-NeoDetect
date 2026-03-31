import joblib
import json
import pandas as pd
import numpy as np
import shap
import xgboost as xgb

# ── Load main model ───────────────────────────────────────────────────────────
saved    = joblib.load("pain_model.pkl")
model    = saved["model"]
features = saved["features"]

# ── Rebuild SHAP explainer from saved booster ─────────────────────────────────
_booster = xgb.Booster()
_booster.load_model("shap_booster.json")

with open("shap_meta.json") as f:
    _meta = json.load(f)

_explainer      = shap.TreeExplainer(_booster)
_expected_value = float(_meta["expected_value"])

# ── Helper ────────────────────────────────────────────────────────────────────
def _sv_class1(sv):
    if isinstance(sv, list): return sv[1]
    if isinstance(sv, np.ndarray):
        if sv.ndim == 3:                       return sv[:, :, 1]
        if sv.ndim == 2 and sv.shape[1] == 2: return sv[:, 1]
    return sv

# ── Main predict function ─────────────────────────────────────────────────────
def predict_pain(input_features: dict) -> dict:
    df          = pd.DataFrame([input_features], columns=features)
    prediction  = model.predict(df)[0]
    probability = model.predict_proba(df)[0][1]

    sv  = _sv_class1(_explainer.shap_values(df))
    sv0 = sv[0]

    # Rank all features by absolute SHAP value
    ranked = sorted(zip(features, sv0), key=lambda x: abs(x[1]), reverse=True)

    # Top 3 with direction arrows
    reasons = []
    for name, val in ranked[:3]:
        clean = name.replace("_", " ")
        if val > 0:
            reasons.append(f"{clean} ↑ (+{val:.3f})")
        else:
            reasons.append(f"{clean} ↓ ({val:.3f})")

    # Summary sentence
    if int(prediction) == 1:
        summary = f"Pain likely due to: {reasons[0]}, {reasons[1]}, and {reasons[2]}."
    else:
        summary = f"No pain — signals normal. Key suppressors: {reasons[0]}, {reasons[1]}, and {reasons[2]}."

    # Feature count insight
    pain_pushers     = [n for n, v in zip(features, sv0) if v > 0]
    pain_suppressors = [n for n, v in zip(features, sv0) if v < 0]
    detail = (
        f"{len(pain_pushers)} of 7 features elevated pain probability "
        f"({', '.join([p.replace('_', ' ') for p in pain_pushers[:2]])}...). "
        f"{len(pain_suppressors)} features suppressed it."
    )

    return {
        "prediction":  int(prediction),
        "confidence":  round(float(probability) * 100, 2),
        "status":      "⚠️ PAIN DETECTED" if prediction == 1 else "✅ NO PAIN",
        "shap_values": {n: round(float(v), 4) for n, v in zip(features, sv0)},
        "shap_reason": summary,
        "shap_detail": detail,
        "shap_top3":   [
            {
                "feature":   n.replace("_", " "),
                "shap":      round(float(v), 4),
                "direction": "↑ increases pain" if v > 0 else "↓ decreases pain",
            }
            for n, v in ranked[:3]
        ],
    }
