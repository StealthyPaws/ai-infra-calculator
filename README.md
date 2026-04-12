# ⚡ AI Infrastructure Calculator

> Plan your GPU, compute, storage, and cost requirements **before** you build — not after you've already bought the wrong hardware.

A free, open-source infrastructure sizing tool for anyone building real-time AI systems. Works across industries: computer vision, NLP, audio AI, recommendation engines, LLM inference, and more.

---

## Why This Exists

Most AI infrastructure planning happens in one of two ways:

1. **The optimistic way** — you estimate "a few GPUs should be fine" and discover three weeks post-deployment that your inference pipeline is bottlenecking, your storage is filling up in days instead of months, and your servers are running at 95% CPU.

2. **The expensive way** — someone pads the estimate with large safety margins, procures too much hardware, and you end up with a room full of underutilized servers on a 3-year lease.

This calculator is the middle path: bottoms-up sizing based on actual throughput math, VRAM requirements, network bandwidth, and real cost ranges across on-prem and cloud deployment models.

**The goal isn't to give you a perfect answer — it's to give you a defensible starting point before you commit budget.**

---

## What It Calculates

### ⚡ Compute (GPU + CPU)
- GPU count from **IPS (inferences/second) throughput model**, not vague "stream" estimates
- Resolution-aware: a model at 960×960 costs 2.25× more compute than the same model at 640×640
- Handles multi-task workloads — all active AI tasks share the same GPU fleet
- Servers derived from thermal/power constraints per GPU type
- CPU core recommendation based on video decode bandwidth + preprocessing load

### 🌐 Network
- Raw bandwidth from stream count × bitrate
- 20% buffer for RTSP control, burst traffic, and retransmission overhead
- Switch specification guidance (10GbE vs 25GbE+)

### 💾 Storage
- Per-stream, per-day storage growth
- Configurable retention period and redundancy factor
- Growth curve visualization

### 💰 Cost
- Low / High ranges for GPU hardware, servers, and storage
- Cloud OPEX mode: monthly and annual GPU rental cost
- On-prem CAPEX mode: total deployment cost
- Break-even calculation between cloud and on-prem
- Per-stream cost metric for easy benchmarking

---

## Supported AI Task Types

| Task | Example Models |
|------|----------------|
| 🔍 Object Detection | YOLOv8/v9, RT-DETR, Detectron2 |
| 🏷️ Image Classification | ResNet, EfficientNet, ViT |
| 🖼️ Segmentation | Mask R-CNN, SAM, YOLOv8-seg |
| 🧍 Pose Estimation | OpenPose, MediaPipe, YOLOv8-pose |
| 📄 OCR / Document AI | Tesseract, DocTR, PaddleOCR |
| 👤 Face Recognition | ArcFace, InsightFace, DeepFace |
| ⚠️ Anomaly Detection | PatchCore, FastFlow, custom |
| 🤖 LLM Inference | LLaMA, Mistral, Phi (quantized) |
| 🔢 Embedding / RAG | sentence-transformers, CLIP, BGE |
| 🎙️ Speech / Audio AI | Whisper, Wav2Vec, EnCodec |
| ⭐ Recommendation | Matrix factorization, neural CF |
| ⚙️ Custom Model | Bring your own FPS + VRAM spec |

---

## Supported GPU SKUs

| GPU | VRAM | IPS (640×640) | TDP | Typical Use |
|-----|------|----------------|-----|-------------|
| Tesla T4 | 16 GB | 750 | 70W | Budget inference, cloud spot |
| RTX A5000 | 24 GB | 1,500 | 250W | Mid-range on-prem |
| NVIDIA L4 | 24 GB | 1,800 | 72W | Efficient on-prem / edge |
| NVIDIA H20 | 96 GB | 4,000 | 400W | Large model inference |
| NVIDIA L20 | 48 GB | 3,000 | 350W | High-throughput inference |
| A100 80GB | 80 GB | 5,000 | 400W | Training + LLM inference |
| RTX 4090 | 24 GB | 2,200 | 450W | Workstation / dev |

---

## The Core Math

### GPU Sizing (IPS Throughput Model)

```
IPS demand per stream = FPS × (resolution_width / 640)²  × pipeline_multiplier

streams_per_GPU = floor(GPU_IPS_capacity / total_IPS_demand_per_stream)

GPUs_needed = ceil(total_streams / streams_per_GPU)
```

Resolution scaling is **quadratic** (pixel area):
- 224×224 → 0.12× baseline
- 640×640 → 1.00× baseline
- 960×960 → 2.25× baseline
- 1280×1280 → 4.00× baseline

### VRAM Sizing

```
total_VRAM = Σ(model_VRAM × resolution_scale) + framework_overhead(2.5 GB)
```

All active models are loaded simultaneously per GPU.

### CPU Sizing

```
decode_cores = ceil((streams × bitrate_Mbps) / 600)   // 600 Mbps per core
preproc_cores = ceil(total_FPS_load × 0.00008)         // GPU-accelerated path
total_recommended = (decode + preproc + system_overhead) × 1.5×
```

### Storage

```
TB/day = streams × bitrate_Mbps × 0.125 × 86400 / 1024² 
total_TB = TB/day × retention_days × redundancy_factor
```

---

## Quick Start

### Use as a React Component

```bash
npm install recharts
```

```jsx
import AIInfraCalculator from './AIInfraCalculator';

export default function App() {
  return <AIInfraCalculator />;
}
```

### Requirements

- React 18+
- `recharts` for charts
- Tailwind or your own CSS (component uses inline styles + CSS variables)
- Google Fonts (IBM Plex Mono + Syne) — loaded via `@import`

---

## How to Use

1. **Select your AI task types** — pick all the workloads your system needs to run
2. **Configure each task** — set resolution, target FPS, and concurrent stream count
3. **Choose your GPU** — the tool will suggest how many you need
4. **Set infrastructure inputs** — bitrate per stream, CPU cores, storage retention
5. **Review Summary tab** — GPU count, server count, VRAM check, network, cost range
6. **Toggle Cloud/On-Prem** — compare deployment models

---

## Assumptions & Limitations

This tool is a **planning aid**, not a simulation. Key assumptions:

- IPS benchmarks based on YOLOv8s-equivalent workloads at 640×640 with TensorRT/DeepStream
- LLM inference IPS is rough (highly quantization and batch-size dependent)
- VRAM estimates assume FP16 weights; quantized models (INT8/INT4) will use less
- GPU thermal constraints are conservative estimates; actual limits depend on chassis cooling
- Cloud pricing varies widely by region, reservation type, and provider
- Does not account for model loading time, cold-start latency, or batching strategy
- Network estimates assume streaming input (e.g. RTSP/WebRTC); batch inference differs

**Always validate with a prototype benchmark before finalizing procurement.**

---

## Contributing

Pull requests welcome. If you work with a GPU SKU or model type not listed here, the constants at the top of the file are easy to extend:

```js
// Add a new GPU
const GPU_SPECS = {
  ...
  H100: { name: "H100 80GB", vram: 80, price: 25000, priceHigh: 35000, ips: 8000, tdp: 700, gpusPerServer: 2 },
};

// Add a new task type
const TASK_PRESETS = [
  ...
  { id: "depth_estimation", label: "Depth Estimation", icon: "📐", ipsPerStream: 3, vramPerModel: 2.0, desc: "Monocular depth, stereo, LiDAR fusion" },
];
```

---

## License

MIT — use it, fork it, embed it in your proposals.

---

*Built because spreadsheet-based infra sizing is error-prone and nobody should show up to a procurement meeting without having done this math first.*
