"""
NeoDetect — Training Pipeline
====================================
Trains TWO models:
  1. pain_model.pkl         — current-epoch pain detector  (unchanged)
  2. forecast_model.pkl     — 30-second-ahead pain forecaster (NEW)

The forecaster is trained on a rolling window of the last N epochs
(default WINDOW=4) to predict whether pain will occur at t+HORIZON.

Run:
    python training.py
"""

import pandas as pd
import numpy as np
import joblib
import json
import shap
import xgboost as xgb
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

# ─── Config ───────────────────────────────────────────────────────────────────
FEATURES = [
    "eeg_mean", "eeg_skewness", "eeg_kurtosis",
    "delta_power", "theta_power", "rr_interval", "spo2_drop"
]

WINDOW  = 4   # how many past epochs to use as input for the forecaster
HORIZON = 5   # predict pain this many epochs ahead (≈30 s at 6 s/epoch)

# ─── Load data ────────────────────────────────────────────────────────────────
df = pd.read_csv("neodetect_50k.csv")

X_raw = df[FEATURES].copy()
y_raw = df["target"].copy()

# ─── Helpers ──────────────────────────────────────────────────────────────────
def add_feature_noise(X, sigma=0.05):
    return X + np.random.normal(0, sigma, X.shape)

def add_label_noise(y, rate=0.05):
    y = y.copy()
    idx = np.random.choice(len(y), int(len(y) * rate), replace=False)
    y.iloc[idx] = 1 - y.iloc[idx]
    return y

# ═══════════════════════════════════════════════════════════════════════════════
# 1.  CURRENT-PAIN MODEL  (identical to original)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n── Training current-pain detector ──────────────────────────────────────")

X1 = add_feature_noise(X_raw)
y1 = add_label_noise(y_raw, 0.05)

X1_tr, X1_te, y1_tr, y1_te = train_test_split(X1, y1, test_size=0.25,
                                                random_state=42, stratify=y1)

model_current = XGBClassifier(
    n_estimators=40, max_depth=2, learning_rate=0.25,
    subsample=0.6, colsample_bytree=0.6,
    eval_metric="logloss", random_state=42
)
model_current.fit(X1_tr, y1_tr)

print(f"  Train acc: {accuracy_score(y1_tr, model_current.predict(X1_tr))*100:.2f}%")
print(f"  Test  acc: {accuracy_score(y1_te, model_current.predict(X1_te))*100:.2f}%")

joblib.dump({"model": model_current, "features": FEATURES}, "pain_model.pkl")
print("  ✅ pain_model.pkl saved")

# Save SHAP booster + meta (unchanged)
booster = model_current.get_booster()
booster.save_model("shap_booster.json")

explainer = shap.TreeExplainer(booster)
sv = explainer.shap_values(X1_tr[:1])
ev = explainer.expected_value
if isinstance(ev, (list, np.ndarray)):
    ev = float(ev[1])
else:
    ev = float(ev)

with open("shap_meta.json", "w") as f:
    json.dump({"expected_value": ev}, f)
print("  ✅ shap_booster.json + shap_meta.json saved")


# ═══════════════════════════════════════════════════════════════════════════════
# 2.  FORECASTER MODEL  (NEW)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n── Building forecast dataset ────────────────────────────────────────────")
print(f"  Window={WINDOW} epochs back  →  predict pain at t+{HORIZON}")

# ── Build windowed feature matrix ─────────────────────────────────────────────
# For each row i  (where i >= WINDOW),  concatenate features from rows
# [i-WINDOW .. i-1]  (oldest → most recent)  and label = target[i+HORIZON].
#
# Resulting feature names:  eeg_mean_t-3, eeg_mean_t-2, eeg_mean_t-1, eeg_mean_t0
# (for WINDOW=4, offsets are -3,-2,-1, 0)

offsets = list(range(-(WINDOW - 1), 1))   # e.g. [-3, -2, -1, 0]

window_cols = []
for offset in offsets:
    tag = f"t{offset}" if offset <= 0 else f"t+{offset}"
    for feat in FEATURES:
        window_cols.append(f"{feat}_{tag}")

X2_rows = []
y2_rows = []

vals = X_raw.values
tgts = y_raw.values

start = WINDOW - 1
end   = len(df) - HORIZON

for i in range(start, end):
    row = []
    for offset in offsets:          # e.g. i-3, i-2, i-1, i
        src = i + offset
        row.extend(vals[src])
    X2_rows.append(row)
    y2_rows.append(tgts[i + HORIZON])

X2 = pd.DataFrame(X2_rows, columns=window_cols)
y2 = pd.Series(y2_rows, name="future_pain")

print(f"  Forecast dataset: {len(X2)} rows × {len(window_cols)} features")
print(f"  Positive rate: {y2.mean()*100:.1f}%")

# ── Add noise ─────────────────────────────────────────────────────────────────
X2 = X2 + np.random.normal(0, 0.05, X2.shape)
y2 = add_label_noise(y2, 0.05)

X2_tr, X2_te, y2_tr, y2_te = train_test_split(X2, y2, test_size=0.25,
                                                random_state=42, stratify=y2)

# ── Train forecaster ──────────────────────────────────────────────────────────
print("\n── Training forecaster ──────────────────────────────────────────────────")

model_forecast = XGBClassifier(
    n_estimators=80,       # slightly deeper than detector
    max_depth=3,
    learning_rate=0.15,
    subsample=0.7,
    colsample_bytree=0.7,
    eval_metric="logloss",
    random_state=42
)
model_forecast.fit(X2_tr, y2_tr)

tr_acc = accuracy_score(y2_tr, model_forecast.predict(X2_tr))
te_acc = accuracy_score(y2_te, model_forecast.predict(X2_te))
te_auc = roc_auc_score(y2_te, model_forecast.predict_proba(X2_te)[:, 1])

print(f"  Train acc: {tr_acc*100:.2f}%")
print(f"  Test  acc: {te_acc*100:.2f}%")
print(f"  Test  AUC: {te_auc:.4f}")

# Save forecaster
joblib.dump({
    "model":        model_forecast,
    "features":     window_cols,
    "window":       WINDOW,
    "horizon":      HORIZON,
    "base_features": FEATURES,
}, "forecast_model.pkl")
print("  ✅ forecast_model.pkl saved")

print("\n✅ All models trained successfully.\n")
