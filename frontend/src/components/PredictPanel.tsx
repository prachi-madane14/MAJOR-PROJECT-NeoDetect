import { useState } from "react";

interface ShapResult {
  prediction: number;
  confidence: number;
  status: string;
  shap_values: Record<string, number>;
  shap_reason: string;
  shap_detail: string;
  shap_top3: { feature: string; shap: number; direction: string }[];
}

function ShapPanel({ result }: { result: ShapResult }) {
  const entries = Object.entries(result.shap_values)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.001);
  const isPain = result.prediction === 1;

  return (
    <div className="mt-6">
      {/* Status */}
      <div className={`p-4 rounded-xl text-center text-white font-bold text-lg mb-4 ${isPain ? "bg-red-500" : "bg-green-500"}`}>
        {result.status}
        <span className="ml-2 font-normal text-sm opacity-90">
          ({result.confidence.toFixed(1)}% confidence)
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Pain probability</span>
          <span>{result.confidence.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded overflow-hidden">
          <div
            style={{
              width: `${result.confidence}%`,
              background: result.confidence > 70 ? "#ef4444" : result.confidence > 45 ? "#f59e0b" : "#22c55e",
              height: "100%",
              transition: "width 0.5s",
            }}
          />
        </div>
      </div>

      {/* SHAP explanation */}
      <div className="p-4 border rounded-xl bg-gray-50 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">Why this prediction?</h3>
        <p className="text-sm text-gray-500 italic mb-1">{result.shap_reason}</p>
        <p className="text-xs text-gray-400 mb-4">{result.shap_detail}</p>

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

      {/* Top 3 table */}
      <div className="p-4 border rounded-xl bg-white">
        <h3 className="font-semibold text-gray-700 mb-3">Top 3 contributing features</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b">
              <th className="pb-2">Feature</th>
              <th className="pb-2">SHAP value</th>
              <th className="pb-2">Effect</th>
            </tr>
          </thead>
          <tbody>
            {result.shap_top3.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 capitalize text-gray-700">{row.feature}</td>
                <td className="py-2 font-mono" style={{ color: row.shap > 0 ? "#ef4444" : "#22c55e" }}>
                  {row.shap > 0 ? "+" : ""}{row.shap.toFixed(4)}
                </td>
                <td className="py-2 text-xs text-gray-500">{row.direction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PredictPanel() {
  const [form, setForm] = useState({
    eeg_mean: "", eeg_skewness: "", eeg_kurtosis: "",
    delta_power: "", theta_power: "", rr_interval: "", spo2_drop: "",
  });
  const [result, setResult] = useState<ShapResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    if (Object.values(form).some(v => v === "")) {
      alert("Fill all fields properly");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, parseFloat(v)])
      );
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("API failed");
      const data = await response.json();
      // handle both {result: ...} and flat response shapes
      setResult(data.result ?? data);
    } catch (err) {
      console.error(err);
      alert("Something broke. Check backend or inputs.");
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6">🧠 Manual Pain Prediction</h2>

      <div className="grid grid-cols-2 gap-4">
        {Object.keys(form).map((key) => (
          <div key={key} className="flex flex-col">
            <label className="text-sm font-medium mb-1 capitalize">
              {key.replace(/_/g, " ")}
            </label>
            <input
              name={key}
              type="number"
              step="any"
              placeholder={`Enter ${key}`}
              value={form[key as keyof typeof form]}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full mt-6 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
      >
        {loading ? "Predicting..." : "Predict"}
      </button>

      {result && <ShapPanel result={result} />}
    </div>
  );
}
