# ============================
# IMPORTS
# ============================
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import joblib
import numpy as np
import pandas as pd
import os
import base64
import cv2
import json
import time

from tensorflow.keras.models import load_model
from predict import predict_pain


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
# ROOT
# ============================
@app.get("/")
def root():
    return {"message": "NeoDetect Backend is running!"}


# ============================
# INPUT MODEL
# ============================
class PainInput(BaseModel):
    eeg_mean: float
    eeg_skewness: float
    eeg_kurtosis: float
    delta_power: float
    theta_power: float
    rr_interval: float
    spo2_drop: float


# ============================
# PREDICT API
# ============================
@app.post("/predict")
async def predict_api(data: PainInput):
    try:
        input_dict = data.dict()
        result = predict_pain(input_dict)

        return {
            "message": "Prediction successful",
            "input": input_dict,
            "result": result
        }

    except Exception as e:
        print("❌ ERROR:", e)
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
            "sample": results[:5]
        }

    except Exception as e:
        print("❌ Simulation Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# 🔥 LIVE STREAM (NEW)
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

        for i, row in df_stream.iterrows():

            input_data = {
                "eeg_mean": float(row["eeg_mean"]),
                "eeg_skewness": float(row["eeg_skewness"]),
                "eeg_kurtosis": float(row["eeg_kurtosis"]),
                "delta_power": float(row["delta_power"]),
                "theta_power": float(row["theta_power"]),
                "rr_interval": float(row["rr_interval"]),
                "spo2_drop": float(row["spo2_drop"])
            }

            result = predict_pain(input_data)

            payload = {
                "time": i,
                **input_data,
                "prediction": result["prediction"],
                "confidence": result["confidence"]
            }

            yield f"data: {json.dumps(payload)}\n\n"

            time.sleep(0.7)

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================
# FACE MODEL LOAD
# ============================
FACE_MODEL_PATH = "CNN_face_cnn_model_binary.h5"
FACE_ENCODER_PATH = "CNN_face_label_encoder_binary.pkl"

face_model = None
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
# FACE PREDICTION API
# ============================
@app.post("/predict_face/")
async def predict_face(data: ImageData):
    if face_model is None:
        raise HTTPException(status_code=500, detail="Face model not loaded")

    try:
        header, encoded = data.image_base64.split(",", 1)
        image_bytes = base64.b64decode(encoded)

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        img = cv2.resize(img, (64, 64))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img / 255.0
        img = np.expand_dims(img, axis=0)

        pred = face_model.predict(img)[0]
        label = int(np.argmax(pred))
        prob = float(pred[1])

        return {
            "prediction": label,
            "pain_probability": prob
        }

    except Exception as e:
        print("❌ Face Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================
# RUN SERVER
# ============================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)