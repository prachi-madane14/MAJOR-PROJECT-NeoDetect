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

// ─── XAI Card — wider, bigger text, clear feature labels ─────────────────────

function XAICard({ entry, index, isNew }: { entry: XAIEntry; index: number; isNew: boolean }) {
  const [expanded, setExpanded] = useState(index === 0);
  const isPain = entry.prediction === 1;
  const conf   = safeFixed(entry.confidence * 100, 1, "0.0");
  const confNum = parseFloat(conf);

  const entries: [string, number][] = entry.shap_values
    ? Object.entries(entry.shap_values)
        .map(([k, v]) => [k, Number(v)] as [string, number])
        .filter(([, v]) => isFinite(v))
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    : [];

  const max = entries.length > 0
    ? Math.max(...entries.map(([, v]) => Math.abs(v)), 0.001)
    : 0.001;

  const accentColor = isPain ? "#f87171" : "#4ade80";
  const dimAccent   = isPain ? "#ef444430" : "#16a34a30";
  const bgCard      = isPain ? "#0f0a0a" : "#080f0a";

  return (
    <div style={{
      background: bgCard,
      border: `1px solid ${isNew ? accentColor : dimAccent}`,
      transition: "border-color 0.6s",
      flexShrink: 0,
      width: 340,
      outline: isNew ? `1px solid ${isPain ? "#ef444440" : "#22c55e40"}` : "none",
      outlineOffset: "2px",
    }}>

      {/* ── Card header ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer", userSelect: "none",
          borderBottom: `1px solid ${dimAccent}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isNew && (
            <span style={{
              fontSize: 9, letterSpacing: "0.1em", fontWeight: 700,
              color: "#fbbf24", background: "#1a1000",
              padding: "2px 6px", border: "1px solid #f59e0b50",
              animation: "shimmer 1s ease-out",
            }}>NEW</span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            color: accentColor,
            background: isPain ? "#1c0a0a" : "#05130d",
            padding: "3px 10px",
            border: `1px solid ${dimAccent}`,
          }}>
            {isPain ? "⚠ PAIN" : "✓ CLEAR"}
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Epoch {entry.epoch}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 18, fontWeight: 700,
            color: confNum > 70 ? "#f87171" : confNum > 45 ? "#fbbf24" : "#4ade80",
          }}>
            {conf}%
          </span>
          <span style={{ fontSize: 11, color: "#334155" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* ── Reason text (always visible) ── */}
      {entry.shap_reason && (
        <div style={{ padding: "10px 16px 0", borderBottom: `1px solid ${dimAccent}` }}>
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, fontStyle: "italic", lineHeight: 1.6 }}>
            {entry.shap_reason}
          </p>
        </div>
      )}

      {/* ── SHAP bars — always visible ── */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#475569", marginBottom: 10 }}>
          FEATURE CONTRIBUTIONS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {entries.map(([feat, val]) => {
            const pct = (Math.abs(val) / max) * 100;
            const pos = val > 0;
            // Pretty-print feature name
            const label = feat
              .replace(/_/g, " ")
              .replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={feat}>
                {/* Feature name + value on same row */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 500 }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: pos ? "#f87171" : "#4ade80",
                  }}>
                    {pos ? "+" : ""}{safeFixed(val)}
                  </span>
                </div>
                {/* Wide bar */}
                <div style={{ height: 6, background: "#1a2540", borderRadius: 3 }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 3,
                    background: pos ? "#ef4444" : "#22c55e",
                    transition: "width 0.35s ease",
                    boxShadow: pos ? "0 0 6px #ef444460" : "0 0 6px #22c55e60",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Top drivers (expandable) ── */}
      {expanded && entry.shap_top3 && entry.shap_top3.length > 0 && (
        <div style={{
          padding: "10px 16px 14px",
          borderTop: `1px solid ${dimAccent}`,
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#475569", marginBottom: 8 }}>
            TOP DRIVERS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entry.shap_top3.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: t.direction === "up" ? "#f87171" : "#4ade80",
                  width: 16,
                }}>
                  {t.direction === "up" ? "↑" : "↓"}
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>
                  {t.feature.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: t.direction === "up" ? "#f87171" : "#4ade80",
                }}>
                  {Number(t.value) > 0 ? "+" : ""}{safeFixed(t.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && entry.shap_detail && (
        <div style={{
          padding: "0 16px 12px",
          borderTop: `1px solid ${dimAccent}`,
        }}>
          <p style={{ fontSize: 11, color: "#475569", marginTop: 10, lineHeight: 1.6 }}>
            {entry.shap_detail}
          </p>
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
  const [epochCount,      setEpochCount]      = useState(0);
  const [errorMsg,        setErrorMsg]        = useState("");
  const [fileName,        setFileName]        = useState("");
  const [xaiPaused,       setXaiPaused]       = useState(false);
  const [newestKey,       setNewestKey]       = useState<string>("");
  const [pendingEntries,  setPendingEntries]  = useState<XAIEntry[]>([]);

  const esRef        = useRef<EventSource | null>(null);
  const xaiScrollRef = useRef<HTMLDivElement>(null);
  const xaiPausedRef = useRef(false);

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
            setPendingEntries(prev => [entry, ...prev].slice(0, 40));
          } else {
            setXaiHistory(prev => {
              const next = [entry, ...prev].slice(0, 20);
              setNewestKey(`${entry.epoch}-${entry.time}`);
              return next;
            });
            setTimeout(() => {
              if (xaiScrollRef.current) xaiScrollRef.current.scrollLeft = 0;
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
    setPendingEntries([]);
    setEpochCount(0);
    setErrorMsg("");
    setFileName("");
    setNewestKey("");
    syncPause(false);
    setStatus("idle");
  }, []);

  const latest     = data[data.length - 1];
  const recentPain = data.slice(-5).filter(d => d.prediction === 1).length;
  const alert      = recentPain >= 3;
  const conf       = isFinite(Number(latest?.confidence)) ? Number(latest?.confidence) * 100 : 0;
  const streaming  = status === "streaming";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        @keyframes pulse   { 0%,100%{opacity:1}    50%{opacity:.3}  }
        @keyframes blink   { 0%,49%{opacity:1}     50%,100%{opacity:0} }
        @keyframes shimmer { 0%{opacity:.4}         50%{opacity:1}   100%{opacity:.4} }
        @keyframes flashIn { 0%{opacity:0;transform:translateX(-10px)} 100%{opacity:1;transform:translateX(0)} }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 4px; height: 6px; }
        ::-webkit-scrollbar-track { background: #080c14; }
        ::-webkit-scrollbar-thumb { background: #1e2d4a; border-radius: 3px; }
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
                  Rows stream one-by-one · SHAP explanation · XAI history log
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

          {/* ── Live simulation — single column ── */}
          {(streaming || status === "done") && data.length > 0 && (
            <div>

              {/* ══ Status row ══ */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
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
                  <div style={{ fontSize: 24, fontWeight: 700, color: conf > 70 ? "#f87171" : conf > 45 ? "#fbbf24" : "#4ade80" }}>
                    {safeFixed(conf, 1)}%
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
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
              </div>

              {/* ══ Signal grids ══ */}
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

              {/* ══ XAI Explanation Log — full width horizontal scroll ══ */}
              <div style={{ marginTop: 8 }}>

                {/* Header */}
                <div style={{
                  background: "#0a0f1e",
                  border: "1px solid #1a2540",
                  borderBottom: "none",
                  padding: "12px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "#4b6cb7", marginBottom: 3 }}>
                      XAI EXPLANATION LOG
                    </div>
                    <div style={{ fontSize: 10, color: "#334155" }}>
                      {xaiHistory.length} / 20 epochs shown · newest on left · hover to pause
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() => xaiPaused ? flushPending() : syncPause(true)}
                      style={{
                        fontSize: 10, letterSpacing: "0.1em", fontFamily: "inherit",
                        color: xaiPaused ? "#fbbf24" : "#64748b",
                        background: xaiPaused ? "#1a1000" : "#0d1525",
                        border: `1px solid ${xaiPaused ? "#f59e0b40" : "#1a2540"}`,
                        padding: "4px 12px", cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {xaiPaused ? "▶ RESUME" : "⏸ PAUSE"}
                    </button>
                    {xaiPaused && pendingEntries.length > 0 && (
                      <span style={{ fontSize: 10, color: "#fbbf24", animation: "shimmer 1.5s infinite" }}>
                        +{pendingEntries.length} queued
                      </span>
                    )}
                    <span style={{ fontSize: 11, padding: "3px 10px", color: "#f87171", background: "#1c0a0a", border: "1px solid #ef444420" }}>
                      {xaiHistory.filter(x => x.prediction === 1).length} pain
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 10px", color: "#4ade80", background: "#05130d", border: "1px solid #16a34a20" }}>
                      {xaiHistory.filter(x => x.prediction === 0).length} clear
                    </span>
                  </div>
                </div>

                {/* Scrollable cards */}
                <div
                  ref={xaiScrollRef}
                  onMouseEnter={() => { if (streaming) syncPause(true); }}
                  onMouseLeave={() => { if (streaming) flushPending(); }}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 12,
                    overflowX: "auto",
                    padding: "14px 18px 16px",
                    background: "#080c14",
                    border: "1px solid #1a2540",
                    minHeight: 100,
                    outline: xaiPaused ? "1px solid #f59e0b20" : "none",
                    transition: "outline 0.3s",
                  }}
                >
                  {xaiHistory.length === 0 ? (
                    <div style={{
                      display: "flex", alignItems: "center",
                      fontSize: 12, color: "#1e2d4a", letterSpacing: "0.08em",
                      padding: "20px 0", whiteSpace: "nowrap",
                    }}>
                      XAI entries will appear as epochs stream in…
                    </div>
                  ) : (
                    xaiHistory.map((entry, i) => (
                      <div
                        key={`${entry.epoch}-${entry.time}`}
                        style={{
                          animation: `${entry.epoch}-${entry.time}` === newestKey && i === 0
                            ? "flashIn 0.35s ease-out" : "none",
                        }}
                      >
                        <XAICard entry={entry} index={i} isNew={`${entry.epoch}-${entry.time}` === newestKey && i === 0} />
                      </div>
                    ))
                  )}
                </div>

                {/* Legend */}
                <div style={{
                  background: "#0a0f1e", border: "1px solid #1a2540", borderTop: "none",
                  padding: "8px 18px", display: "flex", gap: 24,
                }}>
                  <span style={{ fontSize: 10, color: "#f87171" }}>■ Red bar = increases pain probability</span>
                  <span style={{ fontSize: 10, color: "#4ade80" }}>■ Green bar = decreases pain probability</span>
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
