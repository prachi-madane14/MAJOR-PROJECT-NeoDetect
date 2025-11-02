// frontend/src/components/ui/PredictionSection.tsx

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CheckCircle,
  Play,
  Brain,
  BarChart3,
  FileWarning,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Interface for backend response
interface PredictionResponse {
  message: string;
  overall_prediction: number;
  average_pain_probability: number;
  num_clean_epochs: number;
}

// Props interface
interface PredictionSectionProps {
  selectedFile: File | null;
}

const PredictionSection = ({ selectedFile }: PredictionSectionProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Type guard for backend response
  const isPredictionResponse = (data: any): data is PredictionResponse => {
    return (
      typeof data === "object" &&
      data !== null &&
      typeof data.message === "string" &&
      typeof data.overall_prediction === "number" &&
      typeof data.average_pain_probability === "number" &&
      typeof data.num_clean_epochs === "number"
    );
  };

  const runPrediction = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "No File Selected",
        description: "Please upload an EDF file first.",
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict/", {
        method: "POST",
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage =
          responseData?.detail ||
          response.statusText ||
          `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      if (isPredictionResponse(responseData)) {
        setResult(responseData);
        toast({
          title: "Analysis Complete",
          description: responseData.message,
        });
      } else {
        console.error("Unexpected response data structure:", responseData);
        throw new Error("Received unexpected data format from the server.");
      }
    } catch (err) {
      console.error("Prediction failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : "An unknown error occurred during analysis.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: message,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section id="prediction" className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Pain Detection Model
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our machine learning model analyzes processed EEG signals to detect
            pain states in neonates. Upload an EDF file above to begin.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Prediction Interface Card */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <Brain className="text-primary" size={24} />
              <h3 className="text-xl font-semibold text-foreground">
                AI Analysis
              </h3>
            </div>

            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="text-primary" size={40} />
              </div>

              {selectedFile ? (
                <p className="text-sm text-muted-foreground mb-4">
                  Selected file: <strong>{selectedFile.name}</strong>
                </p>
              ) : (
                <p className="text-sm text-red-600 mb-4 flex items-center justify-center">
                  <FileWarning className="mr-2" size={16} />
                  No EDF file selected. Please upload above.
                </p>
              )}

              <Button
                size="lg"
                onClick={runPrediction}
                disabled={isAnalyzing || !selectedFile}
                className="px-8 py-3"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" size={20} /> Run Pain Detection
                  </>
                )}
              </Button>
            </div>

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="text-center text-sm text-muted-foreground mb-4">
                  Processing EEG signals on the server... This may take a moment.
                </div>
                <Progress className="w-full animate-pulse" />
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-md">
                <p>
                  <strong>Error:</strong> {error}
                </p>
              </div>
            )}
          </Card>

          {/* Results Display Card */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <BarChart3 className="text-primary" size={24} />
              <h3 className="text-xl font-semibold text-foreground">
                Prediction Results
              </h3>
            </div>

            {result ? (
              <div className="space-y-6">
                <div
                  className={`p-6 rounded-lg text-center ${
                    result.overall_prediction === 1
                      ? "bg-red-50 border border-red-200"
                      : "bg-green-50 border border-green-200"
                  }`}
                >
                  <div className="flex items-center justify-center mb-4">
                    {result.overall_prediction === 1 ? (
                      <AlertTriangle className="text-red-600" size={32} />
                    ) : (
                      <CheckCircle className="text-green-600" size={32} />
                    )}
                  </div>
                  <h4
                    className={`text-2xl font-bold mb-2 ${
                      result.overall_prediction === 1
                        ? "text-red-700"
                        : "text-green-700"
                    }`}
                  >
                    {result.overall_prediction === 1
                      ? "⚠️ Pain Detected"
                      : "✅ No Pain Detected"}
                  </h4>
                  <p
                    className={`text-lg ${
                      result.overall_prediction === 1
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    Average Pain Probability:{" "}
                    {(result.average_pain_probability * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on {result.num_clean_epochs} clean epochs analysed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="text-muted-foreground" size={32} />
                </div>
                <p className="text-muted-foreground">
                  {error
                    ? "Analysis failed. See error message above."
                    : "Upload an EDF file and click 'Run Pain Detection' to see results."}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};

export default PredictionSection;
