# backend/main.py (FINAL FULL CODE - EEG + FACE)

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
import pandas as pd
import mne
import antropy as ant
from scipy.signal import welch
import os
import io
import psutil
import tempfile
import shutil
from pydantic import BaseModel, conlist
from typing import List, Dict, Any
import shap
import cv2 # <-- FACE: OpenCV for image processing
import base64
from tensorflow.keras.models import load_model # <-- FACE: Keras for loading H5

# --- Configuration & Constants ---
MODEL_PATH = "neo_detect_ADVANCED_model.pkl"
SCALER_PATH = "neo_detect_ADVANCED_scaler.pkl"
# --- FACE MODEL PATHS ---
FACE_MODEL_PATH = "CNN_face_cnn_model_binary.h5"
FACE_ENCODER_PATH = "CNN_face_label_encoder_binary.pkl"
FACE_MODEL_INPUT_SHAPE = (64, 64, 3) # (Height, Width, Channels)

FEATURE_NAMES = [
    'bp_delta', 'bp_theta', 'bp_alpha', 'bp_beta', 'bp_gamma',
    'hjorth_activity', 'hjorth_mobility', 'hjorth_complexity', 'spectral_entropy'
]
RESAMPLE_FREQ = 256
EPOCH_DURATION_S = 10
FILTER_L_FREQ = 0.5
FILTER_H_FREQ = 45.0
BANDS = {
    'delta': (0.5, 4), 'theta': (4, 8), 'alpha': (8, 13),
    'beta': (13, 30), 'gamma': (30, 45)
}
MAX_CHANNELS_TO_SEND = 4
MAX_DURATION_TO_SEND = 15.0

# --- Load EEG Model, Scaler, AND SHAP Explainer ---
model = None
scaler = None
explainer = None
shap_values_expected_len = -1

try:
    if os.path.exists(SCALER_PATH):
        scaler = joblib.load(SCALER_PATH)
        print("✅ Scaler loaded successfully.")
    else:
        print(f"❌ ERROR: Scaler file not found at {SCALER_PATH}")
        scaler = None

    if scaler and os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print("✅ Model loaded successfully.")
        try:
            explainer = shap.TreeExplainer(model)
            dummy_data = pd.DataFrame(np.zeros((1, len(FEATURE_NAMES))), columns=FEATURE_NAMES)
            dummy_scaled = scaler.transform(dummy_data)
            dummy_scaled_df = pd.DataFrame(dummy_scaled, columns=FEATURE_NAMES)
            test_shap = explainer.shap_values(dummy_scaled_df)

            if isinstance(test_shap, list) and len(test_shap) == 2:
                 shap_values_expected_len = 2
                 print("   -> SHAP explainer created for binary output (expects list).")
            elif isinstance(test_shap, np.ndarray):
                 shap_values_expected_len = 1
                 print("   -> SHAP explainer created for single output (expects numpy array).")
            else:
                 print(f"   -> Warning: Unexpected SHAP output format: {type(test_shap)}. Assuming single output.")
                 shap_values_expected_len = 1
            print("✅ SHAP Explainer created successfully.")

        except Exception as shap_error:
            print(f"❌ ERROR: Could not create SHAP explainer: {shap_error}")
            explainer = None
    else:
         if not scaler: print("Model/Explainer loading skipped because Scaler failed.")
         else: print(f"❌ ERROR: Model file not found at {MODEL_PATH}")
         model = None; explainer = None
except Exception as e:
    print(f"❌ Error during initial EEG model loading: {e}")
    model = None; scaler = None; explainer = None

# --- Load Face Model & Encoder ---
face_model = None
face_encoder = None

