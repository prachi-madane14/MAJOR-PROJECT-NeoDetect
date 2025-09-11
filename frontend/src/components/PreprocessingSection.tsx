import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Filter, BarChart3, Waves } from "lucide-react";

const PreprocessingSection = () => {
  const preprocessingSteps = [
    {
      icon: <Filter size={24} />,
      title: "Band-pass Filtering",
      description: "Remove artifacts and focus on relevant frequency bands (0.5-30 Hz)",
      color: "bg-blue-500",
    },
    {
      icon: <Zap size={24} />,
      title: "Artifact Removal",
      description: "Eliminate eye movements, muscle artifacts, and electrical noise",
      color: "bg-green-500",
    },
    {
      icon: <Waves size={24} />,
      title: "Signal Normalization", 
      description: "Standardize amplitude and baseline correction across channels",
      color: "bg-amber-500",
    },
    {
      icon: <BarChart3 size={24} />,
      title: "Feature Extraction",
      description: "Extract power spectral density and time-domain features",
      color: "bg-purple-500",
    },
  ];

  const frequencyBands = [
    { name: "Delta", range: "0.5-4 Hz", color: "bg-red-500", description: "Deep sleep, unconscious processes" },
    { name: "Theta", range: "4-8 Hz", color: "bg-orange-500", description: "Drowsiness, reduced consciousness" },
    { name: "Alpha", range: "8-13 Hz", color: "bg-green-500", description: "Relaxed wakefulness, eyes closed" },
    { name: "Beta", range: "13-30 Hz", color: "bg-blue-500", description: "Active thinking, alertness, pain response" },
  ];

  return (
    <section id="preprocessing" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            EEG Preprocessing Pipeline
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our advanced preprocessing pipeline ensures clean, reliable EEG signals 
            for accurate pain detection in neonatal patients.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
          {/* Preprocessing Steps */}
          <Card className="p-8 shadow-card">
            <h3 className="text-2xl font-semibold text-foreground mb-6">Processing Steps</h3>
            <div className="space-y-6">
              {preprocessingSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className={`${step.color} p-3 rounded-lg text-white flex-shrink-0`}>
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-foreground mb-2">
                      {step.title}
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          {/* Frequency Bands */}
          <Card className="p-8 shadow-card">
            <h3 className="text-2xl font-semibold text-foreground mb-6">EEG Frequency Bands</h3>
            <div className="space-y-4">
              {frequencyBands.map((band, index) => (
                <div key={index} className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 ${band.color} rounded-full`}></div>
                      <span className="font-semibold text-foreground">{band.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {band.range}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground ml-7">
                    {band.description}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        
        {/* Visual Comparison */}
        <Card className="p-8 shadow-card max-w-4xl mx-auto">
          <h3 className="text-2xl font-semibold text-foreground mb-6 text-center">
            Raw vs. Processed EEG Signals
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="text-center">
              <h4 className="text-lg font-medium text-foreground mb-4">Raw EEG Signal</h4>
              <div className="bg-muted rounded-lg p-4 h-40 flex items-center justify-center relative overflow-hidden">
                <svg width="100%" height="100%" viewBox="0 0 300 100" className="absolute">
                  <path
                    d="M0,50 Q75,20 150,50 T300,50"
                    stroke="#ef4444"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.7"
                  />
                  <path
                    d="M0,45 Q75,75 150,45 T300,45"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.5"
                  />
                  <path
                    d="M0,55 Q75,25 150,55 T300,55"
                    stroke="#10b981"
                    strokeWidth="1"
                    fill="none"
                    opacity="0.3"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Contains noise, artifacts, and irrelevant frequencies
              </p>
            </div>
            
            <div className="text-center">
              <h4 className="text-lg font-medium text-foreground mb-4">Processed EEG Signal</h4>
              <div className="bg-muted rounded-lg p-4 h-40 flex items-center justify-center relative overflow-hidden">
                <svg width="100%" height="100%" viewBox="0 0 300 100" className="absolute">
                  <path
                    d="M0,50 Q75,30 150,50 T300,50"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    fill="none"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Clean, filtered signal ready for pain detection analysis
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default PreprocessingSection;