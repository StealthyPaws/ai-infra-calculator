"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart
} from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GPU_SPECS = {
  T4:    { name: "Tesla T4",   streams: 30,  vram: 16, price: 800,   priceHigh: 2500  },
  A5000: { name: "RTX A5000", streams: 60,  vram: 24, price: 3300,  priceHigh: 4000  },
  L4:    { name: "NVIDIA L4", streams: 75,  vram: 24, price: 2000,  priceHigh: 3000  },
  H20:   { name: "NVIDIA H20",streams: 120, vram: 96, price: 10000, priceHigh: 12000 },
  L20:   { name: "NVIDIA L20",streams: 100, vram: 48, price: 6000,  priceHigh: 13200 },
};

const RES_PRESETS = [
  { label: "220×220",   w: 220,  vramScale: 0.30, streamScale: 2.20 },
  { label: "320×320",   w: 320,  vramScale: 0.45, streamScale: 1.70 },
  { label: "512×512",   w: 512,  vramScale: 0.70, streamScale: 1.25 },
  { label: "640×640",   w: 640,  vramScale: 1.00, streamScale: 1.00 },
  { label: "960×960",   w: 960,  vramScale: 1.60, streamScale: 0.65 },
  { label: "1280×1280", w: 1280, vramScale: 2.20, streamScale: 0.45 },
];

const PIPELINE = {
  DETECTION: "detection",
  TRACKING:  "tracking",
  REID:      "reid",
};

const PIPELINE_MULTIPLIERS = {
  [PIPELINE.DETECTION]: 1.0,
  [PIPELINE.TRACKING]:  1.35,
  [PIPELINE.REID]:      1.6,
};

const PIPELINE_LABELS = {
  [PIPELINE.DETECTION]: { label: "Detection Only",               color: "#00d4aa", icon: "🔍" },
  [PIPELINE.TRACKING]:  { label: "Detection + Tracking",         color: "#3b82f6", icon: "🎯" },
  [PIPELINE.REID]:      { label: "Detection + Tracking + Re-ID", color: "#f59e0b", icon: "🔄" },
};

// Vehicle UC IDs — only these get pipeline override
const VEHICLE_UC_IDS = new Set([8, 9, 10, 11, 12]);

const ALL_USE_CASES = [
  { n: 1,  label: "Fire & Smoke Detection",                                  model: "hazards",  pipeline: PIPELINE.DETECTION },
  { n: 2,  label: "Safety Jacket",                                           model: "ppe",      pipeline: PIPELINE.DETECTION },
  { n: 3,  label: "Safety Helmet",                                           model: "ppe",      pipeline: PIPELINE.DETECTION },
  { n: 4,  label: "3M Face Mask — Chemical Mixing Room",                     model: "facemask", pipeline: PIPELINE.DETECTION },
  { n: 5,  label: "3M Face Mask + Chemical Suit — Paint Booth",              model: "facemask", pipeline: PIPELINE.DETECTION },
  { n: 6,  label: "Welding Safety Shield",                                   model: "shields",  pipeline: PIPELINE.DETECTION },
  { n: 7,  label: "Grinder Safety Shield",                                   model: "shields",  pipeline: PIPELINE.DETECTION },
  { n: 8,  label: "Forklift Speed Limit",                                    model: "vehicle",  pipeline: PIPELINE.TRACKING  },
  { n: 9,  label: "Forklift Lifting Height",                                 model: "vehicle",  pipeline: PIPELINE.TRACKING  },
  { n: 10, label: "Rickshaw Speed Limit",                                    model: "vehicle",  pipeline: PIPELINE.TRACKING  },
  { n: 11, label: "Rickshaw Load Height",                                    model: "vehicle",  pipeline: PIPELINE.TRACKING  },
  { n: 12, label: "All Vehicles Speed Limit",                                model: "vehicle",  pipeline: PIPELINE.TRACKING  },
  { n: 13, label: "Harness Belt, Lanyard & Shock Absorber (Work at Height)", model: "ppe",      pipeline: PIPELINE.DETECTION },
  { n: 14, label: "No Phone Use While Driving",                              model: "behavior", pipeline: PIPELINE.DETECTION },
  { n: 15, label: "No Smoking in Plant (excl. designated areas)",            model: "behavior", pipeline: PIPELINE.DETECTION },
  { n: 16, label: "No Unattended Pallets / Scrap on Roads",                  model: "scene",    pipeline: PIPELINE.DETECTION },
  { n: 17, label: "No Obstruction in Front of Emergency Exits",              model: "scene",    pipeline: PIPELINE.DETECTION },
];

const DEFAULT_UC_CAMERAS = {
  1: 250, 2: 43, 3: 30, 4: 40,  5: 20,
  6: 19,  7: 19, 8: 30, 9: 30,  10: 20,
  11: 20, 12: 40, 13: 40, 14: 40, 15: 250,
  16: 20, 17: 30,
};

const MODEL_GROUPS = [
  { id: "ppe",      name: "PPE Master",       color: "#00d4aa", baseMemGB: 1.8, baseFps: 5,  resPresetIdx: 4 },
  { id: "vehicle",  name: "Vehicle Master",   color: "#3b82f6", baseMemGB: 0.8, baseFps: 25,  resPresetIdx: 3 },
  { id: "facemask", name: "Face Mask",        color: "#f59e0b", baseMemGB: 1.0, baseFps: 5,  resPresetIdx: 4 },
  { id: "hazards",  name: "Hazards",          color: "#ef4444", baseMemGB: 1.2, baseFps: 20,  resPresetIdx: 3 },
  { id: "shields",  name: "Shields",          color: "#8b5cf6", baseMemGB: 1.0, baseFps: 5,  resPresetIdx: 3 },
  { id: "behavior", name: "Behavior",         color: "#ec4899", baseMemGB: 0.7, baseFps: 10,  resPresetIdx: 3 },
  { id: "scene",    name: "Scene Monitoring", color: "#06b6d4", baseMemGB: 0.6, baseFps: 1,  resPresetIdx: 2 },
];

const OVERHEAD_MEM = { tracking: 0.3, deepstream: 2.0 };
const NETWORK_BUFFER  = 1.20;
const BYTES_PER_BIT   = 0.125;
const SECONDS_PER_DAY = 86400;
const BASE_RES_W      = 640; // baseline resolution for GPU IPS rating

// GPU throughput in inferences/second at 640×640 (YOLOv8s equivalent, DeepStream)
// Formula: camerasPerGpu = floor( gpu_ips / demand_per_camera )
// demand_per_camera = Σ_models( fps[m] × (resW[m]/640)² × pipelineMult[m] )
const GPU_IPS = { T4: 750, A5000: 1500, L4: 1800, H20: 4000, L20: 3000 };

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmtLacs = n => {
  const lacs = n / 100_000;
  if (lacs >= 100) return `$${(lacs / 100).toFixed(2)} Cr`;
  if (lacs >= 1)   return `$${lacs.toFixed(2)} L`;
  return `$${Math.round(n).toLocaleString()}`;
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const FormulaBox = ({ label, formula, result }) => (
  <div className="formula-box">
    <div className="formula-label">{label}</div>
    <div className="formula-expr">{formula}</div>
    <div className="formula-result">= {result}</div>
  </div>
);

const SectionHeader = ({ icon, title, subtitle }) => (
  <div className="section-header">
    <span className="section-icon">{icon}</span>
    <div>
      <div className="section-title">{title}</div>
      {subtitle && <div className="section-subtitle">{subtitle}</div>}
    </div>
  </div>
);

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
    <div style={{ display:"flex", alignItems:"baseline", gap:4, flexWrap:"wrap" }}>
      <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"#94a3b8" }}>{low}</span>
      <span style={{ color:"var(--muted)", fontSize:11 }}>–</span>
      <span style={{ fontFamily:"var(--mono)", fontSize:18, fontWeight:700, color:"#f1f5f9" }}>{high}</span>
    </div>
    {sub && <div className="metric-sub">{sub}</div>}
  </div>
);

