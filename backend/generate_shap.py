import joblib
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import shap
import xgboost as xgb

# ── Load ──────────────────────────────────────────────────────────────────────
saved    = joblib.load("pain_model.pkl")
model    = saved["model"]
features = saved["features"]

df = pd.read_csv("neodetect_50k.csv")
rng = np.random.default_rng(42)
df["spo2_drop"] = np.where(
    df["spo2_drop"] == 1,
    np.clip(rng.normal(5.5, 2.0, len(df)), 0.5, 10.0),
    np.clip(rng.normal(0.8, 0.6, len(df)), 0.0,  2.5),
)
X = df[features].sample(500, random_state=42)

# ── Get raw booster ───────────────────────────────────────────────────────────
def get_booster(model):
    if hasattr(model, "calibrated_classifiers_"):
        est = model.calibrated_classifiers_[0].estimator
    elif hasattr(model, "estimators_"):
        est = model.estimators_[0]
    else:
        est = model
    if hasattr(est, "get_booster"):
        return est.get_booster()
    return est

booster = get_booster(model)

# ── Fix base_score string bug (XGBoost 2.x vs old SHAP incompatibility) ──────
# Save to JSON, patch the bad field, reload — cleanest fix
booster.save_model("shap_booster.json")
with open("shap_booster.json", "r") as f:
    model_json = json.load(f)

# Navigate to the base_score field and fix it
try:
    param = model_json["learner"]["learner_model_param"]
    raw   = param.get("base_score", "0.5")
    # strip brackets and whitespace e.g. '[4.9933332E-1]' → 0.4993...
    clean = str(raw).strip().strip("[]")
    param["base_score"] = str(float(clean))
    with open("shap_booster.json", "w") as f:
        json.dump(model_json, f)
    print(f"✅ base_score patched: {raw} → {param['base_score']}")
except Exception as e:
    print(f"⚠️  base_score patch skipped: {e}")

# Reload patched booster
booster_patched = xgb.Booster()
booster_patched.load_model("shap_booster.json")

explainer = shap.TreeExplainer(booster_patched)
print("✅ TreeExplainer created")

# ── Helper ────────────────────────────────────────────────────────────────────
def sv_class1(sv):
    if isinstance(sv, list): return sv[1]
    if isinstance(sv, np.ndarray):
        if sv.ndim == 3:                       return sv[:, :, 1]
        if sv.ndim == 2 and sv.shape[1] == 2: return sv[:, 1]
    return sv

sv_all = sv_class1(explainer.shap_values(X))
ev     = explainer.expected_value
if isinstance(ev, (list, np.ndarray)): ev = float(ev[1])
else: ev = float(ev)

# ── Figure 1: Summary beeswarm ────────────────────────────────────────────────
shap.summary_plot(sv_all, X, feature_names=features, show=False)
plt.title("SHAP Global Feature Importance — NeoDetect", fontsize=12)
plt.tight_layout()
plt.savefig("shap_summary.png", dpi=300, bbox_inches="tight")
plt.close()
print("✅ shap_summary.png saved")

# ── Figure 2: Bar plot ────────────────────────────────────────────────────────
shap.summary_plot(sv_all, X, feature_names=features, plot_type="bar", show=False)
plt.title("Mean |SHAP| Values — NeoDetect", fontsize=12)
plt.tight_layout()
plt.savefig("shap_bar.png", dpi=300, bbox_inches="tight")
plt.close()
print("✅ shap_bar.png saved")

# ── Figure 3: Waterfall ───────────────────────────────────────────────────────
pain_row = df[df["target"] == 1][features].iloc[[0]]
sv1      = sv_class1(explainer.shap_values(pain_row))

shap.plots.waterfall(
    shap.Explanation(
        values        = sv1[0],
        base_values   = ev,
        data          = pain_row.values[0],
        feature_names = features,
    ),
    show=False,
)
plt.title("SHAP Waterfall — Single Pain Epoch", fontsize=12)
plt.tight_layout()
plt.savefig("shap_waterfall.png", dpi=300, bbox_inches="tight")
plt.close()
print("✅ shap_waterfall.png saved")

# ── Save meta for predict.py ──────────────────────────────────────────────────
with open("shap_meta.json", "w") as f:
    json.dump({"expected_value": ev, "features": features}, f)
print("✅ shap_booster.json + shap_meta.json saved")
print("\n🎉 All done! Now replace predict.py and restart FastAPI.")
