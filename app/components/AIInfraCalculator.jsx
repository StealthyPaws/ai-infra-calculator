"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart
} from "recharts";

// ─── GPU SPECS ────────────────────────────────────────────────────────────────
const GPU_SPECS = {
  T4:    { name: "Tesla T4",    vram: 16,  price: 800,   priceHigh: 2500,  ips: 750,   tdp: 70,  gpusPerServer: 4 },
  A5000: { name: "RTX A5000",  vram: 24,  price: 3300,  priceHigh: 4000,  ips: 1500,  tdp: 250, gpusPerServer: 2 },
  L4:    { name: "NVIDIA L4",  vram: 24,  price: 2000,  priceHigh: 3000,  ips: 1800,  tdp: 72,  gpusPerServer: 3 },
  H20:   { name: "NVIDIA H20", vram: 96,  price: 10000, priceHigh: 12000, ips: 4000,  tdp: 400, gpusPerServer: 2 },
  L20:   { name: "NVIDIA L20", vram: 48,  price: 6000,  priceHigh: 13200, ips: 3000,  tdp: 350, gpusPerServer: 2 },
  A100:  { name: "A100 80GB",  vram: 80,  price: 12000, priceHigh: 16000, ips: 5000,  tdp: 400, gpusPerServer: 2 },
  "4090":{ name: "RTX 4090",   vram: 24,  price: 1600,  priceHigh: 2200,  ips: 2200,  tdp: 450, gpusPerServer: 2 },
};

// ─── TASK TYPES ───────────────────────────────────────────────────────────────
const TASK_PRESETS = [
  { id: "object_detection",    label: "Object Detection",         icon: "🔍", ipsPerStream: 5,   vramPerModel: 1.2, desc: "YOLOv8/v9, real-time detection pipelines" },
  { id: "classification",      label: "Image Classification",     icon: "🏷️", ipsPerStream: 8,   vramPerModel: 0.8, desc: "ResNet, EfficientNet, ViT classifiers" },
  { id: "segmentation",        label: "Segmentation",             icon: "🖼️", ipsPerStream: 3,   vramPerModel: 2.4, desc: "Semantic/instance segmentation, SAM" },
  { id: "pose_estimation",     label: "Pose Estimation",          icon: "🧍", ipsPerStream: 4,   vramPerModel: 1.8, desc: "Human/animal pose keypoint detection" },
  { id: "ocr",                 label: "OCR / Document AI",        icon: "📄", ipsPerStream: 6,   vramPerModel: 1.0, desc: "Text extraction, document understanding" },
  { id: "face_recognition",    label: "Face Recognition",         icon: "👤", ipsPerStream: 4,   vramPerModel: 2.0, desc: "Detection + embedding + matching pipeline" },
  { id: "anomaly_detection",   label: "Anomaly Detection",        icon: "⚠️", ipsPerStream: 5,   vramPerModel: 1.5, desc: "Industrial inspection, fraud, defects" },
  { id: "llm_inference",       label: "LLM Inference",            icon: "🤖", ipsPerStream: 0.5, vramPerModel: 20,  desc: "7B–70B parameter LLMs (quantized)" },
  { id: "embedding",           label: "Embedding / RAG",          icon: "🔢", ipsPerStream: 50,  vramPerModel: 1.0, desc: "Text/image embedding, vector search" },
  { id: "speech",              label: "Speech / Audio AI",        icon: "🎙️", ipsPerStream: 10,  vramPerModel: 1.2, desc: "ASR, TTS, audio classification" },
  { id: "recommendation",      label: "Recommendation Engine",    icon: "⭐", ipsPerStream: 30,  vramPerModel: 0.6, desc: "Collaborative/content-based filtering" },
  { id: "custom",              label: "Custom Model",             icon: "⚙️", ipsPerStream: 5,   vramPerModel: 1.5, desc: "Your own trained model" },
];

const RES_PRESETS = [
  { label: "224×224",  scale: 0.12 },
  { label: "320×320",  scale: 0.25 },
  { label: "480×480",  scale: 0.56 },
  { label: "640×640",  scale: 1.00 },
  { label: "960×960",  scale: 2.25 },
  { label: "1280×1280",scale: 4.00 },
];

const OVERHEAD_MEM = 2.5; // framework + runtime overhead GB
const BYTES_PER_BIT = 0.125;
const SECONDS_PER_DAY = 86400;

const fmtNum = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const MetricCard = ({ label, value, unit, sub, accent, warn }) => (
  <div className={`metric-card${accent ? " metric-accent" : ""}${warn ? " metric-warn" : ""}`}>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}<span className="metric-unit"> {unit}</span></div>
    {sub && <div className="metric-sub">{sub}</div>}
  </div>
);

const RangeCard = ({ label, low, high, sub }) => (
  <div className="metric-card metric-range">
    <div className="metric-label">{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#94a3b8" }}>{low}</span>
      <span style={{ color: "var(--muted)", fontSize: 11 }}>–</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{high}</span>
    </div>
    {sub && <div className="metric-sub">{sub}</div>}
  </div>
);

const SliderInput = ({ label, value, min, max, step = 1, onChange, format = v => v, unit = "" }) => (
  <div className="slider-wrap">
    <div className="slider-header">
      <span className="slider-label">{label}</span>
      <span className="slider-val">{format(value)}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))} className="slider" />
    <div className="slider-minmax"><span>{format(min)}{unit}</span><span>{format(max)}{unit}</span></div>
  </div>
);