try:
    if os.path.exists(FACE_MODEL_PATH):
        face_model = load_model(FACE_MODEL_PATH)
        try:
             model_input_shape_actual = face_model.input_shape[1:]
             if model_input_shape_actual == FACE_MODEL_INPUT_SHAPE:
                 print(f"✅ Face CNN model loaded successfully. Input shape verified: {FACE_MODEL_INPUT_SHAPE}")
             else:
                 print(f"⚠️ WARNING: Face CNN model loaded, but input shape {model_input_shape_actual} doesn't match expected {FACE_MODEL_INPUT_SHAPE}.")
        except Exception as shape_err:
             print(f"✅ Face CNN model loaded, but could not verify input shape: {shape_err}")
    else:
        print(f"❌ ERROR: Face model file not found at {FACE_MODEL_PATH}")

    if os.path.exists(FACE_ENCODER_PATH):
        face_encoder = joblib.load(FACE_ENCODER_PATH)
        print(f"✅ Face LabelEncoder loaded successfully. Classes: {face_encoder.classes_}")
    else:
        print(f"❌ ERROR: Face encoder file not found at {FACE_ENCODER_PATH}")

except Exception as e:
    print(f"❌ Error loading face model/encoder: {e}")
    face_model = None
    face_encoder = None

# --- Create FastAPI App ---
app = FastAPI(title="NeoDetect Backend")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- Root Endpoint ---
@app.get("/")
async def read_root():
    return {"message": "NeoDetect Backend is running!"}

# --- Feature Extraction & Processing Functions (Keep your full, working versions) ---
def calculate_band_powers(epoch_data, sfreq):
    # ... (Your existing function code) ...
    mean_epoch_data = np.mean(epoch_data, axis=0); nperseg_val = min(int(sfreq*2), epoch_data.shape[1]);
    if nperseg_val <= 0: return {f'bp_{band}': 0.0 for band in BANDS};
    freqs, psd = welch(mean_epoch_data, sfreq, nperseg=nperseg_val); powers = {};
    for band, (low, high) in BANDS.items(): band_mask = (freqs >= low) & (freqs < high); powers[f'bp_{band}'] = float(np.sum(psd[band_mask])) if np.any(band_mask) else 0.0;
    return powers

def calculate_antropy_features(epoch_data, sfreq):
    # ... (Your existing function code) ...
    features = {}; epsilon = 1e-10; hjorth_activity = np.var(epoch_data, axis=1);
    hjorth_mobility = np.zeros(epoch_data.shape[0]); hjorth_complexity = np.zeros(epoch_data.shape[0]); spec_ent = np.zeros(epoch_data.shape[0]);
    if epoch_data.shape[1] > 1:
        diff_epoch = np.diff(epoch_data, axis=1); diff_epoch_var = np.var(diff_epoch, axis=1); valid_activity_mask = hjorth_activity > epsilon;
        if np.any(valid_activity_mask): hjorth_mobility[valid_activity_mask] = np.sqrt(diff_epoch_var[valid_activity_mask] / hjorth_activity[valid_activity_mask]);
        if diff_epoch.shape[1] > 1:
            diff2_epoch = np.diff(diff_epoch, axis=1); diff2_epoch_var = np.var(diff2_epoch, axis=1); valid_mobility_mask = hjorth_mobility > epsilon; valid_diff_var_mask = diff_epoch_var > epsilon;
            valid_complexity_mask = valid_mobility_mask & valid_diff_var_mask;
            if np.any(valid_complexity_mask): hjorth_complexity[valid_complexity_mask] = np.sqrt(diff2_epoch_var[valid_complexity_mask] / diff_epoch_var[valid_complexity_mask]) / hjorth_mobility[valid_complexity_mask];
    nperseg_val = min(int(sfreq*2), epoch_data.shape[1]);
    if epoch_data.shape[1] >= nperseg_val and nperseg_val > 0:
        try:
             if np.all(np.var(epoch_data, axis=1) < epsilon): spec_ent = np.zeros(epoch_data.shape[0]);
             else: spec_ent = ant.spectral_entropy(epoch_data, sf=sfreq, method='welch', nperseg=nperseg_val, axis=1);
        except Exception as e: print(f"Warning: Spectral entropy failed: {e}. Setting to 0.");
    features['hjorth_activity'] = float(np.nan_to_num(np.mean(hjorth_activity))); features['hjorth_mobility'] = float(np.nan_to_num(np.mean(hjorth_mobility)));
    features['hjorth_complexity'] = float(np.nan_to_num(np.mean(hjorth_complexity))); features['spectral_entropy'] = float(np.nan_to_num(np.mean(spec_ent)));
    return features

