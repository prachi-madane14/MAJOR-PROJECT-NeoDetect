import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, TrendingUp, Target, FileText } from "lucide-react";

const ResultsSection = () => {
  const metrics = [
    { label: "Accuracy", value: "95.2%", color: "text-green-600", bg: "bg-green-50" },
    { label: "Sensitivity", value: "94.8%", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Specificity", value: "95.6%", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "F1-Score", value: "95.0%", color: "text-orange-600", bg: "bg-orange-50" },
  ];

  const confusionMatrix = [
    ["True Positive", "89", "bg-green-100", "text-green-800"],
    ["False Positive", "4", "bg-red-100", "text-red-800"],
    ["False Negative", "5", "bg-red-100", "text-red-800"],
    ["True Negative", "87", "bg-green-100", "text-green-800"],
  ];

  const achievements = [
    {
      icon: <Award size={24} />,
      title: "High Accuracy",
      description: "Achieved ~95% accuracy in pain vs no-pain classification",
      color: "text-yellow-600",
    },
    {
      icon: <Target size={24} />,
      title: "Clinical Validation",
      description: "Validated against expert clinical assessments",
      color: "text-blue-600",
    },
    {
      icon: <TrendingUp size={24} />,
      title: "Real-time Processing",
      description: "Fast inference suitable for NICU monitoring",
      color: "text-green-600",
    },
  ];

  return (
    <section id="results" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Model Performance & Results
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            NeoDetect demonstrates exceptional performance in distinguishing pain 
            vs no-pain states using EEG features with clinical validation.
          </p>
        </div>
        
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 max-w-4xl mx-auto">
          {metrics.map((metric, index) => (
            <Card key={index} className={`p-6 text-center shadow-card ${metric.bg}`}>
              <div className={`text-3xl font-bold ${metric.color} mb-2`}>
                {metric.value}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                {metric.label}
              </div>
            </Card>
          ))}
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
          {/* Confusion Matrix */}
          <Card className="p-8 shadow-card">
            <h3 className="text-2xl font-semibold text-foreground mb-6 flex items-center">
              <FileText className="mr-3 text-primary" size={24} />
              Confusion Matrix
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-2">Predicted</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs font-medium p-2">Pain</div>
                  <div className="text-xs font-medium p-2">No Pain</div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="text-sm font-medium text-muted-foreground">Actual</div>
              <div className="text-xs font-medium p-2">Pain</div>
              <div className="text-xs font-medium p-2">No Pain</div>
              
              <div className="text-xs font-medium p-2">Pain</div>
              <div className="bg-green-100 text-green-800 p-4 rounded font-bold">89</div>
              <div className="bg-red-100 text-red-800 p-4 rounded font-bold">4</div>
              
              <div className="text-xs font-medium p-2">No Pain</div>
              <div className="bg-red-100 text-red-800 p-4 rounded font-bold">5</div>
              <div className="bg-green-100 text-green-800 p-4 rounded font-bold">87</div>
            </div>
            
            <div className="mt-6 space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-100 rounded"></div>
                <span className="text-sm text-muted-foreground">Correct Predictions</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-100 rounded"></div>
                <span className="text-sm text-muted-foreground">Incorrect Predictions</span>
              </div>
            </div>
          </Card>
          
          {/* Key Features */}
          <Card className="p-8 shadow-card">
            <h3 className="text-2xl font-semibold text-foreground mb-6">
              Key Achievements
            </h3>
            
            <div className="space-y-6">
              {achievements.map((achievement, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className={`${achievement.color} p-2 flex-shrink-0`}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-foreground mb-1">
                      {achievement.title}
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 p-4 bg-primary/5 rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Clinical Impact</h4>
              <p className="text-sm text-muted-foreground">
                NeoDetect provides healthcare professionals with a reliable, 
                non-invasive tool for pain assessment in newborns, potentially 
                improving pain management and patient outcomes in NICU environments.
              </p>
            </div>
          </Card>
        </div>
        
        {/* Dataset Information */}
        <Card className="p-8 shadow-card max-w-4xl mx-auto">
          <h3 className="text-2xl font-semibold text-foreground mb-6 text-center">
            Dataset & Validation
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-6 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary mb-2">185</div>
              <div className="text-sm text-muted-foreground">Total Samples</div>
            </div>
            <div className="p-6 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary mb-2">4</div>
              <div className="text-sm text-muted-foreground">EEG Channels</div>
            </div>
            <div className="p-6 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary mb-2">500Hz</div>
              <div className="text-sm text-muted-foreground">Sampling Rate</div>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <Badge variant="outline" className="mr-2">PMC11891568</Badge>
            <Badge variant="outline">Zenodo Dataset</Badge>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default ResultsSection;