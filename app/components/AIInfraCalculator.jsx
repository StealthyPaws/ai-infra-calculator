"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart, LineChart, Line,
  ComposedChart, ReferenceLine
} from "recharts";

const GPU_SPECS = {
  T4:    { name: "Tesla T4",    vram: 16,  price: 800,   priceHigh: 2500,  ips: 750,   tdp: 70,  gpusPerServer: 4 },
  A5000: { name: "RTX A5000",  vram: 24,  price: 3300,  priceHigh: 4000,  ips: 1500,  tdp: 250, gpusPerServer: 2 },
  L4:    { name: "NVIDIA L4",  vram: 24,  price: 2000,  priceHigh: 3000,  ips: 1800,  tdp: 72,  gpusPerServer: 3 },
  H20:   { name: "NVIDIA H20", vram: 96,  price: 10000, priceHigh: 12000, ips: 4000,  tdp: 400, gpusPerServer: 2 },
  L20:   { name: "NVIDIA L20", vram: 48,  price: 6000,  priceHigh: 13200, ips: 3000,  tdp: 350, gpusPerServer: 2 },
  A100:  { name: "A100 80GB",  vram: 80,  price: 12000, priceHigh: 16000, ips: 5000,  tdp: 400, gpusPerServer: 2 },
  "4090":{ name: "RTX 4090",   vram: 24,  price: 1600,  priceHigh: 2200,  ips: 2200,  tdp: 450, gpusPerServer: 2 },
};

const TASK_PRESETS = [
  { id: "object_detection",  label: "Object Detection",   icon: "🔍", ipsPerStream: 5,   vramPerModel: 1.2, desc: "YOLOv8/v9, RT-DETR" },
  { id: "classification",    label: "Classification",     icon: "🏷️", ipsPerStream: 8,   vramPerModel: 0.8, desc: "ResNet, EfficientNet, ViT" },
  { id: "segmentation",      label: "Segmentation",       icon: "🖼️", ipsPerStream: 3,   vramPerModel: 2.4, desc: "Mask R-CNN, SAM" },
  { id: "pose_estimation",   label: "Pose Estimation",    icon: "🧍", ipsPerStream: 4,   vramPerModel: 1.8, desc: "OpenPose, MediaPipe" },
  { id: "ocr",               label: "OCR / Doc AI",       icon: "📄", ipsPerStream: 6,   vramPerModel: 1.0, desc: "PaddleOCR, DocTR" },
  { id: "face_recognition",  label: "Face Recognition",   icon: "👤", ipsPerStream: 4,   vramPerModel: 2.0, desc: "ArcFace, InsightFace" },
  { id: "anomaly_detection", label: "Anomaly Detection",  icon: "⚠️", ipsPerStream: 5,   vramPerModel: 1.5, desc: "PatchCore, FastFlow" },
  { id: "llm_inference",     label: "LLM Inference",      icon: "🤖", ipsPerStream: 0.5, vramPerModel: 20,  desc: "LLaMA, Mistral (quant)" },
  { id: "embedding",         label: "Embedding / RAG",    icon: "🔢", ipsPerStream: 50,  vramPerModel: 1.0, desc: "sentence-transformers" },
  { id: "speech",            label: "Speech / Audio",     icon: "🎙️", ipsPerStream: 10,  vramPerModel: 1.2, desc: "Whisper, Wav2Vec" },
  { id: "recommendation",    label: "Recommendation",     icon: "⭐", ipsPerStream: 30,  vramPerModel: 0.6, desc: "Neural CF" },
  { id: "custom",            label: "Custom Model",       icon: "⚙️", ipsPerStream: 5,   vramPerModel: 1.5, desc: "Your own model" },
];

const RES_PRESETS = [
  { label: "224×224",   scale: 0.12 },
  { label: "320×320",   scale: 0.25 },
  { label: "480×480",   scale: 0.56 },
  { label: "640×640",   scale: 1.00 },
  { label: "960×960",   scale: 2.25 },
  { label: "1280×1280", scale: 4.00 },
];

const TC = ["#00e5b8","#4a90d9","#f5a623","#e85555","#9b59b6","#1abc9c","#e67e22","#3498db","#e91e63","#ff9800","#607d8b","#795548"];
const B  = 0.125, SPD = 86400;
const fmtN = n => n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1000?`$${(n/1000).toFixed(1)}K`:`$${Math.round(n)}`;
const fmtK = n => n>=1000?`${(n/1000).toFixed(1)}K`:String(Math.round(n));

const MC = ({ label, value, unit, sub, a, w, i }) => (
  <div className={`mc${a?" mca":w?" mcw":i?" mci":""}`}>
    <div className="mc-l">{label}</div>
    <div className="mc-v">{value}<span className="mc-u"> {unit}</span></div>
    {sub && <div className="mc-s">{sub}</div>}
  </div>
);

const ST = ({ c, children }) => (
  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: c||"#4a90d9", borderBottom: "1px solid #1a2535", paddingBottom: 5, marginBottom: 10, marginTop: 4 }}>
    {children}
  </div>
);

const IC = ({ icon, title, body, color="#4a90d9" }) => (
  <div style={{ background:`${color}0d`, border:`1px solid ${color}2a`, borderLeft:`3px solid ${color}`, borderRadius:"0 7px 7px 0", padding:"9px 12px", marginBottom:8 }}>
    <div style={{ fontSize:9.5, fontWeight:700, color, marginBottom:2 }}>{icon} {title}</div>
    <div style={{ fontSize:8.5, color:"#8fa4bb", lineHeight:1.55 }}>{body}</div>
  </div>
);

const SL = ({ label, value, min, max, step=1, onChange, fmt=v=>v, unit="" }) => (
  <div className="sl">
    <div className="sl-h"><span className="sl-l">{label}</span><span className="sl-v">{fmt(value)}{unit}</span></div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} className="slider" />
    <div className="sl-m"><span>{fmt(min)}{unit}</span><span>{fmt(max)}{unit}</span></div>
  </div>
);

const TT = ({ active, payload }) => active&&payload?.length ? (
  <div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:6,padding:"5px 9px",fontSize:9}}>
    <div style={{color:"#56697e",marginBottom:1,textTransform:"uppercase",fontSize:7.5}}>{payload[0].payload.name??payload[0].name}</div>
    <div style={{fontFamily:"'IBM Plex Mono',monospace",color:"#00e5b8",fontWeight:700,fontSize:11}}>{typeof payload[0].value==="number"&&payload[0].value>500?fmtN(payload[0].value):payload[0].value}</div>
  </div>
) : null;