def extract_features_for_epoch(_epoch_data, sfreq):
    # ... (Your existing function code) ...
    band_powers = calculate_band_powers(_epoch_data, sfreq); antropy_features = calculate_antropy_features(_epoch_data, sfreq);
    all_features = {**band_powers, **antropy_features}; ordered_features = [all_features.get(name, 0.0) for name in FEATURE_NAMES];
    return np.array(ordered_features)

def process_edf_content(file_path: str):
    # ... (Your existing function code) ...
    all_epoch_features_list = []; raw = None;
    try:
        raw = mne.io.read_raw_edf(file_path, preload=True, verbose='ERROR');
        raw.resample(RESAMPLE_FREQ, npad='auto', verbose='WARNING'); raw.filter(l_freq=FILTER_L_FREQ, h_freq=FILTER_H_FREQ, verbose='WARNING', fir_design='firwin'); raw.pick_types(eeg=True);
        epochs = mne.make_fixed_length_epochs(raw, duration=EPOCH_DURATION_S, overlap=EPOCH_DURATION_S / 2, preload=True, verbose='WARNING');
        reject_criteria = dict(eeg=1000e-6); flat_criteria = dict(eeg=1e-6);
        initial_epoch_count = len(epochs); epochs.drop_bad(reject=reject_criteria, flat=flat_criteria, verbose='WARNING'); final_epoch_count = len(epochs);
        print(f"Artifact rejection: Kept {final_epoch_count}/{initial_epoch_count} epochs.");
        if final_epoch_count == 0: print("No clean epochs found."); return None;
        sfreq = epochs.info['sfreq']; all_epoch_data = epochs.get_data(copy=False); print(f"Extracting features for {len(all_epoch_data)} epochs...");
        for epoch_idx in range(len(all_epoch_data)):
            epoch_data = all_epoch_data[epoch_idx]; min_samples_needed = sfreq * 1;
            if epoch_data.shape[1] < min_samples_needed: print(f"Warning: Skipping epoch {epoch_idx}, too short."); continue;
            features = extract_features_for_epoch(epoch_data, sfreq); all_epoch_features_list.append(features);
        if not all_epoch_features_list: print("Feature list is empty."); return pd.DataFrame(columns=FEATURE_NAMES);
        feature_df = pd.DataFrame(all_epoch_features_list, columns=FEATURE_NAMES);
        feature_df.replace([np.inf, -np.inf], np.nan, inplace=True); feature_df.fillna(0, inplace=True);
        return feature_df
    except Exception as e:
        print(f"❌ Error processing EDF: {e}"); raise HTTPException(status_code=500, detail=f"Error processing EDF: {type(e).__name__}");
    finally:
        if raw is not None: del raw;

