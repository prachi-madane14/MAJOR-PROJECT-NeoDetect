import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Activity } from "lucide-react";

const EEGSimulation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width = canvas.offsetWidth * 2; // High DPI
    const height = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const actualWidth = width / 2;
    const actualHeight = height / 2;

    const drawEEGWave = (timeOffset: number) => {
      ctx.clearRect(0, 0, actualWidth, actualHeight);
      
      // EEG channels
      const channels = [
        { name: 'Fp1', color: '#3b82f6', offset: 0.15 },
        { name: 'Fp2', color: '#10b981', offset: 0.35 },
        { name: 'C3', color: '#f59e0b', offset: 0.55 },
        { name: 'C4', color: '#ef4444', offset: 0.75 },
      ];

      channels.forEach((channel, index) => {
        ctx.strokeStyle = channel.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const baseY = actualHeight * channel.offset;
        
        for (let x = 0; x < actualWidth; x++) {
          const frequency1 = 0.02 + index * 0.005; // Different frequencies per channel
          const frequency2 = 0.05 + index * 0.01;
          const amplitude = 20 + Math.sin(timeOffset * 0.01) * 10;
          
          const y = baseY + 
                   Math.sin((x + timeOffset) * frequency1) * amplitude +
                   Math.sin((x + timeOffset * 1.5) * frequency2) * (amplitude * 0.3) +
                   (Math.random() - 0.5) * 5; // Add some noise
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Channel labels
        ctx.fillStyle = channel.color;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(channel.name, 10, baseY - 10);
      });

      // Grid lines
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < actualWidth; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, actualHeight);
        ctx.stroke();
      }
    };

    const animate = () => {
      if (isPlaying) {
        setTime(prev => prev + 2);
        drawEEGWave(time);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, time]);

  return (
    <section id="simulation" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Live EEG Simulation
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real-time visualization of EEG signals from multiple channels, 
            simulating the data collection process in NICU environments.
          </p>
        </div>
        
        <Card className="p-8 shadow-card max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Activity className="text-primary" size={24} />
              <h3 className="text-xl font-semibold text-foreground">EEG Monitor</h3>
            </div>
            <Button
              variant={isPlaying ? "secondary" : "default"}
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center space-x-2"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </Button>
          </div>
          
          <div className="bg-muted rounded-lg p-4 mb-4">
            <canvas
              ref={canvasRef}
              className="w-full h-64 bg-card rounded border"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-blue-600 font-semibold">Fp1</div>
              <div className="text-muted-foreground">Frontal Left</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-green-600 font-semibold">Fp2</div>
              <div className="text-muted-foreground">Frontal Right</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-amber-600 font-semibold">C3</div>
              <div className="text-muted-foreground">Central Left</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-red-600 font-semibold">C4</div>
              <div className="text-muted-foreground">Central Right</div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default EEGSimulation;