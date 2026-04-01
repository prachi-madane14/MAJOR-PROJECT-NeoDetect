// src/pages/Index.tsx

import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import PredictPanel from "../components/PredictPanel";
import AnalysisPipeline from "@/components/ui/AnalysisPipeline";
import MultimodalSimulation from "@/components/ui/MultimodalSimulation";
import PreprocessingSection from "@/components/PreprocessingSection";
import AboutSection from "@/components/AboutSection";
import LiveSimulation from "../components/LiveSimulation";
import CSVSimulation from "../components/CSVSimulation";   // ← NEW

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex-grow">
        <HeroSection />

        <PredictPanel />

        {/* ── Existing live simulation (streams server-side CSV) ── */}
        <LiveSimulation />

        {/* ── NEW: Upload your own CSV and run a simulation ── */}
        <CSVSimulation />

        <AnalysisPipeline />

        <MultimodalSimulation />

        <PreprocessingSection />

        <AboutSection />
      </main>
    </div>
  );
};

export default Index;
