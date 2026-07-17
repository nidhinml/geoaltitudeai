import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Info, Map as MapIcon, Eye, X, BookOpen, Brain, Code } from 'lucide-react';

const GUIDE_CONTENT: Record<string, { title: string, guide?: React.ReactNode, tech?: React.ReactNode, ai?: React.ReactNode }> = {
  '/': {
    title: 'Dashboard',
    guide: (
      <ol className="list-decimal pl-5 text-sm text-[#9CA3AF] space-y-2">
        <li><strong className="text-white">KPI Monitoring:</strong> View live dataset statistics, AI model status, and prediction volumes in real-time.</li>
        <li><strong className="text-white">Live Telemetry:</strong> The interactive heatmap displays geographic areas where the XGBoost model has been heavily trained and tested.</li>
        <li><strong className="text-white">Activity Feed:</strong> Watch live predictions stream in as API requests hit the server from external fleet clients.</li>
      </ol>
    ),
    tech: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Architecture:</strong> Built with React, Tailwind, and Recharts. The Dashboard polls the FastAPI backend <code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded">/dashboard/stats</code> endpoint via standard HTTP requests and leverages <strong className="text-[#f59e0b]">React Query</strong> for robust caching, refetching, and error handling.
      </p>
    ),
    ai: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">System Pulse:</strong> The dashboard serves as the central nervous system of the AI. It aggregates millions of prediction events to ensure the underlying XGBoost model is healthy and serving low-latency inference to connected fleets.
      </p>
    )
  },
  '/route-intelligence': {
    title: 'Vehicle Route Intelligence',
    guide: (
      <ol className="list-decimal pl-5 text-sm text-[#9CA3AF] space-y-2">
        <li><strong className="text-white">Input Method:</strong> Choose between uploading a raw GPS CSV or drawing a custom route interactively on the map.</li>
        <li><strong className="text-white">Physics Config:</strong> Select your specific vehicle category, fuel type, and mileage before analysis to ensure accurate calculations.</li>
        <li><strong className="text-white">Insights:</strong> Review TDI, Fuel, and Battery consumption derived mathematically from the AI's terrain topology.</li>
      </ol>
    ),
    tech: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Data Pipeline:</strong> Whether via CSV or Map, the frontend transmits geographic waypoints to the backend. The backend's physics engine loops through the points, querying the in-memory XGBoost model for each point's altitude. Gradients are then derived using Haversine distance calculations.
      </p>
    ),
    ai: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Physics Engine:</strong> Fuel and Battery consumption algorithms apply a base multiplier against the calculated TDI (Travel Difficulty Index). Gradient spikes act as heavy weight penalties (adjusted for vehicle class), drastically increasing simulated consumption rates. Downhill sections simulate regenerative braking recovery for EVs.
      </p>
    )
  },
  '/dataset': {
    title: 'Dataset Management',
    guide: (
      <ol className="list-decimal pl-5 text-sm text-[#9CA3AF] space-y-2">
        <li><strong className="text-white">Ingestion:</strong> Upload your raw AIS-140 standard GPS datasets (CSV format) to the platform.</li>
        <li><strong className="text-white">Preview:</strong> The system automatically samples the data to generate a preview table without crashing the browser on large datasets.</li>
        <li><strong className="text-white">Statistics:</strong> The platform calculates core mathematical statistics across all numerical columns to identify data drift or anomalies before training.</li>
      </ol>
    ),
    tech: (
      <div className="space-y-4">
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          <strong className="text-white">Descriptive Statistics Explained:</strong> The backend leverages Pandas to compute standard metrics for numerical features (Latitude, Longitude, Altitude, Speed).
        </p>
        <ul className="list-disc pl-5 text-sm text-[#9CA3AF] space-y-3">
          <li>
            <strong className="text-white">Mean (μ):</strong> The average value. Identifies the central tendency of the data. 
            <br/><code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded text-[10px] mt-1 inline-block">μ = (Σx) / n</code>
          </li>
          <li>
            <strong className="text-white">Standard Deviation (σ):</strong> Measures the amount of variation or dispersion. A low std-dev means values are clustered near the mean (e.g., driving on a flat highway), while a high std-dev indicates wide spread (e.g., highly varied mountainous terrain).
            <br/><code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded text-[10px] mt-1 inline-block">σ = √[ Σ(x - μ)² / n ]</code>
          </li>
          <li>
            <strong className="text-white">Min / Max:</strong> The absolute lowest and highest values recorded. Crucial for identifying geographic boundaries and filtering out impossible GPS noise (e.g., altitude outliers).
          </li>
        </ul>
      </div>
    ),
    ai: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Why it matters for AI:</strong> XGBoost decision trees rely heavily on feature variance. If the Standard Deviation of altitude is near zero, the model will struggle to learn gradient patterns. By tracking these statistics, you ensure the dataset has sufficient variance to train a robust prediction model.
      </p>
    )
  },
  '/data-cleaning': {
    title: 'Data Cleaning Studio',
    guide: (
      <ol className="list-decimal pl-5 text-sm text-[#9CA3AF] space-y-2">
        <li><strong className="text-white">Anomaly Detection:</strong> View rows with missing values, extreme speed outliers, or impossible geographic coordinates.</li>
        <li><strong className="text-white">Purge Noise:</strong> Click the "Clean Data" button to automatically drop corrupted rows from the dataset.</li>
        <li><strong className="text-white">Verify:</strong> Check the dataset health score to ensure it is pristine before moving to Feature Engineering.</li>
      </ol>
    ),
    tech: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Data Pipeline:</strong> The backend Pandas engine executes strict validation rules: 
        <br/><code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded text-[10px]">speed &lt; 200 km/h</code> and <code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded text-[10px]">-90 &lt; lat &lt; 90</code>. Rows violating physical limitations are dropped entirely to prevent model poisoning.
      </p>
    ),
    ai: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Model Safety:</strong> Garbage In, Garbage Out (GIGO). If an XGBoost model is trained on GPS glitches (e.g. a truck moving at 800 km/h), its decision boundaries will become corrupted, leading to wild inaccuracies in live predictions. Cleaning ensures robust inference.
      </p>
    )
  },
  '/assistant': {
    title: 'Geo Ai Core Intelligence',
    guide: (
      <ol className="list-decimal pl-5 text-sm text-[#9CA3AF] space-y-2">
        <li><strong className="text-white">Ask Questions:</strong> Ask Geo Ai any technical or non-technical question regarding the platform, such as "How do you calculate Flood Risk?" or "Explain XGBoost feature engineering."</li>
        <li><strong className="text-white">Clear Context:</strong> Use the "Clear Chat" button in the header to wipe the conversation history and start a fresh context window.</li>
        <li><strong className="text-white">Real-Time Processing:</strong> The UI instantly streams the AI's response using Server-Sent Events (SSE) so you don't have to wait for large answers to finish generating.</li>
      </ol>
    ),
    tech: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Architecture & Streaming:</strong> Geo Ai uses the <strong className="text-white">NVIDIA NIM</strong> infrastructure to run the massive <strong className="text-white">Llama 3.1 8B Instruct</strong> model. The React frontend communicates with the FastAPI backend, which securely holds the NVIDIA API Key. To achieve instantaneous response times (low TTFT), the backend utilizes FastAPI's <code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded text-[10px]">StreamingResponse</code> with <code className="text-[#f59e0b] bg-[#f59e0b]/10 px-1 rounded text-[10px]">text/event-stream</code> MIME types, bypassing all proxy buffers.
      </p>
    ),
    ai: (
      <p className="text-sm text-[#9CA3AF] leading-relaxed">
        <strong className="text-white">Contextual Fine-Tuning:</strong> Geo Ai does not just use base Llama 3.1 weights. It is dynamically "fine-tuned" on startup via a massive <strong className="text-white">Knowledge Base file (geo_ai_knowledge.md)</strong>. This Markdown file contains exact physics formulas (Haversine, Gradient Impacts), Risk assessment thresholds (Flood & Landslide), and the complete pipeline architecture. This file is injected into the AI's hidden System Prompt, forcing it to act strictly as the internal intelligence for GeoAltitude AI rather than a generic chatbot.
      </p>
    )
  }
};