# --- File Upload Prediction Endpoint (Returns Metadata, Waves, SHAP) ---
@app.post("/predict/")
async def predict_pain(file: UploadFile = File(...)):
    # ... (Your existing /predict/ endpoint code - it's already correct) ...
    if model is None or scaler is None or explainer is None:
        raise HTTPException(status_code=503, detail="Backend model components not ready.")
    if not file.filename.lower().endswith('.edf'):
        raise HTTPException(status_code=400, detail="Invalid file type.")
    print(f"\n--- New Prediction Request ---"); print(f"Received file: {file.filename}");
    temp_file_path = None; raw_data_for_frontend: Dict[str, Any] = {"times": [], "signals": {}, "channels_sent": [], "error": "Extraction not attempted"};
    metadata_for_frontend: Dict[str, Any] = {"error": "Extraction not attempted"}; shap_explanation = None;
    message = "Processing started."; num_epochs = 0; avg_pain_prob = -1.0; overall_pred = -1;
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as temp_file:
            shutil.copyfileobj(file.file, temp_file); temp_file_path = temp_file.name;
        print(f"File saved temporarily to: {temp_file_path}");
        try:
            print("Extracting metadata and raw segment..."); raw_temp = mne.io.read_raw_edf(temp_file_path, preload=False, verbose='ERROR');
            sfreq = raw_temp.info['sfreq']; ch_names = raw_temp.ch_names; n_times = raw_temp.n_times; duration = n_times / sfreq;
            metadata_for_frontend = {"filename": file.filename, "sampling_frequency": sfreq, "num_channels": len(ch_names), "channel_names": ch_names[:20], "duration_seconds": round(duration, 2), "num_samples": n_times, "error": None};
            print("Metadata extracted."); eeg_channel_indices = mne.pick_types(raw_temp.info, eeg=True);
            picks = eeg_channel_indices[:MAX_CHANNELS_TO_SEND]; picked_ch_names = [ch_names[i] for i in picks]; stop_sample = min(n_times, int(MAX_DURATION_TO_SEND * sfreq));
            if stop_sample > 0 and len(picks) > 0:
                 segment_data, segment_times = raw_temp.get_data(picks=picks, start=0, stop=stop_sample, return_times=True); segment_data_uV = segment_data * 1e6;
                 raw_data_for_frontend = {"times": segment_times.tolist(), "signals": {ch_name: signal.tolist() for ch_name, signal in zip(picked_ch_names, segment_data_uV)}, "channels_sent": picked_ch_names, "error": None};
                 print(f"Raw data segment extracted.");
            else: print("Not enough data/channels for raw segment."); raw_data_for_frontend["error"] = "Insufficient data/channels";
            del raw_temp;
        except Exception as meta_error: print(f"❌ Error extracting metadata/raw segment: {meta_error}"); metadata_for_frontend["error"] = str(meta_error); raw_data_for_frontend["error"] = str(meta_error);
        print("Processing temporary EDF file for prediction..."); features_df = process_edf_content(temp_file_path);
        if features_df is None or features_df.empty:
            message = "No valid data after cleaning." if features_df is None else "Feature extraction yielded no results.";
            num_epochs = 0; avg_pain_prob = -1.0; overall_pred = -1; shap_explanation = {"error": "No features to explain."};
        else:
            num_epochs = len(features_df); print(f"Features extracted, shape: {features_df.shape}"); print("Scaling features...");
            features_scaled_np = scaler.transform(features_df); print("Making predictions...");
            probabilities = model.predict_proba(features_scaled_np); avg_pain_prob = float(np.mean(probabilities[:, 1]));
            overall_pred = int(1 if avg_pain_prob > 0.5 else 0); message = "Prediction successful"; print(f"Prediction complete. Overall: {overall_pred}, Avg Prob: {avg_pain_prob:.4f}");
            print("Calculating SHAP values...");
            try:
                features_scaled_df = pd.DataFrame(features_scaled_np, columns=FEATURE_NAMES);
                shap_values = explainer.shap_values(features_scaled_df);
                if shap_values_expected_len == 2: shap_values_pos_class = shap_values[1];
                else: shap_values_pos_class = shap_values;
                mean_abs_shap = np.mean(np.abs(shap_values_pos_class), axis=0); mean_shap = np.mean(shap_values_pos_class, axis=0);
                shap_abs_dict = {name: float(val) for name, val in zip(FEATURE_NAMES, mean_abs_shap)}; shap_dir_dict = {name: float(val) for name, val in zip(FEATURE_NAMES, mean_shap)};
                sorted_abs_shap = sorted(shap_abs_dict.items(), key=lambda item: item[1], reverse=True);
                shap_explanation = {"average_absolute_impact": dict(sorted_abs_shap), "average_directional_impact": shap_dir_dict};
                print("✅ SHAP values calculated.");
            except Exception as shap_calc_error: print(f"❌ ERROR calculating SHAP values: {shap_calc_error}"); shap_explanation = {"error": f"SHAP calculation failed: {type(shap_calc_error).__name__}"};
        safe_metadata: Dict[str, Any] = {};
        if metadata_for_frontend:
            for key, value in metadata_for_frontend.items():
                if isinstance(value, (np.integer, np.int64)): safe_metadata[key] = int(value);
                elif isinstance(value, (np.floating, np.float64)): safe_metadata[key] = float(value);
                elif isinstance(value, np.ndarray): safe_metadata[key] = value.tolist();
                elif isinstance(value, list): safe_metadata[key] = [str(item) if not isinstance(item, (str, int, float, bool, type(None))) else item for item in value];
                else: safe_metadata[key] = value;
        safe_raw_data: Dict[str, Any] = {"times": raw_data_for_frontend.get("times", []), "signals": raw_data_for_frontend.get("signals", {}), "channels_sent": raw_data_for_frontend.get("channels_sent", []), "error": raw_data_for_frontend.get("error")};
        results = {"message": message, "metadata": safe_metadata, "raw_data_segment": safe_raw_data, "overall_prediction": int(overall_pred), "average_pain_probability": float(avg_pain_prob), "num_clean_epochs": int(num_epochs), "shap_explanation": shap_explanation};
        print("--- Prediction Request Finished ---"); return results;
    except HTTPException as e: print(f"HTTP Exception: {e.detail}"); raise e;
    except Exception as e: print(f"❌ Unexpected error in /predict: {type(e).__name__} - {e}"); raise HTTPException(status_code=500, detail="Unexpected server error.");
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try: os.remove(temp_file_path); print(f"   -> Temp file deleted.");
            except Exception as cl_e: print(f"   -> ⚠️ Error deleting temp file: {cl_e}");
        await file.close();