const FormulaBox = ({ label, formula, result }) => (
  <div className="formula-box">
    <div className="formula-label">{label}</div>
    <div className="formula-expr">{formula}</div>
    <div className="formula-result">= {result}</div>
  </div>
);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AIInfraCalculator() {
  const [activeTab, setActiveTab]         = useState("summary");
  const [gpuType, setGpuType]             = useState("L4");
  const [streams, setStreams]             = useState(50);
  const [bitratePerStream, setBitrate]    = useState(4);
  const [retentionDays, setRetentionDays] = useState(30);
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [isCloud, setIsCloud]             = useState(false);
  const [showFormulas, setShowFormulas]   = useState(false);
  const [cpuCores, setCpuCores]           = useState(32);
  const [redundancy, setRedundancy]       = useState(1.2);

  // Pricing
  const [gpuPriceLow,     setGpuPriceLow]     = useState(GPU_SPECS["L4"].price);
  const [gpuPriceHigh,    setGpuPriceHigh]    = useState(GPU_SPECS["L4"].priceHigh);
  const [serverPriceLow,  setServerPriceLow]  = useState(3000);
  const [serverPriceHigh, setServerPriceHigh] = useState(6000);
  const [storagePriceTB,  setStoragePriceTB]  = useState(30);
  const [cloudPerHr,      setCloudPerHr]      = useState(0.50);
  const [cloudPerHrHigh,  setCloudPerHrHigh]  = useState(1.20);

  // Task config
  const [selectedTasks, setSelectedTasks] = useState({ object_detection: true });
  const [taskStreams,    setTaskStreams]   = useState(
    TASK_PRESETS.reduce((a, t) => ({ ...a, [t.id]: 50 }), {})
  );
  const [taskResIdx, setTaskResIdx]       = useState(
    TASK_PRESETS.reduce((a, t) => ({ ...a, [t.id]: 3 }), {})
  );
  const [taskFps, setTaskFps]             = useState(
    TASK_PRESETS.reduce((a, t) => ({ ...a, [t.id]: t.ipsPerStream }), {})
  );

  const gpu = GPU_SPECS[gpuType];

  const calc = useMemo(() => {
    const activeTasks = TASK_PRESETS.filter(t => selectedTasks[t.id]);
    if (activeTasks.length === 0) {
      return { activeTasks: [], gpusNeeded: 0, totalMemNeeded: OVERHEAD_MEM, camerasPerGpu: 0,
        totalIpsDemand: 0, totalFpsLoad: 0, totalCapexLow: 0, totalCapexHigh: 0,
        bufferedGbps: 0, tbPerDay: 0, pbTotal: 0, cloudAnnualLow: 0, cloudAnnualHigh: 0,
        gpuCostLow: 0, gpuCostHigh: 0, serverCostLow: 0, serverCostHigh: 0,
        storageCostLow: 0, storageCostHigh: 0, serversNeeded: 0, memFitsInGpu: true,
        memRemaining: gpu.vram - OVERHEAD_MEM, cloudMonthlyLow: 0, cloudMonthlyHigh: 0,
        cpuCoresNeeded: 0, vramBreakdown: [] };
    }

    // Per-task IPS demand
    const taskIpsDemand = {};
    activeTasks.forEach(t => {
      const res = RES_PRESETS[taskResIdx[t.id]];
      taskIpsDemand[t.id] = (taskFps[t.id] || t.ipsPerStream) * res.scale;
    });

    const totalIpsDemandPerStream = activeTasks.reduce((s, t) => s + taskIpsDemand[t.id], 0);

    const streamsPerGpu = totalIpsDemandPerStream > 0
      ? Math.max(1, Math.floor(gpu.ips / totalIpsDemandPerStream))
      : 999;

    // Total streams = max across tasks (shared GPU handles all tasks on same stream)
    const effectiveStreams = activeTasks.length > 0
      ? Math.max(...activeTasks.map(t => taskStreams[t.id] || streams))
      : streams;

    const gpusNeeded = Math.ceil(effectiveStreams / streamsPerGpu);
    const serversNeeded = Math.ceil(gpusNeeded / gpu.gpusPerServer);

    // VRAM
    const modelMem = activeTasks.reduce((s, t) => s + t.vramPerModel * (RES_PRESETS[taskResIdx[t.id]].scale / 1), 0);
    const totalMemNeeded = modelMem + OVERHEAD_MEM;
    const memFitsInGpu = totalMemNeeded <= gpu.vram;
    const memRemaining = gpu.vram - totalMemNeeded;

    // CPU cores: decode + overhead
    const totalBandwidthMbps = effectiveStreams * bitratePerStream;
    const coresForDecode = Math.ceil(totalBandwidthMbps / 600);
    const totalFpsLoad = activeTasks.reduce((s, t) => s + (taskStreams[t.id] || streams) * (taskFps[t.id] || t.ipsPerStream), 0);
    const coresForPreproc = Math.ceil(totalFpsLoad * 0.00008);
    const cpuCoresNeeded = Math.ceil((coresForDecode + coresForPreproc + 5) * 1.5);

    // Network
    const totalBandwidthGbps = totalBandwidthMbps / 1000;
    const bufferedGbps = totalBandwidthGbps * 1.2;

    // Storage
    const mbPerSec = bitratePerStream * BYTES_PER_BIT;
    const gbPerDay = (mbPerSec * SECONDS_PER_DAY) / 1024;
    const tbPerDay = (gbPerDay * effectiveStreams) / 1024;
    const tbTotal  = storageEnabled ? tbPerDay * retentionDays * redundancy : 1;
    const pbTotal  = tbTotal / 1024;

    // Costs
    const gpuCostLow   = gpusNeeded * gpuPriceLow;
    const gpuCostHigh  = gpusNeeded * gpuPriceHigh;
    const serverCostLow  = serversNeeded * serverPriceLow;
    const serverCostHigh = serversNeeded * serverPriceHigh;
    const storageCostLow  = pbTotal * storagePriceTB * 1024;
    const storageCostHigh = storageCostLow * 1.3;

    const cloudMonthlyLow  = gpusNeeded * cloudPerHr   * 720;
    const cloudMonthlyHigh = gpusNeeded * cloudPerHrHigh * 720;
    const cloudAnnualLow   = cloudMonthlyLow  * 12;
    const cloudAnnualHigh  = cloudMonthlyHigh * 12;

    const totalCapexLow  = gpuCostLow  + serverCostLow  + storageCostLow;
    const totalCapexHigh = gpuCostHigh + serverCostHigh + storageCostHigh;

    const vramBreakdown = [
      ...activeTasks.map(t => ({
        name: t.label, gb: parseFloat((t.vramPerModel * RES_PRESETS[taskResIdx[t.id]].scale).toFixed(2)),
        fill: `hsl(${TASK_PRESETS.indexOf(t) * 29 + 170}, 70%, 55%)`
      })),
      { name: "Framework OH", gb: OVERHEAD_MEM, fill: "#475569" }
    ];

    return {
      activeTasks, gpusNeeded, serversNeeded, streamsPerGpu, effectiveStreams,
      totalIpsDemandPerStream, totalMemNeeded, memFitsInGpu, memRemaining,
      totalBandwidthMbps, bufferedGbps, tbPerDay, pbTotal,
      gpuCostLow, gpuCostHigh, serverCostLow, serverCostHigh,
      storageCostLow, storageCostHigh, totalCapexLow, totalCapexHigh,
      cloudMonthlyLow, cloudMonthlyHigh, cloudAnnualLow, cloudAnnualHigh,
      cpuCoresNeeded, vramBreakdown, taskIpsDemand, totalFpsLoad,
    };
  }, [gpuType, streams, bitratePerStream, retentionDays, storageEnabled, redundancy,
    gpuPriceLow, gpuPriceHigh, serverPriceLow, serverPriceHigh, storagePriceTB,
    cloudPerHr, cloudPerHrHigh, selectedTasks, taskStreams, taskResIdx, taskFps, gpu]);

  const costPie = [
    { name: "GPU Hardware",  value: calc.gpuCostLow,    color: "#00d4aa" },
    { name: "Servers",       value: calc.serverCostLow, color: "#3b82f6" },
    { name: "Storage",       value: calc.storageCostLow,color: "#f59e0b" },
  ];

  const CT = ({ active, payload }) => active && payload?.length ? (
    <div className="custom-tooltip">
      <div className="ct-label">{payload[0].payload.name ?? payload[0].name}</div>
      <div className="ct-value">{typeof payload[0].value === "number" && payload[0].value > 500 ? fmtNum(payload[0].value) : payload[0].value}</div>
    </div>
  ) : null;

  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Syne:wght@400;500;700;800&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      :root{
        --bg:#060a10;--panel:#0b1118;--panel2:#0f1825;
        --border:#1a2535;--border2:#1f2f42;
        --text:#dde4ee;--muted:#56697e;
        --accent:#00e5b8;--accent2:#4a90d9;
        --warn:#f5a623;--danger:#e85555;
        --mono:'IBM Plex Mono',monospace;
        --sans:'Syne',sans-serif;
      }
      body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:13px;}
      .app{min-height:100vh;display:grid;grid-template-rows:auto 1fr;background:var(--bg);}

      /* ── HEADER ── */
      .header{
        padding:0 28px;height:58px;
        border-bottom:1px solid var(--border);
        background:linear-gradient(90deg,#0b1118,#0d1520);
        display:flex;align-items:center;justify-content:space-between;gap:12px;
      }
      .header-left{display:flex;align-items:center;gap:14px;}
      .logo-mark{
        width:34px;height:34px;border-radius:8px;
        background:linear-gradient(135deg,#00e5b8,#4a90d9);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;flex-shrink:0;
      }
      .header-title{font-size:15px;font-weight:800;color:#f1f5f9;letter-spacing:-0.3px;}
      .header-sub{font-size:9px;color:var(--muted);letter-spacing:.5px;margin-top:1px;text-transform:uppercase;}
      .header-right{display:flex;align-items:center;gap:8px;}
      .hbtn{
        padding:5px 13px;border-radius:6px;font-size:10px;font-family:var(--mono);
        cursor:pointer;transition:all .18s;font-weight:600;letter-spacing:.3px;
        border:1px solid var(--border2);background:transparent;color:var(--muted);
      }
      .hbtn:hover{border-color:var(--accent2);color:var(--accent2);}
      .hbtn.active{background:var(--accent2);color:#fff;border-color:var(--accent2);}
      .toggle-pill{display:flex;background:var(--panel2);border:1px solid var(--border);border-radius:20px;overflow:hidden;padding:2px;}
      .tpbtn{padding:4px 13px;font-size:10px;font-family:var(--mono);cursor:pointer;border:none;
        background:none;color:var(--muted);transition:all .2s;border-radius:16px;font-weight:600;}
      .tpbtn.active{background:linear-gradient(135deg,#00e5b8,#4a90d9);color:#fff;}

      /* ── LAYOUT ── */
      .body{display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 58px);overflow:hidden;}
      .left-panel{
        border-right:1px solid var(--border);overflow-y:auto;
        background:var(--panel);
        scrollbar-width:thin;scrollbar-color:#1f2f42 transparent;
      }
      .left-panel::-webkit-scrollbar{width:3px;}
      .left-panel::-webkit-scrollbar-thumb{background:var(--border2);}
      .input-section{border-bottom:1px solid var(--border);padding:14px 16px;}
      .sec-title{
        font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;
        color:var(--accent);margin-bottom:2px;
      }
      .sec-sub{font-size:9px;color:var(--muted);margin-bottom:11px;}

      /* ── SLIDERS ── */
      .slider-wrap{margin-bottom:10px;}
      .slider-header{display:flex;justify-content:space-between;margin-bottom:4px;}
      .slider-label{font-size:11px;color:#8fa4bb;}
      .slider-val{font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:600;}
      .slider{width:100%;height:3px;-webkit-appearance:none;appearance:none;
        background:var(--border2);border-radius:2px;outline:none;cursor:pointer;}
      .slider::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;
        border-radius:50%;background:var(--accent);cursor:pointer;
        border:2px solid var(--bg);box-shadow:0 0 8px #00e5b866;}
      .slider-minmax{display:flex;justify-content:space-between;font-size:8px;color:var(--muted);margin-top:1px;}

      /* ── GPU GRID ── */
      .gpu-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:4px;}
      .gpu-btn{
        border:1px solid var(--border2);background:var(--panel2);color:var(--muted);
        padding:7px 4px;border-radius:7px;cursor:pointer;text-align:center;
        font-family:var(--mono);font-size:8px;transition:all .18s;line-height:1.4;
      }
      .gpu-btn:hover{border-color:var(--accent2);}
      .gpu-btn.sel{border-color:var(--accent);background:#00e5b812;color:var(--accent);font-weight:700;}
      .gpu-vram{font-size:7px;color:var(--muted);margin-top:1px;}
      .gpu-btn.sel .gpu-vram{color:#00e5b880;}

      /* ── TASK SELECTOR ── */
      .task-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px;}
      .task-btn{
        border:1px solid var(--border);background:transparent;
        color:var(--muted);padding:8px 8px;border-radius:7px;cursor:pointer;
        text-align:left;font-size:10px;transition:all .18s;font-family:var(--sans);
      }
      .task-btn:hover{border-color:var(--accent2);color:var(--text);}
      .task-btn.sel{border-color:var(--accent);background:#00e5b808;color:var(--text);}
      .task-icon{font-size:14px;display:block;margin-bottom:3px;}
      .task-lbl{font-weight:700;font-size:10px;display:block;margin-bottom:1px;}
      .task-desc{font-size:8px;color:var(--muted);line-height:1.3;}

      /* ── PRICE ROW ── */
      .price-row{display:grid;grid-template-columns:1fr 14px 1fr;gap:4px;align-items:center;margin-bottom:8px;}
      .num-input{
        width:100%;background:var(--panel2);border:1px solid var(--border2);
        color:var(--text);padding:5px 7px;border-radius:5px;
        font-family:var(--mono);font-size:11px;outline:none;transition:border .15s;
      }
      .num-input:focus{border-color:var(--accent);}
      .price-lbl{font-size:10px;color:#8fa4bb;margin-bottom:4px;}

      /* ── RIGHT PANEL ── */
      .right-panel{overflow-y:auto;background:var(--bg);scrollbar-width:thin;scrollbar-color:#1f2f42 transparent;}
      .right-panel::-webkit-scrollbar{width:3px;}
      .right-panel::-webkit-scrollbar-thumb{background:var(--border2);}

      .tabs{
        display:flex;border-bottom:1px solid var(--border);
        background:var(--panel);padding:0 20px;
        position:sticky;top:0;z-index:10;overflow-x:auto;
        scrollbar-width:none;
      }
      .tabs::-webkit-scrollbar{display:none;}
      .tab{
        padding:14px 14px;font-size:11px;font-weight:700;cursor:pointer;
        color:var(--muted);border:none;background:none;
        border-bottom:2px solid transparent;transition:all .18s;white-space:nowrap;
        font-family:var(--sans);letter-spacing:.2px;
      }
      .tab:hover{color:var(--text);}
      .tab.active{color:var(--accent);border-bottom-color:var(--accent);}

      .content{padding:22px;}

      /* ── METRIC CARDS ── */
      .metric-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:9px;margin-bottom:18px;}
      .metric-card{
        background:var(--panel);border:1px solid var(--border);
        border-radius:10px;padding:13px;transition:border .18s;
      }
      .metric-card:hover{border-color:var(--border2);}
      .metric-card.metric-accent{border-color:#00e5b830;background:#00e5b80a;}
      .metric-card.metric-warn{border-color:#f5a62330;background:#f5a6230a;}
      .metric-card.metric-range{border-color:#4a90d930;background:#4a90d90a;}
      .metric-label{font-size:8px;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.8px;}
      .metric-value{font-family:var(--mono);font-size:22px;font-weight:700;color:#f1f5f9;line-height:1;}
      .metric-unit{font-size:10px;font-weight:400;color:var(--muted);}
      .metric-sub{font-size:8px;color:var(--muted);margin-top:5px;line-height:1.4;}

      /* ── FORMULA BOX ── */
      .formula-section{margin-bottom:18px;}
      .formula-section-title{
        font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;
        color:var(--accent2);margin-bottom:9px;padding-bottom:6px;
        border-bottom:1px solid var(--border);
      }
      .formula-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;}
      .formula-box{
        background:var(--panel);border:1px solid var(--border);
        border-left:3px solid var(--accent2);border-radius:0 7px 7px 0;padding:10px 12px;
      }
      .formula-label{font-size:9px;color:var(--muted);margin-bottom:3px;}
      .formula-expr{font-family:var(--mono);font-size:9px;color:#8fa4bb;margin-bottom:5px;word-break:break-all;line-height:1.4;}
      .formula-result{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent);}

      /* ── CHART GRID ── */
      .chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;}
      .chart-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;}
      .chart-title{font-size:9px;font-weight:700;color:#8fa4bb;margin-bottom:12px;text-transform:uppercase;letter-spacing:.8px;}
      .chart-full{grid-column:1/-1;}
      .custom-tooltip{background:var(--panel2);border:1px solid var(--border2);border-radius:7px;padding:7px 11px;font-size:10px;}
      .ct-label{color:var(--muted);margin-bottom:2px;font-size:9px;text-transform:uppercase;}
      .ct-value{font-family:var(--mono);color:var(--accent);font-weight:700;font-size:12px;}

      /* ── ALERTS ── */
      .alert{display:flex;gap:8px;padding:9px 13px;border-radius:7px;margin-bottom:14px;font-size:10px;line-height:1.6;}
      .alert-warn{background:#f5a62312;border:1px solid #f5a62344;color:#fbbf24;}
      .alert-ok{background:#00e5b812;border:1px solid #00e5b844;color:var(--accent);}
      .alert-info{background:#4a90d912;border:1px solid #4a90d944;color:#7eb8f5;}
      .alert-icon{font-size:13px;flex-shrink:0;}

      /* ── VRAM BAR ── */
      .vram-bar-track{height:18px;background:var(--panel2);border-radius:4px;overflow:hidden;display:flex;margin-bottom:8px;}
      .vram-legend{display:flex;flex-wrap:wrap;gap:6px;}
      .vram-legend-item{display:flex;align-items:center;gap:4px;font-size:9px;color:var(--muted);}
      .vram-legend-dot{width:6px;height:6px;border-radius:2px;}

      /* ── COST ── */
      .cost-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);}
      .cost-row:last-child{border-bottom:none;}
      .cost-total{background:var(--panel2);border-radius:9px;padding:14px 18px;margin-top:12px;border:1px solid var(--border2);}
      .cost-total-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;}
      .cost-total-val{font-family:var(--mono);font-size:26px;font-weight:700;color:var(--accent);margin-top:3px;}

      /* ── TOGGLE ── */
      .tog{position:relative;width:36px;height:20px;cursor:pointer;flex-shrink:0;}
      .tog-track{position:absolute;inset:0;background:var(--border2);border-radius:20px;transition:background .2s;}
      .tog-track.on{background:var(--accent);}
      .tog-thumb{position:absolute;top:3px;left:3px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .2s;}
      .tog-thumb.on{transform:translateX(16px);}

      /* ── TABLE ── */
      .data-table{width:100%;border-collapse:collapse;font-size:10px;}
      .data-table th{font-family:var(--mono);font-size:8px;color:var(--muted);padding:6px 8px;
        text-align:left;background:var(--panel2);text-transform:uppercase;letter-spacing:.5px;}
      .data-table td{padding:8px 8px;border-bottom:1px solid var(--border);}
      .data-table tr:hover td{background:#ffffff03;}

      .divider{height:1px;background:var(--border);margin:16px 0;}
      .hint{padding:7px 10px;background:#4a90d910;border:1px solid #4a90d922;border-radius:5px;font-size:9px;color:#64748b;margin-top:8px;line-height:1.5;}

      .task-config-row{display:grid;grid-template-columns:110px 1fr 80px 60px;gap:6px;align-items:center;
        padding:7px 0;border-bottom:1px solid #1a253511;font-size:10px;}
      .mini-input{background:var(--panel2);border:1px solid var(--border2);color:var(--accent);
        font-family:var(--mono);font-size:10px;padding:2px 5px;border-radius:3px;width:100%;outline:none;text-align:center;}
      .mini-input:focus{border-color:var(--accent);}
      .mini-select{background:var(--panel2);border:1px solid var(--border2);color:#8fa4bb;
        font-family:var(--mono);font-size:9px;padding:2px 3px;border-radius:3px;outline:none;cursor:pointer;width:100%;}

      @media(max-width:860px){
        .body{grid-template-columns:1fr;grid-template-rows:auto 1fr;}
        .left-panel{height:40vh;border-right:none;border-bottom:1px solid var(--border);}
        .chart-grid{grid-template-columns:1fr;}
        .gpu-grid{grid-template-columns:repeat(4,1fr);}
      }
    `}</style>

    <div className="app">
      {/* ══ HEADER ══ */}
      <div className="header">
        <div className="header-left">
          <div className="logo-mark">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/>
              <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.6"/>
              <rect x="8" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.8"/>
            </svg>
          </div>
          
          <div>
            <div className="header-title">AI Infrastructure Calculator</div>
            <div className="header-sub">Plan GPU · Compute · Storage · Cost before you build</div>
          </div>
        </div>
        <div className="header-right">
          <button className={`hbtn${showFormulas ? " active" : ""}`} onClick={() => setShowFormulas(s => !s)}>
            ⟨/⟩ Formulas
          </button>
          <div className="toggle-pill">
            <button className={`tpbtn${!isCloud ? " active" : ""}`} onClick={() => setIsCloud(false)}>🏭 On-Prem</button>
            <button className={`tpbtn${isCloud ? " active" : ""}`} onClick={() => setIsCloud(true)}>☁️ Cloud</button>
          </div>
        </div>
      </div>

      <div className="body">
        {/* ══ LEFT PANEL ══ */}
        <div className="left-panel">

          {/* AI Task Types */}
          <div className="input-section">
            <div className="sec-title">AI Task Types</div>
            <div className="sec-sub">Select all workloads running on this infrastructure</div>
            <div className="task-grid">
              {TASK_PRESETS.map(t => (
                <button key={t.id}
                  className={`task-btn${selectedTasks[t.id] ? " sel" : ""}`}
                  onClick={() => setSelectedTasks(p => ({ ...p, [t.id]: !p[t.id] }))}>
                  <span className="task-icon">{t.icon}</span>
                  <span className="task-lbl">{t.label}</span>
                  <span className="task-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Per-task config */}
          {calc.activeTasks.length > 0 && (
            <div className="input-section">
              <div className="sec-title">Task Configuration</div>
              <div className="sec-sub">Streams, resolution & target FPS per task</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 8, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>
                <div style={{ width: 110 }}>Task</div>
                <div style={{ flex: 1 }}>Resolution</div>
                <div style={{ width: 80, textAlign: "center" }}>FPS Target</div>
                <div style={{ width: 60, textAlign: "center" }}>Streams</div>
              </div>
              {calc.activeTasks.map(t => (
                <div key={t.id} className="task-config-row">
                  <div style={{ fontSize: 9, color: "#dde4ee", display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{t.icon}</span> {t.label}
                  </div>
                  <select className="mini-select" value={taskResIdx[t.id]}
                    onChange={e => setTaskResIdx(p => ({ ...p, [t.id]: Number(e.target.value) }))}>
                    {RES_PRESETS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                  </select>
                  <input type="number" min="0.1" max="60" step="0.5"
                    value={taskFps[t.id]} className="mini-input"
                    onChange={e => setTaskFps(p => ({ ...p, [t.id]: Math.max(0.1, Number(e.target.value)) }))} />
                  <input type="number" min="1" max="5000"
                    value={taskStreams[t.id]} className="mini-input"
                    onChange={e => setTaskStreams(p => ({ ...p, [t.id]: Math.max(1, Number(e.target.value)) }))} />
                </div>
              ))}
            </div>
          )}

          {/* GPU */}
          <div className="input-section">
            <div className="sec-title">GPU Selection</div>
            <div className="sec-sub">NVIDIA inference / training hardware</div>
            <div className="gpu-grid">
              {Object.entries(GPU_SPECS).map(([k, v]) => (
                <button key={k} className={`gpu-btn${gpuType === k ? " sel" : ""}`}
                  onClick={() => { setGpuType(k); setGpuPriceLow(v.price); setGpuPriceHigh(v.priceHigh); }}>
                  {v.name}
                  <div className="gpu-vram">{v.vram}GB</div>
                </button>
              ))}
            </div>
          </div>

          {/* Infrastructure */}
          <div className="input-section">
            <div className="sec-title">Infrastructure</div>
            <div className="sec-sub">Network streams & data throughput</div>
            <SliderInput label="Concurrent Streams / Requests" value={streams} min={1} max={1000} step={1}
              onChange={setStreams} />
            <SliderInput label="Bandwidth per Stream" value={bitratePerStream} min={1} max={50}
              onChange={setBitrate} unit=" Mbps" />
            <SliderInput label="CPU Cores per Server" value={cpuCores} min={8} max={128} step={8}
              onChange={setCpuCores} />
            <div style={{ fontSize: 9, color: calc.cpuCoresNeeded > cpuCores ? "#f5a623" : "#00e5b8", padding: "6px 9px", background: "var(--panel2)", borderRadius: 5, border: "1px solid var(--border2)", marginTop: 4 }}>
              Recommended: <strong>{calc.cpuCoresNeeded}</strong> cores — {cpuCores >= calc.cpuCoresNeeded ? "✅ sufficient" : "⚠️ may bottleneck"}
            </div>
          </div>

          {/* Storage */}
          <div className="input-section">
            <div className="sec-title">Storage & Retention</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#8fa4bb" }}>Enable storage calculation</span>
              <div className="tog" onClick={() => setStorageEnabled(s => !s)}>
                <div className={`tog-track${storageEnabled ? " on" : ""}`} />
                <div className={`tog-thumb${storageEnabled ? " on" : ""}`} />
              </div>
            </div>
            {storageEnabled && (<>
              <SliderInput label="Retention Period" value={retentionDays} min={1} max={365}
                onChange={setRetentionDays} unit=" days" />
              <SliderInput label="Redundancy Factor" value={redundancy} min={1.0} max={3.0} step={0.1}
                onChange={setRedundancy} format={v => v.toFixed(1)} unit="×" />
            </>)}
          </div>

          {/* Pricing */}
          <div className="input-section">
            <div className="sec-title">Pricing (USD)</div>
            <div className="sec-sub">Low / High range for cost estimates</div>

            <div className="price-lbl">GPU unit price</div>
            <div className="price-row">
              <input type="number" value={gpuPriceLow} min={0} step={100} className="num-input" onChange={e => setGpuPriceLow(Number(e.target.value))} />
              <span style={{ textAlign: "center", color: "var(--muted)", fontSize: 10 }}>–</span>
              <input type="number" value={gpuPriceHigh} min={0} step={100} className="num-input" onChange={e => setGpuPriceHigh(Number(e.target.value))} />
            </div>

            <div className="price-lbl">Server cost</div>
            <div className="price-row">
              <input type="number" value={serverPriceLow} min={0} step={500} className="num-input" onChange={e => setServerPriceLow(Number(e.target.value))} />
              <span style={{ textAlign: "center", color: "var(--muted)", fontSize: 10 }}>–</span>
              <input type="number" value={serverPriceHigh} min={0} step={500} className="num-input" onChange={e => setServerPriceHigh(Number(e.target.value))} />
            </div>

            <div className="price-lbl">Storage / TB</div>
            <div style={{ marginBottom: 10 }}>
              <input type="number" value={storagePriceTB} min={5} step={5} className="num-input" style={{ width: "100%" }} onChange={e => setStoragePriceTB(Number(e.target.value))} />
            </div>

            {isCloud && (<>
              <div className="price-lbl">Cloud GPU $/hour</div>
              <div className="price-row">
                <input type="number" value={cloudPerHr} min={0} step={0.1} className="num-input" onChange={e => setCloudPerHr(Number(e.target.value))} />
                <span style={{ textAlign: "center", color: "var(--muted)", fontSize: 10 }}>–</span>
                <input type="number" value={cloudPerHrHigh} min={0} step={0.1} className="num-input" onChange={e => setCloudPerHrHigh(Number(e.target.value))} />
              </div>
            </>)}
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="right-panel">
          <div className="tabs">
            {[
              { id: "summary",  label: "📊 Summary"  },
              { id: "compute",  label: "⚡ Compute"  },
              { id: "network",  label: "🌐 Network"  },
              { id: "storage",  label: "💾 Storage"  },
              { id: "cost",     label: "💰 Cost"     },
            ].map(t => (
              <button key={t.id} className={`tab${activeTab === t.id ? " active" : ""}`}
                onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="content">

            {/* ══ SUMMARY ══ */}
            {activeTab === "summary" && (<>
              {calc.activeTasks.length === 0 ? (
                <div className="alert alert-info">
                  <span className="alert-icon">👈</span>
                  <span>Select at least one AI task type on the left to start calculating infrastructure requirements.</span>
                </div>
              ) : null}

              <div className="metric-grid">
                <MetricCard label="GPUs Required" value={calc.gpusNeeded} unit="GPUs"
                  sub={`${calc.effectiveStreams} streams ÷ ${calc.streamsPerGpu} streams/GPU`} accent />
                <MetricCard label="Servers" value={calc.serversNeeded} unit="servers"
                  sub={`${gpu.gpusPerServer} GPUs per server · ${gpu.name}`} accent />
                <MetricCard label="VRAM Used" value={calc.totalMemNeeded.toFixed(1)} unit={`/ ${gpu.vram} GB`}
                  sub={`${Math.max(0, calc.memRemaining).toFixed(1)} GB headroom`}
                  accent={calc.memFitsInGpu} warn={!calc.memFitsInGpu} />
                <MetricCard label="Network BW" value={calc.bufferedGbps.toFixed(2)} unit="Gbps"
                  sub="incl. 20% overhead buffer" />
                <MetricCard label="Storage" value={storageEnabled ? (calc.pbTotal * 1024).toFixed(0) : "—"} unit="TB"
                  sub={storageEnabled ? `${retentionDays}d × ${redundancy.toFixed(1)}× redundancy` : "Enable to calculate"} warn={storageEnabled} />
                <MetricCard label="CPU Cores" value={calc.cpuCoresNeeded} unit="recommended"
                  sub={`Your selection: ${cpuCores} cores`} />
                <RangeCard label="Total Infra Cost" low={fmtNum(calc.totalCapexLow)}
                  high={fmtNum(calc.totalCapexHigh)}
                  sub="GPU + servers + storage (low–high)" />
                {isCloud && (
                  <RangeCard label="Cloud / Month" low={fmtNum(calc.cloudMonthlyLow)}
                    high={fmtNum(calc.cloudMonthlyHigh)}
                    sub={`${calc.gpusNeeded} GPUs × 720 hrs`} />
                )}
              </div>

              {!calc.memFitsInGpu && (
                <div className="alert alert-warn">
                  <span className="alert-icon">⚠️</span>
                  <span>VRAM overrun: {calc.totalMemNeeded.toFixed(1)} GB needed but {gpu.name} has {gpu.vram} GB.
                    Lower resolution, reduce active task count, or upgrade to H20 / A100 (80–96 GB VRAM).</span>
                </div>
              )}
              {calc.cpuCoresNeeded > cpuCores && (
                <div className="alert alert-warn">
                  <span className="alert-icon">⚠️</span>
                  <span>CPU cores ({cpuCores}) is below the recommended {calc.cpuCoresNeeded} for this workload.
                    Consider a higher-core server to avoid decode bottlenecks.</span>
                </div>
              )}

              <div className="chart-grid">
                <div className="chart-card">
                  <div className="chart-title">Infrastructure Overview</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        { name: "Streams", value: calc.effectiveStreams, fill: "#4a90d9" },
                        { name: "GPUs",    value: calc.gpusNeeded,       fill: "#00e5b8" },
                        { name: "Servers", value: calc.serversNeeded,    fill: "#f5a623" },
                      ]}
                      margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#56697e" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#56697e" }} />
                      <Tooltip content={<CT />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[{ fill: "#4a90d9" }, { fill: "#00e5b8" }, { fill: "#f5a623" }].map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="chart-title">Cost Distribution (Low Est.)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={costPie} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" paddingAngle={3}>
                        {costPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }) => active && payload?.length ? (
                        <div className="custom-tooltip"><div className="ct-label">{payload[0].name}</div><div className="ct-value">{fmtNum(payload[0].value)}</div></div>
                      ) : null} />
                      <Legend formatter={v => <span style={{ fontSize: 9, color: "#8fa4bb" }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* VRAM bar */}
              <div className="chart-card">
                <div className="chart-title">VRAM Allocation — {calc.totalMemNeeded.toFixed(1)} GB / {gpu.vram} GB</div>
                <div className="vram-bar-track">
                  {calc.vramBreakdown.map((s, i) => (
                    <div key={i} style={{ width: `${Math.min(100, (s.gb / gpu.vram) * 100)}%`, background: s.fill, height: "100%" }} />
                  ))}
                </div>
                <div className="vram-legend">
                  {calc.vramBreakdown.map((s, i) => (
                    <div key={i} className="vram-legend-item">
                      <div className="vram-legend-dot" style={{ background: s.fill }} />
                      {s.name}: {s.gb.toFixed(2)} GB
                    </div>
                  ))}
                  <div className="vram-legend-item">
                    <div className="vram-legend-dot" style={{ background: "#1a2535" }} />
                    Free: {Math.max(0, calc.memRemaining).toFixed(1)} GB
                  </div>
                </div>
              </div>
            </>)}

            {/* ══ COMPUTE ══ */}
            {activeTab === "compute" && (<>
              <div className="metric-grid">
                <MetricCard label="GPU Model"         value={gpu.name}         unit=""        sub={`${gpu.vram}GB VRAM · ${gpu.tdp}W TDP`} />
                <MetricCard label="GPU IPS Capacity"  value={gpu.ips}          unit="IPS"     sub="inferences/sec @ 640×640 baseline" />
                <MetricCard label="IPS Demand/Stream" value={calc.totalIpsDemandPerStream?.toFixed(1) ?? "0"} unit="IPS"
                  sub="sum of all active tasks" />
                <MetricCard label="Streams / GPU"     value={calc.streamsPerGpu} unit="streams"
                  sub={`floor(${gpu.ips} / ${calc.totalIpsDemandPerStream?.toFixed(1) ?? "0"})`} accent />
                <MetricCard label="Total Streams"     value={calc.effectiveStreams} unit=""
                  sub="max across active tasks" />
                <MetricCard label="GPUs Required"     value={calc.gpusNeeded}  unit="GPUs"    accent />
                <MetricCard label="Servers"           value={calc.serversNeeded} unit="servers"
                  sub={`${gpu.gpusPerServer} GPUs/server (thermal limit)`} />
                <MetricCard label="CPU Cores Needed"  value={calc.cpuCoresNeeded} unit="cores"
                  sub="decode + preproc + overhead × 1.5×" warn={calc.cpuCoresNeeded > cpuCores} />
              </div>

              {showFormulas && (
                <div className="formula-section">
                  <div className="formula-section-title">⟨/⟩ Compute Formulas</div>
                  <div className="formula-grid">
                    {calc.activeTasks.map(t => {
                      const res = RES_PRESETS[taskResIdx[t.id]];
                      return (
                        <FormulaBox key={t.id}
                          label={`${t.label} IPS demand/stream`}
                          formula={`${taskFps[t.id]} fps × ${res.scale} (res scale @ ${res.label})`}
                          result={`${(calc.taskIpsDemand[t.id] || 0).toFixed(1)} IPS/stream`} />
                      );
                    })}
                    <FormulaBox label="Total IPS demand per stream"
                      formula={`Σ all task demands`}
                      result={`${calc.totalIpsDemandPerStream?.toFixed(1) ?? 0} IPS/stream`} />
                    <FormulaBox label="Streams per GPU"
                      formula={`floor(${gpu.ips} IPS / ${calc.totalIpsDemandPerStream?.toFixed(1) ?? 0})`}
                      result={`${calc.streamsPerGpu} streams`} />
                    <FormulaBox label="GPUs needed"
                      formula={`ceil(${calc.effectiveStreams} streams / ${calc.streamsPerGpu})`}
                      result={`${calc.gpusNeeded} GPUs`} />
                    <FormulaBox label="Servers needed"
                      formula={`ceil(${calc.gpusNeeded} GPUs / ${gpu.gpusPerServer} GPUs/server)`}
                      result={`${calc.serversNeeded} servers`} />
                  </div>
                </div>
              )}

              <div className="divider" />
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent2)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 12 }}>
                Active Task Breakdown
              </div>
              {calc.activeTasks.length > 0 ? (
                <table className="data-table">
                  <thead><tr>
                    <th>Task</th><th>Resolution</th><th>FPS</th><th>Streams</th><th>IPS/Stream</th><th>VRAM</th>
                  </tr></thead>
                  <tbody>
                    {calc.activeTasks.map(t => {
                      const res = RES_PRESETS[taskResIdx[t.id]];
                      return (
                        <tr key={t.id}>
                          <td>{t.icon} {t.label}</td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#8fa4bb" }}>{res.label}</td>
                          <td style={{ fontFamily: "var(--mono)", color: "var(--accent)", fontWeight: 700 }}>{taskFps[t.id]}</td>
                          <td style={{ fontFamily: "var(--mono)" }}>{taskStreams[t.id]}</td>
                          <td style={{ fontFamily: "var(--mono)", color: "#f5a623" }}>{(calc.taskIpsDemand[t.id] || 0).toFixed(1)}</td>
                          <td style={{ fontFamily: "var(--mono)", color: "#4a90d9" }}>{(t.vramPerModel * res.scale).toFixed(1)} GB</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "var(--panel2)" }}>
                      <td colSpan={4} style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ fontFamily: "var(--mono)", color: "#f5a623", fontWeight: 700 }}>{calc.totalIpsDemandPerStream?.toFixed(1)} IPS</td>
                      <td style={{ fontFamily: "var(--mono)", color: "var(--accent)", fontWeight: 700 }}>{calc.totalMemNeeded.toFixed(1)} GB</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="alert alert-info"><span className="alert-icon">ℹ️</span><span>No tasks selected yet.</span></div>
              )}
            </>)}

            {/* ══ NETWORK ══ */}
            {activeTab === "network" && (<>
              <div className="metric-grid">
                <MetricCard label="Raw Bandwidth" value={calc.totalBandwidthMbps.toLocaleString()} unit="Mbps"
                  sub={`${calc.effectiveStreams} streams × ${bitratePerStream} Mbps`} />
                <MetricCard label="In Gbps" value={(calc.totalBandwidthMbps / 1000).toFixed(2)} unit="Gbps" sub="÷ 1000" />
                <MetricCard label="With 20% Buffer" value={calc.bufferedGbps.toFixed(2)} unit="Gbps"
                  sub="RTSP control + burst overhead" accent />
                <MetricCard label="Switch Spec" value={calc.bufferedGbps > 10 ? "25GbE+" : "10GbE"} unit=""
                  sub={`${calc.bufferedGbps.toFixed(2)} Gbps load`} warn={calc.bufferedGbps > 10} />
              </div>
              {showFormulas && (
                <div className="formula-section">
                  <div className="formula-section-title">⟨/⟩ Network Formulas</div>
                  <div className="formula-grid">
                    <FormulaBox label="Total raw bandwidth" formula={`${calc.effectiveStreams} × ${bitratePerStream} Mbps`} result={`${calc.totalBandwidthMbps} Mbps`} />
                    <FormulaBox label="Convert to Gbps" formula={`${calc.totalBandwidthMbps} / 1000`} result={`${(calc.totalBandwidthMbps / 1000).toFixed(3)} Gbps`} />
                    <FormulaBox label="Add 20% buffer" formula={`${(calc.totalBandwidthMbps / 1000).toFixed(3)} × 1.20`} result={`${calc.bufferedGbps.toFixed(3)} Gbps`} />
                  </div>
                </div>
              )}
              <div className="chart-card">
                <div className="chart-title">Bandwidth vs Stream Count</div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={[10, 25, 50, 100, 200, 320, 500, 800, 1000].map(s => ({
                      s, gbps: parseFloat((s * bitratePerStream / 1000 * 1.2).toFixed(2))
                    }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4a90d9" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#4a90d9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" />
                    <XAxis dataKey="s" tick={{ fontSize: 9, fill: "#56697e" }} label={{ value: "Streams", position: "insideBottomRight", offset: -5, style: { fill: "#56697e", fontSize: 9 } }} />
                    <YAxis tick={{ fontSize: 9, fill: "#56697e" }} />
                    <Tooltip content={({ active, payload }) => active && payload?.length ? (
                      <div className="custom-tooltip"><div className="ct-label">{payload[0].payload.s} streams</div><div className="ct-value">{payload[0].value} Gbps</div></div>
                    ) : null} />
                    <Area type="monotone" dataKey="gbps" stroke="#4a90d9" fill="url(#bwGrad)" strokeWidth={2} dot={{ r: 3, fill: "#4a90d9" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>)}

            {/* ══ STORAGE ══ */}
            {activeTab === "storage" && (<>
              {!storageEnabled && (
                <div className="alert alert-info">
                  <span className="alert-icon">💾</span>
                  <span>Storage calculation is <strong>disabled</strong>. Enable it in the left panel to get a retention-based estimate.</span>
                </div>
              )}
              <div className="metric-grid">
                <MetricCard label="MB/sec per Stream" value={(bitratePerStream * BYTES_PER_BIT).toFixed(2)} unit="MB/s" sub={`${bitratePerStream} Mbps × 0.125`} />
                <MetricCard label="GB/day per Stream" value={((bitratePerStream * BYTES_PER_BIT * SECONDS_PER_DAY) / 1024).toFixed(1)} unit="GB/day" sub="× 86,400 sec" />
                <MetricCard label="TB/day (all streams)" value={calc.tbPerDay.toFixed(2)} unit="TB/day"
                  sub={`${calc.effectiveStreams} streams`} accent={storageEnabled} />
                <MetricCard label="Total Storage" value={storageEnabled ? (calc.pbTotal * 1024).toFixed(0) : "—"} unit="TB"
                  sub={storageEnabled ? `${retentionDays}d × ${redundancy.toFixed(1)}× redundancy` : "Enable storage"} warn={storageEnabled} />
              </div>
              {storageEnabled && showFormulas && (
                <div className="formula-section">
                  <div className="formula-section-title">⟨/⟩ Storage Formulas</div>
                  <div className="formula-grid">
                    <FormulaBox label="MB/s per stream" formula={`${bitratePerStream} × 0.125`} result={`${(bitratePerStream * BYTES_PER_BIT).toFixed(2)} MB/s`} />
                    <FormulaBox label="GB/day per stream" formula={`${(bitratePerStream * BYTES_PER_BIT).toFixed(2)} × 86400 / 1024`} result={`${((bitratePerStream * BYTES_PER_BIT * SECONDS_PER_DAY) / 1024).toFixed(2)} GB`} />
                    <FormulaBox label="TB/day total" formula={`${((bitratePerStream * BYTES_PER_BIT * SECONDS_PER_DAY) / 1024).toFixed(2)} × ${calc.effectiveStreams} / 1024`} result={`${calc.tbPerDay.toFixed(2)} TB`} />
                    <FormulaBox label={`Total for ${retentionDays}d + redundancy`} formula={`${calc.tbPerDay.toFixed(2)} × ${retentionDays} × ${redundancy.toFixed(1)}`} result={`${(calc.pbTotal * 1024).toFixed(0)} TB`} />
                  </div>
                </div>
              )}
              {storageEnabled && (
                <div className="chart-card">
                  <div className="chart-title">Storage Growth Over Retention Period</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                      data={Array.from({ length: Math.min(retentionDays, 90) }, (_, i) => ({
                        day: i + 1, tb: parseFloat((calc.tbPerDay * (i + 1) * redundancy).toFixed(1))
                      }))}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="storGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f5a623" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#56697e" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#56697e" }} />
                      <Tooltip content={({ active, payload }) => active && payload?.length ? (
                        <div className="custom-tooltip"><div className="ct-label">Day {payload[0].payload.day}</div><div className="ct-value">{payload[0].value} TB</div></div>
                      ) : null} />
                      <Area type="monotone" dataKey="tb" stroke="#f5a623" fill="url(#storGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>)}

            {/* ══ COST ══ */}
            {activeTab === "cost" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div>
                  <div className="chart-card">
                    <div className="chart-title">{isCloud ? "Cloud OPEX" : "On-Prem CAPEX"} — Low / High</div>
                    {isCloud ? (<>
                      {[
                        { label: `🖥️ Cloud GPUs (${calc.gpusNeeded} × 720h/mo)`, lo: calc.cloudMonthlyLow, hi: calc.cloudMonthlyHigh, color: "#00e5b8", suffix: "/mo" },
                        { label: "📅 Annual cost", lo: calc.cloudAnnualLow, hi: calc.cloudAnnualHigh, color: "#4a90d9", suffix: "/yr" },
                      ].map((r, i) => (
                        <div key={i} className="cost-row">
                          <span style={{ fontSize: 11, color: "#8fa4bb" }}>{r.label}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                            <span style={{ color: "#8fa4bb" }}>{fmtNum(r.lo)}</span>
                            <span style={{ color: "var(--muted)", margin: "0 4px" }}>–</span>
                            <span style={{ color: r.color, fontWeight: 700 }}>{fmtNum(r.hi)}{r.suffix}</span>
                          </span>
                        </div>
                      ))}
                      <div className="cost-row">
                        <span style={{ fontSize: 11, color: "#8fa4bb" }}>Break-even vs on-prem</span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#8fa4bb" }}>
                          {(calc.gpuCostLow / calc.cloudMonthlyHigh).toFixed(0)}–{(calc.gpuCostHigh / calc.cloudMonthlyLow).toFixed(0)} months
                        </span>
                      </div>
                    </>) : (<>
                      {[
                        { label: `⚡ GPU Hardware (${calc.gpusNeeded} units)`,      lo: calc.gpuCostLow,    hi: calc.gpuCostHigh,    color: "#00e5b8" },
                        { label: `🖥️ Servers (${calc.serversNeeded} units)`,        lo: calc.serverCostLow, hi: calc.serverCostHigh, color: "#4a90d9" },
                        { label: `💾 Storage (${storageEnabled ? (calc.pbTotal * 1024).toFixed(0) + " TB" : "default"})`, lo: calc.storageCostLow, hi: calc.storageCostHigh, color: "#f5a623" },
                      ].map((r, i) => (
                        <div key={i} className="cost-row">
                          <span style={{ fontSize: 11, color: "#8fa4bb" }}>{r.label}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                            <span style={{ color: "#8fa4bb" }}>{fmtNum(r.lo)}</span>
                            <span style={{ color: "var(--muted)", margin: "0 4px" }}>–</span>
                            <span style={{ color: r.color, fontWeight: 700 }}>{fmtNum(r.hi)}</span>
                          </span>
                        </div>
                      ))}
                      <div className="cost-total">
                        <div className="cost-total-label">Total CAPEX</div>
                        <div className="cost-total-val">{fmtNum(calc.totalCapexLow)}</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#8fa4bb", marginTop: 2 }}>up to {fmtNum(calc.totalCapexHigh)}</div>
                        <div style={{ fontSize: 8, color: "#56697e", marginTop: 6 }}>
                          {fmtNum(calc.totalCapexLow / calc.effectiveStreams)} – {fmtNum(calc.totalCapexHigh / calc.effectiveStreams)} per stream
                        </div>
                      </div>
                    </>)}
                  </div>
                </div>
                <div className="chart-card">
                  <div className="chart-title">Cost Breakdown (Low Estimate)</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={costPie} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                        {costPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }) => active && payload?.length ? (
                        <div className="custom-tooltip"><div className="ct-label">{payload[0].name}</div><div className="ct-value">{fmtNum(payload[0].value)}</div></div>
                      ) : null} />
                      <Legend formatter={v => <span style={{ fontSize: 9, color: "#8fa4bb" }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {showFormulas && (
                <div className="formula-section" style={{ marginTop: 18 }}>
                  <div className="formula-section-title">⟨/⟩ Cost Formulas</div>
                  <div className="formula-grid">
                    <FormulaBox label="GPU hardware" formula={`${calc.gpusNeeded} × ($${gpuPriceLow.toLocaleString()} – $${gpuPriceHigh.toLocaleString()})`} result={`${fmtNum(calc.gpuCostLow)} – ${fmtNum(calc.gpuCostHigh)}`} />
                    <FormulaBox label="Servers" formula={`${calc.serversNeeded} × ($${serverPriceLow.toLocaleString()} – $${serverPriceHigh.toLocaleString()})`} result={`${fmtNum(calc.serverCostLow)} – ${fmtNum(calc.serverCostHigh)}`} />
                    {isCloud && <FormulaBox label="Cloud monthly" formula={`${calc.gpusNeeded} GPUs × 720h × ($${cloudPerHr} – $${cloudPerHrHigh})`} result={`${fmtNum(calc.cloudMonthlyLow)} – ${fmtNum(calc.cloudMonthlyHigh)}/mo`} />}
                  </div>
                </div>
              )}
            </>)}

          </div>
        </div>
      </div>
    </div>
  </>);
}
