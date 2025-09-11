import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Play, Brain, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PredictionSection = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const runPrediction = () => {
    setIsAnalyzing(true);
    setResult(null);
    
    // Simulate AI analysis process
    setTimeout(() => {
      const painDetected = Math.random() > 0.4; // 60% chance of pain detection
      const confidence = Math.random() * 0.3 + (painDetected ? 0.7 : 0.2); // Higher confidence for pain
      
      setResult({
        painDetected,
        confidence: Math.round(confidence * 100),
        bandPowers: {
          delta: Math.random() * 40 + 20,
          theta: Math.random() * 25 + 15,
          alpha: Math.random() * 20 + 10,
          beta: Math.random() * 30 + 25,
        },
        timestamp: new Date().toLocaleTimeString(),
      });
      
      setIsAnalyzing(false);
      
      toast({
        title: "Analysis Complete",
        description: `Pain ${painDetected ? 'detected' : 'not detected'} with ${Math.round(confidence * 100)}% confidence`,
      });
    }, 3000);
  };

  return (
    <section id="prediction" className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Pain Detection Model
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our machine learning model analyzes processed EEG signals to detect 
            pain states in neonates with high accuracy and reliability.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Prediction Interface */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <Brain className="text-primary" size={24} />
              <h3 className="text-xl font-semibold text-foreground">AI Analysis</h3>
            </div>
            
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="text-primary" size={40} />
              </div>
              
              <Button
                size="lg"
                onClick={runPrediction}
                disabled={isAnalyzing}
                className="px-8 py-3"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" size={20} />
                    Run Pain Detection
                  </>
                )}
              </Button>
            </div>
            
            {isAnalyzing && (
              <div className="space-y-4">
                <div className="text-center text-sm text-muted-foreground mb-4">
                  Processing EEG signals...
                </div>
                <Progress value={33} className="mb-2" />
                <div className="text-xs text-muted-foreground">Feature extraction...</div>
                <Progress value={66} className="mb-2" />
                <div className="text-xs text-muted-foreground">Running ML model...</div>
                <Progress value={90} className="mb-2" />
                <div className="text-xs text-muted-foreground">Generating prediction...</div>
              </div>
            )}
          </Card>
          
          {/* Results Display */}
          <Card className="p-8 shadow-card">
            <div className="flex items-center space-x-3 mb-6">
              <BarChart3 className="text-primary" size={24} />
              <h3 className="text-xl font-semibold text-foreground">Prediction Results</h3>
            </div>
            
            {result ? (
              <div className="space-y-6">
                {/* Main Result */}
                <div className={`p-6 rounded-lg text-center ${
                  result.painDetected 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center justify-center mb-4">
                    {result.painDetected ? (
                      <AlertTriangle className="text-red-600" size={32} />
                    ) : (
                      <CheckCircle className="text-green-600" size={32} />
                    )}
                  </div>
                  <h4 className={`text-2xl font-bold mb-2 ${
                    result.painDetected ? 'text-red-700' : 'text-green-700'
                  }`}>
                    {result.painDetected ? '⚠️ Pain Detected' : '✅ No Pain Detected'}
                  </h4>
                  <p className={`text-lg ${
                    result.painDetected ? 'text-red-600' : 'text-green-600'
                  }`}>
                    Confidence: {result.confidence}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Analysis completed at {result.timestamp}
                  </p>
                </div>
                
                {/* Band Powers */}
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-4">EEG Band Powers</h4>
                  <div className="space-y-3">
                    {Object.entries(result.bandPowers).map(([band, power]) => (
                      <div key={band} className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{band}</span>
                        <div className="flex items-center space-x-2 flex-1 ml-4">
                          <Progress value={power as number} className="flex-1" />
                          <span className="text-sm text-muted-foreground min-w-12">
                            {Math.round(power as number)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="text-muted-foreground" size={32} />
                </div>
                <p className="text-muted-foreground">
                  Run the pain detection model to see prediction results and analysis
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