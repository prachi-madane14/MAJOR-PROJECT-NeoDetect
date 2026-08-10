# 🩺 NeoDetect — AI-Based Neonatal Pain Detection

> **A real-time multimodal machine learning system for automated neonatal pain detection using EEG, ECG/RR-interval, and SpO₂ physiological signals.**

NeoDetect is a **4th-year major project** that addresses the challenge of detecting pain in neonates who cannot verbally communicate their discomfort. The system combines multiple physiological signals using **feature-level multimodal fusion** and applies machine learning to classify neonatal states as **Pain** or **No Pain**.

The project also integrates **noise-aware preprocessing, SHAP explainability, FastAPI backend, and a React-based monitoring interface** to create an end-to-end proof-of-concept system.

> ⚠️ **Note:** NeoDetect is an academic proof-of-concept. Results are based on a physiologically parameterized synthetic dataset and require validation using real NICU recordings before any clinical use.

---

## 🚀 Key Features

* 🧠 **EEG Feature Analysis** — Statistical and Welch frequency-band features
* ❤️ **ECG/RR-Interval Features** — Cardiac physiological information
* 🫁 **SpO₂ Features** — Peripheral oxygen saturation metrics
* 🔗 **Multimodal Feature Fusion** — Combines all three physiological modalities
* 📊 **Correlation-Based Feature Selection** — Compact 7-feature representation
* 🧹 **Noise-Aware Preprocessing** — RobustScaler, 5% Gaussian noise and 10% label-noise simulation
* 🤖 **Machine Learning Models** — Logistic Regression, Random Forest & XGBoost
* 🔍 **Explainable AI** — SHAP-based feature-level explanations
* ⚡ **Real-Time Prediction** — FastAPI-based inference API
* 💻 **Interactive Dashboard** — React-based NICU monitoring interface
* 📈 **Robustness & Ablation Analysis** — Evaluates noise impact and modality contribution

---

## 🏗️ System Architecture

```text
        Physiological Signals
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
     EEG       ECG/RR      SpO₂
      │          │          │
      └──────────┼──────────┘
                 ▼
        Feature Extraction
                 ▼
      Feature-Level Fusion
                 ▼
   Correlation-Based Selection
                 ▼
        7 Selected Features
                 ▼
     RobustScaler + Noise
                 ▼
       ML Classification
       ┌─────────┼─────────┐
       ▼         ▼         ▼
   Logistic    Random     XGBoost
  Regression   Forest
       └─────────┼─────────┘
                 ▼
          Pain / No Pain
                 ▼
        SHAP Explanation
                 ▼
       FastAPI + React UI
```

---

## 📊 Dataset

The experiments were performed on a **50,000-sample physiologically parameterized synthetic dataset** with a nearly balanced class distribution:

| Class   | Samples |
| ------- | ------: |
| Pain    |   50.3% |
| No Pain |   49.7% |

A compact set of **7 features** spanning EEG, ECG/RR, and SpO₂ was selected using correlation-based feature selection.

---

## 🤖 Machine Learning

Three classifiers were trained and evaluated using **5-fold stratified cross-validation**:

* Logistic Regression
* Random Forest
* XGBoost

### Results

| Metric              |                  Result |
| ------------------- | ----------------------: |
| Best Accuracy       |              **85.26%** |
| Best ROC-AUC        |              **0.8879** |
| Best Accuracy Model |             **XGBoost** |
| Best AUC Model      | **Logistic Regression** |

All three models achieved approximately **85.25–85.26% accuracy** with ROC-AUC around **0.887**.

---

## 🛡️ Robustness Analysis

The system was tested under increasing Gaussian noise levels.

| Gaussian Noise |   Accuracy |
| -------------: | ---------: |
|             0% | **85.98%** |
|            10% | **83.14%** |

The results show a gradual degradation in performance as signal noise increases.

### Multimodal Ablation

Combining **EEG + ECG/RR + SpO₂** produced a **7.05 percentage-point accuracy improvement compared with EEG alone**, demonstrating the benefit of multimodal physiological information.

---

## 🔍 Explainable AI

NeoDetect uses **SHAP (SHapley Additive exPlanations)** to provide feature-level explanations for model predictions.

Each prediction can therefore be accompanied by information showing which physiological features contributed to the predicted **Pain / No Pain** classification.

---

## ⚡ Real-Time Performance

Under simulated backend stress-test conditions:

* **Median inference latency:** 312 ms
* **95th-percentile latency:** 487 ms

The FastAPI backend generates predictions along with SHAP feature attributions.

---

## 🖥️ Website Screenshots

### Dashboard

<!-- Add your dashboard screenshot here -->

![NeoDetect Dashboard](images/dashboard.png)

### Prediction Interface

<!-- Add your prediction screenshot here -->

![Prediction Interface](images/prediction.png)

### SHAP Explainability

<!-- Add your SHAP screenshot here -->

![SHAP Explainability](images/shap.png)

> Replace the image paths above with the actual paths/names of your screenshots.

---

## 🛠️ Tech Stack

**Machine Learning:**
Python • Scikit-learn • XGBoost • Random Forest • Logistic Regression • SHAP

**Signal Processing:**
EEG • ECG/RR-Interval • SpO₂ • Welch Method • Statistical Features

**Backend:**
FastAPI • Python 

**Frontend:**
React • TypeScript • HTML • CSS

**Data Processing:**
NumPy • Pandas • RobustScaler

---



## 🎯 Research Contribution

NeoDetect brings together:

* **Multimodal EEG + ECG/RR + SpO₂ fusion**
* **Noise-aware preprocessing**
* **Compact 7-feature representation**
* **Comparative ML evaluation**
* **SHAP explainability**
* **Real-time FastAPI inference**
* **React-based NICU monitoring interface**

The project demonstrates how multimodal physiological data and explainable machine learning can be combined into an end-to-end neonatal pain detection framework.

---

## 🔮 Future Scope

* Validation using real NICU physiological recordings
* Prospective clinical studies
* Larger and more diverse datasets
* Real-world sensor artifact handling
* Continuous physiological signal streaming
* Advanced deep learning and temporal models
* Integration with hospital monitoring systems

---

## 📚 Research

NeoDetect was developed as a **4th-year major project** and the associated research work was **accepted/presented at IEEE ICSSSAIS 2026**.

---

## ⚠️ Disclaimer

NeoDetect is an **academic research prototype** and is **not a medical device**.

The reported results are proof-of-concept estimates obtained using synthetic data and simulated noise conditions. The system must not be used for clinical diagnosis or treatment decisions. Real-world deployment requires extensive clinical validation and regulatory evaluation.

---



### ⭐ If you find this project interesting, consider giving the repository a star!
