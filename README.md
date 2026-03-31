# NeoDetect — Real-Time Neonatal Pain Detection

A machine learning framework for automated neonatal pain detection
using EEG and physiological signals.

## Tech Stack

- **Backend:** FastAPI, XGBoost, SHAP, Python
- **Frontend:** React, TypeScript, Recharts
- **ML:** XGBoost, Random Forest, Logistic Regression

## Features

- Real-time signal monitoring dashboard
- SHAP explainability per prediction
- Multimodal fusion (EEG + Cardiac + SpO₂)
- Server-Sent Events (SSE) live streaming

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python training.py        # generates pain_model.pkl
python generate_shap.py   # generates shap files
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Note

This is a proof-of-concept research project.
Dataset is simulation-based. Not for clinical use.