# --- Pydantic model for simulation input ---
class SimulationFeatures(BaseModel):
    features: conlist(item_type=float, min_length=len(FEATURE_NAMES), max_length=len(FEATURE_NAMES))

# --- Simulation Prediction Endpoint ---
@app.post("/predict_simulation/", response_model=dict)
async def predict_simulation(sim_input: SimulationFeatures):
    # ... (Your existing /predict_simulation/ endpoint code - it's correct) ...
    if model is None or scaler is None: raise HTTPException(status_code=503, detail="Model/Scaler not available.");
    print(f"Received simulation features: {sim_input.features}");
    try:
        features_array = np.array(sim_input.features).reshape(1, -1); features_df_sim = pd.DataFrame(features_array, columns=FEATURE_NAMES);
        print("Scaling simulation features..."); features_scaled = scaler.transform(features_df_sim);
        print("Making simulation prediction..."); prediction = model.predict(features_scaled)[0]; probability = model.predict_proba(features_scaled)[0];
        pain_prob = float(probability[1]); pred_label = int(prediction);
        print(f"Simulation complete. Pred: {pred_label}, Prob: {pain_prob:.4f}");
        results = {"message": "Simulation successful", "prediction": pred_label, "pain_probability": pain_prob}; return results;
    except Exception as e: print(f"❌ Error during simulation: {e}"); raise HTTPException(status_code=500, detail="Server error during simulation.");


# =================================================================
# --- NEW CODE: FACE PREDICTION ENDPOINT ---
# =================================================================

# Pydantic model for receiving base64 image data
class ImageData(BaseModel):
    image_base64: str # Expecting a base64 encoded image string (e.g., "data:image/jpeg;base64,...")

