import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, Eraser, Cpu, SplitSquareHorizontal, 
  Target, Share2, Layers, MapPin, BarChart3,
  ArrowRight, ArrowDown, Activity, GitBranch
} from 'lucide-react';

const SectionHeader = ({ title, icon: Icon, description, index }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    className="mb-10 relative"
  >
    <div className="absolute -left-4 -top-6 text-[120px] font-black text-white/[0.03] select-none z-0">
      0{index}
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-gradient-to-br from-[#3b82f6]/20 to-[#22c55e]/20 text-[#3b82f6] rounded-xl border border-[#3b82f6]/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          <Icon className="w-8 h-8 text-[#3b82f6]" />
        </div>
        <h2 className="text-4xl font-black text-white tracking-tight">{title}</h2>
      </div>
      <p className="text-[#9CA3AF] text-lg max-w-3xl leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

const GlassContainer = ({ children, className = '' }: any) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true, margin: "-50px" }}
    className={`glass-panel p-8 rounded-2xl border border-[#1F293D] shadow-2xl ${className}`}
  >
    {children}
  </motion.div>
);

// SECTION 1: Dataset Visualization
const SecDataset = () => (
  <div>
    <SectionHeader index={1} title="The Raw Dataset" icon={Database} description="Every machine learning model starts with data. For GeoAltitude, our raw dataset consists of thousands of GPS coordinates collected worldwide. Our goal is to predict the Altitude based on the Latitude and Longitude." />
    <GlassContainer>
      <div className="overflow-hidden rounded-xl border border-[#1F293D]">
        <table className="w-full text-left text-sm font-mono text-[#9CA3AF]">
          <thead className="bg-[#161D30] text-white">
            <tr>
              <th className="p-4 border-b border-[#1F293D]">Latitude (Feature)</th>
              <th className="p-4 border-b border-[#1F293D]">Longitude (Feature)</th>
              <th className="p-4 border-b border-[#1F293D]">Speed (Ignored)</th>
              <th className="p-4 border-b border-[#1F293D] bg-[#22c55e]/10 text-[#22c55e]">Altitude (Target)</th>
            </tr>
          </thead>
          <tbody>
            {[
              [10.8505, 76.2711, 0.0, 21.5],
              [40.7128, -74.0060, 1.2, 10.0],
              [51.5074, -0.1278, 0.5, 35.2],
              [35.6762, 139.6503, 0.0, 40.0]
            ].map((row, i) => (
              <motion.tr 
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                key={i} className="border-b border-[#1F293D]/50 hover:bg-white/5 transition-colors"
              >
                <td className="p-4">{row[0]}</td><td className="p-4">{row[1]}</td><td className="p-4 opacity-50">{row[2]}</td>
                <td className="p-4 font-bold text-white bg-[#22c55e]/5">{row[3]} m</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassContainer>
  </div>
);

// SECTION 2: Data Cleaning
const SecCleaning = () => (
  <div>
    <SectionHeader index={2} title="Data Cleaning" icon={Eraser} description="Real-world data is messy. GPS sensors sometimes fail, leaving blank fields or recording impossible altitudes (like 0m on a mountain). We filter out missing values and mathematical outliers." />
    <GlassContainer className="flex items-center justify-between gap-4 py-12 px-10">
      {[
        { label: "Raw GPS Data", color: "from-gray-600 to-gray-800" },
        { label: "Remove Nulls", color: "from-yellow-500 to-yellow-700" },
        { label: "Remove Outliers (Z-Score)", color: "from-orange-500 to-orange-700" },
        { label: "Cleaned Data", color: "from-[#22c55e] to-green-800" }
      ].map((step, i, arr) => (
        <React.Fragment key={i}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }}
            className={`flex-1 p-6 rounded-xl bg-gradient-to-br ${step.color} border border-white/20 text-center font-bold text-white shadow-lg relative overflow-hidden group`}
          >
            <motion.div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10">{step.label}</span>
          </motion.div>
          {i < arr.length - 1 && (
            <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} className="w-8 h-1 bg-[#3b82f6] origin-left" />
          )}
        </React.Fragment>
      ))}
    </GlassContainer>
  </div>
);

