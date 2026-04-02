import { useRef, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const API = (import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastResult {
  available: boolean;
  forecast_prob: number | null;
  forecast_label: number | null;
  risk_level: "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
  message: string;
  horizon_epochs: number | null;
  window_used: number | null;
}

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
  confidence: number;
  forecast?: ForecastResult;
  shap_values?: Record<string, number>;
  shap_reason?: string;
  shap_detail?: string;
  shap_top3?: Array<{ feature: string; value: number; direction: string }>;
}

interface XAIEntry {
  epoch: number;
  time: number;
  prediction: number;
  confidence: number;
  shap_values: Record<string, number>;
  shap_reason?: string;
  shap_detail?: string;
  shap_top3?: Array<{ feature: string; value: number; direction: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeFixed(val: unknown, digits = 3, fallback = "—"): string {
  const n = Number(val);
  return isFinite(n) ? n.toFixed(digits) : fallback;
}

// ─── Signal Config ─────────────────────────────────────────────────────────────

const SIGNALS = [
  { key: "eeg_mean",     label: "EEG Mean",     unit: "μV",     color: "#60a5fa", ref: null  },
  { key: "eeg_skewness", label: "EEG Skewness", unit: "",       color: "#fb923c", ref: null  },
  { key: "eeg_kurtosis", label: "EEG Kurtosis", unit: "",       color: "#f87171", ref: 3.5   },
  { key: "delta_power",  label: "Delta Power",  unit: "μV²/Hz", color: "#34d399", ref: null  },
  { key: "theta_power",  label: "Theta Power",  unit: "μV²/Hz", color: "#a78bfa", ref: null  },
  { key: "rr_interval",  label: "RR Interval",  unit: "s",      color: "#4ade80", ref: 0.38  },
  { key: "spo2_drop",    label: "SpO₂ Drop",    unit: "%",      color: "#fb7185", ref: 4.0   },
] as const;

// ─── Forecast Sparkline Panel ─────────────────────────────────────────────────

function ForecastTrendPanel({ history }: { history: ForecastResult[] }) {
  const sparkData = history.slice(-20).map((f, i) => ({
    i,
    prob: f.available ? (f.forecast_prob ?? 0) : null,
  }));

  const latest = history[history.length - 1];
  const riskColor =
    latest?.risk_level === "HIGH"     ? "#ef4444" :
    latest?.risk_level === "MODERATE" ? "#f59e0b" : "#22c55e";

  if (sparkData.filter(d => d.prob !== null).length < 3) return null;

  return (
    <div style={{
      background: "#0a0f1e",
      border: "1px solid #1a2540",
      padding: "10px 16px",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#334155", marginBottom: 6 }}>
        🔮 FORECAST TREND · PAIN RISK NEXT ~30 s (LAST 20 EPOCHS)
      </div>
      <div style={{ height: 44 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="i" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{ background: "#0d1525", border: "1px solid #1a2540", fontSize: 10, fontFamily: "inherit" }}
              formatter={(v: any) => [`${safeFixed(v, 1)}%`, "Risk"]}
              labelFormatter={() => ""}
            />
            <ReferenceLine y={70} stroke="#ef444428" strokeDasharray="3 3" />
            <ReferenceLine y={45} stroke="#f59e0b28" strokeDasharray="3 3" />
            <Line
              type="monotone" dataKey="prob"
              stroke={riskColor} strokeWidth={1.5}
              dot={false} isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginTop: 2 }}>
        <span style={{ fontSize: 8, color: "#ef444450" }}>── HIGH (70%)</span>
        <span style={{ fontSize: 8, color: "#f59e0b50" }}>── MODERATE (45%)</span>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function SignalCard({ sig, data }: { sig: typeof SIGNALS[number]; data: DataPoint[] }) {
  const latest = data[data.length - 1];
  const val  = latest ? (latest as any)[sig.key] as number : null;
  const prev = data.length > 1 ? (data[data.length - 2] as any)[sig.key] as number : val;
  const trend = val !== null && prev !== null ? val > prev ? "↑" : val < prev ? "↓" : "—" : "—";
  const warn  = sig.ref !== null && val !== null &&
    (sig.key === "rr_interval" ? val < (sig.ref as number) : val > (sig.ref as number));

  return (
    <div style={{
      background: "#0d1525",
      border: `1px solid ${warn ? "#ef444440" : "#1a2540"}`,
      padding: "12px 16px",
      transition: "border-color 0.3s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4b6cb7" }}>
          {sig.label}
          {warn && <span style={{ marginLeft: 6, color: "#ef4444", fontSize: 9 }}>⚠ THRESHOLD</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700, color: warn ? "#f87171" : sig.color, lineHeight: 1 }}>
            {val !== null ? safeFixed(val) : "—"}
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
            {sig.unit} <span style={{ color: "#94a3b8" }}>{trend}</span>
          </div>
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

// ─── XAI Card ─────────────────────────────────────────────────────────────────

function XAICard({ entry, index, isNew }: { entry: XAIEntry; index: number; isNew: boolean }) {
  // Latest entry (index 0) starts expanded, rest collapsed
  const [expanded, setExpanded] = useState(index === 0);
  const isPain = entry.prediction === 1;
  const conf   = safeFixed(entry.confidence * 100, 1, "0.0");

  const entries: [string, number][] = entry.shap_values
    ? Object.entries(entry.shap_values)
        .map(([k, v]) => [k, Number(v)] as [string, number])
        .filter(([, v]) => isFinite(v))
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    : [];

  const max = entries.length > 0
    ? Math.max(...entries.map(([, v]) => Math.abs(v)), 0.001)
    : 0.001;

  return (
    <div style={{
      background: isPain ? "#0f0a0a" : "#080f0a",
      border: `1px solid ${isNew ? (isPain ? "#ef4444" : "#22c55e") : isPain ? "#ef444330" : "#16a34a30"}`,
      marginBottom: 8,
      transition: "border-color 0.6s",
      flexShrink: 0,
      // Flash ring on new entries
      outline: isNew ? `1px solid ${isPain ? "#ef444460" : "#22c55e60"}` : "none",
      outlineOffset: isNew ? "1px" : "0px",
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isNew && (
            <span style={{
              fontSize: 8, letterSpacing: "0.1em", fontWeight: 700,
              color: "#fbbf24", background: "#1a1000",
              padding: "1px 5px", border: "1px solid #f59e0b40",
              animation: "shimmer 1s ease-out",
            }}>NEW</span>
          )}
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            color: isPain ? "#f87171" : "#4ade80",
            background: isPain ? "#1c0a0a" : "#05130d",
            padding: "2px 7px",
            border: `1px solid ${isPain ? "#ef444440" : "#16a34a40"}`,
          }}>
            {isPain ? "PAIN" : "CLEAR"}
          </span>
          <span style={{ fontSize: 10, color: "#64748b" }}>Epoch {entry.epoch}</span>
          <span style={{ fontSize: 10, color: "#334155" }}>T+{entry.time}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: parseFloat(conf) > 70 ? "#f87171" : parseFloat(conf) > 45 ? "#fbbf24" : "#4ade80",
          }}>
            {conf}%
          </span>
          <span style={{ fontSize: 10, color: "#334155" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 12px" }}>
          {entry.shap_reason && (
            <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, fontStyle: "italic", lineHeight: 1.5 }}>
              {entry.shap_reason}
            </p>
          )}
          {entry.shap_detail && (
            <p style={{ fontSize: 10, color: "#475569", marginBottom: 10 }}>{entry.shap_detail}</p>
          )}
          {entries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {entries.map(([feat, val]) => {
                const pct = (Math.abs(val) / max) * 100;
                const pos = val > 0;
                return (
                  <div key={feat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#64748b", width: 100, flexShrink: 0 }}>
                      {feat.replace(/_/g, " ")}
                    </span>
                    <div style={{ flex: 1, height: 3, background: "#1e2d4a" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        background: pos ? "#ef4444" : "#22c55e",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <span style={{ fontSize: 10, width: 50, textAlign: "right", color: pos ? "#f87171" : "#4ade80" }}>
                      {pos ? "+" : ""}{safeFixed(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {entry.shap_top3 && entry.shap_top3.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #1a2540" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#334155", marginBottom: 6 }}>TOP DRIVERS</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {entry.shap_top3.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 10,
                    color: t.direction === "up" ? "#f87171" : "#4ade80",
                    background: t.direction === "up" ? "#1c0a0a" : "#05130d",
                    padding: "2px 8px",
                    border: `1px solid ${t.direction === "up" ? "#ef444430" : "#16a34a30"}`,
                  }}>
                    {t.feature.replace(/_/g, " ")} {t.direction === "up" ? "↑" : "↓"} {Number(t.value) > 0 ? "+" : ""}{safeFixed(t.value)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#60a5fa" : "#1e2d4a"}`,
        background: dragging ? "#0d1a2e" : "#0a0f1e",
        padding: "40px 32px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.25s",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
      <div style={{ fontSize: 13, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.06em" }}>
        DROP CSV FILE HERE
      </div>
      <div style={{ fontSize: 11, color: "#334155" }}>
        or click to browse · must contain the 7 NeoDetect feature columns
      </div>
      <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type SimStatus = "idle" | "uploading" | "streaming" | "done" | "error";

export default function CSVSimulation() {
  const [status,          setStatus]          = useState<SimStatus>("idle");
  const [data,            setData]            = useState<DataPoint[]>([]);
  const [xaiHistory,      setXaiHistory]      = useState<XAIEntry[]>([]);
  const [forecastHistory, setForecastHistory] = useState<ForecastResult[]>([]);
  const [epochCount,      setEpochCount]      = useState(0);
  const [errorMsg,        setErrorMsg]        = useState("");
  const [fileName,        setFileName]        = useState("");
  // XAI readability state
  const [xaiPaused,       setXaiPaused]       = useState(false);
  const [newestKey,       setNewestKey]       = useState<string>("");
  const [pendingEntries,  setPendingEntries]  = useState<XAIEntry[]>([]);

  const esRef        = useRef<EventSource | null>(null);
  const xaiScrollRef = useRef<HTMLDivElement>(null);
  const xaiPausedRef = useRef(false);

  // Keep ref in sync with state so SSE handler can read it without stale closure
  const syncPause = (val: boolean) => {
    xaiPausedRef.current = val;
    setXaiPaused(val);
  };

  const flushPending = useCallback(() => {
    setPendingEntries(prev => {
      if (prev.length === 0) return prev;
      setXaiHistory(hist => {
        const merged = [...prev, ...hist].slice(0, 20);
        setNewestKey(`${merged[0]?.epoch}-${merged[0]?.time}`);
        return merged;
      });
      return [];
    });
    syncPause(false);
  }, []);

  const startSimulation = useCallback(async (file: File) => {
    esRef.current?.close();
    setData([]);
    setXaiHistory([]);
    setForecastHistory([]);
    setPendingEntries([]);
    setEpochCount(0);
    setErrorMsg("");
    setFileName(file.name);
    setNewestKey("");
    syncPause(false);
    setStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`${API}/upload_csv_session`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
      const { session_id } = await uploadRes.json();

      setStatus("streaming");
      const es = new EventSource(`${API}/stream_csv/${session_id}`);
      esRef.current = es;

      es.onmessage = (e) => {
        const pt: DataPoint = JSON.parse(e.data);

        if ((pt as any).done) {
          setStatus("done");
          es.close();
          return;
        }

        setData(prev => [...prev.slice(-29), pt]);
        setEpochCount(c => c + 1);

        if (pt.forecast) {
          setForecastHistory(prev => [...prev.slice(-49), pt.forecast!]);
        }

        if (pt.shap_values) {
          const entry: XAIEntry = {
            epoch: pt.time + 1,
            time: pt.time,
            prediction: pt.prediction,
            confidence: pt.confidence,
            shap_values: pt.shap_values,
            shap_reason: pt.shap_reason,
            shap_detail: pt.shap_detail,
            shap_top3: pt.shap_top3,
          };

          if (xaiPausedRef.current) {
            // Queue it — don't push to visible list while user is reading
            setPendingEntries(prev => [entry, ...prev].slice(0, 40));
          } else {
            setXaiHistory(prev => {
              const next = [entry, ...prev].slice(0, 20);
              setNewestKey(`${entry.epoch}-${entry.time}`);
              return next;
            });
            // Scroll to top only when not paused
            setTimeout(() => {
              if (xaiScrollRef.current) xaiScrollRef.current.scrollTop = 0;
            }, 50);
          }
        }
      };

      es.onerror = () => {
        setStatus("done");
        es.close();
      };
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unknown error");
      setStatus("error");
    }
  }, []);

  const stopSimulation = useCallback(() => {
    esRef.current?.close();
    setStatus("done");
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    setData([]);
    setXaiHistory([]);
    setForecastHistory([]);
    setPendingEntries([]);
    setEpochCount(0);
    setErrorMsg("");
    setFileName("");
    setNewestKey("");
    syncPause(false);
    setStatus("idle");
  }, []);

  const latest         = data[data.length - 1];
  const recentPain     = data.slice(-5).filter(d => d.prediction === 1).length;
  const alert          = recentPain >= 3;
  const conf           = isFinite(Number(latest?.confidence)) ? Number(latest?.confidence) * 100 : 0;
  const streaming      = status === "streaming";
  const latestForecast = latest?.forecast;

  const fProb     = latestForecast?.forecast_prob ?? 0;
  const fRisk     = latestForecast?.risk_level ?? "UNKNOWN";
  const fColor    = fRisk === "HIGH" ? "#f87171" : fRisk === "MODERATE" ? "#fbbf24" : "#4ade80";
  const fBg       = fRisk === "HIGH" ? "#0f0505"  : fRisk === "MODERATE" ? "#0f0a00"  : "#05130d";
  const fBorder   = fRisk === "HIGH" ? "#ef4444"  : fRisk === "MODERATE" ? "#f59e0b"  : "#16a34a";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        @keyframes pulse   { 0%,100%{opacity:1}    50%{opacity:.3}  }
        @keyframes blink   { 0%,49%{opacity:1}     50%,100%{opacity:0} }
        @keyframes shimmer { 0%{opacity:.4}         50%{opacity:1}   100%{opacity:.4} }
        @keyframes flashIn { 0%{opacity:0;transform:translateY(-4px)} 100%{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080c14; }
        ::-webkit-scrollbar-thumb { background: #1e2d4a; border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#080c14",
        color: "#e2e8f0",
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      }}>

        {/* ── Top bar ── */}
        <div style={{
          background: "#0a0f1e",
          borderBottom: "1px solid #1a2540",
          padding: "0 24px",
          height: 48,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Dot active={streaming} />
            <span style={{ fontSize: 11, color: "#4b6cb7" }}>
              {status === "idle"      ? "AWAITING CSV"                    :
               status === "uploading" ? "UPLOADING..."                    :
               streaming              ? `STREAMING · ${epochCount} EPOCHS` :
               status === "done"      ? `COMPLETE · ${epochCount} EPOCHS`  :
               "ERROR"}
            </span>
            {fileName && <span style={{ fontSize: 10, color: "#334155" }}>· {fileName}</span>}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: "#60a5fa" }}>
            NEODETECT · CSV SIMULATION
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {streaming && (
              <button onClick={stopSimulation} style={{
                fontSize: 10, letterSpacing: "0.1em", fontFamily: "inherit",
                color: "#f87171", background: "#1c0a0a", border: "1px solid #ef444440",
                padding: "4px 12px", cursor: "pointer",
              }}>■ STOP</button>
            )}
            {(status === "done" || status === "error") && (
              <button onClick={reset} style={{
                fontSize: 10, letterSpacing: "0.1em", fontFamily: "inherit",
                color: "#60a5fa", background: "#0d1525", border: "1px solid #1e3a5f",
                padding: "4px 12px", cursor: "pointer",
              }}>↺ RESET</button>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              color: "#ef4444", background: "#1c0a0a",
              padding: "3px 8px", border: "1px solid #ef444430",
            }}>RESEARCH PROTOTYPE</span>
          </div>
        </div>

        <div style={{ padding: "16px 20px" }}>

          {/* ── Upload zone ── */}
          {(status === "idle" || status === "error") && (
            <div style={{ maxWidth: 600, margin: "40px auto" }}>
              <div style={{ marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#4b6cb7", marginBottom: 6 }}>
                  CSV SIMULATION MODE
                </div>
                <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 4 }}>
                  Upload your dataset to run a live simulation
                </div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  Rows stream one-by-one · SHAP explanation · Pain forecasting · XAI history log
                </div>
              </div>
              <UploadZone onFile={startSimulation} />
              {status === "error" && (
                <div style={{
                  marginTop: 16, padding: "12px 16px",
                  background: "#0f0505", border: "1px solid #ef444440",
                  fontSize: 11, color: "#f87171",
                }}>
                  ❌ {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* ── Uploading ── */}
          {status === "uploading" && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 13, color: "#60a5fa", animation: "shimmer 1.2s infinite", letterSpacing: "0.1em" }}>
                UPLOADING & PROCESSING CSV...
              </div>
            </div>
          )}

          {/* ── Live simulation layout ── */}
          {(streaming || status === "done") && data.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>

              {/* ── LEFT ── */}
              <div>

                {/* ══ Dual status row ══ */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>

                  {/* Current detection card */}
                  <div style={{
                    border: `1px solid ${alert ? "#ef4444" : "#16a34a"}`,
                    background: alert ? "#0f0505" : "#05130d",
                    padding: "14px 18px",
                    transition: "all 0.4s",
                  }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#334155", marginBottom: 8 }}>
                      ⚡ CURRENT STATUS
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <div style={{
                        width: 9, height: 9, borderRadius: "50%",
                        background: alert ? "#ef4444" : "#22c55e",
                        boxShadow: `0 0 8px ${alert ? "#ef4444" : "#22c55e"}`,
                        animation: alert ? "blink 1s infinite" : "pulse 3s infinite",
                        flexShrink: 0,
                      }} />
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: alert ? "#fca5a5" : "#86efac" }}>
                        {alert ? "⚠ PAIN DETECTED" : "✓ NO PAIN"}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: "#475569", marginBottom: 10 }}>
                      {recentPain}/5 recent epochs flagged · rolling window
                    </div>
                    <div style={{ fontSize: 9, color: "#475569", marginBottom: 3 }}>PAIN PROBABILITY</div>
                    <div style={{ height: 3, background: "#1e2d4a", marginBottom: 5 }}>
                      <div style={{
                        height: "100%", width: `${conf}%`,
                        background: conf > 70 ? "#ef4444" : conf > 45 ? "#f59e0b" : "#22c55e",
                        transition: "width 0.5s",
                      }} />
                    </div>
                    <div style={{
                      fontSize: 24, fontWeight: 700,
                      color: conf > 70 ? "#f87171" : conf > 45 ? "#fbbf24" : "#4ade80",
                    }}>
                      {safeFixed(conf, 1)}%
                    </div>
                  </div>

                  {/* Forecast card */}
                  <div style={{
                    border: `1px solid ${latestForecast?.available ? fBorder : "#1a2540"}`,
                    background: latestForecast?.available ? fBg : "#0a0f1e",
                    padding: "14px 18px",
                    transition: "all 0.4s",
                  }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#334155", marginBottom: 8 }}>
                      🔮 FORECAST · NEXT ~30 s
                    </div>

                    {!latestForecast?.available ? (
                      <div style={{ fontSize: 11, color: "#334155", fontStyle: "italic" }}>
                        Collecting signal history…<br />
                        <span style={{ fontSize: 10, color: "#1e2d4a" }}>
                          Available after 4 epochs
                        </span>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                            color: fColor,
                            background: fRisk === "HIGH" ? "#1c0a0a" : fRisk === "MODERATE" ? "#1a1000" : "#05130d",
                            padding: "2px 9px",
                            border: `1px solid ${fBorder}40`,
                          }}>
                            {fRisk} RISK
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
                          {latestForecast.message}
                        </div>
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 3 }}>FUTURE PAIN PROBABILITY</div>
                        <div style={{ height: 3, background: "#1e2d4a", marginBottom: 5 }}>
                          <div style={{
                            height: "100%",
                            width: `${Math.min(fProb, 100)}%`,
                            background: fRisk === "HIGH" ? "#ef4444" : fRisk === "MODERATE" ? "#f59e0b" : "#22c55e",
                            transition: "width 0.6s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: fColor }}>
                          {safeFixed(fProb, 1)}%
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Forecast trend sparkline */}
                <ForecastTrendPanel history={forecastHistory} />

                {/* Stats strip */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "EEG Kurtosis", val: latest?.eeg_kurtosis, warn: (latest?.eeg_kurtosis ?? 0) > 3.5 },
                    { label: "RR Interval",  val: latest?.rr_interval,  warn: (latest?.rr_interval ?? 1) < 0.38 },
                    { label: "SpO₂ Drop",    val: latest?.spo2_drop,    warn: (latest?.spo2_drop ?? 0) > 4 },
                    { label: "Delta Power",  val: latest?.delta_power,  warn: false },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: "#0d1525",
                      border: `1px solid ${s.warn ? "#ef444430" : "#1a2540"}`,
                      padding: "10px 14px",
                    }}>
                      <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4b6cb7", marginBottom: 4 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.warn ? "#f87171" : "#e2e8f0" }}>
                        {safeFixed(s.val)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Signal grids */}
                {(["EEG", "Cardiac & SpO₂"] as const).map((group, gi) => (
                  <div key={group} style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
                      textTransform: "uppercase", color: "#334155",
                      marginBottom: 8, borderBottom: "1px solid #1a2540", paddingBottom: 6,
                    }}>{group}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8 }}>
                      {SIGNALS.filter((_, i) => gi === 0 ? i < 5 : i >= 5).map(sig => (
                        <SignalCard key={sig.key} sig={sig} data={data} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── RIGHT — XAI log ── */}
              <div style={{ position: "sticky", top: 64, maxHeight: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>

                {/* XAI header */}
                <div style={{
                  background: "#0a0f1e", border: "1px solid #1a2540", borderBottom: "none",
                  padding: "10px 16px",
                  flexShrink: 0,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#4b6cb7", marginBottom: 2 }}>
                        XAI EXPLANATION LOG
                      </div>
                      <div style={{ fontSize: 9, color: "#334155" }}>last {xaiHistory.length} / 20 epochs · click to expand</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", color: "#f87171", background: "#1c0a0a", border: "1px solid #ef444420" }}>
                        {xaiHistory.filter(x => x.prediction === 1).length} pain
                      </span>
                      <span style={{ fontSize: 10, padding: "2px 8px", color: "#4ade80", background: "#05130d", border: "1px solid #16a34a20" }}>
                        {xaiHistory.filter(x => x.prediction === 0).length} clear
                      </span>
                    </div>
                  </div>

                  {/* Pause / resume controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => xaiPaused ? flushPending() : syncPause(true)}
                      style={{
                        fontSize: 9, letterSpacing: "0.1em", fontFamily: "inherit",
                        color: xaiPaused ? "#fbbf24" : "#64748b",
                        background: xaiPaused ? "#1a1000" : "#0d1525",
                        border: `1px solid ${xaiPaused ? "#f59e0b40" : "#1a2540"}`,
                        padding: "3px 10px", cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {xaiPaused ? "▶ RESUME" : "⏸ PAUSE"}
                    </button>
                    {xaiPaused && pendingEntries.length > 0 && (
                      <span style={{
                        fontSize: 9, color: "#fbbf24", animation: "shimmer 1.5s infinite",
                        letterSpacing: "0.06em",
                      }}>
                        +{pendingEntries.length} queued
                      </span>
                    )}
                    {!xaiPaused && (
                      <span style={{ fontSize: 9, color: "#1e2d4a", letterSpacing: "0.06em" }}>
                        hover to read
                      </span>
                    )}
                  </div>
                </div>

                {/* Scrollable XAI list — pause on hover */}
                <div
                  ref={xaiScrollRef}
                  onMouseEnter={() => { if (streaming) syncPause(true); }}
                  onMouseLeave={() => {
                    // Only auto-resume if they didn't click pause manually
                    // (we just resume on mouse leave — if they want to keep paused they can click the button)
                    if (streaming) {
                      flushPending();
                    }
                  }}
                  style={{
                    flex: 1, overflowY: "auto", background: "#080c14",
                    border: "1px solid #1a2540", padding: 8,
                    // Subtle border glow while paused so user knows it's locked
                    outline: xaiPaused ? "1px solid #f59e0b20" : "none",
                    transition: "outline 0.3s",
                  }}
                >
                  {xaiHistory.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 16px", fontSize: 11, color: "#1e2d4a", letterSpacing: "0.08em" }}>
                      XAI entries will appear<br />as epochs stream in
                    </div>
                  ) : (
                    xaiHistory.map((entry, i) => (
                      <div
                        key={`${entry.epoch}-${entry.time}`}
                        style={{
                          animation: `${entry.epoch}-${entry.time}` === newestKey && i === 0
                            ? "flashIn 0.3s ease-out"
                            : "none",
                        }}
                      >
                        <XAICard
                          entry={entry}
                          index={i}
                          isNew={`${entry.epoch}-${entry.time}` === newestKey && i === 0}
                        />
                      </div>
                    ))
                  )}
                </div>

                <div style={{
                  background: "#0a0f1e", border: "1px solid #1a2540", borderTop: "none",
                  padding: "8px 14px", display: "flex", gap: 16, flexShrink: 0,
                }}>
                  <span style={{ fontSize: 9, color: "#f87171" }}>■ increases pain probability</span>
                  <span style={{ fontSize: 9, color: "#4ade80" }}>■ decreases pain probability</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {(streaming || status === "done") && (
            <div style={{ fontSize: 10, color: "#1e2d4a", textAlign: "center", marginTop: 8, letterSpacing: "0.08em" }}>
              RESEARCH PROTOTYPE · SYNTHETIC MODEL · NOT FOR CLINICAL USE · LAST 30 EPOCHS DISPLAYED
            </div>
          )}
        </div>
      </div>
    </>
  );
}
