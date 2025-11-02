// frontend/src/components/ui/AnalysisPipeline.tsx (FINAL COMPLETE CODE)

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Upload, FileText, CheckCircle, Info, Brain, BarChart3, Play,
    AlertTriangle, FileWarning, Activity, Siren, X, Zap, Loader2 // Added Loader2 and X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    LineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend
} from 'recharts'; // Removed unused Recharts components
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; // Ensure Badge is imported

// --- Interfaces (Must match backend) ---
interface Metadata {
    filename?: string; sampling_frequency?: number; num_channels?: number;
    channel_names?: string[]; duration_seconds?: number; num_samples?: number; error?: string;
}
interface RawDataSegment {
    times?: number[]; signals?: { [key: string]: number[] };
    channels_sent?: string[]; error?: string;
}
interface PredictionResponse {
    message: string; metadata?: Metadata; raw_data_segment?: RawDataSegment;
    overall_prediction: number; average_pain_probability: number; num_clean_epochs: number;
}
interface WaveDataPoint { time: number; value: number; }

// --- Constants ---
const MAX_WAVE_POINTS = 300; // Smoother scroll
const WAVE_UPDATE_INTERVAL_MS = 35; // Faster update
const WAVE_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"]; // Colors for raw data plot
const SIM_WAVE_NORMAL_COLOR = "#00FF00"; // Neon Green
const SIM_WAVE_PAIN_COLOR = "#FF6347"; // Tomato Red

