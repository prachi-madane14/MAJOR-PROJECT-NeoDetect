// frontend/src/components/ui/MultimodalSimulation.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Siren, BarChart3, Camera, AlertTriangle, CheckCircle, Brain, Play, Square, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

// --- Interfaces ---
interface FacePredictionResponse {
  message: string;
  face_prediction: number;
  face_pain_probability: number;
}

interface WaveDataPoint {
  time: number;
  value1: number;
  value2: number;
  value3: number;
  value4: number;
}

// --- Constants ---
const MAX_WAVE_POINTS = 300;
const UPDATE_INTERVAL_MS = 100;
const SIM_WAVE_COLORS = ["#00FF00", "#1E90FF", "#FFD700", "#FF6347"];
const SIM_WAVE_PAIN_COLORS = ["#FF6347", "#FF4500", "#DC143C", "#FF0000"];

const MultimodalSimulation = () => {
  const [isSimulatingMulti, setIsSimulatingMulti] = useState(false);
  const [waveData, setWaveData] = useState<WaveDataPoint[]>([]);
  const [isPainEvent, setIsPainEvent] = useState(false);
  const [eegSimPrediction, setEegSimPrediction] = useState<{ prediction: number; probability: number } | null>(null);
  const [facePrediction, setFacePrediction] = useState<{ prediction: number; probability: number } | null>(null);
  const [fusedPrediction, setFusedPrediction] = useState<{ prediction: number; confidence: string } | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); // store uploaded image

  const waveTimeRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // --- EEG Wave Generation ---
  const generateNextWavePoint = useCallback(() => {
    waveTimeRef.current += 1;
    const time = waveTimeRef.current;
    const x = time / 50;

    let baseAmp = isPainEvent ? 65 + Math.random() * 10 : 40;
    let baseFreqScale = isPainEvent ? 1.5 + Math.random() * 0.5 : 1.0;
    let baseNoise = isPainEvent ? 0.5 : 0.2;

    const channelsConfig = [
      { freq: 0.5, ampMod: 1.0, noiseMod: 1.0, phase: 0 },
      { freq: 2.0, ampMod: 0.6, noiseMod: 0.8, phase: Math.PI / 4 },
      { freq: 8.0, ampMod: isPainEvent ? 0.5 : 0.25, noiseMod: 1.2, phase: Math.PI / 2 },
      { freq: 12.0, ampMod: isPainEvent ? 0.4 : 0.15, noiseMod: 1.5, phase: Math.PI },
    ];

    const values: any = {};
    channelsConfig.forEach((ch, index) => {
      const freqScale = baseFreqScale * (1 + (Math.random() - 0.5) * 0.1);
      const ampScale = baseAmp * ch.ampMod * (1 + (Math.random() - 0.5) * 0.2);
      const noise = (Math.random() - 0.5) * baseNoise * ch.noiseMod;
      const wave = Math.sin(x * 2 * Math.PI * ch.freq * freqScale + ch.phase);
      const value = wave * ampScale + noise * baseAmp;
      values[`value${index + 1}`] = Math.max(-150, Math.min(150, value));
    });

    return { time, ...values };
  }, [isPainEvent]);

  // --- FACE Prediction Function (Using Uploaded Image) ---
  const getFacePrediction = useCallback(async () => {
    if (!uploadedImage || isProcessingFace) return;

    setIsProcessingFace(true);
    setFaceError(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict_face/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: uploadedImage }),
      });

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData?.detail || `HTTP error ${response.status}`);

      if (typeof responseData.face_prediction === "number" && typeof responseData.face_pain_probability === "number") {
        setFacePrediction({
          prediction: responseData.face_prediction,
          probability: responseData.face_pain_probability,
        });
      } else throw new Error("Unexpected response format");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Face prediction failed.";
      setFaceError(message);
      setFacePrediction(null);
    } finally {
      setIsProcessingFace(false);
    }
  }, [uploadedImage, isProcessingFace]);

  // --- FUSION LOGIC ---
  const calculateFusedPrediction = useCallback(() => {
    if (!isSimulatingMulti || !eegSimPrediction || !facePrediction) {
      setFusedPrediction(null);
      return;
    }

    const eegPain = eegSimPrediction.prediction === 1;
    const facePain = facePrediction.prediction === 1;

    if (eegPain && facePain)
      setFusedPrediction({ prediction: 1, confidence: "High (EEG + Face)" });
    else if (!eegPain && facePain)
      setFusedPrediction({ prediction: 1, confidence: "Medium (Face Only)" });
    else if (eegPain && !facePain)
      setFusedPrediction({ prediction: 0, confidence: "Low (EEG Only - Noise?)" });
    else setFusedPrediction({ prediction: 0, confidence: "High (Baseline)" });
  }, [isSimulatingMulti, eegSimPrediction, facePrediction]);

  // --- Live EEG Simulation ---
  useEffect(() => {
    if (isSimulatingMulti) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const newPoint = generateNextWavePoint();
        setWaveData((prev) => [...prev, newPoint].slice(-MAX_WAVE_POINTS));
        if (isPainEvent)
          setEegSimPrediction({ prediction: 1, probability: 0.75 + Math.random() * 0.15 });
        else setEegSimPrediction({ prediction: 0, probability: 0.1 + Math.random() * 0.1 });
      }, UPDATE_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [isSimulatingMulti, isPainEvent, generateNextWavePoint]);

  useEffect(() => {
    calculateFusedPrediction();
  }, [eegSimPrediction, facePrediction, calculateFusedPrediction]);

  // --- Controls ---
  const startSimulation = () => {
    setWaveData([]);
    waveTimeRef.current = 0;
    setIsPainEvent(false);
    setEegSimPrediction(null);
    setFacePrediction(null);
    setFusedPrediction(null);
    setFaceError(null);
    toast({ title: "Simulation Started" });
    setIsSimulatingMulti(true);
  };

  const stopSimulation = () => {
    setIsSimulatingMulti(false);
    toast({ title: "Simulation Stopped" });
  };

  const triggerPainEvent = () => {
    if (!isSimulatingMulti || isPainEvent) return;
    setIsPainEvent(true);
    setTimeout(() => setIsPainEvent(false), 5000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  // --- JSX ---
  return (
    <section id="multimodal-simulation" className="py-16 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 md:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">🔬 Multimodal Simulation</h2>
          <p className="text-md md:text-lg text-gray-600">EEG + Face image analysis in real-time.</p>
        </div>

        <Card className="p-6 md:p-8 shadow-xl bg-white/90">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
            {!isSimulatingMulti ? (
              <Button onClick={startSimulation} className="bg-green-600 text-white">
                <Play className="mr-2 h-5 w-5" /> Start
              </Button>
            ) : (
              <Button variant="outline" onClick={stopSimulation} className="border-red-500 text-red-600">
                <Square className="mr-2 h-5 w-5" /> Stop
              </Button>
            )}
            <Button onClick={triggerPainEvent} disabled={!isSimulatingMulti || isPainEvent} className="bg-red-600 hover:bg-red-700 text-white">
              <Siren className="mr-2 h-5 w-5" /> Simulate Pain
            </Button>
          </div>

          {isSimulatingMulti ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* EEG */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                  <Brain size={18} className="mr-2 text-indigo-600" /> EEG Simulation
                </h3>
                <Card className="bg-gray-900 p-2 rounded-lg shadow-inner" style={{ height: "180px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={waveData}>
                      <YAxis domain={[-160, 160]} tick={false} axisLine={false} />
                      <XAxis dataKey="time" tick={false} axisLine={false} />
                      {[1, 2, 3, 4].map((i) => (
                        <Line
                          key={i}
                          type="monotone"
                          dataKey={`value${i}`}
                          stroke={isPainEvent ? SIM_WAVE_PAIN_COLORS[i - 1] : SIM_WAVE_COLORS[i - 1]}
                          strokeWidth={1}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* FACE Upload */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                  <Camera size={18} className="mr-2 text-indigo-600" /> Facial Analysis
                </h3>
                <Card className="p-4 bg-gray-100 flex flex-col items-center justify-center space-y-3">
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                  {uploadedImage && (
                    <img src={uploadedImage} alt="Uploaded face" className="w-40 h-40 object-cover rounded-md" />
                  )}
                  <Button
                    disabled={!uploadedImage || isProcessingFace}
                    onClick={getFacePrediction}
                    className="bg-indigo-600 text-white mt-2"
                  >
                    <Upload className="mr-2 h-4 w-4" /> Analyze Face
                  </Button>
                </Card>
                {facePrediction && (
                  <Card className="p-3 mt-3 text-center bg-gray-50">
                    <p className={`font-semibold ${facePrediction.prediction ? "text-red-700" : "text-green-700"}`}>
                      {facePrediction.prediction ? "Pain Likely" : "No Pain"}
                    </p>
                    <p className="text-xs text-gray-600">
                      ({(facePrediction.probability * 100).toFixed(0)}% Prob.)
                    </p>
                  </Card>
                )}
              </div>

              {/* FUSION */}
              <div className="flex flex-col items-center justify-center">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                  <BarChart3 size={18} className="mr-2 text-indigo-600" /> Fused Result
                </h3>
                <Card className="p-6 mt-2 text-center bg-gradient-to-br from-indigo-50 to-purple-100 border-indigo-200 shadow-lg">
                  {fusedPrediction ? (
                    <>
                      {fusedPrediction.prediction ? (
                        <AlertTriangle className="text-red-500 h-12 w-12 mb-2 animate-pulse" />
                      ) : (
                        <CheckCircle className="text-green-500 h-12 w-12 mb-2" />
                      )}
                      <h4
                        className={`text-xl font-bold ${
                          fusedPrediction.prediction ? "text-red-700" : "text-green-700"
                        }`}
                      >
                        {fusedPrediction.prediction ? "Pain Detected" : "No Pain Detected"}
                      </h4>
                      <p className="text-sm text-gray-700 mt-1">
                        Confidence: {fusedPrediction.confidence}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">Awaiting input...</p>
                  )}
                </Card>
              </div>
            </div>
          ) : (
            <p className="text-center py-12 text-gray-500">Click Start to begin simulation.</p>
          )}
        </Card>
      </div>
    </section>
  );
};

export default MultimodalSimulation;
