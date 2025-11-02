// frontend/src/components/ui/UploadDemo.tsx (with simulated EEG waveform visualization)

import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, Info, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface UploadDemoProps {
  onFileSelect: (file: File | null) => void;
  selectedFileName: string | null;
}

interface WavePoint {
  time: number;
  ch1: number;
  ch2: number;
  ch3: number;
  ch4: number;
}

const UploadDemo = ({ onFileSelect, selectedFileName }: UploadDemoProps) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [waveData, setWaveData] = useState<WavePoint[]>([]);
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeRef = useRef(0);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onFileSelect(file || null);
    setCurrentFile(file || null);
    setMetadata(null);
  };

  // Simulate metadata extraction
  useEffect(() => {
    if (currentFile) {
      const timer = setTimeout(() => {
        setMetadata({
          filename: currentFile.name,
          size: `${(currentFile.size / 1024).toFixed(2)} KB`,
          samplingRate: "Simulated: 256 Hz",
          channels: "Simulated: 4",
          format: "EDF (Simulated)",
        });
        toast({
          title: "File selected!",
          description: "Simulated metadata generated.",
        });
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setMetadata(null);
    }
  }, [currentFile, toast]);

  // Generate fake EEG wave data dynamically
  useEffect(() => {
    if (!selectedFileName) {
      setWaveData([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      timeRef.current += 0.05;
      const newPoint: WavePoint = {
        time: timeRef.current,
        ch1: Math.sin(timeRef.current * 2) * 30 + Math.random() * 5,
        ch2: Math.cos(timeRef.current * 1.8) * 25 + Math.random() * 5,
        ch3: Math.sin(timeRef.current * 3.1) * 20 + Math.random() * 5,
        ch4: Math.cos(timeRef.current * 2.5) * 15 + Math.random() * 5,
      };
      setWaveData((prev) => {
        const updated = [...prev, newPoint];
        return updated.length > 300 ? updated.slice(-300) : updated;
      });
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedFileName]);

  return (
    <section id="upload-demo" className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            EEG Upload & Visualization
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your EEG (.edf) file and watch simulated brainwave
            activity unfold in real time.
          </p>
        </div>

        {/* Upload + Metadata Section */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Upload Section */}
          <Card className="p-8 shadow-card">
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Upload EEG File
                </h3>
                <p className="text-muted-foreground text-sm">
                  Supported format: .edf
                </p>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 mb-6 hover:border-primary transition-colors">
                <input
                  type="file"
                  id="eeg-upload"
                  className="hidden"
                  accept=".edf"
                  onChange={handleFileUpload}
                />
                <label htmlFor="eeg-upload" className="cursor-pointer">
                  <FileText
                    size={48}
                    className="text-muted-foreground mx-auto mb-4"
                  />
                  <p className="text-muted-foreground mb-2">
                    Drag & drop or click to browse
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() =>
                      document.getElementById("eeg-upload")?.click()
                    }
                  >
                    Choose File
                  </Button>
                </label>
              </div>

              {selectedFileName && (
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg justify-center">
                  <CheckCircle size={20} />
                  <span className="text-sm font-medium">
                    {selectedFileName} selected
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Metadata Section */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <Info className="text-primary" size={24} />
              <h3 className="text-xl font-semibold text-foreground">
                File Metadata
              </h3>
            </div>
            {metadata ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Filename</div>
                    <div className="font-medium break-words">
                      {metadata.filename}
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Size</div>
                    <div className="font-medium">{metadata.size}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">
                      Sampling Rate
                    </div>
                    <div className="font-medium">{metadata.samplingRate}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">
                      Channels
                    </div>
                    <div className="font-medium">{metadata.channels}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Format</div>
                    <div className="font-medium">{metadata.format}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="text-muted-foreground" size={24} />
                </div>
                <p className="text-muted-foreground">
                  {selectedFileName
                    ? "Generating metadata preview..."
                    : "Upload an EEG file to view metadata."}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Dramatic EEG Waveform Section */}
        {selectedFileName && (
          <div className="mt-16 max-w-5xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-6">
              EEG Waveform Visualization
            </h3>
            <Card className="bg-gray-950 p-6 shadow-2xl border border-gray-800">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={waveData}>
                  <CartesianGrid stroke="#222" />
                  <XAxis
                    dataKey="time"
                    stroke="#aaa"
                    tickFormatter={(t) => t.toFixed(1)}
                    fontSize={10}
                  />
                  <YAxis stroke="#aaa" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px", color: "#ccc" }} />
                  <Line
                    type="monotone"
                    dataKey="ch1"
                    stroke="#00ffff"
                    strokeWidth={1.2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ch2"
                    stroke="#00ff00"
                    strokeWidth={1.2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ch3"
                    stroke="#ffff00"
                    strokeWidth={1.2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ch4"
                    stroke="#ff0000"
                    strokeWidth={1.2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
};

export default UploadDemo;
