// frontend/src/components/ui/EEGSimulation.tsx (More Robust)

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { BarChart3, Brain, Zap, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

// Interfaces & Constants (Ensure these match your actual features and initial values)
interface FeatureValues {
  bp_delta: number; bp_theta: number; bp_alpha: number; bp_beta: number; bp_gamma: number;
  hjorth_activity: number; hjorth_mobility: number; hjorth_complexity: number; spectral_entropy: number;
}
const FEATURE_NAMES_ORDERED: (keyof FeatureValues)[] = [
    'bp_delta', 'bp_theta', 'bp_alpha', 'bp_beta', 'bp_gamma',
    'hjorth_activity', 'hjorth_mobility', 'hjorth_complexity', 'spectral_entropy'
];
const initialFeatureValues: FeatureValues = {
  bp_delta: 5e-10, bp_theta: 5e-11, bp_alpha: 5e-12, bp_beta: 5e-12, bp_gamma: 5e-13,
  hjorth_activity: 5e-10, hjorth_mobility: 0.2, hjorth_complexity: 4.0, spectral_entropy: 3.0,
};

const EEGSimulation = () => {
  const [featureValues, setFeatureValues] = useState<FeatureValues>(initialFeatureValues);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimPredictionResponse | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const { toast } = useToast();

  // Function to call the backend
  const runSimulationUpdate = useCallback(async (currentFeatureValues: FeatureValues) => {
    if (isSimulating) return;
    setIsSimulating(true);

    // --- Data Validation ---
    const orderedValues = FEATURE_NAMES_ORDERED.map(name => currentFeatureValues[name]);
    // Check if all values are valid numbers before sending
    if (orderedValues.some(val => typeof val !== 'number' || isNaN(val))) {
      console.error("Invalid feature values detected before sending:", orderedValues);
      setSimError("Invalid feature values generated. Please reset sliders or adjust.");
      setIsSimulating(false);
      return; // Don't send invalid data
    }
    // console.log('Sending simulation features:', orderedValues); // Keep for debugging if needed

    try {
      const response = await fetch("http://127.0.0.1:8000/predict_simulation/", {
        method: "POST", headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: orderedValues }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        const errorMessage = responseData?.detail || response.statusText || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }
      if (typeof responseData?.prediction === 'number' && typeof responseData?.pain_probability === 'number') {
        setSimResult(responseData);
        setSimError(null);
      } else { throw new Error("Unexpected response data format."); }
    } catch (err) {
       const message = err instanceof Error ? err.message : "An unknown error occurred.";
       if (message !== simError) { // Avoid spamming same error
           setSimError(message);
           toast({ variant: "destructive", title: "Simulation Update Failed", description: message });
       }
    } finally {
       setIsSimulating(false);
    }
  }, [toast, isSimulating, simError]); // Dependencies

  // useEffect triggers update when featureValues change
  useEffect(() => {
    runSimulationUpdate(featureValues);
  }, [featureValues, runSimulationUpdate]); // Dependencies

  // Slider change handler
  const handleSliderChange = useCallback((featureName: keyof FeatureValues, value: number[]) => {
    setFeatureValues(prev => ({ ...prev, [featureName]: value[0] }));
  }, []);

  // Formatting Helper (Ensure it handles potential edge cases)
  const formatValue = (value: number | undefined | null): string => {
      if (value === undefined || value === null || isNaN(value)) return "N/A";
      if (value === 0) return "0.00";
      if (Math.abs(value) < 1e-3 && Math.abs(value) > 1e-15) return value.toExponential(2); // Avoid exp format for near-zero noise
      if (Math.abs(value) > 1e6) return value.toExponential(2); // Use exp for very large
      return value.toFixed(2);
  };

  // Wave Generation (Use safe access to featureValues)
  const generateWaveData = useCallback((activity: number | undefined, frequencyParam: number | undefined) => {
    const validActivity = typeof activity === 'number' && !isNaN(activity) ? activity : initialFeatureValues.hjorth_activity;
    const validFreqParam = typeof frequencyParam === 'number' && !isNaN(frequencyParam) ? frequencyParam : initialFeatureValues.hjorth_mobility;

    const dataPoints = 200; const waveData = [];
    const amplitudeScale = 1 + (Math.min(validActivity, 1e-8) / 1e-9) * 1.5;
    const frequencyScale = 1 + Math.min(validFreqParam, 0.8) * 3;
    for (let i = 0; i < dataPoints; i++) {
      const x = i / dataPoints;
      const slowWave = Math.sin(x * 2 * Math.PI * 2 * frequencyScale);
      const fastWave = 0.3 * Math.sin(x * 2 * Math.PI * 10 * frequencyScale);
      const noise = (Math.random() - 0.5) * 0.2;
      const y = (slowWave + fastWave + noise) * amplitudeScale * 50;
      waveData.push({ time: i, value: y });
    }
    return waveData;
   }, []); // No external dependencies needed here if initial values are used as fallback

  const simulatedWaveData = useMemo(() => {
    // Generate wave based on current featureValues
    return generateWaveData(featureValues?.hjorth_activity, featureValues?.hjorth_mobility);
  }, [featureValues, generateWaveData]); // Depend on featureValues and the memoized generator

  return (
    <section id="simulation" className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">🧪 Live EEG Simulation</h2>
           <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Prediction updates instantly as you adjust features.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Sliders Card */}
          <Card className="p-6 shadow-card md:col-span-2">
            <div className="flex items-center space-x-3 mb-6"><Brain className="text-primary" size={24} /><h3 className="text-xl font-semibold text-foreground">Simulated Features</h3></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {FEATURE_NAMES_ORDERED.map(featureKey => {
                  // Define min/max/step (Refine these!)
                  let min = 0, max = 1, step = 0.01;
                  if (featureKey.startsWith('bp_')) { max = 1e-9; step = 1e-12; min=0; } // Powers can't be negative
                  else if (featureKey === 'hjorth_activity') { max = 1e-9; step = 1e-12; min=0; } // Activity (Variance) can't be negative
                  else if (featureKey === 'hjorth_mobility') { max = 1.5; step = 0.01; min=0;} // Mobility >= 0
                  else if (featureKey === 'hjorth_complexity') { max = 10.0; step = 0.1; min=0; } // Complexity >= 0
                  else if (featureKey === 'spectral_entropy') { max = 5.0; step = 0.1; min=0; } // Entropy >= 0

                  const currentValue = featureValues ? featureValues[featureKey] : initialFeatureValues[featureKey];
                  const displayValue = formatValue(currentValue);

                  return (
                    <div key={featureKey} className="space-y-2">
                      <Label htmlFor={featureKey} className="text-sm font-medium capitalize flex justify-between">
                        <span>{featureKey.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">{displayValue}</span>
                      </Label>
                      <Slider id={featureKey} min={min} max={max} step={step} value={[currentValue]} onValueChange={(value) => handleSliderChange(featureKey, value)} className="w-full"/>
                    </div>
                  );
              })}
            </div>
             <div className="mt-8 text-center text-sm text-primary flex items-center justify-center">
                <Zap size={16} className="mr-2 animate-pulse"/> Live Update Active
             </div>
          </Card>

          {/* Simulation Results Card */}
          <Card className="p-6 shadow-card">
            <div className="flex items-center space-x-3 mb-6"><BarChart3 className="text-primary" size={24} /><h3 className="text-xl font-semibold text-foreground">Live Result</h3></div>
            {simError && (<div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm"><p><strong>Error:</strong> {simError}</p></div>)}

            {simResult ? (
              <div className={`p-4 rounded-lg text-center ${ simResult.prediction === 1 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                 <div className="flex items-center justify-center mb-2">{simResult.prediction === 1 ? <AlertTriangle className="text-red-600" size={24} /> : <CheckCircle className="text-green-600" size={24} />}</div>
                 <h4 className={`text-xl font-bold mb-1 ${simResult.prediction === 1 ? 'text-red-700' : 'text-green-700'}`}>{simResult.prediction === 1 ? 'Pain Likely' : 'No Pain Likely'}</h4>
                 <p className={`text-md ${simResult.prediction === 1 ? 'text-red-600' : 'text-green-600'}`}>Pain Probability: {(simResult.pain_probability * 100).toFixed(2)}%</p>
              </div>
            ) : ( !simError && <div className="text-center py-8 text-muted-foreground">{isSimulating ? "Updating..." : "Adjust sliders..."}</div> )}

            {/* Wave Plot */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-foreground mb-3">Simulated EEG Wave</h4>
              <ResponsiveContainer width="100%" height={150}>
                 <LineChart data={simulatedWaveData} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                  <YAxis domain={[-150, 150]} hide/><XAxis dataKey="time" hide/>
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
             </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default EEGSimulation;