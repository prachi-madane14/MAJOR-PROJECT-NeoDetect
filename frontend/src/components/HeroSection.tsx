import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Activity, Shield } from "lucide-react";

const HeroSection = () => {
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-hero text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm animate-pulse-slow">
              <Brain size={64} className="text-primary-foreground" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-up">
            NeoDetect
          </h1>
          
          <p className="text-xl md:text-2xl mb-4 opacity-90 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            AI-Powered Pain Detection in Neonates using EEG
          </p>
          
          <p className="text-lg mb-8 opacity-80 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.4s" }}>
            Advanced machine learning system for detecting pain in newborns through 
            EEG signal analysis, providing healthcare professionals with reliable, 
            non-invasive pain assessment tools.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: "0.6s" }}>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => scrollToSection('upload-demo')}
              className="text-lg px-8 py-3 bg-white/90 text-primary hover:bg-white"
            >
              <Activity className="mr-2" size={20} />
              Try Demo
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => scrollToSection('about')}
              className="text-lg px-8 py-3 border-white/30 text-primary-foreground hover:bg-white/10"
            >
              <Shield className="mr-2" size={20} />
              Learn More
            </Button>
          </div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-up" style={{ animationDelay: "0.8s" }}>
            <Card className="p-6 bg-white/10 backdrop-blur-sm border-white/20">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-foreground mb-2">95%</div>
                <div className="text-sm opacity-80">Accuracy Rate</div>
              </div>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-sm border-white/20">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-foreground mb-2">Non-invasive</div>
                <div className="text-sm opacity-80">EEG-based Detection</div>
              </div>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-sm border-white/20">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-foreground mb-2">Real-time</div>
                <div className="text-sm opacity-80">Pain Assessment</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;