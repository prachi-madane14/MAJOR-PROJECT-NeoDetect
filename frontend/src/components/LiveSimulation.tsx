import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

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
}

const SIGNALS = [
  { key: "eeg_mean",     label: "EEG Mean",      unit: "μV",     color: "#60a5fa", ref: null },
  { key: "eeg_skewness", label: "EEG Skewness",  unit: "",       color: "#fb923c", ref: null },
  { key: "eeg_kurtosis", label: "EEG Kurtosis",  unit: "",       color: "#f87171", ref: 3.5  },
  { key: "delta_power",  label: "Delta Power",   unit: "μV²/Hz", color: "#34d399", ref: null },
  { key: "theta_power",  label: "Theta Power",   unit: "μV²/Hz", color: "#a78bfa", ref: null },
  { key: "rr_interval",  label: "RR Interval",   unit: "s",      color: "#4ade80", ref: 0.38 },
  { key: "spo2_drop",    label: "SpO₂ Drop",     unit: "%",      color: "#fb7185", ref: 4.0  },
];

const styles = {
  root: {
    minHeight: "100vh",
    background: "#080c14",
    color: "#e2e8f0",
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
  } as React.CSSProperties,
  topbar: {
    background: "#0a0f1e",
    borderBottom: "1px solid #1a2540",
    padding: "0 24px",
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky" as const,
    top: 0,
    zIndex: 50,
  },
  tag: (color: string, bg: string) => ({
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color,
    background: bg,
    padding: "3px 8px",
    border: `1px solid ${color}30`,
  }),
};

function Dot({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: active ? "#22c55e" : "#374151",
      boxShadow: active ? "0 0 6px #22c55e" : "none",
      animation: active ? "pulse 2s infinite" : "none",
      marginRight: 6,
    }} />
  );
}

function ShapBar({ shap_values, shap_reason, shap_detail }: {
  shap_values: Record<string, number>;
  shap_reason?: string;
  shap_detail?: string;
}) {
  const entries = Object.entries(shap_values).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.001);
  return (
    <div style={{ background: "#0d1525", border: "1px solid #1a2540", padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "#4b6cb7", marginBottom: 10, textTransform: "uppercase" }}>
        XAI — Why this prediction?
      </div>
      {shap_reason && <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4, fontStyle: "italic" }}>{shap_reason}</p>}
      {shap_detail && <p style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>{shap_detail}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {entries.map(([feat, val]) => {
          const pct = (Math.abs(val) / max) * 100;
          const pos = val > 0;
          return (
            <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "#64748b", width: 110, flexShrink: 0 }}>{feat.replace(/_/g, " ")}</span>
              <div style={{ flex: 1, height: 4, background: "#1e2d4a" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pos ? "#ef4444" : "#22c55e", transition: "width 0.4s" }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: "inherit", width: 56, textAlign: "right", color: pos ? "#f87171" : "#4ade80" }}>
                {pos ? "+" : ""}{val.toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10, color: "#374151" }}>
        <span style={{ color: "#f87171" }}>▲ increases pain</span>
        <span style={{ color: "#4ade80" }}>▼ decreases pain</span>
      </div>
    </div>
  );
}