export default function AIInfraCalculator() {
  const [tab,setTab]       = useState("summary");
  const [gpuType,setGpu]   = useState("L4");
  const [streams,setStr]   = useState(50);
  const [bps,setBps]       = useState(4);
  const [ret,setRet]       = useState(30);
  const [stor,setStor]     = useState(true);
  const [cloud,setCloud]   = useState(false);
  const [showF,setShowF]   = useState(false);
  const [cores,setCores]   = useState(32);
  const [redund,setRed]    = useState(1.2);
  const [gpuLo,setGpuLo]   = useState(2000);
  const [gpuHi,setGpuHi]   = useState(3000);
  const [srvLo,setSrvLo]   = useState(3000);
  const [srvHi,setSrvHi]   = useState(6000);
  const [stPTB,setStPTB]   = useState(30);
  const [cldLo,setCldLo]   = useState(0.50);
  const [cldHi,setCldHi]   = useState(1.20);
  const [sel,setSel]       = useState({object_detection:true});
  const [tStr,setTStr]     = useState(TASK_PRESETS.reduce((a,t)=>({...a,[t.id]:50}),{}));
  const [tRes,setTRes]     = useState(TASK_PRESETS.reduce((a,t)=>({...a,[t.id]:3}),{}));
  const [tFps,setTFps]     = useState(TASK_PRESETS.reduce((a,t)=>({...a,[t.id]:t.ipsPerStream}),{}));

  const g = GPU_SPECS[gpuType];

  const c = useMemo(()=>{
    const at = TASK_PRESETS.filter(t=>sel[t.id]);
    if(!at.length) return {at:[],gpus:0,srvs:0,spg:0,es:streams,tidem:0,tmem:2.5,fits:true,memR:g.vram-2.5,tbw:0,bgbps:0,tpd:0,pbt:0,gcL:0,gcH:0,scL:0,scH:0,stcL:0,stcH:0,capL:0,capH:0,cmL:0,cmH:0,caL:0,caH:0,ccn:0,vb:[],tid:{},tfl:0,gu:0,cu:0,cpsL:0,cpsH:0,pw:0,pkh:0,apc:0,cd:0,cp:0};
    const tid={};
    at.forEach(t=>{tid[t.id]=(tFps[t.id]||t.ipsPerStream)*RES_PRESETS[tRes[t.id]].scale;});
    const tidem=at.reduce((s,t)=>s+tid[t.id],0);
    const spg=tidem>0?Math.max(1,Math.floor(g.ips/tidem)):999;
    const es=Math.max(...at.map(t=>tStr[t.id]||streams));
    const gpus=Math.ceil(es/spg);
    const srvs=Math.ceil(gpus/g.gpusPerServer);
    const mm=at.reduce((s,t)=>s+t.vramPerModel*RES_PRESETS[tRes[t.id]].scale,0);
    const tmem=mm+2.5;
    const fits=tmem<=g.vram;
    const memR=g.vram-tmem;
    const tbw=es*bps;
    const tfl=at.reduce((s,t)=>s+(tStr[t.id]||streams)*(tFps[t.id]||t.ipsPerStream),0);
    const cd=Math.ceil(tbw/600);
    const cp=Math.ceil(tfl*0.00008);
    const ccn=Math.ceil((cd+cp+5)*1.5);
    const bgbps=tbw/1000*1.2;
    const mbps=bps*B;
    const gpd=(mbps*SPD)/1024;
    const tpd=(gpd*es)/1024;
    const pbt=(stor?tpd*ret*redund:0.001)/1024;
    const gcL=gpus*gpuLo,gcH=gpus*gpuHi;
    const scL=srvs*srvLo,scH=srvs*srvHi;
    const stcL=pbt*stPTB*1024,stcH=stcL*1.3;
    const capL=gcL+scL+stcL,capH=gcH+scH+stcH;
    const cmL=gpus*cldLo*720,cmH=gpus*cldHi*720;
    const pw=gpus*g.tdp+srvs*200;
    const pkh=pw/1000*24*365;
    const apc=pkh*0.12;
    const gu=Math.min(100,(tidem*es)/(gpus*g.ips)*100);
    const cu=Math.min(100,ccn/cores*100);
    const vb=[...at.map((t,i)=>({name:t.label,gb:parseFloat((t.vramPerModel*RES_PRESETS[tRes[t.id]].scale).toFixed(2)),fill:TC[i%12]})),{name:"Framework OH",gb:2.5,fill:"#334155"}];
    return {at,gpus,srvs,spg,es,tidem,tmem,fits,memR,tbw,bgbps,tpd,pbt,gcL,gcH,scL,scH,stcL,stcH,capL,capH,cmL,cmH,caL:cmL*12,caH:cmH*12,ccn,vb,tid,tfl,gu,cu,cpsL:es>0?capL/es:0,cpsH:es>0?capH/es:0,pw,pkh,apc,cd,cp,gpd,mbps};
  },[gpuType,streams,bps,ret,stor,redund,gpuLo,gpuHi,srvLo,srvHi,stPTB,cldLo,cldHi,sel,tStr,tRes,tFps,g,cores]);

  const gpuCmp = useMemo(()=>{
    if(!c.at.length) return [];
    return Object.entries(GPU_SPECS).map(([k,v])=>{
      const spg2=c.tidem>0?Math.max(1,Math.floor(v.ips/c.tidem)):999;
      const gn=Math.ceil(c.es/spg2);
      const fits2=c.tmem<=v.vram;
      return {name:v.name.replace("NVIDIA ","").replace(" 80GB",""),gpus:gn,srvs:Math.ceil(gn/v.gpusPerServer),cL:gn*v.price,cH:gn*v.priceHigh,fits:fits2,vram:v.vram,ips:v.ips,tdp:v.tdp,cps:fits2?Math.round(gn*v.price/Math.max(1,c.es)):9999};
    });
  },[c]);

  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Syne:wght@400;500;700;800&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      :root{--bg:#060a10;--pan:#0b1118;--pan2:#0f1825;--pan3:#131e2e;--bd:#1a2535;--bd2:#1f2f42;--tx:#dde4ee;--mu:#56697e;--ac:#00e5b8;--ac2:#4a90d9;--wn:#f5a623;--dn:#e85555;--mono:'IBM Plex Mono',monospace;--sans:'Syne',sans-serif;}
      body{background:var(--bg);color:var(--tx);font-family:var(--sans);}
      .app{min-height:100vh;display:grid;grid-template-rows:auto 1fr;background:var(--bg);}
      .hdr{padding:0 20px;height:52px;border-bottom:1px solid var(--bd);background:var(--pan);display:flex;align-items:center;justify-content:space-between;}
      .hlo{width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#00e5b8,#4a90d9);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
      .htit{font-size:13px;font-weight:800;color:#f1f5f9;letter-spacing:-.2px;}
      .hsub{font-size:8px;color:var(--mu);letter-spacing:.5px;text-transform:uppercase;}
      .hbtn{padding:4px 10px;border-radius:5px;font-size:9px;font-family:var(--mono);cursor:pointer;transition:all .15s;font-weight:600;border:1px solid var(--bd2);background:transparent;color:var(--mu);}
      .hbtn:hover{border-color:var(--ac2);color:var(--ac2);}
      .hbtn.on{background:var(--ac2);color:#fff;border-color:var(--ac2);}
      .tpill{display:flex;background:var(--pan2);border:1px solid var(--bd);border-radius:16px;overflow:hidden;padding:2px;}
      .tpb{padding:3px 11px;font-size:9px;font-family:var(--mono);cursor:pointer;border:none;background:none;color:var(--mu);transition:all .15s;border-radius:12px;font-weight:600;}
      .tpb.on{background:linear-gradient(135deg,#00e5b8,#4a90d9);color:#fff;}
      .body{display:grid;grid-template-columns:308px 1fr;height:calc(100vh - 52px);overflow:hidden;}
      .lp{border-right:1px solid var(--bd);overflow-y:auto;background:var(--pan);scrollbar-width:thin;scrollbar-color:#1f2f42 transparent;}
      .lp::-webkit-scrollbar{width:3px;}.lp::-webkit-scrollbar-thumb{background:var(--bd2);}
      .isec{border-bottom:1px solid var(--bd);padding:11px 13px;}
      .stit{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ac);margin-bottom:1px;}
      .ssub{font-size:8px;color:var(--mu);margin-bottom:8px;}
      .sl{margin-bottom:8px;}.sl-h{display:flex;justify-content:space-between;margin-bottom:3px;}
      .sl-l{font-size:10px;color:#8fa4bb;}.sl-v{font-family:var(--mono);font-size:10px;color:var(--ac);font-weight:600;}
      .slider{width:100%;height:3px;-webkit-appearance:none;appearance:none;background:var(--bd2);border-radius:2px;outline:none;cursor:pointer;}
      .slider::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:var(--ac);cursor:pointer;border:2px solid var(--bg);box-shadow:0 0 5px #00e5b866;}
      .sl-m{display:flex;justify-content:space-between;font-size:7.5px;color:var(--mu);margin-top:1px;}
      .gg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:3px;}
      .gBtn{border:1px solid var(--bd2);background:var(--pan2);color:var(--mu);padding:5px 2px;border-radius:5px;cursor:pointer;text-align:center;font-family:var(--mono);font-size:7px;transition:all .15s;line-height:1.4;}
      .gBtn.sel{border-color:var(--ac);background:#00e5b812;color:var(--ac);font-weight:700;}
      .gV{font-size:6px;color:var(--mu);margin-top:1px;}.gBtn.sel .gV{color:#00e5b880;}
      .tg{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;}
      .tBtn{border:1px solid var(--bd);background:transparent;color:var(--mu);padding:6px 6px;border-radius:5px;cursor:pointer;text-align:left;font-size:9px;transition:all .15s;font-family:var(--sans);}
      .tBtn:hover{border-color:var(--ac2);color:var(--tx);}.tBtn.sel{border-color:var(--ac);background:#00e5b808;color:var(--tx);}
      .ti{font-size:12px;display:block;margin-bottom:1px;}.tl{font-weight:700;font-size:9px;display:block;margin-bottom:1px;}.td{font-size:7px;color:var(--mu);line-height:1.3;}
      .pr{display:grid;grid-template-columns:1fr 10px 1fr;gap:3px;align-items:center;margin-bottom:6px;}
      .ni{width:100%;background:var(--pan2);border:1px solid var(--bd2);color:var(--tx);padding:4px 5px;border-radius:4px;font-family:var(--mono);font-size:9.5px;outline:none;}
      .ni:focus{border-color:var(--ac);}
      .pl{font-size:9px;color:#8fa4bb;margin-bottom:3px;}
      .tog{position:relative;width:32px;height:17px;cursor:pointer;flex-shrink:0;}
      .togt{position:absolute;inset:0;background:var(--bd2);border-radius:16px;transition:background .2s;}
      .togt.on{background:var(--ac);}
      .togth{position:absolute;top:3px;left:3px;width:11px;height:11px;background:#fff;border-radius:50%;transition:transform .2s;}
      .togth.on{transform:translateX(15px);}
      .rp{overflow-y:auto;background:var(--bg);scrollbar-width:thin;scrollbar-color:#1f2f42 transparent;}
      .rp::-webkit-scrollbar{width:3px;}.rp::-webkit-scrollbar-thumb{background:var(--bd2);}
      .tabs{display:flex;border-bottom:1px solid var(--bd);background:var(--pan);padding:0 16px;position:sticky;top:0;z-index:10;overflow-x:auto;scrollbar-width:none;}
      .tabs::-webkit-scrollbar{display:none;}
      .tab{padding:12px 12px;font-size:10px;font-weight:700;cursor:pointer;color:var(--mu);border:none;background:none;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;font-family:var(--sans);}
      .tab.on{color:var(--ac);border-bottom-color:var(--ac);}
      .cnt{padding:16px 18px;}
      .mg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:7px;margin-bottom:14px;}
      .mc{background:var(--pan);border:1px solid var(--bd);border-radius:8px;padding:11px;}.mca{border-color:#00e5b828;background:#00e5b80a;}.mcw{border-color:#f5a62328;background:#f5a6230a;}.mci{border-color:#4a90d928;background:#4a90d90a;}
      .mc-l{font-size:7px;color:var(--mu);margin-bottom:3px;text-transform:uppercase;letter-spacing:.8px;}
      .mc-v{font-family:var(--mono);font-size:20px;font-weight:700;color:#f1f5f9;line-height:1;}
      .mc-u{font-size:9px;font-weight:400;color:var(--mu);}
      .mc-s{font-size:7px;color:var(--mu);margin-top:3px;line-height:1.4;}
      .cg{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px;}
      .cg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:12px;}
      .cc{background:var(--pan);border:1px solid var(--bd);border-radius:8px;padding:13px;}
      .cfw{grid-column:1/-1;}
      .ctit{font-size:7.5px;font-weight:700;color:#8fa4bb;margin-bottom:9px;text-transform:uppercase;letter-spacing:.7px;}
      .al{display:flex;gap:7px;padding:7px 10px;border-radius:6px;margin-bottom:10px;font-size:9px;line-height:1.55;}
      .alw{background:#f5a62310;border:1px solid #f5a62340;color:#fbbf24;}
      .alo{background:#00e5b810;border:1px solid #00e5b840;color:var(--ac);}
      .ali{background:#4a90d910;border:1px solid #4a90d940;color:#7eb8f5;}
      .vbt{height:14px;background:var(--pan2);border-radius:3px;overflow:hidden;display:flex;margin-bottom:5px;}
      .vbl{display:flex;flex-wrap:wrap;gap:4px;}
      .vbli{display:flex;align-items:center;gap:3px;font-size:7.5px;color:var(--mu);}
      .cr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd);}
      .cr:last-child{border-bottom:none;}
      .ctot{background:var(--pan2);border-radius:7px;padding:12px 14px;margin-top:9px;border:1px solid var(--bd2);}
      .div{height:1px;background:var(--bd);margin:12px 0;}
      .cfrow{display:grid;grid-template-columns:95px 1fr 68px 52px;gap:4px;align-items:center;padding:5px 0;border-bottom:1px solid #1a253511;font-size:9px;}
      .mi{background:var(--pan2);border:1px solid var(--bd2);color:var(--ac);font-family:var(--mono);font-size:9px;padding:2px 3px;border-radius:3px;width:100%;outline:none;text-align:center;}
      .ms{background:var(--pan2);border:1px solid var(--bd2);color:#8fa4bb;font-family:var(--mono);font-size:8px;padding:2px 3px;border-radius:3px;outline:none;cursor:pointer;width:100%;}
      @media(max-width:860px){.body{grid-template-columns:1fr;grid-template-rows:auto 1fr;}.lp{height:40vh;border-right:none;border-bottom:1px solid var(--bd);}.cg,.cg3{grid-template-columns:1fr;}}
    `}</style>

    <div className="app">
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* <div className="hlo">⚡</div> */}
          <div className="logo-mark">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/>
              <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.6"/>
              <rect x="8" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.8"/>
            </svg>
          </div>
          <div><div className="htit">AI Infrastructure Calculator</div><div className="hsub">Plan GPU · Compute · Storage · Cost before you build</div></div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button className={`hbtn${showF?" on":""}`} onClick={()=>setShowF(s=>!s)}>⟨/⟩ Formulas</button>
          <div className="tpill">
            <button className={`tpb${!cloud?" on":""}`} onClick={()=>setCloud(false)}>🏭 On-Prem</button>
            <button className={`tpb${cloud?" on":""}`}  onClick={()=>setCloud(true)}>☁️ Cloud</button>
          </div>
        </div>
      </div>

      <div className="body">
        <div className="lp">
          <div className="isec">
            <div className="stit">AI Task Types</div><div className="ssub">Select all workloads on this infra</div>
            <div className="tg">
              {TASK_PRESETS.map(t=>(
                <button key={t.id} className={`tBtn${sel[t.id]?" sel":""}`} onClick={()=>setSel(p=>({...p,[t.id]:!p[t.id]}))}>
                  <span className="ti">{t.icon}</span><span className="tl">{t.label}</span><span className="td">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
          {c.at.length>0&&(
            <div className="isec">
              <div className="stit">Task Config</div><div className="ssub">Resolution · FPS · Streams per task</div>
              <div style={{display:"flex",gap:4,marginBottom:4,fontSize:7,color:"var(--mu)",textTransform:"uppercase",letterSpacing:".5px"}}>
                <div style={{width:95}}>Task</div><div style={{flex:1}}>Res</div><div style={{width:68,textAlign:"center"}}>FPS</div><div style={{width:52,textAlign:"center"}}>Streams</div>
              </div>
              {c.at.map(t=>(
                <div key={t.id} className="cfrow">
                  <div style={{fontSize:8,color:"#dde4ee"}}>{t.icon} {t.label}</div>
                  <select className="ms" value={tRes[t.id]} onChange={e=>setTRes(p=>({...p,[t.id]:Number(e.target.value)}))}>
                    {RES_PRESETS.map((r,i)=><option key={i} value={i}>{r.label}</option>)}
                  </select>
                  <input type="number" min="0.1" max="60" step="0.5" value={tFps[t.id]} className="mi" onChange={e=>setTFps(p=>({...p,[t.id]:Math.max(0.1,Number(e.target.value))}))} />
                  <input type="number" min="1" max="5000" value={tStr[t.id]} className="mi" onChange={e=>setTStr(p=>({...p,[t.id]:Math.max(1,Number(e.target.value))}))} />
                </div>
              ))}
            </div>
          )}
          <div className="isec">
            <div className="stit">GPU Selection</div><div className="ssub">NVIDIA inference hardware</div>
            <div className="gg">
              {Object.entries(GPU_SPECS).map(([k,v])=>(
                <button key={k} className={`gBtn${gpuType===k?" sel":""}`} onClick={()=>{setGpu(k);setGpuLo(v.price);setGpuHi(v.priceHigh);}}>
                  {v.name.replace("NVIDIA ","").replace(" 80GB","")}<div className="gV">{v.vram}GB·{v.ips}IPS</div>
                </button>
              ))}
            </div>
          </div>
          <div className="isec">
            <div className="stit">Infrastructure</div>
            <SL label="Concurrent Streams" value={streams} min={1} max={1000} onChange={setStr} />
            <SL label="Bandwidth/Stream" value={bps} min={1} max={50} onChange={setBps} unit=" Mbps" />
            <SL label="CPU Cores/Server" value={cores} min={8} max={128} step={8} onChange={setCores} />
          </div>
          <div className="isec">
            <div className="stit">Storage & Retention</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:10,color:"#8fa4bb"}}>Enable storage calc</span>
              <div className="tog" onClick={()=>setStor(s=>!s)}><div className={`togt${stor?" on":""}`}/><div className={`togth${stor?" on":""}`}/></div>
            </div>
            {stor&&(<><SL label="Retention" value={ret} min={1} max={365} onChange={setRet} unit=" days" /><SL label="Redundancy" value={redund} min={1.0} max={3.0} step={0.1} onChange={setRed} fmt={v=>v.toFixed(1)} unit="×" /></>)}
          </div>
          <div className="isec">
            <div className="stit">Pricing (USD)</div>
            <div className="pl">GPU unit price</div>
            <div className="pr"><input type="number" value={gpuLo} step={100} className="ni" onChange={e=>setGpuLo(Number(e.target.value))}/><span style={{textAlign:"center",color:"var(--mu)",fontSize:8}}>–</span><input type="number" value={gpuHi} step={100} className="ni" onChange={e=>setGpuHi(Number(e.target.value))}/></div>
            <div className="pl">Server cost</div>
            <div className="pr"><input type="number" value={srvLo} step={500} className="ni" onChange={e=>setSrvLo(Number(e.target.value))}/><span style={{textAlign:"center",color:"var(--mu)",fontSize:8}}>–</span><input type="number" value={srvHi} step={500} className="ni" onChange={e=>setSrvHi(Number(e.target.value))}/></div>
            <div className="pl">Storage/TB</div>
            <input type="number" value={stPTB} step={5} className="ni" style={{width:"100%",marginBottom:6}} onChange={e=>setStPTB(Number(e.target.value))}/>
            {cloud&&(<><div className="pl">Cloud GPU $/hour</div><div className="pr"><input type="number" value={cldLo} step={0.1} className="ni" onChange={e=>setCldLo(Number(e.target.value))}/><span style={{textAlign:"center",color:"var(--mu)",fontSize:8}}>–</span><input type="number" value={cldHi} step={0.1} className="ni" onChange={e=>setCldHi(Number(e.target.value))}/></div></>)}
          </div>
        </div>

        <div className="rp">
          <div className="tabs">
            {[{id:"summary",l:"📊 Summary"},{id:"compute",l:"⚡ Compute"},{id:"network",l:"🌐 Network"},{id:"storage",l:"💾 Storage"},{id:"cost",l:"💰 Cost"}].map(t=>(
              <button key={t.id} className={`tab${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>
            ))}
          </div>

          <div className="cnt">
            {c.at.length===0&&<div className="al ali"><span>👈</span><span>Select at least one AI task type to start calculating.</span></div>}

            {/* ═══ SUMMARY ═══ */}
            {tab==="summary"&&(<>
              <div className="mg">
                <MC label="GPUs Required" value={c.gpus} unit="GPUs" sub={`${c.es} streams ÷ ${c.spg}/GPU`} a />
                <MC label="Servers" value={c.srvs} unit="servers" sub={`${g.gpusPerServer} GPUs/server`} a />
                <MC label="VRAM Used" value={c.tmem.toFixed(1)} unit={`/${g.vram}GB`} sub={`${Math.max(0,c.memR).toFixed(1)}GB free`} a={c.fits} w={!c.fits} />
                <MC label="Network BW" value={c.bgbps.toFixed(2)} unit="Gbps" sub="+20% buffer" i />
                <MC label="GPU Utilization" value={c.gu.toFixed(0)} unit="%" sub={`${c.gpus}×${g.ips} IPS`} a={c.gu<85} w={c.gu>=85} />
                <MC label="CPU Needed" value={c.ccn} unit="cores" sub={`Selected: ${cores}`} a={c.ccn<=cores} w={c.ccn>cores} />
                <MC label="Power Draw" value={c.pw} unit="W" sub={`${fmtN(c.apc)}/yr electricity`} />
                <MC label="Total CAPEX" value={fmtN(c.capL)} unit={`–${fmtN(c.capH)}`} sub="GPU+servers+storage" />
              </div>

              {!c.fits&&<div className="al alw"><span>⚠️</span><span>VRAM overrun: {c.tmem.toFixed(1)}GB needed, {g.name} has {g.vram}GB. Lower resolution or upgrade to H20/A100.</span></div>}
              {c.ccn>cores&&<div className="al alw"><span>⚠️</span><span>CPU underspecced: {cores} cores selected but {c.ccn} recommended for {c.es} streams.</span></div>}
              {c.gu>90&&<div className="al alw"><span>⚠️</span><span>GPU utilization at {c.gu.toFixed(0)}% — add 1 GPU buffer for headroom at peak load.</span></div>}
              {c.fits&&c.ccn<=cores&&<div className="al alo"><span>✅</span><span>Config healthy — VRAM fits, CPU sufficient, network within bounds.</span></div>}

              <div className="cg">
                <div className="cc">
                  <div className="ctit">Infrastructure overview</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={[{n:"Streams",v:c.es,f:"#4a90d9"},{n:"GPUs",v:c.gpus,f:"#00e5b8"},{n:"Servers",v:c.srvs,f:"#f5a623"},{n:"CPU cores",v:c.ccn,f:"#9b59b6"}]} margin={{top:5,right:5,left:-20,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                      <XAxis dataKey="n" tick={{fontSize:8,fill:"#56697e"}}/>
                      <YAxis tick={{fontSize:8,fill:"#56697e"}}/>
                      <Tooltip content={<TT/>}/>
                      <Bar dataKey="v" radius={[4,4,0,0]}>{[{f:"#4a90d9"},{f:"#00e5b8"},{f:"#f5a623"},{f:"#9b59b6"}].map((d,i)=><Cell key={i} fill={d.f}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="cc">
                  <div className="ctit">Cost distribution (low est.)</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={[{name:"GPU Hardware",value:c.gcL,color:"#00e5b8"},{name:"Servers",value:c.scL,color:"#4a90d9"},{name:"Storage",value:c.stcL,color:"#f5a623"}]} cx="50%" cy="50%" innerRadius={40} outerRadius={66} dataKey="value" paddingAngle={3}>
                        {["#00e5b8","#4a90d9","#f5a623"].map((cl,i)=><Cell key={i} fill={cl}/>)}
                      </Pie>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].name}</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{fmtN(payload[0].value)}</div></div>):null}/>
                      <Legend formatter={v=><span style={{fontSize:7.5,color:"#8fa4bb"}}>{v}</span>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* VRAM Bar */}
              <div className="cc" style={{marginBottom:10}}>
                <div className="ctit">VRAM allocation — {c.tmem.toFixed(1)}GB / {g.vram}GB</div>
                <div className="vbt">{c.vb.map((s,i)=><div key={i} style={{width:`${Math.min(100,(s.gb/g.vram)*100)}%`,background:s.fill,height:"100%"}}/>)}</div>
                <div className="vbl">{c.vb.map((s,i)=><div key={i} className="vbli"><div style={{width:6,height:6,borderRadius:2,background:s.fill}}/>{s.name}:{s.gb.toFixed(1)}GB</div>)}<div className="vbli"><div style={{width:6,height:6,borderRadius:2,background:"#1a2535"}}/>Free:{Math.max(0,c.memR).toFixed(1)}GB</div></div>
              </div>

              {/* Utilization gauges */}
              <div className="cg3">
                {[
                  {l:"GPU utilization",v:c.gu,col:"#00e5b8",sub:`${c.gpus} GPUs at load`},
                  {l:"CPU utilization", v:c.cu, col:"#4a90d9",sub:`${cores} cores selected`},
                  {l:"VRAM utilization",v:Math.min(100,(c.tmem/g.vram)*100),col:"#f5a623",sub:`${g.vram}GB total`},
                ].map((gg,i)=>(
                  <div key={i} className="cc" style={{textAlign:"center"}}>
                    <div className="ctit">{gg.l}</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:28,fontWeight:700,color:gg.v>85?"#e85555":gg.col,lineHeight:1,marginBottom:3}}>{gg.v.toFixed(0)}%</div>
                    <div style={{background:"var(--pan2)",borderRadius:3,height:5,overflow:"hidden",marginBottom:4}}>
                      <div style={{height:"100%",width:`${gg.v}%`,background:gg.v>85?"#e85555":gg.col,borderRadius:3,transition:"width .4s"}}/>
                    </div>
                    <div style={{fontSize:7.5,color:"var(--mu)"}}>{gg.sub}</div>
                  </div>
                ))}
              </div>

              {/* GPU comparison table */}
              <ST>GPU comparison for this workload</ST>
              <div className="cc" style={{marginBottom:12,overflowX:"auto"}}>
                <div className="ctit">All GPU options — same workload, different cost & VRAM fit</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:8.5}}>
                  <thead><tr style={{borderBottom:"1px solid var(--bd)"}}>
                    {["GPU","VRAM","IPS","Streams/GPU","GPUs","Cost (Low)","Cost (High)","VRAM Fit","$/Stream"].map(h=>(
                      <th key={h} style={{padding:"4px 6px",fontFamily:"var(--mono)",fontSize:7,color:"var(--mu)",textAlign:"left",textTransform:"uppercase",background:"var(--pan2)"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {gpuCmp.map((gg,i)=>{
                      const cur=gg.name===g.name.replace("NVIDIA ","").replace(" 80GB","");
                      return(
                        <tr key={i} style={{borderBottom:"1px solid #1a253560",background:cur?"#00e5b80a":"transparent"}}>
                          <td style={{padding:"4px 6px",color:cur?"var(--ac)":"var(--tx)",fontWeight:cur?700:400}}>{gg.name}{cur?" ★":""}</td>
                          <td style={{padding:"4px 6px",fontFamily:"var(--mono)",color:"#8fa4bb"}}>{gg.vram}GB</td>
                          <td style={{padding:"4px 6px",fontFamily:"var(--mono)",color:"#8fa4bb"}}>{gg.ips}</td>
                          <td style={{padding:"4px 6px",fontFamily:"var(--mono)",color:"#4a90d9"}}>{gg.fits?Math.floor(gg.ips/Math.max(0.01,c.tidem)):"N/A"}</td>
                          <td style={{padding:"4px 6px",fontFamily:"var(--mono)",color:"#f1f5f9",fontWeight:700}}>{gg.gpus}</td>
                          <td style={{padding:"4px 6px",fontFamily:"var(--mono)",color:"#8fa4bb"}}>{fmtN(gg.cL)}</td>
                          <td style={{padding:"4px 6px",fontFamily:"var(--mono)",color:"var(--wn)"}}>{fmtN(gg.cH)}</td>
                          <td style={{padding:"4px 6px"}}><span style={{fontSize:7.5,fontFamily:"var(--mono)",padding:"1px 4px",borderRadius:3,background:gg.fits?"#00e5b820":"#e8555520",color:gg.fits?"var(--ac)":"#f87171",border:`1px solid ${gg.fits?"#00e5b840":"#e8555540"}`}}>{gg.fits?"✓ fits":"✗ OOM"}</span></td>
                          <td style={{padding:"4px 6px",fontFamily:"var(--mono)",color:gg.cps<(c.cpsL||9999)?"var(--ac)":"#8fa4bb"}}>{gg.fits?fmtN(gg.cps):"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Scaling projection */}
              <ST>Stream scaling projection</ST>
              <div className="cc" style={{marginBottom:12}}>
                <div className="ctit">GPUs needed & cost as stream count grows</div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={[10,25,50,100,200,350,500,750,1000].map(s=>{const gn=c.tidem>0?Math.ceil(s/Math.max(1,Math.floor(g.ips/c.tidem))):1;return {s,gpus:gn,cost:Math.round(gn*gpuLo/1000)};}) } margin={{top:5,right:20,left:-10,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                    <XAxis dataKey="s" tick={{fontSize:7.5,fill:"#56697e"}}/>
                    <YAxis yAxisId="l" tick={{fontSize:7.5,fill:"#56697e"}}/>
                    <YAxis yAxisId="r" orientation="right" tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>`$${v}K`}/>
                    <ReferenceLine yAxisId="l" x={c.es} stroke="#00e5b8" strokeDasharray="4 2"/>
                    <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.s} streams</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{payload[0].payload.gpus} GPUs · ${payload[0].payload.cost}K</div></div>):null}/>
                    <Bar yAxisId="l" dataKey="gpus" fill="#4a90d930" radius={[3,3,0,0]}/>
                    <Line yAxisId="r" type="monotone" dataKey="cost" stroke="#f5a623" strokeWidth={2} dot={{r:2.5,fill:"#f5a623"}}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>)}

            {/* ═══ COMPUTE ═══ */}
            {tab==="compute"&&(<>
              <div className="mg">
                <MC label="GPU" value={g.name.replace("NVIDIA ","")} unit="" sub={`${g.vram}GB·${g.tdp}W`}/>
                <MC label="GPU IPS" value={g.ips} unit="IPS" sub="@ 640×640 baseline"/>
                <MC label="IPS/Stream" value={c.tidem?.toFixed(1)||"0"} unit="IPS" sub="sum of all tasks"/>
                <MC label="Streams/GPU" value={c.spg} unit="" sub={`floor(${g.ips}/${c.tidem?.toFixed(1)})`} a/>
                <MC label="GPUs" value={c.gpus} unit="GPUs" a/>
                <MC label="Servers" value={c.srvs} unit="" sub={`${g.gpusPerServer} GPUs/server`}/>
                <MC label="CPU Needed" value={c.ccn} unit="cores" sub={`dec:${c.cd}+pre:${c.cp}+OH:5×1.5`} a={c.ccn<=cores} w={c.ccn>cores}/>
                <MC label="Total FPS" value={fmtK(c.tfl)} unit="fps" sub="all tasks × streams"/>
              </div>

              <ST>Task IPS demand & VRAM usage</ST>
              <div className="cg">
                <div className="cc">
                  <div className="ctit">IPS demand per task (per stream)</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={c.at.map((t,i)=>({name:t.label,val:+(c.tid[t.id]||0).toFixed(2),fill:TC[i%12]}))} margin={{top:5,right:5,left:-15,bottom:28}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/><XAxis dataKey="name" tick={{fontSize:7,fill:"#56697e"}} angle={-30} textAnchor="end"/><YAxis tick={{fontSize:7.5,fill:"#56697e"}}/>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.name}</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{payload[0].payload.val} IPS</div></div>):null}/>
                      <Bar dataKey="val" radius={[3,3,0,0]}>{c.at.map((_,i)=><Cell key={i} fill={TC[i%12]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="cc">
                  <div className="ctit">VRAM per task at current resolution</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={c.at.map((t,i)=>({name:t.label,val:+(t.vramPerModel*RES_PRESETS[tRes[t.id]].scale).toFixed(2),fill:TC[i%12]}))} margin={{top:5,right:5,left:-15,bottom:28}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/><XAxis dataKey="name" tick={{fontSize:7,fill:"#56697e"}} angle={-30} textAnchor="end"/><YAxis tick={{fontSize:7.5,fill:"#56697e"}}/>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.name}</div><div style={{fontFamily:"var(--mono)",color:"#f5a623",fontWeight:700}}>{payload[0].payload.val} GB</div></div>):null}/>
                      <Bar dataKey="val" radius={[3,3,0,0]}>{c.at.map((_,i)=><Cell key={i} fill={TC[i%12]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <ST>Resolution scaling impact (quadratic cost)</ST>
              <div className="cc" style={{marginBottom:12}}>
                <div className="ctit">GPU compute cost multiplier vs resolution — highlighted = 640×640 baseline</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={RES_PRESETS.map(r=>({name:r.label,scale:r.scale}))} margin={{top:5,right:5,left:-10,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/><XAxis dataKey="name" tick={{fontSize:8,fill:"#56697e"}}/><YAxis tick={{fontSize:8,fill:"#56697e"}}/>
                    <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.name}</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{payload[0].payload.scale}× baseline</div></div>):null}/>
                    <Bar dataKey="scale" radius={[4,4,0,0]}>{RES_PRESETS.map((_,i)=><Cell key={i} fill={i===3?"#00e5b8":"#4a90d950"}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{fontSize:8,color:"var(--mu)",marginTop:5,lineHeight:1.5}}>Doubling resolution = 4× GPU cost. 960×960 costs 2.25× more than 640×640. 1280×1280 costs 4× more. Choose the lowest resolution your accuracy allows.</div>
              </div>

              <ST>CPU preprocessing analysis</ST>
              <div className="cg">
                <div className="cc">
                  <div className="ctit">Core breakdown (GPU-accelerated path)</div>
                  {[
                    {l:"Video decode",v:c.cd,color:"#4a90d9",note:`${c.tbw}Mbps÷600`},
                    {l:"Preprocessing (CUDA)",v:c.cp,color:"#00e5b8",note:"GPU-accel"},
                    {l:"NMS + system OH",v:5,color:"#f5a623",note:"fixed"},
                  ].map((r,i)=>(
                    <div key={i} style={{marginBottom:9}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:8.5,marginBottom:2}}>
                        <span style={{color:r.color,fontWeight:700}}>{r.l}</span>
                        <span style={{fontFamily:"var(--mono)",color:"#f1f5f9"}}>{r.v} <span style={{color:"var(--mu)",fontSize:7.5}}>({r.note})</span></span>
                      </div>
                      <div style={{background:"var(--pan2)",borderRadius:3,height:6,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(100,(r.v/Math.max(c.ccn,1))*100)}%`,background:r.color,borderRadius:3}}/>
                      </div>
                    </div>
                  ))}
                  <div className="div"/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9.5,fontWeight:700}}>
                    <span style={{color:"var(--ac)"}}>Total (×1.5 headroom)</span>
                    <span style={{fontFamily:"var(--mono)",color:"var(--ac)"}}>{c.ccn} cores</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9.5,marginTop:3}}>
                    <span style={{color:c.ccn<=cores?"var(--ac)":"var(--wn)"}}>Your selection: {cores} cores</span>
                    <span style={{fontFamily:"var(--mono)",color:c.ccn<=cores?"var(--ac)":"var(--wn)"}}>{c.ccn<=cores?`+${cores-c.ccn} headroom`:`${c.ccn-cores} short`}</span>
                  </div>
                </div>
                <div className="cc">
                  <div className="ctit">CPU-based vs GPU-accel preprocessing</div>
                  {[
                    {mode:"CPU-based preprocessing",cores:Math.ceil((c.cd+(c.tfl*0.0004)+5)*1.5),color:"#e85555",note:"All resize/norm on CPU — NOT recommended at scale"},
                    {mode:"GPU-accelerated (CUDA)",cores:c.ccn,color:"#00e5b8",note:"Preprocessing batched via CUDA — recommended"},
                  ].map((r,i)=>(
                    <div key={i} style={{background:`${r.color}10`,border:`1px solid ${r.color}28`,borderRadius:6,padding:"10px 11px",marginBottom:7}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:9,fontWeight:700,color:r.color}}>{r.mode}</span>
                        <span style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:700,color:r.color}}>{r.cores}</span>
                      </div>
                      <div style={{fontSize:7.5,color:"var(--mu)",marginBottom:5}}>{r.note}</div>
                      <div style={{background:"var(--pan2)",borderRadius:3,height:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(100,(r.cores/128)*100)}%`,background:r.color,borderRadius:3}}/>
                      </div>
                    </div>
                  ))}
                  <IC icon="💡" title="GPU-accel saves 5–8× CPU cores" body={`Moving preprocessing to CUDA drops CPU load from ~${Math.ceil(c.tfl*0.0004)} cores to ~${c.cp} cores. At ${c.es} streams, this is the difference between a 32-core and 8-core server.`} color="#00e5b8"/>
                </div>
              </div>

              {showF&&(
                <div className="cc" style={{marginBottom:10}}>
                  <ST>Formulas</ST>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                    {[
                      {l:"IPS demand/stream",f:`Σ[fps × (res_w/640)²]`,r:`${c.tidem?.toFixed(2)||0} IPS`},
                      {l:"Streams per GPU",  f:`floor(${g.ips} / ${c.tidem?.toFixed(1)||0})`,r:String(c.spg)},
                      {l:"GPUs needed",      f:`ceil(${c.es} / ${c.spg})`,r:String(c.gpus)},
                      {l:"CPU decode cores", f:`ceil(${c.tbw}Mbps / 600)`,r:`${c.cd} cores`},
                    ].map((f,i)=>(
                      <div key={i} style={{background:"var(--pan)",border:"1px solid var(--bd)",borderLeft:"3px solid var(--ac2)",borderRadius:"0 6px 6px 0",padding:"8px 10px"}}>
                        <div style={{fontSize:7.5,color:"var(--mu)",marginBottom:2}}>{f.l}</div>
                        <div style={{fontFamily:"var(--mono)",fontSize:8,color:"#8fa4bb",marginBottom:3,lineHeight:1.4}}>{f.f}</div>
                        <div style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,color:"var(--ac)"}}>{f.r}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>)}

            {/* ═══ NETWORK ═══ */}
            {tab==="network"&&(<>
              <div className="mg">
                <MC label="Raw Bandwidth" value={c.tbw.toLocaleString()} unit="Mbps" sub={`${c.es}×${bps}Mbps`}/>
                <MC label="In Gbps" value={(c.tbw/1000).toFixed(2)} unit="Gbps" sub="raw"/>
                <MC label="With 20% Buffer" value={c.bgbps.toFixed(2)} unit="Gbps" sub="RTSP + bursts" a/>
                <MC label="Switch Needed" value={c.bgbps>10?"25GbE+":"10GbE"} unit="" sub={`${c.bgbps.toFixed(1)}Gbps load`} w={c.bgbps>10}/>
                <MC label="Per-Server BW" value={c.srvs>0?(c.bgbps/c.srvs).toFixed(2):"0"} unit="Gbps" sub={`÷${c.srvs} servers`} i/>
                <MC label="Daily Ingestion" value={(c.tbw*B*SPD/1024/1024).toFixed(1)} unit="TB/day" sub="raw stream data"/>
              </div>

              {c.bgbps>10&&<div className="al alw"><span>⚠️</span><span>Load exceeds 10GbE. Plan for 25GbE switches/NICs. Budget $8K–20K for top-of-rack switch.</span></div>}
              {c.bgbps<=1&&<div className="al alo"><span>✅</span><span>Very low bandwidth — standard 1GbE ports sufficient.</span></div>}

              <ST>Bandwidth scaling analysis</ST>
              <div className="cg">
                <div className="cc">
                  <div className="ctit">Bandwidth vs stream count (current marked)</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={[10,25,50,100,200,320,500,750,1000].map(s=>({s,gbps:+(s*bps/1000*1.2).toFixed(2)}))} margin={{top:5,right:15,left:-10,bottom:5}}>
                      <defs><linearGradient id="bwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a90d9" stopOpacity={0.4}/><stop offset="100%" stopColor="#4a90d9" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                      <XAxis dataKey="s" tick={{fontSize:7.5,fill:"#56697e"}}/>
                      <YAxis tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>`${v}G`}/>
                      <ReferenceLine x={c.es} stroke="#00e5b8" strokeDasharray="4 2"/>
                      <ReferenceLine y={10} stroke="#f5a623" strokeDasharray="3 3"/>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.s} streams</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{payload[0].value}Gbps</div></div>):null}/>
                      <Area type="monotone" dataKey="gbps" stroke="#4a90d9" fill="url(#bwg)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="cc">
                  <div className="ctit">Bandwidth vs bitrate per stream</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={[1,2,4,6,8,10,15,20,25].map(b=>({b,gbps:+(c.es*b/1000*1.2).toFixed(2)}))} margin={{top:5,right:15,left:-10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                      <XAxis dataKey="b" tick={{fontSize:7.5,fill:"#56697e"}} label={{value:"Mbps",position:"insideBottomRight",offset:-5,style:{fill:"#56697e",fontSize:7.5}}}/>
                      <YAxis tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>`${v}G`}/>
                      <ReferenceLine x={bps} stroke="#00e5b8" strokeDasharray="4 2"/>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.b}Mbps/stream</div><div style={{fontFamily:"var(--mono)",color:"#f5a623",fontWeight:700}}>{payload[0].value}Gbps total</div></div>):null}/>
                      <Line type="monotone" dataKey="gbps" stroke="#f5a623" strokeWidth={2} dot={{r:2.5,fill:"#f5a623"}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <ST>Switch specification guide</ST>
              <div className="cg3" style={{marginBottom:10}}>
                {[
                  {tier:"10GbE",max:10,cost:"$2K–8K",use:"Up to ~800 streams @1Mbps"},
                  {tier:"25GbE",max:25,cost:"$8K–20K",use:"High-density inference clusters"},
                  {tier:"100GbE",max:100,cost:"$30K+",use:"Hyperscale / data center"},
                ].map((sw,i)=>{
                  const active=c.bgbps<=sw.max&&(i===0||c.bgbps>(i===1?10:25));
                  return(
                    <div key={i} className="cc" style={{border:`1px solid ${active?"#00e5b840":"var(--bd)"}`,background:active?"#00e5b808":"var(--pan)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <div style={{fontSize:11,fontFamily:"var(--mono)",fontWeight:700,color:active?"var(--ac)":"var(--mu)"}}>{sw.tier}</div>
                        {active&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:3,background:"#00e5b820",color:"var(--ac)",border:"1px solid #00e5b840",fontFamily:"var(--mono)"}}>MATCH</span>}
                      </div>
                      <div style={{fontSize:7.5,color:"var(--mu)",lineHeight:1.7}}>
                        <div>Max: <span style={{color:"#f1f5f9"}}>{sw.max}Gbps</span></div>
                        <div>Cost: <span style={{color:"#f1f5f9"}}>{sw.cost}</span></div>
                        <div>Load: <span style={{color:c.bgbps<=sw.max?"var(--ac)":"#e85555",fontWeight:700}}>{c.bgbps.toFixed(1)}G {c.bgbps<=sw.max?"✓":"✗"}</span></div>
                        <div style={{marginTop:4,fontSize:7,color:"#64748b"}}>{sw.use}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <IC icon="🔀" title="VLANs for AI traffic isolation" body="Separate AI inference traffic from general network. A dedicated VLAN prevents burst load from impacting other systems and simplifies QoS." color="#4a90d9"/>
              <IC icon="📦" title="Jumbo frames reduce CPU interrupt overhead" body="Enable MTU 9000 on AI server NICs and switches. For high-throughput video ingestion this reduces CPU interrupt overhead ~15–20% at 10GbE+." color="#00e5b8"/>
              <IC icon="⚡" title={`At ${c.es} streams: ${c.bgbps>10?"25GbE or better needed":"10GbE sufficient"}`} body={c.bgbps>10?`Current load ${c.bgbps.toFixed(1)}Gbps exceeds 10GbE. Plan 25GbE NICs on each server and a 25GbE ToR switch.`:`Current load ${c.bgbps.toFixed(1)}Gbps fits 10GbE. Standard switches at $2K–8K will suffice.`} color="#f5a623"/>
            </>)}

            {/* ═══ STORAGE ═══ */}
            {tab==="storage"&&(<>
              {!stor&&<div className="al ali"><span>💾</span><span>Storage disabled. Enable in left panel for retention-based estimate.</span></div>}
              <div className="mg">
                <MC label="MB/sec/Stream" value={(bps*B).toFixed(2)} unit="MB/s" sub={`${bps}Mbps×0.125`}/>
                <MC label="GB/day/Stream" value={(c.gpd||0).toFixed(1)} unit="GB/day" sub="×86,400s"/>
                <MC label="TB/day (total)" value={(c.tpd||0).toFixed(2)} unit="TB/day" sub={`${c.es} streams`} a={stor}/>
                <MC label="Total Storage" value={stor?(c.pbt*1024).toFixed(0):"—"} unit="TB" sub={stor?`${ret}d×${redund.toFixed(1)}×`:"Enable"} w={stor}/>
                <MC label="Storage Cost" value={stor?fmtN(c.stcL):"—"} unit={stor?`–${fmtN(c.stcH)}`:""}  sub={stor?`@$${stPTB}/TB`:"Enable"}/>
                <MC label="Raw Ingestion" value={(c.tbw*B*SPD/1024/1024).toFixed(1)} unit="TB/day" sub="before retention" i/>
              </div>

              {stor&&(<>
                <ST>Storage growth analysis</ST>
                <div className="cg">
                  <div className="cc">
                    <div className="ctit">Cumulative storage over retention period</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={Array.from({length:Math.min(ret,90)},(_,i)=>({d:i+1,tb:+((c.tpd||0)*(i+1)*redund).toFixed(1)}))} margin={{top:5,right:15,left:-10,bottom:5}}>
                        <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5a623" stopOpacity={0.4}/><stop offset="100%" stopColor="#f5a623" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/><XAxis dataKey="d" tick={{fontSize:7.5,fill:"#56697e"}}/><YAxis tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>`${v}TB`}/>
                        <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>Day {payload[0].payload.d}</div><div style={{fontFamily:"var(--mono)",color:"#f5a623",fontWeight:700}}>{payload[0].value}TB</div></div>):null}/>
                        <Area type="monotone" dataKey="tb" stroke="#f5a623" fill="url(#sg)" strokeWidth={2}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="cc">
                    <div className="ctit">Breakdown: raw data vs redundancy overhead</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={[{name:"Raw video",value:+(c.tpd*ret).toFixed(1),color:"#4a90d9"},{name:"Redundancy",value:+(c.tpd*ret*(redund-1)).toFixed(1),color:"#f5a623"}]} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={8}>
                          <Cell fill="#4a90d9"/><Cell fill="#f5a623"/>
                        </Pie>
                        <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].name}</div><div style={{fontFamily:"var(--mono)",color:"#f5a623",fontWeight:700}}>{payload[0].value}TB</div></div>):null}/>
                        <Legend formatter={v=><span style={{fontSize:7.5,color:"#8fa4bb"}}>{v}</span>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <ST>Retention vs cost tradeoff</ST>
                <div className="cc" style={{marginBottom:12}}>
                  <div className="ctit">Storage TB and cost at different retention periods (current marked)</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <ComposedChart data={[7,14,30,60,90,120,180,365].map(d=>({days:d,tb:+((c.tpd||0)*d*redund).toFixed(0),cost:Math.round((c.tpd||0)*d*redund*stPTB)}))} margin={{top:5,right:20,left:-10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                      <XAxis dataKey="days" tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>`${v}d`}/>
                      <YAxis yAxisId="l" tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>`${v}TB`}/>
                      <YAxis yAxisId="r" orientation="right" tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>fmtN(v)}/>
                      <ReferenceLine yAxisId="l" x={ret} stroke="#00e5b8" strokeDasharray="4 2"/>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.days}d retention</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{payload[0].payload.tb}TB · {fmtN(payload[0].payload.cost)}</div></div>):null}/>
                      <Bar yAxisId="l" dataKey="tb" fill="#4a90d930" radius={[3,3,0,0]}/>
                      <Line yAxisId="r" type="monotone" dataKey="cost" stroke="#f5a623" strokeWidth={2} dot={{r:2.5,fill:"#f5a623"}}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>)}

              <ST>Storage tiering strategy</ST>
              <div className="cg3" style={{marginBottom:10}}>
                {[
                  {tier:"Hot / NVMe SSD",cost:"$150–400/TB",lat:"<1ms",use:`Last 24–72h. Active AI results, recent flagged clips.`,col:"#00e5b8"},
                  {tier:"Warm / SATA SSD",cost:"$50–100/TB",lat:"~5ms",use:`Days 3–${Math.min(30,ret)}. Recent archive, ad-hoc review.`,col:"#4a90d9"},
                  {tier:"Cold / HDD NAS",cost:"$15–40/TB",lat:"~20ms",use:`Days ${Math.min(31,ret)}–${ret}. Compliance, infrequent access.`,col:"#f5a623"},
                ].map((s,i)=>(
                  <div key={i} className="cc">
                    <div style={{fontSize:9,fontWeight:700,color:s.col,marginBottom:3}}>{s.tier}</div>
                    <div style={{fontSize:7.5,color:"var(--mu)",lineHeight:1.7}}>
                      <div>Cost: <span style={{color:"#f1f5f9"}}>{s.cost}</span></div>
                      <div>Latency: <span style={{color:"#f1f5f9"}}>{s.lat}</span></div>
                      <div style={{marginTop:4}}>{s.use}</div>
                    </div>
                  </div>
                ))}
              </div>

              <IC icon="💡" title="RAID vs erasure coding" body="For >50TB storage, erasure coding (RAID-6 equivalent via Ceph or MinIO) gives better space efficiency than RAID-10 while maintaining durability." color="#4a90d9"/>
              <IC icon="📉" title="H.265 can halve your storage cost" body="Switching from H.264 to H.265 encoding at the source reduces storage 40–60% at equal quality. If you control camera encoding, this is often the cheapest storage optimization available." color="#00e5b8"/>
            </>)}

            {/* ═══ COST ═══ */}
            {tab==="cost"&&(<>
              <div className="mg">
                <MC label="GPU Hardware" value={fmtN(c.gcL)} unit={`–${fmtN(c.gcH)}`} sub={`${c.gpus}×${g.name.replace("NVIDIA ","")}`} a/>
                <MC label="Servers" value={fmtN(c.scL)} unit={`–${fmtN(c.scH)}`} sub={`${c.srvs} servers`}/>
                <MC label="Storage" value={stor?fmtN(c.stcL):"—"} unit={stor?`–${fmtN(c.stcH)}`:""} sub={stor?`${(c.pbt*1024).toFixed(0)}TB`:"Enable"} w={stor}/>
                <MC label="Total CAPEX" value={fmtN(c.capL)} unit={`–${fmtN(c.capH)}`} sub="GPU+servers+storage" a/>
                <MC label="Cost/Stream" value={fmtN(c.cpsL)} unit={`–${fmtN(c.cpsH)}`} sub={`${c.es} streams`} i/>
                <MC label="Annual Power" value={fmtN(c.apc)} unit="/yr" sub={`${c.pw}W·$0.12/kWh`}/>
                {cloud&&<MC label="Cloud/Month" value={fmtN(c.cmL)} unit={`–${fmtN(c.cmH)}`} sub={`${c.gpus} GPUs×720h`} w/>}
                {cloud&&<MC label="Break-Even" value={`${c.cmH>0?(c.gcL/c.cmH).toFixed(0):"?"}`} unit="months" sub="cloud vs on-prem" i/>}
              </div>

              <div className="cg">
                <div className="cc">
                  <div className="ctit">{cloud?"Cloud OPEX":"On-prem CAPEX"} — low / high</div>
                  {!cloud?(
                    <>
                      {[
                        {label:`⚡ GPU Hardware (${c.gpus}×)`,lo:c.gcL,hi:c.gcH,color:"#00e5b8",pct:c.capL>0?+(c.gcL/c.capL*100).toFixed(0):0},
                        {label:`🖥️ Servers (${c.srvs}×)`,     lo:c.scL,hi:c.scH,color:"#4a90d9",pct:c.capL>0?+(c.scL/c.capL*100).toFixed(0):0},
                        {label:`💾 Storage`,                  lo:c.stcL,hi:c.stcH,color:"#f5a623",pct:c.capL>0?+(c.stcL/c.capL*100).toFixed(0):0},
                      ].map((r,i)=>(
                        <div key={i} className="cr">
                          <div style={{flex:1}}>
                            <div style={{fontSize:10,color:"#8fa4bb",marginBottom:3}}>{r.label} <span style={{fontFamily:"var(--mono)",fontSize:8,color:r.color}}>({r.pct}%)</span></div>
                            <div style={{background:"var(--pan2)",borderRadius:3,height:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${r.pct}%`,background:r.color,borderRadius:3}}/>
                            </div>
                          </div>
                          <span style={{fontFamily:"var(--mono)",fontSize:10,marginLeft:10}}>
                            <span style={{color:"#8fa4bb"}}>{fmtN(r.lo)}</span><span style={{color:"var(--mu)",margin:"0 3px"}}>–</span><span style={{color:r.color,fontWeight:700}}>{fmtN(r.hi)}</span>
                          </span>
                        </div>
                      ))}
                      <div className="ctot">
                        <div style={{fontSize:7.5,color:"var(--mu)",textTransform:"uppercase",letterSpacing:"1px"}}>Total CAPEX</div>
                        <div style={{fontFamily:"var(--mono)",fontSize:24,fontWeight:700,color:"var(--ac)",marginTop:2}}>{fmtN(c.capL)}</div>
                        <div style={{fontFamily:"var(--mono)",fontSize:10,color:"#8fa4bb"}}>up to {fmtN(c.capH)}</div>
                        <div style={{fontSize:7.5,color:"#56697e",marginTop:4}}>{fmtN(c.cpsL)}–{fmtN(c.cpsH)} per stream</div>
                      </div>
                    </>
                  ):(
                    <>
                      {[
                        {label:`GPU rental (${c.gpus}×720h/mo)`,lo:c.cmL,hi:c.cmH,color:"#00e5b8",suffix:"/mo"},
                        {label:"Annual cloud cost",lo:c.caL,hi:c.caH,color:"#4a90d9",suffix:"/yr"},
                        {label:"3-year total (cloud)",lo:c.caL*3,hi:c.caH*3,color:"#f5a623",suffix:""},
                        {label:"On-prem break-even",lo:0,hi:0,color:"#9b59b6",breakeven:true},
                      ].map((r,i)=>(
                        <div key={i} className="cr">
                          <span style={{fontSize:10,color:"#8fa4bb"}}>{r.label}</span>
                          {r.breakeven?(
                            <span style={{fontFamily:"var(--mono)",fontSize:10,color:"#9b59b6",fontWeight:700}}>{c.cmH>0?(c.gcL/c.cmH).toFixed(0):"?"}–{c.cmL>0?(c.gcH/c.cmL).toFixed(0):"?"} months</span>
                          ):(
                            <span style={{fontFamily:"var(--mono)",fontSize:10}}><span style={{color:"#8fa4bb"}}>{fmtN(r.lo)}</span><span style={{color:"var(--mu)",margin:"0 3px"}}>–</span><span style={{color:r.color,fontWeight:700}}>{fmtN(r.hi)}{r.suffix}</span></span>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div className="cc">
                  <div className="ctit">Cost distribution (low estimate)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[{name:"GPU Hardware",value:c.gcL,color:"#00e5b8"},{name:"Servers",value:c.scL,color:"#4a90d9"},{name:"Storage",value:Math.max(0,c.stcL),color:"#f5a623"}]} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={8.5}>
                        {["#00e5b8","#4a90d9","#f5a623"].map((cl,i)=><Cell key={i} fill={cl}/>)}
                      </Pie>
                      <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].name}</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{fmtN(payload[0].value)}</div></div>):null}/>
                      <Legend formatter={v=><span style={{fontSize:7.5,color:"#8fa4bb"}}>{v}</span>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <ST>Cloud vs on-prem TCO over 36 months</ST>
              <div className="cc" style={{marginBottom:12}}>
                <div className="ctit">Cumulative spend comparison — on-prem CAPEX+power vs cloud OPEX</div>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={Array.from({length:37},(_,i)=>({mo:i,onp:Math.round(c.capL+i*(c.apc/12)),cld:Math.round(i*c.cmL)}))} margin={{top:5,right:20,left:-5,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                    <XAxis dataKey="mo" tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>`M${v}`}/>
                    <YAxis tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>fmtN(v)}/>
                    <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>Month {payload[0].payload.mo}</div><div style={{fontSize:8.5}}><span style={{color:"#00e5b8"}}>On-prem: {fmtN(payload[0].payload.onp)}</span><br/><span style={{color:"#f5a623"}}>Cloud: {fmtN(payload[0].payload.cld)}</span></div></div>):null}/>
                    <Line type="monotone" dataKey="onp" name="On-prem TCO" stroke="#00e5b8" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="cld" name="Cloud OPEX" stroke="#f5a623" strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                  </LineChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:12,marginTop:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,fontSize:8,color:"var(--mu)"}}><div style={{width:12,height:2,background:"#00e5b8"}}/> On-prem (CAPEX + power)</div>
                  <div style={{display:"flex",alignItems:"center",gap:4,fontSize:8,color:"var(--mu)"}}><div style={{width:12,height:0,borderTop:"2px dashed #f5a623"}}/> Cloud OPEX</div>
                </div>
              </div>

              <ST>Cost per stream by GPU type</ST>
              <div className="cc" style={{marginBottom:12}}>
                <div className="ctit">$/stream efficiency — VRAM-compatible GPUs only (highlighted = current)</div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={gpuCmp.filter(gg=>gg.fits).map(gg=>({name:gg.name,cps:gg.cps,cur:gg.name===g.name.replace("NVIDIA ","").replace(" 80GB","")}))} margin={{top:5,right:5,left:-15,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                    <XAxis dataKey="name" tick={{fontSize:7.5,fill:"#56697e"}}/>
                    <YAxis tick={{fontSize:7.5,fill:"#56697e"}} tickFormatter={v=>fmtN(v)}/>
                    <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:"#0f1825",border:"1px solid #1f2f42",borderRadius:5,padding:"5px 8px",fontSize:9}}><div style={{color:"#56697e",fontSize:7.5}}>{payload[0].payload.name}</div><div style={{fontFamily:"var(--mono)",color:"#00e5b8",fontWeight:700}}>{fmtN(payload[0].value)}/stream</div></div>):null}/>
                    <Bar dataKey="cps" radius={[4,4,0,0]}>{gpuCmp.filter(gg=>gg.fits).map((gg,i)=><Cell key={i} fill={gg.name===g.name.replace("NVIDIA ","").replace(" 80GB","")?"#00e5b8":"#4a90d940"}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ST>Power & operating cost</ST>
              <div className="cg3" style={{marginBottom:10}}>
                {[
                  {l:"Power draw",v:`${c.pw}W`,sub:`${c.gpus}×${g.tdp}W GPUs + ${c.srvs}×200W servers`,col:"#f5a623"},
                  {l:"Annual power cost",v:fmtN(c.apc),sub:`${(c.pkh/1000).toFixed(0)} MWh/yr @ $0.12/kWh`,col:"#e85555"},
                  {l:"3-year TCO",v:fmtN(c.capL+c.apc*3),sub:`CAPEX ${fmtN(c.capL)} + power ${fmtN(c.apc*3)}`,col:"#00e5b8"},
                ].map((r,i)=>(
                  <div key={i} className="cc">
                    <div className="ctit">{r.l}</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:20,fontWeight:700,color:r.col,marginBottom:3}}>{r.v}</div>
                    <div style={{fontSize:7.5,color:"var(--mu)",lineHeight:1.6}}>{r.sub}</div>
                  </div>
                ))}
              </div>

              <IC icon="💸" title={`GPU is ${c.capL>0?((c.gcL/c.capL)*100).toFixed(0):"~70"}% of total cost`} body="This is typical for inference clusters. Server and storage costs are secondary — optimize GPU selection first. Consider L4 for efficiency or H20 for large-model workloads." color="#00e5b8"/>
              <IC icon="📅" title={`Cloud makes sense under ${c.cmH>0?(c.gcL/c.cmH).toFixed(0):"~18"} months of use`} body="On-prem looks expensive upfront. But 24/7 inference on multiple GPUs past the break-even point costs more in cloud than buying the hardware." color="#4a90d9"/>
            </>)}

          </div>
        </div>
      </div>
    </div>
  </>);
}