const AnalysisPipeline = () => {
    // --- States ---
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
    const [result, setResult] = useState<PredictionResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSimulatingLive, setIsSimulatingLive] = useState(false);
    const [waveData, setWaveData] = useState<WaveDataPoint[]>([]);
    const [isPainEvent, setIsPainEvent] = useState(false);
    const [livePrediction, setLivePrediction] = useState<{ prediction: number, probability: number } | null>(null);
    const waveTimeRef = useRef(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();

    // --- Helper to format raw wave data for Recharts ---
    const formatRawWaveDataForChart = (rawData: RawDataSegment | undefined) => {
        if (!rawData || !rawData.times || !rawData.signals || rawData.error) { return []; }
        const chartData: any[] = [];
        const channels = rawData.channels_sent || Object.keys(rawData.signals);
        // Limit number of points sent to chart for performance if necessary
        const maxPointsToPlot = 5000;
        const step = Math.max(1, Math.floor(rawData.times.length / maxPointsToPlot));

        for (let i = 0; i < rawData.times.length; i += step) {
            const point: any = { time: rawData.times[i] };
            channels.forEach(chName => {
                if (rawData.signals && rawData.signals[chName]) {
                    // Scaling for visualization might be needed depending on signal amplitude
                    point[chName] = rawData.signals[chName][i]; // Using direct µV values from backend
                }
            });
            chartData.push(point);
        }
        return chartData;
    };


    // --- File Upload & Prediction Logic ---
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setSelectedFile(file || null);
        setResult(null); setError(null);
        if (file) {
            if (isSimulatingLive) setIsSimulatingLive(false);
            setLivePrediction(null);
            toast({ title: "File Selected", description: file.name });
        }
    };

    const runPrediction = async () => {
        if (!selectedFile) { return; }
        setIsAnalyzingFile(true); setResult(null); setError(null);
        const formData = new FormData(); formData.append("file", selectedFile);
        try {
            const response = await fetch("http://127.0.0.1:8000/predict/", { method: "POST", body: formData });
            const responseData = await response.json();
            if (!response.ok) { throw new Error(responseData?.detail || `HTTP error ${response.status}`); }
            if (typeof responseData?.overall_prediction === 'number' && typeof responseData?.average_pain_probability === 'number') {
                setResult(responseData as PredictionResponse);
                toast({ title: "Analysis Complete", description: responseData.message || "Prediction finished." });
            } else { throw new Error("Received unexpected data format from the server."); }
        } catch (err) {
            console.error("Prediction failed:", err);
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(message);
            toast({ variant: "destructive", title: "Analysis Failed", description: message });
        } finally { setIsAnalyzingFile(false); }
    };


    // --- Live Wave Generation (Simulation Logic) ---
    const generateNextWavePoint = useCallback(() => {
        waveTimeRef.current += 1;
        const time = waveTimeRef.current;
        let amplitudeScale = 1.0; let frequencyScale = 1.0; let noiseLevel = 0.15; // Slightly reduced baseline noise

        if (isPainEvent) { // Simulate Pain Event changes
            amplitudeScale = 1.8 + Math.random() * 0.4;
            frequencyScale = 1.5 + Math.random() * 0.5;
            noiseLevel = 0.4; // More noise during event
        }

        const x = time / 50; // Controls speed
        const slowWave = Math.sin(x * 2 * Math.PI * 0.5 * frequencyScale);
        const midWave = 0.4 * Math.sin(x * 2 * Math.PI * 2 * frequencyScale);
        const fastWave = (isPainEvent ? 0.6 : 0.2) * Math.sin(x * 2 * Math.PI * 8 * frequencyScale); // More pronounced fast wave during pain
        const noise = (Math.random() - 0.5) * noiseLevel;

        const value = (slowWave + midWave + fastWave + noise) * 50 * amplitudeScale;
        // Clamp values to prevent extreme spikes in simulation plot
        return { time, value: Math.max(-150, Math.min(150, value)) };
    }, [isPainEvent]);


    // --- Effect to run the live simulation ---
    useEffect(() => {
        if (isSimulatingLive) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                const newPoint = generateNextWavePoint();
                setWaveData(prevData => [...prevData, newPoint].slice(-MAX_WAVE_POINTS));

                // Simulate Prediction based on Event State
                if (isPainEvent) {
                    setLivePrediction({ prediction: 1, probability: 0.75 + Math.random() * 0.15 }); // High probability
                } else {
                    setLivePrediction({ prediction: 0, probability: 0.10 + Math.random() * 0.10 }); // Low probability
                }

            }, WAVE_UPDATE_INTERVAL_MS);
        } else {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
        // Cleanup function
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); } };
    }, [isSimulatingLive, isPainEvent, generateNextWavePoint]); // Dependencies

    // --- Simulation Control Handlers ---
    const toggleLiveSimulation = (checked: boolean) => {
        setIsSimulatingLive(checked);
        if (checked) { // Starting simulation
            setWaveData([]); waveTimeRef.current = 0; setIsPainEvent(false);
            setLivePrediction(null); setSelectedFile(null); setResult(null); setError(null);
        } else { // Stopping simulation
            setLivePrediction(null);
        }
    };

    const triggerPainEvent = () => {
        if (!isSimulatingLive || isPainEvent) { return; } // Prevent re-triggering
        setIsPainEvent(true);
        // Instantly set a high probability visual
        setLivePrediction({ prediction: 1, probability: 0.85 + Math.random() * 0.1 });
        toast({ title: "Pain Event Triggered!", variant: "destructive", duration: 2000 });
        // Set timeout to automatically end the pain event
        setTimeout(() => {
            setIsPainEvent(false);
            toast({ title: "Pain Event Ended", description: "Returning to baseline.", duration: 2000 });
        }, 5000); // 5 seconds
    };


    // --- JSX Rendering ---
    return (
        <section id="analysis-pipeline" className="py-16">
            <div className="container mx-auto px-4">
                {/* Title */}
                <div className="text-center mb-10">
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">NeoDetect Analysis & Simulation</h2>
                    <p className="text-md md:text-lg text-muted-foreground max-w-2xl mx-auto">Upload an EDF file for analysis or run the live simulation.</p>
                </div>

                {/* Combined Card */}
                <Card className="p-6 md:p-8 shadow-lg max-w-6xl mx-auto">
                    {/* Mode Toggle */}
                    <div className="flex items-center justify-center space-x-2 mb-6 border-b pb-6">
                        <Label htmlFor="mode-switch" className={`text-sm font-medium transition-colors ${!isSimulatingLive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>File Upload Mode</Label>
                        <Switch id="mode-switch" checked={isSimulatingLive} onCheckedChange={toggleLiveSimulation}/>
                        <Label htmlFor="mode-switch" className={`text-sm font-medium transition-colors ${isSimulatingLive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Live Simulation Mode</Label>
                    </div>

                    {/* Conditional Rendering */}
                    {!isSimulatingLive ? (
                        /* --- File Upload and Analysis Section --- */
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
                                {/* Column 1: Upload & Run */}
                                <div>
                                    {/* Step 1: Upload */}
                                    <div className="mb-6">
                                        <div className="flex items-center space-x-3 mb-4"><Upload className="text-primary" size={20}/><h3 className="text-lg font-semibold">1. Upload EEG File (.edf)</h3></div>
                                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors">
                                            <input type="file" id="eeg-upload-combined" className="hidden" accept=".edf" onChange={handleFileChange} />
                                            <label htmlFor="eeg-upload-combined" className="cursor-pointer block">
                                                <FileText size={32} className="text-muted-foreground mx-auto mb-2" />
                                                <p className="text-muted-foreground mb-2 text-xs">Drag & drop or click browse</p>
                                                <Button variant="outline" size="xs" type="button" onClick={() => document.getElementById('eeg-upload-combined')?.click()}>Choose File</Button>
                                            </label>
                                        </div>
                                        {selectedFile && ( <div className="mt-3 flex items-center space-x-2 text-green-600 bg-green-50 p-2 rounded-md text-xs"><CheckCircle size={16} /><span>Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span></div> )}
                                    </div>
                                    {/* Step 2: Run Analysis */}
                                    <div className="mb-6">
                                        <div className="flex items-center space-x-3 mb-4"><Brain className="text-primary" size={20}/><h3 className="text-lg font-semibold">2. Run AI Analysis</h3></div>
                                        <Button size="default" onClick={runPrediction} disabled={isAnalyzingFile || !selectedFile} className="w-full">
                                            {isAnalyzingFile ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Analyzing...</>) : (<><Play className="mr-2 h-4 w-4"/>Run Pain Detection</>)}
                                        </Button>
                                        {!selectedFile && !isAnalyzingFile && ( <p className="text-xs text-red-600 mt-2 flex items-center justify-center"><FileWarning size={14} className="mr-1"/> Select file first.</p> )}
                                        {isAnalyzingFile && ( <div className="mt-3 space-y-1"><Progress value={undefined} className="w-full h-1" /> <p className="text-center text-xs text-muted-foreground">Processing...</p></div> )}
                                        {error && ( <div className="mt-3 p-2 bg-red-100 border border-red-300 text-red-800 rounded-md text-xs"><p><strong>Error:</strong> {error}</p></div> )}
                                    </div>
                                </div>

                                {/* Column 2: Metadata & Results */}
                                <div>
                                    {/* Metadata Display */}
                                    <div className="mb-6">
                                       <div className="flex items-center space-x-3 mb-4"><Info className="text-primary" size={20}/><h3 className="text-lg font-semibold">File Information</h3></div>
                                       <Card className="bg-muted/50 p-4">
                                         {result?.metadata && !result.metadata.error ? (
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                                <div><Label className="text-muted-foreground">Filename</Label><p className="font-medium break-all">{result.metadata.filename || 'N/A'}</p></div>
                                                <div><Label className="text-muted-foreground">Duration</Label><p className="font-medium">{result.metadata.duration_seconds?.toFixed(1) ?? 'N/A'} s</p></div>
                                                <div><Label className="text-muted-foreground">Sampling Freq.</Label><p className="font-medium">{result.metadata.sampling_frequency ?? 'N/A'} Hz</p></div>
                                                <div><Label className="text-muted-foreground">Channels</Label><p className="font-medium">{result.metadata.num_channels ?? 'N/A'}</p></div>
                                            </div>
                                         ) : result?.metadata?.error ? (
                                            <p className="text-xs text-red-600">Error loading metadata: {result.metadata.error}</p>
                                         ) : (
                                            <p className="text-xs text-muted-foreground text-center py-4">Upload a file to see metadata.</p>
                                         )}
                                       </Card>
                                    </div>

                                    {/* Prediction Results */}
                                    <div>
                                       <div className="flex items-center space-x-3 mb-4"><BarChart3 className="text-primary" size={20}/><h3 className="text-lg font-semibold">Prediction Result</h3></div>
                                       {result && result.overall_prediction !== -1 ? (
                                         <div className={`p-4 rounded-lg text-center ${ result.overall_prediction === 1 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                                            <div className="flex items-center justify-center mb-2">{result.overall_prediction === 1 ? (<AlertTriangle className="text-red-600" size={24} />) : (<CheckCircle className="text-green-600" size={24} />)}</div>
                                            <h4 className={`text-xl font-bold mb-1 ${result.overall_prediction === 1 ? 'text-red-700' : 'text-green-700'}`}>{result.overall_prediction === 1 ? 'Pain Detected' : 'No Pain Detected'}</h4>
                                            <p className={`text-md mb-1 ${result.overall_prediction === 1 ? 'text-red-600' : 'text-green-600'}`}> Avg. Pain Prob: {(result.average_pain_probability * 100).toFixed(2)}% </p>
                                            <p className="text-xs text-muted-foreground"> Based on {result.num_clean_epochs} clean epochs. </p>
                                         </div>
                                        ) : result && result.overall_prediction === -1 ? (
                                            <div className="p-4 rounded-lg text-center bg-yellow-50 border border-yellow-200">
                                                 <FileWarning className="text-yellow-600 mx-auto mb-2" size={24}/>
                                                 <p className="text-sm font-medium text-yellow-700">{result.message || "Processing completed, but no valid prediction could be made."}</p>
                                                 <p className="text-xs text-muted-foreground mt-1">File might be too noisy or short.</p>
                                            </div>
                                        ): (
                                         <div className="text-center py-6 bg-muted rounded-lg"> <p className="text-xs text-muted-foreground"> {isAnalyzingFile ? "Waiting for results..." : "Result after analysis."} </p> </div>
                                       )}
                                    </div>
                                </div>
                            </div> {/* End 2-column grid */}

                            {/* Raw Wave Plot (Full Width Below) */}
                            {result?.raw_data_segment?.times && result.raw_data_segment.times.length > 0 && (
                                <div className="mt-8 pt-6 border-t">
                                   <h3 className="text-lg font-semibold text-foreground mb-3 text-center">Raw EEG Waveform Visualization (First ~15s, Max 4 Channels)</h3>
                                   <Card className="bg-gray-100 p-2 shadow-inner">
                                     <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={formatRawWaveDataForChart(result.raw_data_segment)} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                            <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t) => t.toFixed(1) + 's'} stroke="#999" fontSize={10}/>
                                            <YAxis stroke="#999" fontSize={10} label={{ value: 'Amplitude (µV)', angle: -90, position: 'insideLeft', style: {fontSize: '10px', fill: '#999'} }}/>
                                            <Legend wrapperStyle={{fontSize: '10px', paddingTop: '10px'}}/>
                                            {result.raw_data_segment.channels_sent?.map((chName, index) => (
                                                <Line key={chName} type="monotone" dataKey={chName} stroke={WAVE_COLORS[index % WAVE_COLORS.length]} strokeWidth={1} dot={false} isAnimationActive={false}/>
                                            ))}
                                        </LineChart>
                                     </ResponsiveContainer>
                                   </Card>
                                </div>
                            )}
                        </> // End File Upload Fragment
                    ) : (
                        /* --- Live Simulation Section --- */
                        <>
                            <div className="mb-6 flex justify-between items-center">
                                <div className="flex items-center space-x-3"><Activity className="text-primary animate-pulse" size={24} /><h3 className="text-xl font-semibold">Live EEG Simulation Feed</h3></div>
                                <Button variant="destructive" size="sm" onClick={triggerPainEvent} disabled={isPainEvent}>
                                    <Siren className="mr-2" size={16}/> Simulate Pain Event
                                </Button>
                            </div>
                            {/* Waveform Display */}
                            <div className="mb-6 bg-gray-900 p-4 rounded-lg shadow-inner" style={{ height: '200px' }}>
                                 <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={waveData} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                                        <YAxis domain={[-150, 150]} tick={false} axisLine={false} />
                                        <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tick={false} axisLine={false}/>
                                        <Line type="monotone" dataKey="value" stroke={isPainEvent ? SIM_WAVE_PAIN_COLOR : SIM_WAVE_NORMAL_COLOR} strokeWidth={1} dot={false} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Live Prediction Display */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Prediction Box */}
                                <div className="col-span-1">
                                    <div className="flex items-center space-x-3 mb-2"><BarChart3 className="text-primary" size={20} /><h4 className="text-lg font-semibold">Prediction Status</h4></div>
                                    {livePrediction ? (
                                        <div className={`p-4 rounded-lg text-center ${ livePrediction.prediction === 1 ? 'bg-red-900 text-white shadow-xl border-red-700' : 'bg-green-900 text-white shadow-xl border-green-700'}`}>
                                            <h4 className={`text-2xl font-bold mb-1`}>{isPainEvent ? '🚨 PAIN ALERT' : (livePrediction.prediction === 1 ? 'PAIN LIKELY' : 'BASELINE NORMAL')}</h4>
                                            <p className="text-sm">Probability: {(livePrediction.probability * 100).toFixed(1)}%</p>
                                        </div>
                                    ) : ( <div className="p-4 bg-gray-800 text-muted-foreground rounded-lg text-sm text-center">Initializing...</div> )}
                                </div>
                                {/* Control Box */}
                                <div className="col-span-1">
                                    <div className="flex items-center space-x-3 mb-2"><Siren className="text-primary" size={20} /><h4 className="text-lg font-semibold">Controls</h4></div>
                                    <Button variant="destructive" onClick={triggerPainEvent} disabled={isPainEvent} className="w-full text-white bg-red-600 hover:bg-red-700">
                                        {isPainEvent ? 'Pain Active (5s countdown)' : 'Trigger Pain Event'}
                                    </Button>
                                    <Button variant="secondary" onClick={() => { setIsSimulatingLive(false); }} className="w-full mt-2">
                                        Stop Monitor
                                    </Button>
                                </div>
                            </div>
                        </> // End Live Simulation Fragment
                    )}
                </Card>
            </div>
        </section>
    );
};

export default AnalysisPipeline;