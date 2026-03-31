import pandas as pd
import numpy as np
import joblib
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# load
df = pd.read_csv("neodetect_50k.csv")

FEATURES = [
    "eeg_mean",
    "eeg_skewness",
    "eeg_kurtosis",
    "delta_power",
    "theta_power",
    "rr_interval",
    "spo2_drop"
]

X = df[FEATURES]
y = df["target"]

# ----------------------------
# 🔥 ADD SMALL FEATURE NOISE
# ----------------------------
X = X + np.random.normal(0, 0.05, X.shape)

# ----------------------------
# 🔥 ADD SMALL LABEL NOISE (5%)
# ----------------------------
def add_label_noise(y, noise_level=0.05):
    y_noisy = y.copy()
    n = int(len(y) * noise_level)
    idx = np.random.choice(len(y), n, replace=False)
    y_noisy.iloc[idx] = 1 - y_noisy.iloc[idx]
    return y_noisy

y = add_label_noise(y, 0.05)

# ----------------------------
# split
# ----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.25,
    random_state=42,
    stratify=y
)

# ----------------------------
# 🔥 WEAKER MODEL
# ----------------------------
model = XGBClassifier(
    n_estimators=40,
    max_depth=2,
    learning_rate=0.25,
    subsample=0.6,
    colsample_bytree=0.6,
    eval_metric="logloss",
    random_state=42
)

model.fit(X_train, y_train)

# ----------------------------
# evaluation
# ----------------------------
train_acc = accuracy_score(y_train, model.predict(X_train))
test_acc = accuracy_score(y_test, model.predict(X_test))

print(f"Train Accuracy: {train_acc*100:.2f}%")
print(f"Test Accuracy:  {test_acc*100:.2f}%")

# ----------------------------
# save
# ----------------------------
joblib.dump({
    "model": model,
    "features": FEATURES
}, "pain_model.pkl")

print("✅ Model saved")