// SECTION 3: Feature Engineering
const SecFeatureEng = () => (
  <div>
    <SectionHeader index={3} title="Feature Engineering" icon={Cpu} description="Decision trees draw straight lines (boxes) to divide data. Because the Earth is round and terrain is complex, we help the model by inventing new non-linear features." />
    <GlassContainer>
      <div className="flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1 space-y-4">
          <div className="p-4 bg-[#161D30] rounded-xl border border-[#1F293D] flex justify-center gap-4">
            <span className="px-4 py-2 bg-[#3b82f6]/20 text-[#3b82f6] font-mono rounded">Latitude</span>
            <span className="px-4 py-2 bg-[#3b82f6]/20 text-[#3b82f6] font-mono rounded">Longitude</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
            <Cpu className="w-10 h-10 text-purple-500" />
          </motion.div>
          <span className="text-xs text-[#9CA3AF] mt-2 font-bold uppercase tracking-wider">Polynomial Expansion</span>
        </div>
        <div className="flex-[2] grid grid-cols-2 gap-4">
          {[
            { n: "Latitude", d: "Original feature" },
            { n: "Longitude", d: "Original feature" },
            { n: "Latitude²", d: "Captures parabolic curvature" },
            { n: "Longitude²", d: "Captures parabolic curvature" },
            { n: "Lat × Lon", d: "Captures diagonal terrain interactions" }
          ].map((f, i) => (
            <motion.div 
              key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg"
            >
              <div className="font-mono font-bold text-white">{f.n}</div>
              <div className="text-[10px] text-[#9CA3AF]">{f.d}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </GlassContainer>
  </div>
);

// SECTION 4: Train Test Split
const SecSplit = () => (
  <div>
    <SectionHeader index={4} title="Train / Test Split" icon={SplitSquareHorizontal} description="We cannot test our model on the data it learned from (it would just memorize the answers!). We split the data: 80% is hidden inside the model to learn, and 20% is locked away for a final pop quiz." />
    <GlassContainer>
      <div className="flex gap-2 flex-wrap justify-center overflow-hidden h-[200px] content-start">
        {Array.from({ length: 100 }).map((_, i) => {
          const isTrain = i < 80;
          return (
            <motion.div 
              key={i}
              initial={{ x: 0, y: -50, opacity: 0 }}
              whileInView={{ 
                x: isTrain ? -10 : 10, 
                y: 0, 
                opacity: 1,
                backgroundColor: isTrain ? '#3b82f6' : '#22c55e'
              }}
              transition={{ delay: i * 0.01, type: 'spring' }}
              className="w-4 h-4 rounded-sm"
              title={isTrain ? "Train Data (80%)" : "Test Data (20%)"}
            />
          );
        })}
      </div>
      <div className="flex justify-between px-20 mt-4 font-black text-xl uppercase tracking-widest">
        <span className="text-[#3b82f6]">Train (80%)</span>
        <span className="text-[#22c55e]">Test (20%)</span>
      </div>
    </GlassContainer>
  </div>
);

// SECTION 5: XGBoost Training
const SecXGBoost = () => (
  <div>
    <SectionHeader index={5} title="XGBoost: Residual Learning" icon={Target} description="Unlike Random Forests which build trees independently, XGBoost builds trees sequentially. Each new tree looks at the mistakes (residuals) of the previous trees and tries to fix them!" />
    <GlassContainer>
      <div className="flex flex-col space-y-6 relative">
        <div className="absolute left-6 top-10 bottom-10 w-1 bg-[#1F293D]" />
        {[
          { t: "Tree 1", desc: "Makes a rough guess. (e.g. predicts 100m, actual is 150m. Error = +50m)" },
          { t: "Tree 2", desc: "Tries to predict the ERROR of Tree 1. (e.g. predicts +40m. Remaining error = +10m)" },
          { t: "Tree 3", desc: "Tries to predict the ERROR of Tree 2. (e.g. predicts +10m. Remaining error = 0m!)" },
          { t: "...", desc: "Repeats for hundreds of trees, getting hyper-accurate." }
        ].map((step, i) => (
          <motion.div 
            key={i} initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.3 }}
            className="flex items-center gap-6 relative z-10"
          >
            <div className="w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              {i+1}
            </div>
            <div className="p-4 bg-[#161D30] border border-[#1F293D] rounded-xl flex-1">
              <h4 className="font-bold text-white text-lg">{step.t}</h4>
              <p className="text-[#9CA3AF] text-sm">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassContainer>
  </div>
);

// SECTION 6: Tree Building
const SecTreeGrowth = () => (
  <div>
    <SectionHeader index={6} title="Growing a Decision Tree" icon={GitBranch} description="Inside a single tree, the algorithm tests every possible split on every feature to find the one that best separates high altitudes from low altitudes." />
    <GlassContainer className="h-[400px] flex items-center justify-center relative overflow-hidden">
      <svg width="400" height="300" viewBox="0 0 400 300">
        <motion.circle cx="200" cy="50" r="20" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" initial={{ scale: 0 }} whileInView={{ scale: 1 }} />
        <text x="200" y="55" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">Root</text>
        
        {/* Left Branch */}
        <motion.line x1="200" y1="70" x2="100" y2="150" stroke="#9ca3af" strokeWidth="2" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ delay: 0.5 }} />
        <motion.circle cx="100" cy="150" r="20" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 0.8 }} />
        <text x="100" y="155" textAnchor="middle" fill="white" fontSize="12">Node 1</text>
        
        {/* Right Branch */}
        <motion.line x1="200" y1="70" x2="300" y2="150" stroke="#9ca3af" strokeWidth="2" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ delay: 0.5 }} />
        <motion.circle cx="300" cy="150" r="20" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 0.8 }} />
        <text x="300" y="155" textAnchor="middle" fill="white" fontSize="12">Node 2</text>

        {/* Leaves */}
        <motion.line x1="100" y1="170" x2="50" y2="250" stroke="#9ca3af" strokeWidth="2" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ delay: 1.2 }} />
        <motion.circle cx="50" cy="250" r="20" fill="#22c55e" initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 1.5 }} />
        <text x="50" y="255" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Leaf</text>

        <motion.line x1="100" y1="170" x2="150" y2="250" stroke="#9ca3af" strokeWidth="2" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ delay: 1.2 }} />
        <motion.circle cx="150" cy="250" r="20" fill="#22c55e" initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 1.5 }} />
        <text x="150" y="255" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Leaf</text>
      </svg>
    </GlassContainer>
  </div>
);

