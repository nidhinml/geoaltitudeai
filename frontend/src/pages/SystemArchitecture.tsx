import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Cpu, Network, Radar, ChevronRight, Activity, 
  Map as MapIcon, Layers, Zap, Car, Ruler, Droplets, MountainSnow, Fuel, Navigation
} from 'lucide-react';

// Animation variants for 3D card flips
const cardVariants = {
  hidden: { opacity: 0, rotateY: -90, z: -200 },
  visible: { 
    opacity: 1, 
    rotateY: 0, 
    z: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 20 }
  },
  exit: { opacity: 0, rotateY: 90, z: -200, transition: { duration: 0.3 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariant = {
  hidden: { opacity: 0, x: -30, scale: 0.9 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, stiffness: 120, damping: 14 } }
};

const ShootingArrow = ({ delay, color = 'cyan' }: { delay: number, color?: string }) => {
  const glowColor = color === 'cyan' ? 'from-transparent via-cyan-400 to-white shadow-[0_0_8px_#22d3ee]' : 
                    color === 'pink' ? 'from-transparent via-pink-400 to-white shadow-[0_0_8px_#f472b6]' :
                    'from-transparent via-blue-400 to-white shadow-[0_0_8px_#60a5fa]';
  return (
    <motion.div variants={itemVariant} className="relative w-8 lg:w-16 h-8 hidden lg:flex items-center justify-center">
      <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-[2px] bg-white/10 w-full" />
      <motion.div
        animate={{ x: [-20, 60], opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, delay: delay, ease: "linear" }}
        className={`absolute top-1/2 -translate-y-1/2 left-0 w-8 h-[2px] bg-gradient-to-r ${glowColor}`}
      />
      <ChevronRight className="absolute right-0 w-6 h-6 text-white/30" />
    </motion.div>
  );
};

const FloatingBox = ({ children, delay }: { children: React.ReactNode, delay: number }) => (
  <motion.div
    variants={itemVariant}
    animate={{ y: [0, -8, 0] }}
    transition={{ repeat: Infinity, duration: 3, delay: delay, ease: "easeInOut" }}
    className="w-full lg:w-48 h-32"
  >
    {children}
  </motion.div>
);

const physicsFormulas = [
  {
    id: 'distance',
    title: 'Haversine Distance',
    icon: MapIcon,
    color: '#3b82f6', // blue
    front: 'Calculates the true physical distance between two GPS coordinates on the curvature of the Earth.',
    back: 'R = 6371000m\na = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)\nc = 2·atan2(√a, √(1−a))\ndistance = R·c'
  },
  {
    id: 'gradient',
    title: 'Terrain Gradient',
    icon: Ruler,
    color: '#22c55e', // green
    front: 'Calculates the steepness percentage (Rise over Run) using XGBoost predicted altitudes.',
    back: 'Elevation_Change = Alt_Current - Alt_Previous\nRun_Distance = Haversine(Current, Previous)\nGradient_Pct = (Elevation_Change / Run_Distance) * 100'
  },
  {
    id: 'fuel',
    title: 'Fuel Efficiency Impact',
    icon: Fuel,
    color: '#f43f5e', // rose
    front: 'Translates geographical steepness into physical torque requirements and fuel burn rates.',
    back: 'Steep Uphill (>8%): Impact = 2.5 * Gradient\nModerate Uphill: Impact = 1.5 * Gradient\nDownhill: Impact = Negative (Regen/Coast)'
  },
  {
    id: 'flood',
    title: 'Flood Risk',
    icon: Droplets,
    color: '#0ea5e9', // light blue
    front: 'Identifies vulnerable low-lying coastal or valley regions prone to seasonal flooding.',
    back: 'Very High Risk: Altitude <= 5m\nHigh Risk: Altitude <= 15m\nModerate Risk: Altitude <= 50m\nLow Risk: Altitude <= 150m'
  },
  {
    id: 'landslide',
    title: 'Landslide Risk',
    icon: MountainSnow,
    color: '#f97316', // orange
    front: 'Combines extreme altitude and steep slopes to detect high-risk landslide zones.',
    back: 'Very High Risk: Alt > 500m AND Gradient > 15%\nHigh Risk: Alt > 100m AND Gradient > 15%\nModerate: Gradient > 5%'
  },
  {
    id: 'vehicle_intel',
    title: 'Vehicle Intelligence (Live)',
    icon: Car,
    color: '#f59e0b', // amber
    front: 'Dynamically calculates real-time constraints like engine torque bounds and immediate flood danger as the vehicle moves.',
    back: 'Live_Risk = Flood(Alt_Current) + Landslide(Alt, Gradient)\nTorque_Loss = Base_Torque - (Gradient_Pct * 1.5)\nEfficiency = Fuel_Map(Gradient, Speed)'
  },
  {
    id: 'route_intel',
    title: 'Route Intelligence (Batch)',
    icon: Navigation,
    color: '#10b981', // emerald
    front: 'Aggregates mathematical anomalies across an entire trip to provide a holistic journey risk assessment before departure.',
    back: 'Total_Ascent = Σ(ΔAlt > 0)\nTotal_Descent = Σ(|ΔAlt| < 0)\nMax_Gradient = MAX(All_Gradients)\nSteep_Events = COUNT(Gradient > 6%)'
  }
];

export default function SystemArchitecture() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'physics' | 'diagram'>('pipeline');
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-play the pipeline steps
  useEffect(() => {
    if (!isAutoPlaying || activeTab !== 'pipeline') return;
    
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % pipelineSteps.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [isAutoPlaying, activeTab]);

  const pipelineSteps = [
    {
      id: 'ingestion',
      title: 'Data Ingestion & Cleaning',
      icon: Database,
      color: 'from-blue-500/20 to-cyan-500/5',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      description: 'The system ingests massive CSV files containing raw GPS trails. The Pandas-based backend immediately drops duplicates, removes infinite values, and interpolates missing rows.',
      diagram: (
        <div className="flex items-center justify-center h-full gap-4 relative perspective-1000">
          <motion.div 
            animate={{ rotateX: [0, 10, 0], y: [0, -5, 0] }} 
            transition={{ repeat: Infinity, duration: 4 }}
            className="relative w-24 h-32 bg-[#1F293D] rounded border border-blue-500/50 flex flex-col shadow-[0_0_20px_rgba(59,130,246,0.3)] overflow-hidden"
          >
            <div className="h-6 border-b border-white/10 flex items-center px-2 z-10 bg-[#1F293D]"><div className="w-10 h-1.5 bg-blue-500/50 rounded-full"></div></div>
            <div className="flex-1 p-2 space-y-2 relative">
               {/* Animated streaming rows */}
               {[0, 1, 2, 3].map(i => (
                 <motion.div 
                   key={i}
                   animate={{ y: [-40, 80], opacity: [0, 1, 0] }}
                   transition={{ repeat: Infinity, duration: 2, delay: i * 0.5, ease: "linear" }}
                   className="absolute left-2 right-2 h-1.5 bg-blue-400/50 rounded"
                 />
               ))}
            </div>
          </motion.div>
          <motion.div animate={{ x: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
             <ChevronRight className="w-8 h-8 text-blue-500" />
          </motion.div>
          <motion.div 
            animate={{ rotateY: [0, -10, 0], y: [0, 5, 0] }} 
            transition={{ repeat: Infinity, duration: 4, delay: 0.5 }}
            className="w-24 h-32 bg-[#161D30] rounded border border-green-500/50 flex flex-col shadow-[0_0_20px_rgba(34,197,94,0.2)]"
          >
             <div className="h-6 border-b border-white/10 flex items-center px-2"><div className="w-10 h-1.5 bg-green-500/50 rounded-full"></div></div>
             <div className="flex-1 p-2 space-y-2 flex flex-col justify-center items-center">
                <Database className="w-8 h-8 text-green-400" />
                <span className="text-[8px] text-green-400 font-mono">CLEANED</span>
             </div>
          </motion.div>
        </div>
      )
    },
    {
      id: 'engineering',
      title: 'Feature Engineering',
      icon: Cpu,
      color: 'from-green-500/20 to-emerald-500/5',
      border: 'border-green-500/30',
      text: 'text-green-400',
      description: 'Altitude isn\'t strictly linear. The system mathematically expands the dataset by adding polynomial features (lat², lon², lat*lon) so the AI can understand non-linear geographic curves like mountains.',
      diagram: (
        <div className="flex items-center justify-center h-full relative perspective-1000">
           <motion.div
             animate={{ rotateZ: 360 }}
             transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
             className="w-32 h-32 rounded-full border-2 border-dashed border-green-500/30 absolute"
           />
           <div className="grid grid-cols-2 gap-4 z-10">
             <motion.div animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0px #22c55e', '0 0 15px #22c55e', '0 0 0px #22c55e'] }} transition={{ repeat: Infinity, duration: 2 }} className="bg-[#1F293D] p-3 rounded border border-green-500/50 shadow-lg text-center font-mono text-xs text-green-400">lat²</motion.div>
             <motion.div animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0px #22c55e', '0 0 15px #22c55e', '0 0 0px #22c55e'] }} transition={{ repeat: Infinity, duration: 2, delay: 0.5 }} className="bg-[#1F293D] p-3 rounded border border-green-500/50 shadow-lg text-center font-mono text-xs text-green-400">lon²</motion.div>
             <motion.div animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0px #22c55e', '0 0 15px #22c55e', '0 0 0px #22c55e'] }} transition={{ repeat: Infinity, duration: 2, delay: 1 }} className="bg-[#1F293D] p-3 rounded border border-green-500/50 shadow-lg col-span-2 text-center font-mono text-xs text-green-400">lat × lon</motion.div>
           </div>
        </div>
      )
    },
    {
      id: 'training',
      title: 'XGBoost Training & Registry',
      icon: Network,
      color: 'from-orange-500/20 to-red-500/5',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      description: 'The XGBoost Regressor trains on the engineered features. The finalized model is serialized as a `.joblib` file and tracked via a local `models_registry.json` database without needing Postgres.',
      diagram: (
        <div className="flex flex-col items-center justify-center h-full gap-4 relative perspective-1000">
          <motion.div 
            animate={{ y: [0, -10, 0] }} 
            transition={{ repeat: Infinity, duration: 3 }}
            className="w-40 h-16 bg-[#161D30] rounded-xl border border-orange-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.2)]"
          >
            <span className="font-bold text-orange-400 tracking-widest text-sm">XGBoost Regressor</span>
          </motion.div>
          <div className="flex gap-4">
            <motion.div 
              animate={{ rotateY: [0, 360] }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="w-16 h-20 bg-[#1F293D] rounded border border-white/20 flex flex-col items-center justify-center"
            >
              <Layers className="w-6 h-6 text-white mb-1" />
              <span className="text-[8px] text-white/50">v1.joblib</span>
            </motion.div>
            <motion.div 
              animate={{ rotateY: [0, 360] }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear", delay: 1 }}
              className="w-16 h-20 bg-[#1F293D] rounded border border-orange-500 flex flex-col items-center justify-center shadow-lg"
            >
              <Activity className="w-6 h-6 text-orange-400 mb-1" />
              <span className="text-[8px] text-orange-400 font-bold">ACTIVE</span>
            </motion.div>
          </div>
        </div>
      )
    },
    {
      id: 'routing',
      title: 'Routing via OSRM',
      icon: MapIcon,
      color: 'from-pink-500/20 to-rose-500/5',
      border: 'border-pink-500/30',
      text: 'text-pink-400',
      description: 'On the frontend, when a user selects a Start and End city, the React app pings the Open Source Routing Machine (OSRM). OSRM calculates the optimal road path and returns hundreds of intermediate GPS waypoints.',
      diagram: (
        <div className="flex items-center justify-center h-full gap-4 relative perspective-1000">
          <motion.div 
            style={{ rotateX: 45, rotateZ: -10 }}
            className="relative w-48 h-32 bg-[#161D30] border border-pink-500/30 rounded-xl shadow-[0_20px_50px_rgba(236,72,153,0.2)] overflow-hidden"
          >
             <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full">
               <motion.path 
                 d="M 20 80 Q 60 80, 90 50 T 160 30 T 180 60" 
                 stroke="#ec4899" strokeWidth="2" fill="none" 
                 initial={{ pathLength: 0 }}
                 animate={{ pathLength: 1 }}
                 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
               />
               <circle cx="20" cy="80" r="4" fill="#ec4899" />
               <circle cx="180" cy="60" r="4" fill="#ec4899" />
               <motion.circle 
                 cx="0" cy="0" r="6" fill="#fbcfe8"
                 animate={{
                   offsetDistance: ['0%', '100%']
                 } as any}
                 style={{ offsetPath: "path('M 20 80 Q 60 80, 90 50 T 160 30 T 180 60')" } as React.CSSProperties}
                 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
               />
             </svg>
          </motion.div>
        </div>
      )
    },
    {
      id: 'inference',
      title: 'Live Inference',
      icon: Zap,
      color: 'from-purple-500/20 to-fuchsia-500/5',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      description: 'The frontend streams these waypoints to the FastAPI backend one-by-one. The active XGBoost model instantly predicts the altitude for each coordinate.',
      diagram: (
        <div className="flex items-center justify-center h-full gap-6 relative perspective-1000">
           <motion.div animate={{ rotateY: [0, 360] }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}>
             <Cpu className="w-12 h-12 text-purple-500" />
           </motion.div>
           <div className="flex flex-col gap-2">
             <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-24 h-1 bg-purple-500 rounded-full" />
             <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }} className="w-24 h-1 bg-purple-500 rounded-full" />
             <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 1 }} className="w-24 h-1 bg-purple-500 rounded-full" />
           </div>
           <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
             <Zap className="w-12 h-12 text-fuchsia-400 fill-fuchsia-400" />
           </motion.div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: 'Animated Dashboard (React)',
      icon: Radar,
      color: 'from-blue-500/20 to-indigo-500/5',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      description: 'The frontend receives the altitude predictions and runs them through our localized Physics Engine. It animates a vehicle marker moving along the Leaflet map while dynamically updating the React gauges for Speed, Heading, Gradient, and Fuel Loss.',
      diagram: (
        <div className="flex items-center justify-center h-full gap-6 relative perspective-1000">
           <div className="relative w-40 h-24">
             {/* Map pseudo-UI */}
             <motion.div 
               style={{ rotateX: 60, rotateZ: -45 }}
               className="absolute inset-0 bg-[#161D30] border-2 border-blue-500/30 rounded-xl shadow-[0_20px_50px_rgba(59,130,246,0.3)] grid grid-cols-4 grid-rows-4"
             >
               {Array.from({length: 16}).map((_, i) => (
                 <motion.div 
                   key={i} 
                   animate={{ opacity: [0.1, 0.5, 0.1] }}
                   transition={{ repeat: Infinity, duration: Math.random() * 2 + 1 }}
                   className="border border-white/5 bg-blue-500/10"
                 />
               ))}
               
               {/* Moving Car */}
               <motion.div 
                 animate={{ x: [0, 80], y: [0, 40] }}
                 transition={{ repeat: Infinity, duration: 4 }}
                 className="absolute top-2 left-2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_#fff]"
               />
             </motion.div>
           </div>
        </div>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <motion.div 
          initial={{ opacity: 0, y: -20, rotateX: 20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="perspective-1000"
        >
          <div className="bg-[#161D30]/80 border border-[#1F293D] rounded-2xl p-6 shadow-xl backdrop-blur-sm max-w-5xl transform-style-3d hover:rotate-y-2 transition-transform duration-500">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#3b82f6] to-[#22c55e] flex items-center gap-3 mb-3">
              <Layers className="w-8 h-8 text-[#3b82f6]" /> GeoAltitude AI: Complete Architecture & Physics Engine
            </h2>
            <p className="text-sm text-[#D1D5DB] leading-relaxed mb-4">
              GeoAltitude AI is an end-to-end Machine Learning platform designed to predict terrain altitude based on GPS coordinates and use that data to simulate vehicle telemetry, fuel impact, and natural disaster risks.
            </p>
            <p className="text-xs text-[#9CA3AF] leading-relaxed border-l-2 border-[#3b82f6] pl-4">
              Here is the complete architectural breakdown from raw data ingestion to the live animated dashboard, including the mathematical formulas driving the logic.
            </p>
          </div>
        </motion.div>
        
        {/* Tab Controls */}
        <div className="bg-[#161D30] border border-[#1F293D] p-1 rounded-xl flex gap-1">
          <button 
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'pipeline' ? 'bg-[#3b82f6] text-white shadow-lg' : 'text-[#9CA3AF] hover:text-white'}`}
          >
            Pipeline Flow
          </button>
          <button 
            onClick={() => setActiveTab('physics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'physics' ? 'bg-[#22c55e] text-white shadow-lg' : 'text-[#9CA3AF] hover:text-white'}`}
          >
            Physics Engine
          </button>
          <button 
            onClick={() => setActiveTab('diagram')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'diagram' ? 'bg-[#f59e0b] text-white shadow-lg' : 'text-[#9CA3AF] hover:text-white'}`}
          >
            Flow Diagram
          </button>
        </div>
      </div>

      <div className="flex-1 relative perspective-1000 h-full min-h-[500px]">
        <AnimatePresence mode="wait">
          
          {/* PIPELINE VISUALIZER */}
          {activeTab === 'pipeline' && (
            <motion.div 
              key="pipeline"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 flex flex-col lg:flex-row gap-6"
            >
              {/* Stepper Sidebar */}
              <div className="lg:w-1/3 bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-4 flex flex-col gap-2 relative shadow-2xl">
                <h3 className="text-white font-bold mb-2 px-2">Pipeline Stages</h3>
                {pipelineSteps.map((step, index) => (
                  <button 
                    key={index}
                    onClick={() => { setActiveStep(index); setIsAutoPlaying(false); }}
                    className={`p-4 rounded-xl text-left transition-all border ${activeStep === index ? `bg-gradient-to-r ${step.color} ${step.border}` : 'bg-[#161D30]/50 border-transparent hover:bg-[#161D30] hover:border-[#1F293D]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-black/30 ${activeStep === index ? step.text : 'text-[#9CA3AF]'}`}>
                        <step.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${activeStep === index ? step.text : 'text-[#9CA3AF]'}`}>Step {index + 1}</p>
                        <p className={`text-sm font-bold ${activeStep === index ? 'text-white' : 'text-[#D1D5DB]'}`}>{step.title}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Active Step Viewer */}
              <div className="flex-1 bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-8 relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeStep}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.1, y: -20 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="flex-1 flex flex-col"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`p-4 rounded-2xl bg-gradient-to-br ${pipelineSteps[activeStep].color} border ${pipelineSteps[activeStep].border}`}>
                        {React.createElement(pipelineSteps[activeStep].icon, { className: `w-8 h-8 ${pipelineSteps[activeStep].text}` })}
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-white">{pipelineSteps[activeStep].title}</h2>
                        <div className={`h-1 w-20 mt-2 rounded-full ${pipelineSteps[activeStep].text.replace('text', 'bg')}`}></div>
                      </div>
                    </div>
                    
                    <p className="text-[#9CA3AF] text-lg leading-relaxed mb-10 max-w-2xl">
                      {pipelineSteps[activeStep].description}
                    </p>

                    {/* 3D Diagram Container */}
                    <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-6 relative">
                       {/* Background Grid */}
                       <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] to-transparent z-0 rounded-2xl"></div>
                       <div className="relative z-10 w-full h-full">
                         {pipelineSteps[activeStep].diagram}
                       </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* PHYSICS ENGINE */}
          {activeTab === 'physics' && (
            <motion.div 
              key="physics"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-8 shadow-2xl overflow-y-auto custom-scrollbar"
            >
              <div className="mb-8 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl font-black text-white mb-4">Physics & Mathematics Engine</h2>
                <p className="text-[#9CA3AF]">
                  Hover over any concept to flip the card and view the underlying mathematical formulas used by the React frontend to simulate real-world vehicle dynamics in real-time.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 perspective-1000">
                {physicsFormulas.map((formula, idx) => (
                  <motion.div 
                    key={formula.id}
                    initial={{ opacity: 0, y: 50, rotateX: 30 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ delay: idx * 0.1, type: "spring" }}
                    className="group h-64 relative"
                    style={{ perspective: 1000 }}
                  >
                    {/* Inner wrapper for 3D flip */}
                    <div className="w-full h-full relative transition-all duration-700 transform-style-3d group-hover:rotate-y-180">
                      
                      {/* FRONT OF CARD */}
                      <div className="absolute inset-0 backface-hidden bg-[#161D30] border border-[#1F293D] rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-xl">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border shadow-inner" style={{ backgroundColor: `${formula.color}20`, borderColor: `${formula.color}50` }}>
                          <formula.icon className="w-8 h-8" style={{ color: formula.color }} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{formula.title}</h3>
                        <p className="text-xs text-[#9CA3AF] leading-relaxed">{formula.front}</p>
                        <div className="mt-auto pt-4 flex items-center gap-2 text-[10px] uppercase font-bold text-white/30">
                          <Car className="w-3 h-3" /> Hover for Math
                        </div>
                      </div>

                      {/* BACK OF CARD */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#080B11] border rounded-2xl p-6 flex flex-col justify-center shadow-xl" style={{ borderColor: `${formula.color}50`, boxShadow: `0 0 30px ${formula.color}20` }}>
                        <h4 className="text-[10px] uppercase font-bold tracking-widest mb-4" style={{ color: formula.color }}>Underlying Formula</h4>
                        <pre className="font-mono text-xs text-white/80 whitespace-pre-wrap leading-relaxed bg-black/50 p-4 rounded-xl border border-white/10">
                          {formula.back}
                        </pre>
                      </div>

                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          {/* FLOW DIAGRAM */}
          {activeTab === 'diagram' && (
            <motion.div 
              key="diagram"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-8 shadow-2xl overflow-y-auto custom-scrollbar flex flex-col gap-12 overflow-hidden relative"
            >
               {/* Laser Sweep Background */}
               <motion.div 
                 animate={{ left: ['-100%', '200%'] }} 
                 transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                 className="absolute top-0 bottom-0 w-64 bg-gradient-to-r from-transparent via-[#3b82f6]/10 to-transparent skew-x-[-45deg] z-0 pointer-events-none"
               />
               
               <div className="text-center relative z-10">
                 <h2 className="text-3xl font-black text-white mb-2">Data Pipeline & Machine Learning</h2>
                 <p className="text-[#9CA3AF]">How raw data becomes a trained AI model</p>
               </div>
               
               <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col lg:flex-row items-center justify-center gap-4 text-center mx-auto w-full max-w-6xl relative z-10">
                 <FloatingBox delay={0}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#161D30] border-2 border-blue-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.2)] w-full h-full flex flex-col items-center justify-center gap-2">
                     <span className="text-white font-bold text-sm">Raw GPS Dataset CSV</span>
                     <span className="text-[10px] text-[#9CA3AF] leading-tight">600k+ rows of latitude, longitude, and altitude telemetry.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.2} color="cyan" />
                 <FloatingBox delay={0.3}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#161D30] border-2 border-cyan-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.2)] w-full h-full flex flex-col items-center justify-center gap-2">
                     <span className="text-white font-bold text-sm">Data Cleaning Module</span>
                     <span className="text-[10px] text-[#9CA3AF] leading-tight">Drops nulls, removes duplicates, and interpolates missing data.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.4} color="cyan" />
                 <FloatingBox delay={0.6}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#161D30] border-2 border-emerald-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] w-full h-full flex flex-col items-center justify-center gap-2">
                     <span className="text-white font-bold text-sm">Feature Engineering</span>
                     <span className="text-[10px] text-[#9CA3AF] leading-tight">Generates polynomial features (lat², lon²) for non-linear learning.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.6} color="cyan" />
                 <FloatingBox delay={0.9}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#1F293D] border-2 border-orange-500 p-4 rounded-xl shadow-[0_0_30px_rgba(249,115,22,0.3)] w-full h-full flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-1000 -translate-x-full" />
                     <span className="text-orange-400 font-black text-sm">XGBoost Regressor</span>
                     <span className="text-[10px] text-orange-200/70 leading-tight">Trains to predict altitude based purely on lat/lon inputs.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.8} color="cyan" />
                 <FloatingBox delay={1.2}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#1F293D] border-2 border-amber-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] w-full h-full flex flex-col items-center justify-center gap-2">
                     <span className="text-amber-400 font-bold text-sm">Model Registry</span>
                     <span className="text-[10px] text-amber-200/70 leading-tight">Saves trained .joblib models and tracks metrics without SQL.</span>
                   </motion.div>
                 </FloatingBox>
               </motion.div>

               <div className="w-full h-px bg-gradient-to-r from-transparent via-[#1F293D] to-transparent my-4 relative z-10"></div>

               <div className="text-center relative z-10">
                 <h2 className="text-3xl font-black text-white mb-2">Live Dashboard Architecture</h2>
                 <p className="text-[#9CA3AF]">How the user interface interacts with the AI in real-time</p>
               </div>

               <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col lg:flex-row items-center justify-center gap-4 text-center mx-auto w-full max-w-6xl relative z-10">
                 <FloatingBox delay={0}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#161D30] border-2 border-blue-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.2)] w-full h-full flex flex-col items-center justify-center gap-2">
                     <span className="text-white font-bold text-sm">React Leaflet Map</span>
                     <span className="text-[10px] text-[#9CA3AF] leading-tight">User selects Start and End cities on the interactive map.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.2} color="pink" />
                 <FloatingBox delay={0.3}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#161D30] border-2 border-pink-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.2)] w-full h-full flex flex-col items-center justify-center gap-2">
                     <span className="text-white font-bold text-sm">OSRM Routing API</span>
                     <span className="text-[10px] text-[#9CA3AF] leading-tight">Returns hundreds of intermediate GPS waypoints for the path.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.4} color="pink" />
                 <FloatingBox delay={0.6}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#161D30] border-2 border-purple-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.2)] w-full h-full flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:translate-x-full transition-transform duration-1000 -translate-x-full" />
                     <span className="text-white font-bold text-sm">FastAPI Inference</span>
                     <span className="text-[10px] text-[#9CA3AF] leading-tight">Streams waypoints to XGBoost for live altitude predictions.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.6} color="pink" />
                 <FloatingBox delay={0.9}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#1F293D] border-2 border-green-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.2)] w-full h-full flex flex-col items-center justify-center gap-2">
                     <span className="text-white font-bold text-sm">Physics Engine</span>
                     <span className="text-[10px] text-[#9CA3AF] leading-tight">Calculates Haversine distance, gradients, and risk thresholds.</span>
                   </motion.div>
                 </FloatingBox>
                 <ShootingArrow delay={0.8} color="pink" />
                 <FloatingBox delay={1.2}>
                   <motion.div whileHover={{ scale: 1.05 }} className="bg-[#1F293D] border-2 border-red-500 p-4 rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.3)] w-full h-full flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-1000 -translate-x-full" />
                     <span className="text-red-400 font-black text-sm">Animated Telemetry</span>
                     <span className="text-[10px] text-red-200/70 leading-tight">Visualizes the vehicle moving and updates dashboard gauges.</span>
                   </motion.div>
                 </FloatingBox>
               </motion.div>

               <div className="w-full h-px bg-gradient-to-r from-transparent via-[#1F293D] to-transparent my-4 relative z-10"></div>

               <div className="text-center relative z-10">
                 <h2 className="text-3xl font-black text-white mb-2">End-User Applications</h2>
                 <p className="text-[#9CA3AF]">The distinct AI products built on top of the Physics Engine</p>
               </div>

               <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col lg:flex-row flex-wrap items-center justify-center gap-6 text-center mx-auto w-full max-w-6xl pb-8 relative z-10">
                 <motion.div variants={itemVariant} whileHover={{ y: -5, scale: 1.05 }} className="bg-[#161D30] border border-[#f59e0b]/30 p-4 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.1)] w-full lg:w-56 h-32 flex flex-col items-center justify-center gap-2 cursor-pointer group hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all">
                   <Car className="w-6 h-6 text-[#f59e0b] group-hover:scale-125 transition-transform duration-300" />
                   <span className="text-white font-bold text-sm">Vehicle Intelligence</span>
                   <span className="text-[10px] text-[#9CA3AF] leading-tight">Live torque limits & warnings</span>
                 </motion.div>
                 <motion.div variants={itemVariant} whileHover={{ y: -5, scale: 1.05 }} className="bg-[#161D30] border border-[#10b981]/30 p-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.1)] w-full lg:w-56 h-32 flex flex-col items-center justify-center gap-2 cursor-pointer group hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all">
                   <Navigation className="w-6 h-6 text-[#10b981] group-hover:scale-125 transition-transform duration-300" />
                   <span className="text-white font-bold text-sm">Route Intelligence</span>
                   <span className="text-[10px] text-[#9CA3AF] leading-tight">Pre-trip total journey analysis</span>
                 </motion.div>
                 <motion.div variants={itemVariant} whileHover={{ y: -5, scale: 1.05 }} className="bg-[#161D30] border border-[#f43f5e]/30 p-4 rounded-xl shadow-[0_0_20px_rgba(244,63,94,0.1)] w-full lg:w-56 h-32 flex flex-col items-center justify-center gap-2 cursor-pointer group hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] transition-all">
                   <Fuel className="w-6 h-6 text-[#f43f5e] group-hover:scale-125 transition-transform duration-300" />
                   <span className="text-white font-bold text-sm">Fuel Efficiency</span>
                   <span className="text-[10px] text-[#9CA3AF] leading-tight">Predictive gradient burn rates</span>
                 </motion.div>
                 <motion.div variants={itemVariant} whileHover={{ y: -5, scale: 1.05 }} className="bg-[#161D30] border border-[#0ea5e9]/30 p-4 rounded-xl shadow-[0_0_20px_rgba(14,165,233,0.1)] w-full lg:w-56 h-32 flex flex-col items-center justify-center gap-2 cursor-pointer group hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] transition-all">
                   <Droplets className="w-6 h-6 text-[#0ea5e9] group-hover:scale-125 transition-transform duration-300" />
                   <span className="text-white font-bold text-sm">Flood Risk</span>
                   <span className="text-[10px] text-[#9CA3AF] leading-tight">Low-lying coastal detection</span>
                 </motion.div>
                 <motion.div variants={itemVariant} whileHover={{ y: -5, scale: 1.05 }} className="bg-[#161D30] border border-[#f97316]/30 p-4 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.1)] w-full lg:w-56 h-32 flex flex-col items-center justify-center gap-2 cursor-pointer group hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all">
                   <MountainSnow className="w-6 h-6 text-[#f97316] group-hover:scale-125 transition-transform duration-300" />
                   <span className="text-white font-bold text-sm">Landslide Risk</span>
                   <span className="text-[10px] text-[#9CA3AF] leading-tight">Steep altitude danger zones</span>
                 </motion.div>
               </motion.div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>
      
      {/* Required CSS for 3D flips (Tailwind doesn't have these exact utilities built-in by default without plugins) */}
      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .group:hover .group-hover\\:rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </div>
  );
}
