import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

const generateEEGSample = (t: number) => {
  // Make it wavey, chaotic, and fake
  const freq1 = 10; // alpha waves
  const freq2 = 20; // beta waves
  const noise = (Math.random() - 0.5) * 20; // add randomness
  return (
    50 +
    30 * Math.sin(2 * Math.PI * freq1 * t) +
    15 * Math.sin(2 * Math.PI * freq2 * t) +
    noise
  );
};

const EEGLiveSim = () => {
  const [dataPoints, setDataPoints] = useState<number[]>([]);
  const [labels, setLabels] = useState<number[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      timeRef.current += 0.02; // 20 ms intervals
      const newVal = generateEEGSample(timeRef.current);

      setDataPoints((prev) => {
        const updated = [...prev, newVal];
        return updated.length > 100 ? updated.slice(-100) : updated;
      });

      setLabels((prev) => {
        const updated = [...prev, timeRef.current];
        return updated.length > 100 ? updated.slice(-100) : updated;
      });
    }, 20);

    return () => clearInterval(interval);
  }, []);

  const data = {
    labels,
    datasets: [
      {
        label: "EEG Signal (μV)",
        data: dataPoints,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
    ],
  };

  const options = {
    responsive: true,
    animation: false as const,
    scales: {
      x: {
        ticks: { display: false },
        grid: { display: false },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: "rgba(200,200,200,0.1)" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  };

  return (
    <div className="flex flex-col items-center p-6">
      <h2 className="text-2xl font-semibold mb-4 text-indigo-500">Live EEG Simulation</h2>
      <div className="w-full max-w-3xl">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default EEGLiveSim;
