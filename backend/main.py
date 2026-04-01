# ============================
# IMPORTS
# ============================
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List

import joblib
import numpy as np
import pandas as pd
import os
import base64
import cv2
import json
import time
import uuid
import io

from tensorflow.keras.models import load_model
from predict import predict_pain, forecast_pain


# ============================
# CREATE APP
# ============================
app = FastAPI(title="NeoDetect Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================
# IN-MEMORY CSV SESSION STORE
# ============================
_csv_sessions: dict[str, pd.DataFrame] = {}

REQUIRED_COLUMNS = {
    "eeg_mean", "eeg_skewness", "eeg_kurtosis",
    "delta_power", "theta_power", "rr_interval", "spo2_drop"
}


# ============================
# ROOT
# ============================
@app.get("/")
def root():
    return {"message": "NeoDetect Backend is running!"}


# ============================
# INPUT MODELS
# ============================
class PainInput(BaseModel):
    eeg_mean: float
    eeg_skewness: float
    eeg_kurtosis: float
    delta_power: float
    theta_power: float
    rr_interval: float
    spo2_drop: float


class ForecastInput(BaseModel):
    """
    history: list of recent signal epochs, oldest first, most recent last.
    Must contain at least 4 entries (matching WINDOW in training).
    Each entry must have all 7 feature keys.
    """
    history: List[PainInput]


# ============================
# PREDICT API (unchanged)
# ============================
@app.post("/predict")
async def predict_api(data: PainInput):
    try:
        input_dict = data.dict()
        result = predict_pain(input_dict)
        return {
            "message": "Prediction successful",
            "input": input_dict,
            "result": result,
        }
    except Exception as e:
        print("❌ ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# 🔮 FORECAST API  (NEW)
# POST /forecast
# Body: { "history": [ {7 features}, ... ] }  — at least 4 epochs
# Returns forecast for ~30 seconds ahead
# ============================
@app.post("/forecast")
async def forecast_api(data: ForecastInput):
    """
    Accepts a rolling window of recent physiological epochs and returns
    a future-pain probability (~30 s ahead).

    Example request body:
    {
        "history": [
            {"eeg_mean": 0.1, "eeg_skewness": -0.2, ...},   // t-3
            {"eeg_mean": 0.2, "eeg_skewness": -0.1, ...},   // t-2
            {"eeg_mean": 0.3, "eeg_skewness":  0.0, ...},   // t-1
            {"eeg_mean": 0.4, "eeg_skewness":  0.1, ...}    // t  (latest)
        ]
    }
    """
    try:
        history_dicts = [h.dict() for h in data.history]
        result = forecast_pain(history_dicts)
        return {
            "message": "Forecast successful",
            "result": result,
        }
    except Exception as e:
        print("❌ Forecast ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# BULK SIMULATION (OLD)
# ============================
@app.post("/predict_simulation/")
async def predict_simulation():
    try:
        df = pd.read_csv("NEODETECT_50K_clean_input.csv")
        results = []
        for _, row in df.iterrows():
            input_dict = row.to_dict()
            result = predict_pain(input_dict)
            results.append(result)
        return {
            "message": "Simulation complete",
            "total": len(results),
            "sample": results[:5],
        }
    except Exception as e:
        print("❌ Simulation Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# 🔥 LIVE STREAM (unchanged)
# ============================
try:
    df_stream = pd.read_csv("neodetect_50k.csv")
    print("✅ Stream dataset loaded")
except Exception as e:
    print("❌ Stream dataset missing:", e)
    df_stream = pd.DataFrame()

@app.get("/stream")
def stream():
    def generate():
        if df_stream.empty:
            yield f"data: {json.dumps({'error': 'dataset not loaded'})}\n\n"
            return

        history_buffer: list[dict] = []

        for i, row in df_stream.iterrows():
            input_data = {
                "eeg_mean":     float(row["eeg_mean"]),
                "eeg_skewness": float(row["eeg_skewness"]),
                "eeg_kurtosis": float(row["eeg_kurtosis"]),
                "delta_power":  float(row["delta_power"]),
                "theta_power":  float(row["theta_power"]),
                "rr_interval":  float(row["rr_interval"]),
                "spo2_drop":    float(row["spo2_drop"]),
            }

            result = predict_pain(input_data)

            # Rolling history for forecasting
            history_buffer.append(input_data)
            if len(history_buffer) > 10:
                history_buffer.pop(0)

            forecast = forecast_pain(history_buffer)

            payload = {
                "time": i,
                **input_data,
                "prediction": result["prediction"],
                "confidence": result["confidence"],
                "forecast":   forecast,
            }

            yield f"data: {json.dumps(payload)}\n\n"
            time.sleep(0.7)

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================
# 📤 CSV UPLOAD — creates a session (unchanged)
# ============================
@app.post("/upload_csv_session")
async def upload_csv_session(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required columns: {sorted(missing)}",
        )

    session_id = str(uuid.uuid4())
    _csv_sessions[session_id] = df
    print(f"✅ CSV session created: {session_id}  rows={len(df)}")

    return {
        "session_id": session_id,
        "rows": len(df),
        "columns": list(df.columns),
    }


# ============================
# 📡 CSV STREAM — SSE (updated: adds forecast to every payload)
# ============================
@app.get("/stream_csv/{session_id}")
def stream_csv(session_id: str):
    if session_id not in _csv_sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please upload the CSV again.")

    df = _csv_sessions[session_id]

    def generate():
        # Per-session rolling history for forecasting
        history_buffer: list[dict] = []

        try:
            for i, row in df.iterrows():
                input_data = {
                    "eeg_mean":     float(row["eeg_mean"]),
                    "eeg_skewness": float(row["eeg_skewness"]),
                    "eeg_kurtosis": float(row["eeg_kurtosis"]),
                    "delta_power":  float(row["delta_power"]),
                    "theta_power":  float(row["theta_power"]),
                    "rr_interval":  float(row["rr_interval"]),
                    "spo2_drop":    float(row["spo2_drop"]),
                }

                result = predict_pain(input_data)

                # Maintain rolling history (keep last 10 epochs max)
                history_buffer.append(input_data)
                if len(history_buffer) > 10:
                    history_buffer.pop(0)

                # Compute forecast — returns {"available": False, ...} when
                # history is still too short (first WINDOW-1 epochs)
                forecast = forecast_pain(history_buffer)

                payload = {
                    "time":       int(i),
                    **input_data,
                    "prediction": result["prediction"],
                    "confidence": result["confidence"],
                    "forecast":   forecast,   # ← NEW field
                }

                # Attach SHAP fields if present
                for shap_field in ("shap_values", "shap_reason", "shap_detail", "shap_top3"):
                    if shap_field in result:
                        payload[shap_field] = result[shap_field]

                yield f"data: {json.dumps(payload)}\n\n"
                time.sleep(0.7)

            yield f"data: {json.dumps({'done': True})}\n\n"

        except GeneratorExit:
            _csv_sessions.pop(session_id, None)
            print(f"🔌 Client disconnected: session {session_id} removed")
        except Exception as e:
            print(f"❌ Stream error for session {session_id}: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            _csv_sessions.pop(session_id, None)

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================
# FACE MODEL LOAD
# ============================
FACE_MODEL_PATH   = "CNN_face_cnn_model_binary.h5"
FACE_ENCODER_PATH = "CNN_face_label_encoder_binary.pkl"

face_model   = None
face_encoder = None

if os.path.exists(FACE_MODEL_PATH):
    face_model = load_model(FACE_MODEL_PATH)
    print("✅ Face model loaded")

if os.path.exists(FACE_ENCODER_PATH):
    face_encoder = joblib.load(FACE_ENCODER_PATH)
    print("✅ Encoder loaded")


# ============================
# FACE INPUT MODEL
# ============================
class ImageData(BaseModel):
    image_base64: str


# ============================
# FACE PREDICTION API (unchanged)
# ============================
@app.post("/predict_face/")
async def predict_face(data: ImageData):
    if face_model is None:
        raise HTTPException(status_code=500, detail="Face model not loaded")

    try:
        header, encoded = data.image_base64.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        img   = cv2.resize(img, (64, 64))
        img   = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img   = img / 255.0
        img   = np.expand_dims(img, axis=0)

        pred  = face_model.predict(img)[0]
        label = int(np.argmax(pred))
        prob  = float(pred[1])

        return {"prediction": label, "pain_probability": prob}

    except Exception as e:
        print("❌ Face Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# RUN SERVER
# ============================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
