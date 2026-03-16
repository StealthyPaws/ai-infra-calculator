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

const CPU_SERVERS = {
  "16": { cores: 16, name: "AMD EPYC 7232P / Intel Xeon 8280", tdp: 120, price: 2500, priceHigh: 3500 },
  "32": { cores: 32, name: "AMD EPYC 7302P / Intel Xeon Platinum 8380", tdp: 155, price: 4500, priceHigh: 6000 },
  "40": { cores: 40, name: "AMD EPYC 7452 / Intel Xeon Platinum 8592+", tdp: 225, price: 6500, priceHigh: 8500 },
  "64": { cores: 64, name: "AMD EPYC 7702 / Intel Xeon Platinum 8592", tdp: 360, price: 9500, priceHigh: 12000 },
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

// ─── DEPLOYMENT TIMELINE LOGIC (COMPRESSED, 3-6 MONTHS) ────────────────────────
// Assumes infrastructure is PRE-PHASE (already done)
// Organized by 7 functional headers (model groups), all work in parallel
// Timeline structure: Model Prep → Camera Staging → Parallel Deployment → Testing → Go-Live

const DEPLOYMENT_PHASES = {
  // PRE-PHASE (not counted in timeline): Infrastructure Setup assumed complete
  INFRASTRUCTURE_PHASE: {
    description: "PRE-PHASE (Assumed Complete)",
    duration: 3,  // Only included for reference if infrastructure not yet done
    tasks: ["Server procurement & setup", "Network provisioning", "Storage SAN deployment"]
  },
  // Per model deployment (weeks) - based on pipeline complexity
  modelDeploymentBase: {
    [PIPELINE.DETECTION]: 1.0,  // YOLO inference, no training usually
    [PIPELINE.TRACKING]:  2.0,   // Model + tracker tuning, dataset collection
    [PIPELINE.REID]:      3.5,   // Complex model training, large dataset, cross-cam validation
  },
  // Compressed phase timings (weeks) - for 320 cameras distributed across 7 headers
  modelPrep: 1.5,              // Week 1: Model download, CUDA setup, DeepStream config (all parallel)
  cameraStagingInfra: 1.5,     // Week 1-2: Parallel cables, PoE config, network discovery
  parallelDeploymentPerHeader: 2.0,  // Week 2-4: Each header does (model deploy + camera integration) in parallel
  integrationTesting: 1.5,     // Week 4-5: Cross-header validation, false positive tuning
  systemValidation: 1.0,       // Week 5: Full system test, stress testing, handoff prep
  goLive: 0.5,                 // Week 5-6: Phased rollout per area, monitoring ramp-up
};

// Calculate deployment timeline organized by headers (model groups)
// All headers execute deployment phase in parallel (~2 weeks), then sequential testing
const calculateDeploymentTimeline = (activeUcs, camerasPerUc, gpuType, totalGpusNeeded) => {
  if (activeUcs.length === 0) {
    return { 
      total: 0, 
      phases: {}, 
      breakdown: [], 
      useCaseBreakdown: [],
      headerBreakdowns: [],
      criticalPath: "No use cases selected" 
    };
  }

  const totalCameras = Object.values(camerasPerUc).reduce((s, c) => s + c, 0);
  
  // GROUP USE CASES BY HEADER (Model Group)
  const headerGroups = {};
  MODEL_GROUPS.forEach(group => {
    headerGroups[group.id] = {
      id: group.id,
      name: group.name,
      color: group.color,
      useCases: [],
      cameras: 0,
    };
  });
  
  activeUcs.forEach(uc => {
    if (headerGroups[uc.model]) {
      headerGroups[uc.model].useCases.push(uc.n);
      headerGroups[uc.model].cameras += camerasPerUc[uc.n] || 0;
    }
  });
  
  // Filter to only active headers
  const activeHeaders = Object.values(headerGroups).filter(h => h.useCases.length > 0).sort((a, b) => a.name.localeCompare(b.name));
  
  // COMPRESSED TIMELINE (all phases in parallel where possible)
  // Phase 1: Model Prep (Week 1) - ALL headers run in parallel
  const modelPrepWeeks = DEPLOYMENT_PHASES.modelPrep;
  
  // Phase 2: Camera Staging (Week 1-2) - Runs parallel to Model Prep
  const cameraStagingWeeks = DEPLOYMENT_PHASES.cameraStagingInfra;
  
  // Phase 3: PARALLEL DEPLOYMENT (Week 2-4) - Each header does their model + camera integration
  // All headers complete this within the same ~2 week window (parallel execution)
  const parallelDeploymentWeeks = DEPLOYMENT_PHASES.parallelDeploymentPerHeader;
  
  // Phase 4: Integration Testing (Week 4-5) - Sequential but quick
  const integrationTestingWeeks = DEPLOYMENT_PHASES.integrationTesting;
  
  // Phase 5: System Validation (Week 5) - Final full-system test
  const systemValidationWeeks = DEPLOYMENT_PHASES.systemValidation;
  
  // Phase 6: Go-Live (Week 5-6) - Phased rollout per area
  const goLiveWeeks = DEPLOYMENT_PHASES.goLive;
  
  // CRITICAL PATH (min of all activities, considering parallelism)
  // Model Prep and Camera Staging run in parallel
  // Then Deployment, Testing, Validation, Go-Live are sequential
  const criticalPathWeeks = 
    Math.max(modelPrepWeeks, cameraStagingWeeks) +  // These run in parallel
    parallelDeploymentWeeks +
    integrationTestingWeeks +
    systemValidationWeeks +
    goLiveWeeks;
  
  // Calculate per-header timeline
  const headerBreakdowns = activeHeaders.map(header => {
    const headerCameras = header.cameras;
    return {
      id: header.id,
      name: header.name,
      color: header.color,
      cameras: headerCameras,
      usecaseCount: header.useCases.length,
      usecaseIds: header.useCases,
      // Per-header timing (rough estimate, but they all fit within the parallel deployment window)
      modelPrepWeeks: DEPLOYMENT_PHASES.modelPrep,
      deploymentWeeks: DEPLOYMENT_PHASES.parallelDeploymentPerHeader,
      testingWeeks: integrationTestingWeeks / activeHeaders.length,  // Share testing load
    };
  });
  
  // Timeline breakdown by phase (for visualization)
  const phases = {
    modelPrep: modelPrepWeeks,
    cameraStaging: cameraStagingWeeks,
    parallelDeployment: parallelDeploymentWeeks,
    integrationTesting: integrationTestingWeeks,
    systemValidation: systemValidationWeeks,
    goLive: goLiveWeeks,
  };
  
  const breakdown = [
    { 
      name: "Model Prep & Environment Setup", 
      weeks: modelPrepWeeks, 
      color: "#f59e0b", 
      detail: `${activeHeaders.length} headers: CUDA, DeepStream config`,
      parallel: true
    },
    { 
      name: "Camera Infrastructure Staging", 
      weeks: cameraStagingWeeks, 
      color: "#3b82f6", 
      detail: `${totalCameras} cameras: Cable runs, PoE, network discovery (parallel with Model Prep)`,
      parallel: true
    },
    { 
      name: "Parallel Deployment (Models + Cameras per Header)", 
      weeks: parallelDeploymentWeeks, 
      color: "#00d4aa", 
      detail: `All ${activeHeaders.length} headers deployed in parallel (~${parallelDeploymentWeeks.toFixed(1)} weeks each)`,
      parallel: false
    },
    { 
      name: "Integration Testing & Cross-Header Validation", 
      weeks: integrationTestingWeeks, 
      color: "#8b5cf6", 
      detail: "False positive tuning, multi-header coordination tests",
      parallel: false
    },
    { 
      name: "System Validation & Stress Testing", 
      weeks: systemValidationWeeks, 
      color: "#06b6d4", 
      detail: "Full system under load, edge case walkthroughs",
      parallel: false
    },
    { 
      name: "Go-Live & Phased Rollout", 
      weeks: goLiveWeeks, 
      color: "#ec4899", 
      detail: "Production ramp-up, 24/7 monitoring activation",
      parallel: false
    },
  ];
  
  // Per-use-case breakdown (for reference)
  // IMPORTANT: Camera integration is SHARED (320 cameras total, not per-UC)
  // Each UC only includes model deployment time, not camera work
  const useCaseBreakdown = activeUcs.map(uc => {
    const header = headerGroups[uc.model];
    const ucCameras = camerasPerUc[uc.n] || 0;
    const pipelineLabel = PIPELINE_LABELS[uc.pipeline || PIPELINE.DETECTION].label;
    
    // Per-UC timing: ONLY model deployment (not camera integration - that's shared)
    const modelDeploymentWeeks = DEPLOYMENT_PHASES.modelDeploymentBase?.[uc.pipeline || PIPELINE.DETECTION] || 1.0;
    // UC-specific testing (small portion of the shared testing window)
    const ucTestingWeeks = 0.3;
    
    // UC timeline: happens within the parallel deployment window (weeks 2-4)
    // Does NOT include camera integration since that's already done in Week 1-2 pre-phase
    const estimatedWeeks = modelDeploymentWeeks + ucTestingWeeks;
    
    return {
      n: uc.n,
      label: uc.label,
      cameras: ucCameras,
      header: header?.name || "Unknown",
      headerColor: header?.color || "#64748b",
      modelComplexity: pipelineLabel,
      estimatedWeeks: estimatedWeeks,
      estimatedDays: Math.round(estimatedWeeks * 7),
      // UC is part of parallel deployment window
      startWeek: Math.max(modelPrepWeeks, cameraStagingWeeks),
      endWeek: Math.max(modelPrepWeeks, cameraStagingWeeks) + parallelDeploymentWeeks,
    };
  });

  return {
    total: criticalPathWeeks,
    totalDays: Math.round(criticalPathWeeks * 7),
    totalMonths: (criticalPathWeeks / 4.33).toFixed(1),
    phases,
    breakdown,
    headerBreakdowns,
    useCaseBreakdown,
    activeHeaderCount: activeHeaders.length,
    totalCameras,
    criticalPath: `Model Prep → Camera Staging (parallel) → Deployment (${activeHeaders.length} headers parallel) → Testing → Go-Live`,
  };
};

// ─── SERVER DIMENSIONING LOGIC ────────────────────────────────────────────────
// Calculates optimal GPUs per server based on real hardware constraints:
// - Thermal envelope (cooling headroom, fan design)
// - Power delivery (PSU, voltage regulators)
// - PCIe bandwidth (x16 + x16 + x8 topology on typical boards)
// - Memory-to-GPU ratio (avoiding NUMA bottlenecks)
// - Cooling challenges (hot GPU stacks require better airflow)

const calculateServerConfig = (gpuType, totalGpusNeeded) => {
  // For now, use a simple mapping based on GPU power characteristics
  const spec = GPU_SPECS[gpuType];
  
  // Estimate TDP and recommended GPUs based on GPU model
  // These would normally come from GPU_SPECS with tdp, recommendedPerServer etc
  const tdpEstimates = {
    T4: { tdp: 70, recommended: 4, max: 8 },
    A5000: { tdp: 250, recommended: 2, max: 4 },
    L4: { tdp: 72, recommended: 3, max: 6 },
    H20: { tdp: 400, recommended: 2, max: 2 },
    L20: { tdp: 350, recommended: 2, max: 3 },
  };
  
  const estimate = tdpEstimates[gpuType] || { tdp: 100, recommended: 2, max: 4 };
  
  // Thermal constraint: TDP scaling
  const maxByPower = Math.floor(2000 / estimate.tdp);
  const maxByThermal = Math.floor(1000 / Math.max(100, Math.ceil(estimate.tdp * 0.8)));
  
  // PCIe constraint: typical board topology
  const maxByPcie = estimate.tdp > 300 ? 2 : (estimate.tdp > 150 ? 3 : 4);
  
  // Apply constraints
  const constrained = Math.min(
    estimate.recommended,
    maxByPower,
    maxByThermal,
    maxByPcie,
    estimate.max
  );
  
  return {
    recommended: Math.max(1, constrained),
    max: estimate.max,
    maxByPower,
    maxByThermal,
    maxByPcie,
    constraintLimiting: constrained < estimate.recommended ? 
      (constrained === maxByPower ? 'power' : 
       constrained === maxByThermal ? 'thermal' : 
       constrained === maxByPcie ? 'pcie' : 'other') : 'none',
    reasoning: [
      `Base OEM recommendation: ${estimate.recommended} GPUs/server`,
      `Thermal constraint (${estimate.tdp}W TDP): max ${maxByThermal} GPUs`,
      `Power budget (2000W): max ${maxByPower} GPUs`,
      `PCIe bandwidth: max ${maxByPcie} GPUs (full x16 per GPU)`,
      `→ Recommended: ${Math.max(1, constrained)} GPUs/server for optimal performance`,
    ],
  };
};

// ─── CPU CORE REQUIREMENT LOGIC ────────────────────────────────────────────────
// Calculates CPU cores needed based on:
// - Video decoding: ~600 Mbps per core (H.264/H.265 codec capacity)
// - NMS/Aggregation: ~2-3 cores
// - Preprocessing: CPU-based (0.4ms/frame) vs GPU-accelerated (0.1ms/frame)
// - System overhead: ~2-3 cores (OS, services, frame I/O)

const calculateCpuRequirements = (cameras, bitratePerCam, totalFpsLoad, gpuAccelEnabled = true) => {
  // If no cameras selected, CPU requirements are 0
  if (cameras === 0 || totalFpsLoad === 0) {
    return {
      cameras: 0,
      bitratePerCam,
      totalBitrateMbps: 0,
      totalFpsLoad: 0,
      breakdown: {
        decoding: 0,
        nms: 0,
        preprocessCpuBased: 0,
        preprocessGpuAccel: 0,
        systemOverhead: 0,
      },
      cpuBased: {
        minimum: 0,
        recommended: 0,
        label: "CPU-Based Preprocessing",
        description: "All preprocessing (resize, color, norm.) done on CPU",
        utilization: "0",
      },
      gpuAccelerated: {
        minimum: 0,
        recommended: 0,
        label: "GPU-Accelerated Preprocessing",
        description: "Preprocessing batched & GPU-accelerated via CUDA",
        utilization: "0",
      },
      recommendation: gpuAccelEnabled ? "gpu" : "cpu",
    };
  }

  // Video codec decoding: ~600 Mbps per core (H.264/H.265 typical)
  const decodingBandwidthPerCore = 600;
  const totalBitrateMbps = cameras * bitratePerCam;
  const coresForDecoding = Math.ceil(totalBitrateMbps / decodingBandwidthPerCore);

  // NMS and aggregation per-frame processing
  const coresForNms = 2;

  // Preprocessing load calculation:
  // CPU-based: 0.4ms per frame → (fps / 1000) * 0.4 cores
  // GPU-accel: 0.1ms per frame + minimal GPU coordination → ~0.00008 cores per fps
  const coresForPreprocessCpuBased = Math.ceil(totalFpsLoad * 0.0004);
  const coresForPreprocessGpuAccel = Math.ceil(totalFpsLoad * 0.00008);

  // System overhead (OS, services, frame I/O buffer)
  const coresForSystemOverhead = 3;

  // Calculate totals
  const cpuBasedTotal = coresForDecoding + coresForNms + coresForPreprocessCpuBased + coresForSystemOverhead;
  const gpuAccelTotal = coresForDecoding + coresForNms + coresForPreprocessGpuAccel + coresForSystemOverhead;

  // Recommended: 1.5x safety margin for headroom and peak loads
  const cpuBasedRecommended = Math.ceil(cpuBasedTotal * 1.5);
  const gpuAccelRecommended = Math.ceil(gpuAccelTotal * 1.5);

  return {
    cameras,
    bitratePerCam,
    totalBitrateMbps,
    totalFpsLoad,
    breakdown: {
      decoding: coresForDecoding,
      nms: coresForNms,
      preprocessCpuBased: coresForPreprocessCpuBased,
      preprocessGpuAccel: coresForPreprocessGpuAccel,
      systemOverhead: coresForSystemOverhead,
    },
    cpuBased: {
      minimum: cpuBasedTotal,
      recommended: cpuBasedRecommended,
      label: "CPU-Based Preprocessing",
      description: "All preprocessing (resize, color, norm.) done on CPU",
      utilization: ((cpuBasedTotal / cpuBasedRecommended) * 100).toFixed(0),
    },
    gpuAccelerated: {
      minimum: gpuAccelTotal,
      recommended: gpuAccelRecommended,
      label: "GPU-Accelerated Preprocessing",
      description: "Preprocessing batched & GPU-accelerated via CUDA",
      utilization: ((gpuAccelTotal / gpuAccelRecommended) * 100).toFixed(0),
    },
    recommendation: gpuAccelEnabled ? "gpu" : "cpu",
  };
};

// ─── UNIFIED SERVER RECOMMENDATION LOGIC ────────────────────────────────────────────────────────────────
// Single server type handles both CPU (decode/preprocess) + GPU (inference) tasks
// Calculates servers needed as the maximum of CPU or GPU requirements

// totalCoresRequired = auto-calculated cores needed (from calculateCpuRequirements)
// coresPerServer     = user slider: how many cores each physical server has
// gpusPerServer      = user slider: how many GPUs each physical server has
const getUnifiedServerRecommendations = (totalCoresRequired, coresPerServer, gpusNeeded, gpusPerServer) => {
  if (totalCoresRequired === 0 && gpusNeeded === 0) {
    return {
      totalServersNeeded: 0,
      totalCoresRequired: 0,
      coresPerServer,
      cpuServersNeeded: 0,
      gpuServersNeeded: 0,
      gpusNeeded: 0,
      gpusPerServer,
      totalGpuSlots: 0,
      totalCoreCoverage: 0,
      cpuHeadroom: 0,
      cpuUtilization: "0.0",
      gpuUtilization: "0.0",
      bottleneck: "N/A",
    };
  }

  // CPU servers = ceil(total cores needed / cores each server provides)
  // → more cores per server = fewer CPU servers needed
  // → fewer cores per server = more CPU servers needed (may exceed GPU servers → raises count)
  const cpuServersNeeded = totalCoresRequired > 0 && coresPerServer > 0
    ? Math.ceil(totalCoresRequired / coresPerServer)
    : 0;

  // GPU servers = ceil(total GPUs / GPUs per server)
  const gpuServersNeeded = gpusNeeded > 0 ? Math.ceil(gpusNeeded / gpusPerServer) : 0;

  // Bottleneck wins — whichever needs more servers drives the total
  const totalServersNeeded = Math.max(cpuServersNeeded, gpuServersNeeded);

  const totalGpuSlots   = gpusPerServer * totalServersNeeded;
  const totalCoreCoverage = coresPerServer * totalServersNeeded;

  const cpuUtilValue = totalCoreCoverage > 0
    ? (totalCoresRequired / totalCoreCoverage) * 100
    : 0;
  const gpuUtilValue = totalGpuSlots > 0
    ? (gpusNeeded / totalGpuSlots) * 100
    : 0;

  const bottleneck = cpuServersNeeded > gpuServersNeeded ? "CPU"
    : gpuServersNeeded > cpuServersNeeded ? "GPU"
    : "Balanced";

  return {
    totalServersNeeded,
    totalCoresRequired,
    coresPerServer,
    cpuServersNeeded,
    gpuServersNeeded,
    gpusNeeded,
    gpusPerServer,
    totalGpuSlots,
    totalCoreCoverage,
    cpuHeadroom: totalCoreCoverage - totalCoresRequired,
    cpuUtilization: cpuUtilValue.toFixed(1),
    gpuUtilization: gpuUtilValue.toFixed(1),
    bottleneck,
  };
};

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
  const [activeTab,        setActiveTab]        = useState("summary");
  const [showFormulas,     setShowFormulas]      = useState(true);
  const [showUcCameras,    setShowUcCameras]    = useState(false);

  const [gpuPriceLow,      setGpuPriceLow]      = useState(GPU_SPECS["L4"].price);
  const [gpuPriceHigh,     setGpuPriceHigh]     = useState(GPU_SPECS["L4"].priceHigh);
  const [serverPriceLow,   setServerPriceLow]   = useState(2500);
  const [serverPriceHigh,  setServerPriceHigh]  = useState(3000);
  const [storagePriceLow,  setStoragePriceLow]  = useState(60000);
  const [storagePriceHigh, setStoragePriceHigh] = useState(80000);
  const [cpuCores,         setCpuCores]         = useState(32);
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

  // ─── CALCULATE GPU CAPACITY PER SERVER (thermal/power constrained) ─────────
  const serverConfig = calculateServerConfig(gpuType, 1); // Get constraints for this GPU type
  const gpusPerServer = serverConfig.recommended; // Dynamically derived from thermal limits

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

    // Total active cameras = bottleneck (not sum), since all models share same camera streams
    // Network, storage, and CPU decoding are based on actual camera streams (not per-model)
    const totalActiveCameras = effectiveTotalCams;

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
    const totalBandwidthMbps = totalActiveCameras * bitratePerCam;
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
    const tbPerDay          = (gbPerDayPerCamera * totalActiveCameras) / 1024;
    let tbForRetention, pbWithRedundancy;
    if (storageEnabled && totalActiveCameras > 0) {
      tbForRetention   = tbPerDay * retentionDays;
      pbWithRedundancy = (tbForRetention * redundancyFactor) / 1024;
    } else {
      tbForRetention   = 0;
      pbWithRedundancy = 0;
    }

    const gpuCostLow      = gpusWithRedundancy * gpuPriceLow;
    const gpuCostHigh     = gpusWithRedundancy * gpuPriceHigh;
    const storageCostLow  = pbWithRedundancy * storagePriceLow;
    const storageCostHigh = pbWithRedundancy * storagePriceHigh;

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

    // ── DEPLOYMENT TIMELINE CALCULATION ─────────────────────────────────────
    const deploymentTimeline = calculateDeploymentTimeline(activeUcs, ucCameras, gpuType, gpusWithRedundancy);

    // ── CPU CORE REQUIREMENT CALCULATION ───────────────────────────────────────
    // Calculate both CPU-based and GPU-accelerated preprocessing scenarios
    // totalActiveCameras already calculated based on active use cases
    const cpuRequirements = calculateCpuRequirements(totalActiveCameras, bitratePerCam, totalFpsLoad, true);

    // ── UNIFIED SERVER RECOMMENDATION & COST ───────────────────────────────────────
    // cpuRequirements.gpuAccelerated.recommended = total cores the workload needs
    // cpuCores = user slider: cores each physical server provides
    // Server count = MAX(ceil(totalCores / coresPerServer), ceil(gpus / gpusPerServer))
    const unifiedServerRec = getUnifiedServerRecommendations(
      cpuRequirements.gpuAccelerated.recommended,  // total cores required by workload
      cpuCores,                                     // cores per server (slider)
      gpusWithRedundancy,
      gpusPerServer
    );
    
    // Unified server cost replaces both old serverCost and cpuServerCost
    const unifiedServerCostLow  = unifiedServerRec.totalServersNeeded * serverPriceLow;
    const unifiedServerCostHigh = unifiedServerRec.totalServersNeeded * serverPriceHigh;

    // ── TOTAL COST INTEGRATION ─────────────────────────────────────────────────
    // Now: GPU Hardware + Unified Servers (CPU+GPU) + Storage
    const totalCapexLow_v2   = gpuCostLow  + unifiedServerCostLow  + storageCostLow;
    const totalCapexHigh_v2  = gpuCostHigh + unifiedServerCostHigh + storageCostHigh;

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
      gpuCostLow, gpuCostHigh, unifiedServerCostLow, unifiedServerCostHigh,
      storageCostLow, storageCostHigh, totalCapexLow: totalCapexLow_v2, totalCapexHigh: totalCapexHigh_v2,
      cloudMonthlyHours, cloudMonthlyLow, cloudMonthlyHigh, cloudAnnualLow, cloudAnnualHigh,
      vehicleHasTracking, vehicleMultiplier, dominantType,
      deploymentTimeline,
      cpuRequirements,
      unifiedServerRec,
    };
  }, [cameras, bitratePerCam, gpuType, retentionDays, redundancyFactor, storageEnabled,
      gpuPriceLow, gpuPriceHigh, serverPriceLow, serverPriceHigh,
      storagePriceLow, storagePriceHigh, cpuCores,
      cloudPriceLow, cloudPriceHigh, modelFps, modelResIdx, ucCameras, enabledUcs,
      ucPipelineOverride, gpu, gpusPerServer]);

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
    {name:"GPU Hardware",    value:calc.gpuCostLow,             color:"#00d4aa"},
    {name:"Unified Servers", value:calc.unifiedServerCostLow,   color:"#3b82f6"},
    {name:"Storage",         value:calc.storageCostLow,         color:"#f59e0b"},
  ];
  const camGpuData = [
    {label:"Eff. Cameras", value:calc.effectiveTotalCams, fill:"#3b82f6"},
    {label:"GPUs",         value:calc.gpusWithRedundancy,  fill:"#00d4aa"},
    {label:"Servers",      value:calc.unifiedServerRec.totalServersNeeded, fill:"#8b5cf6"},
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

      .computed-field{margin-bottom:11px;padding:10px;background:var(--panel2);border:1px solid var(--border2);border-radius:7px;border-left:3px solid var(--accent2);}

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
            <div className="computed-field">
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:6}}>GPUs per Server</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:700,color:"var(--accent)"}}>{gpusPerServer}</div>
                <div style={{fontSize:9,color:"#64748b",lineHeight:1.3}}>
                  <div>Thermal constraint: {serverConfig.constraintLimiting === 'thermal' ? '🔴' : '🟢'} {serverConfig.maxByThermal} max</div>
                  <div>Power budget: {serverConfig.constraintLimiting === 'power' ? '🔴' : '🟢'} {serverConfig.maxByPower} max</div>
                </div>
              </div>
            </div>
            <SliderInput label="CPU Cores per Server" value={cpuCores} min={16} max={64} step={8} onChange={setCpuCores} 
              format={v=>`${v}-core`} />
            <div style={{fontSize:9,color:"#64748b",padding:"6px 8px",background:"#1e2d3d33",borderRadius:4,border:"1px solid #253347",marginTop:6}}>
              💡 Recommended: {calc.cpuRequirements.gpuAccelerated.recommended} cores for {cameras} cameras. Your selection: <strong>{cpuCores} cores</strong> {cpuCores < calc.cpuRequirements.gpuAccelerated.recommended ? '⚠️ Below recommendation' : cpuCores > calc.cpuRequirements.gpuAccelerated.recommended ? '✅ Above recommendation' : '✅ Matches recommendation'}
            </div>
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
            <div className="price-block">
              <div className="price-block-label">Unified Server Cost (USD)</div>
              <div style={{fontSize:9,color:"var(--muted)",marginBottom:8}}>
                {calc.unifiedServerRec.totalServersNeeded} × {calc.unifiedServerRec.coresPerServer}-core server (CPU + GPU slots)
              </div>
              <div className="price-range-row">
                <input type="number" value={serverPriceLow}  min={0} step={500} className="num-input" placeholder="Low"  onChange={e=>setServerPriceLow(Number(e.target.value))} />
                <span className="price-range-sep">–</span>
                <input type="number" value={serverPriceHigh} min={0} step={500} className="num-input" placeholder="High" onChange={e=>setServerPriceHigh(Number(e.target.value))} />
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
              {id:"cost",label:"💰 Cost"},{id:"timeline",label:"📅 Timeline"},
              {id:"models",label:"🎯 Models"},{id:"pipeline",label:"🔄 Pipeline"}]
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
                <MetricCard label="Unified Servers" value={calc.unifiedServerRec.totalServersNeeded} unit="servers" accent
                  sub={`${calc.unifiedServerRec.gpusPerServer} GPUs · ${calc.unifiedServerRec.coresPerServer} cores/server · CPU ${calc.unifiedServerRec.cpuUtilization}% · ${calc.unifiedServerRec.bottleneck} bottleneck`} />
                <MetricCard label="CPU Cores (GPU-Accel)" value={calc.cpuRequirements.gpuAccelerated.recommended} unit="cores"
                  sub={`Min: ${calc.cpuRequirements.gpuAccelerated.minimum}, ~${calc.cpuRequirements.gpuAccelerated.utilization}% load`} accent />
                <MetricCard label="Network BW" value={calc.bufferedGbps.toFixed(2)} unit="Gbps"
                  sub={`${calc.totalBandwidthGbps.toFixed(2)} raw + 20% buffer`} />
                <MetricCard label="Storage" value={storageEnabled ? calc.pbWithRedundancy.toFixed(2) : "1.00"} unit="TB"
                  sub={storageEnabled ? `${retentionDays}d × ${redundancyFactor}× redundancy` : "Default 1 TB — enable for full calc"} warn={storageEnabled} />
                <MetricCard label="VRAM Used" value={calc.totalMemNeeded.toFixed(1)} unit={`/ ${gpu.vram} GB`}
                  sub={`${calc.memRemaining.toFixed(1)} GB headroom`}
                  accent={calc.memFitsInGpu} warn={!calc.memFitsInGpu} />
                <MetricCard label="Total FPS Load" value={calc.totalFpsLoad.toLocaleString()} unit="fps"
                  sub="per-UC cameras × per-model fps" />
                <RangeCard label="Total CAPEX" low={fmtLacs(calc.totalCapexLow)} high={fmtLacs(calc.totalCapexHigh)}
                  sub="GPU Hardware + Unified Servers + Storage" />
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
              ) : cpuCores < calc.cpuRequirements.gpuAccelerated.recommended ? (
                <div className="alert alert-warn">
                  <span className="alert-icon">⚠️</span>
                  <span>CPU Core Warning: Selected <strong>{cpuCores} cores</strong> is below recommended <strong>{calc.cpuRequirements.gpuAccelerated.recommended} cores</strong> for {cameras} cameras with GPU-accelerated preprocessing.
                    You may experience bottlenecks at peak loads. Headroom: <strong>{cpuCores - calc.cpuRequirements.gpuAccelerated.minimum} cores</strong>.</span>
                </div>
              ) : cpuCores > calc.cpuRequirements.gpuAccelerated.recommended ? (
                <div className="alert alert-ok">
                  <span className="alert-icon">✅</span>
                  <span>CPU Configuration Excellent: <strong>{cpuCores} cores</strong> selected vs recommended <strong>{calc.cpuRequirements.gpuAccelerated.recommended}</strong>. 
                    Headroom: <strong>{cpuCores - calc.cpuRequirements.gpuAccelerated.minimum} cores</strong> for peak loads and system services.</span>
                </div>
              ) : (
                <div className="alert alert-ok">
                  <span className="alert-icon">✅</span>
                  <span>CPU Configuration Perfect: <strong>{cpuCores} cores</strong> = recommended. 
                    Headroom: <strong>{cpuCores - calc.cpuRequirements.gpuAccelerated.minimum} cores</strong> for peak loads and system services.</span>
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
                <MetricCard label="Servers" value={calc.unifiedServerRec.totalServersNeeded} unit="servers" sub={`${calc.unifiedServerRec.gpusPerServer} GPUs · ${calc.unifiedServerRec.bottleneck} bottleneck`} />
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
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                <span style={{marginRight:6}}>⚙️ CPU Core Requirements</span>
              </div>

              {/* CPU REQUIREMENTS COMPARISON */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {/* CPU-BASED PREPROCESSING */}
                <div style={{background:"linear-gradient(135deg, #ef444415, #ef444405)",border:"2px solid #ef444444",borderRadius:10,padding:"16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                    <span style={{fontSize:20}}>🔴</span>
                    <div>
                      <div style={{fontSize:9,color:"#ef4444",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>CPU-Based</div>
                      <div style={{fontSize:8,color:"#64748b"}}>Preprocessing on CPU</div>
                    </div>
                  </div>

                  <div style={{background:"#0d1420",borderRadius:6,padding:10,marginBottom:10}}>
                    <div style={{fontSize:8,color:"#94a3b8",marginBottom:6}}>Breakdown:</div>
                    <div style={{fontSize:9,color:"#64748b",lineHeight:1.8}}>
                      <div>Decoding: <span style={{color:"#ef4444",fontWeight:700}}>{calc.cpuRequirements.breakdown.decoding}</span> cores</div>
                      <div>Preprocessing: <span style={{color:"#ef4444",fontWeight:700}}>{calc.cpuRequirements.breakdown.preprocessCpuBased}</span> cores</div>
                      <div>NMS/Agg: <span style={{color:"#ef4444",fontWeight:700}}>{calc.cpuRequirements.breakdown.nms}</span> cores</div>
                      <div>System OH: <span style={{color:"#ef4444",fontWeight:700}}>{calc.cpuRequirements.breakdown.systemOverhead}</span> cores</div>
                    </div>
                  </div>

                  <div style={{background:"#7f1d1d55",borderRadius:6,padding:10,marginBottom:10}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:4}}>Cores Needed</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:28,fontWeight:700,color:"#ef4444",lineHeight:1}}>
                      {calc.cpuRequirements.cpuBased.recommended}
                    </div>
                    <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>
                      Minimum: {calc.cpuRequirements.cpuBased.minimum} (1.5× headroom)
                    </div>
                  </div>

                  <div style={{fontSize:9,color:"#ef4444",background:"#ef444410",border:"1px solid #ef444433",borderRadius:4,padding:8}}>
                    <strong>⚠️ NOT RECOMMENDED</strong> for {cameras} cameras. All preprocessing overhead on CPU causes bottlenecks.
                  </div>
                </div>

                {/* GPU-ACCELERATED PREPROCESSING */}
                <div style={{background:"linear-gradient(135deg, #00d4aa15, #00d4aa05)",border:"2px solid #00d4aa44",borderRadius:10,padding:"16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                    <span style={{fontSize:20}}>✅</span>
                    <div>
                      <div style={{fontSize:9,color:"#00d4aa",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>GPU-Accelerated</div>
                      <div style={{fontSize:8,color:"#64748b"}}>Preprocessing via CUDA</div>
                    </div>
                  </div>

                  <div style={{background:"#0d1420",borderRadius:6,padding:10,marginBottom:10}}>
                    <div style={{fontSize:8,color:"#94a3b8",marginBottom:6}}>Breakdown:</div>
                    <div style={{fontSize:9,color:"#64748b",lineHeight:1.8}}>
                      <div>Decoding: <span style={{color:"#00d4aa",fontWeight:700}}>{calc.cpuRequirements.breakdown.decoding}</span> cores</div>
                      <div>Preprocessing: <span style={{color:"#00d4aa",fontWeight:700}}>{calc.cpuRequirements.breakdown.preprocessGpuAccel}</span> cores</div>
                      <div>NMS/Agg: <span style={{color:"#00d4aa",fontWeight:700}}>{calc.cpuRequirements.breakdown.nms}</span> cores</div>
                      <div>System OH: <span style={{color:"#00d4aa",fontWeight:700}}>{calc.cpuRequirements.breakdown.systemOverhead}</span> cores</div>
                    </div>
                  </div>

                  <div style={{background:"#10b98155",borderRadius:6,padding:10,marginBottom:10}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:4}}>Cores Needed</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:28,fontWeight:700,color:"#00d4aa",lineHeight:1}}>
                      {calc.cpuRequirements.gpuAccelerated.recommended}
                    </div>
                    <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>
                      Minimum: {calc.cpuRequirements.gpuAccelerated.minimum} (1.5× headroom)
                    </div>
                  </div>

                  <div style={{fontSize:9,color:"#00d4aa",background:"#00d4aa10",border:"1px solid #00d4aa33",borderRadius:4,padding:8}}>
                    <strong>✅ RECOMMENDED</strong> for factory deployment. Minimal CPU overhead with GPU acceleration.
                  </div>
                </div>
              </div>

              {showFormulas && (
                <div className="formula-section">
                  <div className="formula-section-title">⟨/⟩ CPU Requirement Formulas</div>
                  <div className="formula-grid">
                    <FormulaBox label="Video Decoding" formula={`(${cameras} cams × ${calc.cpuRequirements.bitratePerCam} Mbps) / 600 Mbps per core`} result={`${calc.cpuRequirements.breakdown.decoding} cores`} />
                    <FormulaBox label="Preprocessing (CPU-based)" formula={`${calc.cpuRequirements.totalFpsLoad} fps × 0.0004 cores/fps`} result={`${calc.cpuRequirements.breakdown.preprocessCpuBased} cores`} />
                    <FormulaBox label="Preprocessing (GPU-accel)" formula={`${calc.cpuRequirements.totalFpsLoad} fps × 0.00008 cores/fps`} result={`${calc.cpuRequirements.breakdown.preprocessGpuAccel} core${calc.cpuRequirements.breakdown.preprocessGpuAccel !== 1 ? 's' : ''}`} />
                    <FormulaBox label="NMS + System Overhead" formula={`${calc.cpuRequirements.breakdown.nms} + ${calc.cpuRequirements.breakdown.systemOverhead}`} result={`${calc.cpuRequirements.breakdown.nms + calc.cpuRequirements.breakdown.systemOverhead} cores`} />
                    <FormulaBox label="CPU-Based Total" formula={`Σ breakdowns = ${calc.cpuRequirements.cpuBased.minimum}`} result={`× 1.5 = ${calc.cpuRequirements.cpuBased.recommended} cores (recommended)`} />
                    <FormulaBox label="GPU-Accel Total" formula={`Σ breakdowns = ${calc.cpuRequirements.gpuAccelerated.minimum}`} result={`× 1.5 = ${calc.cpuRequirements.gpuAccelerated.recommended} cores (recommended)`} />
                  </div>
                </div>
              )}

              <div style={{background:"linear-gradient(135deg, #06b6d415, #06b6d405)",border:"1px solid #06b6d644",borderRadius:8,padding:14,marginBottom:20}}>
                <div style={{fontSize:9,color:"#06b6d4",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>💡 Recommendation</div>
                <div style={{fontSize:9,color:"#94a3b8",lineHeight:1.6}}>
                  For your configuration ({cameras} cameras @ {calc.cpuRequirements.totalFpsLoad.toLocaleString()} fps):
                  <br/>
                  <strong style={{color:"#06b6d4"}}>Use {calc.cpuRequirements.gpuAccelerated.recommended}-core CPU with GPU-accelerated preprocessing.</strong>
                  <br/>
                  This leaves {(calc.cpuRequirements.gpuAccelerated.recommended - calc.cpuRequirements.gpuAccelerated.minimum)}–{(calc.cpuRequirements.gpuAccelerated.recommended - calc.cpuRequirements.gpuAccelerated.minimum - 2)} cores headroom for peak loads and system activities.
                  <br/>
                  <span style={{color:"#64748b",display:"block",marginTop:6}}>Popular choice: AMD EPYC 7302P (32-core, ~$4,500) or Intel Xeon Platinum (32-40 core range)</span>
                </div>
              </div>
              <div className="divider" />
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                <span style={{marginRight:6}}>⚙️ CPU Cores Selection & Server Cost</span>
              </div>

              {/* CPU CORES COMPARISON & COST */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {/* RECOMMENDED */}
                <div style={{background:"linear-gradient(135deg, #f59e0b15, #f59e0b05)",border:"2px solid #f59e0b44",borderRadius:10,padding:"16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                    <span style={{fontSize:20}}>📊</span>
                    <div>
                      <div style={{fontSize:9,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Recommended</div>
                      <div style={{fontSize:8,color:"#64748b"}}>Best Practice</div>
                    </div>
                  </div>

                  <div style={{background:"#0d1420",borderRadius:6,padding:10,marginBottom:10}}>
                    <div style={{fontSize:14,fontFamily:"var(--mono)",fontWeight:700,color:"#f59e0b",marginBottom:6}}>
                      {calc.cpuRequirements.gpuAccelerated.recommended} cores
                    </div>
                    <div style={{fontSize:9,color:"#94a3b8",lineHeight:1.6}}>
                      For {cameras} cameras @ {calc.cpuRequirements.totalFpsLoad.toLocaleString()} fps with GPU-acceleration
                      <br/><span style={{color:"#64748b"}}>Minimum needed: {calc.cpuRequirements.gpuAccelerated.minimum} | Headroom: {calc.cpuRequirements.gpuAccelerated.recommended - calc.cpuRequirements.gpuAccelerated.minimum} cores</span>
                    </div>
                  </div>

                  <div style={{background:"#a16207aa",borderRadius:6,padding:10,marginBottom:8}}>
                    <div style={{fontSize:9,color:"#64748b"}}>Server Config</div>
                    <div style={{fontSize:10,fontWeight:700,color:"#fbbf24",marginTop:2}}>
                      {(() => {
                        const rec = getUnifiedServerRecommendations(calc.cpuRequirements.gpuAccelerated.recommended, cpuCores, calc.gpusWithRedundancy, gpusPerServer);
                        return `${rec.totalServersNeeded} servers · ${rec.cpuServersNeeded} CPU / ${rec.gpuServersNeeded} GPU driven`;
                      })()}
                    </div>
                  </div>

                  <div style={{fontSize:8,color:"#f59e0b",background:"#f59e0b10",border:"1px solid #f59e0b33",borderRadius:4,padding:6}}>
                    Use case-optimized configuration
                  </div>
                </div>

                {/* SELECTED */}
                <div style={{background:"linear-gradient(135deg, #06b6d415, #06b6d405)",border:`2px solid ${cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#06b6d444" : "#ef444444"}`,borderRadius:10,padding:"16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                    <span style={{fontSize:20}}>🎛️</span>
                    <div>
                      <div style={{fontSize:9,color:cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#06b6d4" : "#ef4444",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Your Selection</div>
                      <div style={{fontSize:8,color:"#64748b"}}>Unified Configuration</div>
                    </div>
                  </div>

                  <div style={{background:"#0d1420",borderRadius:6,padding:10,marginBottom:10}}>
                    <div style={{fontSize:14,fontFamily:"var(--mono)",fontWeight:700,color:cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#06b6d4" : "#ef4444",marginBottom:6}}>
                      {cpuCores} cores
                    </div>
                    <div style={{fontSize:9,color:"#94a3b8",lineHeight:1.6}}>
                      {cpuCores === calc.cpuRequirements.gpuAccelerated.recommended ? "✅ Matches recommendation perfectly" : cpuCores > calc.cpuRequirements.gpuAccelerated.recommended ? `✅ ${cpuCores - calc.cpuRequirements.gpuAccelerated.recommended} cores above recommended` : `⚠️ ${calc.cpuRequirements.gpuAccelerated.recommended - cpuCores} cores below recommended`}
                      <br/><span style={{color:"#64748b"}}>Headroom: {cpuCores - calc.cpuRequirements.gpuAccelerated.minimum} cores</span>
                    </div>
                  </div>

                  <div style={{background:cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#1e3a8a55" : "#7f1d1d55",borderRadius:6,padding:10,marginBottom:8}}>
                    <div style={{fontSize:9,color:"#64748b"}}>Server Config</div>
                    <div style={{fontSize:10,fontWeight:700,color:cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#60a5fa" : "#fca5a5",marginTop:2}}>
                      {calc.unifiedServerRec.totalServersNeeded} × {calc.unifiedServerRec.coresPerServer}-core server
                    </div>
                  </div>

                  <div style={{fontSize:8,color:cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#06b6d4" : "#ef4444",background:cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#06b6d410" : "#ef444410",border:`1px solid ${cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "#06b6d433" : "#ef444433"}`,borderRadius:4,padding:6}}>
                    {cpuCores >= calc.cpuRequirements.gpuAccelerated.recommended ? "✅ Safe for production" : "⚠️ May experience bottlenecks"}
                  </div>
                </div>
              </div>

              {/* SERVER COST BREAKDOWN */}
              <div style={{background:"linear-gradient(135deg, #06b6d415, #06b6d405)",border:"1px solid #06b6d644",borderRadius:8,padding:14,marginBottom:20}}>
                <div style={{fontSize:10,fontWeight:700,color:"#06b6d4",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>💰 Unified Server Cost Analysis</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:9,color:"#64748b"}}>Servers Needed</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#06b6d4",marginTop:2}}>{calc.unifiedServerRec.totalServersNeeded}</div>
                    <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>{calc.unifiedServerRec.totalCoreCoverage} cores + {calc.unifiedServerRec.totalGpuSlots} GPU slots</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#64748b"}}>Per Server</div>
                    <div style={{fontSize:11,fontWeight:700,color:"#06b6d4",marginTop:2,fontFamily:"var(--mono)"}}>
                      {fmtLacs(serverPriceLow)} – {fmtLacs(serverPriceHigh)}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#64748b"}}>Total Cost</div>
                    <div style={{fontSize:11,fontWeight:700,color:"#06b6d4",marginTop:2,fontFamily:"var(--mono)"}}>
                      {fmtLacs(calc.unifiedServerCostLow)} – {fmtLacs(calc.unifiedServerCostHigh)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider" />
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                🖥️ Unified Server Configuration
              </div>

              {/* Single unified server card */}
              <div style={{background:"linear-gradient(135deg,#3b82f615,#3b82f605)",border:"2px solid #3b82f644",borderRadius:10,padding:"16px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                  <span style={{fontSize:22}}>✅</span>
                  <div>
                    <div style={{fontSize:9,color:"#3b82f6",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Unified Servers (CPU + GPU)</div>
                    <div style={{fontSize:8,color:"#64748b"}}>Each server handles both video decode/preprocess (CPU) and AI inference (GPU)</div>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  <div style={{background:"#0d1420",borderRadius:6,padding:10}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:4}}>Servers Needed</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:26,fontWeight:700,color:"#3b82f6",lineHeight:1}}>{calc.unifiedServerRec.totalServersNeeded}</div>
                    <div style={{fontSize:8,color:"#94a3b8",marginTop:4}}>
                      max(CPU:{calc.unifiedServerRec.cpuServersNeeded}, GPU:{calc.unifiedServerRec.gpuServersNeeded}) servers
                    </div>
                  </div>
                  <div style={{background:"#0d1420",borderRadius:6,padding:10}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:4}}>GPUs / Server</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:26,fontWeight:700,color:"#00d4aa",lineHeight:1}}>{calc.unifiedServerRec.gpusPerServer}</div>
                    <div style={{fontSize:8,color:"#94a3b8",marginTop:4}}>
                      {calc.gpusWithRedundancy} total ÷ {calc.unifiedServerRec.totalServersNeeded} servers
                    </div>
                  </div>
                  <div style={{background:"#0d1420",borderRadius:6,padding:10}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:4}}>Bottleneck</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:700,color:calc.unifiedServerRec.bottleneck==="CPU"?"#f59e0b":calc.unifiedServerRec.bottleneck==="GPU"?"#ef4444":"#00d4aa",lineHeight:1,marginTop:4}}>{calc.unifiedServerRec.bottleneck}</div>
                    <div style={{fontSize:8,color:"#94a3b8",marginTop:4}}>limiting factor</div>
                  </div>
                </div>

                <div style={{background:"#0d1420",borderRadius:6,padding:10,marginBottom:10}}>
                  <div style={{fontSize:9,color:"#94a3b8",marginBottom:6,fontWeight:700}}>{calc.unifiedServerRec.coresPerServer}-core server · {calc.unifiedServerRec.gpusPerServer} GPUs/server</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:9,color:"#64748b",lineHeight:1.8}}>
                    <div>
                      • CPU cores/server: <span style={{color:"#f1f5f9",fontWeight:700}}>{calc.unifiedServerRec.coresPerServer}</span><br/>
                      • Total cores: <span style={{color:"#f1f5f9",fontWeight:700}}>{calc.unifiedServerRec.totalCoreCoverage}</span> ({calc.unifiedServerRec.cpuHeadroom} headroom)<br/>
                      • CPU utilization: <span style={{color:"#f59e0b",fontWeight:700}}>{calc.unifiedServerRec.cpuUtilization}%</span>
                    </div>
                    <div>
                      • GPU slots/server: <span style={{color:"#f1f5f9",fontWeight:700}}>{calc.unifiedServerRec.gpusPerServer}</span><br/>
                      • Total GPU slots: <span style={{color:"#f1f5f9",fontWeight:700}}>{calc.unifiedServerRec.totalGpuSlots}</span><br/>
                      • GPU utilization: <span style={{color:"#00d4aa",fontWeight:700}}>{calc.unifiedServerRec.gpuUtilization}%</span>
                    </div>
                  </div>
                </div>

                <div style={{fontSize:9,color:"#3b82f6",background:"#3b82f610",border:"1px solid #3b82f633",borderRadius:4,padding:8}}>
                  <strong>Formula:</strong> servers = max(⌈{calc.unifiedServerRec.totalCoresRequired} total cores ÷ {calc.unifiedServerRec.coresPerServer} cores/server⌉, ⌈{calc.gpusWithRedundancy} GPUs ÷ {calc.unifiedServerRec.gpusPerServer} GPUs/server⌉) = max({calc.unifiedServerRec.cpuServersNeeded}, {calc.unifiedServerRec.gpuServersNeeded}) = <strong>{calc.unifiedServerRec.totalServersNeeded}</strong>
                </div>
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
                      {label:`🖥 Unified Servers (${calc.unifiedServerRec.totalServersNeeded} units)`, lo:calc.unifiedServerCostLow, hi:calc.unifiedServerCostHigh, color:"#3b82f6"},
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
                    <FormulaBox label="Server Range" formula={`${calc.unifiedServerRec.totalServersNeeded} servers × ($${serverPriceLow.toLocaleString()} – $${serverPriceHigh.toLocaleString()})`} result={`${fmtLacs(calc.unifiedServerCostLow)} – ${fmtLacs(calc.unifiedServerCostHigh)}`} />
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
                  · {calc.unifiedServerRec.totalServersNeeded} servers @ {calc.unifiedServerRec.gpusPerServer} GPUs each
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

            {/* ══════ TIMELINE ══════ */}
            {activeTab==="timeline" && (<>
              <div className="alert alert-ok" style={{marginBottom:16}}>
                <span className="alert-icon">📅</span>
                <span>Comprehensive deployment timeline with detailed phase breakdown, team resources, risks, and contingencies for full factory AI deployment.</span>
              </div>

              {/* Overall timeline summary - COMPRESSED, 3-6 MONTHS */}
              <div style={{background:"linear-gradient(135deg, #06b6d415, #06b6d405)",border:"2px solid #06b6d444",borderRadius:10,padding:"18px",marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#06b6d4",textTransform:"uppercase",letterSpacing:1}}>Total Deployment Timeline (3-6 Months)</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:32,fontWeight:700,color:"#f1f5f9",marginTop:6,marginBottom:3}}>
                      {calc.deploymentTimeline.total.toFixed(1)} weeks
                    </div>
                    <div style={{fontSize:10,color:"#64748b"}}>
                      ≈ {calc.deploymentTimeline.totalDays} days ({calc.deploymentTimeline.totalMonths} months)
                    </div>
                  </div>
                  <div style={{background:"#06b6d610",border:"1px solid #06b6d633",borderRadius:8,padding:"10px 14px",textAlign:"right"}}>
                    <div style={{fontSize:8,color:"#94a3b8",marginBottom:6}}>With 20% Contingency</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:700,color:"#60a5fa"}}>
                      {(calc.deploymentTimeline.total * 1.2).toFixed(1)} wks
                    </div>
                    <div style={{fontSize:8,color:"#64748b"}}>({Math.round(calc.deploymentTimeline.totalDays * 1.2)} days)</div>
                  </div>
                </div>
                <div style={{fontSize:9,color:"#94a3b8",lineHeight:1.6,marginTop:12,paddingTop:12,borderTop:"1px solid #06b6d633"}}>
                  <strong>{calc.activeUcs.length} use case{calc.activeUcs.length !== 1 ? 's' : ''}</strong> across <strong>{calc.deploymentTimeline.activeHeaderCount} header{calc.deploymentTimeline.activeHeaderCount !== 1 ? 's' : ''}</strong> • <strong>{calc.deploymentTimeline.totalCameras} cameras</strong>
                  <br/>
                  <strong>Infrastructure:</strong> <span style={{color:"#94a3b8"}}>PRE-PHASE (assumed complete)</span>
                  <br/>
                  <strong>Critical path:</strong> Model Prep → Camera Staging (parallel) → Parallel Deployment ({calc.deploymentTimeline.activeHeaderCount} headers) → Testing → Go-Live
                </div>
              </div>

              {/* Phase sequence diagram - COMPRESSED */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                Compressed Phase Timeline (Infrastructure Pre-Phase)
              </div>
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:9,padding:"16px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:9,color:"#94a3b8"}}>
                  <span style={{color:"#ef4444",fontWeight:700}}>📦 PRE</span> Infrastructure Setup (assumed complete - skip to deployment)
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:9,color:"#94a3b8"}}>
                  <span style={{color:"#f59e0b",fontWeight:700}}>↓ Week 1</span> Model Prep & Camera Staging (parallel start)
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:9,color:"#94a3b8"}}>
                  <span style={{color:"#00d4aa",fontWeight:700}}>↓ Week 2-4</span> {calc.deploymentTimeline.activeHeaderCount} Headers Deploy in Parallel (models + cameras)
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:9,color:"#94a3b8"}}>
                  <span style={{color:"#8b5cf6",fontWeight:700}}>↓ Week 4-5</span> Integration Testing & Cross-Header Validation
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:9,color:"#94a3b8"}}>
                  <span style={{color:"#06b6d4",fontWeight:700}}>↓ Week 5</span> System Validation & Stress Testing
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:9,color:"#94a3b8"}}>
                  <span style={{color:"#ec4899",fontWeight:700}}>↓ Week 5-6</span> Go-Live & Phased Rollout
                </div>
              </div>

              {/* Detailed phases breakdown - HEADER BASED */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                Deployment by Functions
              </div>
              
              {/* Header cards - each deployed in parallel weeks 2-4 */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
                {calc.deploymentTimeline.headerBreakdowns && calc.deploymentTimeline.headerBreakdowns.map((header, idx) => {
                  const activeUcsInHeader = ALL_USE_CASES.filter(uc => uc.model === header.id && calc.activeUcs.includes(uc));
                  return (
                    <div key={header.id} style={{background:"var(--panel)",border:`1px solid ${header.color}44`,borderLeft:`4px solid ${header.color}`,borderRadius:9,padding:"14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:header.color}}>📦 {header.name}</div>
                          <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>
                            {header.usecaseCount} use case{header.usecaseCount > 1 ? 's' : ''} • {header.cameras} cameras
                          </div>
                        </div>
                        <div style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:header.color,textAlign:"right"}}>
                          Week 2-4<br/>
                          <span style={{fontSize:8,color:"#94a3b8",fontWeight:400}}>parallel</span>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:8,color:"#94a3b8",background:`${header.color}10`,border:`1px solid ${header.color}22`,borderRadius:6,padding:"8px"}}>
                        <div>
                          <strong style={{color:header.color}}>Model Prep</strong><br/>
                          {DEPLOYMENT_PHASES.modelPrep.toFixed(1)} wks
                        </div>
                        <div>
                          <strong style={{color:header.color}}>Deploy</strong><br/>
                          {DEPLOYMENT_PHASES.parallelDeploymentPerHeader.toFixed(1)} wks
                        </div>
                      </div>
                      <div style={{fontSize:8,color:"#94a3b8",marginTop:8,lineHeight:1.6}}>
                        <div style={{marginBottom:4}}><strong>UCs:</strong> {header.usecaseIds.map(id => `#${id}`).join(", ")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compressed deployment phases - brief */}
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:20}}>
                {/* MODEL PREP */}
                <div style={{background:"var(--panel)",border:"1px solid #f5a62344",borderLeft:"4px solid #f59e0b",borderRadius:9,padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:"#fcd34d"}}>🚀 Week 1: Model Prep & Camera Staging (Parallel Start)</div>
                      <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>Foundations: {DEPLOYMENT_PHASES.modelPrep.toFixed(1)} wk model, {DEPLOYMENT_PHASES.cameraStagingInfra.toFixed(1)} wk staging</div>
                    </div>
                  </div>
                  <div style={{background:"#f5a62315",border:"1px solid #f5a62333",borderRadius:6,padding:"10px",fontSize:8,color:"#94a3b8",lineHeight:1.8}}>
                    <strong style={{color:"#fcd34d"}}>• Model Prep:</strong> CUDA/cuDNN/TensorRT setup, download base models, DeepStream config<br/>
                    <strong style={{color:"#fcd34d"}}>• Camera Staging:</strong> Cable runs, PoE infrastructure, network discovery, VLAN setup - teams work in parallel by area
                  </div>
                </div>

                {/* DEPLOYMENT */}
                <div style={{background:"var(--panel)",border:"1px solid #00d4aa44",borderLeft:"4px solid #00d4aa",borderRadius:9,padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:"#6ee7b7"}}>⚡ Week 2-4: Parallel Deployment ({calc.deploymentTimeline.activeHeaderCount} Headers)</div>
                      <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>Each header deploys models + integrates cameras simultaneously (~{DEPLOYMENT_PHASES.parallelDeploymentPerHeader.toFixed(1)} weeks all complete within this window)</div>
                    </div>
                  </div>
                  <div style={{background:"#00d4aa15",border:"1px solid #00d4aa33",borderRadius:6,padding:"10px",fontSize:8,color:"#94a3b8",lineHeight:1.8}}>
                    <strong style={{color:"#6ee7b7"}}>Per-Header Work (independent teams):</strong><br/>
                    • Model tuning (confidence thresholds, filtering, post-processing)<br/>
                    • Camera calibration (focus, exposure, resolution per location)<br/>
                    • Integration testing (model on live feeds from this header)<br/>
                    ✓ <strong>All {calc.deploymentTimeline.activeHeaderCount} headers complete deployment within same 2-week window</strong>
                  </div>
                </div>

                {/* TESTING */}
                <div style={{background:"var(--panel)",border:"1px solid #8b5cf644",borderLeft:"4px solid #8b5cf6",borderRadius:9,padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:"#d8b4fe"}}>🧪 Week 4-5: Integration Testing ({DEPLOYMENT_PHASES.integrationTesting.toFixed(1)} wk)</div>
                      <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>Cross-header validation and system integration</div>
                    </div>
                  </div>
                  <div style={{background:"#8b5cf610",border:"1px solid #8b5cf622",borderRadius:6,padding:"10px",fontSize:8,color:"#94a3b8",lineHeight:1.8}}>
                    • Multi-header false-positive reduction (coordinated model tuning)<br/>
                    • Cross-header scene understanding (headers don't conflict)<br/>
                    • Accuracy baseline measurement (per-UC metrics)<br/>
                    • Performance optimization (tune batch sizes, throughput)
                  </div>
                </div>

                {/* VALIDATION + GO-LIVE */}
                <div style={{background:"var(--panel)",border:"1px solid #06b6d444",borderLeft:"4px solid #06b6d4",borderRadius:9,padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:"#67e8f9"}}>✅ Week 5-6: System Validation & Go-Live ({(DEPLOYMENT_PHASES.systemValidation + DEPLOYMENT_PHASES.goLive).toFixed(1)} wk)</div>
                      <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>Full-system test then phased production rollout</div>
                    </div>
                  </div>
                  <div style={{background:"#06b6d410",border:"1px solid #06b6d622",borderRadius:6,padding:"10px",fontSize:8,color:"#94a3b8",lineHeight:1.8}}>
                    <strong style={{color:"#67e8f9"}}>System Validation:</strong> All {calc.deploymentTimeline.totalCameras} cameras + models running, stress test (peak load), edge cases<br/>
                    <strong style={{color:"#67e8f9"}}>Go-Live:</strong> Phased rollout (10% → 50% → 100%), monitoring dashboard active, ops team trained, on-call support ready
                  </div>
                </div>
              </div>

              {/* Old phase cards removed - using compressed header-based timeline instead */}
              {/* Timeline UI cleanly updated to show 3-6 month deployment by functional headers */}

              {/* Critical bottlenecks */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                ⚡ Critical Bottlenecks & Mitigation
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                <div style={{background:"#f5a62310",border:"1px solid #f5a62333",borderRadius:8,padding:"10px"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#f59e0b",marginBottom:6}}>🔴 GPU Supply Chain Delay</div>
                  <div style={{fontSize:8.5,color:"#94a3b8",lineHeight:1.6}}>
                    <strong>Impact:</strong> +1-2 weeks delay<br/>
                    <strong>Mitigation:</strong> Order 4-8 weeks before deployment, have backup GPU SKUs pre-approved, negotiate expedited shipping
                  </div>
                </div>
                <div style={{background:"#f5a62310",border:"1px solid #f5a62333",borderRadius:8,padding:"10px"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#f59e0b",marginBottom:6}}>🔴 Model Accuracy Issues</div>
                  <div style={{fontSize:8.5,color:"#94a3b8",lineHeight:1.6}}>
                    <strong>Impact:</strong> +1-3 weeks rework<br/>
                    <strong>Mitigation:</strong> Collect training data early, start model tuning in parallel, have diversity in lighting/angles
                  </div>
                </div>
                <div style={{background:"#f5a62310",border:"1px solid #f5a62333",borderRadius:8,padding:"10px"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#f59e0b",marginBottom:6}}>🔴 Site Access Constraints</div>
                  <div style={{fontSize:8.5,color:"#94a3b8",lineHeight:1.6}}>
                    <strong>Impact:</strong> +0.5-1 week delays<br/>
                    <strong>Mitigation:</strong> Coordinate with facilities early, get access schedules, pre-plan cable routes
                  </div>
                </div>
                <div style={{background:"#f5a62310",border:"1px solid #f5a62333",borderRadius:8,padding:"10px"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#f59e0b",marginBottom:6}}>🔴 Network Congestion</div>
                  <div style={{fontSize:8.5,color:"#94a3b8",lineHeight:1.6}}>
                    <strong>Impact:</strong> +0.5-1 week discovery phase<br/>
                    <strong>Mitigation:</strong> Run bandwidth audit upfront, upgrade switches/NICs before deployment
                  </div>
                </div>
              </div>

              {/* Per-use-case model deployment time (NOT including shared camera integration) */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                📊 Per-Use-Case Deployment Time (Model Only, Camera Integration Shared)
              </div>
              <div style={{background:"#06b6d410",border:"1px solid #06b6d633",borderRadius:9,padding:"12px",marginBottom:12}}>
                <div style={{fontSize:8.5,color:"#94a3b8",lineHeight:1.6}}>
                  <strong style={{color:"#00d4aa"}}>⚠️ Important:</strong> Camera integration (320 cameras) is handled once during Week 1-2 (Camera Staging phase), not per-UC. 
                  Each UC below shows only its <strong>model deployment</strong> time (within the parallel deployment window weeks 2-4).
                </div>
              </div>

              {/* Chart: Use Case Deployment Timeline */}
              {calc.deploymentTimeline.useCaseBreakdown && calc.deploymentTimeline.useCaseBreakdown.length > 0 ? (
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:9,padding:"16px",marginBottom:20}}>
                <div style={{fontSize:9,fontWeight:700,color:"#f1f5f9",marginBottom:12}}>Deployment Time per Use Case (Weeks)</div>
                <ResponsiveContainer width="100%" height={Math.max(300, calc.deploymentTimeline.useCaseBreakdown.length * 25)}>
                  <BarChart
                    data={calc.deploymentTimeline.useCaseBreakdown.map(uc => ({
                      name: `#${uc.n}`,
                      label: uc.label.substring(0, 35) + (uc.label.length > 35 ? "..." : ""),
                      weeks: parseFloat(uc.estimatedWeeks.toFixed(1)),
                      color: uc.headerColor,
                      fullLabel: uc.label,
                    }))}
                    margin={{top:5,right:30,left:250,bottom:5}}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748b" fontSize={11} />
                    <YAxis 
                      type="category" 
                      dataKey="label" 
                      stroke="#64748b" 
                      fontSize={9}
                      width={240}
                    />
                    <Tooltip
                      contentStyle={{background:"#1e293b",border:"1px solid #475569",borderRadius:6,fontSize:11}}
                      formatter={(value) => [`${value} weeks`, "Deployment Time"]}
                      labelFormatter={(label) => `UC ${label}`}
                    />
                    <Bar dataKey="weeks" fill="#00d4aa" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{fontSize:8,color:"#94a3b8",marginTop:12,lineHeight:1.6}}>
                  <strong>📌 Note:</strong> Each bar shows model deployment time only. All UCs in same header group (e.g., PPE cases #2,#3,#13) can run in parallel.
                  Chart helps identify which use cases have longest model complexity requirements.
                </div>
              </div>
              ) : (
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:9,padding:"16px",marginBottom:20,textAlign:"center"}}>
                <div style={{fontSize:10,color:"#94a3b8"}}>No use cases selected. Enable at least one use case to see deployment timeline.</div>
              </div>
              )}

              {/* Detailed per-UC breakdown list */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                📋 Detailed Per-Use-Case Breakdown
              </div>
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:9,marginBottom:20,overflow:"hidden"}}>
                {calc.deploymentTimeline.useCaseBreakdown.map((uc, idx) => (
                  <div key={idx} style={{borderBottom: idx < calc.deploymentTimeline.useCaseBreakdown.length - 1 ? "1px solid var(--border)" : "none",padding:"12px",background:idx%2===0?"transparent":"#ffffff02"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:9,fontWeight:700,color:"#f1f5f9",marginBottom:2}}>#{uc.n} — {uc.label}</div>
                        <div style={{fontSize:8,color:"#94a3b8"}}>
                          Header: <strong style={{color:uc.headerColor}}>{uc.header}</strong> •  
                          Pipeline: <strong style={{color:"#f59e0b"}}>{uc.modelComplexity}</strong> • 
                          Cameras: <strong style={{color:"#3b82f6"}}>{uc.cameras}</strong>
                        </div>
                      </div>
                      <div style={{fontFamily:"var(--mono)",fontSize:12,fontWeight:700,color:"#00d4aa",textAlign:"right",minWidth:"90px"}}>
                        {uc.estimatedWeeks.toFixed(1)} wks
                        <div style={{fontSize:8,color:"#94a3b8",fontWeight:400}}>model only</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:8,color:"#94a3b8",marginTop:6}}>
                      <div style={{background:"#f5a62315",border:"1px solid #f5a62333",borderRadius:4,padding:"8px"}}>
                        <strong style={{color:"#fcd34d"}}>🤖 Model Deployment</strong><br/>
                        {uc.estimatedWeeks.toFixed(1)} wks<br/>
                        <span style={{fontSize:7}}>{uc.modelComplexity}</span>
                      </div>
                      <div style={{background:"#06b6d410",border:"1px solid #06b6d622",borderRadius:4,padding:"8px"}}>
                        <strong style={{color:"#67e8f9"}}>📚 Testing (UC portion)</strong><br/>
                        ~0.3 wks<br/>
                        <span style={{fontSize:7}}>(within shared testing phase)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Shared camera integration note */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                🎥 Shared Camera Infrastructure (Week 1-2)
              </div>
              <div style={{background:"#3b82f610",border:"1px solid #3b82f622",borderRadius:9,padding:"14px",marginBottom:20}}>
                <div style={{fontSize:9,fontWeight:700,color:"#93c5fd",marginBottom:8}}>All 320 Cameras Installed in Parallel</div>
                <div style={{fontSize:8.5,color:"#94a3b8",lineHeight:1.8}}>
                  <strong>Timeline:</strong> Week 1-2 (parallel with Model Prep)<br/>
                  <strong>Tasks:</strong> Cable runs, PoE infrastructure, network discovery, VLAN setup, camera discovery<br/>
                  <strong>Work Estimate:</strong> 320 cameras × 2.5 hrs/camera = 800 hours ÷ 40 hrs/week ÷ 3-4 tech teams = ~1-2 weeks<br/>
                  <strong>Cost:</strong> Single infrastructure investment (not per-UC)<br/>
                  <strong>Impact:</strong> Once complete, all use cases benefit from camera availability simultaneously
                </div>
              </div>
              
              {/* Timeline sequence summary */}
              <div style={{fontSize:10,fontWeight:700,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:12}}>
                ⏱️ Execution Sequence Summary
              </div>
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:9,padding:"14px",fontSize:9,color:"#94a3b8",lineHeight:2}}>
                <div><strong style={{color:"#ef4444"}}>1. Infrastructure (shared, happens first):</strong> {Math.ceil(calc.deploymentTimeline.phases.infrastructure)} weeks setup time</div>
                <div><strong style={{color:"#f59e0b"}}>2. Model deployment & camera integration (parallel):</strong> Run simultaneously, longest determines phase duration</div>
                <div style={{paddingLeft:16}}>• Model: {Math.ceil(calc.deploymentTimeline.phases.modelDeployment)} weeks (depends on pipeline complexity)</div>
                <div style={{paddingLeft:16}}>• Cameras: {Math.ceil(calc.deploymentTimeline.phases.cameraIntegration)} weeks ({calc.deploymentTimeline.useCaseBreakdown.reduce((s,u)=>s+u.cameras,0)} cameras × 2.5 hrs each)</div>
                <div><strong style={{color:"#8b5cf6"}}>3. Testing & validation:</strong> {Math.ceil(calc.deploymentTimeline.phases.testing)} weeks (after cameras ready)</div>
                <div><strong style={{color:"#06b6d4"}}>4. Go-live & handover:</strong> {Math.ceil(calc.deploymentTimeline.phases.goLive)} weeks (phased rollout + ops transition)</div>
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)",fontStyle:"italic"}}>
                  <strong>Formula:</strong> Infrastructure + max(Models, Cameras) + Testing + Go-Live = <strong style={{color:"#00d4aa"}}>{calc.deploymentTimeline.total.toFixed(1)} weeks total</strong>
                </div>
              </div>
            </>)}

          </div>
        </div>
      </div>
    </div>
  </>);
}
