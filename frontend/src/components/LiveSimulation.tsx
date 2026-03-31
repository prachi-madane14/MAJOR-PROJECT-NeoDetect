import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  time: number;
  eeg_mean: number;
  eeg_skewness: number;
  eeg_kurtosis: number;
  delta_power: number;
  theta_power: number;
  rr_interval: number;
  spo2_drop: number;
  prediction: number;
  confidence?: number;
  shap_values?: Record<string, number>;
  shap_reason?: string;
  shap_detail?: string;
  shap_top3?: { feature: string; shap: number; direction: string }[];
}

function ShapPanel({ latest }: { latest: DataPoint | undefined }) {
  if (!latest?.shap_values) return null;

  const entries = Object.entries(latest.shap_values)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.001);

  return (
    <div className="mb-8 p-4 border rounded-xl bg-gray-50">
      <h3 className="font-semibold text-gray-700 mb-1">Why this prediction?</h3>
      <p className="text-sm text-gray-500 italic mb-1">{latest.shap_reason}</p>
      <p className="text-xs text-gray-400 mb-4">{latest.shap_detail}</p>
      <div className="space-y-2">
        {entries.map(([feat, val]) => {
          const pct = (Math.abs(val) / maxAbs) * 100;
          const isPos = val > 0;
          return (
            <div key={feat} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-28 shrink-0 capitalize">
                {feat.replace(/_/g, " ")}
              </span>
              <div className="flex-1 h-3 bg-gray-200 rounded overflow-hidden">
                <div style={{ width: `${pct}%`, background: isPos ? "#ef4444" : "#22c55e", height: "100%", transition: "width 0.4s" }} />
              </div>
              <span className="text-xs font-mono w-14 text-right" style={{ color: isPos ? "#ef4444" : "#22c55e" }}>
                {isPos ? "+" : ""}{val.toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span><span className="text-red-400 font-bold">■</span> increases pain probability</span>
        <span><span className="text-green-400 font-bold">■</span> decreases pain probability</span>
      </div>
    </div>
  );
}

export default function LiveSimulation() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    const eventSource = new EventSource("http://127.0.0.1:8000/stream");
    eventSource.onmessage = (event) => {
      const newData: DataPoint = JSON.parse(event.data);
      setData((prev) => {
        const updated = [...prev, newData];
        if (updated.length > 20) updated.shift();
        return updated;
      });
    };
    return () => eventSource.close();
  }, []);

  const latest = data[data.length - 1];
  const isPain = latest?.prediction === 1;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Neonatal Pain Monitoring Dashboard</h1>

      {/* Status banner */}
      <div className={`mb-4 p-3 rounded-xl font-semibold text-center text-white ${isPain ? "bg-red-500" : "bg-green-500"}`}>
        {isPain ? "⚠ PAIN DETECTED" : "✓ NO PAIN DETECTED"}
        {latest?.confidence !== undefined && (
          <span className="ml-2 font-normal text-sm opacity-90">
            ({latest.confidence.toFixed(1)}% confidence)
          </span>
        )}
      </div>

      {/* SHAP explanation */}
      <ShapPanel latest={latest} />

      {/* Charts — unchanged */}
      <div className="mb-8 h-[250px]">
        <h3 className="mb-2">EEG Mean</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid stroke="#ccc" /><XAxis dataKey="time" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="eeg_mean" stroke="#2563eb" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 h-[250px]">
        <h3 className="mb-2">EEG Skewness</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid stroke="#ccc" /><XAxis dataKey="time" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="eeg_skewness" stroke="#f59e0b" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 h-[250px]">
        <h3 className="mb-2">EEG Kurtosis</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid stroke="#ccc" /><XAxis dataKey="time" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="eeg_kurtosis" stroke="#dc2626" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 h-[250px]">
        <h3 className="mb-2">Delta Power</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid stroke="#ccc" /><XAxis dataKey="time" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="delta_power" stroke="#16a34a" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 h-[250px]">
        <h3 className="mb-2">Theta Power</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid stroke="#ccc" /><XAxis dataKey="time" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="theta_power" stroke="#7c3aed" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 h-[250px]">
        <h3 className="mb-2">RR Interval</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid stroke="#ccc" /><XAxis dataKey="time" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="rr_interval" stroke="#059669" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 h-[250px]">
        <h3 className="mb-2">SpO2 Drop</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}><CartesianGrid stroke="#ccc" /><XAxis dataKey="time" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="spo2_drop" stroke="#be123c" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
