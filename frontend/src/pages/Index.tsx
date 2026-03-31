// src/pages/Index.tsx (FINAL - Integrating Both Demos)

// Keep necessary layout/structure imports
import Navigation from "@/components/Navigation"; // Assuming this path is correct
import HeroSection from "@/components/HeroSection"; // Assuming this path is correct
import PredictPanel from "../components/PredictPanel";
// Import the combined Analysis Pipeline component (handles file upload)
import AnalysisPipeline from "@/components/ui/AnalysisPipeline"; // Adjust path if needed

// Import the NEW Multimodal Simulation component (handles live EEG + Face)
import MultimodalSimulation from "@/components/ui/MultimodalSimulation"; // Adjust path if needed

// Keep other relevant static section imports (adjust paths as necessary)
import PreprocessingSection from "@/components/PreprocessingSection";
import AboutSection from "@/components/AboutSection";
import LiveSimulation from "../components/LiveSimulation";
// Import Footer if you have one
// import Footer from "@/components/Footer";
// Remove imports for components now integrated or replaced:
// import ResultsSection from "@/components/ResultsSection";
// import EEGSimulation from "@/components/EEGSimulation"; // Replaced by MultimodalSimulation

const Index = () => {
  // No state needed here anymore for file handling

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation /> {/* Render Navigation */}
      <main className="flex-grow">
        <HeroSection />

        {/* --- Render the File Upload + Analysis component --- */}
        {/* This handles EDF upload, metadata, waves, SHAP, and prediction */}
        
        <PredictPanel />
        <LiveSimulation />
        <AnalysisPipeline />

        {/* --- Render the NEW Multimodal Live Simulation component --- */}
        {/* This handles the live EEG wave + Webcam + Face Prediction + Fusion */}
        <MultimodalSimulation />
        


        {/* --- Render other static sections --- */}
        <PreprocessingSection />
        {/* The EEGLiveSim is replaced by MultimodalSimulation */}
        {/* <EEGLiveSim /> */}
        {/* Results are likely integrated into AnalysisPipeline now */}
        {/* <ResultsSection /> */}
        <AboutSection />

      </main>
      {/* <Footer /> */} {/* Render Footer if you have one */}
    </div>
  );
};

export default Index;