@app.post("/predict_face/", response_model=dict)
async def predict_face_pain(image_data: ImageData):
    """
    Receives a base64 encoded webcam image, preprocesses it,
    and returns a prediction from the Face CNN model.
    """
    if face_model is None or face_encoder is None:
        raise HTTPException(status_code=503, detail="Face model components not ready.")

    try:
        # 1. Decode Base64 Image
        try:
            # Find the comma that separates the header (e.g., "data:image/jpeg;base64,")
            header, encoded = image_data.image_base64.split(",", 1)
            image_bytes = base64.b64decode(encoded)
        except Exception:
             # Fallback if no header is present
             try:
                  image_bytes = base64.b64decode(image_data.image_base64)
             except Exception as decode_err:
                  print(f"❌ Invalid base64 image data: {decode_err}")
                  raise HTTPException(status_code=400, detail="Invalid base64 image format.")

        # 2. Convert bytes to OpenCV image format
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR) # Read as color image
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image data.")

        # 3. Preprocess Image (Based on your friend's details)
        # Resize to (64, 64)
        img_resized = cv2.resize(img, (FACE_MODEL_INPUT_SHAPE[1], FACE_MODEL_INPUT_SHAPE[0])) # (Width, Height) for cv2.resize
        # Convert BGR (OpenCV default) to RGB (Model expects)
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        # Normalize pixel values
        img_normalized = img_rgb / 255.0
        # Add batch dimension (model expects 1, 64, 64, 3)
        img_batch = np.expand_dims(img_normalized, axis=0)

        # 4. Predict using CNN
        print("Making face prediction...")
        prediction_probs = face_model.predict(img_batch)[0] # Get probabilities for the single image [prob_no_pain, prob_pain]
        predicted_index = np.argmax(prediction_probs) # Get index of highest probability (0 or 1)

        # 5. Decode Label
        try:
            # Use encoder to get string label ("No_Pain" or "Pain")
            predicted_label_str = face_encoder.inverse_transform([predicted_index])[0]
            # Convert string label to our numeric standard (0=No_Pain, 1=Pain)
            predicted_label_num = 1 if 'pain' in predicted_label_str.lower() else 0
        except Exception as encode_err:
            print(f"⚠️ Warning: Face label encoder failed ({encode_err}). Falling back to index.")
            # Fallback: Assume index 1 is Pain if encoder fails
            predicted_label_num = int(predicted_index)

        # Get the probability for the "Pain" class (assuming 'Pain' is index 1)
        pain_probability = float(prediction_probs[face_encoder.classes_.tolist().index('Pain')])

        print(f"Face prediction complete. Pred Label: {predicted_label_num}, Pain Prob: {pain_probability:.4f}")

        return {
            "message": "Face prediction successful",
            "face_prediction": predicted_label_num, # 0 or 1
            "face_pain_probability": pain_probability
        }

    except HTTPException as e:
        raise e # Re-raise FastAPI specific errors
    except Exception as e:
        print(f"❌ Error during face prediction: {type(e).__name__} - {e}")
        # Log full traceback here in production
        raise HTTPException(status_code=500, detail=f"Server error during face prediction. Check logs.")

# =================================================================
# --- Run the server ---
# =================================================================

if __name__ == "__main__":
    import uvicorn
    print("--- Starting NeoDetect Backend Server ---")
    print(f"EEG Model Path: {MODEL_PATH} (Loaded: {'Yes' if model else 'NO'})")
    print(f"EEG Scaler Path: {SCALER_PATH} (Loaded: {'Yes' if scaler else 'NO'})")
    print(f"SHAP Explainer Loaded: {'Yes' if explainer else 'NO'}")
    print(f"Face Model Path: {FACE_MODEL_PATH} (Loaded: {'Yes' if face_model else 'NO'})")
    print(f"Face Encoder Path: {FACE_ENCODER_PATH} (Loaded: {'Yes' if face_encoder else 'NO'})")
    print("-----------------------------------------")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)