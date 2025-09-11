import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import UploadDemo from "@/components/UploadDemo";
import PreprocessingSection from "@/components/PreprocessingSection";
import EEGSimulation from "@/components/EEGSimulation";
import PredictionSection from "@/components/PredictionSection";
import ResultsSection from "@/components/ResultsSection";
import AboutSection from "@/components/AboutSection";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <HeroSection />
        <UploadDemo />
        <PreprocessingSection />
        <EEGSimulation />
        <PredictionSection />
        <ResultsSection />
        <AboutSection />
      </main>
    </div>
  );
};

export default Index;