function SignalCard({ sig, data }: { sig: typeof SIGNALS[0]; data: DataPoint[] }) {
  const latest = data[data.length - 1];
  const val = latest ? (latest as any)[sig.key] as number : null;
  const prev = data.length > 1 ? (data[data.length - 2] as any)[sig.key] as number : val;
  const trend = val !== null && prev !== null ? val > prev ? "↑" : val < prev ? "↓" : "—" : "—";
  const warn = sig.ref !== null && val !== null && (sig.key === "rr_interval" ? val < sig.ref! : val > sig.ref!);

  return (
    <div style={{
      background: "#0d1525",
      border: `1px solid ${warn ? "#ef444440" : "#1a2540"}`,
      padding: "12px 16px",
      transition: "border-color 0.3s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4b6cb7", marginBottom: 2 }}>
            {sig.label}
            {warn && <span style={{ marginLeft: 6, color: "#ef4444", fontSize: 9 }}>⚠ THRESHOLD</span>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700, color: warn ? "#f87171" : sig.color, lineHeight: 1 }}>
            {val !== null ? val.toFixed(3) : "—"}
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{sig.unit} <span style={{ color: "#94a3b8" }}>{trend}</span></div>
        </div>
      </div>
      <div style={{ height: 72 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 0, left: -32, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis tick={{ fontSize: 9, fill: "#374151" }} width={34} />
            <Tooltip
              contentStyle={{ background: "#0d1525", border: "1px solid #1a2540", fontSize: 11, fontFamily: "inherit" }}
              labelStyle={{ color: "#64748b" }}
              itemStyle={{ color: sig.color }}
            />
            {sig.ref !== null && <ReferenceLine y={sig.ref} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />}
            <Line type="monotone" dataKey={sig.key} stroke={warn ? "#f87171" : sig.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function LiveSimulation() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const es = new EventSource(`${API}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      const pt: DataPoint = JSON.parse(e.data);
      setData(prev => [...prev.slice(-29), pt]);
      setTick(t => t + 1);
    };
    return () => es.close();
  }, []);

  const latest = data[data.length - 1];
  const isPain = latest?.prediction === 1;
  const recentPain = data.slice(-5).filter(d => d.prediction === 1).length;
  const alert = recentPain >= 3;
  const conf = latest?.confidence ?? (isPain ? 78 : 22);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        * { box-sizing: border-box; margin: 0; }
      `}</style>
      <div style={styles.root}>

        {/* Topbar */}
        <div style={styles.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Dot active={connected} />
            <span style={{ fontSize: 11, color: "#4b6cb7" }}>
              {connected ? "STREAMING" : "OFFLINE"} · {data.length} EPOCHS · T+{tick}
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: "#60a5fa" }}>
            NEODETECT · NICU MONITOR
          </span>
          <span style={styles.tag("#ef4444", "#1c0a0a")}>RESEARCH PROTOTYPE</span>
        </div>

        <div style={{ padding: "16px 20px" }}>

          {/* Alert banner */}
          <div style={{
            border: `1px solid ${alert ? "#ef4444" : "#16a34a"}`,
            background: alert ? "#0f0505" : "#05130d",
            padding: "14px 20px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            transition: "all 0.4s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: alert ? "#ef4444" : "#22c55e",
                boxShadow: `0 0 8px ${alert ? "#ef4444" : "#22c55e"}`,
                animation: alert ? "blink 1s infinite" : "pulse 3s infinite",
              }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", color: alert ? "#fca5a5" : "#86efac" }}>
                  {alert ? "⚠  PAIN DETECTED" : "✓  NO PAIN DETECTED"}
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                  {recentPain}/5 recent epochs flagged · rolling window alert
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 160 }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>PAIN PROBABILITY</div>
              <div style={{ height: 4, background: "#1e2d4a", marginBottom: 4 }}>
                <div style={{
                  height: "100%",
                  width: `${conf}%`,
                  background: conf > 70 ? "#ef4444" : conf > 45 ? "#f59e0b" : "#22c55e",
                  transition: "width 0.5s",
                }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: conf > 70 ? "#f87171" : conf > 45 ? "#fbbf24" : "#4ade80" }}>
                {conf.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* SHAP */}
          {latest?.shap_values && (
            <ShapBar
              shap_values={latest.shap_values}
              shap_reason={latest.shap_reason}
              shap_detail={latest.shap_detail}
            />
          )}

          {/* Stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "EEG Kurtosis", val: latest?.eeg_kurtosis, warn: (latest?.eeg_kurtosis ?? 0) > 3.5 },
              { label: "RR Interval",  val: latest?.rr_interval,  warn: (latest?.rr_interval ?? 1) < 0.38 },
              { label: "SpO₂ Drop",   val: latest?.spo2_drop,    warn: (latest?.spo2_drop ?? 0) > 4 },
              { label: "Delta Power", val: latest?.delta_power,  warn: false },
            ].map(s => (
              <div key={s.label} style={{ background: "#0d1525", border: `1px solid ${s.warn ? "#ef444430" : "#1a2540"}`, padding: "10px 14px" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4b6cb7", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.warn ? "#f87171" : "#e2e8f0" }}>
                  {s.val?.toFixed(3) ?? "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Signal grid */}
          {["EEG", "Cardiac & SpO₂"].map((group, gi) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#334155", marginBottom: 8, borderBottom: "1px solid #1a2540", paddingBottom: 6 }}>
                {group}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 8 }}>
                {SIGNALS.filter((_, i) => gi === 0 ? i < 5 : i >= 5).map(sig => (
                  <SignalCard key={sig.key} sig={sig} data={data} />
                ))}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div style={{ fontSize: 10, color: "#1e2d4a", textAlign: "center", marginTop: 8, letterSpacing: "0.08em" }}>
            RESEARCH PROTOTYPE · SYNTHETIC MODEL · NOT FOR CLINICAL USE · LAST 30 EPOCHS DISPLAYED
          </div>
        </div>
      </div>
    </>
  );
}