// SECTION 7: Ensemble
const SecEnsemble = () => (
  <div>
    <SectionHeader index={7} title="Ensemble Summation" icon={Layers} description="The final prediction is NOT an average. Because each tree predicts a residual (error adjustment), the final altitude is the Sum of all tree outputs plus a base bias." />
    <GlassContainer>
       <div className="flex flex-wrap gap-4 justify-center items-center">
         {[15.2, -3.1, 0.4, -0.1, 0.05].map((val, i) => (
           <React.Fragment key={i}>
             <motion.div 
               initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: i * 0.1 }}
               className="w-16 h-16 rounded-xl bg-[#161D30] border border-[#1F293D] flex items-center justify-center font-mono font-bold text-white shadow-lg"
             >
               {val > 0 ? '+' : ''}{val}
             </motion.div>
             {i < 4 && <span className="text-[#3b82f6] font-black text-xl">+</span>}
           </React.Fragment>
         ))}
         <span className="text-[#3b82f6] font-black text-xl">=</span>
         <motion.div 
           initial={{ scale: 0, rotate: -10 }} whileInView={{ scale: 1, rotate: 0 }} transition={{ delay: 0.8, type: "spring" }}
           className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#22c55e] to-green-700 flex items-center justify-center font-black text-2xl text-white shadow-[0_0_30px_rgba(34,197,94,0.4)]"
         >
           12.45m
         </motion.div>
       </div>
    </GlassContainer>
  </div>
);