const SliderInput = ({ label, value, min, max, step=1, onChange, format=v=>v, unit="" }) => (
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AIInfraCalculator() {

  const [cameras,          setCameras]          = useState(320);
  const [bitratePerCam,    setBitratePerCam]    = useState(8);
  const [gpuType,          setGpuType]          = useState("L4");
  const [retentionDays,    setRetentionDays]    = useState(30);
  const [redundancyFactor, setRedundancyFactor] = useState(1.20);
  const [storageEnabled,   setStorageEnabled]   = useState(false);
  const [isCloud,          setIsCloud]          = useState(false);
  const [gpusPerServer,    setGpusPerServer]    = useState(8);
  const [activeTab,        setActiveTab]        = useState("summary");
  const [showFormulas,     setShowFormulas]      = useState(true);
  const [showUcCameras,    setShowUcCameras]    = useState(false);

  const [gpuPriceLow,      setGpuPriceLow]      = useState(GPU_SPECS["L4"].price);
  const [gpuPriceHigh,     setGpuPriceHigh]     = useState(GPU_SPECS["L4"].priceHigh);
  const [serverPriceLow,   setServerPriceLow]   = useState(10000);
  const [serverPriceHigh,  setServerPriceHigh]  = useState(14000);
  const [storagePriceLow,  setStoragePriceLow]  = useState(60000);
  const [storagePriceHigh, setStoragePriceHigh] = useState(80000);
  const [cloudPriceLow,    setCloudPriceLow]    = useState(0.30);
  const [cloudPriceHigh,   setCloudPriceHigh]   = useState(0.80);

  const [modelFps,    setModelFps]    = useState(MODEL_GROUPS.reduce((a,m) => ({...a,[m.id]:m.baseFps}),{}));
  const [modelResIdx, setModelResIdx] = useState(MODEL_GROUPS.reduce((a,m) => ({...a,[m.id]:m.resPresetIdx}),{}));

  const [ucCameras,  setUcCameras]  = useState({...DEFAULT_UC_CAMERAS});
  const [enabledUcs, setEnabledUcs] = useState(ALL_USE_CASES.reduce((a,uc) => ({...a,[uc.n]:true}),{}));

  // Per-vehicle-UC pipeline override
  const [ucPipelineOverride, setUcPipelineOverride] = useState(
    [...VEHICLE_UC_IDS].reduce((a,n) => ({...a,[n]:PIPELINE.TRACKING}),{})
  );

  const toggleUc       = (n)       => setEnabledUcs(p => ({...p,[n]:!p[n]}));
  const enableAllUcs   = ()        => setEnabledUcs(ALL_USE_CASES.reduce((a,uc) => ({...a,[uc.n]:true}),{}));
  const disableAllUcs  = ()        => setEnabledUcs(ALL_USE_CASES.reduce((a,uc) => ({...a,[uc.n]:false}),{}));
  const toggleModelUcs = (modelId) => {
    const nums = ALL_USE_CASES.filter(uc => uc.model === modelId).map(uc => uc.n);
    const allOn = nums.every(n => enabledUcs[n]);
    setEnabledUcs(p => { const next={...p}; nums.forEach(n=>{next[n]=!allOn;}); return next; });
  };

  const gpu = GPU_SPECS[gpuType];

  // ─── CORE CALCULATIONS ────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const activeUcs      = ALL_USE_CASES.filter(uc => enabledUcs[uc.n]);
    const activeModelIds = new Set(activeUcs.map(uc => uc.model));
    const activeModels   = MODEL_GROUPS.filter(m => activeModelIds.has(m.id));

    // Effective cameras per model group = max of its active UC camera counts
    const modelCameras = {};
    MODEL_GROUPS.forEach(m => {
      const ucs = activeUcs.filter(uc => uc.model === m.id);
      modelCameras[m.id] = ucs.length > 0 ? Math.max(...ucs.map(uc => ucCameras[uc.n] || 0)) : 0;
    });

    // Resolution info per model
    const modelEffectiveMem = {};
    const modelResLabel     = {};
    const modelResW         = {};
    MODEL_GROUPS.forEach(m => {
      const p = RES_PRESETS[modelResIdx[m.id]];
      modelEffectiveMem[m.id] = m.baseMemGB * p.vramScale;
      modelResLabel[m.id]     = p.label;
      modelResW[m.id]         = p.w;
    });

    // Vehicle pipeline — use max multiplier across active vehicle UCs
    const vehicleActiveUcs  = activeUcs.filter(uc => uc.model === "vehicle");
    const vehiclePipeTypes  = vehicleActiveUcs.map(uc => ucPipelineOverride[uc.n] || PIPELINE.TRACKING);
    const vehicleMultiplier = vehiclePipeTypes.length > 0
      ? Math.max(...vehiclePipeTypes.map(t => PIPELINE_MULTIPLIERS[t]))
      : 1.0;
    const vehicleHasTracking = vehicleMultiplier > 1.0;

    const dominantType = vehicleActiveUcs.length > 0
      ? vehicleActiveUcs.map(uc => ucPipelineOverride[uc.n] || PIPELINE.TRACKING)
          .reduce((best,t) => PIPELINE_MULTIPLIERS[t] > PIPELINE_MULTIPLIERS[best] ? t : best, PIPELINE.DETECTION)
      : PIPELINE.DETECTION;

    // ── THROUGHPUT-BASED GPU CALCULATION ─────────────────────────────────────
    // GPU IPS = inferences per second at 640×640 baseline (YOLOv8s, DeepStream).
    //
    // Each model consumes IPS per camera:
    //   ips_demand[m] = fps[m] × (resW[m] / 640)² × pipelineMult[m]
    //
    // Resolution cost is quadratic (pixel area):
    //   960×960 → (960/640)² = 2.25× relative to baseline
    //   512×512 → (512/640)² = 0.64×
    //   220×220 → (220/640)² = 0.12×
    //
    // Total demand per camera = Σ over all active models that cover this camera.
    // Since all active models share the same GPU and the same camera set,
    // we sum their IPS demands.
    //
    // cameras_per_gpu = floor( gpu_ips / total_demand_per_camera )

    const gpuIps = GPU_IPS[gpuType] || 1800;

    const modelIpsDemand = {};
    activeModels.forEach(m => {
      const fps          = modelFps[m.id];
      const resRatio     = modelResW[m.id] / BASE_RES_W;
      const resCost      = resRatio * resRatio;
      const pipelineMult = m.id === "vehicle" ? vehicleMultiplier : 1.0;
      modelIpsDemand[m.id] = fps * resCost * pipelineMult;
    });

    const totalIpsDemandPerCamera = activeModels.reduce((s,m) => s + modelIpsDemand[m.id], 0);

    const camerasPerGpu = totalIpsDemandPerCamera > 0
      ? Math.max(1, Math.floor(gpuIps / totalIpsDemandPerCamera))
      : 999;

    // Bottleneck = model group with the most cameras
    const effectiveTotalCams = activeModels.length > 0
      ? Math.max(...activeModels.map(m => modelCameras[m.id]))
      : 0;

    const gpusNeeded         = effectiveTotalCams > 0 ? Math.ceil(effectiveTotalCams / camerasPerGpu) : 0;
    const gpusWithRedundancy = gpusNeeded;

    // Per-model GPU breakdown for display
    const modelGpusNeeded = {};
    activeModels.forEach(m => {
      modelGpusNeeded[m.id] = modelCameras[m.id] > 0 ? Math.ceil(modelCameras[m.id] / camerasPerGpu) : 0;
    });

    // VRAM — all active models load onto every GPU
    const totalModelMem  = activeModels.reduce((s,m) => s + modelEffectiveMem[m.id], 0);
    const overheadMem    = activeModels.length > 0 ? OVERHEAD_MEM.tracking + OVERHEAD_MEM.deepstream : 0;
    const vehicleTrackingOverhead = vehicleHasTracking
      ? (vehicleMultiplier >= PIPELINE_MULTIPLIERS[PIPELINE.REID] ? 1.2 : 0.5)
      : 0;
    const totalMemNeeded = totalModelMem + overheadMem + vehicleTrackingOverhead;
    const memFitsInGpu   = totalMemNeeded <= gpu.vram;
    const memRemaining   = gpu.vram - totalMemNeeded;

    // Network
    const totalBandwidthMbps = cameras * bitratePerCam;
    const totalBandwidthGbps = totalBandwidthMbps / 1000;
    const bufferedGbps       = totalBandwidthGbps * NETWORK_BUFFER;

    // FPS
    const fpsBreakdown = activeModels.map(m => ({
      ...m, fps: modelFps[m.id], cams: modelCameras[m.id],
      res: modelResLabel[m.id], effectiveMem: modelEffectiveMem[m.id],
      ipsDemand: modelIpsDemand[m.id],
      totalFps: modelCameras[m.id] * modelFps[m.id],
    }));
    const totalFpsLoad = fpsBreakdown.reduce((s,m) => s + m.totalFps, 0);

    // Storage
    const mbPerSecPerCamera = bitratePerCam * BYTES_PER_BIT;
    const gbPerDayPerCamera = (mbPerSecPerCamera * SECONDS_PER_DAY) / 1024;
    const tbPerDay          = (gbPerDayPerCamera * cameras) / 1024;
    let tbForRetention, pbWithRedundancy;
    if (storageEnabled) {
      tbForRetention   = tbPerDay * retentionDays;
      pbWithRedundancy = (tbForRetention * redundancyFactor) / 1024;
    } else {
      tbForRetention   = 1;
      pbWithRedundancy = 1 / 1024;
    }

    const serversNeeded = gpusWithRedundancy > 0 ? Math.ceil(gpusWithRedundancy / gpusPerServer) : 0;

    const gpuCostLow      = gpusWithRedundancy * gpuPriceLow;
    const gpuCostHigh     = gpusWithRedundancy * gpuPriceHigh;
    const serverCostLow   = serversNeeded * serverPriceLow;
    const serverCostHigh  = serversNeeded * serverPriceHigh;
    const storageCostLow  = pbWithRedundancy * storagePriceLow;
    const storageCostHigh = pbWithRedundancy * storagePriceHigh;
    const totalCapexLow   = gpuCostLow  + serverCostLow  + storageCostLow;
    const totalCapexHigh  = gpuCostHigh + serverCostHigh + storageCostHigh;

    const cloudMonthlyHours = 24 * 30;
    const cloudMonthlyLow   = gpusWithRedundancy * cloudPriceLow  * cloudMonthlyHours;
    const cloudMonthlyHigh  = gpusWithRedundancy * cloudPriceHigh * cloudMonthlyHours;
    const cloudAnnualLow    = cloudMonthlyLow  * 12;
    const cloudAnnualHigh   = cloudMonthlyHigh * 12;

    const modelPipelineInfo = activeModels.map(m => {
      const pType    = m.id === "vehicle" ? dominantType : PIPELINE.DETECTION;
      const pMult    = PIPELINE_MULTIPLIERS[pType];
      const gpuCount = modelGpusNeeded[m.id] || 0;
      return { ...m, pType, pMult, gpuCount, cams: modelCameras[m.id],
               ipsDemand: modelIpsDemand[m.id] };
    });

    return {
      activeModels, activeUcs,
      modelCameras, modelEffectiveMem, modelResLabel, modelResW,
      modelIpsDemand, totalIpsDemandPerCamera,
      modelGpusNeeded, modelPipelineInfo,
      gpuIps, camerasPerGpu,
      effectiveTotalCams, gpusNeeded, gpusWithRedundancy,
      totalModelMem, totalMemNeeded, vehicleTrackingOverhead, memFitsInGpu, memRemaining,
      totalBandwidthMbps, totalBandwidthGbps, bufferedGbps,
      fpsBreakdown, totalFpsLoad,
      mbPerSecPerCamera, gbPerDayPerCamera, tbPerDay, tbForRetention, pbWithRedundancy,
      serversNeeded,
      gpuCostLow, gpuCostHigh, serverCostLow, serverCostHigh,
      storageCostLow, storageCostHigh, totalCapexLow, totalCapexHigh,
      cloudMonthlyHours, cloudMonthlyLow, cloudMonthlyHigh, cloudAnnualLow, cloudAnnualHigh,
      vehicleHasTracking, vehicleMultiplier, dominantType,
    };
  }, [cameras, bitratePerCam, gpuType, retentionDays, redundancyFactor, storageEnabled,
      gpuPriceLow, gpuPriceHigh, serverPriceLow, serverPriceHigh,
      storagePriceLow, storagePriceHigh, gpusPerServer,
      cloudPriceLow, cloudPriceHigh, modelFps, modelResIdx, ucCameras, enabledUcs,
      ucPipelineOverride, gpu]);

  // ─── CHART DATA ───────────────────────────────────────────────────────────
  const fpsChartData = calc.fpsBreakdown.map(m => ({
    name: m.name.replace(" Master","").replace(" Monitoring",""),
    fps: m.totalFps, fill: m.color,
  }));
  const storageGrowthData = storageEnabled && retentionDays > 0
    ? Array.from({length: Math.min(retentionDays, 365)}, (_,i) => ({
        day: i+1, tb: Math.round(calc.tbPerDay*(i+1)*10)/10,
      }))
    : [];
  const costPieLow = [
    {name:"GPU Hardware", value:calc.gpuCostLow,    color:"#00d4aa"},
    {name:"Servers",      value:calc.serverCostLow, color:"#3b82f6"},
    {name:"Storage",      value:calc.storageCostLow,color:"#f59e0b"},
  ];
  const camGpuData = [
    {label:"Eff. Cameras", value:calc.effectiveTotalCams, fill:"#3b82f6"},
    {label:"GPUs",         value:calc.gpusWithRedundancy,  fill:"#00d4aa"},
    {label:"Servers",      value:calc.serversNeeded,       fill:"#8b5cf6"},
  ];
  const vramBreakdown = [
    ...calc.activeModels.map(m => ({
      name: m.name.replace(" Master","").replace(" Monitoring",""),
      gb: parseFloat(calc.modelEffectiveMem[m.id].toFixed(2)), fill: m.color
    })),
    ...(calc.activeModels.length > 0 ? [
      {name:"Tracking Pipeline", gb:OVERHEAD_MEM.tracking,   fill:"#94a3b8"},
      {name:"DeepStream OH",     gb:OVERHEAD_MEM.deepstream,  fill:"#64748b"},
      ...(calc.vehicleTrackingOverhead > 0 ? [{name:"Vehicle Tracking OH", gb:calc.vehicleTrackingOverhead, fill:"#3b82f6"}] : []),
    ] : []),
  ];
  const modelUcMap = MODEL_GROUPS.reduce((acc,m) => {
    acc[m.id] = ALL_USE_CASES.filter(uc => uc.model === m.id && enabledUcs[uc.n]);
    return acc;
  }, {});

  const CT = ({active,payload,labelKey="label",valFn=v=>v}) => active && payload?.length ? (
    <div className="custom-tooltip">
      <div className="ct-label">{payload[0].payload[labelKey] ?? payload[0].name}</div>
      <div className="ct-value">{valFn(payload[0].value)}</div>
    </div>
  ) : null;

  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      :root{
        --bg:#070b12;--panel:#0d1420;--panel2:#111827;
        --border:#1e2d3d;--border2:#253347;
        --text:#e2e8f0;--muted:#64748b;
        --accent:#00d4aa;--accent2:#3b82f6;
        --warn:#f59e0b;--danger:#ef4444;
        --mono:'Space Mono',monospace;--sans:'DM Sans',sans-serif;
      }
      body{background:var(--bg);color:var(--text);font-family:var(--sans);}
      .app{min-height:100vh;display:grid;grid-template-rows:auto 1fr;background:var(--bg);}

      .header{padding:14px 26px;border-bottom:1px solid var(--border);background:var(--panel);
        display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
      .header-left{display:flex;align-items:center;gap:12px;}
      .header-badge{background:linear-gradient(135deg,#00d4aa22,#3b82f622);border:1px solid #00d4aa44;
        color:var(--accent);font-family:var(--mono);font-size:9px;padding:3px 8px;
        border-radius:4px;letter-spacing:1px;text-transform:uppercase;}
      .header-title{font-size:17px;font-weight:700;color:#f1f5f9;}
      .header-sub{font-size:10px;color:var(--muted);margin-top:1px;}
      .header-right{display:flex;align-items:center;gap:10px;}
      .deploy-toggle{display:flex;background:var(--panel2);border:1px solid var(--border);border-radius:8px;overflow:hidden;}
      .deploy-btn{padding:6px 14px;font-size:11px;font-family:var(--mono);cursor:pointer;border:none;background:none;color:var(--muted);transition:all .2s;}
      .deploy-btn.active{background:var(--accent2);color:#fff;}
      .ftgl-btn{display:flex;align-items:center;gap:5px;padding:5px 12px;background:var(--panel);
        border:1px solid var(--border2);border-radius:6px;color:var(--muted);font-size:10px;
        font-family:var(--mono);cursor:pointer;transition:all .2s;}
      .ftgl-btn:hover,.ftgl-btn.active{border-color:var(--accent2);color:var(--accent2);background:#3b82f610;}

      .body{display:grid;grid-template-columns:365px 1fr;height:calc(100vh - 62px);overflow:hidden;}

      .left-panel{border-right:1px solid var(--border);overflow-y:auto;background:var(--panel);}
      .left-panel::-webkit-scrollbar{width:3px;}
      .left-panel::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
      .input-section{border-bottom:1px solid var(--border);padding:14px 16px;}
      .input-section:last-child{border-bottom:none;}
      .section-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
      .section-icon{font-size:13px;}
      .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--accent);}
      .section-subtitle{font-size:9px;color:var(--muted);margin-top:1px;}

      .slider-wrap{margin-bottom:11px;}
      .slider-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}
      .slider-label{font-size:11px;color:#94a3b8;}
      .slider-val{font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700;}
      .slider{width:100%;height:3px;-webkit-appearance:none;appearance:none;background:var(--border2);border-radius:2px;outline:none;cursor:pointer;}
      .slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--accent);cursor:pointer;border:2px solid var(--bg);box-shadow:0 0 6px #00d4aa66;}
      .slider-minmax{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:2px;}

      .num-input{flex:1;background:var(--panel2);border:1px solid var(--border2);color:var(--text);
        padding:5px 7px;border-radius:5px;font-family:var(--mono);font-size:11px;outline:none;transition:border .2s;}
      .num-input:focus{border-color:var(--accent);}

      .price-block{margin-bottom:10px;}
      .price-block-label{font-size:10px;color:#94a3b8;margin-bottom:4px;}
      .price-range-row{display:grid;grid-template-columns:1fr auto 1fr;gap:4px;align-items:center;}
      .price-range-sep{font-size:11px;color:var(--muted);text-align:center;}

      .gpu-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px;}
      .gpu-btn{border:1px solid var(--border2);background:var(--panel2);color:var(--muted);
        padding:6px 5px;border-radius:7px;cursor:pointer;text-align:center;
        font-family:var(--mono);font-size:9px;transition:all .2s;}
      .gpu-btn:hover{border-color:var(--accent2);color:var(--text);}
      .gpu-btn.selected{border-color:var(--accent);background:#00d4aa15;color:var(--accent);font-weight:700;}
      .gpu-btn .gpu-vram{font-size:8px;color:var(--muted);margin-top:2px;}
      .gpu-btn.selected .gpu-vram{color:#00d4aa88;}

      .mct{width:100%;border-collapse:collapse;font-size:10px;}
      .mct th{font-family:var(--mono);font-size:9px;color:var(--muted);text-align:left;padding:3px 4px;border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:.4px;}
      .mct td{padding:4px 4px;vertical-align:middle;}
      .mct tr:nth-child(even) td{background:#ffffff03;}
      .fps-inline{background:var(--panel2);border:1px solid var(--border2);color:var(--accent);font-family:var(--mono);font-size:10px;padding:2px 4px;border-radius:3px;width:42px;outline:none;text-align:center;}
      .fps-inline:focus{border-color:var(--accent);}
      .res-select{background:var(--panel2);border:1px solid var(--border2);color:#94a3b8;font-family:var(--mono);font-size:9px;padding:2px 3px;border-radius:3px;outline:none;cursor:pointer;width:96px;}
      .res-select:focus{border-color:var(--accent);}
      .model-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px;}

      .uc-expand-btn{display:flex;align-items:center;justify-content:space-between;width:100%;background:var(--panel2);border:1px solid var(--border2);color:#94a3b8;font-size:10px;padding:6px 10px;border-radius:5px;cursor:pointer;margin-bottom:7px;font-family:var(--sans);transition:all .2s;}
      .uc-expand-btn:hover{border-color:var(--accent);color:var(--accent);}
      .uc-quick-btn{background:var(--panel2);border:1px solid var(--border2);color:#94a3b8;font-size:9px;padding:3px 9px;border-radius:4px;cursor:pointer;font-family:var(--mono);transition:all .2s;}
      .uc-quick-btn:hover{border-color:var(--accent);color:var(--accent);}
      .uc-table{width:100%;border-collapse:collapse;font-size:10px;}
      .uc-table th{font-family:var(--mono);font-size:8px;color:var(--muted);padding:3px 4px;border-bottom:1px solid var(--border);text-transform:uppercase;}
      .uc-table td{padding:3px 4px;vertical-align:middle;border-bottom:1px solid #1e2d3d44;}
      .uc-num{font-family:var(--mono);font-size:8px;font-weight:700;color:var(--accent);background:#00d4aa15;border:1px solid #00d4aa33;border-radius:3px;padding:1px 3px;min-width:18px;text-align:center;display:inline-block;}
      .uc-cam-input{background:var(--panel2);border:1px solid var(--border2);color:var(--text);font-family:var(--mono);font-size:10px;padding:2px 4px;border-radius:3px;width:50px;outline:none;text-align:center;}
      .uc-cam-input:focus{border-color:var(--accent);}

      .storage-toggle-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
      .toggle-track{position:absolute;inset:0;background:var(--border2);border-radius:20px;transition:background .2s;}
      .toggle-track.on{background:var(--accent);}
      .toggle-thumb{position:absolute;top:3px;left:3px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .2s;}
      .toggle-thumb.on{transform:translateX(18px);}

      .right-panel{overflow-y:auto;background:var(--bg);}
      .right-panel::-webkit-scrollbar{width:3px;}
      .right-panel::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}

      .tabs{display:flex;border-bottom:1px solid var(--border);background:var(--panel);padding:0 20px;position:sticky;top:0;z-index:10;overflow-x:auto;}
      .tabs::-webkit-scrollbar{display:none;}
      .tab{padding:12px 15px;font-size:11px;font-weight:600;cursor:pointer;color:var(--muted);border:none;background:none;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap;font-family:var(--sans);}
      .tab:hover{color:var(--text);}
      .tab.active{color:var(--accent);border-bottom-color:var(--accent);}

      .content{padding:20px;}

      .metric-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(162px,1fr));gap:9px;margin-bottom:18px;}
      .metric-card{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:13px;transition:border .2s;}
      .metric-card:hover{border-color:var(--border2);}
      .metric-card.metric-accent{border-color:#00d4aa33;background:#00d4aa08;}
      .metric-card.metric-warn{border-color:#f59e0b33;background:#f59e0b08;}
      .metric-card.metric-range{border-color:#3b82f633;background:#3b82f608;}
      .metric-label{font-size:9px;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px;}
      .metric-value{font-family:var(--mono);font-size:20px;font-weight:700;color:#f1f5f9;line-height:1;}
      .metric-unit{font-size:10px;font-weight:400;color:var(--muted);}
      .metric-sub{font-size:9px;color:var(--muted);margin-top:5px;line-height:1.3;}

      .formula-section{margin-bottom:18px;}
      .formula-section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--accent2);margin-bottom:9px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;}
      .formula-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;}
      .formula-box{background:var(--panel);border:1px solid var(--border);border-left:3px solid var(--accent2);border-radius:0 7px 7px 0;padding:10px 12px;}
      .formula-label{font-size:9px;color:var(--muted);margin-bottom:3px;}
      .formula-expr{font-family:var(--mono);font-size:9px;color:#94a3b8;margin-bottom:5px;word-break:break-all;line-height:1.4;}
      .formula-result{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent);}

      .chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;}
      .chart-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;}
      .chart-title{font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px;}
      .chart-full{grid-column:1/-1;}

      .model-table{width:100%;border-collapse:collapse;font-size:10px;}
      .model-table th{font-family:var(--mono);font-size:8px;color:var(--muted);padding:6px 9px;text-align:left;background:var(--panel2);text-transform:uppercase;letter-spacing:.4px;}
      .model-table td{padding:8px 9px;border-bottom:1px solid var(--border);}
      .model-table tr:hover td{background:#ffffff04;}
      .badge{font-size:8px;font-family:var(--mono);padding:1px 5px;border-radius:3px;border:1px solid;display:inline-block;margin-right:2px;}

      .cost-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);}
      .cost-row:last-child{border-bottom:none;}
      .cost-row-label{font-size:11px;color:#94a3b8;}
      .cost-total{background:var(--panel2);border-radius:9px;padding:13px 16px;margin-top:12px;}
      .cost-total-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;}
      .cost-total-val{font-family:var(--mono);font-size:22px;font-weight:700;color:var(--accent);margin-top:3px;}
      .cost-total-range{font-family:var(--mono);font-size:11px;color:#94a3b8;margin-top:2px;}

      .alert{display:flex;gap:8px;padding:9px 13px;border-radius:7px;margin-bottom:14px;font-size:10px;line-height:1.5;}
      .alert-warn{background:#f59e0b15;border:1px solid #f59e0b44;color:#fbbf24;}
      .alert-ok{background:#00d4aa15;border:1px solid #00d4aa44;color:var(--accent);}
      .alert-info{background:#3b82f615;border:1px solid #3b82f644;color:#60a5fa;}
      .alert-icon{font-size:13px;flex-shrink:0;}

      .vram-bar-track{height:20px;background:var(--panel2);border-radius:5px;overflow:hidden;display:flex;margin-bottom:8px;}
      .vram-bar-seg{height:100%;transition:width .4s;}
      .vram-legend{display:flex;flex-wrap:wrap;gap:6px;}
      .vram-legend-item{display:flex;align-items:center;gap:4px;font-size:9px;color:var(--muted);}
      .vram-legend-dot{width:6px;height:6px;border-radius:2px;flex-shrink:0;}

      .custom-tooltip{background:var(--panel2);border:1px solid var(--border2);border-radius:7px;padding:7px 11px;font-size:10px;}
      .ct-label{color:var(--muted);margin-bottom:2px;font-size:9px;text-transform:uppercase;}
      .ct-value{font-family:var(--mono);color:var(--accent);font-weight:700;font-size:12px;}

      .divider{height:1px;background:var(--border);margin:16px 0;}
      .hint-box{margin-top:6px;padding:5px 8px;background:#3b82f608;border:1px solid #3b82f622;border-radius:4px;font-size:9px;color:#64748b;}

      .pipeline-badge{display:inline-flex;align-items:center;gap:3px;font-size:8px;font-family:var(--mono);padding:2px 6px;border-radius:3px;border:1px solid;white-space:nowrap;}
      .pipeline-detection{color:#00d4aa;border-color:#00d4aa44;background:#00d4aa10;}
      .pipeline-tracking{color:#3b82f6;border-color:#3b82f644;background:#3b82f610;}
      .pipeline-reid{color:#f59e0b;border-color:#f59e0b44;background:#f59e0b10;}

      .complexity-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;}
      .complexity-card{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:14px;text-align:center;}
      .complexity-count{font-family:var(--mono);font-size:28px;font-weight:700;line-height:1;margin-bottom:4px;}
      .complexity-icon{font-size:20px;margin-bottom:6px;}

      @media(max-width:900px){
        .body{grid-template-columns:1fr;grid-template-rows:auto 1fr;}
        .left-panel{height:380px;border-right:none;border-bottom:1px solid var(--border);}
        .chart-grid{grid-template-columns:1fr;}
        .complexity-grid{grid-template-columns:1fr;}
      }
    `}</style>

    <div className="app">
      {/* HEADER */}
      <div className="header">
        <div className="header-left">
          <div className="header-badge">INFRA CALC v4.1</div>
          <div>
            <div className="header-title">AI Video Analytics Infrastructure Calculator</div>
            <div className="header-sub">Factory Safety · 17 Use Cases · 7 Model Groups · Per-Model GPU Calc · Vehicle Tracking Penalty · Cost in Lacs/Crores</div>
          </div>
        </div>
        <div className="header-right">
          <button className={`ftgl-btn${showFormulas?" active":""}`} onClick={() => setShowFormulas(s=>!s)}>
            <span>⟨/⟩</span> {showFormulas?"Hide":"Show"} Formulas
          </button>
          <div className="deploy-toggle">
            <button className={`deploy-btn${!isCloud?" active":""}`} onClick={()=>setIsCloud(false)}>🏭 On-Premise</button>
            <button className={`deploy-btn${isCloud?" active":""}`}  onClick={()=>setIsCloud(true)}>☁️ Cloud</button>
          </div>
        </div>
      </div>

      <div className="body">
        {/* ══ LEFT PANEL ══ */}
        <div className="left-panel">

          <div className="input-section">
            <SectionHeader icon="📷" title="Camera Setup" subtitle="Total cameras for network / storage calculation" />
            <SliderInput label="Total Cameras" value={cameras} min={10} max={1000} step={10} onChange={setCameras} />
            <SliderInput label="Bitrate per Camera" value={bitratePerCam} min={1} max={25} onChange={setBitratePerCam} unit=" Mbps" />
          </div>

          <div className="input-section">
            <SectionHeader icon="⚡" title="GPU Type" subtitle="NVIDIA inference hardware" />
            <div className="gpu-grid">
              {Object.entries(GPU_SPECS).map(([k,v]) => (
                <button key={k} className={`gpu-btn${gpuType===k?" selected":""}`}
                  onClick={()=>{ setGpuType(k); setGpuPriceLow(v.price); setGpuPriceHigh(v.priceHigh); }}>
                  {v.name}
                  <div className="gpu-vram">{v.vram}GB · {v.streams} streams</div>
                </button>
              ))}
            </div>
          </div>

          <div className="input-section">
            <SectionHeader icon="🎯" title="Model Config" subtitle="Resolution affects VRAM + GPU stream capacity" />
            <table className="mct">
              <thead><tr><th>Model</th><th>Resolution</th><th>FPS</th></tr></thead>
              <tbody>
                {MODEL_GROUPS.map(m => (
                  <tr key={m.id}>
                    <td style={{color:"#e2e8f0"}}>
                      <span className="model-dot" style={{background:m.color}} />{m.name}
                    </td>
                    <td>
                      <select className="res-select" value={modelResIdx[m.id]}
                        onChange={e => setModelResIdx(p=>({...p,[m.id]:Number(e.target.value)}))}>
                        {RES_PRESETS.map((r,i) => <option key={i} value={i}>{r.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="1" max="30" value={modelFps[m.id]}
                        onChange={e=>setModelFps(p=>({...p,[m.id]:Math.max(1,Number(e.target.value))}))}
                        className="fps-inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="hint-box">💡 All active models load onto each GPU simultaneously. GPU count = max cameras ÷ cameras-per-GPU.</div>
          </div>

          {/* Use Case Selector */}
          <div className="input-section">
            <SectionHeader icon="✅" title="Active Use Cases" subtitle="Select which to include in calculations" />
            <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
              <button className="uc-quick-btn" onClick={enableAllUcs}>All On</button>
              <button className="uc-quick-btn" onClick={disableAllUcs}>All Off</button>
              <span style={{fontSize:9,color:"var(--muted)",alignSelf:"center",marginLeft:2}}>
                {Object.values(enabledUcs).filter(Boolean).length} / {ALL_USE_CASES.length} active
              </span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {MODEL_GROUPS.map(m => {
                const mUcs = ALL_USE_CASES.filter(uc => uc.model === m.id);
                const allOn  = mUcs.every(uc => enabledUcs[uc.n]);
                const someOn = mUcs.some(uc => enabledUcs[uc.n]);
                return (
                  <div key={m.id} style={{border:`1px solid ${allOn?m.color+"55":"#1e2d3d"}`,
                    borderLeft:`3px solid ${allOn?m.color:"#253347"}`,
                    borderRadius:"0 6px 6px 0",background:allOn?`${m.color}08`:"transparent",
                    padding:"7px 9px",transition:"all 0.2s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:someOn?5:0,cursor:"pointer"}}
                      onClick={()=>toggleModelUcs(m.id)}>
                      <div style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${m.color}`,
                        background:allOn?m.color:someOn?m.color+"55":"transparent",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
                        {allOn && <span style={{color:"#000",fontSize:9,fontWeight:900,lineHeight:1}}>✓</span>}
                        {!allOn && someOn && <span style={{color:m.color,fontSize:9,fontWeight:900,lineHeight:1}}>–</span>}
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:allOn?m.color:"#64748b",
                        fontFamily:"var(--mono)",textTransform:"uppercase",letterSpacing:"0.5px"}}>
                        {m.name}
                      </span>
                      <span style={{marginLeft:"auto",fontSize:9,color:"#475569",fontFamily:"var(--mono)"}}>
                        {mUcs.filter(uc=>enabledUcs[uc.n]).length}/{mUcs.length}
                      </span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:2,paddingLeft:4}}>
                      {mUcs.map(uc => {
                        const isVehicleUc = VEHICLE_UC_IDS.has(uc.n);
                        const pType = isVehicleUc ? ucPipelineOverride[uc.n] : PIPELINE.DETECTION;
                        const pInfo = PIPELINE_LABELS[pType];
                        return (
                          <label key={uc.n} style={{display:"flex",alignItems:"flex-start",gap:6,cursor:"pointer",
                            opacity:enabledUcs[uc.n]?1:0.45,transition:"opacity 0.15s"}}>
                            <div style={{marginTop:1,width:12,height:12,borderRadius:2,flexShrink:0,
                              border:`1.5px solid ${enabledUcs[uc.n]?m.color:"#253347"}`,
                              background:enabledUcs[uc.n]?m.color:"transparent",
                              display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}
                              onClick={()=>toggleUc(uc.n)}>
                              {enabledUcs[uc.n] && <span style={{color:"#000",fontSize:8,fontWeight:900,lineHeight:1}}>✓</span>}
                            </div>
                            <span style={{fontSize:9,color:enabledUcs[uc.n]?"#94a3b8":"#475569",lineHeight:1.4,flex:1}}>
                              <span style={{fontFamily:"var(--mono)",fontSize:8,color:enabledUcs[uc.n]?m.color:"#475569",marginRight:4}}>#{uc.n}</span>
                              {uc.label}
                              {isVehicleUc && <span style={{marginLeft:4,fontFamily:"var(--mono)",fontSize:7,color:pInfo.color,background:`${pInfo.color}15`,border:`1px solid ${pInfo.color}33`,borderRadius:2,padding:"0 3px"}}>{pInfo.icon}</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:2}}>
              {calc.activeModels.length === 0 && (
                <div style={{fontSize:10,color:"#ef4444",padding:"6px 8px",background:"#ef444415",border:"1px solid #ef444433",borderRadius:5}}>
                  ⚠️ No use cases selected. Enable at least one.
                </div>
              )}
              {calc.activeModels.map(m => (
                <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  fontSize:9,padding:"3px 7px",background:`${m.color}0a`,
                  borderLeft:`2px solid ${m.color}`,borderRadius:"0 4px 4px 0"}}>
                  <span style={{color:m.color}}>{m.name}</span>
                  <span style={{fontFamily:"var(--mono)",color:"#94a3b8"}}>{calc.modelCameras[m.id]} cams</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-UC Camera Counts */}
          <div className="input-section">
            <SectionHeader icon="📊" title="Cameras per Use Case" subtitle="GPU load = max cameras across each model's active UCs" />
            <button className="uc-expand-btn" onClick={()=>setShowUcCameras(s=>!s)}>
              <span>Configure per-use-case cameras {showUcCameras?"▲":"▼"}</span>
              <span style={{fontSize:9,color:"var(--muted)"}}>Only active UCs shown</span>
            </button>
            {showUcCameras && (
              <table className="uc-table">
                <thead><tr><th>#</th><th>Use Case</th><th>Group</th><th>Cams</th></tr></thead>
                <tbody>
                  {ALL_USE_CASES.filter(uc => enabledUcs[uc.n]).map(uc => {
                    const m = MODEL_GROUPS.find(g=>g.id===uc.model);
                    return (
                      <tr key={uc.n}>
                        <td><span className="uc-num" style={{background:`${m?.color}20`,borderColor:`${m?.color}44`,color:m?.color}}>#{uc.n}</span></td>
                        <td style={{color:"#94a3b8",fontSize:9,lineHeight:1.3}}>{uc.label}</td>
                        <td><span style={{fontFamily:"var(--mono)",fontSize:8,color:m?.color,background:`${m?.color}20`,border:`1px solid ${m?.color}44`,borderRadius:3,padding:"1px 4px"}}>{m?.name.split(" ")[0]}</span></td>
                        <td>
                          <input type="number" min="0" max="1000" value={ucCameras[uc.n]??0}
                            onChange={e=>setUcCameras(p=>({...p,[uc.n]:Number(e.target.value)}))}
                            className="uc-cam-input" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Storage */}
          <div className="input-section">
            <SectionHeader icon="💾" title="Storage & Retention" />
            <div className="storage-toggle-row">
              <span style={{fontSize:11,color:"#94a3b8"}}>Enable storage calculation</span>
              <div style={{position:"relative",width:38,height:20,cursor:"pointer"}} onClick={()=>setStorageEnabled(s=>!s)}>
                <div className={`toggle-track${storageEnabled?" on":""}`} />
                <div className={`toggle-thumb${storageEnabled?" on":""}`} />
              </div>
            </div>
            {!storageEnabled && (
              <div style={{fontSize:9,color:"#475569",padding:"5px 8px",background:"#1e2d3d33",borderRadius:4,border:"1px solid #253347",marginBottom:8}}>
                📦 Default: 1 TB storage assumed. Enable to calculate based on cameras × bitrate × retention.
              </div>
            )}
            {storageEnabled && (<>
              <SliderInput label="Retention Period" value={retentionDays} min={0} max={365} onChange={setRetentionDays} unit=" days" />
              <SliderInput label="Redundancy Factor" value={redundancyFactor} min={1.0} max={2.0} step={0.05}
                onChange={setRedundancyFactor} format={v=>v.toFixed(2)} unit="×" />
            </>)}
            <SliderInput label="GPUs per Server" value={gpusPerServer} min={1} max={16} onChange={setGpusPerServer} />
          </div>

          {/* Pricing */}
          <div className="input-section">
            <SectionHeader icon="💰" title="Pricing — Low / High Range (USD)" subtitle="Output shown in Lacs/Crores" />
            <div className="price-block">
              <div className="price-block-label">GPU Unit Price (USD)</div>
              <div className="price-range-row">
                <input type="number" value={gpuPriceLow}  min={0} step={100} className="num-input" placeholder="Low"  onChange={e=>setGpuPriceLow(Number(e.target.value))} />
                <span className="price-range-sep">–</span>
                <input type="number" value={gpuPriceHigh} min={0} step={100} className="num-input" placeholder="High" onChange={e=>setGpuPriceHigh(Number(e.target.value))} />
              </div>
            </div>
            <div className="price-block">
              <div className="price-block-label">Server Cost (USD)</div>
              <div className="price-range-row">
                <input type="number" value={serverPriceLow}  min={0} step={500} className="num-input" placeholder="Low"  onChange={e=>setServerPriceLow(Number(e.target.value))} />
                <span className="price-range-sep">–</span>
                <input type="number" value={serverPriceHigh} min={0} step={500} className="num-input" placeholder="High" onChange={e=>setServerPriceHigh(Number(e.target.value))} />
              </div>
            </div>
            <div className="price-block">
              <div className="price-block-label">Storage per PB (USD)</div>
              <div className="price-range-row">
                <input type="number" value={storagePriceLow}  min={0} step={5000} className="num-input" placeholder="Low"  onChange={e=>setStoragePriceLow(Number(e.target.value))} />
                <span className="price-range-sep">–</span>
                <input type="number" value={storagePriceHigh} min={0} step={5000} className="num-input" placeholder="High" onChange={e=>setStoragePriceHigh(Number(e.target.value))} />
              </div>
            </div>
            {isCloud && (
              <div className="price-block">
                <div className="price-block-label">Cloud GPU $/hour</div>
                <div className="price-range-row">
                  <input type="number" value={cloudPriceLow}  min={0} step={0.05} className="num-input" placeholder="Low"  onChange={e=>setCloudPriceLow(Number(e.target.value))} />
                  <span className="price-range-sep">–</span>
                  <input type="number" value={cloudPriceHigh} min={0} step={0.05} className="num-input" placeholder="High" onChange={e=>setCloudPriceHigh(Number(e.target.value))} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="right-panel">
          <div className="tabs">
            {[{id:"summary",label:"📊 Summary"},{id:"network",label:"🌐 Network"},
              {id:"compute",label:"⚡ Compute"},{id:"storage",label:"💾 Storage"},
              {id:"cost",label:"💰 Cost"},{id:"models",label:"🎯 Models"},
              {id:"pipeline",label:"🔄 Pipeline"}]
            .map(t=>(
              <button key={t.id} className={`tab${activeTab===t.id?" active":""}`} onClick={()=>setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="content">

            {/* ══════ SUMMARY ══════ */}
            {activeTab==="summary" && (<>
              <div className="metric-grid">
                <MetricCard label="Total GPUs" value={calc.gpusWithRedundancy} unit="units"
                  sub={`${calc.effectiveTotalCams} cams ÷ ${calc.camerasPerGpu} cams/GPU`} accent />
                <MetricCard label="GPU Servers" value={calc.serversNeeded} unit="servers"
                  sub={`${gpusPerServer} GPUs/server`} accent />
                <MetricCard label="Network BW" value={calc.bufferedGbps.toFixed(2)} unit="Gbps"
                  sub={`${calc.totalBandwidthGbps.toFixed(2)} raw + 20% buffer`} />
                <MetricCard label="Storage" value={storageEnabled ? calc.pbWithRedundancy.toFixed(2) : "1.00"} unit="TB"
                  sub={storageEnabled ? `${retentionDays}d × ${redundancyFactor}× redundancy` : "Default 1 TB — enable for full calc"} warn={storageEnabled} />
                <MetricCard label="VRAM Used" value={calc.totalMemNeeded.toFixed(1)} unit={`/ ${gpu.vram} GB`}
                  sub={`${calc.memRemaining.toFixed(1)} GB headroom`}
                  accent={calc.memFitsInGpu} warn={!calc.memFitsInGpu} />
                <MetricCard label="Total FPS Load" value={calc.totalFpsLoad.toLocaleString()} unit="fps"
                  sub="per-UC cameras × per-model fps" />
                <MetricCard label="Cameras / GPU" value={calc.camerasPerGpu} unit="cams"
                  sub={`streams ÷ Σ(model reductions)`} />
                <RangeCard label="Total CAPEX" low={fmtLacs(calc.totalCapexLow)} high={fmtLacs(calc.totalCapexHigh)}
                  sub="GPU + Servers + Storage" />
              </div>

              {calc.vehicleHasTracking && (
                <div className="alert alert-info">
                  <span className="alert-icon">🎯</span>
                  <span>Vehicle tracking pipeline active: <strong>×{calc.vehicleMultiplier}</strong> ({PIPELINE_LABELS[calc.dominantType].label}).
                    This increases the GPU compute reduction for Vehicle Master, reducing cameras/GPU for that model group.</span>
                </div>
              )}

              {!calc.memFitsInGpu ? (
                <div className="alert alert-warn">
                  <span className="alert-icon">⚠️</span>
                  <span>VRAM Warning: {calc.activeModels.length} active models require {calc.totalMemNeeded.toFixed(1)} GB but {gpu.name} has {gpu.vram} GB.
                    Lower resolution or upgrade to NVIDIA H20 (96 GB).</span>
                </div>
              ) : calc.activeModels.length === 0 ? (
                <div className="alert alert-warn">
                  <span className="alert-icon">⚠️</span>
                  <span>No use cases selected. Enable at least one use case in the left panel.</span>
                </div>
              ) : (
                <div className="alert alert-ok">
                  <span className="alert-icon">✅</span>
                  <span>{calc.activeModels.length} model group{calc.activeModels.length!==1?"s":""} · {calc.activeUcs.length} use case{calc.activeUcs.length!==1?"s":""} · {calc.totalMemNeeded.toFixed(1)} GB VRAM fits in {gpu.name}'s {gpu.vram} GB with {calc.memRemaining.toFixed(1)} GB headroom.</span>
                </div>
              )}

              <div className="chart-grid">
                <div className="chart-card">
                  <div className="chart-title">Camera → GPU Mapping</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={camGpuData} margin={{top:5,right:10,left:-15,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                      <XAxis dataKey="label" tick={{fontSize:9,fill:"#64748b"}} />
                      <YAxis tick={{fontSize:9,fill:"#64748b"}} />
                      <Tooltip content={<CT labelKey="label" valFn={v=>v} />} />
                      <Bar dataKey="value" radius={[4,4,0,0]}>
                        {camGpuData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="chart-title">Cost Breakdown (Low Est.)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={costPieLow} cx="50%" cy="50%" innerRadius={46} outerRadius={76} dataKey="value" paddingAngle={3}>
                        {costPieLow.map((d,i)=><Cell key={i} fill={d.color}/>)}
                      </Pie>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(
                        <div className="custom-tooltip"><div className="ct-label">{payload[0].name}</div><div className="ct-value">{fmtLacs(payload[0].value)}</div></div>
                      ):null} />
                      <Legend formatter={v=><span style={{fontSize:9,color:"#94a3b8"}}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card chart-full">
                  <div className="chart-title">FPS Load per Model Group</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={fpsChartData} margin={{top:5,right:10,left:-10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                      <XAxis dataKey="name" tick={{fontSize:9,fill:"#64748b"}} />
                      <YAxis tick={{fontSize:9,fill:"#64748b"}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={({active,payload})=>active&&payload?.length?(
                        <div className="custom-tooltip"><div className="ct-label">{payload[0].payload.name}</div><div className="ct-value">{payload[0].value.toLocaleString()} fps</div></div>
                      ):null} />
                      <Bar dataKey="fps" radius={[4,4,0,0]}>
                        {fpsChartData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>)}

            {/* ══════ NETWORK ══════ */}
            {activeTab==="network" && (<>
              <div className="metric-grid">
                <MetricCard label="Raw Bandwidth" value={calc.totalBandwidthMbps.toLocaleString()} unit="Mbps" sub={`${cameras} cams × ${bitratePerCam} Mbps`} />
                <MetricCard label="In Gbps" value={calc.totalBandwidthGbps.toFixed(2)} unit="Gbps" sub="÷ 1000" />
                <MetricCard label="With 20% Buffer" value={calc.bufferedGbps.toFixed(2)} unit="Gbps" sub="RTSP control + bursts" accent />
                <MetricCard label="Backbone Needed" value={calc.bufferedGbps>10?"25GbE+":"10GbE"} unit="" sub={`${calc.bufferedGbps.toFixed(2)} Gbps load`} warn={calc.bufferedGbps>10} />
              </div>
              {showFormulas && (
                <div className="formula-section">
                  <div className="formula-section-title">⟨/⟩ Network Formulas</div>
                  <div className="formula-grid">
                    <FormulaBox label="Total Raw Bandwidth" formula={`${cameras} × ${bitratePerCam} Mbps`} result={`${calc.totalBandwidthMbps.toLocaleString()} Mbps`} />
                    <FormulaBox label="Convert to Gbps" formula={`${calc.totalBandwidthMbps} / 1000`} result={`${calc.totalBandwidthGbps.toFixed(3)} Gbps`} />
                    <FormulaBox label="Add 20% RTSP Buffer" formula={`${calc.totalBandwidthGbps.toFixed(3)} × 1.20`} result={`${calc.bufferedGbps.toFixed(3)} Gbps`} />
                  </div>
                </div>
              )}
              <div className="chart-card">
                <div className="chart-title">Bandwidth Scaling by Camera Count</div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={[50,100,150,200,250,320,400,500].map(c=>({cameras:c,gbps:parseFloat((c*bitratePerCam/1000*1.2).toFixed(2))}))} margin={{top:10,right:20,left:0,bottom:5}}>
                    <defs><linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                    <XAxis dataKey="cameras" tick={{fontSize:9,fill:"#64748b"}} />
                    <YAxis tick={{fontSize:9,fill:"#64748b"}} />
                    <Tooltip content={({active,payload})=>active&&payload?.length?(<div className="custom-tooltip"><div className="ct-label">{payload[0].payload.cameras} cameras</div><div className="ct-value">{payload[0].value} Gbps</div></div>):null} />
                    <Area type="monotone" dataKey="gbps" stroke="#3b82f6" fill="url(#bwGrad)" strokeWidth={2} dot={{r:3,fill:"#3b82f6"}} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>)}

            {/* ══════ COMPUTE ══════ */}
            {activeTab==="compute" && (<>
              <div className="metric-grid">
                <MetricCard label="GPU Model" value={gpu.name} unit="" sub={`${gpu.vram}GB VRAM`} />
                <MetricCard label="Streams/GPU" value={gpu.streams} unit="streams" sub="DeepStream benchmark @ 640×640" />
                <MetricCard label="GPU IPS Capacity" value={calc.gpuIps} unit="IPS"
                  sub={`${gpu.name} at 640×640 baseline`} />
                <MetricCard label="IPS Demand/Camera" value={calc.totalIpsDemandPerCamera.toFixed(1)} unit="IPS/cam"
                  sub="sum of all active model demands" />
                <MetricCard label="Cameras / GPU" value={calc.camerasPerGpu} unit="cams"
                  sub={`floor(${calc.gpuIps} IPS / ${calc.totalIpsDemandPerCamera.toFixed(1)})`} accent />
                <MetricCard label="Bottleneck Cameras" value={calc.effectiveTotalCams} unit=""
                  sub="max cameras across active models" />
                <MetricCard label="GPUs Required" value={calc.gpusWithRedundancy} unit="GPUs"
                  sub={`ceil(${calc.effectiveTotalCams} / ${calc.camerasPerGpu})`} accent />
                <MetricCard label="Servers" value={calc.serversNeeded} unit="servers" sub={`${gpusPerServer} GPUs each`} />
                <MetricCard label="Vehicle Penalty" value={calc.vehicleHasTracking ? `×${calc.vehicleMultiplier}` : "None"} unit=""
                  sub={calc.vehicleHasTracking ? PIPELINE_LABELS[calc.dominantType].label : "detection only"} warn={calc.vehicleHasTracking} />
              </div>

              {showFormulas && (
                <div className="formula-section">
                  <div className="formula-section-title">⟨/⟩ GPU Calculation — Throughput (IPS) Model</div>
                  <div className="formula-grid">
                    {calc.activeModels.map(m => {
                      const p = RES_PRESETS[modelResIdx[m.id]];
                      const pipelineMult = m.id === "vehicle" ? calc.vehicleMultiplier : 1.0;
                      const ipsDemand = (calc.modelIpsDemand[m.id] || 0).toFixed(1);
                      return (
                        <FormulaBox key={m.id}
                          label={`${m.name} IPS demand/cam${m.id==="vehicle"&&calc.vehicleHasTracking?" (tracking ×"+calc.vehicleMultiplier+")":""}`}
                          formula={`${modelFps[m.id]}fps × (${p.w}/640)² × ${pipelineMult} = ${modelFps[m.id]} × ${(p.w/640*p.w/640).toFixed(2)} × ${pipelineMult}`}
                          result={`${ipsDemand} IPS/cam`} />
                      );
                    })}
                    <FormulaBox label="Total IPS demand per camera (Σ all models)"
                      formula={`${calc.activeModels.map(m => (calc.modelIpsDemand[m.id]||0).toFixed(1)).join(" + ")}`}
                      result={`${calc.totalIpsDemandPerCamera.toFixed(1)} IPS/camera`} />
                    <FormulaBox label="Cameras per GPU"
                      formula={`floor(${calc.gpuIps} GPU_IPS / ${calc.totalIpsDemandPerCamera.toFixed(1)} demand/cam)`}
                      result={`${calc.camerasPerGpu} cameras/GPU`} />
                    <FormulaBox label="GPUs required"
                      formula={`ceil(${calc.effectiveTotalCams} bottleneck_cams / ${calc.camerasPerGpu})`}
                      result={`${calc.gpusWithRedundancy} GPUs`} />
                  </div>
                </div>
              )}

              <div className="divider" />
              <div>
                <div className="chart-title" style={{marginBottom:8}}>
                  VRAM Allocation — {calc.totalMemNeeded.toFixed(1)} GB / {gpu.vram} GB
                  {calc.vehicleTrackingOverhead > 0 && <span style={{marginLeft:6,fontSize:9,color:"#3b82f6"}}>(+{calc.vehicleTrackingOverhead}GB tracking overhead)</span>}
                </div>
                <div className="vram-bar-track">
                  {vramBreakdown.map((seg,i)=>(
                    <div key={i} className="vram-bar-seg" style={{width:`${(seg.gb/gpu.vram)*100}%`,background:seg.fill}} />
                  ))}
                </div>
                <div className="vram-legend">
                  {vramBreakdown.map((seg,i)=>(
                    <div key={i} className="vram-legend-item">
                      <div className="vram-legend-dot" style={{background:seg.fill}} />
                      {seg.name}: {seg.gb.toFixed(2)} GB
                    </div>
                  ))}
                  <div className="vram-legend-item">
                    <div className="vram-legend-dot" style={{background:"#1e2d3d"}} />
                    Headroom: {Math.max(0,calc.memRemaining).toFixed(1)} GB
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div className="chart-card">
                <div className="chart-title">VRAM per Model (resolution-scaled)</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={vramBreakdown} layout="vertical" margin={{top:5,right:30,left:100,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" horizontal={false} />
                    <XAxis type="number" tick={{fontSize:9,fill:"#64748b"}} unit=" GB" />
                    <YAxis dataKey="name" type="category" tick={{fontSize:9,fill:"#94a3b8"}} width={98} />
                    <Tooltip content={({active,payload})=>active&&payload?.length?(<div className="custom-tooltip"><div className="ct-label">{payload[0].payload.name}</div><div className="ct-value">{payload[0].value} GB</div></div>):null} />
                    <Bar dataKey="gb" radius={[0,4,4,0]}>{vramBreakdown.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>)}

            {/* ══════ STORAGE ══════ */}
            {activeTab==="storage" && (<>
              {!storageEnabled && (
                <div className="alert alert-info">
                  <span className="alert-icon">💾</span>
                  <span>Storage calculation is <strong>disabled</strong>. A default of <strong>1 TB</strong> is assumed. Enable storage in the left panel for a retention-based estimate.</span>
                </div>
              )}
              <div className="metric-grid">
                <MetricCard label="MB/sec per Cam" value={calc.mbPerSecPerCamera.toFixed(2)} unit="MB/s" sub={`${bitratePerCam} Mbps × 0.125`} />
                <MetricCard label="GB/day per Cam" value={calc.gbPerDayPerCamera.toFixed(1)} unit="GB/day" sub="× 86,400 seconds" />
                <MetricCard label="TB/day (all cams)" value={calc.tbPerDay.toFixed(1)} unit="TB/day" sub={`${cameras} cameras`} accent={storageEnabled} />
                <MetricCard label={storageEnabled?`TB for ${retentionDays}d`:"Storage (default)"} value={storageEnabled?calc.tbForRetention.toFixed(0):"1,000"} unit="TB" sub={storageEnabled?`× ${retentionDays} days`:"Fixed 1 TB default"} />
                <MetricCard label="Final Storage" value={storageEnabled?calc.pbWithRedundancy.toFixed(3):"0.001"} unit="PB" sub={storageEnabled?`× ${redundancyFactor}× redundancy`:"1 TB = 0.001 PB"} warn={storageEnabled} />
              </div>
              {storageEnabled && showFormulas && (
                <div className="formula-section">
                  <div className="formula-section-title">⟨/⟩ Storage Formulas</div>
                  <div className="formula-grid">
                    <FormulaBox label="MB/s per camera" formula={`${bitratePerCam} Mbps × 0.125`} result={`${calc.mbPerSecPerCamera.toFixed(2)} MB/s`} />
                    <FormulaBox label="GB/day per camera" formula={`${calc.mbPerSecPerCamera.toFixed(2)} × 86400 / 1024`} result={`${calc.gbPerDayPerCamera.toFixed(2)} GB`} />
                    <FormulaBox label="TB/day all cameras" formula={`${calc.gbPerDayPerCamera.toFixed(2)} × ${cameras} / 1024`} result={`${calc.tbPerDay.toFixed(2)} TB`} />
                    <FormulaBox label={`TB for ${retentionDays} days`} formula={`${calc.tbPerDay.toFixed(2)} × ${retentionDays}`} result={`${calc.tbForRetention.toFixed(1)} TB`} />
                    <FormulaBox label="Final PB with redundancy" formula={`${calc.tbForRetention.toFixed(0)} × ${redundancyFactor} / 1024`} result={`${calc.pbWithRedundancy.toFixed(3)} PB`} />
                  </div>
                </div>
              )}
              {storageEnabled && retentionDays > 0 && storageGrowthData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-title">Cumulative Storage Growth ({retentionDays} days)</div>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={storageGrowthData} margin={{top:10,right:20,left:0,bottom:5}}>
                      <defs><linearGradient id="storGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4}/><stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                      <XAxis dataKey="day" tick={{fontSize:9,fill:"#64748b"}} />
                      <YAxis tick={{fontSize:9,fill:"#64748b"}} />
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div className="custom-tooltip"><div className="ct-label">Day {payload[0].payload.day}</div><div className="ct-value">{payload[0].value} TB</div></div>):null} />
                      <Area type="monotone" dataKey="tb" stroke="#f59e0b" fill="url(#storGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>)}

            {/* ══════ COST ══════ */}
            {activeTab==="cost" && (<>
              <div className="alert alert-ok">
                <span className="alert-icon">📐</span>
                <span>All costs shown in <strong>Lacs (L) / Crores (Cr)</strong> as Low – High range. 1 Lac = $1,00,000 · 1 Crore = $1,00,00,000.</span>
              </div>
              {!storageEnabled && (
                <div className="alert alert-info">
                  <span className="alert-icon">💾</span>
                  <span>Storage uses default 1 TB. Enable storage in left panel for full retention-based calculation.</span>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <div>
                  <div className="chart-card">
                    <div className="chart-title">On-Premise CAPEX — Low / High</div>
                    {[
                      {label:`⚡ GPU Hardware (${calc.gpusWithRedundancy} units)`, lo:calc.gpuCostLow,    hi:calc.gpuCostHigh,    color:"#00d4aa"},
                      {label:`🖥 Servers (${calc.serversNeeded} units)`,           lo:calc.serverCostLow, hi:calc.serverCostHigh, color:"#3b82f6"},
                      {label:`💾 Storage (${calc.pbWithRedundancy.toFixed(3)} PB)`,lo:calc.storageCostLow,hi:calc.storageCostHigh,color:"#f59e0b"},
                    ].map((row,i)=>(
                      <div key={i} className="cost-row">
                        <span className="cost-row-label">{row.label}</span>
                        <span style={{fontFamily:"var(--mono)",fontSize:11}}>
                          <span style={{color:"#94a3b8"}}>{fmtLacs(row.lo)}</span>
                          <span style={{color:"var(--muted)",margin:"0 4px"}}>–</span>
                          <span style={{color:row.color,fontWeight:700}}>{fmtLacs(row.hi)}</span>
                        </span>
                      </div>
                    ))}
                    <div className="cost-total">
                      <div className="cost-total-label">Total Deployment Cost</div>
                      <div className="cost-total-val">{fmtLacs(calc.totalCapexLow)}</div>
                      <div className="cost-total-range">up to {fmtLacs(calc.totalCapexHigh)}</div>
                      <div style={{fontSize:9,color:"#64748b",marginTop:4}}>
                        {fmtLacs(calc.totalCapexLow/cameras/36)} – {fmtLacs(calc.totalCapexHigh/cameras/36)} / camera / month (3yr amort.)
                      </div>
                    </div>
                  </div>
                  {isCloud && (
                    <div className="chart-card" style={{marginTop:12}}>
                      <div className="chart-title">☁️ Cloud OPEX — Low / High</div>
                      <div className="cost-row">
                        <span className="cost-row-label">{calc.gpusWithRedundancy} GPUs × {calc.cloudMonthlyHours}h/mo</span>
                        <span style={{fontFamily:"var(--mono)",fontSize:11}}>
                          <span style={{color:"#94a3b8"}}>{fmtLacs(calc.cloudMonthlyLow)}</span>
                          <span style={{color:"var(--muted)",margin:"0 4px"}}>–</span>
                          <span style={{color:"#00d4aa",fontWeight:700}}>{fmtLacs(calc.cloudMonthlyHigh)}/mo</span>
                        </span>
                      </div>
                      <div className="cost-row">
                        <span className="cost-row-label">Annual cost</span>
                        <span style={{fontFamily:"var(--mono)",fontSize:11}}>
                          <span style={{color:"#94a3b8"}}>{fmtLacs(calc.cloudAnnualLow)}</span>
                          <span style={{color:"var(--muted)",margin:"0 4px"}}>–</span>
                          <span style={{color:"#f59e0b",fontWeight:700}}>{fmtLacs(calc.cloudAnnualHigh)}/yr</span>
                        </span>
                      </div>
                      <div className="cost-row">
                        <span className="cost-row-label">Break-even vs on-prem</span>
                        <span style={{fontFamily:"var(--mono)",fontSize:11,color:"#94a3b8",fontWeight:700}}>
                          {(calc.gpuCostLow/calc.cloudMonthlyHigh).toFixed(0)}–{(calc.gpuCostHigh/calc.cloudMonthlyLow).toFixed(0)} months
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="chart-card">
                  <div className="chart-title">Cost Distribution (Low Est.)</div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={costPieLow} cx="50%" cy="50%" outerRadius={92} dataKey="value"
                        label={({name,percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                        {costPieLow.map((d,i)=><Cell key={i} fill={d.color}/>)}
                      </Pie>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div className="custom-tooltip"><div className="ct-label">{payload[0].name}</div><div className="ct-value">{fmtLacs(payload[0].value)}</div></div>):null} />
                      <Legend formatter={v=><span style={{fontSize:9,color:"#94a3b8"}}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {showFormulas && (
                <div className="formula-section" style={{marginTop:18}}>
                  <div className="formula-section-title">⟨/⟩ Cost Range Formulas</div>
                  <div className="formula-grid">
                    <FormulaBox label="GPU Hardware Range" formula={`${calc.gpusWithRedundancy} GPUs × ($${gpuPriceLow.toLocaleString()} – $${gpuPriceHigh.toLocaleString()})`} result={`${fmtLacs(calc.gpuCostLow)} – ${fmtLacs(calc.gpuCostHigh)}`} />
                    <FormulaBox label="Server Range" formula={`${calc.serversNeeded} servers × ($${serverPriceLow.toLocaleString()} – $${serverPriceHigh.toLocaleString()})`} result={`${fmtLacs(calc.serverCostLow)} – ${fmtLacs(calc.serverCostHigh)}`} />
                    <FormulaBox label="Storage Range" formula={`${calc.pbWithRedundancy.toFixed(3)} PB × ($${storagePriceLow.toLocaleString()} – $${storagePriceHigh.toLocaleString()})`} result={`${fmtLacs(calc.storageCostLow)} – ${fmtLacs(calc.storageCostHigh)}`} />
                    {isCloud && <FormulaBox label="Cloud Monthly Range" formula={`${calc.gpusWithRedundancy} GPUs × 720h × ($${cloudPriceLow} – $${cloudPriceHigh})`} result={`${fmtLacs(calc.cloudMonthlyLow)} – ${fmtLacs(calc.cloudMonthlyHigh)}/mo`} />}
                  </div>
                </div>
              )}
            </>)}

            {/* ══════ MODELS ══════ */}
            {activeTab==="models" && (<>
              <div className="alert alert-ok" style={{marginBottom:12}}>
                <span className="alert-icon">ℹ️</span>
                <span>Each model group runs on every GPU. GPU count = ceil(max_cameras_any_model / cameras_per_GPU). Cameras per GPU = streams ÷ Σ(all active model reductions).</span>
              </div>
              <table className="model-table" style={{marginBottom:18}}>
                <thead><tr>
                  <th>Model Group</th><th>UCs</th><th>Resolution</th><th>VRAM</th><th>FPS</th><th>Cameras</th><th>Pipeline</th><th>Reduction</th><th>Total FPS</th>
                </tr></thead>
                <tbody>
                  {calc.activeModels.map(m => {
                    const p = RES_PRESETS[modelResIdx[m.id]];
                    const pType = m.id === "vehicle" ? calc.dominantType : PIPELINE.DETECTION;
                    const pInfo = PIPELINE_LABELS[pType];
                    return (
                      <tr key={m.id}>
                        <td><span className="model-dot" style={{background:m.color}}/><span style={{fontWeight:600}}>{m.name}</span></td>
                        <td>{modelUcMap[m.id].map(uc=>(<span key={uc.n} className="badge" style={{color:m.color,borderColor:m.color+"44"}}>#{uc.n}</span>))}</td>
                        <td style={{fontFamily:"var(--mono)",fontSize:9,color:"#94a3b8"}}>{p.label}</td>
                        <td style={{fontFamily:"var(--mono)",fontSize:9,color:"#f59e0b"}}>{calc.modelEffectiveMem[m.id].toFixed(2)} GB</td>
                        <td style={{fontFamily:"var(--mono)",color:m.color,fontWeight:700}}>{modelFps[m.id]}</td>
                        <td style={{fontFamily:"var(--mono)",fontSize:10}}>{calc.modelCameras[m.id]}</td>
                        <td><span className={`pipeline-badge pipeline-${pType}`}>{pInfo.icon} ×{PIPELINE_MULTIPLIERS[pType]}</span></td>
                        <td style={{fontFamily:"var(--mono)",fontSize:9,color:"#f59e0b"}}>{(calc.modelIpsDemand[m.id]||0).toFixed(1)} IPS</td>
                        <td style={{fontFamily:"var(--mono)",fontWeight:700}}>{(calc.modelCameras[m.id]*modelFps[m.id]).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={3} style={{color:"var(--muted)",fontSize:9}}>Pipeline Overhead (Tracking + DeepStream)</td>
                    <td style={{fontFamily:"var(--mono)",fontSize:9,fontWeight:700,color:"var(--warn)"}}>{(OVERHEAD_MEM.tracking+OVERHEAD_MEM.deepstream).toFixed(1)} GB</td>
                    <td colSpan={5}/>
                  </tr>
                  {calc.vehicleTrackingOverhead > 0 && (
                    <tr>
                      <td colSpan={3} style={{color:"#3b82f6",fontSize:9}}>Vehicle Tracking Model Overhead</td>
                      <td style={{fontFamily:"var(--mono)",fontSize:9,fontWeight:700,color:"#3b82f6"}}>{calc.vehicleTrackingOverhead.toFixed(1)} GB</td>
                      <td colSpan={5}/>
                    </tr>
                  )}
                  <tr style={{background:"#0d1420"}}>
                    <td colSpan={3} style={{fontWeight:700,color:"#f1f5f9"}}>TOTAL</td>
                    <td style={{fontFamily:"var(--mono)",fontWeight:700,color:"var(--accent)"}}>{calc.totalMemNeeded.toFixed(2)} GB</td>
                    <td colSpan={3}/>
                    <td style={{fontFamily:"var(--mono)",fontSize:9,color:"#f59e0b",fontWeight:700}}>Σ {calc.totalIpsDemandPerCamera.toFixed(1)} IPS</td>
                    <td style={{fontFamily:"var(--mono)",fontWeight:700,color:"var(--accent)"}}>{calc.totalFpsLoad.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <div className="divider" />
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:10}}>
                📋 Use Case → Model Mapping
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
                {calc.activeModels.map(m => (
                  <div key={m.id} style={{border:`1px solid ${m.color}33`,borderLeft:`3px solid ${m.color}`,borderRadius:"0 7px 7px 0",background:`${m.color}08`,padding:"9px 11px"}}>
                    <div style={{fontSize:9,fontWeight:700,color:m.color,textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6,fontFamily:"var(--mono)",display:"flex",justifyContent:"space-between"}}>
                      <span><span className="model-dot" style={{background:m.color}}/>{m.name}</span>
                      <span style={{color:"#64748b"}}>{calc.modelCameras[m.id]} eff. cams</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {modelUcMap[m.id].map(uc => {
                        const isVehicleUc = VEHICLE_UC_IDS.has(uc.n);
                        const pType = isVehicleUc ? ucPipelineOverride[uc.n] : PIPELINE.DETECTION;
                        const pInfo = PIPELINE_LABELS[pType];
                        return (
                          <div key={uc.n} style={{display:"flex",gap:5,alignItems:"flex-start"}}>
                            <span style={{fontFamily:"var(--mono)",fontSize:8,fontWeight:700,color:m.color,background:`${m.color}22`,border:`1px solid ${m.color}44`,borderRadius:3,padding:"1px 4px",minWidth:18,textAlign:"center",flexShrink:0,marginTop:1}}>
                              #{uc.n}
                            </span>
                            <div style={{fontSize:9,color:"#94a3b8",lineHeight:1.4,flex:1}}>
                              {uc.label}
                              {isVehicleUc && <span className={`pipeline-badge pipeline-${pType}`} style={{marginLeft:4}}>{pInfo.icon} ×{PIPELINE_MULTIPLIERS[pType]}</span>}
                            </div>
                            <span style={{fontFamily:"var(--mono)",fontSize:9,color:"#475569",flexShrink:0}}>{ucCameras[uc.n]} cams</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>)}

            {/* ══════ PIPELINE COMPLEXITY ══════ */}
            {activeTab==="pipeline" && (<>
              <div className="alert alert-info" style={{marginBottom:16}}>
                <span className="alert-icon">🔄</span>
                <span>Pipeline complexity is calculated <strong>per model group</strong>, not per use case. Multiple UCs sharing a model group run as one model. Vehicle Master applies the highest pipeline multiplier across its active UCs.</span>
              </div>

              {/* Summary per model group */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:10}}>
                Active Model Groups — Pipeline & GPU Budget
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:20}}>
                {calc.modelPipelineInfo.map(m => {
                  const pInfo = PIPELINE_LABELS[m.pType];
                  return (
                    <div key={m.id} style={{background:"var(--panel)",border:`1px solid ${m.color}33`,borderTop:`3px solid ${m.color}`,borderRadius:9,padding:"14px 14px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                        <span className="model-dot" style={{background:m.color,width:9,height:9}} />
                        <span style={{fontFamily:"var(--mono)",fontSize:9,fontWeight:700,color:m.color,textTransform:"uppercase"}}>{m.name}</span>
                      </div>
                      <div style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:700,color:"#f1f5f9",lineHeight:1,marginBottom:3}}>
                        {m.gpuCount}
                        <span style={{fontSize:11,color:"var(--muted)",fontWeight:400}}> GPUs</span>
                      </div>
                      <div style={{fontSize:9,color:"var(--muted)",marginBottom:8}}>{m.cams} cameras @ {calc.camerasPerGpu} cams/GPU</div>
                      <span className={`pipeline-badge pipeline-${m.pType}`}>{pInfo.icon} {pInfo.label}</span>
                      <div style={{fontFamily:"var(--mono)",fontSize:9,color:"#f59e0b",marginTop:5}}>{(calc.modelIpsDemand[m.id]||0).toFixed(1)} IPS/cam demand</div>
                    </div>
                  );
                })}
                {calc.activeModels.length === 0 && (
                  <div style={{gridColumn:"1/-1",padding:"20px",textAlign:"center",color:"var(--muted)",fontSize:11}}>
                    No active use cases. Enable use cases in the left panel.
                  </div>
                )}
              </div>

              {/* GPU total summary */}
              <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:9,padding:"14px 18px",marginBottom:20}}>
                <div style={{fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Total GPU Requirement</div>
                <div style={{fontFamily:"var(--mono)",fontSize:24,fontWeight:700,color:"var(--accent)"}}>
                  {calc.gpusWithRedundancy} GPUs
                </div>
                <div style={{fontSize:10,color:"#64748b",marginTop:4}}>
                  = ceil({calc.effectiveTotalCams} max_cams / {calc.camerasPerGpu} cams_per_gpu)
                  · Total demand: {calc.totalIpsDemandPerCamera.toFixed(1)} IPS/cam · GPU IPS: {calc.gpuIps}
                  · {calc.serversNeeded} servers @ {gpusPerServer} GPUs each
                </div>
              </div>

              {/* Vehicle pipeline switcher */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>
                🚗 Vehicle Master — Pipeline Override
              </div>
              <div style={{fontSize:9,color:"#475569",marginBottom:10}}>
                Vehicle use cases (speed/height monitoring) can run as Detection, Tracking, or Re-ID pipelines. The <strong>highest multiplier</strong> among active vehicle UCs is applied to the entire Vehicle Master group.
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
                {ALL_USE_CASES.filter(uc => VEHICLE_UC_IDS.has(uc.n) && enabledUcs[uc.n]).map(uc => {
                  const m = MODEL_GROUPS.find(g => g.id === uc.model);
                  const current = ucPipelineOverride[uc.n] || PIPELINE.TRACKING;
                  return (
                    <div key={uc.n} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
                      background:"var(--panel)",border:`1px solid ${PIPELINE_LABELS[current].color}33`,
                      borderLeft:`3px solid ${PIPELINE_LABELS[current].color}`,borderRadius:"0 7px 7px 0"}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:9,fontWeight:700,color:m?.color,background:`${m?.color}20`,border:`1px solid ${m?.color}44`,borderRadius:3,padding:"1px 5px",flexShrink:0}}>#{uc.n}</span>
                      <span style={{fontSize:9,color:"#94a3b8",flex:1,lineHeight:1.3}}>{uc.label}</span>
                      <span style={{fontSize:9,color:"#64748b",flexShrink:0}}>{ucCameras[uc.n]} cams</span>
                      <div style={{display:"flex",gap:3,flexShrink:0}}>
                        {[PIPELINE.DETECTION, PIPELINE.TRACKING, PIPELINE.REID].map(pType => {
                          const pInfo = PIPELINE_LABELS[pType];
                          const isActive = current === pType;
                          return (
                            <button key={pType}
                              onClick={() => setUcPipelineOverride(p => ({...p,[uc.n]:pType}))}
                              style={{padding:"3px 8px",fontFamily:"var(--mono)",fontSize:8,cursor:"pointer",
                                border:`1px solid ${isActive?pInfo.color:"#253347"}`,borderRadius:4,
                                background:isActive?`${pInfo.color}20`:"var(--panel2)",
                                color:isActive?pInfo.color:"#475569",transition:"all 0.15s",fontWeight:isActive?700:400}}>
                              {pInfo.icon} ×{PIPELINE_MULTIPLIERS[pType]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {ALL_USE_CASES.filter(uc => VEHICLE_UC_IDS.has(uc.n) && enabledUcs[uc.n]).length === 0 && (
                  <div style={{fontSize:10,color:"#475569",padding:"8px",textAlign:"center"}}>No vehicle use cases are currently enabled.</div>
                )}
              </div>

              {/* Full use case table */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:10}}>
                All Use Cases — Pipeline Classification (Grouped by Model)
              </div>
              <table className="model-table" style={{marginBottom:16}}>
                <thead><tr>
                  <th>#</th><th>Use Case</th><th>Model Group</th><th>Pipeline</th><th>Multiplier</th><th>Cameras</th>
                </tr></thead>
                <tbody>
                  {ALL_USE_CASES.filter(uc => enabledUcs[uc.n]).map(uc => {
                    const m   = MODEL_GROUPS.find(g => g.id === uc.model);
                    const isV = VEHICLE_UC_IDS.has(uc.n);
                    const pType = isV ? ucPipelineOverride[uc.n] : PIPELINE.DETECTION;
                    const pInfo = PIPELINE_LABELS[pType];
                    const mult  = PIPELINE_MULTIPLIERS[pType];
                    return (
                      <tr key={uc.n}>
                        <td><span className="uc-num" style={{background:`${m?.color}20`,borderColor:`${m?.color}44`,color:m?.color}}>#{uc.n}</span></td>
                        <td style={{color:"#94a3b8",fontSize:10}}>{uc.label}</td>
                        <td><span style={{fontFamily:"var(--mono)",fontSize:8,color:m?.color,background:`${m?.color}15`,border:`1px solid ${m?.color}33`,borderRadius:3,padding:"1px 5px"}}>{m?.name}</span></td>
                        <td><span className={`pipeline-badge pipeline-${pType}`}>{pInfo.icon} {pInfo.label}</span></td>
                        <td style={{fontFamily:"var(--mono)",fontSize:10,color:mult>1?"#f59e0b":"#00d4aa",fontWeight:700}}>×{mult}</td>
                        <td style={{fontFamily:"var(--mono)",fontSize:10}}>{ucCameras[uc.n]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pipeline explanation */}
              <div className="divider" />
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {[
                  {type:PIPELINE.DETECTION, title:"Detection Only",               mult:`×${PIPELINE_MULTIPLIERS[PIPELINE.DETECTION]}`, color:"#00d4aa",
                   desc:"YOLO inference only. Single model pass per frame. Full GPU stream capacity. Suitable for presence/absence: helmets, jackets, fire, smoke."},
                  {type:PIPELINE.TRACKING,  title:"Detection + Tracking",          mult:`×${PIPELINE_MULTIPLIERS[PIPELINE.TRACKING]}`,  color:"#3b82f6",
                   desc:"YOLO detection + object tracker (ByteTrack/DeepSORT). Tracker runs at ~50% detection FPS. +0.5 GB VRAM overhead. GPU load ×1.35."},
                  {type:PIPELINE.REID,      title:"Detection + Tracking + Re-ID",  mult:`×${PIPELINE_MULTIPLIERS[PIPELINE.REID]}`,      color:"#f59e0b",
                   desc:"Full pipeline: detection + tracking + re-ID embedding model for cross-camera identity matching. Highest cost. +1.2 GB VRAM overhead."},
                ].map((item,i) => (
                  <div key={i} className="formula-box" style={{borderLeftColor:item.color}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                      <div className="formula-label">{PIPELINE_LABELS[item.type].icon} {item.title}</div>
                      <span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:item.color}}>{item.mult}</span>
                    </div>
                    <div style={{fontSize:9,color:"#64748b",lineHeight:1.5}}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </>)}

          </div>
        </div>
      </div>
    </div>
  </>);
}