export default function GlobalPageGuide() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'guide' | 'tech' | 'ai'>('guide');

  const config = GUIDE_CONTENT[location.pathname] || {};
  
  const content = {
    title: config.title || 'Feature Information',
    guide: config.guide || <p className="text-sm text-[#9CA3AF]">Follow the on-screen instructions to interact with this module.</p>,
    tech: config.tech || <p className="text-sm text-[#9CA3AF]">This module is powered by the GeoAltitude AI platform architecture.</p>,
    ai: config.ai || <p className="text-sm text-[#9CA3AF]">Machine Learning models handle complex pattern recognition behind the scenes.</p>
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 rounded-full bg-[#1F293D] hover:bg-[#374151] border border-[#374151] flex items-center justify-center text-[#9CA3AF] hover:text-white transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50"
        title="Page Guide & Info"
      >
        <Info className="w-4 h-4" />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-[#0B0F19] border border-[#1F293D] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#1F293D] bg-gradient-to-r from-[#161D30] to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#3b82f6]/10 text-[#3b82f6] rounded-lg">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-wide">Module Intelligence</h2>
                      <p className="text-xs text-[#9CA3AF]">Guide for: <span className="text-white">{content.title}</span></p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg text-[#9CA3AF] hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#1F293D] px-4 pt-2 gap-6 bg-[#080B11]">
                  <button onClick={() => setActiveTab('guide')} className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'guide' ? 'border-[#3b82f6] text-[#3b82f6]' : 'border-transparent text-[#9CA3AF] hover:text-white'}`}>
                    <BookOpen className="w-4 h-4" /> User Guide
                  </button>
                  <button onClick={() => setActiveTab('tech')} className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'tech' ? 'border-[#f59e0b] text-[#f59e0b]' : 'border-transparent text-[#9CA3AF] hover:text-white'}`}>
                    <Code className="w-4 h-4" /> Tech & Arch
                  </button>
                  <button onClick={() => setActiveTab('ai')} className={`pb-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'ai' ? 'border-[#a855f7] text-[#a855f7]' : 'border-transparent text-[#9CA3AF] hover:text-white'}`}>
                    <Brain className="w-4 h-4" /> How AI Works
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-[#080B11]">
                  <AnimatePresence mode="wait">
                    {activeTab === 'guide' && (
                      <motion.div key="guide" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#3b82f6]" /> Step-by-Step Guide</h3>
                        <div className="p-5 rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/5">
                          {content.guide}
                        </div>
                      </motion.div>
                    )}
                    {activeTab === 'tech' && (
                      <motion.div key="tech" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Code className="w-5 h-5 text-[#f59e0b]" /> Under the Hood</h3>
                        <div className="p-5 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5">
                          {content.tech}
                        </div>
                      </motion.div>
                    )}
                    {activeTab === 'ai' && (
                      <motion.div key="ai" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-[#a855f7]" /> AI & Machine Learning</h3>
                        <div className="p-5 rounded-xl border border-[#a855f7]/20 bg-[#a855f7]/5">
                          {content.ai}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