// SECTION 8: Workflow
const SecWorkflow = () => (
  <div>
    <SectionHeader index={8} title="Live Prediction Workflow" icon={MapPin} description="When you input a GPS coordinate, it flows through the exact same mathematical pipeline before hitting the ensemble of trees." />
    <GlassContainer className="py-16">
      <div className="flex flex-col md:flex-row items-center justify-between relative max-w-4xl mx-auto">
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#1F293D] -translate-y-1/2 z-0 hidden md:block" />
        
        {/* Animated flow dot */}
        <motion.div 
          className="hidden md:block absolute top-1/2 left-0 w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6] -translate-y-1/2 z-10"
          animate={{ left: ["0%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        {[
          { label: "GPS Input", icon: MapPin },
          { label: "Add Poly Features", icon: Cpu },
          { label: "Standard Scaler", icon: BarChart3 },
          { label: "XGBoost", icon: Layers },
          { label: "Altitude Output", icon: Target, color: "text-[#22c55e]", border: "border-[#22c55e]" }
        ].map((step, i) => (
          <div key={i} className="relative z-20 flex flex-col items-center gap-3 bg-[#0B0F19] p-2">
            <div className={`w-14 h-14 rounded-full bg-[#161D30] border ${step.border || 'border-[#1F293D]'} flex items-center justify-center`}>
              <step.icon className={`w-6 h-6 ${step.color || 'text-white'}`} />
            </div>
            <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">{step.label}</span>
          </div>
        ))}
      </div>
    </GlassContainer>
  </div>
);

// SECTION 9: Metrics
const SecMetrics = () => (
  <div>
    <SectionHeader index={9} title="Evaluation Metrics" icon={BarChart3} description="How do we know the model is good? We test it on the hidden 20% of data and calculate these standard regression metrics." />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <GlassContainer className="!p-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4"><BarChart3 /></div>
        <h3 className="font-black text-white text-xl mb-2">MAE</h3>
        <p className="text-xs text-[#9CA3AF] mb-4">Mean Absolute Error</p>
        <p className="text-sm text-white/80">The average off-by-X meters for every prediction. Very intuitive to understand.</p>
      </GlassContainer>
      <GlassContainer className="!p-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><Target /></div>
        <h3 className="font-black text-white text-xl mb-2">RMSE</h3>
        <p className="text-xs text-[#9CA3AF] mb-4">Root Mean Squared Error</p>
        <p className="text-sm text-white/80">Squares the errors before averaging, which heavily penalizes massive outliers.</p>
      </GlassContainer>
      <GlassContainer className="!p-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4"><Activity /></div>
        <h3 className="font-black text-white text-xl mb-2">R² Score</h3>
        <p className="text-xs text-[#9CA3AF] mb-4">Coefficient of Determination</p>
        <p className="text-sm text-white/80">Scores from 0 to 1. Shows what percentage of the variance in altitude the model learned.</p>
      </GlassContainer>
    </div>
  </div>
);

export default function LearnXGBoost() {
  return (
    <div className="max-w-5xl mx-auto space-y-32 pb-32 pt-10">
      
      {/* Hero */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
        className="text-center space-y-6 mb-20"
      >
        <div className="inline-block px-4 py-1.5 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-bold text-sm tracking-widest uppercase">
          Interactive Course
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
          How <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22c55e] to-[#3b82f6]">XGBoost</span> Works
        </h1>
        <p className="text-xl text-[#9CA3AF] max-w-2xl mx-auto">
          Scroll down to discover the mathematics, workflows, and magic behind GeoAltitude's Gradient Boosted Decision Trees.
        </p>
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="pt-10 flex justify-center">
          <ArrowDown className="w-8 h-8 text-[#3b82f6] opacity-50" />
        </motion.div>
      </motion.div>

      <SecDataset />
      <SecCleaning />
      <SecFeatureEng />
      <SecSplit />
      <SecXGBoost />
      <SecTreeGrowth />
      <SecEnsemble />
      <SecWorkflow />
      <SecMetrics />
      
      <motion.div 
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        className="text-center pt-20 border-t border-[#1F293D]"
      >
        <h2 className="text-3xl font-black text-white mb-6">Ready to train your own?</h2>
        <a href="/dataset" className="inline-flex items-center gap-2 px-8 py-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold rounded-xl transition-colors shadow-[0_0_20px_rgba(59,130,246,0.4)]">
          Go to Dataset Manager <ArrowRight className="w-5 h-5" />
        </a>
      </motion.div>
    </div>
  );
}
